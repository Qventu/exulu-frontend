import { describe, expect, it } from "vitest";

import { tabFromParam } from "./tab-param";

describe("tabFromParam", () => {
  it("opens the cases tab when asked", () => {
    expect(tabFromParam("testCases")).toBe("testCases");
  });

  it("defaults to results", () => {
    expect(tabFromParam(null)).toBe("results");
    expect(tabFromParam("")).toBe("results");
  });

  it("ignores values it does not know", () => {
    expect(tabFromParam("cases")).toBe("results");
  });
});
