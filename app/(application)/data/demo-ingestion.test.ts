import { describe, expect, it, vi } from "vitest";

import {
  INGESTION_CONTEXT_ID,
  INGESTION_ITEM_ID,
} from "@/lib/demo/fixtures/chapter-ingestion";
import { runDemoQueryThroughCache } from "@/lib/demo/test-support";

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
