import { describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import {
  deriveContextBudget,
  computeContextOccupancy,
  deriveContextState,
  estimateMessageTokens,
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

  it("prefers lastStepInputTokens over summed inputTokens when both present (multi-step fix)", () => {
    const messages = [
      msg("assistant", "reply", {
        inputTokens: 500_000,
        outputTokens: 2_000,
        lastStepInputTokens: 50_000,
        lastStepOutputTokens: 1_000,
      }),
    ];
    const occ = computeContextOccupancy(messages);
    // Must anchor on lastStep (51_000) not summed (502_000)
    expect(occ).toBeGreaterThanOrEqual(51_000);
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

  it("returns identical results on repeated calls (memoized per message object)", () => {
    const messages = [msg("user", "q"), msg("assistant", "a".repeat(1_000))];
    const first = computeContextOccupancy(messages);
    expect(computeContextOccupancy(messages)).toBe(first);
  });
});

describe("estimateMessageTokens", () => {
  it("stringifies a message object once and serves repeats from the cache", () => {
    const message = msg("user", "hello world");
    const spy = vi.spyOn(JSON, "stringify");
    const first = estimateMessageTokens(message);
    const callsAfterFirst = spy.mock.calls.length;
    const second = estimateMessageTokens(message);
    expect(second).toBe(first);
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
    spy.mockRestore();
  });

  it("computes fresh for a new object with the same content (identity-keyed)", () => {
    const a = msg("user", "same text");
    const b = { ...a } as UIMessage;
    expect(estimateMessageTokens(a)).toBe(estimateMessageTokens(b));
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
