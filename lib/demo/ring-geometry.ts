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
