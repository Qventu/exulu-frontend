import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentPosition, setCurrentPosition, turnsFor } from "./current-position";

describe("current position cell", () => {
  beforeEach(() => setCurrentPosition({ chapter: "techdoc", step: 0 }));

  it("defaults to the start of chapter one", () => {
    expect(getCurrentPosition()).toEqual({ chapter: "techdoc", step: 0 });
  });

  it("reflects the most recent write", () => {
    setCurrentPosition({ chapter: "evals", step: 2 });
    expect(getCurrentPosition()).toEqual({ chapter: "evals", step: 2 });
  });
});

describe("turnsFor", () => {
  it("returns the techdoc script for chapter one", () => {
    expect(turnsFor("techdoc").length).toBeGreaterThan(0);
  });

  it("never returns an empty script, since DemoChatTransport rejects one", () => {
    for (const chapter of ["ingestion", "config", "memory", "evals", "email", "meetings"] as const) {
      expect(turnsFor(chapter).length, chapter).toBeGreaterThan(0);
    }
  });
});
