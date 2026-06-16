"use client";

/**
 * usePipelineHealth — per-context health/stats for the Pipeline tab overview
 * (knowledge V2 Phase F3 / product ask #4). One GET_CONTEXT_HEALTH query
 * reads the server-computed aggregates (KB-3/KB-4): item_count, chunk_total,
 * stuck_count (items with 0/NULL chunks), stale_count (embeddings older than
 * 30d). All over non-archived items, computed lazily server-side.
 *
 * Derived: embedded = total − stuck; retrievablePct = embedded / total.
 */

import { useMemo } from "react";
import { useQuery } from "@apollo/client";

import type { Context } from "@/types/models/context";

import { GET_CONTEXT_HEALTH } from "../../queries";

interface HealthData {
  contextById: {
    id: string;
    item_count: number | null;
    chunk_total: number | null;
    stuck_count: number | null;
    stale_count: number | null;
  } | null;
}

export interface PipelineHealth {
  totalItems: number | null;
  embeddedItems: number | null;
  stuckItems: number | null;
  staleItems: number | null;
  totalChunks: number | null;
  retrievablePct: number | null;
  loading: boolean;
}

export function usePipelineHealth(context: Context): PipelineHealth {
  const { data, loading } = useQuery<HealthData>(GET_CONTEXT_HEALTH, {
    variables: { id: context.id },
    fetchPolicy: "cache-and-network",
  });

  return useMemo<PipelineHealth>(() => {
    const agg = data?.contextById;
    const totalItems = agg?.item_count ?? null;
    const stuckItems = agg?.stuck_count ?? null;
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
      staleItems: agg?.stale_count ?? null,
      totalChunks: agg?.chunk_total ?? null,
      retrievablePct,
      loading,
    };
  }, [data, loading]);
}
