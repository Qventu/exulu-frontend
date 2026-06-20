import { describe, expect, it } from "vitest";

import {
  RECENTLY_VIEWED_CAP,
  computeNextFavourites,
  computeNextRecents,
  itemGlobalId,
  parseItemGlobalId,
} from "./pin-utils";

describe("itemGlobalId / parseItemGlobalId", () => {
  it("round-trips a context + item id", () => {
    const gid = itemGlobalId("documents", "abc");
    expect(gid).toBe("documents/abc");
    expect(parseItemGlobalId(gid)).toEqual({
      contextId: "documents",
      itemId: "abc",
    });
  });

  it("keeps item ids that themselves contain slashes", () => {
    // Only the first slash separates context from item.
    expect(parseItemGlobalId("ctx/a/b/c")).toEqual({
      contextId: "ctx",
      itemId: "a/b/c",
    });
  });

  it("returns null for malformed ids", () => {
    expect(parseItemGlobalId("noslash")).toBeNull();
    expect(parseItemGlobalId("/missingContext")).toBeNull();
    expect(parseItemGlobalId("missingItem/")).toBeNull();
  });
});

describe("computeNextFavourites", () => {
  it("prepends a new favourite (most-recent first)", () => {
    expect(computeNextFavourites(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("removes an existing favourite (toggle off)", () => {
    expect(computeNextFavourites(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("does not mutate the input array", () => {
    const base = ["a", "b"];
    computeNextFavourites(base, "c");
    expect(base).toEqual(["a", "b"]);
  });
});

describe("computeNextRecents", () => {
  it("prepends a freshly viewed item", () => {
    expect(computeNextRecents(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("de-dupes — re-viewing moves an item to the front without duplicating", () => {
    expect(computeNextRecents(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("caps the list, evicting the oldest", () => {
    const base = ["a", "b", "c", "d", "e"]; // already at the cap of 5
    expect(computeNextRecents(base, "f")).toEqual(["f", "a", "b", "c", "d"]);
    expect(computeNextRecents(base, "f")).toHaveLength(RECENTLY_VIEWED_CAP);
  });

  it("respects a custom cap", () => {
    expect(computeNextRecents(["a", "b"], "c", 2)).toEqual(["c", "a"]);
  });

  it("does not mutate the input array", () => {
    const base = ["a", "b"];
    computeNextRecents(base, "c");
    expect(base).toEqual(["a", "b"]);
  });
});
