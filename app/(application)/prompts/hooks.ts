"use client";

/**
 * Data hooks for the /prompts surface (codebase-structure §3.2 — redesigned
 * pages never call useQuery inline; agents/hooks.ts is the reference pattern).
 *
 * Owns: server-side name search (300 ms debounce internal), tag+agent filters,
 * sort, pagination, fetch policies, previousData fallback so a page change
 * never blanks the list. The toggle-favorite hook fixes the H2 data-corruption
 * bug by resolving `favoriteId` from the user's own favorites map before
 * deletion.
 *
 * The cross-feature hooks in `hooks/use-prompts.tsx` are LEFT IN PLACE — the
 * chat composer (useIncrementPromptUsage), chat prompt selector (usePrompts),
 * agents form (PromptCard + usePrompts), and agents PromptBrowserSheet
 * (usePrompts, useUniquePromptTags, useUpdatePrompt) all import from there.
 * Moving them would force a same-PR rewrite of those four consumers; keeping
 * them stable is the contract in this work item's brief.
 */

import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import type { PromptLibrary } from "@/types/models/prompt-library";

import {
  CREATE_PROMPT_FAVORITE_INDEX,
  CREATE_PROMPT_INDEX,
  DELETE_PROMPT_FAVORITE_INDEX,
  DELETE_PROMPT_INDEX,
  GET_PROMPTS_INDEX,
  GET_UNIQUE_PROMPT_TAGS_INDEX,
  GET_USER_PROMPT_FAVORITES_INDEX,
  INCREMENT_PROMPT_FAVORITES_INDEX,
  INCREMENT_PROMPT_USAGE_INDEX,
  UPDATE_PROMPT_INDEX,
} from "./queries";

export const PROMPTS_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export interface PromptsSort {
  field:
    | "updatedAt"
    | "createdAt"
    | "favorite_count"
    | "usage_count"
    | "name";
  direction: "ASC" | "DESC";
}

export const DEFAULT_PROMPTS_SORT: PromptsSort = {
  field: "updatedAt",
  direction: "DESC",
};

interface PromptsPageInfo {
  pageCount: number;
  itemCount: number;
  currentPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface PromptsConnection {
  pageInfo: PromptsPageInfo;
  items: PromptLibrary[];
}

export interface UsePromptsIndexParams {
  /** Logged-in user id, used to compute is_favorited per row. */
  userId: number | undefined;
}

export function usePromptsIndex({ userId }: UsePromptsIndexParams) {
  const [page, setPage] = React.useState(1);
  const [search, setSearchState] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [tags, setTagsState] = React.useState<string[]>([]);
  const [agents, setAgentsState] = React.useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnlyState] = React.useState(false);
  const [sort, setSortState] = React.useState<PromptsSort>(DEFAULT_PROMPTS_SORT);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const setSearch = React.useCallback((value: string) => {
    setSearchState(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const setTags = React.useCallback((next: string[]) => {
    setTagsState(next);
    setPage(1);
  }, []);

  const setAgents = React.useCallback((next: string[]) => {
    setAgentsState(next);
    setPage(1);
  }, []);

  const setFavoritesOnly = React.useCallback((next: boolean) => {
    setFavoritesOnlyState(next);
    setPage(1);
  }, []);

  const setSort = React.useCallback((next: PromptsSort) => {
    setSortState(next);
    setPage(1);
  }, []);

  // Filters AND together per array entry (proven shape only — queries.ts).
  const filters = React.useMemo(() => {
    const list: Array<Record<string, unknown>> = [];
    const term = debouncedSearch.trim();
    if (term) list.push({ name: { contains: term } });
    for (const tag of tags) list.push({ tags: { contains: tag } });
    for (const agentId of agents) {
      list.push({ assigned_agents: { contains: agentId } });
    }
    return list;
  }, [debouncedSearch, tags, agents]);

  const { data, previousData, loading, error, refetch } = useQuery(
    GET_PROMPTS_INDEX,
    {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "network-only",
      variables: {
        page,
        limit: PROMPTS_PAGE_SIZE,
        filters,
        sort: { field: sort.field, direction: sort.direction },
      },
    },
  );

  // The user's own favorites. Used to (1) compute is_favorited per row (the
  // backend doesn't denormalize it) and (2) resolve favoriteId for the
  // toggle's delete branch — fixes H2 (the double-create bug from
  // hooks/use-prompts.tsx:163-180 where favoriteId was always undefined).
  const { data: favoritesData, refetch: refetchFavorites } = useQuery(
    GET_USER_PROMPT_FAVORITES_INDEX,
    {
      variables: { user_id: userId ?? 0 },
      skip: !userId,
      fetchPolicy: "cache-first",
    },
  );

  const favoriteIdByPromptId = React.useMemo(() => {
    const map = new Map<string, string>();
    const items: Array<{ id: string; prompt_id: string }> =
      favoritesData?.prompt_favoritesPagination?.items ?? [];
    for (const f of items) map.set(f.prompt_id, f.id);
    return map;
  }, [favoritesData]);

  const connection: PromptsConnection | undefined =
    data?.prompt_libraryPagination ?? previousData?.prompt_libraryPagination;

  // Inject is_favorited per row from the favorites map. The legacy code read
  // `prompt.is_favorited` which the server never sets — the field was always
  // `undefined` before this fix.
  const itemsWithFav: PromptLibrary[] = React.useMemo(
    () =>
      (connection?.items ?? []).map((p) => ({
        ...p,
        is_favorited: favoriteIdByPromptId.has(p.id),
      })),
    [connection?.items, favoriteIdByPromptId],
  );

  // "Favorites only" is a client-side intersection (prompts.md "Spec deltas"
  // explicit: backend filter doesn't exist yet; move server-side when it
  // ships). Applied after the page is fetched — large libraries can yield
  // sparse pages, accepted tradeoff.
  const items = favoritesOnly
    ? itemsWithFav.filter((p) => favoriteIdByPromptId.has(p.id))
    : itemsWithFav;

  return {
    items,
    pageInfo: connection?.pageInfo,
    loading,
    error,
    refetch,
    refetchFavorites,
    page,
    setPage,
    search,
    setSearch,
    tags,
    setTags,
    agents,
    setAgents,
    favoritesOnly,
    setFavoritesOnly,
    sort,
    setSort,
    favoriteIdByPromptId,
  };
}

export function useUniquePromptTagsLocal() {
  return useQuery<{ getUniquePromptTags: string[] }>(
    GET_UNIQUE_PROMPT_TAGS_INDEX,
  );
}

export function useDeletePromptLocal() {
  return useMutation<{ prompt_libraryRemoveOneById: { id: string } }>(
    DELETE_PROMPT_INDEX,
  );
}

export function useUpdatePromptLocal() {
  return useMutation(UPDATE_PROMPT_INDEX);
}

export function useCreatePromptLocal() {
  return useMutation(CREATE_PROMPT_INDEX);
}

export function useIncrementPromptUsageLocal() {
  return useMutation(INCREMENT_PROMPT_USAGE_INDEX);
}

/**
 * Favorite-toggle hook that resolves `favoriteId` from the caller-supplied
 * map BEFORE the delete branch (fixes H2 — the prior implementation in
 * hooks/use-prompts.tsx never resolved favoriteId, so unfavoriting double-
 * created the row and inflated favorite_count).
 *
 * The map comes from `usePromptsIndex({ userId }).favoriteIdByPromptId`;
 * pass it through rather than re-querying inside this hook to keep the
 * source of truth single.
 */
export function useTogglePromptFavoriteLocal() {
  const [createFavorite] = useMutation(CREATE_PROMPT_FAVORITE_INDEX);
  const [deleteFavorite] = useMutation(DELETE_PROMPT_FAVORITE_INDEX);
  const [incrementFavorites] = useMutation(INCREMENT_PROMPT_FAVORITES_INDEX);

  return React.useCallback(
    async (params: {
      promptId: string;
      userId: number;
      isFavorited: boolean;
      currentCount: number;
      favoriteId?: string;
    }) => {
      const { promptId, userId, isFavorited, currentCount, favoriteId } =
        params;
      if (isFavorited) {
        if (!favoriteId) {
          // Defensive: refuse to delete without an id rather than reproducing
          // the legacy double-create bug.
          throw new Error("Missing favoriteId for unfavorite operation");
        }
        await deleteFavorite({ variables: { id: favoriteId } });
        await incrementFavorites({
          variables: {
            id: promptId,
            favorite_count: Math.max(0, currentCount - 1),
          },
        });
      } else {
        await createFavorite({
          variables: { user_id: userId, prompt_id: promptId },
        });
        await incrementFavorites({
          variables: { id: promptId, favorite_count: currentCount + 1 },
        });
      }
    },
    [createFavorite, deleteFavorite, incrementFavorites],
  );
}
