import { describe, expect, it } from "vitest";

import { MAX_CHUNK_MS, MIN_CHUNK_MS, rmsToDbfs, shouldCut, SILENCE_MIN_MS } from "./cut-policy";

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
