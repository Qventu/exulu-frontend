import { describe, expect, it } from "vitest";

import { DEMO_EPOCH, demoDateOffsetMs, shiftDemoDates, shiftTimestamp } from "./date-shift";

const DAY = 86_400_000;
const offset = 30 * DAY;

describe("shiftTimestamp", () => {
  it("shifts the three formats the fixtures use", () => {
    expect(shiftTimestamp("2026-05-12T22:35:14.453Z", offset)).toBe("2026-06-11T22:35:14.453Z");
    expect(shiftTimestamp("2026-01-06T08:26:08.91686+00:00", offset)).toBe("2026-02-05T08:26:08.916Z");
    expect(shiftTimestamp("2026-07-17 09:07:59.013+00", offset)).toBe("2026-08-16T09:07:59.013Z");
  });

  it("leaves the epoch sentinel and wall-clock timestamps alone", () => {
    expect(shiftTimestamp("1970-01-01T00:00:00.000Z", offset)).toBe("1970-01-01T00:00:00.000Z");
    // chapter-memory.ts writes the correction with new Date(): already "now".
    const recent = new Date(Date.parse(DEMO_EPOCH) + 3 * DAY).toISOString();
    expect(shiftTimestamp(recent, offset)).toBe(recent);
  });

  it("leaves strings that merely look like dates", () => {
    for (const s of ["2026-09", "FST-2XT", "2026-08-14", "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c", ""]) {
      expect(shiftTimestamp(s, offset)).toBe(s);
    }
  });

  it("preserves order", () => {
    const a = shiftTimestamp("2026-08-14 09:22:37.236705+00", offset);
    const b = shiftTimestamp("2026-08-26T09:31:24.579Z", offset);
    expect(Date.parse(a)).toBeLessThan(Date.parse(b));
  });
});

describe("shiftDemoDates", () => {
  it("walks arrays and objects and returns the same shape", () => {
    const input = { items: [{ createdAt: "2026-07-17 09:07:59.013+00", title: "x", n: 3, nested: { at: "2026-05-12T22:35:14.453Z" } }], nothing: null };
    const out = shiftDemoDates(input, offset);
    expect(out.items[0].createdAt).toBe("2026-08-16T09:07:59.013Z");
    expect(out.items[0].nested.at).toBe("2026-06-11T22:35:14.453Z");
    expect(out.items[0].title).toBe("x");
    expect(out.items[0].n).toBe(3);
    expect(out.nothing).toBeNull();
  });
});

describe("demoDateOffsetMs", () => {
  it("is the distance from the fixture capture day to now", () => {
    expect(demoDateOffsetMs(Date.parse(DEMO_EPOCH) + 10 * DAY)).toBe(10 * DAY);
  });
});

describe("shiftTimestamp never lands in the future", () => {
  it("clamps a capture-day timestamp later than now's time of day to just before now", () => {
    // The transcripts list read "in 23 Std." for recordings made a few hours
    // after the 09:00 epoch: offset = now − epoch, so anything stamped after
    // the epoch shifted to after now.
    const now = Date.parse(DEMO_EPOCH) + 30 * DAY;
    const afterEpoch = new Date(Date.parse(DEMO_EPOCH) + 5 * 3_600_000).toISOString();
    const shifted = Date.parse(shiftTimestamp(afterEpoch, demoDateOffsetMs(now)));
    expect(shifted).toBeLessThan(now);
    expect(now - shifted).toBeLessThanOrEqual(60_000);
  });

  it("leaves an earlier timestamp exactly shifted", () => {
    const now = Date.parse(DEMO_EPOCH) + 30 * DAY;
    expect(shiftTimestamp("2026-08-20T10:00:00.000Z", demoDateOffsetMs(now))).toBe("2026-09-19T10:00:00.000Z");
  });
});
