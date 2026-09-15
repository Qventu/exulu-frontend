import type { ContentBlock } from "./content";
import { DEMO_SCENES } from "./scenes";
import type { DemoStep } from "./tour";

/**
 * Where a step's copy actually lives.
 *
 * Most steps carry their own `content`. The four scene steps do not: their
 * blocks moved to lib/demo/scenes.ts when scenes became real pages, because
 * a scene renders its copy full-width in the content area and leaving the
 * blocks on the step as well would make the panel offer "Mehr" showing the
 * very content already on screen beside it. `step.content` is `[]` for those
 * four.
 *
 * So anything that reads `step.content` directly silently skips a ninth of
 * the tour — which is exactly what happened to two checks in
 * lib/demo/chapters/index.test.ts, one of them the enforcement point for the
 * reference-customer confidentiality rule. This is the one lookup, shared,
 * rather than a fourth hand-rolled copy of it.
 */
export function contentOf(step: DemoStep): ContentBlock[] {
  if (step.route.startsWith("/demo/szene/")) {
    return DEMO_SCENES[step.route.split("/").pop()!]?.content ?? [];
  }
  return step.content;
}
