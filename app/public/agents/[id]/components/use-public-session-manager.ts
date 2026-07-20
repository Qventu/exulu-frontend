"use client";

/**
 * usePublicSessionManager — server-side session lifecycle for AUTHENTICATED
 * guests (public-agents spec §5, Task 11).
 *
 * This hook calls Apollo hooks (useMutation) and therefore MUST only be
 * rendered inside <PublicApolloProvider> — i.e. only in authenticated mode.
 * Anonymous mode never instantiates it (the public layout has no Apollo
 * client, and useMutation throws synchronously without one). The result is
 * passed into usePublicChatSession as `sessionManager`; when absent, the
 * transport falls back to the unchanged anonymous full-history path.
 *
 * Mirrors the authenticated hook's lazy-session pattern (chat/hooks.ts
 * useChatSession → createSession/ensureSession): the mutation variables
 * (rights_mode "private", empty RBAC users/roles) and the ref-before-render
 * sync are copied so the transport can read the session id before React
 * re-renders (the same latent race the internal hook guards against).
 */

import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CREATE_AGENT_SESSION } from "@/app/(application)/chat/queries";

/** The minimal session shape the public transport needs (only the id). */
export interface PublicSession {
  id: string;
}

export interface PublicSessionManager {
  /** Latest session id, readable synchronously by the transport. */
  currentSessionRef: React.MutableRefObject<PublicSession | null>;
  currentSession: PublicSession | null;
  /** Lazily create the server session on first send; idempotent thereafter. */
  ensureSession: () => Promise<PublicSession | null>;
  /** Drop the current session so the next send starts a fresh one. */
  startNewSession: () => void;
  /** Point the manager at an existing session (history resume). */
  setSession: (session: PublicSession) => void;
}

export function usePublicSessionManager({
  agentId,
  userId,
}: {
  agentId: string;
  userId?: string | number;
}): PublicSessionManager {
  const t = useTranslations("publicAgents.chat");

  const [currentSession, setCurrentSession] =
    React.useState<PublicSession | null>(null);
  // Ref kept in sync with state — the transport's prepareSendMessagesRequest
  // may read it before a re-render commits (mirror of currentSessionRef in
  // chat/hooks.ts).
  const currentSessionRef = React.useRef<PublicSession | null>(null);
  React.useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const [createAgentSession] = useMutation(CREATE_AGENT_SESSION);

  const ensureSession =
    React.useCallback<PublicSessionManager["ensureSession"]>(async () => {
      if (currentSessionRef.current) return currentSessionRef.current;
      // $user is Float in the mutation signature — coerce the id to a number
      // (external users may arrive as a string).
      const userNum =
        userId == null ? undefined : Number(userId as string | number);
      const result = await createAgentSession({
        variables: {
          agent: agentId,
          user: Number.isFinite(userNum) ? userNum : undefined,
          title: t("newChat"),
          rights_mode: "private",
          RBAC: { users: [], roles: [] },
        },
      });
      const item = (result.data?.agent_sessionsCreateOne?.item ??
        null) as PublicSession | null;
      if (item) {
        // Sync the ref immediately — the transport may read it before React
        // re-renders (same guard as the internal hook's createSession).
        currentSessionRef.current = item;
        setCurrentSession(item);
      }
      return item;
    }, [agentId, createAgentSession, t, userId]);

  const startNewSession = React.useCallback(() => {
    currentSessionRef.current = null;
    setCurrentSession(null);
  }, []);

  const setSession = React.useCallback((session: PublicSession) => {
    currentSessionRef.current = session;
    setCurrentSession(session);
  }, []);

  return {
    currentSessionRef,
    currentSession,
    ensureSession,
    startNewSession,
    setSession,
  };
}
