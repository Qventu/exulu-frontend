"use client";

/**
 * Shown in the conversation while a turn runs that this tab is not receiving
 * — the viewer arrived, or came back, mid-answer (ChatSessionController's
 * `catchingUp`).
 *
 * Without it the screen reads as a finished conversation: this page was
 * rendered from stored messages, and nothing of the running turn is in the
 * database yet, so not even the viewer's own question is on screen. On a
 * session whose FIRST turn is still running it was worse — the greeting empty
 * state invited them to start a conversation already under way.
 *
 * The description is not padding: the answer appears COMPLETE when the turn
 * ends rather than streaming in token by token, and a viewer waiting for a
 * stream that will never reach this tab needs telling.
 *
 * role="status" so assistive technology announces it on arrival without
 * stealing focus; the spinner is aria-hidden because the text is the name.
 */

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

export function CatchingUpNotice({ className }: { className?: string }) {
  const t = useTranslations("chat");

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/5 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <Loader2
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 animate-spin text-info motion-reduce:animate-none"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-info">{t("catchingUp.title")}</p>
        <p className="text-muted-foreground">{t("catchingUp.description")}</p>
      </div>
    </div>
  );
}
