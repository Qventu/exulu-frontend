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
 */

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { Composer } from "@/app/(application)/chat/components/composer";
import { MessageColumn } from "@/app/(application)/chat/components/message-column";
import { Button } from "@/components/ui/button";
import type { PublicAgentMeta } from "@/lib/api/public-agents";
import type { Agent } from "@/types/models/agent";

import { usePublicChatSession } from "./use-public-chat-session";

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

export function PublicChatScreen({
  meta,
  mode,
  userId,
}: {
  meta: PublicAgentMeta;
  mode: "anonymous" | "authenticated";
  userId?: string | number;
}) {
  const t = useTranslations("publicAgents.chat");
  const agent = React.useMemo(() => toAgent(meta), [meta]);
  const { controller, clearConversation } = usePublicChatSession({
    agent,
    mode,
    userId,
  });

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
            <Button
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              aria-label={t("clear")}
            >
              <span>{t("clear")}</span>
            </Button>
            {mode === "authenticated" && (
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
            <Composer controller={controller} />
          </div>
        </div>
      </div>
    </UserContext.Provider>
  );
}
