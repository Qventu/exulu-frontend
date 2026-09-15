"use client";

import { useEffect, useState } from "react";

import { useTour } from "./tour-provider";

// How long to keep looking for a step's anchor before giving up on that
// step's ring. Two real numbers from this codebase set the floor: a cold
// route load measured ~1.5s end to end, and the chat route is documented
// elsewhere (chat-question-into-view.tsx, use-autotype.ts) as taking ~6s to
// mount its composer, with a scripted exchange running for a further ~9s on
// top of that before an in-answer anchor (a citation badge) exists at all.
// 20s clears the 6s mount alone more than 3x over, and still leaves margin
// past the ~15s mount-plus-exchange worst case, without leaving a step
// "waiting" forever if an anchor genuinely never arrives.
const ANCHOR_WAIT_MS = 20_000;

// How long to keep re-measuring after the anchor is found, and how often.
//
// An anchor can be inside a container that is still ANIMATING when it enters
// the DOM. The concrete case is chapter 7's retrieval wizard: components/ui/
// sheet.tsx gives side="right" a `slide-in-from-right` at `duration-500`, so
// the anchor's first frame is a full sheet-width off to the right of where it
// ends up. Nothing else in this effect notices — a ResizeObserver does not
// fire on a translate, the MutationObserver's `sync()` only re-measures when
// the anchor's IDENTITY changes, and no scroll or resize follows — so a
// single measure at insertion time froze the ring at the animation's first
// frame (measured: ring 672px to the right of the anchor at a 1440px
// viewport). Re-measuring across a window that outlasts the animation fixes
// it for any animating container, not just this sheet. 700ms clears the 500ms
// sheet with margin.
//
// A setInterval and NOT requestAnimationFrame, which is what this was first
// written as: a transform animation is driven by the compositor, so it
// finishes whether or not the main thread produces frames — and rAF callbacks
// only run when it does. Measured in headless Chromium, the sheet slid the
// whole way while a rAF settle loop never ticked once, leaving the ring
// exactly where the bug left it. A background tab throttles timers too, but
// to ~1s rather than to nothing, and ANIMATION_END below covers the rest.
const SETTLE_MS = 700;
const SETTLE_TICK_MS = 50;

// Belt to the interval's braces, for the general case rather than this sheet:
// any animation or transition that ends LATER than SETTLE_MS (a slow drawer, a
// staged reveal) re-measures on its own end event. Listened for on `document`
// because the animating element is an ANCESTOR of the anchor — neither event
// reaches the anchor by bubbling — and because the wizard's sheet is portalled
// out of the tour's flex row entirely. Demo-only: this component mounts inside
// TourOverlay, which app/(application)/layout.tsx renders only when demoMode.
const ANIMATION_END = ["animationend", "transitionend"] as const;

/**
 * The animations currently running on the anchor or any of its ancestors.
 *
 * Used to HOLD the first measurement rather than publish one taken mid-slide:
 * without it the ring renders once at the animation's opening frame — for the
 * chapter-7 sheet, a full sheet-width to the right, i.e. on top of the docked
 * panel — and then sweeps across the screen to the anchor as the settle ticker
 * corrects it. Correct in the end, ugly on the way, and the walk-demo run
 * caught the sweep as `coveringPanel`.
 *
 * Infinite animations are skipped: a spinner or shimmer on an ancestor never
 * finishes, and waiting on one would mean never drawing the ring at all. The
 * hold is released after SETTLE_MS regardless, so nothing else can strand it.
 */
function ancestorAnimations(el: Element): Animation[] {
  return document.getAnimations().filter((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
    if (!(target instanceof Element) || !target.contains(el)) return false;
    return animation.effect?.getComputedTiming().iterations !== Infinity;
  });
}

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
 *
 * Finding the anchor is not the same as knowing where it is: it may still be
 * sliding in. See SETTLE_MS for why every attach is followed by a short
 * re-measuring window.
 */
export function TourRing() {
  const { step } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchor = step?.anchor ?? null;
  const scrollBlock = step?.scrollBlock ?? "nearest";

  useEffect(() => {
    if (!anchor) { setRect(null); return; }

    let raf = 0;
    let settleTicker: ReturnType<typeof setInterval> | null = null;
    let settleStop: ReturnType<typeof setTimeout> | null = null;
    let ro: ResizeObserver | null = null;
    let observedEl: Element | null = null;
    let lastRect: DOMRect | null = null;
    let holding = false;
    let giveUpTimer: ReturnType<typeof setTimeout> | null = null;

    // Only sets state when the box actually moved. The settle ticker below
    // fires every SETTLE_TICK_MS and the animation-end listeners fire for
    // every transition anywhere in the product; an unconditional setRect
    // would re-render the ring for all of them.
    const measure = () => {
      if (!observedEl || holding) return;
      const next = observedEl.getBoundingClientRect();
      if (
        lastRect &&
        next.top === lastRect.top &&
        next.left === lastRect.left &&
        next.width === lastRect.width &&
        next.height === lastRect.height
      ) {
        return;
      }
      lastRect = next;
      setRect(next);
    };

    // Re-measures on a tick until SETTLE_MS after the most recent attach, so
    // an anchor that arrives mid-animation ends up outlined where it lands
    // rather than where it started.
    const stopSettling = () => {
      if (settleTicker) clearInterval(settleTicker);
      if (settleStop) clearTimeout(settleStop);
      settleTicker = null;
      settleStop = null;
    };
    const release = () => {
      holding = false;
      measure();
    };
    const startSettling = () => {
      stopSettling();
      settleTicker = setInterval(measure, SETTLE_TICK_MS);
      // Also the hold's deadline: an animation that outlasts the window, or
      // one whose `finished` never settles, must not leave the ring undrawn.
      settleStop = setTimeout(() => { release(); stopSettling(); }, SETTLE_MS);
    };

    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    for (const t of ANIMATION_END) document.addEventListener(t, measure, true);

    const detach = () => {
      ro?.disconnect();
      ro = null;
      observedEl = null;
      lastRect = null;
      holding = false;
      stopSettling();
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
        // Anything still sliding in? Then this frame's rect is a lie — wait
        // for it to land before drawing anything. See ancestorAnimations.
        const pending = ancestorAnimations(el);
        holding = pending.length > 0;
        if (holding) {
          void Promise.all(pending.map((a) => a.finished.catch(() => null))).then(() => {
            if (observedEl === el) release();
          });
        }
        measure();
        startSettling();
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
      for (const t of ANIMATION_END) document.removeEventListener(t, measure, true);
      cancelAnimationFrame(raf);
    };
  }, [anchor, scrollBlock]);

  if (!rect) return null;
  return (
    <div
      data-demo-id="tour-ring"
      aria-hidden
      // z-30: above every product surface (the sidebar is z-10, the TopBar
      // z-20) and below the docked panel's z-40 — the ring is sized from a
      // product anchor, so a tall or full-width one otherwise draws its
      // outline across the panel. It has no pointer-events either way; this
      // is purely what the visitor sees.
      className="pointer-events-none fixed z-30 rounded-md ring-2 ring-primary transition-all duration-200"
      style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
    />
  );
}
