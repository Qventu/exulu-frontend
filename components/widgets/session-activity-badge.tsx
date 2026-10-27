"use client";

/**
 * The one-glance state of a conversation in a chat list: an answer being
 * written, or an answer waiting to be read. Renders nothing when there is
 * nothing to say, so a quiet list stays quiet.
 *
 * Spelled out in words rather than left as a bare icon — a 12px grey glyph
 * was not readable at a glance, which is the whole job — and carried in the
 * `info` colour so it reads as live rather than as more muted metadata. The
 * two states still differ in SHAPE (a spinner versus a dot), so they stay
 * distinguishable without colour vision.
 *
 * The icon is aria-hidden: the visible text is the accessible name, and a
 * second name on the icon would read the state out twice.
 */

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";
import {
  visibleSessionActivity,
  type SessionActivityFields,
} from "@/lib/session-activity";

export interface SessionActivityBadgeProps {
  session: SessionActivityFields;
  className?: string;
  /** Injectable clock — the list re-renders on a poll, tests pass a fixed now. */
  now?: number;
  /**
   * The viewer has this conversation open right now. Such a row is read by
   * definition, so it never shows the unread marker — without this the dot
   * flashes onto the row you are reading for the moment between the answer
   * landing and the seen marker catching up. "Answering" still shows.
   */
  isOpen?: boolean;
}

/** Shared by both states so they line up wherever they sit. */
const ROW = "inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-info";

export function SessionActivityBadge({
  session,
  className,
  now,
  isOpen = false,
}: SessionActivityBadgeProps) {
  const t = useTranslations("chat");
  const activity = visibleSessionActivity(session, { now, isOpen });

  if (activity === "working") {
    return (
      <span className={cn(ROW, className)}>
        <Loader2
          aria-hidden="true"
          className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
        />
        <span className="truncate">{t("history.working")}</span>
      </span>
    );
  }

  if (activity === "unread") {
    return (
      <span className={cn(ROW, className)}>
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-info" />
        <span className="truncate">{t("history.unreadAnswer")}</span>
      </span>
    );
  }

  return null;
}
