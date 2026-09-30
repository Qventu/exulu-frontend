import { describe, expect, it } from "vitest";
import {
  activeFilterCount, buildMemoryFilters, creatorIds, creatorName, hasSourceSession, memoryTypeOptions, visibilityKey,
} from "./memory-list-data";

const ctx = { fields: [{ name: "information", type: "text" }, { name: "type", type: "enum", enumValues: ["FACT", "PREFERENCE"] }] };

describe("buildMemoryFilters", () => {
  it("always excludes archived rows and searches the wording only", () => {
    expect(buildMemoryFilters({ search: " gearbox ", mine: false, userId: 4, filters: {} })).toEqual([
      { archived: { eq: false }, information: { contains: "gearbox" } },
    ]);
  });
  it("omits the search for whitespace and passes special characters verbatim", () => {
    expect(buildMemoryFilters({ search: "   ", mine: false, userId: 4, filters: {} })).toEqual([{ archived: { eq: false } }]);
    expect(buildMemoryFilters({ search: "100%_{x}", mine: false, userId: 4, filters: {} })[0]).toMatchObject({ information: { contains: "100%_{x}" } });
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
});

describe("helpers", () => {
  it("counts active filters and reads the type enum and the source_session field", () => {
    expect(activeFilterCount({ visibility: "public", creator: "" })).toBe(1);
    expect(memoryTypeOptions(ctx)).toEqual(["FACT", "PREFERENCE"]);
    expect(memoryTypeOptions({ fields: [] })).toEqual([]);
    expect(hasSourceSession(ctx)).toBe(false);
    expect(hasSourceSession({ fields: [...ctx.fields, { name: "source_session", type: "text" }] })).toBe(true);
  });
  it("collects distinct creator ids and formats names", () => {
    expect(creatorIds([{ id: "1", created_by: 9 }, { id: "2", created_by: 9 }, { id: "3", created_by: null }])).toEqual([9]);
    const users = [{ id: 9, firstname: "Sara", lastname: "Kraus", email: "s@x.de" }, { id: 3, firstname: null, lastname: null, email: "t@x.de" }];
    expect(creatorName(users, 9)).toBe("Sara Kraus");
    expect(creatorName(users, 3)).toBe("t@x.de");
    expect(creatorName(users, 7)).toBeNull();
  });
  it("maps rights modes to visibility keys", () => {
    expect(visibilityKey("public")).toBe("public");
    expect(visibilityKey(undefined)).toBe("private");
    expect(visibilityKey("teams")).toBe("teams");
  });
});
