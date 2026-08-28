import type { UIMessage } from "ai";

import { TECHDOC_TURNS } from "./fixtures/chapter-techdoc";
import { MEMORY_SCROLLBACK, MEMORY_TURNS } from "./fixtures/memory-turns";
import type { ScriptedTurn } from "./script";
import type { DemoChapterId, TourPosition } from "./tour";

let current: TourPosition = { chapter: "techdoc", step: 0 };

export function getCurrentPosition(): TourPosition {
  return current;
}

export function setCurrentPosition(pos: TourPosition): void {
  current = pos;
}

/**
 * Chapters without their own script yet fall back to the techdoc turns, so the
 * chat surface always has something to replay — DemoChatTransport throws on an
 * empty script by design.
 */
export function turnsFor(chapter: DemoChapterId): ScriptedTurn[] {
  switch (chapter) {
    case "memory":
      return MEMORY_TURNS;
    case "techdoc":
    default:
      return TECHDOC_TURNS;
  }
}

/**
 * Conversation already on screen when a chapter opens.
 *
 * Chapter 4 needs it: the correction it is about only makes sense after the
 * answer being corrected, and replaying those four exchanges live would mean
 * the visitor sending four messages before reaching the point. As scrollback
 * they read as a conversation picked up mid-flight, which is also how an
 * engineer would actually meet it.
 */
export function scrollbackFor(chapter: DemoChapterId): UIMessage[] {
  return chapter === "memory" ? MEMORY_SCROLLBACK : [];
}
