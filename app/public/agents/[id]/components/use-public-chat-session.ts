"use client";

/**
 * usePublicChatSession — the guest-chat controller (public-agents spec §5).
 *
 * Implements the full ChatSessionController interface (the same one the
 * authenticated session-screen consumes), so MessageColumn/Composer render
 * unchanged. There is no server-side session for anonymous guests: the AI SDK
 * transport posts the FULL message history to the same-origin SSE proxy
 * (app/public/agents/[id]/chat/route.ts), which attaches guest credentials.
 *
 * Almost every controller member beyond the transport passthrough is inert:
 * guest chat has no session, no tool-approval surface, no token accounting,
 * no knowledge scope, no files panel, no budget, and no managed context.
 * Anonymous transcripts persist best-effort to localStorage (spec §5.4).
 */

import { useChat } from "@ai-sdk/react";
import {
  type ChatAddToolApproveResponseFunction,
  DefaultChatTransport,
  type UIMessage,
} from "ai";
import { useTranslations } from "next-intl";
import * as React from "react";

import type {
  ChatSessionController,
  TokenCounts,
} from "@/app/(application)/chat/hooks";
import type { ContextState } from "@/app/(application)/chat/lib/context-budget";
import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
} from "@/lib/public-agents/transcript-store";
import type { Agent } from "@/types/models/agent";

import type { PublicSessionManager } from "./use-public-session-manager";

export interface UsePublicChatSessionArgs {
  /** Minimal Agent cast from PublicAgentMeta — see PublicChatScreen. */
  agent: Agent;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
  /**
   * Server-session lifecycle, present ONLY in authenticated mode (it wraps
   * Apollo hooks that must run inside PublicApolloProvider). When present the
   * transport posts only the last message + a Session header and skips the
   * localStorage transcript; when absent the anonymous full-history path runs
   * unchanged.
   */
  sessionManager?: PublicSessionManager;
}

export interface UsePublicChatSessionResult {
  controller: ChatSessionController;
  clearConversation: () => void;
  /** Authenticated only: start a fresh server session (no-op anonymous). */
  startNewSession: () => void;
  /** Authenticated only: load an existing session's messages into the view. */
  resumeSession: (session: { id: string }, messages: UIMessage[]) => void;
}

const GUEST_MAX_INPUT = 8000; // mirrors EXULU_GUEST_MAX_MESSAGE_CHARS default

const EMPTY_TOKEN_COUNTS: TokenCounts = {
  totalTokens: 0,
  reasoningTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
};

export function usePublicChatSession({
  agent,
  mode,
  sessionManager,
}: UsePublicChatSessionArgs): UsePublicChatSessionResult {
  const t = useTranslations("publicAgents.chat");
  const tRoot = useTranslations("publicAgents");
  const [error, setError] = React.useState<string | null>(null);

  const initialMessages = React.useMemo(
    () => (mode === "anonymous" ? loadTranscript(agent.id) : []),
    [agent.id, mode],
  );

  const chat = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/public/agents/${agent.id}/chat`,
      prepareSendMessagesRequest: async ({ messages, body }) => {
        // Authenticated: lazily create the server session, then post ONLY the
        // last message + a Session header. The proxy (chat/route.ts) forwards
        // that header and attaches Authorization server-side, so no bearer
        // token is sent client-side. The backend loads history from the DB.
        if (mode === "authenticated" && sessionManager) {
          const session = await sessionManager.ensureSession();
          if (!session) {
            throw new Error("No session available.");
          }
          return {
            body: {
              ...body,
              message: messages[messages.length - 1],
              session: session.id,
            },
            headers: { Stream: "true", Session: session.id } as Record<
              string,
              string
            >,
          };
        }
        // Anonymous: no server session — send the FULL history so the model
        // has context (the backend uses body.messages when no session header
        // is present).
        return {
          body: { ...body, messages },
          headers: { Stream: "true" } as Record<string, string>,
        };
      },
    }),
    onError: (err) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) setError(t("rateLimited"));
      else if (msg.includes("413")) setError(t("messageTooLong"));
      else if (msg.includes("404") || msg.includes("403"))
        // Agent was unpublished mid-conversation (spec §5.5).
        setError(tRoot("unavailable.title"));
      else setError(t("sendFailed"));
    },
  });

  // Persist anonymous transcripts (best effort).
  React.useEffect(() => {
    if (mode === "anonymous") saveTranscript(agent.id, chat.messages);
  }, [agent.id, chat.messages, mode]);

  const sendUserMessage = React.useCallback(
    async (text: string) => {
      setError(null);
      await chat.sendMessage({ text });
    },
    [chat],
  );

  const sendQuestionAnswer = React.useCallback(
    (answerText: string) => {
      void sendUserMessage(answerText);
    },
    [sendUserMessage],
  );

  const clearError = React.useCallback(() => setError(null), []);

  const clearConversation = React.useCallback(() => {
    chat.setMessages([]);
    // Authenticated: also drop the server session so "Clear" behaves like a
    // fresh start; the next send lazily creates a new one. Anonymous: wipe the
    // persisted transcript.
    if (mode === "authenticated" && sessionManager) {
      sessionManager.startNewSession();
    } else {
      clearTranscript(agent.id);
    }
  }, [agent.id, chat, mode, sessionManager]);

  // Authenticated only: begin a brand-new server session (the "New chat"
  // button). No-op in anonymous mode.
  const startNewSession = React.useCallback(() => {
    if (mode === "authenticated" && sessionManager) {
      sessionManager.startNewSession();
    }
    chat.setMessages([]);
    setError(null);
  }, [chat, mode, sessionManager]);

  // Authenticated only: point the transport at an existing session and load
  // its messages. The session ref is synced BEFORE setMessages so a send that
  // races the render targets the resumed session, not a stale/new one (mirror
  // of the currentSessionRef sync in chat/hooks.ts).
  const resumeSession = React.useCallback(
    (session: { id: string }, messages: UIMessage[]) => {
      if (mode === "authenticated" && sessionManager) {
        sessionManager.setSession(session);
      }
      chat.setMessages(messages);
      setError(null);
    },
    [chat, mode, sessionManager],
  );

  const controller = {
    // identity & access
    agent,
    session: null,
    writeAccess: true,
    creatorEmail: undefined,
    // transport (AI SDK passthrough)
    messages: chat.messages,
    status: chat.status,
    sendUserMessage,
    sendQuestionAnswer,
    stop: () => {
      chat.stop();
    },
    regenerate: () => {
      chat.regenerate();
    },
    setMessages: chat.setMessages,
    // Guest chat has no tool-approval surface; agents published to guests must
    // not rely on approval-gated tools (spec §10 limitation).
    addToolApprovalResponse: (() => {}) as ChatAddToolApproveResponseFunction,
    ensureSession: async () => null,
    error,
    errorRaw: error,
    clearError,
    // token accounting — not surfaced to guests
    tokenCounts: EMPTY_TOKEN_COUNTS,
    maxInputLength: GUEST_MAX_INPUT,
    // per-request model override — guests use the agent's own model
    modelOverride: null,
    setModelOverride: () => {},
    // capability toggles — none
    disabledTools: [],
    toggleTool: () => {},
    enableAll: () => {},
    disableAll: () => {},
    // tool pre-approvals — none
    preApprovedTools: [],
    approveToolForChat: () => {},
    revokePreApprovedTool: () => {},
    // pinned knowledge scope — none
    sessionItems: null,
    addSessionItems: async () => {},
    removeSessionItem: async () => {},
    replaceSessionItems: async () => {},
    // next-message attachments — none
    fileItems: null,
    addFileItem: () => {},
    removeFileItem: () => {},
    // follow-up suggestions — the authenticated hook derives these from a
    // bearer-authenticated REST call (see hooks.ts), so guests get none.
    suggestions: [],
    // session files panel — none
    filesPanelOpen: false,
    setFilesPanelOpen: async () => {},
    sessionFilesCount: null,
    // budget — none
    budgetExceeded: false,
    // managed context — none
    managedContextEnabled: false,
    // context-window management — no window known for guests
    contextWindow: null,
    contextOccupancy: 0,
    contextState: "ok" as ContextState,
    compacting: false,
    compactConversation: async () => false,
  } satisfies ChatSessionController;

  return { controller, clearConversation, startNewSession, resumeSession };
}
