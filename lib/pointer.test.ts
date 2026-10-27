import { describe, expect, it } from "vitest";

import { hasFinePointer } from "./pointer";

const win = (matches: boolean, query = "(pointer: fine)") => ({
  matchMedia: (q: string) => ({ matches: q === query ? matches : false }),
});

describe("hasFinePointer", () => {
  it("is false without a window (server render)", () => {
    expect(hasFinePointer(undefined)).toBe(false);
    expect(hasFinePointer(null)).toBe(false);
  });

  it("is false when matchMedia is unavailable", () => {
    expect(hasFinePointer({} as never)).toBe(false);
  });

  it("is true for a mouse or trackpad", () => {
    expect(hasFinePointer(win(true))).toBe(true);
  });

  it("is false on a touch device", () => {
    expect(hasFinePointer(win(false))).toBe(false);
  });

  it("is false when matchMedia throws", () => {
    expect(
      hasFinePointer({
        matchMedia: () => {
          throw new Error("unsupported");
        },
      }),
    ).toBe(false);
  });
});
