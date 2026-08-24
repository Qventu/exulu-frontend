import { describe, expect, it } from "vitest";

import { sameEntityId, toNumericId } from "@/lib/same-entity-id";

describe("sameEntityId", () => {
  it("matches across the GraphQL ID!/Float split", () => {
    expect(sameEntityId("22", 22)).toBe(true);
    expect(sameEntityId(22, "22")).toBe(true);
  });

  it("matches same-typed ids", () => {
    expect(sameEntityId(22, 22)).toBe(true);
    expect(sameEntityId("22", "22")).toBe(true);
    expect(sameEntityId("a-uuid", "a-uuid")).toBe(true);
  });

  it("does not match different ids", () => {
    expect(sameEntityId("2", 22)).toBe(false);
    expect(sameEntityId(2, "22")).toBe(false);
    expect(sameEntityId("uuid-a", "uuid-b")).toBe(false);
  });

  it("never matches null-ish ids, even against each other", () => {
    expect(sameEntityId(undefined, undefined)).toBe(false);
    expect(sameEntityId(null, null)).toBe(false);
    expect(sameEntityId("", "")).toBe(false);
    expect(sameEntityId(null, undefined)).toBe(false);
    expect(sameEntityId(22, undefined)).toBe(false);
    expect(sameEntityId(undefined, 22)).toBe(false);
  });

  it("does not coerce 0 into a null-ish miss", () => {
    expect(sameEntityId(0, "0")).toBe(true);
  });
});

describe("toNumericId", () => {
  it("converts a GraphQL ID! string to the numeric users.id", () => {
    expect(toNumericId("22")).toBe(22);
    expect(toNumericId("100")).toBe(100);
  });

  it("leaves an already-numeric id alone", () => {
    expect(toNumericId(22)).toBe(22);
    expect(toNumericId(0)).toBe(0);
  });

  it("passes non-numeric ids through instead of producing NaN", () => {
    // Guards the seed path: a uuid must never become NaN and collapse every
    // subsequent comparison into a false match.
    const uuid = "6a4b248a-d800-41ab-86de-fd7635c7d59f";
    expect(toNumericId(uuid)).toBe(uuid);
    expect(Number.isNaN(toNumericId(uuid) as unknown as number)).toBe(false);
  });

  it("normalises a mixed list into one comparable type", () => {
    // The exact shape that broke: query-sourced strings next to search-sourced
    // numbers in a single selectedUsers array.
    const mixed = [
      { id: "100" as string | number, rights: "read" as const },
      { id: 22 as string | number, rights: "write" as const },
    ];

    const normalised = mixed.map((u) => ({ ...u, id: toNumericId(u.id) }));

    expect(normalised).toEqual([
      { id: 100, rights: "read" },
      { id: 22, rights: "write" },
    ]);
    expect(normalised.every((u) => typeof u.id === "number")).toBe(true);
  });
});
