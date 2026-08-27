import { describe, expect, it } from "vitest";
import { isDemoMode } from "./flag";

describe("isDemoMode", () => {
  it("is true only for the exact string 'true'", () => {
    expect(isDemoMode("true")).toBe(true);
  });

  it("is false when unset", () => {
    expect(isDemoMode(undefined)).toBe(false);
  });

  it("is false for truthy-looking values that are not 'true'", () => {
    expect(isDemoMode("1")).toBe(false);
    expect(isDemoMode("TRUE")).toBe(false);
  });
});
