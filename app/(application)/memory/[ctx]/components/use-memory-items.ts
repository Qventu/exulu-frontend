"use client";

import { useQuery } from "@apollo/client";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";

import {
  GET_MEMORY_BASE_CONTRIBUTORS, GET_MEMORY_BASE_UNUSED_IDS, GET_MEMORY_ITEMS, GET_MEMORY_USAGE_BY_IDS, MEMORY_ITEMS_KEY,
} from "../../queries";
import {
  type MemoryContributor, type MemoryItem, type MemoryListFilters, buildMemoryFilters,
} from "./memory-list-data";
import { type UsageSummary, unusedFilterToMode } from "./usage-data";

export const PAGE_SIZE = 20;

export interface PageInfo { pageCount: number; itemCount: number; currentPage: number; hasPreviousPage: boolean; hasNextPage: boolean }

const emptyPageInfo = (page: number): PageInfo => ({ pageCount: 0, itemCount: 0, currentPage: page, hasPreviousPage: false, hasNextPage: false });

export function useMemoryItems(args: {
  contextId: string;
  withSourceSession: boolean;
  page: number;
  search: string;
  mine: boolean;
  filters: MemoryListFilters;
  skip?: boolean;
}) {
  const { user } = React.useContext(UserContext) as { user?: { id?: number } };

  // Usage filter: resolve the matching ids first — the items query then
  // restricts to them via `buildMemoryFilters({ ids })`.
  const mode = unusedFilterToMode(args.filters.usage);
  const unused = useQuery<{ memoryBaseUnusedIds: string[] }>(GET_MEMORY_BASE_UNUSED_IDS, {
    skip: !mode,
    fetchPolicy: "cache-and-network",
    variables: { contextId: args.contextId, mode, staleDays: 90 },
  });
  const ids = mode ? unused.data?.memoryBaseUnusedIds : undefined;
  // Once the ids are known and there are none, the items query would just
  // come back empty — skip it and render the empty state directly.
  const noMatches = !!mode && !!ids && ids.length === 0;

  const filters = React.useMemo(
    () => buildMemoryFilters({ search: args.search, mine: args.mine, userId: user?.id, filters: args.filters, ids }),
    [args.search, args.mine, args.filters, user?.id, ids],
  );
  const query = useQuery<{ [key: string]: { pageInfo: PageInfo; items: MemoryItem[] } }>(
    GET_MEMORY_ITEMS(args.contextId, args.withSourceSession),
    {
      skip: args.skip || (!!mode && !unused.data) || noMatches,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "network-only",
      variables: { page: args.page, limit: PAGE_SIZE, filters, sort: { field: "createdAt", direction: "DESC" } },
    },
  );
  const live = query.data?.[MEMORY_ITEMS_KEY(args.contextId)] ?? query.previousData?.[MEMORY_ITEMS_KEY(args.contextId)];
  const items = React.useMemo(() => (noMatches ? [] : (live?.items ?? [])), [noMatches, live]);
  // One per-base query for every creator name, independent of the page: it is
  // cheap, cacheable and needs no `users` right (see GET_MEMORY_BASE_CONTRIBUTORS).
  const contributors = useQuery<{ memoryBaseContributors: MemoryContributor[] }>(GET_MEMORY_BASE_CONTRIBUTORS, {
    skip: args.skip,
    fetchPolicy: "cache-first",
    variables: { contextId: args.contextId },
  });

  // One usage lookup for the current page of ids — cheap and keeps the list
  // query itself free of usage fields.
  const itemIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const usage = useQuery<{ memoryUsageByIds: UsageSummary[] }>(GET_MEMORY_USAGE_BY_IDS, {
    skip: itemIds.length === 0,
    fetchPolicy: "cache-and-network",
    variables: { contextId: args.contextId, ids: itemIds },
  });
  const usageById = React.useMemo(
    () => new Map<string, UsageSummary>((usage.data?.memoryUsageByIds ?? []).map((u) => [u.memoryId as string, u])),
    [usage.data],
  );

  return {
    items,
    pageInfo: noMatches ? emptyPageInfo(args.page) : (live?.pageInfo ?? emptyPageInfo(args.page)),
    contributors: contributors.data?.memoryBaseContributors ?? [],
    loading: query.loading && !query.data,
    // The unused-ids query failing would otherwise just read as "no memories
    // match" — surface it through the same error so the table shows the
    // DataTable error state with retry instead of a silent empty state.
    error: query.error ?? unused.error,
    usage: usageById,
    usageError: !!usage.error,
    unusedLoading: !!mode && unused.loading && !unused.data,
    refetch: () => {
      void query.refetch();
      if (mode) void unused.refetch();
      void usage.refetch();
    },
  };
}
