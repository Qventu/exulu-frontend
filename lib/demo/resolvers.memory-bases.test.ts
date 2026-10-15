import { describe, expect, it } from "vitest";

import { GET_MEMORY_BASES } from "@/app/(application)/memory/queries";

import { contentText } from "./content";
import { DEMO_AGENT_ID } from "./fixtures";
import {
  MEMORY_CONTEXT_ID,
  MEMORY_CONTRIBUTORS,
  MEMORY_COUNT_AFTER_CORRECTION,
  MEMORY_WRITTEN_AT_STEP,
} from "./fixtures/chapter-memory";
import { runDemoQueryThroughCache as run } from "./test-support";
import { CHAPTERS } from "./tour";

type Base = {
  id: string;
  name: string;
  agents: { id: string }[];
  stats: { total: number; contributors: number; lastSavedAt: string | null };
};

describe("the memory overview (chapter 6, last step)", () => {
  it("lists the assistant's memory base with every field the overview selects", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "memory", step: 3 });
    const bases = data.memoryBases as Base[];
    expect(bases).toHaveLength(1);
    expect(bases[0].id).toBe(MEMORY_CONTEXT_ID);
    expect(bases[0].name).toBe("Assistenten-Gedächtnis");
    expect(bases[0].agents.map((a) => a.id)).toEqual([DEMO_AGENT_ID]);
    expect(bases[0].stats.total).toBe(MEMORY_COUNT_AFTER_CORRECTION);
    expect(bases[0].stats.contributors).toBe(MEMORY_CONTRIBUTORS.length);
    expect(bases[0].stats.lastSavedAt).toBeTruthy();
  });

  it("counts one memory fewer before the correction is written", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "memory", step: MEMORY_WRITTEN_AT_STEP - 1 });
    expect((data.memoryBases as Base[])[0].stats.total).toBe(MEMORY_COUNT_AFTER_CORRECTION - 1);
  });

  it("answers in a world that is not chapter 6's (the sidebar entry is one click away anywhere)", async () => {
    const data = await run(GET_MEMORY_BASES, {}, { chapter: "techdoc", step: 0 });
    const bases = data.memoryBases as Base[];
    expect(bases).toHaveLength(1);
    expect(bases[0].stats.total).toBeGreaterThanOrEqual(0);
  });

  it("is what the chapter's base step opens, and the copy counts the same memories", () => {
    const steps = CHAPTERS.find((c) => c.id === "memory")!.steps;
    // The base row comes before the map (sub-project 8): the fourth step.
    const last = steps[3];
    expect(last.id).toBe("memory-base");
    expect(last.route).toBe("/memory");
    expect(last.anchor).toBe("memory-bases");
    expect(contentText(last.content)).toMatch(/^64 Einträge/);
  });
});
