import type { DemoChapter, DemoChapterId, TourPosition } from "./tour";

export type RailState = "past" | "current" | "upcoming";

export interface RailSegment {
  id: DemoChapterId;
  index: number;
  title: string;
  state: RailState;
}

/**
 * One segment per chapter for the panel's progress rail: where the visitor
 * is, what they have seen, what is left. Pure so the panel stays a thin
 * render over tested data.
 */
export function railSegments(chapters: DemoChapter[], position: TourPosition): RailSegment[] {
  const current = chapters.findIndex((c) => c.id === position.chapter);
  return chapters.map((c, index) => ({
    id: c.id,
    index,
    title: c.title,
    state: index < current ? "past" : index === current ? "current" : "upcoming",
  }));
}
