import { describe, expect, it } from "vitest";

import { KEYBOARD_INSET_MIN_PX, computeKeyboardInset } from "./keyboard-inset";

describe("computeKeyboardInset", () => {
  it("is 0 without metrics (no visualViewport support)", () => {
    expect(computeKeyboardInset(null)).toBe(0);
    expect(computeKeyboardInset(undefined)).toBe(0);
  });

  it("is 0 when both viewports are the same height (no keyboard)", () => {
    expect(computeKeyboardInset({ layoutHeight: 844, visualHeight: 844 })).toBe(0);
  });

  it("reports the covered height when the keyboard is open", () => {
    // iPhone 14: 844pt layout viewport, ~336pt of it covered by the keyboard.
    expect(computeKeyboardInset({ layoutHeight: 844, visualHeight: 508 })).toBe(336);
  });

  it("ignores differences below the minimum (accessory bars, rounding)", () => {
    const small = KEYBOARD_INSET_MIN_PX - 1;
    expect(
      computeKeyboardInset({ layoutHeight: 844, visualHeight: 844 - small }),
    ).toBe(0);
  });

  it("is 0 while the user pinch-zooms (the heights no longer describe a keyboard)", () => {
    expect(
      computeKeyboardInset({ layoutHeight: 844, visualHeight: 400, scale: 2 }),
    ).toBe(0);
  });

  it("treats scale 1 as not zoomed", () => {
    expect(
      computeKeyboardInset({ layoutHeight: 844, visualHeight: 508, scale: 1 }),
    ).toBe(336);
  });

  it("never goes negative when the visual viewport is the taller one", () => {
    expect(computeKeyboardInset({ layoutHeight: 500, visualHeight: 844 })).toBe(0);
  });

  it("is 0 for non-finite input", () => {
    expect(computeKeyboardInset({ layoutHeight: NaN, visualHeight: 508 })).toBe(0);
  });

  it("rounds to whole pixels", () => {
    expect(computeKeyboardInset({ layoutHeight: 844.4, visualHeight: 508.1 })).toBe(336);
  });
});
