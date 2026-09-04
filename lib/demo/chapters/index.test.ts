import { describe, expect, it } from "vitest";
import { contentText, isEmptyContent } from "../content";
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

  // A stage covers the viewport, so an anchor it might point at is invisible.
  // Carrying one means the step was authored as a popover and later converted.
  it("never gives a stage step an anchor", () => {
    for (const { chapter, step } of everyStep) {
      if (step.kind === "stage") {
        expect(step.anchor, `${chapter.id}/${step.id} is a stage with an anchor`).toBeNull();
      }
    }
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

  // Client confidentiality: the demo data is deliberately unattributed, and the
  // two reference customers are named ONCE, next to the closing ask. Stated in
  // prose until now — in contact.ts, the one file allowed to break the rule,
  // which is exactly where an author stands when tempted.
  it("names the reference customers only next to the ask", () => {
    for (const { chapter, step } of everyStep) {
      if (chapter.id === "contact") continue;
      expect(contentText(step.content), `${chapter.id}/${step.id}`)
        .not.toMatch(/new ?lift|algi/i);
    }
  });
});

describe("the narrative arc", () => {
  // The reorder IS the point of this plan: the visitor meets the chat only
  // after watching the knowledge that answers them get built and permissioned.
  it("tells the story data-first", () => {
    const order: string[] = CHAPTERS.map((c) => c.id);
    const before = (a: string, b: string) =>
      expect(order.indexOf(a), `${a} must precede ${b}`).toBeLessThan(order.indexOf(b));

    before("daten", "struktur");
    before("struktur", "aufnahme");
    before("aufnahme", "zugriff");
    before("zugriff", "techdoc");
    // A correction needs an answer to correct.
    before("techdoc", "memory");
    before("memory", "config");
    before("config", "contact");
  });

  it("opens on the problem, not on the product", () => {
    expect(CHAPTERS[0].id).toBe("daten");
    expect(CHAPTERS[0].steps[0].kind).toBe("stage");
  });

  // The old chapter said "Neun Kapitel" over a drawing of seven doors, a
  // mismatch the original code documented as known. Whatever the copy claims,
  // it must match the list.
  it("states the real chapter count wherever it states one", () => {
    const spelled: Record<number, string> = {
      9: "Neun", 10: "Zehn", 11: "Elf", 12: "Zwölf",
    };
    const claimed = CHAPTERS.flatMap((c) => c.steps)
      .flatMap((s) => s.content)
      .map((b) => contentText([b]))
      .filter((t) => /Kapitel/.test(t));
    for (const text of claimed) {
      for (const [count, word] of Object.entries(spelled)) {
        if (Number(count) !== CHAPTERS.length) {
          expect(text, `claims ${word} but there are ${CHAPTERS.length}`).not.toContain(
            `${word} Kapitel`,
          );
        }
      }
    }
  });

  // The spelled-count check above guards a claim that does not currently
  // exist in the copy. The failure that actually happened three times while
  // building this order was narrower and sharper: a digit-based "Kapitel N"
  // cross-reference pointing at a chapter's OLD position after a reorder
  // moved it. Nothing above catches that, because nothing above knows what a
  // reference is supposed to mean.
  //
  // Each row below names, in prose, which chapter a reference means. The
  // expected digit is computed from that chapter's live position in CHAPTERS
  // — never hardcoded — so moving the referenced chapter fails this test
  // instead of silently shipping a stale pointer to a prospect. Add a row
  // here whenever a new "Kapitel <n>" cross-reference is written.
  it("keeps digit-based chapter cross-references pointing at the truth", () => {
    const positionOf = (id: string) => {
      const index = CHAPTERS.findIndex((c) => c.id === id);
      expect(index, `no chapter with id "${id}"`).toBeGreaterThanOrEqual(0);
      return index + 1;
    };
    const textOf = (id: string) =>
      contentText(CHAPTERS.find((c) => c.id === id)!.steps.flatMap((s) => s.content));

    const crossReferences: Array<{ from: string; to: string }> = [
      // struktur explains that which knowledge bases an assistant may search
      // is a per-assistant setting — shown in config's wizard.
      { from: "struktur", to: "config" },
      // aufnahme's closing step promises that the chunks it just built are
      // what techdoc's search actually searches.
      { from: "aufnahme", to: "techdoc" },
      // config's search-behavior step calls back to the honest refusal shown
      // in memory ("Wenn er etwas nicht weiß, sagt er das").
      { from: "config", to: "memory" },
    ];

    for (const { from, to } of crossReferences) {
      const expected = `Kapitel ${positionOf(to)}`;
      expect(
        textOf(from),
        `${from}'s reference to ${to} should read "${expected}"`,
      ).toContain(expected);
    }
  });
});
