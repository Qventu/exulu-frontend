import { describe, expect, it } from "vitest";
import {
  activeFilterCount, buildMemoryFilters, creatorName, hasSourceSession, memoryTypeOptions, visibilityKey,
} from "./memory-list-data";

const ctx = { fields: [{ name: "information", type: "text" }, { name: "type", type: "enum", enumValues: ["FACT", "PREFERENCE"] }] };

describe("buildMemoryFilters", () => {
  it("always excludes archived rows and searches the wording only", () => {
    expect(buildMemoryFilters({ search: " gearbox ", mine: false, userId: 4, filters: {} })).toEqual([
      { archived: { eq: false }, information: { contains: "gearbox" } },
    ]);
  });
  it("omits the search for whitespace and escapes the LIKE wildcards", () => {
    expect(buildMemoryFilters({ search: "   ", mine: false, userId: 4, filters: {} })).toEqual([{ archived: { eq: false } }]);
    // The server hands `contains` straight to LIKE, so %, _ and \ are escaped
    // here; {} and other characters are not LIKE syntax and stay verbatim.
    expect(buildMemoryFilters({ search: "100%_{x}", mine: false, userId: 4, filters: {} })[0]).toMatchObject({ information: { contains: "100\\%\\_{x}" } });
    expect(buildMemoryFilters({ search: "a\\b", mine: false, userId: 4, filters: {} })[0]).toMatchObject({ information: { contains: "a\\\\b" } });
  });
  it("maps visibility, type and creator; Mine overrides creator", () => {
    expect(buildMemoryFilters({ search: "", mine: false, userId: 4, filters: { visibility: "private", type: "FACT", creator: "9" } })).toEqual([
      { archived: { eq: false }, rights_mode: { eq: "private" }, type: { eq: "FACT" }, created_by: { eq: 9 } },
    ]);
    expect(buildMemoryFilters({ search: "", mine: true, userId: 4, filters: { creator: "9" } })).toEqual([
      { archived: { eq: false }, created_by: { eq: 4 } },
    ]);
    expect(buildMemoryFilters({ search: "", mine: true, userId: undefined, filters: {} })).toEqual([{ archived: { eq: false } }]);
  });
  it("passes an ids restriction for the Usage filter and keeps the other filters", () => {
    expect(buildMemoryFilters({ search: "", mine: false, userId: 4, filters: { type: "FACT" }, ids: ["a", "b"] })).toEqual([
      { archived: { eq: false }, type: { eq: "FACT" }, id: { in: ["a", "b"] } },
    ]);
    expect(buildMemoryFilters({ search: "", mine: false, userId: 4, filters: {}, ids: undefined })).toEqual([{ archived: { eq: false } }]);
  });
});

describe("helpers", () => {
  it("counts active filters and reads the type enum and the source_session field", () => {
    expect(activeFilterCount({ visibility: "public", creator: "" })).toBe(1);
    expect(memoryTypeOptions(ctx)).toEqual(["FACT", "PREFERENCE"]);
    expect(memoryTypeOptions({ fields: [] })).toEqual([]);
    expect(hasSourceSession(ctx)).toBe(false);
    expect(hasSourceSession({ fields: [...ctx.fields, { name: "source_session", type: "text" }] })).toBe(true);
  });
  it("looks a creator up among the base's contributors", () => {
    const contributors = [{ id: 9, name: "Sara Kraus" }, { id: 3, name: "t@x.de" }];
    expect(creatorName(contributors, 9)).toBe("Sara Kraus");
    expect(creatorName(contributors, 3)).toBe("t@x.de");
    expect(creatorName(contributors, 7)).toBeNull();
    expect(creatorName(contributors, null)).toBeNull();
    expect(creatorName([], 9)).toBeNull();
  });
  it("maps rights modes to visibility keys", () => {
    expect(visibilityKey("public")).toBe("public");
    expect(visibilityKey(undefined)).toBe("private");
    expect(visibilityKey("teams")).toBe("teams");
  });
});
