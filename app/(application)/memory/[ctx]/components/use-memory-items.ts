"use client";

import { useQuery } from "@apollo/client";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";

import { GET_MEMORY_ITEMS, GET_USERS_BY_IDS, MEMORY_ITEMS_KEY } from "../../queries";
import {
  type MemoryItem, type MemoryListFilters, type UserName, buildMemoryFilters, creatorIds,
} from "./memory-list-data";

export const PAGE_SIZE = 20;

export interface PageInfo { pageCount: number; itemCount: number; currentPage: number; hasPreviousPage: boolean; hasNextPage: boolean }

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
  const filters = React.useMemo(
    () => buildMemoryFilters({ search: args.search, mine: args.mine, userId: user?.id, filters: args.filters }),
    [args.search, args.mine, args.filters, user?.id],
  );
  const query = useQuery<{ [key: string]: { pageInfo: PageInfo; items: MemoryItem[] } }>(
    GET_MEMORY_ITEMS(args.contextId, args.withSourceSession),
    {
      skip: args.skip,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "network-only",
      variables: { page: args.page, limit: PAGE_SIZE, filters, sort: { field: "createdAt", direction: "DESC" } },
    },
  );
  const live = query.data?.[MEMORY_ITEMS_KEY(args.contextId)] ?? query.previousData?.[MEMORY_ITEMS_KEY(args.contextId)];
  const items = live?.items ?? [];
  const ids = creatorIds(items);
  const users = useQuery<{ usersPagination: { items: UserName[] } }>(GET_USERS_BY_IDS, {
    skip: ids.length === 0,
    variables: { ids },
  });
  return {
    items,
    pageInfo: live?.pageInfo ?? { pageCount: 0, itemCount: 0, currentPage: args.page, hasPreviousPage: false, hasNextPage: false },
    users: users.data?.usersPagination.items ?? [],
    loading: query.loading && !query.data,
    error: query.error,
    refetch: () => { void query.refetch(); },
  };
}
