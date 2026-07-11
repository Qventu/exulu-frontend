import { describe, it, expect } from "vitest";
import { defaultResetDate } from "./budget";

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
