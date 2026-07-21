"use client";

/**
 * PublicChatScreen — the guest chat frame (public-agents spec §5).
 *
 * Reuses the authenticated MessageColumn + Composer verbatim by handing them a
 * fully-implemented ChatSessionController (usePublicChatSession). Those
 * components read `user` off UserContext, whose module default is `null` and
 * whose Provider only exists inside the authenticated shell — so this screen
 * supplies a minimal `{ user: null }` Provider. Both components null-guard the
 * value (`user ? ... : false`, `user && ...`), so a null user is safe; the only
 * `user.id` reads sit behind flag-gated surfaces (transcription) that stay off
 * on public pages. ConfigContext + LanguageProvider come from the public layout.
 *
 * Mode split (Task 11):
 * - anonymous: transport posts the full history to the same-origin proxy;
 *   a standalone h-dvh column, no history rail.
 * - authenticated: an inner body instantiates the server-session manager
 *   (Apollo hook) and mounts the SHARED internal HistoryRail via
 *   PublicChatShell (docked ≥lg, Sheet below), sessions are URL-driven via
 *   ?session=<sid>, and the transport switches to last-message + Session
 *   header with lazy server sessions.
 *
 * BOTH modes are wrapped in PublicApolloProvider. The reused authenticated
 * Composer/MessageColumn call Apollo hooks UNCONDITIONALLY on mount —
 * Composer → useIncrementPromptUsage() + useMutation(UPDATE_CONTEXT_PRESET),
 * and its always-mounted PromptSelectorModal → usePrompts() (useQuery, no
 * skip); MessageColumn → FeedbackDialog → useMutation(CREATE_FEEDBACK).
 * useApolloClient throws without a provider, so an anonymous guest crashed on
 * first render. Wrapping anonymous mode too fixes that: getToken() resolves
 * null for a guest (no next-auth session), so the client simply carries no
 * auth header. Nothing fires a mutation on mount, and the one query that DOES
 * fire on mount (usePrompts) degrades quietly — the client's defaultOptions
 * set errorPolicy "all", so a guest 401 returns `{ data: undefined }` instead
 * of throwing, and the modal reads `data?...items || []`.
 */

import type { UIMessage } from "ai";
import { LogOut, PanelLeft } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { useChatShell } from "@/app/(application)/chat/components/chat-shell";
import { Composer } from "@/app/(application)/chat/components/composer";
import { MessageColumn } from "@/app/(application)/chat/components/message-column";
import { Button } from "@/components/ui/button";
import type { PublicAgentMeta } from "@/lib/api/public-agents";
import type { AgentSession } from "@/types/models/agent-session";
import type { Agent } from "@/types/models/agent";

import { PublicApolloProvider } from "./public-apollo-provider";
import { PublicChatShell } from "./public-chat-shell";
import { usePublicChatSession } from "./use-public-chat-session";
import {
  usePublicSessionManager,
  type PublicSessionManager,
} from "./use-public-session-manager";

/** Minimal Agent cast: only fields the chat components actually read. */
function toAgent(meta: PublicAgentMeta): Agent {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    image: meta.image ?? undefined,
    welcomemessage: meta.welcomemessage,
    slug: meta.slug,
  } as unknown as Agent;
}

/** Mobile-only history trigger (opens the rail's Sheet). Authenticated only —
 *  it reads useChatShell(), which only exists inside PublicChatShell. */
function MobileHistoryTrigger() {
  const t = useTranslations("publicAgents.chat");
  const { setHistorySheetOpen } = useChatShell();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden"
      onClick={() => setHistorySheetOpen(true)}
      aria-label={t("history")}
    >
      <PanelLeft className="size-4" aria-hidden="true" />
    </Button>
  );
}

/**
 * The shared chat body. `sessionManager` is present only in authenticated mode
 * (it wraps Apollo hooks) — its presence turns on the server-session transport,
 * the Clear/Sign-out chrome, and the mobile history trigger. In authenticated
 * mode the body is a flex-1 column beside the docked HistoryRail (the rail is
 * mounted by PublicChatShell); anonymous mode keeps the railless h-dvh layout.
 */
function PublicChatBody({
  meta,
  agent,
  mode,
  userId,
  sessionManager,
  initialMessages,
}: {
  meta: PublicAgentMeta;
  agent: Agent;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
  sessionManager?: PublicSessionManager;
  initialMessages?: UIMessage[];
}) {
  const t = useTranslations("publicAgents.chat");
  const { controller, clearConversation } = usePublicChatSession({
    agent,
    mode,
    userId,
    sessionManager,
    initialMessages,
  });

  const authenticated = mode === "authenticated";

  return (
    <>
      {/* Authenticated: flex-1 column beside the docked rail (PublicChatShell
          owns the h-dvh host). Anonymous: standalone h-dvh column, no rail.
          NOTE: the UserContext.Provider lives ABOVE this component (screen
          root) — the HistoryRail is a SIBLING mounted by PublicChatShell and
          its useSessionMutations destructures the context value, so the
          provider must wrap the shell, not just this body. */}
      <div
        className={
          authenticated
            ? "flex min-h-0 min-w-0 flex-1 flex-col"
            : "flex h-dvh min-h-0 flex-col"
        }
      >
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
          {authenticated ? <MobileHistoryTrigger /> : null}
          {agent.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agent.image}
              alt=""
              className="size-7 rounded-full object-cover"
            />
          ) : null}
          <p className="min-w-0 truncate text-sm font-medium">{agent.name}</p>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              aria-label={t("clear")}
            >
              <span>{t("clear")}</span>
            </Button>
            {authenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  signOut({ callbackUrl: `/public/agents/${meta.id}` })
                }
                aria-label={t("signOut")}
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("signOut")}</span>
              </Button>
            )}
          </div>
        </header>

        {/* Mirror session-screen.tsx: MessageColumn owns the conversation
            scroll (flex-1), the Composer is bottom chrome in a shrink-0 wrap. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MessageColumn controller={controller} />
          <div className="shrink-0">
            {/* guestMode: no ＋ menu (prompts/knowledge/capabilities are
                internal-platform surfaces) in ANY public mode. */}
            <Composer controller={controller} guestMode />
          </div>
        </div>
      </div>
    </>
  );
}

/** Authenticated body — instantiates the Apollo-backed session manager and the
 *  shared HistoryRail (via PublicChatShell). Only rendered inside
 *  PublicApolloProvider (usePublicSessionManager uses Apollo). */
function AuthenticatedChatBody({
  meta,
  agent,
  userId,
  initialSession,
  initialMessages,
}: {
  meta: PublicAgentMeta;
  agent: Agent;
  userId?: string | number;
  initialSession: AgentSession | null;
  initialMessages: UIMessage[];
}) {
  const basePath = `/public/agents/${meta.id}`;
  const sessionManager = usePublicSessionManager({
    agentId: agent.id,
    userId,
    initialSession: initialSession ? { id: initialSession.id } : null,
    basePath,
  });

  // The provider must sit ABOVE PublicChatShell: the HistoryRail it mounts
  // reaches useSessionMutations, which destructures the context value —
  // a null default crashes SSR. Minimal { id } is null-safe for every
  // guarded access (see the integration report's UserContext audit).
  const userValue = React.useMemo(() => ({ user: { id: userId } }), [userId]);

  return (
    <UserContext.Provider value={userValue}>
      <PublicChatShell
        agent={agent}
        basePath={basePath}
        activeSessionId={sessionManager.currentSession?.id}
      >
        <PublicChatBody
          meta={meta}
          agent={agent}
          mode="authenticated"
          userId={userId}
          sessionManager={sessionManager}
          initialMessages={initialMessages}
        />
      </PublicChatShell>
    </UserContext.Provider>
  );
}

export function PublicChatScreen({
  meta,
  mode,
  userId,
  initialSession = null,
  initialMessages = [],
}: {
  meta: PublicAgentMeta;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
  /** Authenticated only: server-loaded session from ?session=<sid>. */
  initialSession?: AgentSession | null;
  /** Authenticated only: server-loaded messages for that session. */
  initialMessages?: UIMessage[];
}) {
  const agent = React.useMemo(() => toAgent(meta), [meta]);

  // BOTH modes are wrapped in PublicApolloProvider + SessionProvider: the
  // reused Composer/MessageColumn call Apollo hooks on mount even for guests
  // (see the file header), so a missing provider crashed anonymous chat. For
  // anonymous mode getToken() resolves null (no session) — the client just
  // carries no auth header; guests' GraphQL calls would 401 server-side, which
  // is fine because nothing fires on mount except a query that degrades under
  // errorPolicy "all".
  return (
    <PublicApolloProvider>
      {mode === "authenticated" ? (
        <AuthenticatedChatBody
          meta={meta}
          agent={agent}
          userId={userId}
          initialSession={initialSession}
          initialMessages={initialMessages}
        />
      ) : (
        // Anonymous: a null user resolves Composer/MessageColumn's
        // `user ?`/`user &&` guards to unauthenticated behavior.
        <UserContext.Provider value={ANON_USER_VALUE}>
          <PublicChatBody meta={meta} agent={agent} mode="anonymous" />
        </UserContext.Provider>
      )}
    </PublicApolloProvider>
  );
}

/** Stable anonymous context value — never re-created across renders. */
const ANON_USER_VALUE = { user: null };
