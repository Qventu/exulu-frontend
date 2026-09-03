"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { autoAdvanceDelay } from "@/lib/demo/auto-advance";
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
  startPosition,
} from "@/lib/demo/tour";
import { setCurrentPosition } from "@/lib/demo/current-position";

const TourContext = createContext<ReturnType<typeof useTourState> | null>(null);

// Derived, not named. This was a literal { chapter: "techdoc", step: 0 }
// written before the intro chapter existed, so every visitor arriving without
// a ?tour= param opened on chapter 2 and never saw chapter 1.
const START: TourPosition = startPosition();

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

  // Memoised on the raw param string, not recomputed per render.
  //
  // parsePosition returns a fresh object literal every call, so an
  // unmemoised `position` changes identity on every render. That was
  // harmless while it only fed two useMemos that returned equal values —
  // but it also meant those memos never actually memoised, and the moment a
  // live side effect depends on `position` (the auto-advance timer below)
  // an unrelated re-render silently restarts it.
  const rawPosition = searchParams.get(TOUR_PARAM);
  const position = useMemo(
    () => parsePosition(rawPosition, CHAPTERS) ?? START,
    [rawPosition],
  );

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

  // Auto-advance. The timer lives here rather than in the Shepherd component
  // because stage steps never reach Shepherd, and both kinds must animate.
  //
  // Cleanup covers every way out: clicking Next or Back changes `position`,
  // which re-runs the effect and clears the pending timer, so a manual
  // navigation can never race a scheduled one.
  useEffect(() => {
    const delay = autoAdvanceDelay(step);
    if (delay === null) return;
    const forward = nextPosition(CHAPTERS, position);
    // Belt and braces with the chapter-integrity test: never carry a visitor
    // out of a chapter they may still be reading.
    if (!forward || forward.chapter !== position.chapter) return;
    const timer = setTimeout(() => go(forward), delay);
    return () => clearTimeout(timer);
  }, [step, position, go]);

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
