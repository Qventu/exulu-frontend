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

export interface UsePublicChatSessionArgs {
  /** Minimal Agent cast from PublicAgentMeta — see PublicChatScreen. */
  agent: Agent;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
}

export interface UsePublicChatSessionResult {
  controller: ChatSessionController;
  clearConversation: () => void;
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
      prepareSendMessagesRequest: async ({ messages, body }) => ({
        // Anonymous: no server session — send the FULL history so the model
        // has context (the backend uses body.messages when no session header
        // is present).
        body: { ...body, messages },
        headers: { Stream: "true" },
      }),
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
    clearTranscript(agent.id);
  }, [agent.id, chat]);

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

  return { controller, clearConversation };
}
