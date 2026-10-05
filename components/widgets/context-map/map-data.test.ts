import { describe, expect, it } from "vitest";

import {
  buildBuffers, coverageCaption, isPassageClipped, legendEntries,
  nearestNeighbourSegments, NO_VALUE_TOKEN, PALETTE_TOKENS, PASSAGE_LABEL_LIMIT,
  parseHslTriplet, projectToScreen, resolveLabelCollisions, topicOf,
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

  it("converts a mid grey (H 0, S 0, L 45%)", () => {
    const rgb = parseHslTriplet("0 0% 45%");
    expectRgbClose(rgb, [0.45, 0.45, 0.45]);
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
    expectRgbClose(rgb, [0.196079, 0.462745, 0.894117]);
  });

  it("converts another real token: --chart-1", () => {
    // --chart-1: 148.0952 53.3898% 53.7255%
    const rgb = parseHslTriplet("148.0952 53.3898% 53.7255%");
    expectRgbClose(rgb, [0.290196, 0.784314, 0.521568]);
  });

  it("normalises negative hue into the correct colour", () => {
    // -120° should be the same as 240° (blue).
    const rgb = parseHslTriplet("-120 100% 50%");
    expectRgbClose(rgb, [0, 0, 1]);
  });

  it("normalises hue above 360 into the correct colour", () => {
    // 480° should be the same as 120° (green).
    const rgb = parseHslTriplet("480 100% 50%");
    expectRgbClose(rgb, [0, 1, 0]);
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
  it("projects correctly with a realistic perspective matrix", () => {
    // Perspective matrix: 50° FOV, 4:3 aspect, near 0.01, far 100, camera back 3.2.
    // This matrix distinguishes column-major from transposed and from vertical-flip errors.
    const matrix = [
      1.60838, 0, 0, 0,
      0, 2.144507, 0, 0,
      0, 0, -1.0002, -1,
      0, 0, 3.180638, 3.2,
    ];

    const result = projectToScreen({ x: 0.5, y: 0.25, z: 0.75 }, matrix, 800, 600);
    expect(result.visible).toBe(true);
    // Correct answer (column-major with vertical flip): (531.296, 234.352)
    // Transposed read gives: (457.591, 271.204)
    // Missing vertical flip gives: (531.296, 365.648)
    // This single assertion catches all three wrong implementations at once.
    expect(result.x).toBeCloseTo(531.296, 1);
    expect(result.y).toBeCloseTo(234.352, 1);
  });

  it("reports a point behind the camera as not visible", () => {
    // Same realistic matrix, depth 4 puts homogeneous coordinate at about -0.8.
    const matrix = [
      1.60838, 0, 0, 0,
      0, 2.144507, 0, 0,
      0, 0, -1.0002, -1,
      0, 0, 3.180638, 3.2,
    ];

    // A transposed read would report this visible at roughly (420.2, 289.9), so this is a real check.
    const result = projectToScreen({ x: 0, y: 0, z: 4 }, matrix, 800, 600);
    expect(result.visible).toBe(false);
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

  it("keeps both when they do not overlap, ordered by size (largest first)", () => {
    const visible = resolveLabelCollisions([
      { id: "a", x: 0, y: 0, width: 50, height: 16, count: 3 },
      { id: "b", x: 300, y: 300, width: 50, height: 16, count: 4 },
    ]);
    // Output is ordered by count descending (b has count 4, a has count 3), not input order.
    expect(visible).toEqual(["b", "a"]);
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

describe("nearestNeighbourSegments", () => {
  /** Reads the buffer back as pairs of endpoints. */
  const segments = (buffer: Float32Array) => {
    expect(buffer.length % 6).toBe(0);
    const out: [number[], number[]][] = [];
    for (let i = 0; i < buffer.length; i += 6) {
      out.push([
        [buffer[i]!, buffer[i + 1]!, buffer[i + 2]!],
        [buffer[i + 3]!, buffer[i + 4]!, buffer[i + 5]!],
      ]);
    }
    return out;
  };

  it("draws nothing when there is nobody to draw to", () => {
    expect(nearestNeighbourSegments([]).length).toBe(0);
    expect(nearestNeighbourSegments([point("a", null, [0, 0, 0])]).length).toBe(0);
  });

  it("joins a pair once, not once from each end", () => {
    const buffer = nearestNeighbourSegments([
      point("a", null, [0, 0, 0]),
      point("b", null, [1, 0, 0]),
    ]);
    expect(segments(buffer)).toEqual([[[0, 0, 0], [1, 0, 0]]]);
  });

  it("keeps the segment of a passage whose nearest neighbour prefers someone else", () => {
    // a-b are mutually nearest; c's nearest is b, but b's is a, so c's segment
    // is not a duplicate of anything and must survive.
    const buffer = nearestNeighbourSegments([
      point("a", null, [0, 0, 0]),
      point("b", null, [1, 0, 0]),
      point("c", null, [2.5, 0, 0]),
    ]);
    expect(segments(buffer)).toEqual([
      [[0, 0, 0], [1, 0, 0]],
      [[2.5, 0, 0], [1, 0, 0]],
    ]);
  });

  it("leaves out a passage whose stored coordinates are not finite", () => {
    // Flooring a NaN survives both clamps and the range guards, so bucketing
    // such a point used to hand the cell walk an index in no bucket at all.
    const buffer = nearestNeighbourSegments([
      point("a", null, [0, 0, 0]),
      point("b", null, [1, 0, 0]),
      point("nan", null, [Number.NaN, 0, 0]),
      point("inf", null, [0, Infinity, 0]),
    ]);
    expect(segments(buffer)).toEqual([[[0, 0, 0], [1, 0, 0]]]);
  });

  it("draws nothing at all when no coordinate is finite", () => {
    expect(nearestNeighbourSegments([
      point("a", null, [Number.NaN, Number.NaN, Number.NaN]),
      point("b", null, [Infinity, 0, 0]),
    ]).length).toBe(0);
  });

  it("finds the true nearest neighbour across a grid of cells", () => {
    // A 4x4x2 lattice of unit spacing: every passage has a neighbour at
    // distance 1, and the grid search must not settle for one further away.
    const lattice: ReturnType<typeof point>[] = [];
    for (let x = 0; x < 4; x += 1) {
      for (let y = 0; y < 4; y += 1) {
        for (let z = 0; z < 2; z += 1) {
          lattice.push(point(`${x}-${y}-${z}`, null, [x, y, z]));
        }
      }
    }
    const drawn = segments(nearestNeighbourSegments(lattice));
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThanOrEqual(lattice.length);
    for (const [from, to] of drawn) {
      const distance = Math.hypot(from[0]! - to[0]!, from[1]! - to[1]!, from[2]! - to[2]!);
      expect(distance).toBeCloseTo(1, 6);
    }
    // Every passage is an endpoint of something: nothing was silently dropped.
    const seen = new Set(drawn.flatMap(([from, to]) => [from.join(), to.join()]));
    for (const p of lattice) expect(seen.has([p.x, p.y, p.z].join())).toBe(true);
  });
});

describe("isPassageClipped", () => {
  it("knows the width the points answer actually carries", () => {
    // The resolver builds a point's label as
    // LEFT(COALESCE(chunks.content, items.name), 120); if that width changes,
    // this constant has to change with it or the panel stops saying "cut".
    expect(PASSAGE_LABEL_LIMIT).toBe(120);
  });

  it("calls a passage at the limit cut", () => {
    expect(isPassageClipped("x".repeat(PASSAGE_LABEL_LIMIT))).toBe(true);
  });

  it("leaves a passage that fits alone", () => {
    expect(isPassageClipped("x".repeat(PASSAGE_LABEL_LIMIT - 1))).toBe(false);
    expect(isPassageClipped("")).toBe(false);
  });
});

describe("topicOf", () => {
  const topic = (id: string, xyz: [number, number, number], count = 1) => ({
    id, label: `Topic ${id}`, count, x: xyz[0], y: xyz[1], z: xyz[2],
  });

  it("names the nearest region, not the first one declared", () => {
    // A passage carries no record of its region: membership is "nearest
    // centre", because that is what the clustering's final assignment is.
    expect(topicOf(point("p", null, [9, 0, 0]), [
      topic("0", [0, 0, 0]),
      topic("1", [10, 0, 0]),
    ])).toBe("1");
  });

  it("measures the distance in all three dimensions", () => {
    // Region 1 is nearest on x alone and far away in y and z: an answer of
    // "1" would mean only one axis was compared.
    expect(topicOf(point("p", null, [0.9, 0, 0]), [
      topic("0", [0, 0, 0]),
      topic("1", [1, 9, 9]),
    ])).toBe("0");
  });

  it("has no region to name when the base was fitted before regions existed", () => {
    expect(topicOf(point("p", null, [1, 2, 3]), [])).toBeNull();
  });

  it("settles a tie on the earlier region, so the answer never flickers", () => {
    expect(topicOf(point("p", null, [0, 0, 0]), [
      topic("0", [1, 0, 0]),
      topic("1", [-1, 0, 0]),
    ])).toBe("0");
  });

  it("names no region for a passage whose stored position is not finite", () => {
    // Every comparison against NaN is false, so without a guard the walk
    // would hand back whichever region it happened to start from.
    expect(topicOf(point("p", null, [Number.NaN, 0, 0]), [
      topic("0", [0, 0, 0]),
      topic("1", [10, 0, 0]),
    ])).toBeNull();
  });

  it("ignores a region whose own centre is not finite", () => {
    expect(topicOf(point("p", null, [0, 0, 0]), [
      topic("0", [Number.NaN, 0, 0]),
      topic("1", [10, 0, 0]),
    ])).toBe("1");
  });
});
