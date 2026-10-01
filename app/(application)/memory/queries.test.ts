import { describe, expect, it } from "vitest";

import {
  GET_MEMORY_BASE_UNUSED_IDS, GET_MEMORY_BASE_USAGE, GET_MEMORY_ITEMS, GET_MEMORY_ITEM_BY_ID, GET_MEMORY_USAGE, GET_MEMORY_USAGE_BY_IDS,
  MEMORY_ITEMS_KEY, MEMORY_ITEM_KEY, memoryItemFields, UPDATE_MEMORY_ITEM,
} from "./queries";

const body = (doc: { loc?: { source: { body: string } } }) => doc.loc?.source.body ?? "";

describe("memory item queries", () => {
  it("request the memory fields and the source session only when the base defines it", () => {
    expect(memoryItemFields(false)).toEqual(["information", "type", "created_by"]);
    expect(memoryItemFields(true)).toEqual(["information", "type", "created_by", "source_session"]);
    expect(body(GET_MEMORY_ITEMS("newton_memory_context", false))).not.toContain("source_session");
    expect(body(GET_MEMORY_ITEM_BY_ID("newton_memory_context", true))).toContain("source_session");
  });
  it("request RBAC grants on the detail query only — the list never renders them", () => {
    expect(body(GET_MEMORY_ITEMS("mem", false))).not.toContain("RBAC");
    expect(body(GET_MEMORY_ITEM_BY_ID("mem", false))).toContain("RBAC");
  });
  it("use the generated per-context operations", () => {
    expect(body(GET_MEMORY_ITEMS("mem", false))).toContain("mem_itemsPagination(");
    expect(body(GET_MEMORY_ITEMS("mem", false))).toContain("[FilterMem_items]");
    expect(body(GET_MEMORY_ITEM_BY_ID("mem", false))).toContain("mem_itemsById(");
    expect(MEMORY_ITEMS_KEY("mem")).toBe("mem_itemsPagination");
    expect(MEMORY_ITEM_KEY("mem")).toBe("mem_itemsById");
  });
});

describe("usage documents", () => {
  it("name the usage operations and the generated update mutation", () => {
    expect(body(GET_MEMORY_USAGE_BY_IDS)).toContain("query MemoryUsageByIds");
    expect(body(GET_MEMORY_USAGE)).toContain("query MemoryUsage(");
    expect(body(GET_MEMORY_BASE_USAGE)).toContain("query MemoryBaseUsage");
    expect(body(GET_MEMORY_BASE_UNUSED_IDS)).toContain("query MemoryBaseUnusedIds");
    expect(body(UPDATE_MEMORY_ITEM("mem"))).toContain("mem_itemsUpdateOneById(");
    expect(body(UPDATE_MEMORY_ITEM("mem"))).toContain("generateEmbeddings: false");
  });
});
