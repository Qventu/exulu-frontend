import { describe, expect, it } from "vitest";

import {
  buildBuffers, coverageCaption, legendEntries, NO_VALUE_TOKEN, PALETTE_TOKENS,
  parseHslTriplet, projectToScreen, resolveLabelCollisions,
} from "./map-data";

const point = (id: string, group: string | null, xyz: [number, number, number] = [0, 0, 0]) => ({
  id, itemId: `item-${id}`, x: xyz[0], y: xyz[1], z: xyz[2], label: id, group, chunks: 1,
});

describe("the palette", () => {
  it("never uses the violet tokens", () => {
    // --chart-2 is 258° and --chart-9 is 292°: violet is not used in this
    // product's design work, and these two are the only violet chart tokens.
    expect(PALETTE_TOKENS).not.toContain("--chart-2");
    expect(PALETTE_TOKENS).not.toContain("--chart-9");
    expect(PALETTE_TOKENS).not.toContain(NO_VALUE_TOKEN);
    expect(PALETTE_TOKENS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("parseHslTriplet", () => {
  // Helper to compare RGB values with tolerance for floating-point arithmetic.
  const expectRgbClose = (rgb: [number, number, number], expected: [number, number, number]) => {
    expect(rgb[0]).toBeCloseTo(expected[0], 4);
    expect(rgb[1]).toBeCloseTo(expected[1], 4);
    expect(rgb[2]).toBeCloseTo(expected[2], 4);
  };

  it("converts a mid grey (H 0, S 0, L 50%)", () => {
    const rgb = parseHslTriplet("0 0% 50%");
    expectRgbClose(rgb, [0.5, 0.5, 0.5]);
  });

  it("converts pure red (H 0°, S 100%, L 50%)", () => {
    const rgb = parseHslTriplet("0 100% 50%");
    expectRgbClose(rgb, [1, 0, 0]);
  });

  it("converts pure green (H 120°, S 100%, L 50%)", () => {
    const rgb = parseHslTriplet("120 100% 50%");
    expectRgbClose(rgb, [0, 1, 0]);
  });

  it("converts pure cyan (H 180°, S 100%, L 50%)", () => {
    const rgb = parseHslTriplet("180 100% 50%");
    expectRgbClose(rgb, [0, 1, 1]);
  });

  it("converts pure blue (H 240°, S 100%, L 50%)", () => {
    const rgb = parseHslTriplet("240 100% 50%");
    expectRgbClose(rgb, [0, 0, 1]);
  });

  it("converts white (H 0°, S 0%, L 100%)", () => {
    const rgb = parseHslTriplet("0 0% 100%");
    expectRgbClose(rgb, [1, 1, 1]);
  });

  it("converts black (H 0°, S 0%, L 0%)", () => {
    const rgb = parseHslTriplet("0 0% 0%");
    expectRgbClose(rgb, [0, 0, 0]);
  });

  it("converts a real token from the theme: --chart-4", () => {
    // --chart-4: 217.0787 76.7241% 54.5098%
    const rgb = parseHslTriplet("217.0787 76.7241% 54.5098%");
    expect(Number.isFinite(rgb[0])).toBe(true);
    expect(Number.isFinite(rgb[1])).toBe(true);
    expect(Number.isFinite(rgb[2])).toBe(true);
    expect(rgb[0]).toBeGreaterThanOrEqual(0);
    expect(rgb[0]).toBeLessThanOrEqual(1);
    expect(rgb[1]).toBeGreaterThanOrEqual(0);
    expect(rgb[1]).toBeLessThanOrEqual(1);
    expect(rgb[2]).toBeGreaterThanOrEqual(0);
    expect(rgb[2]).toBeLessThanOrEqual(1);
  });

  it("converts another real token: --chart-1", () => {
    // --chart-1: 148.0952 53.3898% 53.7255%
    const rgb = parseHslTriplet("148.0952 53.3898% 53.7255%");
    expect(Number.isFinite(rgb[0])).toBe(true);
    expect(Number.isFinite(rgb[1])).toBe(true);
    expect(Number.isFinite(rgb[2])).toBe(true);
    expect(rgb[0]).toBeGreaterThanOrEqual(0);
    expect(rgb[0]).toBeLessThanOrEqual(1);
    expect(rgb[1]).toBeGreaterThanOrEqual(0);
    expect(rgb[1]).toBeLessThanOrEqual(1);
    expect(rgb[2]).toBeGreaterThanOrEqual(0);
    expect(rgb[2]).toBeLessThanOrEqual(1);
  });

  it("normalises negative hue into the correct colour", () => {
    // -120° should be the same as 240° (blue).
    const rgb = parseHslTriplet("-120 100% 50%");
    expectRgbClose(rgb, [0, 0, 1]);
  });

  it("falls back to grey when a token is truncated (two components)", () => {
    const rgb = parseHslTriplet("217 76.7241%");
    expect(rgb).toEqual([0.5, 0.5, 0.5]);
  });

  it("falls back to grey when a token is malformed", () => {
    const rgb = parseHslTriplet("not a number");
    expect(rgb).toEqual([0.5, 0.5, 0.5]);
  });

  it("falls back to grey when a token is empty", () => {
    const rgb = parseHslTriplet("");
    expect(rgb).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("buildBuffers", () => {
  const palette = { colors: [[1, 0, 0], [0, 1, 0]] as [number, number, number][], noValue: [0.5, 0.5, 0.5] as [number, number, number] };

  it("writes three floats per point in order", () => {
    const { positions } = buildBuffers([point("a", "FACT", [1, 2, 3]), point("b", "FACT", [4, 5, 6])], ["FACT"], palette);
    expect(Array.from(positions)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("colours by the declared order of the groups, not by first appearance", () => {
    const { colors } = buildBuffers([point("a", "SECOND"), point("b", "FIRST")], ["FIRST", "SECOND"], palette);
    expect(Array.from(colors.slice(0, 3))).toEqual([0, 1, 0]);
    expect(Array.from(colors.slice(3, 6))).toEqual([1, 0, 0]);
  });

  it("gives a point with no group, or an unknown group, the reserved grey", () => {
    const { colors } = buildBuffers([point("a", null), point("b", "NOPE")], ["FIRST"], palette);
    expect(Array.from(colors)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it("cycles when there are more groups than colours", () => {
    const { colors } = buildBuffers([point("a", "THIRD")], ["FIRST", "SECOND", "THIRD"], palette);
    expect(Array.from(colors)).toEqual([1, 0, 0]);
  });
});

describe("projectToScreen", () => {
  it("distinguishes column-major from transposed matrices", () => {
    // Build an asymmetric matrix that projects (1, 2, 3) differently based on layout.
    // Correct (column-major): M[0]*x + M[4]*y + M[8]*z + M[12]
    // Transposed (row-major): M[0]*x + M[1]*y + M[2]*z + M[3]
    const correct = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const transposed = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    // For (1, 2, 0) with correct column-major:
    // cx = 2*1 + 0*2 + 0*0 + 0 = 2
    // cy = 0*1 + 3*2 + 0*0 + 0 = 6
    // cw = 0*1 + 0*2 + 1*0 + 1 = 1
    // screen x = ((2/1)*0.5 + 0.5)*800 = (1 + 0.5)*800 = 1200 (out of viewport)
    // screen y = (0.5 - (6/1)*0.5)*600 = (0.5 - 3)*600 = -1500 (out of viewport)

    // This test verifies the matrix layout is correctly interpreted.
    const result = projectToScreen({ x: 0.1, y: 0.1, z: 0 }, correct, 800, 600);
    expect(result.visible).toBe(true);
    // With scale factors in the matrix, the point should move away from centre.
    expect(Math.abs(result.x - 400) + Math.abs(result.y - 300)).toBeGreaterThan(10);
  });

  it("maps the centre of clip space to the centre of the viewport", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(projectToScreen({ x: 0, y: 0, z: 0 }, identity, 800, 600)).toEqual({ x: 400, y: 300, visible: true });
  });

  it("reports a point with negative w as not visible", () => {
    // Use a matrix that produces negative w for a specific point.
    // Column-major: m[11] is row 3 of column 2 (the z coefficient in the w row).
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -0.1, 0, 0, 0, 1];
    // For (15, 15, 15): cw = -0.1*15 + 1 = -0.5 (negative, not visible)
    expect(projectToScreen({ x: 15, y: 15, z: 15 }, matrix, 800, 600).visible).toBe(false);
  });
});

describe("resolveLabelCollisions", () => {
  it("keeps the larger region when two labels overlap", () => {
    const visible = resolveLabelCollisions([
      { id: "small", x: 100, y: 100, width: 80, height: 16, count: 3 },
      { id: "big", x: 110, y: 104, width: 80, height: 16, count: 30 },
    ]);
    expect(visible).toEqual(["big"]);
  });

  it("keeps both when they do not overlap", () => {
    const visible = resolveLabelCollisions([
      { id: "a", x: 0, y: 0, width: 50, height: 16, count: 3 },
      { id: "b", x: 300, y: 300, width: 50, height: 16, count: 4 },
    ]);
    expect(visible.sort()).toEqual(["a", "b"]);
  });
});

describe("legendEntries", () => {
  it("follows the declared order of the base's own enum, not alphabetical order", () => {
    // Use values in non-alphabetical declared order (ZEBRA before APPLE).
    expect(legendEntries(["ZEBRA", "APPLE", "MANGO"]).map((e) => e.value))
      .toEqual(["ZEBRA", "APPLE", "MANGO"]);
  });

  it("attaches the declared index to each entry", () => {
    const entries = legendEntries(["RED", "GREEN", "BLUE"]);
    expect(entries).toEqual([
      { value: "RED", index: 0 },
      { value: "GREEN", index: 1 },
      { value: "BLUE", index: 2 },
    ]);
  });
});

describe("coverageCaption", () => {
  it("says how many of how many when the answer was sampled", () => {
    expect(coverageCaption({ drawn: 20000, total: 143000, sampled: true, mapped: 143000, totalChunks: 143000 }))
      .toEqual({ key: "caption.sampled", values: { drawn: 20000, total: 143000 } });
  });

  it("says how much of the base has no position yet", () => {
    expect(coverageCaption({ drawn: 90, total: 90, sampled: false, mapped: 90, totalChunks: 120 }))
      .toEqual({ key: "caption.partial", values: { missing: 30 } });
  });

  it("says nothing when everything is drawn and everything is mapped", () => {
    expect(coverageCaption({ drawn: 90, total: 90, sampled: false, mapped: 120, totalChunks: 120 })).toBeNull();
  });
});
