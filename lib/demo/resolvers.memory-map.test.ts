import { describe, expect, it } from "vitest";

import { GET_MEMORY_BASE, GET_MEMORY_ITEMS, GET_SOURCE_SESSION } from "@/app/(application)/memory/queries";
import {
  GET_CONTEXT_MAP_POINTS,
  GET_CONTEXT_MAP_TOPICS,
  GET_CONTEXT_PROJECTION_STATUS,
} from "@/lib/graphql/operations/context-map";

import { contentText } from "./content";
import {
  MEMORY_CONTEXT_ID,
  MEMORY_CONTRIBUTORS,
  MEMORY_COUNT_AFTER_CORRECTION,
  MEMORY_WRITTEN_AT_STEP,
} from "./fixtures/chapter-memory";
import { MEMORY_EXAMPLES, MEMORY_TOPICS } from "./fixtures/memory-examples";
import { runDemoQueryThroughCache as run } from "./test-support";
import { CHAPTERS } from "./tour";

const AT = { chapter: "memory", step: 4 } as const;
type Point = {
  id: string; itemId: string; x: number; y: number; z: number;
  itemName: string; group: string | null; chunks: number; createdAtMs: number | null;
};
const POINTS_VARS = { contextId: MEMORY_CONTEXT_ID, mode: "PASSAGES", groupField: "type", limit: 5000 };

describe("the memory map (chapter 6, last step)", () => {
  it("has sixty example memories over eight weeks in four topics, pseudonym-clean", () => {
    expect(MEMORY_EXAMPLES).toHaveLength(60);
    expect(MEMORY_TOPICS).toHaveLength(4);
    const days = new Set(MEMORY_EXAMPLES.map((m) => (m.createdAt as string).slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(30);
    for (const m of MEMORY_EXAMPLES) expect(m.name, m.id).not.toMatch(/FST/);
  });

  it("answers the map with one point per memory, clustered around fitted topics", async () => {
    const status = await run(GET_CONTEXT_PROJECTION_STATUS, { contextId: MEMORY_CONTEXT_ID }, AT);
    expect((status.contextProjectionStatus as { fitted: boolean }).fitted).toBe(true);
    const topics = (await run(GET_CONTEXT_MAP_TOPICS, { contextId: MEMORY_CONTEXT_ID }, AT)).contextMapTopics as { label: string; count: number }[];
    expect(topics.map((t) => t.label)).toEqual(MEMORY_TOPICS.map((t) => t.label));
    expect(topics.reduce((n, t) => n + t.count, 0)).toBe(MEMORY_COUNT_AFTER_CORRECTION);
    const points = ((await run(GET_CONTEXT_MAP_POINTS, POINTS_VARS, AT)).contextMapPoints as { points: Point[] }).points;
    expect(points).toHaveLength(MEMORY_COUNT_AFTER_CORRECTION);
    for (const p of points) {
      expect(typeof p.x + typeof p.y + typeof p.z).toBe("numbernumbernumber");
      expect(p.createdAtMs).toBeGreaterThan(0);
    }
    // Deterministic: the same world yields the same cloud.
    const again = ((await run(GET_CONTEXT_MAP_POINTS, POINTS_VARS, AT)).contextMapPoints as { points: Point[] }).points;
    expect(again.map((p) => [p.x, p.y, p.z])).toEqual(points.map((p) => [p.x, p.y, p.z]));
  });

  it("keeps the map's time axis inside the demo's shifted window, so the slider spans the eight weeks the copy names", async () => {
    // shiftDemoDates moves strings only; createdAtMs is a number and must be
    // shifted at the source (review, 2026-10-15).
    const points = ((await run(GET_CONTEXT_MAP_POINTS, POINTS_VARS, AT)).contextMapPoints as { points: Point[] }).points;
    const stamps = points.map((p) => p.createdAtMs as number);
    const week = 7 * 86_400_000;
    expect(Math.min(...stamps)).toBeGreaterThanOrEqual(Date.now() - 9 * week);
    expect(Math.max(...stamps)).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });

  it("answers the base page's own operations", async () => {
    const base = (await run(GET_MEMORY_BASE, { id: MEMORY_CONTEXT_ID }, AT)).contextById as { memoryBase: { ok: boolean } };
    expect(base.memoryBase.ok).toBe(true);
    const items = (await run(GET_MEMORY_ITEMS(MEMORY_CONTEXT_ID, true), { page: 1, limit: 50 }, AT)) as Record<string, { items: unknown[] }>;
    expect(items[`${MEMORY_CONTEXT_ID}_itemsPagination`].items.length).toBe(50);
    const session = await run(GET_SOURCE_SESSION, { id: "b6251e12-1624-4197-a9b4-0ad657bae7f1" }, AT);
    expect((session.agent_sessionById as { id: string }).id).toBeTruthy();
  });

  it("counts 64 after the correction and 63 before, with five contributors", async () => {
    expect(MEMORY_COUNT_AFTER_CORRECTION).toBe(64);
    expect(MEMORY_CONTRIBUTORS).toHaveLength(5);
    const before = (await run(GET_MEMORY_ITEMS(MEMORY_CONTEXT_ID, true), { page: 1, limit: 100 }, { chapter: "memory", step: MEMORY_WRITTEN_AT_STEP - 1 })) as Record<string, { pageInfo: { itemCount: number } }>;
    expect(before[`${MEMORY_CONTEXT_ID}_itemsPagination`].pageInfo.itemCount).toBe(63);
  });

  it("is chapter 6's last step and says the map shows example entries", () => {
    const steps = CHAPTERS.find((c) => c.id === "memory")!.steps;
    expect(steps.map((s) => s.id)).toEqual(["memory-miss", "memory-correct", "memory-write", "memory-base", "memory-map"]);
    expect(steps[4].route).toBe(`/memory/${MEMORY_CONTEXT_ID}`);
    expect(steps[4].anchor).toBe("memory-map");
    expect(contentText(steps[4].content)).toMatch(/Beispieleinträge/);
    expect(contentText(steps[3].content)).toMatch(/^64 Einträge/);
  });
});
