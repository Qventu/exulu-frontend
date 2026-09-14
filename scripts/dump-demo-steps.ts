/**
 * Prints every tour step, in order, as JSON: `{ pos, chapterId, chapterTitle,
 * step, stepId, route, anchor, href, scrollBlock }[]`.
 *
 * The one and only source of the step list for scripts/walk-demo.mjs. That
 * script shells out to this one (`npx tsx scripts/dump-demo-steps.ts`) rather
 * than hardcoding 37 URLs, so the walker cannot drift out of sync with
 * lib/demo/chapters — add, remove or reorder a step there and the walker
 * picks it up on the next run with no edit here.
 *
 * `hrefFor` (lib/demo/tour.ts) is reused rather than reimplemented so the
 * walker exercises the exact same URL-building code the product runs,
 * including its handling of routes that already carry a `?query`.
 *
 * Run standalone with: npx tsx scripts/dump-demo-steps.ts
 */
import { CHAPTERS, hrefFor } from "../lib/demo/tour";

const steps = CHAPTERS.flatMap((chapter) =>
  chapter.steps.map((step, index) => ({
    pos: `${chapter.id}.${index}`,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    step: index,
    stepId: step.id,
    route: step.route,
    anchor: step.anchor,
    href: hrefFor({ chapter: chapter.id, step: index }, CHAPTERS),
    scrollBlock: step.scrollBlock ?? "nearest",
  })),
);

console.log(JSON.stringify(steps, null, 2));
