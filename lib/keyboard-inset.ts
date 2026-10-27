/**
 * How much of the layout viewport the on-screen keyboard covers.
 *
 * iOS Safari does NOT shrink the layout viewport when the software keyboard
 * opens: `window.innerHeight`, and with it `100dvh`, keeps the full screen
 * height while only the VISUAL viewport shrinks. A chat column sized `h-dvh`
 * therefore keeps its composer at the bottom of a box that is partly behind
 * the keyboard, which is exactly how the composer disappeared under the
 * keyboard on iPhone. The difference between the two viewport heights is the
 * covered strip; subtracting it from `100dvh` puts the composer back above the
 * keyboard. Android/Chrome resize the layout viewport themselves, so there the
 * difference stays 0 and nothing changes.
 *
 * Deliberately NOT part of the formula: `visualViewport.offsetTop`. That is
 * how far Safari has already panned the visual viewport to reveal the caret.
 * Subtracting it would make the host taller again and push the composer back
 * down into the keyboard, so the pan is left to resolve itself once the
 * shrunk content no longer needs it.
 */

export interface ViewportMetrics {
  /** Layout viewport height — `window.innerHeight`. */
  layoutHeight: number;
  /** Visual viewport height — `window.visualViewport.height`. */
  visualHeight: number;
  /** `window.visualViewport.scale`; greater than 1 means pinch-zoomed. */
  scale?: number;
}

/**
 * Differences below this are not a keyboard: Safari's form accessory bar, the
 * collapsing address bar and sub-pixel rounding all produce a few dozen
 * pixels of drift, and reacting to those would make the layout jitter. Every
 * real software keyboard is far taller.
 */
export const KEYBOARD_INSET_MIN_PX = 80;

export function computeKeyboardInset(
  metrics: ViewportMetrics | null | undefined,
): number {
  if (!metrics) return 0;

  const { layoutHeight, visualHeight, scale } = metrics;
  if (!Number.isFinite(layoutHeight) || !Number.isFinite(visualHeight)) return 0;

  // While pinch-zoomed the visual viewport is a window onto the page, not a
  // keyboard-shortened screen, so the two heights say nothing about a keyboard.
  if (typeof scale === "number" && scale > 1.01) return 0;

  const inset = Math.round(layoutHeight - visualHeight);
  return inset >= KEYBOARD_INSET_MIN_PX ? inset : 0;
}
