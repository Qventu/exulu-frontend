import { describe, expect, it } from "vitest";

import { shouldRefetch } from "./step-refetch";

describe("shouldRefetch", () => {
  it("does nothing on the first render", () => {
    expect(shouldRefetch(undefined, "daten.0")).toBe(false);
  });

  it("refetches when the position changes on the same route", () => {
    expect(shouldRefetch("struktur.0", "struktur.1")).toBe(true);
  });

  it("stays quiet when the position is unchanged", () => {
    expect(shouldRefetch("techdoc.0", "techdoc.0")).toBe(false);
  });

  it("refetches when the position is lost", () => {
    expect(shouldRefetch("daten.1", null)).toBe(true);
  });
});
