import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  deriveContextBudget,
  computeContextOccupancy,
  deriveContextState,
  getCompaction,
} from "./context-budget";

const msg = (role: "user" | "assistant", body: string, metadata?: object): UIMessage =>
  ({ id: `m_${Math.random().toString(36).slice(2)}`, role, parts: [{ type: "text", text: body }], ...(metadata ? { metadata } : {}) }) as UIMessage;

describe("deriveContextBudget", () => {
  it("matches the backend formulas for a 200K window", () => {
    const b = deriveContextBudget(200_000);
    expect(b.outputReserve).toBe(32_000);
    expect(b.usableWindow).toBe(168_000);
    expect(b.warnThreshold).toBe(134_400);
    expect(b.blockThreshold).toBe(159_600);
  });
});

describe("computeContextOccupancy", () => {
  it("anchors on the last assistant usage metadata", () => {
    const messages = [
      msg("user", "q"),
      msg("assistant", "a", { inputTokens: 50_000, outputTokens: 500, totalTokens: 50_500 }),
      msg("user", "x".repeat(4_000)),
    ];
    const occ = computeContextOccupancy(messages);
    expect(occ).toBeGreaterThan(50_500);
    expect(occ).toBeLessThan(53_000);
  });

  it("prefers a newer compaction checkpoint over stale usage", () => {
    const messages = [
      msg("assistant", "big", { inputTokens: 900_000, outputTokens: 100 }),
      msg("user", "[summary]", { compaction: { coversUpTo: "m", originalTokens: 900_000, summaryTokens: 2_000, occupancyEstimate: 9_000 } }),
    ];
    expect(computeContextOccupancy(messages)).toBe(9_000);
    expect(getCompaction(messages[1]!)).toBeDefined();
  });

  it("estimates chars/4 with no anchor", () => {
    expect(computeContextOccupancy([msg("user", "x".repeat(400))])).toBeGreaterThan(100);
  });
});

describe("deriveContextState", () => {
  const budget = deriveContextBudget(100_000); // usable 80K, warn 64K, block 76K
  it("maps occupancy to ok/warn/blocked", () => {
    expect(deriveContextState(10_000, budget, false)).toBe("ok");
    expect(deriveContextState(64_000, budget, false)).toBe("warn");
    expect(deriveContextState(76_000, budget, false)).toBe("blocked");
  });
  it("server block wins regardless of the estimate, and no budget means ok", () => {
    expect(deriveContextState(0, budget, true)).toBe("blocked");
    expect(deriveContextState(999_999, null, false)).toBe("ok");
  });
});
