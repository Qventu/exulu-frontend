import { describe, expect, it } from "vitest";

import { DAY_MS } from "./map-data";
import { sweepFrames } from "./sweep";

describe("sweepFrames", () => {
  const bounds = { from: 0, to: 10 * DAY_MS };

  it("walks the window's end from the first day to the last and ends cleared", () => {
    const frames = sweepFrames(bounds, 1000, 250);
    expect(frames[0]).toEqual({ from: 0, to: 0 });
    expect(frames[frames.length - 2]).toEqual({ from: 0, to: 10 * DAY_MS });
    expect(frames[frames.length - 1]).toBeNull();
    expect(frames).toHaveLength(6);
  });

  it("is empty when the span is a single day or the duration is zero", () => {
    expect(sweepFrames({ from: 0, to: 0 }, 1000, 250)).toEqual([]);
    expect(sweepFrames(bounds, 0, 250)).toEqual([]);
  });
});
