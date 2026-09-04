import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentText } from "./content";
import { getWorld } from "./fixtures";
import {
  CHAPTERS,
  DEMO_BOOKING_URL,
  type DemoChapter,
  type DemoStep,
  nextPosition,
  prevPosition,
  resolveStep,
  startOfChapter,
  startPosition,
} from "./tour";

const FIXTURE: DemoChapter[] = [
  {
    id: "techdoc",
    title: "A",
    steps: [
      {
        id: "a1",
        route: "/demo/tour",
        anchor: null,
        title: "t",
        content: [{ kind: "paragraph", text: "b" }],
      },
      {
        id: "a2",
        route: "/demo/tour",
        anchor: null,
        title: "t",
        content: [{ kind: "paragraph", text: "b" }],
      },
    ],
  },
  {
    id: "ingestion",
    title: "B",
    steps: [
      {
        id: "b1",
        route: "/demo/tour",
        anchor: null,
        title: "t",
        content: [{ kind: "paragraph", text: "b" }],
      },
    ],
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
  it("tells the story data-first, chat as the payoff", () => {
    // The tour opens on the customer's mess of data (`daten`), then structures
    // it (`struktur`), ingests a document (`aufnahme`) and permissions it
    // (`zugriff`) — all BEFORE the visitor meets the chat. By the time
    // `techdoc` opens, the citation it shows is a conclusion the visitor can
    // check against what they just watched arrive, not a claim they have to
    // take on faith.
    //
    // `memory` follows `techdoc` rather than sitting after `config`, which is
    // where an earlier spec put it: a correction needs an answer to correct,
    // and sending the visitor chat → knowledge → agent editor → BACK to chat
    // read as a mistake — you think you have finished with a surface and the
    // tour drops you on it again.
    //
    // The old `ingestion` chapter (`lib/demo/chapters/ingestion.ts`) is gone;
    // `aufnahme` took over its role in the tour. The `"ingestion"` id itself
    // survives as a test-fixture position — see
    // lib/demo/fixtures/chapter-ingestion.ts — but it names no chapter here.
    //
    // `config` still carries a backward reference to the refusal shown in
    // `memory` ("Kapitel 6"); if this order changes again, that line and the
    // forward references in `struktur` ("Kapitel 7") and `aufnahme`
    // ("Kapitel 5") all point at neighbours and would need rewriting.
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      "daten",
      "struktur",
      "aufnahme",
      "zugriff",
      "techdoc",
      "memory",
      "config",
      "evals",
      "email",
      "meetings",
      "contact",
    ]);
  });

  const hasFigure = (step: DemoStep) => step.content.some((b) => b.kind === "figure");

  it("illustrates chapter openings and nothing else", () => {
    // At most one schematic per chapter — unconditional, regardless of what
    // kind of step carries it. An image on every step would compete with the
    // product screen the tour is pointing at, which is the thing the visitor
    // is meant to be looking at.
    //
    // WHERE that one figure may sit depends on the step's kind, because a
    // popover and a stage have different geometry:
    //
    // - POPOVER (kind unset or "popover") sits OVER a product screen. A
    //   figure on anything but the chapter's first step competes with the
    //   screen the tour is pointing at — the same "images compete" argument
    //   above, applied to a single step — so it must be on chapter.steps[0].
    //
    // - STAGE (kind "stage") REPLACES the product screen full-bleed. There is
    //   no product screen behind it to compete with, so the popover's
    //   opening-step constraint does not apply — a stage's figure may sit
    //   anywhere in the chapter. (daten.ts's stage figure happens to sit at
    //   step 0 too, but that is incidental, not required by this rule: it is
    //   the only stage this rule ever met before chapter 3 put one at
    //   index 2.)
    for (const chapter of CHAPTERS) {
      const illustrated = chapter.steps.filter(hasFigure);
      expect(
        illustrated.length,
        `${chapter.id} should illustrate at most one step`,
      ).toBeLessThanOrEqual(1);
      if (illustrated.length === 1) {
        const [step] = illustrated;
        if (step.kind !== "stage") {
          expect(
            hasFigure(chapter.steps[0]),
            `${chapter.id}'s schematic is on a popover (kind "${step.kind ?? "popover"}"), so the popover rule applies: it belongs on the chapter's opening step`,
          ).toBe(true);
        }
      }
    }
  });

  it("points every schematic at a file that exists", () => {
    // A typo'd path is a broken image, which the anchor tests cannot see and
    // which looks worse than no illustration at all. Scans every step, not
    // just chapter.steps[0]: a stage's figure can sit anywhere in the chapter
    // (see the rule above), so limiting this to the opening step would leave
    // a later stage figure's path unchecked — which is exactly chapter 3's
    // shape, whose figure lives at index 2.
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        for (const block of step.content) {
          if (block.kind !== "figure") continue;
          expect(
            existsSync(join(process.cwd(), "public", block.src)),
            `${chapter.id}/${step.id} references a missing asset: ${block.src}`,
          ).toBe(true);
        }
      }
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
  // Word count is measured over the prose only. A figure's alt text is for
  // screen readers, not a sighted visitor's eyes, and folding it into this
  // budget would make the cap track the schematic's accessibility label
  // rather than the copy the visitor actually reads.
  const proseOf = (step: DemoStep) =>
    contentText(step.content.filter((b) => b.kind !== "figure"));

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
    // The cap depends on the step's geometry, not a single magic number:
    //
    // - POPOVER (default, kind unset or "popover"): 45 words, roughly three
    //   lines at a 480px popover width (.shepherd-element's max-width — see
    //   shepherd-theme.css). This is the geometry the original 45 came from.
    //
    // - STAGE (kind "stage"): 90 words. A stage bypasses Shepherd entirely —
    //   full-bleed inside a max-w-3xl (768px) wrapper with its own scroll
    //   affordance, and nothing else on screen competing for attention. That
    //   is roughly double the popover's width and reading room, so roughly
    //   double the budget. It is still a real ceiling, for the same reason
    //   the popover one is: copy grows back if nothing stops it.
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const w = words(proseOf(step));
        const isStage = step.kind === "stage";
        const cap = isStage ? 90 : 45;
        const capName = isStage ? "stage" : "popover";
        expect(
          w,
          `${step.id} is ${w} words — over the ${capName} cap of ${cap}; trim it or split the step`,
        ).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("opens on something short", () => {
    // A visitor reads this before the tour has shown them anything.
    expect(words(proseOf(CHAPTERS[0].steps[0]))).toBeLessThanOrEqual(32);
  });

  // Two consecutive worlds compared for equality, ignoring `position` —
  // getWorld() stamps `{ ...clone(world), position: pos }` onto every world it
  // returns, and `pos.step` always differs between two consecutive steps, so a
  // naive deep-compare would report every pair as "changed" even when nothing
  // else about the world moved. Excluding it is what makes this a check on the
  // WORLD rather than a check that a different step number was requested.
  const worldSignature = (chapterId: DemoChapter["id"], step: number) => {
    const { position: _position, ...rest } = getWorld({ chapter: chapterId, step });
    return JSON.stringify(rest);
  };

  it("never puts two consecutive steps on the same anchor", () => {
    // A shared anchor+route used to always mean "the screen does not change
    // between them", so the tour reads as marking time and the visitor pays a
    // click for nothing. Both pairs that did this — the evals grid and the
    // routine runs — were merged; a reviewer had independently flagged the
    // first as a stall.
    //
    // The anchor was a PROXY for "nothing changed", and that proxy was sound
    // as long as every world was static and every transition was a click.
    // advanceAfterMs (shipped after this rule) created a case the proxy
    // can't see: struktur spotlights the same list across two steps on
    // purpose, because the underlying world genuinely changes (3 contexts →
    // 7 — the chapter's whole device) and the earlier step auto-advances, so
    // no click is ever paid. Both harms named above are absent there.
    //
    // So a shared anchor+route is allowed ONLY when BOTH hold: the earlier
    // step auto-advances (no click), AND the two worlds actually differ (the
    // screen isn't just marking time). A manually-advanced stall, or an
    // auto-advancing pair whose world never changes, still fails below.
    //
    // Known limit: worldSignature diffs the WHOLE world, not the slice the
    // anchor actually renders. An auto-advancing pair that shares an anchor
    // but changes only some anchor-irrelevant part of the world — leaving
    // the anchored UI itself static — would still pass here, which is the
    // same same-screen-different-metadata shape the "routine runs" stall
    // had. Necessary but not sufficient: a reviewer must separately confirm
    // the anchored content is what changed, not merely that something did.
    // There's no automated check for that because there's no anchor→field
    // map, and building one for a case that has never occurred in the tour
    // would be speculative infrastructure.
    for (const chapter of CHAPTERS) {
      for (let i = 1; i < chapter.steps.length; i++) {
        const previous = chapter.steps[i - 1];
        const current = chapter.steps[i];
        if (!current.anchor) continue;
        const sameScreen = current.anchor === previous.anchor && current.route === previous.route;
        if (!sameScreen) continue;
        const noClickPaid = previous.advanceAfterMs !== undefined;
        const worldGenuinelyChanged =
          worldSignature(chapter.id, i - 1) !== worldSignature(chapter.id, i);
        expect(
          noClickPaid && worldGenuinelyChanged,
          `${current.id} repeats ${previous.id}'s screen and anchor`,
        ).toBe(true);
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
      .steps.map((s) => contentText(s.content))
      .join(" ");

  it("tells the visitor the eval scores are not measurements", () => {
    expect(bodies("evals")).toMatch(/beispielhaft/i);
  });

  it("never states a measured eval outcome", () => {
    // The two phrasings that made invented numbers read as findings.
    expect(bodies("evals")).not.toMatch(/misses the terminology question/i);
    expect(bodies("evals")).not.toMatch(/drags the suite average/i);
  });

  it("tells the visitor the work instruction was written by hand", () => {
    expect(bodies("meetings")).toMatch(/von Hand/i);
  });
});

describe("the closing call to action", () => {
  const closingStep = () => CHAPTERS.at(-1)!.steps.at(-1)!;
  const closing = () => contentText(closingStep().content);

  it("makes the ask, in the whitepaper's own terms", () => {
    // The tour used to end on a Back button: twelve minutes of someone's
    // attention and then nothing. Whatever else changes here, the last thing
    // a visitor reads has to be an offer.
    //
    // And it has to be the SAME offer. The PDF a lead reads before arriving
    // proposes something specific — ten manuals, two weeks, their own service
    // team's questions — while the close used to invent a vaguer ask than the
    // one they had already been made.
    expect(closing()).toMatch(/Zehn Ihrer Handbücher/i);
    expect(closing()).toMatch(/zwei Wochen/i);
  });

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

describe("startPosition", () => {
  it("is the first step of the first chapter", () => {
    expect(startPosition(FIXTURE)).toEqual({ chapter: FIXTURE[0].id, step: 0 });
  });

  // The regression it exists for. components/demo/tour-provider.tsx carried a
  // literal { chapter: "techdoc", step: 0 } written before the intro chapter
  // was added, so a visitor with no ?tour= param opened on chapter 2 and never
  // saw chapter 1. Deriving the position makes that unrepresentable.
  it("tracks the real chapter list rather than a hardcoded id", () => {
    expect(startPosition().chapter).toBe(CHAPTERS[0].id);
    expect(startPosition().step).toBe(0);
  });

  it("resolves to a real step", () => {
    expect(resolveStep(CHAPTERS, startPosition())).toBeDefined();
  });
});
