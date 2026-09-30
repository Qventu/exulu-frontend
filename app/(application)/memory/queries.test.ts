import { describe, expect, it } from "vitest";

import { GET_MEMORY_ITEMS, GET_MEMORY_ITEM_BY_ID, MEMORY_ITEMS_KEY, MEMORY_ITEM_KEY, memoryItemFields } from "./queries";

const body = (doc: { loc?: { source: { body: string } } }) => doc.loc?.source.body ?? "";

describe("memory item queries", () => {
  it("request the memory fields and the source session only when the base defines it", () => {
    expect(memoryItemFields(false)).toEqual(["information", "type", "created_by"]);
    expect(memoryItemFields(true)).toEqual(["information", "type", "created_by", "source_session"]);
    expect(body(GET_MEMORY_ITEMS("newton_memory_context", false))).not.toContain("source_session");
    expect(body(GET_MEMORY_ITEM_BY_ID("newton_memory_context", true))).toContain("source_session");
  });
  it("use the generated per-context operations", () => {
    expect(body(GET_MEMORY_ITEMS("mem", false))).toContain("mem_itemsPagination(");
    expect(body(GET_MEMORY_ITEMS("mem", false))).toContain("[FilterMem_items]");
    expect(body(GET_MEMORY_ITEM_BY_ID("mem", false))).toContain("mem_itemsById(");
    expect(MEMORY_ITEMS_KEY("mem")).toBe("mem_itemsPagination");
    expect(MEMORY_ITEM_KEY("mem")).toBe("mem_itemsById");
  });
});
