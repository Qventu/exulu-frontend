import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../tour";
import { DEMO_AGENT_ID, getWorld } from "./index";

describe("getWorld", () => {
  it("returns a complete world for every step of every chapter", () => {
    for (const chapter of CHAPTERS) {
      for (let step = 0; step < chapter.steps.length; step++) {
        const world = getWorld({ chapter: chapter.id, step });
        expect(world.agents.length, `${chapter.id}:${step}`).toBeGreaterThan(0);
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
