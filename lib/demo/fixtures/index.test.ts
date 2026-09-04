import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../tour";
import { DEMO_AGENT_ID, getWorld } from "./index";

describe("getWorld", () => {
  it("returns a complete world for every step of every chapter", () => {
    for (const chapter of CHAPTERS) {
      for (let step = 0; step < chapter.steps.length; step++) {
        const world = getWorld({ chapter: chapter.id, step });
        expect(world.agents.length, `${chapter.id}:${step}`).toBeGreaterThan(0);
        // struktur's whole premise is a knowledge-base list that starts EMPTY
        // and fills across the chapter — see structureWorld and the
        // "data-first chapter worlds" describe block below, which pins the
        // exact 0/3/7 progression as the intended behaviour, not a bug.
        if (chapter.id === "struktur" && step === 0) continue;
        expect(world.contexts.length, `${chapter.id}:${step}`).toBeGreaterThan(0);
      }
    }
  });

  it("is pure — repeated calls for the same position deep-equal", () => {
    const a = getWorld({ chapter: "techdoc", step: 2 });
    const b = getWorld({ chapter: "techdoc", step: 2 });
    expect(a).toEqual(b);
  });

  it("does not accumulate — reaching a step directly equals reaching it in sequence", () => {
    const direct = getWorld({ chapter: "techdoc", step: 2 });
    getWorld({ chapter: "techdoc", step: 0 });
    getWorld({ chapter: "techdoc", step: 1 });
    const sequential = getWorld({ chapter: "techdoc", step: 2 });
    expect(sequential).toEqual(direct);
  });

  it("returns callers a copy they cannot use to corrupt later reads", () => {
    const world = getWorld({ chapter: "techdoc", step: 0 });
    world.agents.pop();
    expect(getWorld({ chapter: "techdoc", step: 0 }).agents.length).toBeGreaterThan(0);
  });

  it("exposes the demo agent in every world", () => {
    const world = getWorld({ chapter: "techdoc", step: 0 });
    expect(world.agents.some((a) => a.id === DEMO_AGENT_ID)).toBe(true);
  });
});

describe("data-first chapter worlds", () => {
  // Chapter 2 animates by advancing between COMPLETE worlds, not by mutating
  // one. Each step is independently addressable from the Tour menu, so each
  // must stand on its own.
  it("fills the knowledge-base list across chapter 2's steps", () => {
    expect(getWorld({ chapter: "struktur", step: 0 }).contexts).toHaveLength(0);
    expect(getWorld({ chapter: "struktur", step: 1 }).contexts).toHaveLength(3);
    expect(getWorld({ chapter: "struktur", step: 2 }).contexts).toHaveLength(7);
  });

  it("fills the item list across chapter 3's steps", () => {
    const at = (step: number) =>
      getWorld({ chapter: "aufnahme", step }).itemsByContext?.[
        "software_documentation_context"
      ] ?? [];
    expect(at(0)).toHaveLength(0);
    expect(at(1).length).toBeGreaterThan(0);
    expect(at(1).length).toBeLessThan(at(3).length);
    // Real count, not the 18 the plan assumed: software-docs.ts holds the
    // Newlift deployment's actual nine documents (see its own docstring and
    // demo-ingestion.test.ts, which already pins 9 / 244 chunks as the real
    // invariant). Nine is what notices someone trimming the fixture, same as
    // that test's hardcoded 9.
    expect(at(3)).toHaveLength(9);
  });

  it("gives chapter 4 the document chapter 3 just ingested", () => {
    const items =
      getWorld({ chapter: "zugriff", step: 0 }).itemsByContext?.[
        "software_documentation_context"
      ] ?? [];
    expect(items.some((i) => i.id === "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c")).toBe(true);
  });

  // The invariant every world must hold: a visitor jumping straight here from
  // the Tour bubble must land in a coherent application, not a half-built one.
  it("gives every new chapter a complete world at every step", () => {
    for (const chapter of ["struktur", "aufnahme", "zugriff"] as const) {
      for (let step = 0; step < 4; step++) {
        const world = getWorld({ chapter, step });
        expect(Array.isArray(world.agents), `${chapter}.${step} agents`).toBe(true);
        expect(world.agents.length, `${chapter}.${step} agents`).toBeGreaterThan(0);
        expect(Array.isArray(world.contexts), `${chapter}.${step} contexts`).toBe(true);
        expect(Array.isArray(world.sessions), `${chapter}.${step} sessions`).toBe(true);
      }
    }
  });
});
