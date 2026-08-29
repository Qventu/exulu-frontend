"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tour } from "shepherd.js";

import { shepherdStepsFor } from "@/lib/demo/shepherd-step";
import { CHAPTERS, type TourPosition, hrefFor } from "@/lib/demo/tour";

import "shepherd.js/dist/css/shepherd.css";
import "./shepherd-theme.css";

import { useTour } from "./tour-provider";

/**
 * Resolves `selector` repeatedly until it returns the same node, in the same
 * place, on three consecutive frames — or the budget runs out.
 *
 * Both halves are load-bearing, because the two routes break differently:
 *
 * - On the chat route the answer is markdown that React re-renders as Apollo
 *   results land, so the citation and retrieval spans are REPLACED after they
 *   first appear. Shepherd keeps the node it resolved and ends up holding a
 *   detached one, whose rect is all zeros — hence a popover in the top-left
 *   corner of the viewport.
 * - On the workflow route the runs list keeps the SAME node and grows into it,
 *   from a placeholder to 1238px as the runs arrive. Identity never changes,
 *   so an identity-only check returns immediately and Shepherd positions
 *   against a rect that is about to be a thousand pixels taller.
 *
 * Three frames rather than one because React commits in batches, and a single
 * frame of sameness can fall between two halves of one pass. It costs nothing
 * when the anchor is already settled — the loop exits after about 50ms.
 *
 * Lives in this component rather than lib/demo/ because it is pure DOM: vitest
 * runs this project in a node environment, so there is nothing here it could
 * be tested against.
 */
async function waitForStableAnchor(
  selector: string,
  budgetMs = 3000,
): Promise<Element | null> {
  const deadline = performance.now() + budgetMs;
  const shapeOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}`;
  };

  let last: Element | null = null;
  let lastShape = "";
  let stable = 0;

  while (performance.now() < deadline) {
    const current = document.querySelector(selector);
    const shape = current ? shapeOf(current) : "";
    if (current && current === last && shape === lastShape) {
      if (++stable >= 3) return current;
    } else {
      stable = 0;
      last = current;
      lastShape = shape;
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  }
  return last;
}

/**
 * Drives Shepherd from the tour position in the URL.
 *
 * The division of labour is deliberate and one-directional: the URL says which
 * step we are on, and Shepherd is told to render it. Shepherd's own cursor
 * (`tour.next()`, `tour.back()`, arrow keys) is never used to decide anything,
 * because it cannot navigate between routes — and chapters 3 and 4 each end on
 * a different product route. Letting it advance would move the popover while
 * the page underneath stayed put.
 *
 * Renders no DOM of its own. Shepherd appends the popover and the modal
 * overlay to document.body.
 */
export function TourShepherd() {
  const { step } = useTour();
  const router = useRouter();
  const [tour, setTour] = useState<Tour | null>(null);

  // Shepherd keeps the step definitions — and their button closures — for the
  // lifetime of the tour, which outlives any single render. Routing through a
  // ref means those closures always reach the current router rather than the
  // one captured when the tour was built.
  //
  // Assigned in an effect rather than during render: React may discard a
  // render, and a ref written during one that never commits is a write that
  // silently did not happen. This effect is declared before the one that
  // builds the tour, so the ref is populated by the time any button exists.
  const navigate = useRef<(target: TourPosition) => void>(() => {});
  useEffect(() => {
    navigate.current = (target) => router.push(hrefFor(target, CHAPTERS));
  });

  useEffect(() => {
    let cancelled = false;
    let created: Tour | null = null;

    void (async () => {
      // Imported here rather than at module scope for two reasons. The demo
      // chrome is gated behind NEXT_PUBLIC_DEMO_MODE, so a static import would
      // ship Shepherd and floating-ui to every production visitor who never
      // sees a tour. And Shepherd picks its real-or-stub Tour class when the
      // module is evaluated — `typeof window === "undefined"` yields a no-op
      // stub — so evaluating it in the browser is what guarantees the real one.
      const Shepherd = (await import("shepherd.js")).default;
      if (cancelled) return;

      created = new Shepherd.Tour({
        useModalOverlay: true,
        // Arrow keys would call Shepherd's own next()/back(), advancing the
        // popover without changing the route. The highlight would then point
        // at a step the page no longer matches. Every advance goes through the
        // router instead.
        keyboardNavigation: false,
        // Esc calls cancel(), and there is currently nothing to cancel back
        // to: the provider falls back to the first step whenever ?tour= is
        // absent, so a dismissed tour would reopen on the next render. Until
        // "browse freely" is a real state, refuse the affordance rather than
        // ship the loop. Same reason the cancel icon is off.
        exitOnEsc: false,
        defaultStepOptions: {
          cancelIcon: { enabled: false },
          modalOverlayOpeningRadius: 6,
        },
      });

      // This call is also the proof that DemoStepOptions is assignable to
      // Shepherd's StepOptions — no separate type assertion needed.
      created.addSteps(
        shepherdStepsFor(CHAPTERS, (target) => navigate.current(target)),
      );

      setTour(created);

      // Not awaited. start() shows step 0, whose anchor may not exist on the
      // route the visitor deep-linked to, and waiting on it would stall for
      // ANCHOR_WAIT_MS before the correct step could be shown. The sync effect
      // below calls show() immediately after this commits, and Shepherd
      // invalidates the superseded wait (_showGeneration).
      void created.start();
    })();

    return () => {
      cancelled = true;
      // complete() tears down the popover, the overlay and the body classes.
      created?.complete();
    };
  }, []);

  // Which step Shepherd is currently displaying. Compared before calling
  // show() so that re-renders which do not move the position — and there are
  // many, since every Apollo result re-renders the tree — do not restart the
  // step's entrance animation and scroll.
  const shown = useRef<string | null>(null);

  // Bumped on every step change so a settle loop that is still running when the
  // visitor clicks Next knows it has been superseded and must not reposition a
  // step that is no longer on screen.
  const generation = useRef(0);

  useEffect(() => {
    if (!tour || !step) return;
    if (shown.current === step.id) return;
    shown.current = step.id;
    const mine = ++generation.current;

    void (async () => {
      const selector = step.anchor ? `[data-demo-id="${step.anchor}"]` : null;
      const before = selector ? document.querySelector(selector) : null;

      void tour.show(step.id);
      if (!selector) return;

      // Shepherd's waitForElement waits for the anchor to EXIST, and that is
      // not the same as the anchor being the node it will still be a moment
      // later. On the chat route the answer is markdown that React re-renders
      // as Apollo results land, so the citation and retrieval spans are
      // replaced after they first appear. Shepherd resolves the selector once,
      // at show() time, and keeps the element — so it ends up holding a node
      // that is no longer in the document. A detached node's
      // getBoundingClientRect() is all zeros, floating-ui positions against
      // those zeros, and the popover lands in the top-left corner of the
      // viewport straddling the sidebar.
      //
      // That is why the misplacement looked non-deterministic: it depends
      // entirely on whether a re-render happened to land between show() and
      // the visitor looking. Re-showing the same step re-resolves the selector,
      // which is why clicking Back then Next always "fixed" it.
      const settled = await waitForStableAnchor(selector);
      if (mine !== generation.current) return;
      if (!settled) return;

      const rect = settled.getBoundingClientRect();
      const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
      if (settled === before && document.contains(before) && onScreen) return;

      // Scroll here rather than leaving it to Shepherd's own scrollTo. That
      // option runs once inside show(), and on routes where the anchor arrives
      // with an Apollo result there is nothing to scroll to at the moment it
      // fires — the runs list on this chapter loads a second after the page
      // does. Measured on chapter 7: anchor at y=2493 in a 903px viewport,
      // window left at scrollY=42, popover correctly positioned relative to an
      // anchor nobody could see.
      if (!onScreen) {
        settled.scrollIntoView({ block: "center", behavior: "auto" });
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null)),
        );
        if (mine !== generation.current) return;
      }

      void tour.show(step.id);
    })();
  }, [tour, step]);

  return null;
}
