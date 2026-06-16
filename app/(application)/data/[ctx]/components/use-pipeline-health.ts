"use client";

/**
 * usePipelineHealth — per-context health/stats probes for the Pipeline tab
 * overview (knowledge V2 Phase F3 / product ask #4). All numbers come from
 * cheap `limit: 1` pagination count probes that read `pageInfo.itemCount`
 * (no rows fetched), so this never fans out a heavy scan.
 *
 * Available today (backend already exposes these):
 *  - total active items          — filter { archived: false }
 *  - "not embedded" / stuck items — filter { chunks_count: { lte: 0 } }
 *    (the backend special-cases lte:0 to match NULL OR 0 chunks)
 *  - stale items                  — filter { embeddings_updated_at: { lte } }
 *
 * Derived: embedded = total − stuck; retrievablePct = embedded / total.
 *
 * Honest-degradation: TOTAL CHUNKS is not summable cheaply (chunk tables
 * aren't GraphQL-registered; no SUM aggregate today — backlog KB-4), so it is
 * reported as `null` and the UI renders "—". When KB-4 ships, wire it here.
 */

import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import * as React from "react";

import type { Context } from "@/types/models/context";

import { GET_ITEMS, PAGINATION_POSTFIX } from "../../queries";

const STALE_DAYS = 30;

interface CountData {
  [key: string]: { pageInfo: { itemCount: number } };
}

function useCount(
  context: string,
  filters: Record<string, unknown>[],
  skip = false,
): { count: number | null; loading: boolean } {
  const { data, loading } = useQuery<CountData>(GET_ITEMS(context, []), {
    skip,
    fetchPolicy: "cache-and-network",
    variables: {
      context,
      page: 1,
      limit: 1,
      sort: { field: "updatedAt", direction: "DESC" },
      filters,
    },
  });
  const count = data?.[context + PAGINATION_POSTFIX]?.pageInfo?.itemCount;
  return { count: typeof count === "number" ? count : null, loading };
}

export interface PipelineHealth {
  totalItems: number | null;
  embeddedItems: number | null;
  stuckItems: number | null;
  staleItems: number | null;
  /** Honest-degraded until backlog KB-4 (no cheap chunk SUM today). */
  totalChunks: number | null;
  retrievablePct: number | null;
  loading: boolean;
}

export function usePipelineHealth(context: Context): PipelineHealth {
  // Stale cutoff is stamped once on mount (Date math is impure during render).
  const [staleCutoff, setStaleCutoff] = React.useState<string | null>(null);
  React.useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - STALE_DAYS);
    setStaleCutoff(d.toISOString());
  }, []);

  const total = useCount(context.id, [{ archived: { eq: false } }]);
  const stuck = useCount(context.id, [
    { archived: { eq: false }, chunks_count: { lte: 0 } },
  ]);
  const stale = useCount(
    context.id,
    [{ archived: { eq: false }, embeddings_updated_at: { lte: staleCutoff } }],
    !staleCutoff,
  );

  return useMemo<PipelineHealth>(() => {
    const totalItems = total.count;
    const stuckItems = stuck.count;
    const embeddedItems =
      totalItems != null && stuckItems != null
        ? Math.max(0, totalItems - stuckItems)
        : null;
    const retrievablePct =
      totalItems != null && totalItems > 0 && embeddedItems != null
        ? Math.round((embeddedItems / totalItems) * 100)
        : totalItems === 0
          ? 100
          : null;
    return {
      totalItems,
      embeddedItems,
      stuckItems,
      staleItems: stale.count,
      totalChunks: null, // KB-4
      retrievablePct,
      loading: total.loading || stuck.loading || stale.loading,
    };
  }, [total.count, total.loading, stuck.count, stuck.loading, stale.count, stale.loading]);
}
