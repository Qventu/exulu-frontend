import { describe, expect, it } from "vitest";

import {
  buildBuffers, coverageCaption, legendEntries, NO_VALUE_TOKEN, PALETTE_TOKENS,
  projectToScreen, resolveLabelCollisions,
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
  // A simple orthographic-style matrix: x and y pass through, w = 1.
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it("maps the centre of clip space to the centre of the viewport", () => {
    expect(projectToScreen({ x: 0, y: 0, z: 0 }, identity, 800, 600)).toEqual({ x: 400, y: 300, visible: true });
  });

  it("reports a point behind the camera as not visible", () => {
    const behind = [...identity];
    behind[15] = -1; // w becomes negative
    expect(projectToScreen({ x: 0, y: 0, z: 0 }, behind, 800, 600).visible).toBe(false);
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
  it("follows the declared order of the base's own enum", () => {
    expect(legendEntries(["FACT", "INSTRUCTION", "PREFERENCE"]).map((e) => e.value))
      .toEqual(["FACT", "INSTRUCTION", "PREFERENCE"]);
  });

  it("is empty when the base declares no enum to colour by", () => {
    expect(legendEntries([])).toEqual([]);
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
