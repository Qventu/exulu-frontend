import { describe, expect, it } from "vitest";

import {
  FLOOR_DECAY_DB_PER_TICK,
  INITIAL_NOISE_FLOOR_DBFS,
  MAX_CHUNK_MS,
  MIN_CHUNK_MS,
  NoiseFloorTracker,
  rmsToDbfs,
  shouldCut,
  SILENCE_DBFS,
  SILENCE_MARGIN_DB,
  SILENCE_MIN_MS,
  silenceThreshold,
} from "./cut-policy";

describe("shouldCut", () => {
  it("never cuts before MIN_CHUNK_MS, even in silence", () => {
    expect(shouldCut({ chunkElapsedMs: MIN_CHUNK_MS - 1, silentForMs: 5_000 })).toBe(false);
  });
  it("cuts at the first sufficient silence after MIN_CHUNK_MS", () => {
    expect(shouldCut({ chunkElapsedMs: MIN_CHUNK_MS, silentForMs: SILENCE_MIN_MS })).toBe(true);
    expect(shouldCut({ chunkElapsedMs: MIN_CHUNK_MS, silentForMs: SILENCE_MIN_MS - 1 })).toBe(false);
  });
  it("cuts unconditionally at MAX_CHUNK_MS", () => {
    expect(shouldCut({ chunkElapsedMs: MAX_CHUNK_MS, silentForMs: 0 })).toBe(true);
  });
  it("honours overrides", () => {
    expect(shouldCut({ chunkElapsedMs: 5_000, silentForMs: 100, minChunkMs: 4_000, silenceMinMs: 100 })).toBe(true);
  });
});

describe("rmsToDbfs", () => {
  it("maps 1.0 to 0 dBFS, 0.00316 to about -50 dBFS, and 0 to -Infinity", () => {
    expect(rmsToDbfs(1)).toBeCloseTo(0);
    expect(rmsToDbfs(0.00316)).toBeCloseTo(-50, 0);
    expect(rmsToDbfs(0)).toBe(-Infinity);
  });
});

describe("NoiseFloorTracker", () => {
  it("starts where the threshold is still the fixed SILENCE_DBFS", () => {
    const tracker = new NoiseFloorTracker();
    expect(tracker.value).toBe(INITIAL_NOISE_FLOOR_DBFS);
    expect(silenceThreshold(tracker.value)).toBe(SILENCE_DBFS);
  });

  it("follows a drop immediately (instant attack)", () => {
    const tracker = new NoiseFloorTracker(-30);
    expect(tracker.update(-72)).toBe(-72);
    expect(tracker.value).toBe(-72);
  });

  it("rises only at the decay rate, and never past the reading itself", () => {
    const tracker = new NoiseFloorTracker(-70);
    expect(tracker.update(-20)).toBeCloseTo(-70 + FLOOR_DECAY_DB_PER_TICK, 10);
    expect(tracker.update(-20)).toBeCloseTo(-70 + 2 * FLOOR_DECAY_DB_PER_TICK, 10);
    // 15 dB of climb takes ~300 ticks == ~30 s at 100 ms per tick.
    for (let i = 0; i < 298; i++) tracker.update(-20);
    expect(tracker.value).toBeCloseTo(-55, 6);

    const near = new NoiseFloorTracker(-40);
    expect(near.update(-39.99)).toBeCloseTo(-39.99, 10);
  });

  it("ignores -Infinity (digital silence is not a quieter room)", () => {
    const tracker = new NoiseFloorTracker(-45);
    expect(tracker.update(-Infinity)).toBe(-45);
    expect(tracker.update(Number.NaN)).toBe(-45);
    expect(tracker.value).toBe(-45);
  });
});

describe("silenceThreshold", () => {
  it("is the floor plus the margin, but never below the fixed floor", () => {
    expect(silenceThreshold(-34)).toBe(-34 + SILENCE_MARGIN_DB);
    expect(silenceThreshold(-80)).toBe(SILENCE_DBFS);
    expect(silenceThreshold(SILENCE_DBFS - SILENCE_MARGIN_DB)).toBe(SILENCE_DBFS);
  });
});
