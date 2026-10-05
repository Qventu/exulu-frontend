// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  PALETTE_TOKENS, resolvePalette, resolveRingColor, NO_VALUE_TOKEN, RING_TOKEN,
} from "./map-data";

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

    const palette = resolvePalette(root);

    // An unset variable returns empty string, which parseHslTriplet treats as malformed → grey [0.5, 0.5, 0.5].
    // The noValue field should be grey (from --chart-5 which we haven't set, so it defaults to empty).
    expect(palette.noValue).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("resolveRingColor", () => {
  it("reads the ring colour from the theme's own token", () => {
    const root = document.documentElement;
    // --destructive: 358.4416 74.7573% 59.6078% is the light theme's value.
    root.style.setProperty(RING_TOKEN, "358.4416 74.7573% 59.6078%");

    const ring = resolveRingColor(root);

    expect(ring[0]).toBeCloseTo(0.898039, 4);
    expect(ring[1]).toBeCloseTo(0.294117, 4);
    expect(ring[2]).toBeCloseTo(0.309803, 4);

    root.style.removeProperty(RING_TOKEN);
  });

  it("is not one of the categorical palette tokens", () => {
    // The ring describes the passage, not its group, so it must never collide
    // with a colour a group could already be wearing.
    expect(PALETTE_TOKENS).not.toContain(RING_TOKEN);
    expect(RING_TOKEN).not.toBe(NO_VALUE_TOKEN);
  });

  it("falls back to grey when the token is unset", () => {
    const root = document.documentElement;
    root.style.removeProperty(RING_TOKEN);
    expect(resolveRingColor(root)).toEqual([0.5, 0.5, 0.5]);
  });
});
