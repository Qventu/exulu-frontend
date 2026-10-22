import { describe, expect, it } from "vitest";

import type { Agent } from "@/types/models/agent";

import { resolveFavouriteAgents, toggleFavouriteId } from "./favourites-utils";

const agent = (id: string, name = id): Agent => ({
  id,
  name,
  type: "agent",
});

describe("toggleFavouriteId", () => {
  it("appends an id that is not yet favourited", () => {
    expect(toggleFavouriteId(["a1"], "a2")).toEqual(["a1", "a2"]);
  });

  it("removes an id that is already favourited", () => {
    expect(toggleFavouriteId(["a1", "a2", "a3"], "a2")).toEqual(["a1", "a3"]);
  });

  it("never mutates the input list", () => {
    const base = ["a1"];
    toggleFavouriteId(base, "a2");
    toggleFavouriteId(base, "a1");
    expect(base).toEqual(["a1"]);
  });
});

describe("resolveFavouriteAgents", () => {
  it("returns rows in the user's star order, not query order", () => {
    const rows = resolveFavouriteAgents(
      ["a3", "a1"],
      [agent("a1"), agent("a3")],
      [],
    );
    expect(rows.map((row) => row.id)).toEqual(["a3", "a1"]);
  });

  it("falls back to already-loaded index rows while the by-ids query resolves", () => {
    const rows = resolveFavouriteAgents(
      ["a2"],
      [],
      [agent("a2", "Index copy")],
    );
    expect(rows.map((row) => row.name)).toEqual(["Index copy"]);
  });

  it("prefers the by-ids row over the index row for the same id", () => {
    const rows = resolveFavouriteAgents(
      ["a2"],
      [agent("a2", "Fresh")],
      [agent("a2", "Stale")],
    );
    expect(rows.map((row) => row.name)).toEqual(["Fresh"]);
  });

  it("drops ids that resolve nowhere (deleted agents)", () => {
    const rows = resolveFavouriteAgents(["gone", "a1"], [agent("a1")], []);
    expect(rows.map((row) => row.id)).toEqual(["a1"]);
  });
});
