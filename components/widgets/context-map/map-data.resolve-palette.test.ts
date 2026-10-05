// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { PALETTE_TOKENS, resolvePalette, NO_VALUE_TOKEN } from "./map-data";

describe("resolvePalette", () => {
  it("resolves a known token to its expected RGB values", () => {
    const root = document.documentElement;
    // Set a known token. --chart-4: 217.0787 76.7241% 54.5098% → [0.196079, 0.462745, 0.894117]
    root.style.setProperty("--chart-4", "217.0787 76.7241% 54.5098%");

    const palette = resolvePalette(root);

    // Find the index of --chart-4 in the palette tokens.
    const chartFourIdx = PALETTE_TOKENS.indexOf("--chart-4");
    expect(chartFourIdx).toBeGreaterThanOrEqual(0);

    // Verify the resolved value matches the expected RGB.
    const resolved = palette.colors[chartFourIdx]!;
    expect(resolved[0]).toBeCloseTo(0.196079, 4);
    expect(resolved[1]).toBeCloseTo(0.462745, 4);
    expect(resolved[2]).toBeCloseTo(0.894117, 4);

    root.style.removeProperty("--chart-4");
  });

  it("falls back to grey when a token is unset or malformed", () => {
    const root = document.documentElement;
    // Ensure a token is unset so getComputedStyle returns empty string.
    root.style.removeProperty("--chart-fake-unset");

    const palette = resolvePalette(root);

    // An unset variable returns empty string, which parseHslTriplet treats as malformed → grey [0.5, 0.5, 0.5].
    // The noValue field should be grey (from --chart-5 which we haven't set, so it defaults to empty).
    expect(palette.noValue).toEqual([0.5, 0.5, 0.5]);
  });

  it("produces consistent results for the same theme", () => {
    const root = document.documentElement;
    root.style.setProperty("--chart-1", "148.0952 53.3898% 53.7255%");

    const palette1 = resolvePalette(root);
    const palette2 = resolvePalette(root);

    const chartOneIdx = PALETTE_TOKENS.indexOf("--chart-1");
    expect(palette1.colors[chartOneIdx]).toEqual(palette2.colors[chartOneIdx]);

    root.style.removeProperty("--chart-1");
  });
});
