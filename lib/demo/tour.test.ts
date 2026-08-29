import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  type DemoChapter,
  nextPosition,
  prevPosition,
  resolveStep,
  startOfChapter,
} from "./tour";

const FIXTURE: DemoChapter[] = [
  {
    id: "techdoc",
    title: "A",
    steps: [
      { id: "a1", route: "/demo/tour", anchor: null, title: "t", body: "b" },
      { id: "a2", route: "/demo/tour", anchor: null, title: "t", body: "b" },
    ],
  },
  {
    id: "ingestion",
    title: "B",
    steps: [{ id: "b1", route: "/demo/tour", anchor: null, title: "t", body: "b" }],
  },
];

describe("resolveStep", () => {
  it("returns the step at a valid position", () => {
    expect(resolveStep(FIXTURE, { chapter: "techdoc", step: 1 })?.id).toBe("a2");
  });

  it("returns null for an out-of-range step", () => {
    expect(resolveStep(FIXTURE, { chapter: "techdoc", step: 9 })).toBeNull();
  });

  it("returns null for an unknown chapter", () => {
    expect(resolveStep(FIXTURE, { chapter: "evals", step: 0 })).toBeNull();
  });
});

describe("nextPosition", () => {
  it("advances within a chapter", () => {
    expect(nextPosition(FIXTURE, { chapter: "techdoc", step: 0 })).toEqual({
      chapter: "techdoc",
      step: 1,
    });
  });

  it("rolls over into the next chapter", () => {
    expect(nextPosition(FIXTURE, { chapter: "techdoc", step: 1 })).toEqual({
      chapter: "ingestion",
      step: 0,
    });
  });

  it("returns null at the very end", () => {
    expect(nextPosition(FIXTURE, { chapter: "ingestion", step: 0 })).toBeNull();
  });
});

describe("prevPosition", () => {
  it("rolls back to the LAST step of the previous chapter", () => {
    expect(prevPosition(FIXTURE, { chapter: "ingestion", step: 0 })).toEqual({
      chapter: "techdoc",
      step: 1,
    });
  });

  it("returns null at the very start", () => {
    expect(prevPosition(FIXTURE, { chapter: "techdoc", step: 0 })).toBeNull();
  });
});

describe("CHAPTERS", () => {
  it("opens on the intro, then the seven chapters in spec order", () => {
    // The spec's seven scenarios, with an eighth entry ahead of them. The
    // intro is a chapter rather than a separate landing page so it inherits
    // the navigation, the jump menu and the position-in-URL for free; it has
    // no product screen of its own, which is why it is not "chapter 8".
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      "intro",
      "techdoc",
      "ingestion",
      "config",
      "memory",
      "evals",
      "email",
      "meetings",
    ]);
  });

  it("illustrates chapter openings and nothing else", () => {
    // One schematic per chapter, on its first step. An image on every step
    // would compete with the product screen the tour is pointing at, which is
    // the thing the visitor is meant to be looking at.
    for (const chapter of CHAPTERS) {
      const illustrated = chapter.steps.filter((s) => s.image);
      expect(
        illustrated.length,
        `${chapter.id} should illustrate exactly one step`,
      ).toBe(1);
      expect(
        chapter.steps[0].image,
        `${chapter.id}'s schematic belongs on its opening step`,
      ).toBeTruthy();
    }
  });

  it("points every schematic at a file that exists", () => {
    // A typo'd path is a broken image in a popover, which the anchor tests
    // cannot see and which looks worse than no illustration at all.
    for (const chapter of CHAPTERS) {
      const image = chapter.steps[0].image!;
      expect(
        existsSync(join(process.cwd(), "public", image)),
        `${chapter.id} references a missing asset: ${image}`,
      ).toBe(true);
    }
  });

  it("gives every chapter at least one step", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.steps.length).toBeGreaterThan(0);
    }
  });

  it("starts a chapter at step 0", () => {
    expect(startOfChapter("evals")).toEqual({ chapter: "evals", step: 0 });
  });
});
