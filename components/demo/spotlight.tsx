"use client";

import { useEffect, useState } from "react";

/**
 * Positions a highlight over the element carrying data-demo-id={anchor}.
 * Renders nothing when the anchor is absent, so a step whose target has not
 * mounted yet degrades to an un-spotlit step rather than a crash.
 *
 * The MutationObserver is load-bearing, not defensive. Chapter 3 spotlights
 * elements inside the agentic-retrieval Sheet, which the visitor opens AFTER
 * the step is already active — measuring only on mount would leave every step
 * inside the wizard permanently dark. Same for anything that arrives with a
 * Suspense boundary or an Apollo response.
 */
export function Spotlight({ anchor }: { anchor: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchor) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-demo-id="${anchor}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();

    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor]);

  if (!rect) return null;

  return (
    <div
      aria-hidden
      // Above z-50: the Sheet and Dialog overlays sit there, and chapter 3
      // spotlights elements inside one.
      className="pointer-events-none fixed z-[60] rounded-lg ring-4 ring-primary transition-all"
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      }}
    />
  );
}
