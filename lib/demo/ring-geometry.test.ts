import { describe, expect, it } from "vitest";

import { isOutsideViewport, shouldRescroll } from "./ring-geometry";

describe("isOutsideViewport", () => {
  it("is true below the fold", () => {
    // config.0 as measured on 2026-10-14: anchor at 1009 in a 900px viewport.
    expect(isOutsideViewport({ top: 1009, height: 263 }, 900)).toBe(true);
  });

  it("is true above the top edge", () => {
    expect(isOutsideViewport({ top: -300, height: 100 }, 900)).toBe(true);
  });

  it("is false when any part is visible", () => {
    expect(isOutsideViewport({ top: 800, height: 200 }, 900)).toBe(false);
    expect(isOutsideViewport({ top: -50, height: 100 }, 900)).toBe(false);
    expect(isOutsideViewport({ top: 100, height: 100 }, 900)).toBe(false);
  });
});

describe("shouldRescroll", () => {
  const base = { wasInView: true, outsideNow: true, cause: "layout" as const, alreadyRescrolled: false };

  it("re-scrolls once when layout pushes a visible anchor off screen", () => {
    expect(shouldRescroll(base)).toBe(true);
  });

  it("never re-scrolls because the reader scrolled", () => {
    // The reader scrolled the ring off screen on purpose; yanking the page
    // back under them is the one thing this must not do.
    expect(shouldRescroll({ ...base, cause: "scroll" })).toBe(false);
  });

  it("does not spend its one re-scroll on an anchor that mounted below the fold", () => {
    // sync() scrolls smoothly and measures synchronously, so the first
    // measurement of a below-fold anchor is always "outside".
    expect(shouldRescroll({ ...base, wasInView: false })).toBe(false);
  });

  it("re-scrolls at most once per attach", () => {
    expect(shouldRescroll({ ...base, alreadyRescrolled: true })).toBe(false);
  });

  it("does nothing while the anchor is visible", () => {
    expect(shouldRescroll({ ...base, outsideNow: false })).toBe(false);
  });
});
