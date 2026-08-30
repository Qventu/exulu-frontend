"use client";

/**
 * The single chat hooks home (work item 2.3, owner: orchestration).
 *
 * - useChatSession   — the ChatSessionController: AI-SDK transport, lazy
 *                      session creation, token accounting, model override,
 *                      capability toggles, pre-approvals, pinned knowledge
 *                      scope, next-message attachments, suggestions, files
 *                      panel state, budget block. Decomposed 1:1 from the
 *                      legacy app/(application)/chat/[agent]/[session]/chat.tsx
 *                      monolith — every transport invariant is preserved
 *                      verbatim (see design/pages/chat.md §4 risks).
 * - useChatSessions  — the session list (history rail + search page data).
 * - useSessionMutations — named create / rename / delete / bulk delete.
 * - useAvailableModels  — LiteLLM-catalog vs Models-table switch.
 *
 * STABLE localStorage keys (regression contract — byte-identical to legacy):
 *   `pre-approved-tool-calls-${sessionId}`  (JSON string[] of tool ids)
 *   "chat.sessionFilesPanel.open"           ("true" | "false")
 */

import { useMutation, useQuery } from "@apollo/client";
import { useChat } from "@ai-sdk/react";
import {
  ChatAddToolApproveResponseFunction,
  DefaultChatTransport,
  FileUIPart,
  UIMessage,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { DemoChatTransport } from "@/lib/demo/chat-transport";
import { getCurrentPosition, turnsFor } from "@/lib/demo/current-position";
import { isDemoMode } from "@/lib/demo/flag";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/shell/config-context";
import { getPresignedUrl } from "@/components/primitives/file-picker";
import { getToken } from "@/lib/api/client";
import { sessionFilesApi } from "@/lib/api/session-files";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { Item } from "@/types/models/item";

import {
  CREATE_AGENT_SESSION,
  GET_AGENT_SESSIONS,
  GET_LITELLM_CATALOG,
  GET_USER_BY_ID,
  REMOVE_AGENT_SESSION_BY_ID,
  UPDATE_AGENT_SESSION_ITEMS,
  UPDATE_AGENT_SESSION_TITLE,
} from "./queries";
import {
  COMPACTION_INSUFFICIENT,
  CONTEXT_COMPACTION_REQUIRED,
  computeContextOccupancy,
  deriveContextBudget,
  deriveContextState,
  type ContextState,
} from "./lib/context-budget";

// ---------------------------------------------------------------------------
// Shared types (binding contracts)
// ---------------------------------------------------------------------------

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export interface TokenCounts {
  totalTokens: number;
  reasoningTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface UseChatSessionArgs {
  agent: Agent;
  initialSession: AgentSession | null; // null on /new
  initialMessages: UIMessage[];
  /** ChatShell's lazy-create window marker (stable identity — passed as a
   *  prop through SessionScreen rather than read from context here, so the
   *  React.memo around the conversation column keeps holding). */
  beginLazyCreate: () => () => void;
}

/**
 * The decomposed chat.tsx monolith state. Instantiated EXACTLY ONCE in
 * session-screen.tsx and passed down by prop. No sibling may duplicate any
 * of this state.
 */
export interface ChatSessionController {
  // identity & access
  agent: Agent;
  session: AgentSession | null;
  writeAccess: boolean;
  creatorEmail?: string;
  // transport (AI SDK passthrough)
  messages: UIMessage[];
  status: ChatStatus;
  sendUserMessage: (text: string) => Promise<void>;
  sendQuestionAnswer: (answerText: string) => void;
  stop: () => void;
  regenerate: () => void;
  setMessages: (m: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  ensureSession: () => Promise<AgentSession | null>;
  error: string | null;
  errorRaw: string | null;
  clearError: () => void;
  // token accounting (items 27/38)
  tokenCounts: TokenCounts;
  maxInputLength: number;
  // per-request model override (item 26)
  modelOverride: string | null;
  setModelOverride: (modelId: string | null) => void;
  // capability toggles (items 69–71)
  disabledTools: string[];
  toggleTool: (id: string) => void;
  enableAll: (ids: string[]) => void;
  disableAll: (ids: string[]) => void;
  // tool pre-approvals (item 50)
  preApprovedTools: string[];
  approveToolForChat: (toolId: string) => void;
  revokePreApprovedTool: (toolId: string) => void;
  // pinned knowledge scope (items 66/67) — gids are "ctx" or "ctx/item"
  sessionItems: string[] | null;
  addSessionItems: (gids: string[]) => Promise<void>;
  removeSessionItem: (gid: string) => Promise<void>;
  replaceSessionItems: (gids: string[]) => Promise<void>;
  // next-message attachments (items 74/75)
  fileItems: string[] | null;
  addFileItem: (s3Key: string) => void;
  removeFileItem: (s3Key: string) => void;
  // follow-up suggestions (item 63)
  suggestions: string[];
  // session files panel (items 64/79)
  filesPanelOpen: boolean;
  setFilesPanelOpen: (open: boolean) => Promise<void>;
  sessionFilesCount: number | null;
  // budget (item 73)
  budgetExceeded: boolean;
  // managed context (item 72)
  managedContextEnabled: boolean;
  // context-window management (spec 2026-07-07)
  contextWindow: number | null;
  contextOccupancy: number;
  contextState: ContextState;
  compacting: boolean;
  compactConversation: (steer?: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// useChatSession
// ---------------------------------------------------------------------------

/** Raw read, byte-identical to the legacy onSubmit: the body value sent as
 *  `approvedTools` is either the raw JSON string or an empty array. */
function readApprovedToolsRaw(sessionId: string | undefined): string | never[] {
  try {
    return (
      window.localStorage.getItem(`pre-approved-tool-calls-${sessionId}`) || []
    );
  } catch {
    return [];
  }
}

function readPreApprovedList(sessionId: string | undefined): string[] {
  if (!sessionId) return [];
  try {
    const raw = window.localStorage.getItem(
      `pre-approved-tool-calls-${sessionId}`,
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useChatSession({
  agent,
  initialSession,
  initialMessages,
  beginLazyCreate,
}: UseChatSessionArgs): ChatSessionController {
  const t = useTranslations("chat");
  const configContext = React.useContext(ConfigContext);
  const { user } = React.useContext(UserContext);

  // --- errors ---------------------------------------------------------------
  const [error, setError] = React.useState<string | null>(null);
  const [errorRaw, setErrorRaw] = React.useState<string | null>(null);
  const clearError = React.useCallback(() => {
    setError(null);
    setErrorRaw(null);
  }, []);

  // --- budget (item 73) — cap reached blocks sending -------------------------
  const budgetExceeded = !!(
    user?.budget &&
    user.budget.max_budget != null &&
    user.budget.max_budget > 0 &&
    user.budget.spend >= user.budget.max_budget
  );

  // --- attachments (items 74/75) ---------------------------------------------
  const [files, setFiles] = React.useState<FileUIPart[] | null>(null);
  const [fileItems, setFileItems] = React.useState<string[] | null>(null);

  // --- pinned knowledge scope (items 66/67) ----------------------------------
  const [sessionItems, setSessionItems] = React.useState<string[] | null>(
    initialSession?.session_items || null,
  );

  // --- per-request model override (item 26) ----------------------------------
  const [modelOverride, setModelOverrideState] = React.useState<string | null>(
    null,
  );
  const modelOverrideRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    modelOverrideRef.current = modelOverride;
  }, [modelOverride]);
  const setModelOverride = React.useCallback(
    (modelId: string | null) => {
      // null / the agent's own model clears the override (contract).
      setModelOverrideState(
        !modelId || modelId === agent.model ? null : modelId,
      );
    },
    [agent.model],
  );

  // --- capability toggles (items 69–71) --------------------------------------
  const [disabledTools, setDisabledTools] = React.useState<string[]>([]);
  // Latest-value mirror: sendQuestionAnswer can be invoked from a memoized
  // message item whose closure predates the latest toggle state.
  const disabledToolsRef = React.useRef<string[]>(disabledTools);
  React.useEffect(() => {
    disabledToolsRef.current = disabledTools;
  }, [disabledTools]);
  const toggleTool = React.useCallback((id: string) => {
    setDisabledTools((prev) =>
      prev.includes(id) ? prev.filter((name) => name !== id) : [...prev, id],
    );
  }, []);
  const enableAll = React.useCallback((ids: string[]) => {
    setDisabledTools((prev) => prev.filter((id) => !ids.includes(id)));
  }, []);
  const disableAll = React.useCallback((ids: string[]) => {
    setDisabledTools((prev) => Array.from(new Set([...prev, ...ids])));
  }, []);

  // --- suggestions (item 63) --------------------------------------------------
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const suggestionAbortRef = React.useRef<AbortController | null>(null);

  // --- instance liveness -------------------------------------------------------
  // The nonce-keyed remount (session-screen.tsx) can tear this instance down
  // while a lazy session create is in flight; orphaned continuations must not
  // fire global side effects (URL swap, sendMessage) against the fresh screen.
  const aliveRef = React.useRef(true);
  React.useEffect(() => {
    aliveRef.current = true; // Strict Mode re-runs effects after a simulated unmount
    return () => {
      aliveRef.current = false;
    };
  }, []);
  // Generation stamp for the lazy-create flow. aliveRef alone misses
  // param-only [session] navigations, where the App Router PRESERVES this
  // instance (see the reset effect below): an in-flight create then belongs
  // to the abandoned flow and must not swap the URL, overwrite the session
  // state, or send. Bumped by the reset effect on every session change.
  const sessionEpochRef = React.useRef(0);

  // --- session identity (item 34: lazy creation) ------------------------------
  const [currentSession, setCurrentSession] = React.useState<AgentSession | null>(
    initialSession,
  );
  const currentSessionRef = React.useRef<AgentSession | null>(initialSession);
  React.useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const [writeAccess, setWriteAccess] = React.useState<boolean>(
    initialSession ? checkChatSessionWriteAccess(initialSession, user) : true,
  );

  const [createAgentSession] = useMutation(CREATE_AGENT_SESSION, {
    // STRING operation names kept so observers of both the monolith documents
    // and the chat/queries.ts copies refresh (binding contract).
    refetchQueries: [GET_AGENT_SESSIONS, "GetAgentSessions", GET_USER_BY_ID, "GetUserById"],
  });
  const [updateAgentSessionItems] = useMutation(UPDATE_AGENT_SESSION_ITEMS);

  // --- creator attribution (item 29 support) ----------------------------------
  const creatorQuery = useQuery(GET_USER_BY_ID, {
    variables: { id: currentSession?.created_by },
    skip: !currentSession?.created_by,
  });
  const creatorEmail: string | undefined =
    creatorQuery.data?.userById?.email ?? undefined;

  // --- managed context (item 72) ----------------------------------------------
  const managedContextEnabled = React.useMemo(() => {
    return (
      agent.tools
        ?.find((tool) => tool.id === "agentic_context_search")
        ?.config.find((c) => c.name === "managed_context")?.variable === "true" ||
      // @ts-ignore — backend sometimes delivers a real boolean here
      agent.tools
        ?.find((tool) => tool.id === "agentic_context_search")
        ?.config.find((c) => c.name === "managed_context")?.variable === true
    );
  }, [agent.tools]);

  // --- context-window management -------------------------------------------
  const litellmCatalogQuery = useQuery(GET_LITELLM_CATALOG, {
    fetchPolicy: "cache-first",
  });

  const contextWindow = React.useMemo<number | null>(() => {
    if (modelOverride && modelOverride !== agent.model) {
      const entry = (litellmCatalogQuery.data?.litellmCatalog ?? []).find(
        (m: { model_name: string }) => m.model_name === modelOverride,
      );
      const w = entry?.max_input_tokens ?? entry?.max_tokens;
      // Unknown override window → null (hide the meter) rather than the base
      // agent's window, which may wildly overstate a smaller model.
      return typeof w === "number" && w > 0 ? w : null;
    }
    return typeof agent.maxContextLength === "number" && agent.maxContextLength > 0
      ? agent.maxContextLength
      : null;
  }, [modelOverride, agent.model, agent.maxContextLength, litellmCatalogQuery.data]);

  const [serverContextBlocked, setServerContextBlocked] = React.useState(false);
  const [compacting, setCompacting] = React.useState(false);

  // --- input budget (item 60): 80% of the REAL context window × ~4 chars/token
  const maxInputLength = contextWindow
    ? Math.floor(contextWindow * 0.8 * 4)
    : 50000;

  // --- transport (items 32/33/71 — invariants verbatim from the monolith) -----
  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    setMessages,
    addToolApprovalResponse,
  } = useChat({
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    // Throttle the messages and data updates to 100ms (10 renders/s). At the
    // previous 50ms, a single slow tick on a large conversation saturated the
    // main thread; 100ms halves the per-second render budget with no visible
    // loss of streaming smoothness.
    experimental_throttle: 100,
    async onToolCall({ toolCall }) {
      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic) {
        return;
      }
    },
    onError: (err) => {
      if (err?.message?.includes(CONTEXT_COMPACTION_REQUIRED)) {
        setServerContextBlocked(true);
        return; // dedicated blocked-composer state, not the generic alert
      }
      if (process.env.NODE_ENV === "development") {
        console.error("[Chat Error]", err?.message);
      }
      setErrorRaw(err?.message || null);
      try {
        const { message } = JSON.parse(err?.message);
        setError(message);
      } catch {
        setError(err?.message || t("errors.unexpected"));
      }
    },
    transport: isDemoMode()
      ? new DemoChatTransport({ turns: turnsFor(getCurrentPosition().chapter) })
      : new DefaultChatTransport({
          api: `${configContext?.backend}${agent.slug}/${agent.id}`,
          // only send the last message to the server: we load
          // the history from the database.
          prepareSendMessagesRequest: async ({ messages, id: chatId, body }) => {
            const token = await getToken();
            if (!token) {
              throw new Error("No valid session token available.");
            }
            const session = currentSessionRef.current;
            if (!session) {
              throw new Error("No session available.");
            }
            const override = modelOverrideRef.current;
            return {
              body: {
                ...body,
                message: messages[messages.length - 1],
                id: chatId,
                session: session.id,
              },
              headers: {
                User: user.id,
                Session: session.id,
                Authorization: `Bearer ${token}`,
                Stream: "true",
                ...(override && override !== agent.model
                  ? { "X-Exulu-Model-Override": override }
                  : {}),
              },
            };
          },
        }),
  });

  const contextOccupancy = React.useMemo(() => computeContextOccupancy(messages), [messages]);
  const contextBudget = contextWindow ? deriveContextBudget(contextWindow) : null;
  const contextState = deriveContextState(contextOccupancy, contextBudget, serverContextBlocked);

  // --- reset on session navigation (page params change without remount) -------
  React.useEffect(() => {
    sessionEpochRef.current += 1;
    setCurrentSession(initialSession);
    currentSessionRef.current = initialSession;
    setWriteAccess(
      initialSession ? checkChatSessionWriteAccess(initialSession, user) : true,
    );
    setSessionItems(initialSession?.session_items || null);
    // Keep the visible conversation in sync when the route's session changes
    // without a remount (App Router preserves client state across param-only
    // navigations — the legacy monolith reset currentSession the same way).
    setMessages(initialMessages);
    clearError();
    setServerContextBlocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession, user]);

  // --- token accounting (items 27/38) ------------------------------------------
  // Derived with useMemo (not state + effect): the effect variant queued a
  // second full re-render after every throttled stream tick.
  const tokenCounts = React.useMemo<TokenCounts>(() => {
    const sum = (key: keyof TokenCounts) =>
      messages?.reduce((acc, message) => {
        const meta = message.metadata as Partial<TokenCounts> | undefined;
        return acc + (meta?.[key] || 0);
      }, 0) ?? 0;
    return {
      totalTokens: sum("totalTokens"),
      reasoningTokens: sum("reasoningTokens"),
      inputTokens: sum("inputTokens"),
      outputTokens: sum("outputTokens"),
      cachedInputTokens: sum("cachedInputTokens"),
    };
  }, [messages]);

  // --- lazy session creation (item 34) -----------------------------------------
  const createSession = async (
    title: string,
  ): Promise<AgentSession | null> => {
    const epoch = sessionEpochRef.current;
    // Torn down (nonce remount, cross-agent switch) or navigated to another
    // session on this preserved instance — the visible screen owns the flow.
    const flowIsCurrent = () =>
      aliveRef.current && epoch === sessionEpochRef.current;
    // While the mutation is in flight the URL still ends in /new, so the
    // shell's desync gate would misread a New Chat click as "already
    // pristine" — open the window so it bumps anyway.
    const endLazyCreate = beginLazyCreate();
    try {
      const result = await createAgentSession({
        variables: {
          agent: agent.id,
          user: user.id,
          title,
          rights_mode: "private",
          RBAC: {
            users: [],
            roles: [],
          },
        },
      });

      if (result.data?.agent_sessionsCreateOne?.item) {
        // Orphaned continuation: no state writes, no URL swap — the created
        // (empty) session still lands in the rail via the mutation's refetch.
        if (!flowIsCurrent()) return null;

        const newSession = result.data.agent_sessionsCreateOne
          .item as AgentSession;
        newSession.created_by = user.id;
        // Sync the ref immediately — the transport may read it before React
        // re-renders (the legacy effect-only sync was a latent race).
        currentSessionRef.current = newSession;
        setCurrentSession(newSession);
        setWriteAccess(true);

        // Update URL quietly without triggering Next.js routing — NO remount
        // (a real router.replace would swap in loading.tsx and kill the
        // in-flight stream). CONSEQUENCE: the App Router tree keeps
        // `[session] = "new"`, so any later navigation to /chat/[agent]/new
        // diffs as a no-op — new-chat actions must pair their push with
        // ChatShell's startNewChat() (nonce-keyed SessionScreen remount).
        window.history.replaceState(
          null,
          "",
          `/chat/${agent.id}/${newSession.id}`,
        );

        return newSession;
      }
      if (!flowIsCurrent()) return null;
      setError(t("errors.sessionCreateFailed"));
      return null;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to create session:", err);
      }
      if (!flowIsCurrent()) return null;
      const errorMessage =
        err instanceof Error ? err.message : t("errors.sessionCreateFailed");
      setError(errorMessage);
      toast.error(t("errors.sessionCreateTitle"), { description: errorMessage });
      return null;
    } finally {
      endLazyCreate();
    }
  };

  const ensureSession = async (): Promise<AgentSession | null> => {
    const existing = currentSessionRef.current;
    if (existing && existing.id !== "new") return existing;
    return createSession("");
  };

  // --- sending -------------------------------------------------------------------
  const sendUserMessage = async (text: string): Promise<void> => {
    if (budgetExceeded) {
      toast.error(t("errors.budgetReachedTitle"), {
        description: t("errors.budgetReachedDescription"),
      });
      return;
    }

    if (contextState === "blocked") {
      toast.error(t("context.blockedToastTitle"), {
        description: t("context.blockedToastDescription"),
      });
      return;
    }

    let sessionToUse = currentSessionRef.current;
    if (!sessionToUse || sessionToUse.id === "new") {
      const epoch = sessionEpochRef.current;
      const createdSession = await createSession(text.substring(0, 50));
      if (!aliveRef.current || epoch !== sessionEpochRef.current) {
        // Torn down or navigated to another session while the create was in
        // flight (New Chat / session-row click mid-mutation) — drop the send
        // silently; the visible screen owns the flow now.
        return;
      }
      if (!createdSession) {
        toast.error(t("errors.title"), {
          description: t("errors.sessionCreateFailed"),
        });
        return;
      }
      sessionToUse = createdSession;
    }

    // approvedTools is read from localStorage at send time (stable key).
    const approvedTools = readApprovedToolsRaw(sessionToUse.id);

    suggestionAbortRef.current?.abort();
    setSuggestions([]);
    sendMessage(
      {
        text,
        files: files || [],
      },
      {
        body: {
          disabledTools: disabledTools,
          approvedTools: approvedTools,
        },
      },
    );
    setFiles(null);
    setFileItems(null);
  };

  // item 47: question_ask answers are dispatched as "[answer:…]" with no files.
  const sendQuestionAnswer = (answerText: string): void => {
    const approvedTools = readApprovedToolsRaw(currentSessionRef.current?.id);
    suggestionAbortRef.current?.abort();
    setSuggestions([]);
    sendMessage(
      { text: "[answer:" + answerText + "]", files: [] },
      { body: { disabledTools: disabledToolsRef.current, approvedTools } },
    );
  };

  // --- compaction (spec §4/§5) ------------------------------------------------
  const compactConversation = async (steer?: string): Promise<boolean> => {
    const session = currentSessionRef.current;
    if (!session || session.id === "new") return false;
    if (status === "streaming" || status === "submitted" || compacting) return false;
    setCompacting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No valid session token available.");
      const compactPath = (agent.slug ?? "").replace(/\/run$/, "/compact");
      const res = await fetch(`${configContext?.backend}${compactPath}/${agent.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          User: user.id,
          Session: session.id,
          Authorization: `Bearer ${token}`,
          ...(modelOverrideRef.current && modelOverrideRef.current !== agent.model
            ? { "X-Exulu-Model-Override": modelOverrideRef.current }
            : {}),
        },
        body: JSON.stringify({ steer: steer?.trim() || undefined }),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        if (bodyText.includes(COMPACTION_INSUFFICIENT)) {
          setError(t("context.insufficientError"));
        } else {
          let message = bodyText;
          try {
            message = JSON.parse(bodyText).message ?? bodyText;
          } catch {
            // plain-text error body
          }
          setError(message || t("errors.unexpected"));
        }
        return false;
      }
      const data = JSON.parse(bodyText) as { checkpoint: UIMessage };
      // Appending the checkpoint makes it the newest occupancy anchor — the
      // meter drops immediately; the divider renders from metadata.compaction.
      setMessages((prev) => [...prev, data.checkpoint]);
      setServerContextBlocked(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unexpected"));
      return false;
    } finally {
      setCompacting(false);
    }
  };

  // --- follow-up suggestions (item 63) — verbatim from the monolith ------------
  React.useEffect(() => {
    if (!agent.suggestions_enabled) return;
    if (status === "streaming" || status === "submitted") return;
    if (!messages || messages.length === 0) return;
    const lastAssistant = messages[messages.length - 1];
    if (!lastAssistant || lastAssistant.role !== "assistant") return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    suggestionAbortRef.current?.abort();
    const ctrl = new AbortController();
    suggestionAbortRef.current = ctrl;

    (async () => {
      try {
        // Follow-up suggestions are a REST call, so the demo's GraphQL
        // fixtures never covered it. Left alone it fires at the backend the
        // demo does not run and fails with ERR_CONNECTION_REFUSED, leaving the
        // suggestion row unresolved directly above the composer.
        if (isDemoMode()) return;

        const token = await getToken();
        if (!token) return;

        const res = await fetch(
          `${configContext?.backend}/agents/suggestions/${agent.id}`,
          {
            method: "POST",
            signal: ctrl.signal,
            headers: {
              "Content-Type": "application/json",
              User: user.id,
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              messages: [lastUser, lastAssistant],
            }),
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        const arr = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(arr.slice(0, 3).map(String));
      } catch {
        // Aborted or network error — silently drop. Suggestions are non-essential.
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    messages.length,
    agent.suggestions_enabled,
    agent.id,
    configContext?.backend,
    user.id,
  ]);

  // --- tool pre-approvals (item 50) — mirror of the stable localStorage key ----
  const [preApprovedTools, setPreApprovedTools] = React.useState<string[]>([]);
  React.useEffect(() => {
    setPreApprovedTools(readPreApprovedList(currentSession?.id));
  }, [currentSession?.id]);

  const approveToolForChat = React.useCallback((toolId: string) => {
    const id = currentSessionRef.current?.id;
    if (!id) return;
    try {
      const list = readPreApprovedList(id);
      if (!list.includes(toolId)) list.push(toolId);
      window.localStorage.setItem(
        `pre-approved-tool-calls-${id}`,
        JSON.stringify(list),
      );
      setPreApprovedTools(list);
    } catch {
      // localStorage unavailable — approval simply won't persist.
    }
  }, []);

  const revokePreApprovedTool = React.useCallback((toolId: string) => {
    const id = currentSessionRef.current?.id;
    if (!id) return;
    try {
      const list = readPreApprovedList(id).filter((x) => x !== toolId);
      window.localStorage.setItem(
        `pre-approved-tool-calls-${id}`,
        JSON.stringify(list),
      );
      setPreApprovedTools(list);
    } catch {
      // localStorage unavailable.
    }
  }, []);

  // --- pinned knowledge scope mutations (items 66/67) ----------------------------
  const addSessionItems = async (gids: string[]): Promise<void> => {
    const session = await ensureSession();
    if (!session) {
      toast.error(t("errors.title"), {
        description: t("errors.sessionCreateFailed"),
      });
      return;
    }
    const existing = new Set(sessionItems || []);
    const fresh = gids.filter((gid) => !existing.has(gid));
    if (fresh.length === 0) return;
    const update = [...(sessionItems || []), ...fresh];
    updateAgentSessionItems({
      variables: { id: session.id, session_items: update },
    });
    setSessionItems(update);
  };

  const removeSessionItem = async (gid: string): Promise<void> => {
    const session = await ensureSession();
    if (!session) {
      toast.error(t("errors.title"), {
        description: t("errors.sessionCreateFailed"),
      });
      return;
    }
    const update = (sessionItems || []).filter((i) => i !== gid);
    updateAgentSessionItems({
      variables: { id: session.id, session_items: update },
    });
    setSessionItems(update);
  };

  const replaceSessionItems = async (gids: string[]): Promise<void> => {
    const session = await ensureSession();
    if (!session) {
      toast.error(t("errors.title"), {
        description: t("errors.sessionCreateFailed"),
      });
      return;
    }
    const update = [...new Set(gids)];
    updateAgentSessionItems({
      variables: { id: session.id, session_items: update },
    });
    setSessionItems(update);
  };

  // --- next-message attachments (items 74/75) -------------------------------------
  const addFileItem = React.useCallback((s3Key: string) => {
    setFileItems((prev) => [...(prev || []), s3Key]);
  }, []);
  const removeFileItem = React.useCallback((s3Key: string) => {
    setFileItems((prev) => {
      const next = (prev || []).filter((i) => i !== s3Key);
      return next.length > 0 ? next : null;
    });
  }, []);

  // s3 keys → presigned FileUIParts (data-URL fallback for s3-less items),
  // verbatim from the monolith's updateMessageFiles.
  React.useEffect(() => {
    if (!fileItems) {
      setFiles(null);
      return;
    }
    const items: Item[] = fileItems.map(
      (item) =>
        ({
          s3key: item,
          name: item,
          type: "file",
        }) as unknown as Item,
    );
    (async () => {
      const nextFiles = await Promise.all(
        items.map(async (item) => {
          if (!item.s3key) {
            // Take all item fields and turn into a data url
            let content = "";
            Object.entries(item).forEach(([key, value]) => {
              content += `${key}: ${value}\n`;
            });
            return {
              type: "file" as const,
              mediaType: item.type,
              filename: item.name,
              url: `data:text/plain;base64,${btoa(content)}`,
            };
          }
          return {
            type: "file" as const,
            mediaType: item.type,
            filename: item.name,
            url: await getPresignedUrl(item.s3key),
          };
        }),
      );
      setFiles(nextFiles);
    })();
  }, [fileItems]);

  // --- session files panel (items 64/79) -------------------------------------------
  const [filesPanelOpen, setFilesPanelOpenState] = React.useState(false);
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("chat.sessionFilesPanel.open");
      if (stored === "true") setFilesPanelOpenState(true);
    } catch {
      // localStorage can throw in private browsing / SSR; default-closed is fine.
    }
  }, []);

  const setFilesPanelOpen = async (open: boolean): Promise<void> => {
    if (open) {
      const session = await ensureSession();
      if (!session) {
        toast.error(t("errors.title"), {
          description: t("errors.sessionCreateFailed"),
        });
        return;
      }
    }
    setFilesPanelOpenState(open);
    try {
      window.localStorage.setItem("chat.sessionFilesPanel.open", String(open));
    } catch {
      // Persistence is best-effort.
    }
  };

  // --- session files count (header chip, chat.md row 64) ----------------------------
  const [sessionFilesCount, setSessionFilesCount] = React.useState<number | null>(
    null,
  );
  const refreshFilesCount = React.useCallback(async (sessionId: string) => {
    try {
      const res = await sessionFilesApi.list(sessionId);
      setSessionFilesCount(res.files?.length ?? 0);
    } catch {
      // Count is decorative — never block chat on it.
    }
  }, []);

  React.useEffect(() => {
    const id = currentSession?.id;
    if (!id || id === "new") {
      setSessionFilesCount(null);
      return;
    }
    refreshFilesCount(id);
  }, [currentSession?.id, refreshFilesCount]);

  // Refresh after each completed turn (streaming → ready).
  const prevStatusRef = React.useRef<ChatStatus>(status as ChatStatus);
  React.useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status as ChatStatus;
    const id = currentSessionRef.current?.id;
    if (prev === "streaming" && status === "ready" && id && id !== "new") {
      refreshFilesCount(id);
    }
  }, [status, refreshFilesCount]);

  return {
    agent,
    session: currentSession,
    writeAccess,
    creatorEmail,
    messages,
    status: status as ChatStatus,
    sendUserMessage,
    sendQuestionAnswer,
    stop: () => {
      stop();
    },
    regenerate: () => {
      regenerate();
    },
    setMessages,
    addToolApprovalResponse,
    ensureSession,
    error,
    errorRaw,
    clearError,
    tokenCounts,
    maxInputLength,
    modelOverride,
    setModelOverride,
    disabledTools,
    toggleTool,
    enableAll,
    disableAll,
    preApprovedTools,
    approveToolForChat,
    revokePreApprovedTool,
    sessionItems,
    addSessionItems,
    removeSessionItem,
    replaceSessionItems,
    fileItems,
    addFileItem,
    removeFileItem,
    suggestions,
    filesPanelOpen,
    setFilesPanelOpen,
    sessionFilesCount,
    budgetExceeded,
    managedContextEnabled,
    contextWindow,
    contextOccupancy,
    contextState,
    compacting,
    compactConversation,
  };
}

// ---------------------------------------------------------------------------
// useChatSessions — the list (history rail + /chat/[agent]/search)
// ---------------------------------------------------------------------------

export interface UseChatSessionsArgs {
  agentId: string;
  /** Title-contains filter, applied when length ≥ 3 (legacy behavior). */
  search?: string;
  limit?: number;
}

export interface UseChatSessionsResult {
  /** The list query populates `.agent` as an object — cast at use site. */
  sessions: AgentSession[];
  itemCount: number;
  loading: boolean;
  /** Skeleton gate — true only until the first network response
   *  (returnPartialData semantics kept from the legacy sidebar). */
  initialLoading: boolean;
  refetch: () => void;
}

export function useChatSessions({
  agentId,
  search,
  limit = 20,
}: UseChatSessionsArgs): UseChatSessionsResult {
  const [initialLoadDone, setInitialLoadDone] = React.useState(false);

  const sessionsQuery = useQuery(GET_AGENT_SESSIONS, {
    returnPartialData: true,
    fetchPolicy: "network-only",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit,
      filters: {
        agent: {
          eq: agentId,
        },
        // Exclude routine/workflow run sessions from chat history. Knex
        // compiles { eq: null } to WHERE run IS NULL (see backend
        // convert-graphql-filter-operator-to-pg-query). New run sessions carry
        // a non-null run; pre-existing ones (no backfill) still have run = null
        // and are not excluded.
        run: {
          eq: null,
        },
        ...(search && search.length >= 3
          ? {
              title: {
                contains: search,
              },
            }
          : {}),
      },
    },
    onCompleted: () => {
      setInitialLoadDone(true);
    },
  });

  const sessions: AgentSession[] =
    sessionsQuery?.data?.agent_sessionsPagination?.items ||
    sessionsQuery?.previousData?.agent_sessionsPagination?.items ||
    [];
  const itemCount: number =
    sessionsQuery?.data?.agent_sessionsPagination?.pageInfo?.itemCount ??
    sessionsQuery?.previousData?.agent_sessionsPagination?.pageInfo?.itemCount ??
    0;

  return {
    sessions,
    itemCount,
    loading: sessionsQuery.loading,
    initialLoading: !initialLoadDone && sessionsQuery.loading,
    refetch: () => {
      sessionsQuery.refetch();
    },
  };
}

// ---------------------------------------------------------------------------
// useSessionMutations — named create (item 18) / rename (14) / delete (15/23)
// ---------------------------------------------------------------------------

export interface UseSessionMutationsResult {
  /** Item 18 — named session creation (type "FLOW", as dormant mode today). */
  createNamedSession: (title: string) => Promise<AgentSession | null>;
  renameSession: (id: string, title: string) => Promise<boolean>;
  deleteSession: (id: string) => Promise<boolean>;
  deleteSessions: (ids: string[]) => Promise<{ deleted: number; failed: number }>;
  creating: boolean;
  renaming: boolean;
  deleting: boolean;
}

export function useSessionMutations(agentId: string): UseSessionMutationsResult {
  const { user } = React.useContext(UserContext);

  const [createAgentSession, createResult] = useMutation(CREATE_AGENT_SESSION, {
    refetchQueries: [GET_AGENT_SESSIONS, "GetAgentSessions"],
  });
  const [updateSessionTitle, renameResult] = useMutation(
    UPDATE_AGENT_SESSION_TITLE,
    {
      refetchQueries: [GET_AGENT_SESSIONS, "GetAgentSessions"],
    },
  );
  const [removeSession, removeResult] = useMutation(REMOVE_AGENT_SESSION_BY_ID, {
    refetchQueries: [GET_AGENT_SESSIONS, "GetAgentSessions"],
  });

  const createNamedSession = async (
    title: string,
  ): Promise<AgentSession | null> => {
    if (!title.trim()) return null;
    try {
      // Variable set kept verbatim from the legacy dialog (incl. the dormant
      // `type: "FLOW"` / timestamps the operation does not declare).
      const result = await createAgentSession({
        variables: {
          user: user.id,
          agent: agentId,
          type: "FLOW",
          title: title.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      if (result.errors || !result.data?.agent_sessionsCreateOne?.item?.id) {
        return null;
      }
      return result.data.agent_sessionsCreateOne.item as AgentSession;
    } catch {
      return null;
    }
  };

  const renameSession = async (id: string, title: string): Promise<boolean> => {
    if (!title.trim()) return false;
    try {
      const result = await updateSessionTitle({
        variables: { id, title: title.trim() },
      });
      return !result.errors;
    } catch {
      return false;
    }
  };

  const deleteSession = async (id: string): Promise<boolean> => {
    try {
      const result = await removeSession({ variables: { id } });
      return !result.errors;
    } catch {
      return false;
    }
  };

  const deleteSessions = async (
    ids: string[],
  ): Promise<{ deleted: number; failed: number }> => {
    const settled = await Promise.allSettled(
      ids.map((id) => removeSession({ variables: { id } })),
    );
    let deleted = 0;
    let failed = 0;
    for (const result of settled) {
      if (result.status === "fulfilled" && !result.value.errors) deleted += 1;
      else failed += 1;
    }
    return { deleted, failed };
  };

  return {
    createNamedSession,
    renameSession,
    deleteSession,
    deleteSessions,
    creating: createResult.loading,
    renaming: renameResult.loading,
    deleting: removeResult.loading,
  };
}

// ---------------------------------------------------------------------------
// useAvailableModels — LiteLLM catalog vs Models table (item 26)
// ---------------------------------------------------------------------------

export interface ChatModelOption {
  id: string;
  name: string;
  type: string | null;
  provider: string;
  active: boolean;
  brand?: string | null;
  region?: string | null;
}

/** LiteLLM catalog as the single source of model options; speech models filtered out. */
export function useAvailableModels(): {
  models: ChatModelOption[];
  loading: boolean;
} {
  const litellmCatalogQuery = useQuery(GET_LITELLM_CATALOG, {
    fetchPolicy: "cache-and-network",
  });

  const models: ChatModelOption[] = (
    litellmCatalogQuery.data?.litellmCatalog ?? []
  )
    .map((m: any) => ({
      id: m.model_name,
      name: m.model_name,
      type: m.type ?? null,
      provider: m.upstream_model ?? "",
      active: true,
      brand: m.brand ?? null,
      region: m.region ?? null,
    }))
    .filter(
      (m: ChatModelOption) =>
        m.type !== "speech_to_text" && m.type !== "text_to_speech",
    );

  return {
    models,
    loading: litellmCatalogQuery.loading,
  };
}
