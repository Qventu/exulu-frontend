import type { UIMessage } from "ai";

import { TECHDOC_TURNS } from "./fixtures/chapter-techdoc";
import { TECHDOC_SCROLLBACK } from "./fixtures/techdoc-turns";
import { MEMORY_WRITTEN_AT_STEP } from "./fixtures/chapter-memory";
import {
  MEMORY_CORRECTION_EXCHANGE,
  MEMORY_SCROLLBACK,
  MEMORY_TURNS,
} from "./fixtures/memory-turns";
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
export function scrollbackFor(
  chapter: DemoChapterId,
  step = 0,
): UIMessage[] {
  if (chapter === "techdoc") return TECHDOC_SCROLLBACK;
  if (chapter !== "memory") return [];

  // Chapter 4's correction is the visitor's to send, and the transport replays
  // it when they do. But step 3 anchors to the memory tool call, and a visitor
  // who just clicks Next never sent anything — so from that step on, the
  // exchange is on screen whether they typed it or not.
  //
  // Same threshold as the knowledge item in fixtures/chapter-memory.ts: the
  // correction must not appear before the step that is about making it.
  return step >= MEMORY_WRITTEN_AT_STEP
    ? [...MEMORY_SCROLLBACK, ...MEMORY_CORRECTION_EXCHANGE]
    : MEMORY_SCROLLBACK;
}
