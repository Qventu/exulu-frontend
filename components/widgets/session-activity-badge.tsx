"use client";

/**
 * The one-glance state of a conversation in a chat list: an answer being
 * written, or an answer waiting to be read. Renders nothing when there is
 * nothing to say, so a quiet list stays quiet.
 *
 * The two states differ in SHAPE as well as colour — a spinner for in
 * progress, a dot for waiting — so they stay distinguishable without colour
 * vision. Both carry an aria-label rather than visible text: the row's title
 * is the content, and this is a margin note on it.
 */

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

import { sessionActivity, type SessionActivityFields } from "@/lib/session-activity";

export interface SessionActivityBadgeProps {
  session: SessionActivityFields;
  className?: string;
  /** Injectable clock — the list re-renders on a poll, tests pass a fixed now. */
  now?: number;
}

export function SessionActivityBadge({
  session,
  className,
  now,
}: SessionActivityBadgeProps) {
  const t = useTranslations("chat");
  const activity = sessionActivity(session, now);

  if (activity === "working") {
    return (
      <Loader2
        role="img"
        aria-label={t("history.working")}
        className={cn(
          "size-3 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none",
          className,
        )}
      />
    );
  }

  if (activity === "unread") {
    return (
      <span
        role="img"
        aria-label={t("history.unreadAnswer")}
        className={cn("size-2 shrink-0 rounded-full bg-info", className)}
      />
    );
  }

  return null;
}
