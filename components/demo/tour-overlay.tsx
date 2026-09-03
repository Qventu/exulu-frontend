"use client";

import { Suspense } from "react";

import { TourBubble } from "./tour-bubble";
import { TourProvider } from "./tour-provider";
import { TourShepherd } from "./tour-shepherd";
import { TourStage } from "./tour-stage";

/**
 * The tour's chrome — the Shepherd popover with its modal spotlight, and the
 * chapter menu — mounted over whatever page the current step lives on.
 *
 * This exists because the tour is not confined to /demo/tour. Chapter 3 runs
 * on /agents/edit/[id] and chapter 4 ends on /data/[ctx]: real product routes,
 * in the (application) route group, with their own layout. Before this, those
 * steps navigated the visitor away from the only surface that had a Next
 * button and stranded them there.
 *
 * Mounted in BOTH layouts rather than hoisted to a shared one — the two route
 * groups deliberately have separate roots (different auth, different
 * providers). That is safe precisely because position lives in the URL: two
 * providers in two trees read the same source of truth and never disagree.
 */
export function TourOverlay() {
  return (
    // useSearchParams needs a Suspense boundary above it, or every route that
    // renders this opts into dynamic rendering wholesale.
    <Suspense fallback={null}>
      <TourProvider>
        <TourShepherd />
        <TourStage />
        <TourBubble />
      </TourProvider>
    </Suspense>
  );
}
