import { describe, expect, it } from "vitest";

import { filterPickerItems, pickerCategories } from "./pick-items";

const items = [
  { id: "a", name: "Web search", description: "Search the web", category: "research" },
  { id: "b", name: "Jira issues", description: "Reads Jira", category: "work" },
  { id: "c", name: "Calculator", description: null, category: null },
];

describe("filterPickerItems", () => {
  it("returns everything for an empty query and no category", () => {
    expect(filterPickerItems(items, "  ", null).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("matches name, description and category, case-insensitively", () => {
    expect(filterPickerItems(items, "JIRA", null).map((i) => i.id)).toEqual(["b"]);
    expect(filterPickerItems(items, "the web", null).map((i) => i.id)).toEqual(["a"]);
    expect(filterPickerItems(items, "research", null).map((i) => i.id)).toEqual(["a"]);
  });
  it("pins a category, with 'other' for items without one", () => {
    expect(filterPickerItems(items, "", "other").map((i) => i.id)).toEqual(["c"]);
    expect(filterPickerItems(items, "calc", "work")).toEqual([]);
  });
});

describe("pickerCategories", () => {
  it("lists distinct categories sorted, with other last among these", () => {
    expect(pickerCategories(items)).toEqual(["other", "research", "work"]);
  });
});
