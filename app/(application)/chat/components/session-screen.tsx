"use client";

/**
 * SessionScreen — the session-screen composition (work item 2.3, owner:
 * orchestration; design/pages/chat.md "The Quiet Column").
 *
 * Instantiates useChatSession EXACTLY ONCE and passes the controller down by
 * prop — the single-instance rule. Composition, top to bottom:
 *
 *   ChatHeader (owner: header)
 *   MessageColumn (owner: messages — owns the conversation scroll, flex-1)
 *   inline error alert (item 37; raw detail behind a "Details" disclosure = L4)
 *   Composer (owner: composer — incl. the read-only bar swap, items 36/78)
 *   SidePanel primitive hosting SessionFilesContent (item 79: resizable ≥lg,
 *   Sheet below — owner of the content: messages)
 *
 * Every in-column surface uses CHAT_COLUMN; the Composer owns the safe-area
 * bottom padding on its own root (responsive.md V3) — it is applied exactly
 * once, never re-wrapped here.
 */

import { TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { UIMessage } from "ai";

import { SidePanel } from "@/components/primitives/side-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

import { useChatSession } from "../hooks";
import { CHAT_COLUMN } from "./chat-shell";
import { ChatHeader } from "./chat-header";
import { RunSessionBanner } from "./run-session-banner";
import { Composer } from "./composer";
import { MessageColumn } from "./message-column";
import { SessionFilesContent } from "./session-files/panel-content";

export interface SessionScreenProps {
  agent: Agent;
  initialSession: AgentSession | null; // null on /new
  initialMessages: UIMessage[];
}

export function SessionScreen({
  agent,
  initialSession,
  initialMessages,
}: SessionScreenProps) {
  const t = useTranslations("chat");
  const controller = useChatSession({ agent, initialSession, initialMessages });

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* The quiet column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader controller={controller} />

        {/* Run-linked sessions get a slim banner (design §7.4) — renders
            null unless the session carries Plan-1 run metadata. */}
        {initialSession ? <RunSessionBanner session={initialSession} /> : null}

        {/* Conversation — MessageColumn owns the scroll container (V2). */}
        <MessageColumn controller={controller} />

        {/* Item 37 — inline error alert, in-column at the shared width; raw
            error detail one level deeper behind a Details disclosure (L4). */}
        {controller.error && (
          <div className={`${CHAT_COLUMN} shrink-0 pb-2`}>
            <Alert variant="destructive" className="relative">
              <TriangleAlert className="size-4" aria-hidden="true" />
              <AlertTitle>{t("errors.title")}</AlertTitle>
              <AlertDescription>{controller.error}</AlertDescription>
              {controller.errorRaw &&
                controller.errorRaw !== controller.error && (
                  <AlertDescription>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs underline underline-offset-2">
                        {t("errors.details")}
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                        {controller.errorRaw}
                      </pre>
                    </details>
                  </AlertDescription>
                )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 size-11 md:size-8"
                aria-label={t("errors.dismiss")}
                onClick={controller.clearError}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </Alert>
          </div>
        )}

        {/* Composer region — bottom chrome. The Composer pads its own root
            with the safe-area inset (V3) in BOTH its read-only-bar and
            editable modes, so this wrapper must not add it again (devices
            with a non-zero bottom inset would get it twice). */}
        <div className="shrink-0">
          <Composer controller={controller} />
        </div>
      </div>

      {/* Item 79 — session files: resizable docked panel ≥lg, Sheet below.
          Open state lives in the controller (persisted; auto-creates the
          session on first open), so the panel only ever opens with a session. */}
      <SidePanel
        open={controller.filesPanelOpen && !!controller.session}
        onOpenChange={(open) => {
          void controller.setFilesPanelOpen(open);
        }}
        title={t("files.title")}
        resizable
        storageKey="chat-files"
        mobileSize="full"
      >
        {controller.session && (
          <SessionFilesContent sessionId={controller.session.id} />
        )}
      </SidePanel>
    </div>
  );
}
