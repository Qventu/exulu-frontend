"use client";

import { useEffect, useState } from "react";

/**
 * Positions a highlight over the element carrying data-demo-id={anchor}.
 * Renders nothing when the anchor is absent, so a step whose target has not
 * mounted yet degrades to an un-spotlit step rather than a crash.
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
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchor]);

  if (!rect) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 rounded-lg ring-4 ring-primary transition-all"
      style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
    />
  );
}
