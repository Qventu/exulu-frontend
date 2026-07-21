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
 * - anonymous: transport posts the full history to the same-origin proxy.
 * - authenticated: an inner body instantiates the server-session manager
 *   (Apollo hook) and the History dropdown, and the transport switches to
 *   last-message + Session header with lazy server sessions.
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

import { LogOut, Plus } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { Composer } from "@/app/(application)/chat/components/composer";
import { MessageColumn } from "@/app/(application)/chat/components/message-column";
import { Button } from "@/components/ui/button";
import type { PublicAgentMeta } from "@/lib/api/public-agents";
import type { Agent } from "@/types/models/agent";

import { PublicApolloProvider } from "./public-apollo-provider";
import { PublicHistory } from "./public-history";
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

/**
 * The shared chat body. `sessionManager` is present only in authenticated mode
 * (it wraps Apollo hooks) — its presence turns on the server-session transport,
 * the New chat button, and the History dropdown.
 */
function PublicChatBody({
  meta,
  agent,
  mode,
  userId,
  sessionManager,
}: {
  meta: PublicAgentMeta;
  agent: Agent;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
  sessionManager?: PublicSessionManager;
}) {
  const t = useTranslations("publicAgents.chat");
  const { controller, clearConversation, startNewSession, resumeSession } =
    usePublicChatSession({ agent, mode, userId, sessionManager });

  const authenticated = mode === "authenticated";

  return (
    // MessageColumn/Composer destructure `user` off UserContext (default null,
    // no Provider on public pages) — supply a null user so the destructure and
    // their `user ?`/`user &&` guards resolve to unauthenticated behavior.
    <UserContext.Provider value={{ user: null }}>
      <div className="flex h-dvh min-h-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
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
            {authenticated && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startNewSession}
                  aria-label={t("newChat")}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{t("newChat")}</span>
                </Button>
                <PublicHistory agentId={agent.id} onResume={resumeSession} />
              </>
            )}
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
    </UserContext.Provider>
  );
}

/** Authenticated body — instantiates the Apollo-backed session manager. Only
 *  rendered inside PublicApolloProvider (usePublicSessionManager uses Apollo). */
function AuthenticatedChatBody({
  meta,
  agent,
  userId,
}: {
  meta: PublicAgentMeta;
  agent: Agent;
  userId?: string | number;
}) {
  const sessionManager = usePublicSessionManager({ agentId: agent.id, userId });
  return (
    <PublicChatBody
      meta={meta}
      agent={agent}
      mode="authenticated"
      userId={userId}
      sessionManager={sessionManager}
    />
  );
}

export function PublicChatScreen({
  meta,
  mode,
  userId,
}: {
  meta: PublicAgentMeta;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
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
        <AuthenticatedChatBody meta={meta} agent={agent} userId={userId} />
      ) : (
        <PublicChatBody meta={meta} agent={agent} mode="anonymous" />
      )}
    </PublicApolloProvider>
  );
}
