import { describe, expect, it, vi } from "vitest";

import {
  INGESTION_CONTEXT_ID,
  INGESTION_ITEM_ID,
} from "@/lib/demo/fixtures/chapter-ingestion";
import { runDemoQueryThroughCache } from "@/lib/demo/test-support";
import { GET_ENTITIES_FOR_ITEM } from "@/queries/queries";

import { GET_ITEM_BY_ID, GET_ITEMS } from "./queries";

/**
 * Chapter 2 claims to show where chapter 1's answer came from. That claim is
 * only true if three things line up, and none of them are visible to tsc:
 *
 *   1. the knowledge base actually returns the nine real documents,
 *   2. the document the chapter opens is the one chapter 1 cites,
 *   3. the chunks come back at all — they are a nested selection on a query
 *      the list view never issues, so nothing else in the suite touches them.
 *
 * Run through the product's own generated documents and a real normalising
 * cache, for the reasons demo-items.test.ts sets out at length: the operation
 * name and the response field differ, and an incomplete cache write is a
 * console error rather than a failure.
 */

const at = { chapter: "ingestion", step: 0 } as const;

const listQuery = GET_ITEMS(INGESTION_CONTEXT_ID, []);
const detailQuery = GET_ITEM_BY_ID(INGESTION_CONTEXT_ID, [], true);

const runList = () =>
  runDemoQueryThroughCache(
    listQuery,
    {
      context: INGESTION_CONTEXT_ID,
      page: 1,
      limit: 11,
      sort: { field: "updatedAt", direction: "DESC" },
      filters: [{ archived: { eq: false } }],
    },
    at,
  );

const runDetail = () =>
  runDemoQueryThroughCache(detailQuery, { id: INGESTION_ITEM_ID }, at);

interface ListItem {
  id: string;
  name: string;
  chunks_count: number;
  last_processed_at: string;
  embeddings_updated_at: string;
}

const listItems = (data: Record<string, unknown>) =>
  (
    data[`${INGESTION_CONTEXT_ID}_itemsPagination`] as {
      items: ListItem[];
    }
  )?.items ?? [];

describe("the knowledge base chapter 2 opens", () => {
  it("returns the whole real context, not a sample", async () => {
    const items = listItems(await runList());

    expect(items).toHaveLength(9);
    // The chunk counts are the deployment's real ones and they sum to the
    // context's real total. If someone trims a document out of the fixture to
    // make it read better, this is what notices.
    expect(items.reduce((sum, i) => sum + i.chunks_count, 0)).toBe(244);
  });

  it("keeps processing and embedding as distinct moments", async () => {
    // demoItem defaults both to createdAt. Chapter 2's second step says the
    // document was read at one time and searchable seventeen seconds later, so
    // if these ever collapse onto one timestamp the narration becomes false.
    const item = listItems(await runList()).find(
      (i) => i.id === INGESTION_ITEM_ID,
    );

    expect(item).toBeTruthy();
    expect(item!.last_processed_at).not.toBe(item!.embeddings_updated_at);
    expect(
      new Date(item!.embeddings_updated_at).getTime() -
        new Date(item!.last_processed_at).getTime(),
    ).toBeGreaterThan(0);
  });

  it("answers the list query completely", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runList();
      expect(spy.mock.calls.map((c) => String(c[0]))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("the library is the same in every chapter", () => {
  // Found by opening /data with a stale ?tour= value, which fell back to
  // chapter 1's world and rendered two invented placeholder documents. The
  // documents belonged to chapter 2's fixture, but getWorld() routes chapters
  // 5, 6 and 7 to chapter 1's world by default — and chapter 1's own answer
  // cites a document in this very context, so the one chapter that most needed
  // the real library was showing a fake one.
  it.each([
    ["techdoc", 0],
    ["ingestion", 0],
    ["config", 0],
    ["memory", 3],
    ["evals", 0],
    ["email", 0],
    ["meetings", 0],
  ])("shows the real documents during chapter %s", async (chapter, step) => {
    const data = await runDemoQueryThroughCache(
      listQuery,
      {
        context: INGESTION_CONTEXT_ID,
        page: 1,
        limit: 11,
        sort: { field: "updatedAt", direction: "DESC" },
        filters: [{ archived: { eq: false } }],
      },
      { chapter, step } as never,
    );

    const items = listItems(data);
    expect(items).toHaveLength(9);
    expect(items.map((i) => i.id)).toContain(INGESTION_ITEM_ID);
    // The placeholders this replaced. Naming them is the point: a generic
    // length check would pass on any nine documents.
    expect(items.map((i) => i.name).join(" ")).not.toMatch(/CTRL-3000|EN 81-20/);
  });
});

describe("the document detail page", () => {
  it("returns the chunks the chapter is about", async () => {
    const data = await runDetail();
    const item = data[`${INGESTION_CONTEXT_ID}_itemsById`] as {
      id: string;
      chunks_count: number;
      chunks: { chunk_id: string; chunk_index: number; chunk_content: string }[];
    };

    expect(item?.id).toBe(INGESTION_ITEM_ID);
    // Ten inline against a count of 93 is not a discrepancy — it is what the
    // product does while server-side chunk pagination is behind a flag, and it
    // prints "showing first N" underneath. See the fixture header.
    expect(item.chunks_count).toBe(93);
    expect(item.chunks).toHaveLength(10);
    expect(item.chunks.map((c) => c.chunk_index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(item.chunks.every((c) => c.chunk_content.length > 0)).toBe(true);
  });

  it("includes the exact chunk chapter 1 cites", async () => {
    // This is the join that makes the chapter honest. techdoc-turns.ts cites
    // chunk 02d50a8f-… of item d92dd3f2-…; if chapter 2 opened a different
    // document, or the same document without that passage, the tour would be
    // saying "here is where the answer came from" over something else.
    const data = await runDetail();
    const item = data[`${INGESTION_CONTEXT_ID}_itemsById`] as {
      chunks: { chunk_id: string }[];
    };

    expect(item.chunks.map((c) => c.chunk_id)).toContain(
      "02d50a8f-e703-4461-9c0c-5ab6c695cdfd",
    );
  });

  it("answers the entities section the page also mounts", async () => {
    // Found in the browser console, not here: the detail page renders an
    // Entities section for every context that has an embedder, and its
    // operation is named `EntitiesForItem<ctx>` — context SUFFIXED, where the
    // items operations are context-prefixed. So it matched neither dynamic
    // pattern, fell through to the unmapped fallback, and logged an Apollo
    // error on the screen chapter 2 ends on.
    //
    // The lesson is about coverage, not about this one query: a test only
    // guards the operations somebody thought to run. runDemoQueryThroughCache
    // throws on the unmapped fallback, so naming the query here is the guard.
    //
    // Empty is the truth, not a shortcut — the real context has zero rows in
    // both its entities and chunk_entities tables.
    const data = await runDemoQueryThroughCache(
      GET_ENTITIES_FOR_ITEM(INGESTION_CONTEXT_ID),
      { item: INGESTION_ITEM_ID },
      at,
    );

    expect(
      data[`${INGESTION_CONTEXT_ID}_itemsEntitiesForItem`],
    ).toEqual([]);
  });

  it("answers every field the chunks selection asks for", async () => {
    // The chunks sub-selection names seven fields. It is the newest and least
    // exercised part of the fixture, and a missing one here is invisible: the
    // table renders, the row is just blank.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runDetail();
      expect(
        spy.mock.calls.map((c) => String(c[0])),
        "Apollo logged while writing the item — most likely a chunk field the selection set asks for.",
      ).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
