/**
 * Declarative filter-field definitions for the workspace Items tab and the
 * BulkFilterDialog. The shape matches the FilterPanel primitive contract.
 *
 * Field IDs map 1:1 to the GraphQL keys legacy items-filter.tsx built:
 * - text contains:      name, external_id
 * - datetime gte/lte:   createdAt, updatedAt, embeddings_updated_at, last_processed_at
 * - number-range:       chunks_count
 *
 * The translator function below turns a value-map into the same array of
 * filter objects today's `useContextItems` and `executeSource/bulk`
 * mutations expect (verbatim from items-filter.tsx buildGraphQLFilters).
 *
 * Inventory items #27–#33 (filter fields) and #34/#36/#37 (batch limit,
 * preview, confirm CTA) are owned by the host dialog; this file only
 * declares the schema.
 */

import type { FilterFieldDef } from "@/components/primitives/filter-panel";

export const KNOWLEDGE_ITEMS_FILTER_FIELDS: FilterFieldDef[] = [
  { id: "name", label: "Name", type: "text", graphqlField: "name" },
  {
    id: "external_id",
    label: "External ID",
    type: "text",
    graphqlField: "external_id",
  },
  {
    id: "createdAt",
    label: "Created",
    type: "datetime",
    graphqlField: "createdAt",
  },
  {
    id: "updatedAt",
    label: "Updated",
    type: "datetime",
    graphqlField: "updatedAt",
  },
  {
    id: "embeddings_updated_at",
    label: "Embeddings updated",
    type: "datetime",
    graphqlField: "embeddings_updated_at",
  },
  {
    id: "last_processed_at",
    label: "Last processed",
    type: "datetime",
    graphqlField: "last_processed_at",
  },
  {
    id: "chunks_count",
    label: "Chunks count",
    type: "number-range",
    graphqlField: "chunks_count",
  },
];

export interface KnowledgeFilterValue {
  name?: string;
  external_id?: string;
  createdAt_gte?: string;
  createdAt_lte?: string;
  updatedAt_gte?: string;
  updatedAt_lte?: string;
  embeddings_updated_at_gte?: string;
  embeddings_updated_at_lte?: string;
  last_processed_at_gte?: string;
  last_processed_at_lte?: string;
  chunks_count_gte?: number;
  chunks_count_lte?: number;
  /** Index signature so the value satisfies FilterPanel's generic constraint. */
  [key: string]: string | number | undefined;
}

/**
 * Translate a flat FilterPanel value into the array of GraphQL filter
 * objects the items resolvers expect. Matches today's buildGraphQLFilters
 * exactly (items-filter.tsx:57-99).
 */
export function buildKnowledgeFilters(
  v: KnowledgeFilterValue,
): Record<string, unknown>[] {
  const filters: Record<string, unknown>[] = [];

  if (v.name) filters.push({ name: { contains: v.name } });
  if (v.external_id) filters.push({ external_id: { contains: v.external_id } });
  if (v.createdAt_gte) filters.push({ createdAt: { gte: v.createdAt_gte } });
  if (v.createdAt_lte) filters.push({ createdAt: { lte: v.createdAt_lte } });
  if (v.updatedAt_gte) filters.push({ updatedAt: { gte: v.updatedAt_gte } });
  if (v.updatedAt_lte) filters.push({ updatedAt: { lte: v.updatedAt_lte } });
  if (v.embeddings_updated_at_gte)
    filters.push({
      embeddings_updated_at: { gte: v.embeddings_updated_at_gte },
    });
  if (v.embeddings_updated_at_lte)
    filters.push({
      embeddings_updated_at: { lte: v.embeddings_updated_at_lte },
    });
  if (v.last_processed_at_gte)
    filters.push({ last_processed_at: { gte: v.last_processed_at_gte } });
  if (v.last_processed_at_lte)
    filters.push({ last_processed_at: { lte: v.last_processed_at_lte } });
  if (v.chunks_count_gte !== undefined)
    filters.push({ chunks_count: { gte: v.chunks_count_gte } });
  if (v.chunks_count_lte !== undefined)
    filters.push({ chunks_count: { lte: v.chunks_count_lte } });

  return filters;
}
