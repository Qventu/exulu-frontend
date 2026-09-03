import { describe, expect, it } from "vitest";
import { isEmptyContent } from "../content";
import { isDemoSupported } from "../supported-routes";
import { CHAPTERS } from "./index";

const everyStep = CHAPTERS.flatMap((chapter) =>
  chapter.steps.map((step, index) => ({ chapter, step, index })),
);

describe("chapter integrity", () => {
  it("gives every step copy", () => {
    for (const { chapter, step } of everyStep) {
      expect(isEmptyContent(step.content), `${chapter.id}/${step.id} has no copy`).toBe(false);
    }
  });

  it("uses ids that are unique across the whole tour", () => {
    const ids = everyStep.map(({ step }) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("navigates only to routes the demo has fixtures for", () => {
    for (const { chapter, step } of everyStep) {
      const pathname = step.route.split("?")[0];
      expect(isDemoSupported(pathname), `${chapter.id}/${step.id} → ${pathname}`).toBe(true);
    }
  });

  // Auto-advance across a chapter boundary would carry a visitor out of a
  // chapter they were still reading, and there is no Back that feels like undo.
  it("never auto-advances off the end of a chapter", () => {
    for (const chapter of CHAPTERS) {
      const last = chapter.steps[chapter.steps.length - 1];
      expect(last.advanceAfterMs, `${chapter.id} ends on an auto-advancing step`).toBeUndefined();
    }
  });

  // A cta is a decision. Moving the page out from under one is hostile.
  it("never auto-advances a step that asks for a decision", () => {
    for (const { step } of everyStep) {
      if (step.cta) expect(step.advanceAfterMs).toBeUndefined();
    }
  });

  // The memory chapter replays a correction, which needs an answer to correct.
  it("keeps the memory chapter after the chat chapter", () => {
    const order = CHAPTERS.map((c) => c.id);
    expect(order.indexOf("memory")).toBeGreaterThan(order.indexOf("techdoc"));
  });

  it("points every figure at a file that exists", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const { step } of everyStep) {
      for (const block of step.content) {
        if (block.kind !== "figure") continue;
        expect(existsSync(join(process.cwd(), "public", block.src)), `missing ${block.src}`).toBe(true);
      }
    }
  });
});
