import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBudgetDetailLines,
  defaultResetDate,
  hasCappedBudget,
  type BudgetInfo,
} from "./budget";

// 2026-07-10 is a Friday.
const FRI = new Date("2026-07-10T12:00:00.000Z");

describe("defaultResetDate", () => {
  it("daily → next UTC midnight", () => {
    expect(defaultResetDate("1d", FRI).toISOString()).toBe("2026-07-11T00:00:00.000Z");
  });
  it("weekly → next Monday UTC midnight", () => {
    expect(defaultResetDate("7d", FRI).toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });
  it("monthly → 1st of next month UTC midnight", () => {
    expect(defaultResetDate("30d", FRI).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
  it("weekly on a Monday jumps a full week", () => {
    const mon = new Date("2026-07-13T09:00:00.000Z");
    expect(defaultResetDate("7d", mon).toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });
});

describe("hasCappedBudget", () => {
  it("false for null / missing / zero / negative caps", () => {
    expect(hasCappedBudget(null)).toBe(false);
    expect(hasCappedBudget(undefined)).toBe(false);
    expect(hasCappedBudget({ spend: 1, max_budget: null, budget_duration: null, budget_reset_at: null })).toBe(false);
    expect(hasCappedBudget({ spend: 1, max_budget: 0, budget_duration: null, budget_reset_at: null })).toBe(false);
  });
  it("true for a positive cap", () => {
    expect(hasCappedBudget({ spend: 1, max_budget: 50, budget_duration: null, budget_reset_at: null })).toBe(true);
  });
});

describe("buildBudgetDetailLines", () => {
  // Fixed clock: 18 days into the 30d window ending 2026-08-01, so the linear
  // projection is spend * 30/18 (12.5 → $20.83 / 41.67% → rounds to 42%).
  const BASE: BudgetInfo = {
    spend: 12.5,
    max_budget: 50,
    budget_duration: "30d",
    budget_reset_at: "2026-08-01T00:00:00.000Z",
  };
  const resetDateLabel = new Date("2026-08-01T00:00:00.000Z").toLocaleDateString();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("amount mode: USD headline, remaining, projection, reset date", () => {
    expect(buildBudgetDetailLines(BASE)).toEqual([
      { key: "bar.usedOfMax", values: { spend: "$12.50", max: "$50" }, emphasis: true },
      { key: "bar.remainingDuration", values: { remaining: "$37.50", duration: "Monthly" } },
      { key: "bar.projected", values: { amount: "$20.83" } },
      { key: "bar.resetsOn", values: { date: resetDateLabel }, tone: "muted" },
    ]);
  });

  it("percent mode: percent-only lines", () => {
    expect(buildBudgetDetailLines({ ...BASE, display: "percent" })).toEqual([
      { key: "bar.percentUsed", values: { percent: 25 }, emphasis: true },
      { key: "bar.percentRemainingDuration", values: { percent: 75, duration: "Monthly" } },
      { key: "bar.projectedPercent", values: { percent: 42 } },
      { key: "bar.resetsOn", values: { date: resetDateLabel }, tone: "muted" },
    ]);
  });

  it("percent mode never emits a dollar sign anywhere", () => {
    const serialized = JSON.stringify(buildBudgetDetailLines({ ...BASE, display: "percent" }));
    expect(serialized).not.toMatch(/\$/);
  });

  it("over-pace flips the projection key and tone in both modes", () => {
    const hot = { ...BASE, spend: 45 }; // projected 45*30/18 = $75 → 150%
    expect(buildBudgetDetailLines(hot)[2]).toEqual({
      key: "bar.projectedOverPace",
      values: { amount: "$75" },
      tone: "warn",
    });
    expect(buildBudgetDetailLines({ ...hot, display: "percent" })[2]).toEqual({
      key: "bar.projectedPercentOverPace",
      values: { percent: 150 },
      tone: "warn",
    });
  });

  it("omits projection and reset lines when they cannot be computed", () => {
    const lines = buildBudgetDetailLines({
      spend: 10,
      max_budget: 50,
      budget_duration: null,
      budget_reset_at: null,
    });
    expect(lines.map((l) => l.key)).toEqual(["bar.usedOfMax", "bar.remainingDuration"]);
  });
});
