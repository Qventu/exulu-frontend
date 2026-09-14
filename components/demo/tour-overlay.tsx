"use client";

import { Suspense } from "react";

import { ChatQuestionIntoView } from "./chat-question-into-view";
import { ContentInert } from "./content-inert";
import { TourPanel } from "./tour-panel";
import { TourProvider } from "./tour-provider";
import { TourRing } from "./tour-ring";

/**
 * The tour's chrome. Mounted once, in app/(application)/layout.tsx.
 *
 * An earlier docblock here claimed it was mounted in BOTH layouts; that was
 * left from when /demo/tour existed and was false by the time anyone read it.
 */
export function TourOverlay() {
  return (
    // TourProvider reads the tour position with useSearchParams, which opts
    // the whole subtree into dynamic rendering unless a Suspense boundary
    // sits above it — without one, every route that mounts this component
    // (i.e. every route in the layout) loses static rendering wholesale.
    <Suspense fallback={null}>
      <TourProvider>
        <ContentInert />
        <TourRing />
        <TourPanel />
        <ChatQuestionIntoView />
      </TourProvider>
    </Suspense>
  );
}
