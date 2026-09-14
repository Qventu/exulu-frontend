"use client";

import { useEffect, useState } from "react";

import { useTour } from "./tour-provider";

// How long to keep looking for a step's anchor before giving up on that
// step's ring. Two real numbers from this codebase set the floor: a cold
// route load measured ~1.5s end to end, and the chat route is documented
// elsewhere (chat-question-into-view.tsx, tour-bubble.tsx) as taking ~6s to
// mount its composer, with a scripted exchange running for a further ~9s on
// top of that before an in-answer anchor (a citation badge) exists at all.
// 20s clears the 6s mount alone more than 3x over, and still leaves margin
// past the ~15s mount-plus-exchange worst case, without leaving a step
// "waiting" forever if an anchor genuinely never arrives.
const ANCHOR_WAIT_MS = 20_000;

/**
 * Outlines the step's anchor instead of dimming everything else.
 *
 * The dimming overlay is what made citations unclickable and stranded a dark
 * layer on screens whose anchor unmounted. An outline points just as well and
 * covers nothing, so it cannot swallow anything.
 *
 * The anchor is not always in the DOM yet when this mounts — most of the
 * product's screens gate their content behind a loading query, so a single
 * querySelector at mount races that query and reliably loses (measured: a
 * warm /data load takes ~150-170ms to mount its list, well past a mount-time
 * effect). A MutationObserver on the document keeps looking until the anchor
 * shows up, bounded by ANCHOR_WAIT_MS so a step with no matching anchor (a
 * typo, a removed data-demo-id) doesn't watch the DOM forever. The same
 * observer keeps running after the anchor is found so it can also catch the
 * anchor UNMOUNTING while the step is still showing — the old dimming
 * overlay stranding itself over empty space was one of the walkthrough's own
 * complaints, and a ring left floating over nothing would repeat it.
 */
export function TourRing() {
  const { step } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchor = step?.anchor ?? null;
  const scrollBlock = step?.scrollBlock ?? "nearest";

  useEffect(() => {
    if (!anchor) { setRect(null); return; }

    let raf = 0;
    let ro: ResizeObserver | null = null;
    let observedEl: Element | null = null;
    let giveUpTimer: ReturnType<typeof setTimeout> | null = null;

    const measure = () => {
      if (observedEl) setRect(observedEl.getBoundingClientRect());
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);

    const detach = () => {
      ro?.disconnect();
      ro = null;
      observedEl = null;
    };

    // Runs on mount, and again on every DOM mutation while this effect is
    // alive: attaches once the anchor first appears, detaches (and clears
    // the ring) if it later disappears, and no-ops otherwise.
    const sync = () => {
      const el = document.querySelector(`[data-demo-id="${anchor}"]`);
      if (el && el !== observedEl) {
        detach();
        observedEl = el;
        if (giveUpTimer) { clearTimeout(giveUpTimer); giveUpTimer = null; }
        el.scrollIntoView({ block: scrollBlock, behavior: "smooth" });
        ro = new ResizeObserver(measure);
        ro.observe(el);
        measure();
      } else if (!el && observedEl) {
        detach();
        setRect(null);
      }
    };

    sync();

    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });

    if (!observedEl) {
      giveUpTimer = setTimeout(() => mo.disconnect(), ANCHOR_WAIT_MS);
    }

    return () => {
      mo.disconnect();
      if (giveUpTimer) clearTimeout(giveUpTimer);
      detach();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [anchor, scrollBlock]);

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
