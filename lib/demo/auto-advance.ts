import type { DemoStep } from "./tour";

/**
 * How long to wait before advancing past `step`, or null to wait for a click.
 *
 * Pure, so the policy is assertable without a timer or a DOM. The provider
 * owns the timeout; this owns the decision.
 */
export function autoAdvanceDelay(step: DemoStep | null | undefined): number | null {
  if (!step?.advanceAfterMs) return null;
  // A cta is a decision — moving the page out from under one is hostile.
  if (step.cta) return null;
  // A zero or negative delay would advance in the same tick, which reads as a
  // step that never rendered rather than as an animation.
  if (step.advanceAfterMs <= 0) return null;
  return step.advanceAfterMs;
}
