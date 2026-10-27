import * as React from "react";

import { computeKeyboardInset } from "@/lib/keyboard-inset";

/** The CSS variable the `h-dvh-keyboard` utility in globals.css reads. */
export const KEYBOARD_INSET_VAR = "--keyboard-inset";

/**
 * Publishes the height the software keyboard covers as a CSS variable on the
 * root element, so any full-height layout can subtract it (see the
 * `h-dvh-keyboard` utility). Mount once per screen that owns a `100dvh` host.
 *
 * Why a CSS variable rather than component state: the value changes on every
 * keyboard animation frame, and a React state update per frame would re-render
 * the whole chat tree while the user is typing. Writing one custom property
 * keeps the work in the compositor.
 *
 * Browsers without `visualViewport` (and every engine that resizes the layout
 * viewport itself, which is all of Android) never get the variable set, and
 * the utility's `0px` fallback leaves the layout exactly as it was.
 */
export function useKeyboardInset(): void {
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let previous = -1;

    const apply = () => {
      const inset = computeKeyboardInset({
        layoutHeight: window.innerHeight,
        visualHeight: viewport.height,
        scale: viewport.scale,
      });
      // Writing an unchanged value still invalidates style on some engines.
      if (inset === previous) return;
      previous = inset;
      root.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
    };

    apply();
    // `resize` fires when the keyboard opens or closes; `scroll` fires while
    // Safari pans the visual viewport, which is when `innerHeight` and the
    // visual height can disagree mid-animation.
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      root.style.removeProperty(KEYBOARD_INSET_VAR);
    };
  }, []);
}
