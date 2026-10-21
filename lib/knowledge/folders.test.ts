// Unit tests for the pure knowledge-base folder helpers (normalising API
// rows, sorting, grouping contexts into sections, computing a move, and the
// per-browser collapse state). Modeled on app/(application)/data/pin-utils.ts
// — kept free of React/Apollo so later hook/page tasks can trust this module
// without re-deriving the grouping and move semantics themselves.

import { describe, expect, it } from "vitest";

import {
  COLLAPSED_STORAGE_KEY,
  groupContexts,
  nextFoldersAfterMove,
  normalizeFolder,
  readCollapsed,
  sortFolders,
  writeCollapsed,
  type Folder,
} from "@/lib/knowledge/folders";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const f1: Folder = {
  id: "f1",
  name: "Tenders",
  sort_order: 2,
  context_ids: ["b", "zzz"],
};
const f2: Folder = {
  id: "f2",
  name: "Products",
  sort_order: 1,
  context_ids: ["a", "b"],
};

describe("sortFolders", () => {
  it("sorts ascending by sort_order", () => {
    expect(sortFolders([f1, f2]).map((f) => f.id)).toEqual(["f2", "f1"]);
  });

  it("does not mutate the input array", () => {
    const input = [f1, f2];
    sortFolders(input);
    expect(input.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("treats a missing sort_order as 0", () => {
    const noOrder: Folder = { id: "f3", name: "No order", context_ids: [] };
    expect(sortFolders([f1, noOrder, f2]).map((f) => f.id)).toEqual([
      "f3",
      "f2",
      "f1",
    ]);
  });

  it("breaks a sort_order tie by name (locale compare)", () => {
    expect(
      sortFolders([
        { id: "z", name: "Zebra", sort_order: 0, context_ids: [] },
        { id: "a", name: "Apple", sort_order: 0, context_ids: [] },
      ]).map((f) => f.name),
    ).toEqual(["Apple", "Zebra"]);
  });
});

describe("groupContexts", () => {
  it("assigns a multi-folder context to the first folder by sort order only", () => {
    // "b" is listed in both f1 and f2; f2 sorts first, so it appears there
    // only — this is Review Focus 1 from the brief.
    expect(groupContexts(rows, [f1, f2], "Ungrouped")).toEqual([
      {
        id: "f2",
        name: "Products",
        icon: undefined,
        rows: [{ id: "a" }, { id: "b" }],
      },
      { id: "f1", name: "Tenders", icon: undefined, rows: [] },
      {
        id: null,
        name: "Ungrouped",
        icon: undefined,
        rows: [{ id: "c" }, { id: "d" }],
      },
    ]);
  });

  it("breaks a sort_order tie by name when assigning a multi-folder context", () => {
    const zebra: Folder = {
      id: "fz",
      name: "Zebra",
      sort_order: 0,
      context_ids: ["x"],
    };
    const apple: Folder = {
      id: "fa",
      name: "Apple",
      sort_order: 0,
      context_ids: ["x"],
    };
    expect(groupContexts([{ id: "x" }], [zebra, apple], "Ungrouped")).toEqual([
      { id: "fa", name: "Apple", icon: undefined, rows: [{ id: "x" }] },
      { id: "fz", name: "Zebra", icon: undefined, rows: [] },
    ]);
  });

  it("puts every row under Ungrouped when there are no folders at all", () => {
    expect(groupContexts(rows, [], "Ungrouped")).toEqual([
      { id: null, name: "Ungrouped", icon: undefined, rows },
    ]);
  });

  it("omits Ungrouped when it would be empty and folders exist", () => {
    expect(
      groupContexts(
        [{ id: "a" }],
        [{ id: "f", name: "F", context_ids: ["a"] }],
        "U",
      ),
    ).toEqual([{ id: "f", name: "F", icon: undefined, rows: [{ id: "a" }] }]);
  });
});

describe("nextFoldersAfterMove", () => {
  it("keeps the target's ids unchanged when the context is already a member (target first)", () => {
    expect(nextFoldersAfterMove([f1, f2], "b", "f1")).toEqual([
      { id: "f1", context_ids: ["b", "zzz"] },
      { id: "f2", context_ids: ["a"] },
    ]);
  });

  it("returns only the target when no other folder currently holds the context", () => {
    expect(nextFoldersAfterMove([f1, f2], "c", "f1")).toEqual([
      { id: "f1", context_ids: ["b", "zzz", "c"] },
    ]);
  });

  it("moving to Ungrouped (null target) removes the context from every folder that held it", () => {
    // Review Focus 2: no target entry is added since null isn't a real folder.
    expect(nextFoldersAfterMove([f1, f2], "b", null)).toEqual([
      { id: "f1", context_ids: ["zzz"] },
      { id: "f2", context_ids: ["a"] },
    ]);
  });

  it("does not mutate the input folders' context_ids arrays", () => {
    const before = f1.context_ids.slice();
    nextFoldersAfterMove([f1, f2], "b", "f1");
    expect(f1.context_ids).toEqual(before);
  });
});

describe("normalizeFolder", () => {
  it("parses a JSON-string context_ids list and coerces a string sort_order", () => {
    expect(
      normalizeFolder({
        id: "x",
        name: "N",
        context_ids: '["a","b"]',
        sort_order: "3",
      }),
    ).toEqual({
      id: "x",
      name: "N",
      description: null,
      icon: null,
      sort_order: 3,
      context_ids: ["a", "b"],
    });
  });

  it("defaults a null context_ids and a missing sort_order", () => {
    expect(normalizeFolder({ id: "x", name: "N", context_ids: null })).toEqual({
      id: "x",
      name: "N",
      description: null,
      icon: null,
      sort_order: 0,
      context_ids: [],
    });
  });

  it("falls back to an empty list for corrupt JSON context_ids", () => {
    expect(
      normalizeFolder({ id: "x", name: "N", context_ids: "not json" })
        .context_ids,
    ).toEqual([]);
  });

  it("keeps a real description and icon string", () => {
    const folder = normalizeFolder({
      id: "x",
      name: "N",
      description: "desc",
      icon: "folder-icon",
      context_ids: [],
    });
    expect(folder.description).toBe("desc");
    expect(folder.icon).toBe("folder-icon");
  });
});

describe("readCollapsed / writeCollapsed", () => {
  it("falls back to an empty set for corrupt storage content", () => {
    expect(readCollapsed({ getItem: () => "not json" })).toEqual(new Set());
  });

  it("parses a stored JSON array of ids", () => {
    expect(readCollapsed({ getItem: () => '["f1"]' })).toEqual(new Set(["f1"]));
  });

  it("returns an empty set when there is no storage", () => {
    expect(readCollapsed(null)).toEqual(new Set());
    expect(readCollapsed(undefined)).toEqual(new Set());
  });

  it("swallows a storage read error", () => {
    expect(
      readCollapsed({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual(new Set());
  });

  it("writes the set as a JSON array under the shared storage key", () => {
    const store: Record<string, string> = {};
    writeCollapsed(
      {
        setItem: (k, v) => {
          store[k] = v;
        },
      },
      new Set(["f2"]),
    );
    expect(store[COLLAPSED_STORAGE_KEY]).toBe('["f2"]');
  });

  it("swallows a storage write error (e.g. quota exceeded)", () => {
    expect(() =>
      writeCollapsed(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        new Set(),
      ),
    ).not.toThrow();
  });

  it("no-ops without throwing when there is no storage", () => {
    expect(() => writeCollapsed(null, new Set(["f1"]))).not.toThrow();
    expect(() => writeCollapsed(undefined, new Set(["f1"]))).not.toThrow();
  });
});
