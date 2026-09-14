"use client";

import { useEffect } from "react";

/**
 * Makes the product non-operable during the tour, and no more than that.
 *
 * NOT pointer-events: none. That would also kill scrolling and text selection,
 * and chapter 5's answer is ~1300px of prose in a ~700px viewport — OPEN's
 * marketing lead specifically complained she could not scroll it. Blocking
 * wheel, touchmove or scroll would make that permanent.
 *
 * Attached to `document`, not `<main>`. A Radix Dialog/Sheet (chapter 7's
 * retrieval wizard among them) portals its content to `document.body` by
 * default, which makes it a DOM sibling of `<main>`, not a descendant — a
 * blocker scoped to `<main>` never sees events dispatched inside one, no
 * matter the capture phase, because capturing only visits actual ancestors
 * of the event target. Listening on `document` sees every target, portalled
 * or not, including ones added after this effect runs, without having to
 * enumerate portal roots.
 *
 * The panel is exempted by checking the event's TARGET rather than the
 * listener's scope, which is what lets it stay outside <main> and still work:
 * an event whose target is inside [data-demo-id="tour-panel"] is let through
 * untouched; everything else is swallowed in the capture phase before any
 * handler deeper in the product runs.
 */
export function ContentInert() {
  useEffect(() => {
    const main = document.querySelector("main");

    const swallow = (e: Event) => {
      const target = e.target;
      if (target instanceof Node) {
        const panel = document.querySelector('[data-demo-id="tour-panel"]');
        if (panel && panel.contains(target)) return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    const types = ["click", "pointerdown", "mousedown", "keydown", "submit"] as const;
    for (const t of types) document.addEventListener(t, swallow, true);
    if (main) main.style.cursor = "default";
    return () => {
      for (const t of types) document.removeEventListener(t, swallow, true);
      if (main) main.style.cursor = "";
    };
  }, []);
  return null;
}
