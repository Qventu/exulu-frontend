import { describe, expect, it } from "vitest";

import { railSegments } from "./panel-rail";
import { CHAPTERS } from "./tour";

describe("railSegments", () => {
  it("marks the chapters before the current one as past, after it as upcoming", () => {
    const segments = railSegments(CHAPTERS, { chapter: "memory", step: 2 });
    const states = segments.map((s) => s.state);
    expect(states.filter((s) => s === "past")).toHaveLength(5);
    expect(states.filter((s) => s === "current")).toHaveLength(1);
    expect(states.filter((s) => s === "upcoming")).toHaveLength(6);
    expect(segments[5]).toMatchObject({ id: "memory", index: 5, title: "Ein Assistent, der mitlernt", state: "current" });
  });

  it("has nothing past on the first chapter", () => {
    const segments = railSegments(CHAPTERS, { chapter: "daten", step: 0 });
    expect(segments[0].state).toBe("current");
    expect(segments.every((s, i) => i === 0 || s.state === "upcoming")).toBe(true);
  });

  it("keeps one segment per chapter, in tour order", () => {
    const segments = railSegments(CHAPTERS, { chapter: "contact", step: 1 });
    expect(segments.map((s) => s.id)).toEqual(CHAPTERS.map((c) => c.id));
    expect(segments[segments.length - 1].state).toBe("current");
  });
});
