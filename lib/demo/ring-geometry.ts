export interface VerticalBox {
  top: number;
  height: number;
}

/**
 * True when no pixel of the box is inside a viewport of `viewportHeight`.
 *
 * Partial visibility counts as visible: re-scrolling an element the reader
 * can already see would yank the page under them.
 */
export function isOutsideViewport(box: VerticalBox, viewportHeight: number): boolean {
  return box.top >= viewportHeight || box.top + box.height <= 0;
}

export interface RescrollInput {
  /** A measurement has already found the anchor at least partly on screen. */
  wasInView: boolean;
  /** This measurement finds no pixel of the anchor on screen. */
  outsideNow: boolean;
  /** What prompted the measurement. The reader's own scrolling never re-scrolls. */
  cause: "scroll" | "layout";
  alreadyRescrolled: boolean;
}

/**
 * Whether the ring should scroll its anchor back into view.
 *
 * Only on a TRANSITION caused by layout: the anchor was on screen, then
 * content above it grew (the agent editor's sections mount after first
 * paint) and pushed it out. Never because the reader scrolled it away —
 * that would yank a 5,000px page back under someone reading it — and never
 * on the first measurement of an anchor that mounted below the fold, where
 * the smooth scrollIntoView that follows attach has simply not happened yet.
 */
export function shouldRescroll({ wasInView, outsideNow, cause, alreadyRescrolled }: RescrollInput): boolean {
  return cause === "layout" && wasInView && outsideNow && !alreadyRescrolled;
}
