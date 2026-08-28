"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getWorld } from "@/lib/demo/fixtures";
import {
  CHAPTERS,
  type DemoChapterId,
  type TourPosition,
  TOUR_PARAM,
  hrefFor,
  nextPosition,
  parsePosition,
  prevPosition,
  resolveStep,
  startOfChapter,
} from "@/lib/demo/tour";
import { setCurrentPosition } from "@/lib/demo/current-position";

const TourContext = createContext<ReturnType<typeof useTourState> | null>(null);

const START: TourPosition = { chapter: "techdoc", step: 0 };

/**
 * Tour state is DERIVED from the URL, never mirrored into React state.
 *
 * The tour walks across route groups — /demo/tour for the chat chapters, then
 * the product's own /agents/edit and /data routes — and those have separate
 * layouts, so a provider holding position in useState loses it on the first
 * cross-group navigation. That is not hypothetical: chapters 3 and 4 both end
 * on a product route.
 *
 * Deriving from the URL also keeps this unidirectional. Advancing is a
 * navigation, not a setState plus an effect that reconciles the route — which
 * is the shape that produces render loops.
 */
function useTourState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const position =
    parsePosition(searchParams.get(TOUR_PARAM), CHAPTERS) ?? START;

  const go = useCallback(
    (target: TourPosition | null) => {
      if (!target) return;
      router.push(hrefFor(target, CHAPTERS));
    },
    [router],
  );

  const next = useCallback(
    () => go(nextPosition(CHAPTERS, position)),
    [go, position],
  );
  const prev = useCallback(
    () => go(prevPosition(CHAPTERS, position)),
    [go, position],
  );
  const jumpTo = useCallback(
    (chapter: DemoChapterId) => go(startOfChapter(chapter)),
    [go],
  );

  // Publish to the module cell so Apollo and useChat — both constructed
  // outside this tree — see the current step. Synchronous, not an effect: the
  // link may be asked to resolve before effects flush.
  setCurrentPosition(position);

  const step = useMemo(() => resolveStep(CHAPTERS, position), [position]);
  const world = useMemo(() => getWorld(position), [position]);

  return { position, step, chapters: CHAPTERS, next, prev, jumpTo, world };
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const value = useTourState();
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}
