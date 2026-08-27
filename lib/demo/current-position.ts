import { TECHDOC_TURNS } from "./fixtures/chapter-techdoc";
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
    case "techdoc":
    default:
      return TECHDOC_TURNS;
  }
}
