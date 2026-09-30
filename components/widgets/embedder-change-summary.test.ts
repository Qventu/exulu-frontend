import { describe, expect, it } from "vitest";

import { summariseEmbedderChange } from "./embedder-change-summary";

const base = {
  nextModel: "m",
  nextDimensionality: 1024,
  currentDimensionality: 1024,
  chunkCount: 500,
  queue: "embeddings",
};

describe("summariseEmbedderChange", () => {
  it("creates when nothing exists yet", () => {
    expect(
      summariseEmbedderChange({ ...base, currentDimensionality: null, chunkCount: 0 }).action,
    ).toBe("create");
  });

  it("truncates at the same dimensionality", () => {
    expect(summariseEmbedderChange(base).action).toBe("truncate");
  });

  it("recreates at a different dimensionality", () => {
    expect(summariseEmbedderChange({ ...base, nextDimensionality: 3072 }).action).toBe("recreate");
  });

  it("always reports how many chunks are destroyed", () => {
    // The number is the whole point of the warning.
    expect(summariseEmbedderChange(base).chunksDeleted).toBe(500);
  });

  it("warns about inline embedding only when no queue is chosen", () => {
    expect(summariseEmbedderChange({ ...base, queue: null }).willRunInline).toBe(true);
    expect(summariseEmbedderChange(base).willRunInline).toBe(false);
  });

  it("treats clearing as its own action", () => {
    const summary = summariseEmbedderChange({ ...base, nextModel: null });
    expect(summary.action).toBe("cleared");
    expect(summary.chunksDeleted).toBe(500);
  });
});
