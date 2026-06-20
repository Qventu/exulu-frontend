"use client";

/**
 * Route-local data hooks for /data (Knowledge). Backend contract is
 * preserved: every call delegates to the route-local copies in ./queries.ts
 * (verbatim from queries/queries.ts). Schema-gated reads branch on the
 * KNOWLEDGE_* flags defined in ./queries.ts.
 */

import * as React from "react";
import { useCallback, useMemo, useRef } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";

import { UserContext } from "@/app/(application)/authenticated";
import type { Context } from "@/types/models/context";
import type { Item } from "@EXULU_SHARED/models/item";

import {
  computeNextFavourites,
  computeNextRecents,
  itemGlobalId,
  parseItemGlobalId,
} from "./pin-utils";

import {
  CONTEXT_ICONS_CONFIG_KEY,
  CREATE_CONTEXT_ICONS,
  GET_CONTEXTS,
  GET_CONTEXT_ICONS,
  GET_ITEMS,
  GET_ITEMS_BY_IDS,
  GET_ITEM_BY_ID,
  GET_USER_CONTEXT_ITEM_FAVOURITES,
  KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED,
  PAGINATION_POSTFIX,
  UPDATE_CONTEXT_ICONS,
  UPDATE_USER_CONTEXT_ITEM_FAVOURITES,
  UPDATE_USER_RECENTLY_VIEWED_ITEMS,
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
// Context icons — shared { [contextId]: glyphName } map persisted in one
// platform_configurations row (see queries.ts). All users read it (to render
// the library glyphs); writes are gated to admins by the calling surface.
// ---------------------------------------------------------------------------

export interface UseContextIconsResult {
  /** contextId → glyph name. Empty until loaded / when none are set. */
  icons: Record<string, string>;
  loading: boolean;
  /** True while a setIcon round-trip is in flight. */
  saving: boolean;
  /** Persist (or clear, with `null`) the icon for one context. */
  setIcon: (contextId: string, name: string | null) => Promise<void>;
}

export function useContextIcons(): UseContextIconsResult {
  const { data, loading, refetch } = useQuery(GET_CONTEXT_ICONS, {
    variables: { config_key: { eq: CONTEXT_ICONS_CONFIG_KEY } },
    fetchPolicy: "cache-first",
  });

  const [createIcons, createState] = useMutation(CREATE_CONTEXT_ICONS);
  const [updateIcons, updateState] = useMutation(UPDATE_CONTEXT_ICONS);

  // Captured at creation so a second save before the refetch lands can never
  // create a duplicate row (mirrors useThemeConfig's createdIdRef).
  const createdIdRef = useRef<string | null>(null);

  const row = data?.platform_configurationsPagination?.items?.[0];
  const configId: string | null = row?.id ?? createdIdRef.current;

  const icons = useMemo<Record<string, string>>(() => {
    const value = row?.config_value;
    return value && typeof value === "object" ? value : {};
  }, [row]);

  const setIcon = useCallback(
    async (contextId: string, name: string | null): Promise<void> => {
      const next = { ...icons };
      if (name) next[contextId] = name;
      else delete next[contextId];

      const configData = {
        config_key: CONTEXT_ICONS_CONFIG_KEY,
        config_value: next,
        description: "Knowledge base library icons",
      };

      if (configId) {
        await updateIcons({ variables: { id: configId, data: configData } });
      } else {
        const result = await createIcons({ variables: { data: configData } });
        const newId: string | undefined =
          result.data?.platform_configurationsCreateOne?.item?.id;
        if (newId) createdIdRef.current = newId;
      }
      await refetch();
    },
    [icons, configId, createIcons, updateIcons, refetch],
  );

  return {
    icons,
    loading,
    saving: createState.loading || updateState.loading,
    setIcon,
  };
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

// ---------------------------------------------------------------------------
// Per-user item pins — Favourites + Recently Viewed (cross-context).
//
// Mirrors the /projects favourites pattern (projects/hooks.ts): the source of
// truth is a module-scoped store shared by every hook instance (index cards,
// table-row stars, the detail-header star, the recents writer all agree), so a
// full-array write never clobbers a star toggled on another surface. The two
// lists are persisted independently via single-column mutations (see
// queries.ts for why a combined mutation would wipe the other column).
//
// Ids are global "<contextId>/<itemId>" strings; names are resolved live by
// useResolvedPinnedItems (one items query per distinct context).
// ---------------------------------------------------------------------------

// Pure list/id helpers live in ./pin-utils (unit-tested); re-exported so the
// existing `../hooks` / `../../hooks` import sites are unaffected.
export {
  RECENTLY_VIEWED_CAP,
  itemGlobalId,
  parseItemGlobalId,
} from "./pin-utils";

interface PinStore {
  read: () => string[] | null;
  write: (ids: string[]) => void;
  subscribe: (listener: () => void) => () => void;
  inFlight: () => number;
  enter: () => void;
  leave: () => void;
}

function createPinStore(): PinStore {
  let value: string[] | null = null;
  let writes = 0;
  const listeners = new Set<() => void>();
  return {
    read: () => value,
    write: (ids) => {
      value = ids;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    inFlight: () => writes,
    enter: () => {
      writes++;
    },
    leave: () => {
      writes--;
    },
  };
}

const favouriteItemsStore = createPinStore();
const recentItemsStore = createPinStore();

// Dedupes the one-time backend re-anchor across concurrently-mounted hooks.
let anchorInFlight: Promise<void> | null = null;

/**
 * Seed both stores from the backend exactly once (the module store then lives
 * for the SPA session). Returning the current arrays lets a toggle/recordView
 * compute its next state from the server truth — never from a still-empty
 * store, which would otherwise overwrite the server list with a single entry.
 */
async function anchorPinStores(
  client: ReturnType<typeof useApolloClient>,
  userId: number,
): Promise<{ favourites: string[]; recents: string[] }> {
  if (favouriteItemsStore.read() === null || recentItemsStore.read() === null) {
    if (!anchorInFlight) {
      anchorInFlight = (async () => {
        try {
          const { data } = await client.query({
            query: GET_USER_CONTEXT_ITEM_FAVOURITES,
            variables: { id: userId },
            fetchPolicy: "network-only",
          });
          const fav = data?.userById?.favourite_items;
          const recent = data?.userById?.recently_viewed_items;
          if (favouriteItemsStore.read() === null && favouriteItemsStore.inFlight() === 0) {
            favouriteItemsStore.write(Array.isArray(fav) ? fav : []);
          }
          if (recentItemsStore.read() === null && recentItemsStore.inFlight() === 0) {
            recentItemsStore.write(Array.isArray(recent) ? recent : []);
          }
        } finally {
          anchorInFlight = null;
        }
      })();
    }
    try {
      await anchorInFlight;
    } catch {
      // Network failure: fall through to whatever the stores hold (or []).
    }
  }
  return {
    favourites: favouriteItemsStore.read() ?? [],
    recents: recentItemsStore.read() ?? [],
  };
}

/**
 * Favourites: shared store + optimistic toggle persisted via the favourites
 * single-column mutation. A failed toggle reverts ONLY the toggled id, so a
 * concurrent successful toggle is never clobbered (projects/hooks.ts pattern).
 */
export function useContextItemFavourites() {
  const { user } = React.useContext(UserContext);
  const userId: number | undefined = user?.id;
  const seed: string[] | undefined = user?.favourite_items;
  const client = useApolloClient();

  const storeIds = React.useSyncExternalStore(
    favouriteItemsStore.subscribe,
    favouriteItemsStore.read,
    favouriteItemsStore.read,
  );
  const favouriteIds = React.useMemo(
    () => storeIds ?? seed ?? [],
    [storeIds, seed],
  );

  // Seed the shared stores from the backend on mount (once per session).
  React.useEffect(() => {
    if (userId) void anchorPinStores(client, userId);
  }, [client, userId]);

  const [updateFavourites] = useMutation(UPDATE_USER_CONTEXT_ITEM_FAVOURITES);

  const isFavorite = React.useCallback(
    (globalId: string) => favouriteIds.includes(globalId),
    [favouriteIds],
  );

  const toggleFavorite = React.useCallback(
    async (globalId: string) => {
      if (!userId) return;
      // Anchor first so `base` is the server truth, not an empty store.
      const { favourites: base } = await anchorPinStores(client, userId);
      const removing = base.includes(globalId);
      const next = computeNextFavourites(base, globalId);
      favouriteItemsStore.write(next);
      favouriteItemsStore.enter();
      try {
        const { data } = await updateFavourites({
          variables: { id: userId, favourite_items: next },
        });
        const confirmed = data?.usersUpdateOne?.item?.favourite_items;
        if (Array.isArray(confirmed) && favouriteItemsStore.inFlight() === 1) {
          favouriteItemsStore.write(confirmed);
        }
      } catch (mutationError) {
        const current = favouriteItemsStore.read() ?? [];
        favouriteItemsStore.write(
          removing
            ? current.includes(globalId)
              ? current
              : [globalId, ...current]
            : current.filter((id) => id !== globalId),
        );
        throw mutationError;
      } finally {
        favouriteItemsStore.leave();
      }
    },
    [client, updateFavourites, userId],
  );

  return { favouriteIds, isFavorite, toggleFavorite };
}

/**
 * Recently viewed: shared store + `recordView` that prepends, de-dupes and
 * caps at RECENTLY_VIEWED_CAP, persisted via the recents single-column
 * mutation. Best-effort — a failed write keeps the optimistic state and the
 * next view retries.
 */
export function useRecentlyViewedItems() {
  const { user } = React.useContext(UserContext);
  const userId: number | undefined = user?.id;
  const seed: string[] | undefined = user?.recently_viewed_items;
  const client = useApolloClient();

  const storeIds = React.useSyncExternalStore(
    recentItemsStore.subscribe,
    recentItemsStore.read,
    recentItemsStore.read,
  );
  const recentIds = React.useMemo(
    () => storeIds ?? seed ?? [],
    [storeIds, seed],
  );

  React.useEffect(() => {
    if (userId) void anchorPinStores(client, userId);
  }, [client, userId]);

  const [updateRecents] = useMutation(UPDATE_USER_RECENTLY_VIEWED_ITEMS);

  const recordView = React.useCallback(
    async (globalId: string) => {
      if (!userId) return;
      const { recents: base } = await anchorPinStores(client, userId);
      // Already most-recent → nothing changed, skip the write.
      if (base[0] === globalId) return;
      const next = computeNextRecents(base, globalId);
      recentItemsStore.write(next);
      recentItemsStore.enter();
      try {
        const { data } = await updateRecents({
          variables: { id: userId, recently_viewed_items: next },
        });
        const confirmed = data?.usersUpdateOne?.item?.recently_viewed_items;
        if (Array.isArray(confirmed) && recentItemsStore.inFlight() === 1) {
          recentItemsStore.write(confirmed);
        }
      } catch {
        // Best-effort; keep optimistic state.
      } finally {
        recentItemsStore.leave();
      }
    },
    [client, updateRecents, userId],
  );

  return { recentIds, recordView };
}

export interface ResolvedPinItem {
  globalId: string;
  contextId: string;
  itemId: string;
  name: string;
}

/**
 * Resolves global ids to display fields live: groups by context and issues one
 * items query per distinct context (id-in filter). Returns items in the order
 * of `ids`, silently dropping any that no longer resolve (deleted/renamed
 * away) so they just don't render. One context failing omits only its items,
 * never the whole section.
 */
export function useResolvedPinnedItems(ids: string[]): {
  items: ResolvedPinItem[];
  loading: boolean;
} {
  const client = useApolloClient();
  const [resolved, setResolved] = React.useState<Map<string, ResolvedPinItem>>(
    () => new Map(),
  );
  const [loading, setLoading] = React.useState(false);

  // Stable dependency: re-resolve only when the id set actually changes.
  const key = ids.join(",");

  React.useEffect(() => {
    const byContext = new Map<string, string[]>();
    for (const globalId of ids) {
      const parts = parseItemGlobalId(globalId);
      if (!parts) continue;
      const list = byContext.get(parts.contextId) ?? [];
      list.push(parts.itemId);
      byContext.set(parts.contextId, list);
    }

    if (byContext.size === 0) {
      setResolved(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const next = new Map<string, ResolvedPinItem>();
      await Promise.all(
        Array.from(byContext.entries()).map(async ([contextId, itemIds]) => {
          try {
            const { data } = await client.query<{
              [key: string]: {
                items: Array<{
                  id: string;
                  name?: string | null;
                  external_id?: string | null;
                }>;
              };
            }>({
              query: GET_ITEMS_BY_IDS(contextId),
              variables: { ids: itemIds, limit: itemIds.length },
              fetchPolicy: "cache-first",
            });
            const rows = data?.[contextId + PAGINATION_POSTFIX]?.items ?? [];
            for (const row of rows) {
              const globalId = itemGlobalId(contextId, row.id);
              next.set(globalId, {
                globalId,
                contextId,
                itemId: row.id,
                name: row.name || row.external_id || row.id,
              });
            }
          } catch {
            // Skip this context; the rest of the section still renders.
          }
        }),
      );
      if (!cancelled) {
        setResolved(next);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `key` captures the id set; `client` is stable. eslint can't see `key`⇒`ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, client]);

  const items = React.useMemo(
    () =>
      ids
        .map((globalId) => resolved.get(globalId))
        .filter((item): item is ResolvedPinItem => Boolean(item)),
    [ids, resolved],
  );

  return { items, loading };
}
