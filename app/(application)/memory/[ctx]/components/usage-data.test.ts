import { describe, expect, it } from "vitest";
import { unusedFilterToMode, usageEntryLabel, usageLabel, weekBars } from "./usage-data";

describe("usageLabel", () => {
  it("reports never-used and counts", () => {
    expect(usageLabel({ count: 0, lastUsedAt: null })).toEqual({ kind: "never" });
    expect(usageLabel({ count: 14, lastUsedAt: "2026-09-30T08:00:00.000Z" })).toEqual({ kind: "used", count: 14, lastUsedAt: "2026-09-30T08:00:00.000Z" });
    expect(usageLabel(undefined)).toEqual({ kind: "never" });
  });
});

describe("unusedFilterToMode", () => {
  it("maps the filter value to the query mode or null", () => {
    expect(unusedFilterToMode("never")).toBe("NEVER");
    expect(unusedFilterToMode("stale")).toBe("STALE");
    expect(unusedFilterToMode(undefined)).toBeNull();
    expect(unusedFilterToMode("")).toBeNull();
  });
});

describe("weekBars", () => {
  it("normalises heights to the max and labels by week start, flat bars when everything is zero", () => {
    expect(weekBars([{ weekStart: "2026-09-21", count: 2 }, { weekStart: "2026-09-28", count: 4 }])).toEqual([
      { weekStart: "2026-09-21", count: 2, height: 50, label: "21.09." },
      { weekStart: "2026-09-28", count: 4, height: 100, label: "28.09." },
    ]);
    expect(weekBars([{ weekStart: "2026-09-28", count: 0 }])[0].height).toBe(0);
  });
});

describe("usageEntryLabel", () => {
  it("joins agent and user, falls back to Guest and unknown", () => {
    expect(usageEntryLabel({ agent: { id: "a", name: "Newton" }, user: { id: 4, name: "Daniel C." } }, "Guest", "Unknown")).toBe("Newton · Daniel C.");
    expect(usageEntryLabel({ agent: null, user: null }, "Guest", "Unknown")).toBe("Unknown · Guest");
  });
});
