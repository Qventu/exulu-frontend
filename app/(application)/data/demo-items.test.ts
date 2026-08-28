import { describe, expect, it, vi } from "vitest";

import {
  CORRECTION_MEMORY,
  MEMORY_CONTEXT_ID,
  MEMORY_WRITTEN_AT_STEP,
} from "@/lib/demo/fixtures/chapter-memory";
import { runDemoQueryThroughCache } from "@/lib/demo/test-support";
import { GET_ITEMS } from "@/queries/queries";

/**
 * The knowledge table on /data/[ctx] is the payoff screen for chapter 4, and it
 * is the one surface a curl of the SSR HTML cannot check: the route server-
 * renders only the context, then items-table.tsx fetches them client-side.
 *
 * So assert it here, through the product's OWN generated document and a real
 * normalising cache — not a hand-written query and not the raw link. Those two
 * shortcuts hide the two ways this screen goes quietly blank:
 *
 *   1. The operation is `<ctx>Pagination` but the response field is
 *      `<ctx>_itemsPagination`. Hand-writing the query means writing both from
 *      the same wrong assumption.
 *   2. A fixture item missing a field the selection set asks for leaves the
 *      cache diff incomplete, so `useQuery` returns undefined data. Every field
 *      on `Item` is optional, so tsc says nothing.
 *
 * This test lives in the feature rather than beside the demo link because
 * lib/** may not import the legacy queries/queries.ts monolith (eslint
 * banQueriesMonolith), and importing the real document is the entire point.
 * Move it to lib/demo once GET_ITEMS is extracted.
 */

const itemsQuery = GET_ITEMS(MEMORY_CONTEXT_ID, []);

const runAt = (step: number) =>
  runDemoQueryThroughCache(
    itemsQuery,
    {
      context: MEMORY_CONTEXT_ID,
      page: 1,
      limit: 11,
      sort: { field: "updatedAt", direction: "DESC" },
      filters: [{ archived: { eq: false } }],
    },
    { chapter: "memory", step },
  );

const itemsFrom = (data: Record<string, unknown>) =>
  (data[`${MEMORY_CONTEXT_ID}_itemsPagination`] as { items: { id: string; name: string }[] })
    ?.items ?? [];

describe("the memory knowledge table on /data/[ctx]", () => {
  it("returns readable items through the product's own generated query", async () => {
    const data = await runAt(MEMORY_WRITTEN_AT_STEP);
    const items = itemsFrom(data);

    expect(items.length).toBeGreaterThan(0);
    // Named, not just counted: a cache that dropped every field would still
    // hand back the right number of objects.
    expect(items.every((i) => typeof i.name === "string" && i.name.length > 0))
      .toBe(true);
  });

  it("shows the memory the visitor just created, not chapter 1's documents", async () => {
    // The dynamic resolver falls back to `world.items` when a context has no
    // entry in itemsByContext. That fallback is deliberate, but it means a
    // wrongly-keyed world would still fill the table — with technical
    // documents, under a heading that says Newton's memory.
    const items = itemsFrom(await runAt(MEMORY_WRITTEN_AT_STEP));

    expect(items.map((i) => i.id)).toContain(CORRECTION_MEMORY.id);
    expect(items.map((i) => i.name)).toContain(CORRECTION_MEMORY.name);
  });

  it("fills every field the selection set asks for", async () => {
    // Apollo does not fail on an incomplete cache write — it logs a console
    // ERROR per missing field and falls back to the raw network result. So the
    // page still renders and no test notices, while a prospect who opens the
    // console on the payoff screen sees a wall of red. This caught 16 of them
    // (description, external_id, embeddings_updated_at, last_processed_at
    // across four items) before fixtures/item.ts existed.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await runAt(MEMORY_WRITTEN_AT_STEP);
      expect(
        spy.mock.calls.map((c) => String(c[0])),
        "Apollo logged while writing the result — most likely a fixture field the document selects. Decode the go.apollo.dev/c/err URL to see which.",
      ).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("does not show it before the correction has been sent", async () => {
    expect(MEMORY_WRITTEN_AT_STEP).toBeGreaterThan(0);
    const items = itemsFrom(await runAt(MEMORY_WRITTEN_AT_STEP - 1));

    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.id)).not.toContain(CORRECTION_MEMORY.id);
  });
});
