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

/**
 * One embedded passage, in the shape the product's `chunks { ... }` selection
 * asks for. Every field is selected, so every field must be present — the same
 * missing-field rule the items themselves are subject to.
 */
export interface DemoChunk {
  chunk_id: string;
  chunk_index: number;
  chunk_content: string;
  chunk_source: string;
  chunk_created_at: string;
  chunk_updated_at: string;
  chunk_metadata: Record<string, unknown>;
}

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
  /**
   * Set for items synced from a source system. Chapter 2's documents come from
   * a storage bucket and carry their object path here; everything else in the
   * tour is unsynced and leaves this null.
   */
  external_id?: string | null;
  /**
   * Default to createdAt, which is right for hand-made fixtures. Chapter 2
   * overrides both: the gap between them — processed at 22:35:01, embedded at
   * 22:35:18 — is the pipeline actually running, and collapsing them onto one
   * timestamp would erase the point of the chapter.
   */
  last_processed_at?: string;
  embeddings_updated_at?: string;
  /**
   * Inline chunks, for items whose detail page the tour opens. Absent on the
   * rest: the list view never selects them.
   */
  chunks?: DemoChunk[];
}

export function demoItem(input: DemoItemInput): Item {
  const updatedAt = input.updatedAt ?? input.createdAt;
  return {
    ...input,
    // Present-but-empty, not undefined: Apollo treats an absent key and an
    // undefined value identically, so `undefined` here is a missing field.
    description: input.description ?? "",
    // Null is what the API returns for an item that was not synced from a
    // source system, which is most of the tour.
    external_id: input.external_id ?? null,
    embeddings_updated_at: input.embeddings_updated_at ?? updatedAt,
    last_processed_at: input.last_processed_at ?? updatedAt,
    tags: input.tags ?? [],
    chunks_count: input.chunks_count ?? 1,
    updatedAt,
    rights_mode: "public",
    RBAC: { type: "item", users: [], roles: [] },
  };
}
