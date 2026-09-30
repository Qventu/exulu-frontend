import { describe, expect, it } from "vitest";
import { canForget, parseRecalledMemories } from "./recalled-memories-data";

const m = { id: "m1", contextId: "mem", title: "T", information: "F", rights_mode: "private", createdBy: { id: 4, name: "Me" }, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", source: "prefetch" };

describe("parseRecalledMemories", () => {
  it("returns the list from message metadata and [] otherwise", () => {
    expect(parseRecalledMemories({ recalledMemories: [m] })).toEqual([m]);
    expect(parseRecalledMemories({ recalledMemories: [{ id: 1 }] })).toEqual([]);
    expect(parseRecalledMemories(undefined)).toEqual([]);
    expect(parseRecalledMemories({ lastStepInputTokens: 3 })).toEqual([]);
  });
});

describe("canForget", () => {
  it("allows the creator and super admins only", () => {
    expect(canForget(m as any, 4, false)).toBe(true);
    expect(canForget(m as any, 5, false)).toBe(false);
    expect(canForget(m as any, 5, true)).toBe(true);
    expect(canForget({ ...m, createdBy: null } as any, 4, false)).toBe(false);
  });
});
