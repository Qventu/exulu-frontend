"use client";

import { useEffect, useState } from "react";

import { useTour } from "./tour-provider";

/**
 * Outlines the step's anchor instead of dimming everything else.
 *
 * The dimming overlay is what made citations unclickable and stranded a dark
 * layer on screens whose anchor unmounted. An outline points just as well and
 * covers nothing, so it cannot swallow anything.
 */
export function TourRing() {
  const { step } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchor = step?.anchor ?? null;

  useEffect(() => {
    if (!anchor) { setRect(null); return; }
    let raf = 0;
    const el = document.querySelector(`[data-demo-id="${anchor}"]`);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: step?.scrollBlock ?? "nearest", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [anchor, step?.scrollBlock]);

  if (!rect) return null;
  return (
    <div
      data-demo-id="tour-ring"
      aria-hidden
      className="pointer-events-none fixed z-40 rounded-md ring-2 ring-primary transition-all duration-200"
      style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
    />
  );
}
