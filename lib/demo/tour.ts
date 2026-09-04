import type { ContentBlock } from "./content";
import { CHAPTERS } from "./chapters";
import { TECHDOC_CHAT } from "./routes";

export { CHAPTERS } from "./chapters";
export { DEMO_BOOKING_URL, MEMORY_CHAT, TECHDOC_CHAT } from "./routes";

export type DemoChapterId =
  | "daten"
  | "struktur"
  | "aufnahme"
  | "zugriff"
  | "techdoc"
  | "ingestion"
  | "config"
  | "memory"
  | "evals"
  | "email"
  | "meetings"
  | "contact";

export interface DemoStep {
  id: string;
  /** Route the shell navigates to for this step. */
  route: string;
  /** `data-demo-id` value to spotlight, or null for a full-screen step. */
  anchor: string | null;
  title: string;
  /**
   * The step's copy, as blocks. See lib/demo/content.ts for why this is data
   * and not JSX.
   */
  content: ContentBlock[];
  /**
   * "stage" renders full-bleed and bypasses Shepherd entirely — for beats
   * whose subject is the whole screen, where a popover over a dimmed app would
   * be fighting the tool. Default "popover".
   */
  kind?: "popover" | "stage";
  /** Panel width. "wide" for steps carrying a sequence or a figure. */
  size?: "default" | "wide";
  /**
   * Advance to the next step automatically after this many milliseconds.
   *
   * This is how the demo animates. types.ts requires every step to be a
   * COMPLETE world so the Tour menu can jump anywhere, so a knowledge base at
   * 0, 240 and 1.000 items is three worlds and three steps rather than one
   * world and a clock — which also keeps every intermediate state
   * deep-linkable and needs no Apollo refetch plumbing.
   *
   * Never on a chapter's last step, and never on a step with a cta; the
   * integrity test in chapters/index.test.ts enforces both.
   */
  advanceAfterMs?: number;
  /**
   * Terminal call to action, rendered as the step's primary button.
   *
   * A button rather than a link in the body: the last step has no Next, so
   * without one the footer holds only "Back" and the tour ends by asking a
   * question the visitor cannot answer. Putting the ask where every other step
   * puts "Next" is what makes it the obvious thing to press.
   */
  cta?: { label: string; href: string };
  /**
   * Turns off the dimming overlay for this step.
   *
   * The overlay exists to point at one element, which is wrong for a step whose
   * subject is the whole screen changing. techdoc.0 anchors to the composer —
   * correct, that is where the question is typed — but the answer then streams
   * ABOVE it, and everything outside the composer's cutout was greyed out. The
   * step said "watch it search and answer" over a dimmed transcript.
   */
  noDim?: boolean;
  /**
   * How the anchor is scrolled into view. Default "nearest" (move the minimum,
   * never re-centre something already visible — centring the composer once
   * scrolled the whole page down). "start" for anchors that HEAD a long list:
   * nearest leaves the header at the bottom edge with the list below the fold,
   * and the step is about the list.
   */
  scrollBlock?: "start" | "nearest";
  /**
   * Which side of the anchor the popover prefers. floating-ui flips it when
   * that side does not fit, so this is a preference, not a promise. Default
   * "bottom". "left" for the wizard steps: bottom placement sat the popover
   * across the drawer's own heading.
   */
  placement?: "top" | "bottom" | "left" | "right";
}

export interface DemoChapter {
  id: DemoChapterId;
  title: string;
  steps: DemoStep[];
}

export interface TourPosition {
  chapter: DemoChapterId;
  step: number;
}

function chapterIndex(chapters: DemoChapter[], id: DemoChapterId): number {
  return chapters.findIndex((c) => c.id === id);
}

export function resolveStep(chapters: DemoChapter[], pos: TourPosition): DemoStep | null {
  const chapter = chapters[chapterIndex(chapters, pos.chapter)];
  if (!chapter) return null;
  return chapter.steps[pos.step] ?? null;
}

export function nextPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  const chapter = chapters[ci];
  if (pos.step + 1 < chapter.steps.length) {
    return { chapter: chapter.id, step: pos.step + 1 };
  }
  const next = chapters[ci + 1];
  return next ? { chapter: next.id, step: 0 } : null;
}

export function prevPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  if (pos.step > 0) return { chapter: pos.chapter, step: pos.step - 1 };
  const prev = chapters[ci - 1];
  return prev ? { chapter: prev.id, step: prev.steps.length - 1 } : null;
}

export function startOfChapter(id: DemoChapterId): TourPosition {
  return { chapter: id, step: 0 };
}

/**
 * Where the demo begins.
 *
 * The one place that answers the question, because two places used to answer
 * it differently: the provider's fallback was a literal
 * `{ chapter: "techdoc", step: 0 }` from before the intro chapter existed, so
 * anyone landing without a `?tour=` param — including every visitor arriving
 * at the demo's own root URL — silently skipped chapter 1.
 *
 * Derived from the chapter list rather than named, so re-ordering the story
 * moves the entry point with it instead of stranding a hardcoded id.
 */
export function startPosition(chapters: DemoChapter[] = CHAPTERS): TourPosition {
  return { chapter: chapters[0].id, step: 0 };
}

/**
 * The tour position lives in the URL, as `?tour=<chapter>.<step>`.
 *
 * It has to. Chapters 3 and 4 end on the product's own routes — the agent
 * editor, the knowledge base — which are in a different route group with its
 * own layout, so React state in a provider does not survive the navigation.
 * Held in the URL it does, and the position is shareable and reloadable as a
 * bonus: a salesperson can send a prospect a link to step 3 of chapter 5.
 */
export const TOUR_PARAM = "tour";

export function encodePosition(pos: TourPosition): string {
  return `${pos.chapter}.${pos.step}`;
}

/**
 * Returns null for anything unparseable, so a hand-edited or stale URL starts
 * the tour from the beginning rather than rendering a chapter with no steps.
 */
export function parsePosition(
  raw: string | null | undefined,
  chapters: DemoChapter[] = CHAPTERS,
): TourPosition | null {
  if (!raw) return null;
  const [chapterId, rawStep] = raw.split(".");
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  const step = Number(rawStep);
  if (!Number.isInteger(step) || step < 0 || step >= chapter.steps.length) {
    return null;
  }
  return { chapter: chapter.id, step };
}

/** The href a step lives at: its route, carrying the position. */
export function hrefFor(
  pos: TourPosition,
  chapters: DemoChapter[] = CHAPTERS,
): string {
  const step = resolveStep(chapters, pos);
  const route = step?.route ?? TECHDOC_CHAT;
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}${TOUR_PARAM}=${encodePosition(pos)}`;
}
