import { describe, expect, it } from "vitest";
import { baseState, baseSubtitle, filterBases, overviewTotals, type MemoryBase } from "./memory-bases-data";

const stats = (total: number, contributors: number) => ({ total, public: total, private: 0, contributors, visible: total, lastSavedAt: null, lastSavedBy: null });
const base = (p: Partial<MemoryBase>): MemoryBase => ({ id: "x", name: "X", description: null, valid: true, missing: [], missingFromCode: false, agents: [], stats: stats(0, 0), ...p });
const alpha = base({ id: "a", name: "Alpha", agents: [{ id: "1", name: "Alfredinio" }, { id: "2", name: "Bot" }], stats: stats(47, 9) });
const beta = base({ id: "b", name: "Beta", description: "  Second base ", stats: stats(3, 1) });
const docs = base({ id: "docs", name: "Docs", valid: false, missing: ["type"], agents: [{ id: "3", name: "Docs-Bot" }], stats: stats(3, 1) });
const gone = base({ id: "gone", name: "gone", valid: false, missingFromCode: true, agents: [{ id: "1", name: "Alfredinio" }], stats: null });

describe("baseState", () => {
  it("ranks missing-from-code over invalid over usage", () => {
    expect([alpha, beta, docs, gone].map(baseState)).toEqual(["inUse", "unused", "invalid", "missingFromCode"]);
  });
});

describe("filterBases", () => {
  it("matches base and agent names case-insensitively", () => {
    expect(filterBases([alpha, beta], "BOT", "all").map((b) => b.id)).toEqual(["a"]);
    expect(filterBases([alpha, beta], "  ", "all").map((b) => b.id)).toEqual(["a", "b"]);
  });
  it("in use = has agents; unused = valid without agents", () => {
    expect(filterBases([alpha, beta, docs, gone], "", "inUse").map((b) => b.id)).toEqual(["a", "docs", "gone"]);
    expect(filterBases([alpha, beta, docs, gone], "", "unused").map((b) => b.id)).toEqual(["b"]);
  });
});

describe("overviewTotals", () => {
  it("counts valid bases, distinct agents, and sums totals over every listed base", () => {
    expect(overviewTotals([alpha, beta, docs, gone], 12)).toEqual({ bases: 2, agentsWithMemory: 3, agentCount: 12, memories: 53, contributors: 11 });
  });
});

describe("baseSubtitle", () => {
  it("prefers the trimmed description, then the single agent, then nothing", () => {
    expect(baseSubtitle(beta)).toEqual({ kind: "description", text: "Second base" });
    expect(baseSubtitle(docs)).toEqual({ kind: "createdWith", agent: "Docs-Bot" });
    expect(baseSubtitle(alpha)).toEqual({ kind: "none" });
  });
});
