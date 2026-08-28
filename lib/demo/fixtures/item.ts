import type { Item } from "@/types/models/item";

/**
 * Builds a knowledge item that satisfies everything the product's item
 * selection set asks for (ITEM_FIELDS in queries/queries.ts).
 *
 * Fixtures were previously written as plain object literals with only the
 * fields a human thought mattered. That renders — Apollo falls back to the raw
 * network result when a cache write is incomplete — but every absent field logs
 * `Missing field '<x>' while writing result` as a console ERROR. On the chapter
 * 4 payoff screen that was 16 red lines behind the demo. TypeScript could not
 * catch it: every field on `Item` is optional.
 *
 * So the defaults here are not decoration. Omitting one reintroduces the noise,
 * and app/(application)/data/demo-items.test.ts fails on it — that test asserts
 * a silent console across the query, so it also fires if ITEM_FIELDS grows a
 * field this factory does not yet fill.
 */

export interface DemoItemInput {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  chunks_count?: number;
  createdAt: string;
  updatedAt?: string;
  /** Memory-context items carry these; document items do not. */
  type?: string;
  information?: string;
  source?: string;
}

export function demoItem(input: DemoItemInput): Item {
  const updatedAt = input.updatedAt ?? input.createdAt;
  return {
    ...input,
    // Present-but-empty, not undefined: Apollo treats an absent key and an
    // undefined value identically, so `undefined` here is a missing field.
    description: input.description ?? "",
    // Null is what the API returns for an item that was not synced from a
    // source system — which is every item in the tour.
    external_id: null,
    embeddings_updated_at: updatedAt,
    last_processed_at: updatedAt,
    tags: input.tags ?? [],
    chunks_count: input.chunks_count ?? 1,
    updatedAt,
    rights_mode: "public",
    RBAC: { type: "item", users: [], roles: [] },
  };
}
