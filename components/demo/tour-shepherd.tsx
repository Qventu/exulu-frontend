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

  useEffect(() => {
    if (!tour || !step) return;
    if (shown.current === step.id) return;
    shown.current = step.id;
    void tour.show(step.id);
  }, [tour, step]);

  return null;
}
