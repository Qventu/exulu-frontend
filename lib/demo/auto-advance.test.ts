import { describe, expect, it } from "vitest";
import { autoAdvanceDelay } from "./auto-advance";
import type { DemoStep } from "./tour";

const step = (extra: Partial<DemoStep> = {}): DemoStep => ({
  id: "s", route: "/chat", anchor: null, title: "t",
  content: [{ kind: "paragraph", text: "b" }],
  ...extra,
});

describe("autoAdvanceDelay", () => {
  it("is null when the step does not ask to advance", () => {
    expect(autoAdvanceDelay(step())).toBeNull();
  });

  it("returns the requested delay", () => {
    expect(autoAdvanceDelay(step({ advanceAfterMs: 2400 }))).toBe(2400);
  });

  it("refuses to advance a step carrying a decision", () => {
    expect(autoAdvanceDelay(step({ advanceAfterMs: 2400, cta: { label: "x", href: "/y" } }))).toBeNull();
  });

  it("refuses a non-positive delay rather than advancing instantly", () => {
    expect(autoAdvanceDelay(step({ advanceAfterMs: 0 }))).toBeNull();
    expect(autoAdvanceDelay(step({ advanceAfterMs: -1 }))).toBeNull();
  });

  it("is null for no step", () => {
    expect(autoAdvanceDelay(null)).toBeNull();
    expect(autoAdvanceDelay(undefined)).toBeNull();
  });
});
