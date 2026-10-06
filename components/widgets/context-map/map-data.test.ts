import { describe, expect, it } from "vitest";

import {
  buildBuffers, cloudBounds, coverageCaption, frameCloud, FRAMING_REFERENCE_DISTANCE,
  HOVER_OUTLINE_WIDTH, HOVER_SIZE, itemsInRegion, labelFitsCanvas,
  nearestNeighbourSegments, NO_VALUE_TOKEN, PALETTE_TOKENS,
  parseHslTriplet, pointTitle, projectToScreen, regionColor, resolveLabelCollisions,
  POINT_SIZE, RING_INNER_RADIUS, RING_SIZE, rgbCss,
  strongestPerItem, tooltipPosition, topicOf,
  VIEWPORT_FILL,
  type CloudBounds, type MapPoint, type Rgb,
} from "./map-data";

const point = (id: string, group: string | null, xyz: [number, number, number] = [0, 0, 0]) => ({
  id, itemId: `item-${id}`, x: xyz[0], y: xyz[1], z: xyz[2],
  itemName: `item ${id}`, group, chunks: 1, createdAtMs: null,
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
  const palette = { colors: [[1, 0, 0], [0, 1, 0]] as Rgb[], noValue: [0.5, 0.5, 0.5] as Rgb };

  it("writes three floats per point in order", () => {
    const { positions } = buildBuffers(
      [point("a", "FACT", [1, 2, 3]), point("b", "FACT", [4, 5, 6])], () => 0, palette);
    expect(Array.from(positions)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("colours a point by its region, not by its group value", () => {
    // Both passages carry the same grouping value, so anything still colouring
    // by `group` would paint the two identically. A knowledge base has no
    // grouping field at all, and its regions are the only thing to colour by.
    const points = [point("a", "FACT"), point("b", "FACT")];
    const { colors } = buildBuffers(points, (p) => (p.id === "a" ? 0 : 1), palette);
    expect(Array.from(colors.slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(colors.slice(3, 6))).toEqual([0, 1, 0]);
  });

  it("gives a point in no region the reserved grey, whatever its group value", () => {
    // The first passage's grouping value is one the palette could colour. No
    // region still means grey: that is what keeps a dot's colour and the chips
    // from ever disagreeing.
    const { colors } = buildBuffers([point("a", "FACT"), point("b", null)], () => -1, palette);
    expect(Array.from(colors)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it("cycles when a base has more regions than colours", () => {
    // Twelve regions against seven colours is the real case. The chips carry
    // identity, so a colour repeating at a distance is accepted.
    const { colors } = buildBuffers([point("a", null)], () => 2, palette);
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

describe("regionColor", () => {
  const palette = { colors: [[1, 0, 0], [0, 1, 0]] as Rgb[], noValue: [0.5, 0.5, 0.5] as Rgb };

  it("cycles when there are more regions than colours", () => {
    // Twelve regions against seven palette entries on the first real base, so
    // the rule has to wrap — and the card paints its chip swatches through
    // this same function, which is what keeps a chip and its dots in step.
    expect(regionColor(palette, 0)).toEqual([1, 0, 0]);
    expect(regionColor(palette, 1)).toEqual([0, 1, 0]);
    expect(regionColor(palette, 2)).toEqual([1, 0, 0]);
  });

  it("gives a passage in no region the reserved grey", () => {
    expect(regionColor(palette, -1)).toEqual([0.5, 0.5, 0.5]);
  });

  it("falls back to grey rather than nothing when the palette is empty", () => {
    expect(regionColor({ colors: [], noValue: [0.5, 0.5, 0.5] }, 0)).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("rgbCss", () => {
  it("writes a resolved triplet as a colour a browser will paint", () => {
    // Not `hsl(var(--chart-4))`: a raw token on a swatch paints nothing when
    // the variable is missing, while the dot it explains goes grey.
    expect(rgbCss([0, 0.5, 1])).toBe("rgb(0, 128, 255)");
  });

  it("carries the grey an unparseable token resolves to", () => {
    expect(rgbCss(parseHslTriplet("not a colour"))).toBe("rgb(128, 128, 128)");
  });

  it("clamps rather than emitting a channel no browser accepts", () => {
    expect(rgbCss([-1, 2, 0])).toBe("rgb(0, 255, 0)");
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

describe("cloudBounds", () => {
  it("measures the box the passages occupy", () => {
    expect(cloudBounds([
      point("a", null, [-1, -2, -3]),
      point("b", null, [4, 5, 6]),
      point("c", null, [0, 0, 0]),
    ])).toEqual({ min: { x: -1, y: -2, z: -3 }, max: { x: 4, y: 5, z: 6 } });
  });

  it("measures a box that is not centred on the origin", () => {
    // The layout is centred on its own mean, which is not the middle of its
    // box: the first real base runs from -0.58 to 0.95 across. A camera aimed
    // at the origin is therefore aimed off to one side of the cloud.
    const measured = cloudBounds([
      point("a", null, [-0.58, 0, 0]),
      point("b", null, [0.95, 0, 0]),
    ]);
    expect(measured?.min.x).toBeCloseTo(-0.58, 10);
    expect(measured?.max.x).toBeCloseTo(0.95, 10);
  });

  it("leaves out a passage whose stored coordinates are not finite", () => {
    // One NaN compares false against both bounds, so without the guard the
    // box would stay open on whichever side it was written to.
    expect(cloudBounds([
      point("a", null, [-1, -1, -1]),
      point("b", null, [Number.NaN, 100, 100]),
      point("c", null, [1, 1, 1]),
    ])).toEqual({ min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } });
  });

  it("has no box to report when there is nothing placeable", () => {
    expect(cloudBounds([])).toBeNull();
    expect(cloudBounds([point("a", null, [Number.NaN, 0, 0])])).toBeNull();
  });

  it("reports a zero-extent box for a single passage", () => {
    expect(cloudBounds([point("a", null, [2, 3, 4])]))
      .toEqual({ min: { x: 2, y: 3, z: 4 }, max: { x: 2, y: 3, z: 4 } });
  });
});

describe("frameCloud", () => {
  /** The camera's vertical field of view, as map-canvas creates it. */
  const FOV = 50;
  /** The card gives the canvas 28rem of height; this is that against 1792px. */
  const WIDE_ASPECT = 4;
  /** What the camera was parked at before it was fitted to anything. */
  const OLD_FIXED_DISTANCE = FRAMING_REFERENCE_DISTANCE;

  /**
   * The first real knowledge base, 1134 passages: 1.53 across by 0.97 high,
   * depth narrower still, and not centred on the origin.
   */
  const MEASURED: CloudBounds = {
    min: { x: -0.58, y: -0.485, z: -0.4 },
    max: { x: 0.95, y: 0.485, z: 0.4 },
  };

  /**
   * The fraction of the canvas a box spans at a given distance, measured at
   * the cloud's own depth: the full viewport there is 2 * distance * tan(fov/2)
   * high, and the aspect ratio times that wide.
   */
  const spans = (bounds: CloudBounds, distance: number, aspect: number) => {
    const viewportHeight = 2 * distance * Math.tan((FOV * Math.PI) / 360);
    return {
      width: (bounds.max.x - bounds.min.x) / (viewportHeight * aspect),
      height: (bounds.max.y - bounds.min.y) / viewportHeight,
    };
  };

  const scaled = (bounds: CloudBounds, by: number): CloudBounds => ({
    min: { x: bounds.min.x * by, y: bounds.min.y * by, z: bounds.min.z * by },
    max: { x: bounds.max.x * by, y: bounds.max.y * by, z: bounds.max.z * by },
  });

  it("aims at the centre of the box rather than at the origin", () => {
    expect(frameCloud(MEASURED, WIDE_ASPECT, FOV).center.x).toBeCloseTo(0.185, 10);
  });

  it("fills the height of a wide canvas, which is what the fixed distance did not", () => {
    // The diagnosis, as a test: parked at 3.2 this base sat in a third of the
    // height and an eighth of the width of a canvas four times wider than it
    // is tall, because 3.2 frames a world box about three units tall whatever
    // the cloud happens to be.
    const before = spans(MEASURED, OLD_FIXED_DISTANCE, WIDE_ASPECT);
    expect(before.height).toBeCloseTo(0.33, 2);
    expect(before.width).toBeCloseTo(0.13, 2);

    const framing = frameCloud(MEASURED, WIDE_ASPECT, FOV);
    const after = spans(MEASURED, framing.distance, WIDE_ASPECT);
    expect(after.height).toBeCloseTo(VIEWPORT_FILL, 10);
    expect(after.width).toBeGreaterThan(before.width * 2);
    // Height is the limiting dimension here, so the width is not filled —
    // but it is no longer an eighth either.
    expect(after.width).toBeLessThan(VIEWPORT_FILL);
  });

  it("fills the width instead when the canvas is narrow", () => {
    // Getting only the vertical right is what leaves a cloud small on a wide
    // canvas; getting only the horizontal right would clip it on a narrow one.
    const framing = frameCloud(MEASURED, 1, FOV);
    const after = spans(MEASURED, framing.distance, 1);
    expect(after.width).toBeCloseTo(VIEWPORT_FILL, 10);
    expect(after.height).toBeLessThan(VIEWPORT_FILL);
  });

  it("counts depth as width, because the idle rotation swings it into view", () => {
    // A narrow, deep cloud: fitted on x alone it would be framed ten times too
    // close, and a quarter turn of the idle spin would throw it off both edges.
    const deep: CloudBounds = {
      min: { x: -0.1, y: -0.1, z: -1 },
      max: { x: 0.1, y: 0.1, z: 1 },
    };
    const framing = frameCloud(deep, WIDE_ASPECT, FOV);
    const turned: CloudBounds = {
      min: { x: deep.min.z, y: deep.min.y, z: deep.min.x },
      max: { x: deep.max.z, y: deep.max.y, z: deep.max.x },
    };
    expect(spans(turned, framing.distance, WIDE_ASPECT).width)
      .toBeCloseTo(VIEWPORT_FILL, 10);
  });

  it("lets a viewer dolly closer than the framing and further out than it", () => {
    const framing = frameCloud(MEASURED, WIDE_ASPECT, FOV);
    expect(framing.minDistance).toBeLessThan(framing.distance);
    expect(framing.maxDistance).toBeGreaterThan(framing.distance);
    // The fixed clamp these limits replace sat at 1.2, which is all but
    // exactly the distance this base wants to be framed from: zooming in by
    // hand reached the right framing and then stopped, with no room left to
    // look closer. The derived floor is well inside it.
    const oldMinDistance = 1.2;
    expect(framing.distance).toBeCloseTo(oldMinDistance, 1);
    expect(framing.minDistance).toBeLessThan(oldMinDistance);
  });

  it("scales both limits with the cloud, not with a constant", () => {
    const here = frameCloud(MEASURED, WIDE_ASPECT, FOV);
    const small = frameCloud(scaled(MEASURED, 0.1), WIDE_ASPECT, FOV);
    const large = frameCloud(scaled(MEASURED, 10), WIDE_ASPECT, FOV);
    expect(small.minDistance).toBeLessThan(here.minDistance);
    expect(large.maxDistance).toBeGreaterThan(here.maxDistance);
    expect(small.distance * 100).toBeCloseTo(large.distance, 10);
  });

  it("keeps a dot the apparent size it had at the old fixed distance", () => {
    // The point shader is `size * pixelRatio * (300 / -mv.z)`, so a dot's
    // apparent size goes as size / distance. Without sizeScale, framing this
    // base at its own distance would make every dot two and a half times
    // larger.
    const framing = frameCloud(MEASURED, WIDE_ASPECT, FOV);
    expect(OLD_FIXED_DISTANCE / framing.distance).toBeCloseTo(2.6, 1);
    const size = 1;
    expect((size * framing.sizeScale) / framing.distance)
      .toBeCloseTo(size / OLD_FIXED_DISTANCE, 10);
  });

  it("still puts the camera somewhere for a cloud with no extent", () => {
    // One passage, or every passage stacked. A distance of 0 would leave
    // OrbitControls nothing to orbit and the camera inside the point.
    const framing = frameCloud(
      { min: { x: 2, y: 3, z: 4 }, max: { x: 2, y: 3, z: 4 } }, WIDE_ASPECT, FOV,
    );
    expect(framing.center).toEqual({ x: 2, y: 3, z: 4 });
    expect(framing.distance).toBeGreaterThan(0);
    expect(framing.maxDistance).toBeGreaterThan(framing.minDistance);
    expect(framing.minDistance).toBeGreaterThan(0);
  });

  it("frames as if the canvas were square when it has not been laid out", () => {
    // The caller divides clientWidth by clientHeight, which is 0, NaN or
    // Infinity before layout; any of those would otherwise reach the camera's
    // position as a NaN.
    const square = frameCloud(MEASURED, 1, FOV).distance;
    for (const aspect of [0, -4, Number.NaN, Infinity]) {
      expect(frameCloud(MEASURED, aspect, FOV).distance).toBeCloseTo(square, 10);
    }
  });
});

describe("pointTitle", () => {
  it("names a point by its item", () => {
    expect(pointTitle({ itemName: "Price list 2026" })).toBe("Price list 2026");
  });

  /**
   * `name` is nullable on an items table and the resolver answers "" for a
   * null, so this is a real shape. Each call site renders its own translated
   * "untitled" fallback; this function stays pure and cannot translate.
   *
   * The passage's opening is no longer even requested — it was the injected
   * document header on a real corpus, which is what made it unusable as a
   * title and, once nothing read it, worth dropping from the query.
   */
  it("returns \"\" for an item with no name", () => {
    expect(pointTitle({ itemName: "" })).toBe("");
    expect(pointTitle({ itemName: "   " })).toBe("");
  });
});

describe("strongestPerItem", () => {
  const edge = (target: string, score: number) => ({ source: "seed", target, score });
  /** A passage of `item`, as the points answer carries it. */
  const chunkOf = (id: string, item: string): MapPoint => ({
    id, itemId: item, x: 0, y: 0, z: 0,
    itemName: `the name of ${item}`, group: null, chunks: 1, createdAtMs: null,
  });
  const byId = (...points: MapPoint[]) => new Map(points.map((p) => [p.id, p]));

  it("lists an item once, keeping its strongest passage", () => {
    // Four chunks of one document are four neighbours and one item: the panel
    // showed the same name four times.
    const rows = strongestPerItem(
      [edge("c1", 0.4), edge("c2", 0.9), edge("c3", 0.2), edge("c4", 0.5)],
      byId(
        chunkOf("c1", "i1"), chunkOf("c2", "i1"),
        chunkOf("c3", "i1"), chunkOf("c4", "i1"),
      ),
    );
    expect(rows).toEqual([edge("c2", 0.9)]);
  });

  it("keeps separate items apart, strongest first", () => {
    const rows = strongestPerItem(
      [edge("a1", 0.3), edge("b1", 0.9), edge("a2", 0.8)],
      byId(chunkOf("a1", "A"), chunkOf("a2", "A"), chunkOf("b1", "B")),
    );
    expect(rows.map((r) => r.target)).toEqual(["b1", "a2"]);
  });

  it("keeps a neighbour that is not on the map, which names no item", () => {
    // The edges query does not filter to passages that have a position, and
    // the cloud is capped anyway: such a row is a real relation whose item is
    // simply unknown here, so it cannot be folded into one.
    const rows = strongestPerItem(
      [edge("c1", 0.9), edge("gone", 0.5), edge("also-gone", 0.4)],
      byId(chunkOf("c1", "i1")),
    );
    expect(rows.map((r) => r.target)).toEqual(["c1", "gone", "also-gone"]);
  });

  it("answers nothing for no edges, and leaves one edge alone", () => {
    expect(strongestPerItem([], byId())).toEqual([]);
    expect(strongestPerItem([edge("c1", 0.5)], byId(chunkOf("c1", "i1"))))
      .toEqual([edge("c1", 0.5)]);
  });
});

describe("the hovered dot's nesting inside the ring", () => {
  it("stays a legible hover state the shader cannot test for itself", () => {
    // HOVER_SIZE is defined as Math.min(POINT_SIZE * 1.5, the ring's inner
    // edge as a diameter), so this is the one invariant map-canvas.tsx's
    // hover layer depends on and cannot itself test (it has no tests, by
    // design). A future change that raises HOVER_SIZE directly, bypassing
    // the Math.min, would silently paint the hovered dot over a flagged
    // passage's conflict ring — this fails the moment that happens.
    expect(HOVER_SIZE).toBeLessThanOrEqual(RING_SIZE * RING_INNER_RADIUS * 2);

    // The invariant above is one-sided, so on its own it is satisfied by a
    // hovered dot SMALLER than an ordinary one — which is the opposite of a
    // hover state. This is the lower bound it needs.
    expect(HOVER_SIZE).toBeGreaterThan(POINT_SIZE);

    // The outline is baked into HOVER_FRAGMENT as a cutoff of 0.5 × (1 − w).
    // At w ≥ 1 the cutoff reaches zero and the whole sprite is outline, so the
    // hovered dot loses its region colour entirely; at w ≤ 0 there is no rim.
    // Neither is visible to the invariant above, and map-canvas.tsx cannot
    // test its own shader.
    expect(HOVER_OUTLINE_WIDTH).toBeGreaterThan(0);
    expect(HOVER_OUTLINE_WIDTH).toBeLessThan(1);

    // The bounds above still admit the value this commit replaced. What the
    // rim actually has to clear is one device pixel: the shader has no
    // antialiasing, so a sub-pixel band renders as an intermittent fringe or
    // not at all. Pin the rendered width rather than the ratio, since the
    // ratio alone means nothing without the sprite's size.
    //
    // gl_PointSize = size × 300/z at DPR 1, and the framing effect's
    // sizeScale of z/FRAMING_REFERENCE_DISTANCE cancels z — so the sprite is
    // this wide at every camera distance, not only the reference one.
    const spriteDiameterPx = HOVER_SIZE * (300 / FRAMING_REFERENCE_DISTANCE);
    const rimPx = HOVER_OUTLINE_WIDTH * (spriteDiameterPx / 2);
    expect(rimPx).toBeGreaterThanOrEqual(0.75);

    // And the fill has to survive the rim, or the hovered dot stops carrying
    // its region's colour and reads as a ring.
    expect(spriteDiameterPx * (1 - HOVER_OUTLINE_WIDTH)).toBeGreaterThan(2);
  });
});

/**
 * A region label is drawn as an absolutely-positioned plate over the canvas,
 * and projectToScreen calls anything in FRONT of the camera visible — whether
 * or not it lands inside the viewport. So a region whose centre swung off the
 * side of the cloud was rendered at a negative coordinate, escaping the card
 * entirely and landing on the page's tabs and header.
 *
 * The host clips now, which stops the escape on its own. This is the other
 * half: a plate that merely straddles the edge would be sliced in two by that
 * clip, which reads as a rendering fault rather than as a label.
 */
describe("labelFitsCanvas", () => {
  const box = { id: "t", x: 100, y: 100, width: 80, height: 20, count: 1 };

  it("keeps a label whose whole plate is inside the canvas", () => {
    expect(labelFitsCanvas(box, 400, 300)).toBe(true);
  });

  // x and y are the plate's CENTRE, so the test is against half its size.
  it.each([
    ["off the left edge", { x: 39, y: 100 }],
    ["off the right edge", { x: 361, y: 100 }],
    ["off the top edge", { x: 100, y: 9 }],
    ["off the bottom edge", { x: 100, y: 291 }],
  ])("drops a label hanging %s", (_label, at) => {
    expect(labelFitsCanvas({ ...box, ...at }, 400, 300)).toBe(false);
  });

  it("keeps a label resting exactly on the edge", () => {
    expect(labelFitsCanvas({ ...box, x: 40, y: 10 }, 400, 300)).toBe(true);
  });

  // The overlay runs before the first resize observation, and every label is
  // "outside" a zero-sized canvas - which would blank the layer rather than
  // leave it alone for one frame.
  it("keeps labels when the canvas has not been measured yet", () => {
    expect(labelFitsCanvas(box, 0, 0)).toBe(true);
  });
});

/**
 * The hover read-out sits at the pointer, and the host clips now - so near the
 * right or bottom edge it would be cut off mid-word instead of being readable.
 */
describe("tooltipPosition", () => {
  const size = { width: 200, height: 40 };

  it("sits below and to the right of the pointer with room to spare", () => {
    expect(tooltipPosition(50, 50, 800, 600, size)).toEqual({ left: 58, top: 58 });
  });

  it("flips to the left of the pointer rather than overflowing the right edge", () => {
    const { left } = tooltipPosition(700, 50, 800, 600, size);
    expect(left).toBe(700 - 8 - size.width);
    expect(left + size.width).toBeLessThanOrEqual(800);
  });

  it("flips above the pointer rather than overflowing the bottom edge", () => {
    const { top } = tooltipPosition(50, 580, 800, 600, size);
    expect(top).toBe(580 - 8 - size.height);
  });

  // A canvas narrower than the tooltip has no good side; it must still start
  // on screen rather than at a negative coordinate.
  it("never positions the tooltip off the top or left", () => {
    const { left, top } = tooltipPosition(10, 10, 120, 30, size);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });
});

/**
 * The unique items a region holds, for the panel a chip opens.
 *
 * A region is a cluster of PASSAGES, so a document chunked into forty pieces
 * is forty dots in it — which is the right picture of the cloud and the wrong
 * answer to "what is in here". No new data: the points already carry their
 * item, and region membership is the same nearest-centre rule the colouring
 * uses.
 */
describe("itemsInRegion", () => {
  const topics = [
    { id: "a", label: "A", count: 0, x: 0, y: 0, z: 0 },
    { id: "b", label: "B", count: 0, x: 10, y: 0, z: 0 },
  ];
  const at = (id: string, itemId: string, name: string, x: number) => ({
    id, itemId, x, y: 0, z: 0, itemName: name,
    group: null, chunks: 1, createdAtMs: null,
  });

  it("folds a document's passages into one row and counts them", () => {
    const points = [at("c1", "i1", "Manual", 0), at("c2", "i1", "Manual", 1), at("c3", "i2", "Datasheet", 0)];
    expect(itemsInRegion(points, topics, "a")).toEqual([
      { itemId: "i1", name: "Manual", passages: 2 },
      { itemId: "i2", name: "Datasheet", passages: 1 },
    ]);
  });

  it("counts only the passages that belong to the region asked for", () => {
    const points = [at("c1", "i1", "Manual", 0), at("c2", "i1", "Manual", 10)];
    expect(itemsInRegion(points, topics, "a")).toEqual([{ itemId: "i1", name: "Manual", passages: 1 }]);
    expect(itemsInRegion(points, topics, "b")).toEqual([{ itemId: "i1", name: "Manual", passages: 1 }]);
  });

  // Most-present first answers "what is this region about"; a row order that
  // followed the cloud's random sampling order would answer nothing.
  it("orders by how much of the item is in the region, then by name", () => {
    const points = [
      at("c1", "i1", "Zebra", 0), at("c2", "i2", "Apple", 0),
      at("c3", "i2", "Apple", 1), at("c4", "i3", "Mango", 0),
    ];
    expect(itemsInRegion(points, topics, "a").map((r) => r.name)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("is empty for a region with no passages, and for no region at all", () => {
    expect(itemsInRegion([], topics, "a")).toEqual([]);
    expect(itemsInRegion([at("c1", "i1", "Manual", 0)], topics, null)).toEqual([]);
  });

  // A nameless item still exists and still occupies the region; the caller
  // renders the translated fallback, exactly as it does for a point.
  it("keeps an unnamed item, with an empty name", () => {
    expect(itemsInRegion([at("c1", "i1", "", 0)], topics, "a")).toEqual([
      { itemId: "i1", name: "", passages: 1 },
    ]);
  });

  it("takes the first non-empty name when a document's chunks disagree", () => {
    const points = [at("c1", "i1", "", 0), at("c2", "i1", "Manual", 1)];
    expect(itemsInRegion(points, topics, "a")).toEqual([{ itemId: "i1", name: "Manual", passages: 2 }]);
  });
});
