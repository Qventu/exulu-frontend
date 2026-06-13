"use client";

/**
 * Route-local data hooks for /data (Knowledge). Backend contract is
 * preserved: every call delegates to the route-local copies in ./queries.ts
 * (verbatim from queries/queries.ts). Schema-gated reads branch on the
 * KNOWLEDGE_* flags defined in ./queries.ts.
 */

import { useMemo } from "react";
import { useQuery } from "@apollo/client";

import type { Context } from "@/types/models/context";
import type { Item } from "@EXULU_SHARED/models/item";

import {
  GET_CONTEXTS,
  GET_ITEMS,
  GET_ITEM_BY_ID,
  KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED,
  PAGINATION_POSTFIX,
} from "./queries";

// ---------------------------------------------------------------------------
// Context library — /data
// ---------------------------------------------------------------------------

export interface ContextLibraryRow {
  id: string;
  slug?: string | null;
  name: string;
  description?: string | null;
  /** From aggregate when supported; otherwise undefined. */
  itemCount?: number;
  lastIngestedAt?: string;
  failedJobCount?: number;
}

interface GetContextsData {
  contexts: {
    items: (Context & {
      item_count?: number;
      last_ingested_at?: string;
      failed_job_count?: number;
    })[];
  };
}

export function useContextLibrary({ search }: { search: string }): {
  rows: ContextLibraryRow[];
  loading: boolean;
  error?: Error;
} {
  const { data, loading, error } = useQuery<GetContextsData>(GET_CONTEXTS, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "network-only",
  });

  const rows = useMemo<ContextLibraryRow[]>(() => {
    const items = data?.contexts?.items ?? [];
    const filtered = search
      ? items.filter((c) => {
          const haystack = `${c.name} ${c.description ?? ""} ${c.slug ?? ""}`
            .toLowerCase();
          return haystack.includes(search.toLowerCase());
        })
      : items;

    return filtered.map((c): ContextLibraryRow => ({
      id: c.id,
      slug: c.slug ?? null,
      name: c.name,
      description: c.description ?? null,
      itemCount: KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED
        ? c.item_count
        : undefined,
      lastIngestedAt: KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED
        ? c.last_ingested_at
        : undefined,
      failedJobCount: KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED
        ? c.failed_job_count
        : undefined,
    }));
  }, [data, search]);

  return { rows, loading, error };
}

// ---------------------------------------------------------------------------
// Per-context items table — /data/[ctx]?tab=items
// ---------------------------------------------------------------------------

export interface UseContextItemsArgs {
  context: string;
  page: number;
  search?: string;
  archived: boolean;
  advancedFilters: unknown[];
}

export interface UseContextItemsResult {
  items: Item[];
  pageInfo: {
    pageCount: number;
    itemCount: number;
    currentPage: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

export function useContextItems({
  context,
  page,
  search,
  archived,
  advancedFilters,
}: UseContextItemsArgs): UseContextItemsResult {
  const filters: Record<string, unknown>[] =
    advancedFilters.length > 0
      ? [{ archived: { eq: archived } }, ...(advancedFilters as Record<string, unknown>[])]
      : [
          {
            archived: { eq: archived },
            ...(search ? { name: { contains: search } } : {}),
          },
        ];

  const { data, previousData, loading, error, refetch } = useQuery<{
    [key: string]: {
      pageInfo: UseContextItemsResult["pageInfo"];
      items: Item[];
    };
  }>(GET_ITEMS(context, []), {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "network-only",
    variables: {
      context,
      page: page ?? 1,
      limit: 11,
      sort: { field: "updatedAt", direction: "DESC" },
      filters,
    },
  });

  const current = data?.[context + PAGINATION_POSTFIX];
  const prev = previousData?.[context + PAGINATION_POSTFIX];
  const live = current ?? prev;

  return {
    items: live?.items ?? [],
    pageInfo:
      live?.pageInfo ?? {
        pageCount: 0,
        itemCount: 0,
        currentPage: page ?? 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    loading,
    error: error as Error | undefined,
    refetch: () => {
      void refetch();
    },
  };
}

// ---------------------------------------------------------------------------
// Single item detail — /data/[ctx]?item=...
// ---------------------------------------------------------------------------

export interface UseItemDetailArgs {
  context: Context;
  itemId: string | null;
}

export interface UseItemDetailResult {
  item?: Item;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

export function useItemDetail({
  context,
  itemId,
}: UseItemDetailArgs): UseItemDetailResult {
  const fields = useMemo(
    () => (context.fields ?? []).map((f) => f.name),
    [context.fields],
  );

  const { data, loading, error, refetch } = useQuery<{
    [key: string]: Item;
  }>(GET_ITEM_BY_ID(context.id, fields, true), {
    skip: !itemId,
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      context: context.id,
      id: itemId,
    },
  });

  const raw = (
    itemId ? (data as Record<string, unknown> | undefined)?.[context.id + "_itemsById"] : undefined
  ) as (Record<string, unknown> & { tags?: unknown }) | undefined;
  const item = raw
    ? ({
        ...raw,
        tags: Array.isArray(raw.tags)
          ? raw.tags
          : typeof raw.tags === "string" && raw.tags.length > 0
            ? raw.tags.split(",")
            : [],
      } as Item)
    : undefined;

  return {
    item,
    loading,
    error: error as Error | undefined,
    refetch: () => {
      void refetch();
    },
  };
}
