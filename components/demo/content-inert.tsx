"use client";

import { useEffect } from "react";

/**
 * Makes the product non-operable during the tour, and no more than that.
 *
 * NOT pointer-events: none. That would also kill scrolling and text selection,
 * and chapter 5's answer is ~1300px of prose in a ~700px viewport — OPEN's
 * marketing lead specifically complained she could not scroll it. Blocking
 * wheel and touchmove would make that permanent.
 *
 * Blocks in the CAPTURE phase so a handler deeper in the product never runs.
 * The panel is outside <main>, so its own clicks are unaffected.
 */
export function ContentInert() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const swallow = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const types = ["click", "pointerdown", "mousedown", "keydown", "submit"] as const;
    for (const t of types) main.addEventListener(t, swallow, true);
    main.style.cursor = "default";
    return () => {
      for (const t of types) main.removeEventListener(t, swallow, true);
      main.style.cursor = "";
    };
  }, []);
  return null;
}
