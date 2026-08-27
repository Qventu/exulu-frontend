"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getWorld } from "@/lib/demo/fixtures";
import {
  CHAPTERS,
  type DemoChapterId,
  type TourPosition,
  nextPosition,
  prevPosition,
  resolveStep,
  startOfChapter,
} from "@/lib/demo/tour";
import { setCurrentPosition } from "@/lib/demo/current-position";

const TourContext = createContext<ReturnType<typeof useTourState> | null>(null);

function useTourState() {
  const [position, setPosition] = useState<TourPosition>({ chapter: "techdoc", step: 0 });

  const next = useCallback(() => {
    setPosition((p) => nextPosition(CHAPTERS, p) ?? p);
  }, []);
  const prev = useCallback(() => {
    setPosition((p) => prevPosition(CHAPTERS, p) ?? p);
  }, []);
  const jumpTo = useCallback((chapter: DemoChapterId) => {
    setPosition(startOfChapter(chapter));
  }, []);

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
