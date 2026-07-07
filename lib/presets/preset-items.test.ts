import { describe, expect, it } from "vitest";

import { sameItemSet } from "@/lib/presets/preset-items";

describe("sameItemSet", () => {
  it("equal arrays are the same set", () => {
    expect(sameItemSet(["a", "b/1"], ["a", "b/1"])).toBe(true);
  });

  it("order does not matter", () => {
    expect(sameItemSet(["a", "b/1"], ["b/1", "a"])).toBe(true);
  });

  it("duplicates do not matter", () => {
    expect(sameItemSet(["a", "a", "b/1"], ["b/1", "a"])).toBe(true);
  });

  it("different members are not the same set", () => {
    expect(sameItemSet(["a"], ["b"])).toBe(false);
    expect(sameItemSet(["a", "b"], ["a"])).toBe(false);
    expect(sameItemSet(["a"], ["a", "b"])).toBe(false);
  });

  it("both empty is the same set", () => {
    expect(sameItemSet([], [])).toBe(true);
  });
});
