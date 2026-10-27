import { describe, expect, it } from "vitest";

import { orderFavouriteArtifacts } from "./favourites";

const item = (name: string) => ({ name }) as { name: string };

describe("orderFavouriteArtifacts", () => {
  it("returns the starred artifacts in star order, not list order", () => {
    const rows = orderFavouriteArtifacts(
      ["c", "a"],
      [item("a"), item("b"), item("c")],
    );
    expect(rows.map((r) => r.name)).toEqual(["c", "a"]);
  });

  it("drops starred names the list does not contain (deleted or no access)", () => {
    const rows = orderFavouriteArtifacts(["gone", "b"], [item("a"), item("b")]);
    expect(rows.map((r) => r.name)).toEqual(["b"]);
  });

  it("is empty when nothing is starred", () => {
    expect(orderFavouriteArtifacts([], [item("a")])).toEqual([]);
  });
});
