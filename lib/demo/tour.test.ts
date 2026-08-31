import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  DEMO_BOOKING_URL,
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
  it("keeps the chat chapters together at the front", () => {
    // The intro is a chapter rather than a separate landing page so it
    // inherits the navigation, the jump menu and the position-in-URL for free;
    // it has no product screen of its own.
    //
    // `memory` follows `techdoc` rather than sitting after `config`, which is
    // where the spec put it. The spec order sent a visitor chat → knowledge →
    // agent editor → BACK to chat, and the return read as a mistake: you think
    // you have finished with a surface and the tour drops you on it again.
    //
    // It also buried the strongest moment in the demo. "When it doesn't know,
    // it says so" — an explicit refusal, with citations, in German — was the
    // fifth chapter, reached by doubling back. It is now the second, while the
    // conversation it belongs to is still the thing on screen.
    //
    // The cost was two forward references in `config` that set memory up; they
    // are now backward references to something already seen, which is easier
    // copy anyway. If this order is ever changed again, those two lines and
    // ingestion's opener all point at neighbours and would need rewriting.
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      "intro",
      "techdoc",
      "memory",
      "ingestion",
      "config",
      "evals",
      "email",
      "meetings",
      "contact",
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
        `${chapter.id} should illustrate at most one step`,
      ).toBeLessThanOrEqual(1);
      if (illustrated.length) {
        expect(
          chapter.steps[0].image,
          `${chapter.id}'s schematic belongs on its opening step`,
        ).toBeTruthy();
      }
    }
  });

  it("points every schematic at a file that exists", () => {
    // A typo'd path is a broken image in a popover, which the anchor tests
    // cannot see and which looks worse than no illustration at all.
    for (const chapter of CHAPTERS) {
      const image = chapter.steps[0].image;
      if (!image) continue;
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

describe("the reading load", () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

  it("keeps every step under a paragraph", () => {
    // The tour was reported as overwhelming, and the measurement agreed: 29
    // steps and 1093 words, five and a half minutes of reading inside a
    // twelve-minute tour. The worst offender was the OPENING step at 76 words,
    // which is the worst possible place for the longest paragraph — patience
    // is highest there and investment is zero.
    //
    // Density also ran opposite to attention: the two shortest steps were the
    // ones reviewers singled out as best, and the heaviest clustered in the
    // late chapters where attention is thinnest.
    //
    // 45 is not a magic number, it is roughly three lines in a 380px popover.
    // The point of the cap is that copy grows back if nothing stops it.
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        expect(
          words(step.body),
          `${step.id} is ${words(step.body)} words — trim it or split the step`,
        ).toBeLessThanOrEqual(45);
      }
    }
  });

  it("opens on something short", () => {
    // A visitor reads this before the tour has shown them anything.
    expect(words(CHAPTERS[0].steps[0].body)).toBeLessThanOrEqual(32);
  });

  it("never puts two consecutive steps on the same anchor", () => {
    // Two steps sharing an anchor means the screen does not change between
    // them, so the tour reads as marking time and the visitor pays a click for
    // nothing. Both pairs that did this — the evals grid and the routine runs
    // — were merged; a reviewer had independently flagged the first as a stall.
    for (const chapter of CHAPTERS) {
      for (let i = 1; i < chapter.steps.length; i++) {
        const previous = chapter.steps[i - 1];
        const current = chapter.steps[i];
        if (!current.anchor) continue;
        expect(
          current.anchor === previous.anchor && current.route === previous.route,
          `${current.id} repeats ${previous.id}'s screen and anchor`,
        ).toBe(false);
      }
    }
  });
});

describe("the two chapters that show something invented", () => {
  // Everything in the tour is real except two artefacts, and both have to say
  // so ON SCREEN rather than in a comment. The evals disclosure shipped as a
  // source comment only — and that comment additionally claimed the narration
  // "deliberately claims no measured result" while the narration asserted a
  // measured regression beside invented numbers. A reviewer found it by
  // reading the screens. Nothing in this file could have, so these assert the
  // visitor-facing half.
  const bodies = (id: string) =>
    CHAPTERS.find((c) => c.id === id)!
      .steps.map((s) => s.body)
      .join(" ");

  it("tells the visitor the eval scores are not measurements", () => {
    expect(bodies("evals")).toMatch(/illustrative/i);
  });

  it("never states a measured eval outcome", () => {
    // The two phrasings that made invented numbers read as findings.
    expect(bodies("evals")).not.toMatch(/misses the terminology question/i);
    expect(bodies("evals")).not.toMatch(/drags the suite average/i);
  });

  it("tells the visitor the work instruction was written by hand", () => {
    expect(bodies("meetings")).toMatch(/by hand/i);
  });
});

describe("the closing call to action", () => {
  const closing = () => CHAPTERS.at(-1)!.steps[0].body;

  it("makes the ask, in the whitepaper's own terms", () => {
    // The tour used to end on a Back button: twelve minutes of someone's
    // attention and then nothing. Whatever else changes here, the last thing
    // a visitor reads has to be an offer.
    //
    // And it has to be the SAME offer. The PDF a lead reads before arriving
    // proposes something specific — ten manuals, two weeks, their own service
    // team's questions — while the close used to invent a vaguer ask than the
    // one they had already been made.
    expect(closing()).toMatch(/ten of your manuals/i);
    expect(closing()).toMatch(/two weeks/i);
  });

  const closingStep = () => CHAPTERS.at(-1)!.steps[0];

  it("never renders a dead link or a placeholder", () => {
    // DEMO_BOOKING_URL is empty until the HubSpot meetings link exists. An
    // empty href would render as a button that goes nowhere, and a literal
    // placeholder would be worse — so no cta is attached at all.
    if (!DEMO_BOOKING_URL) {
      expect(closingStep().cta).toBeUndefined();
      expect(closing()).not.toContain("<a ");
      expect(closing()).not.toContain("href");
      expect(closing()).not.toMatch(/TO_BE_FILLED|TODO|-----/);
    }
  });

  it("uses the booking link once it is set", () => {
    // The other direction: setting the constant must be the ONLY change
    // needed. If this ever fails, the link was set and the step did not follow.
    if (DEMO_BOOKING_URL) {
      expect(closingStep().cta?.href).toBe(DEMO_BOOKING_URL);
      expect(closingStep().cta?.label).toBeTruthy();
    }
  });
});
