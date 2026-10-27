"use client";

/**
 * useFavouriteAgents — the per-user agent star list (users.favourite_agents),
 * shared by /agents (row star + favourites cards) and /chat (the picker's
 * Favourites section). Mirrors projects/hooks.ts useFavoriteProjects: ONE
 * module-scoped store so every consumer agrees, re-anchored to the backend
 * on mount, optimistic toggle with a per-id revert, and a by-ids resolve for
 * the cards.
 */

import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { toggleFavouriteId } from "@/lib/agents/favourites";
import {
  GET_FAVOURITE_AGENTS_BY_IDS,
  GET_USER_FAVOURITE_AGENTS,
  UPDATE_USER_FAVOURITE_AGENTS,
} from "@/lib/graphql/operations/favourite-agents";
import type { Agent } from "@/types/models/agent";

/**
 * Module-scoped favourites store shared by every `useFavouriteAgents`
 * instance (projects/hooks.ts precedent). UserContext is a once-per-login
 * server snapshot with no setter and no Apollo backing, so seeding
 * component-local state from it would make instances diverge after the first
 * toggle — and the full-array UPDATE write would then silently wipe stars set
 * elsewhere. All instances read this one store: seeded from the snapshot,
 * re-anchored to the backend on mount (GET_USER_FAVOURITE_AGENTS) and
 * advanced by each toggle.
 */
let favouriteIdsStore: string[] | null = null;
let favouriteTogglesInFlight = 0;
const favouriteStoreListeners = new Set<() => void>();

function readFavouriteIdsStore(): string[] | null {
  return favouriteIdsStore;
}

function writeFavouriteIdsStore(ids: string[]) {
  favouriteIdsStore = ids;
  favouriteStoreListeners.forEach((listener) => listener());
}

function subscribeFavouriteIdsStore(listener: () => void): () => void {
  favouriteStoreListeners.add(listener);
  return () => {
    favouriteStoreListeners.delete(listener);
  };
}

/**
 * Per-user agent favourites. The full-array write is always computed from
 * the latest shared state (never a stale per-mount seed); a failed mutation
 * reverts only the toggled agent so a concurrent successful toggle is never
 * clobbered. `favourites` are the resolved rows (by-ids), client-filtered to
 * the current ids so un-starring is instant while the query catches up.
 */
export function useFavouriteAgents(): {
  favouriteIds: string[];
  favourites: Agent[];
  loading: boolean;
  toggleFavourite: (agentId: string) => Promise<void>;
} {
  const { user } = React.useContext(UserContext);
  const userId: number | undefined = user?.id;
  const seed: string[] | undefined = user?.favourite_agents;

  const storeIds = React.useSyncExternalStore(
    subscribeFavouriteIdsStore,
    readFavouriteIdsStore,
    readFavouriteIdsStore,
  );
  // Until the store is first written, fall back to the login-time snapshot.
  const favouriteIds = React.useMemo(
    () => storeIds ?? seed ?? [],
    [storeIds, seed],
  );

  // Re-anchor to the backend on mount: the snapshot can be stale (stars
  // toggled in another tab — or before this page got its own store writes).
  // `userId === undefined`, not `!userId`: the demo user's id is 0.
  const { data: anchor } = useQuery(GET_USER_FAVOURITE_AGENTS, {
    fetchPolicy: "network-only",
    variables: { id: userId },
    skip: userId === undefined,
  });
  React.useEffect(() => {
    const server = anchor?.userById?.favourite_agents;
    // Never clobber an optimistic toggle that is still in flight.
    if (Array.isArray(server) && favouriteTogglesInFlight === 0) {
      writeFavouriteIdsStore(server);
    }
  }, [anchor]);

  const { data, previousData, loading } = useQuery(
    GET_FAVOURITE_AGENTS_BY_IDS,
    {
      fetchPolicy: "cache-and-network",
      variables: { ids: favouriteIds },
      skip: favouriteIds.length === 0,
    },
  );

  const [updateFavourites] = useMutation(UPDATE_USER_FAVOURITE_AGENTS);

  const toggleFavourite = React.useCallback(
    async (agentId: string) => {
      if (userId === undefined) return;
      const base = readFavouriteIdsStore() ?? seed ?? [];
      const removing = base.includes(agentId);
      const next = toggleFavouriteId(base, agentId);
      writeFavouriteIdsStore(next);
      favouriteTogglesInFlight++;
      try {
        const { data: result } = await updateFavourites({
          variables: { id: userId, favourite_agents: next },
        });
        const confirmed = result?.usersUpdateOne?.item?.favourite_agents;
        // Adopt the server-confirmed array — unless a newer toggle is still
        // in flight (its optimistic state supersedes this response).
        if (Array.isArray(confirmed) && favouriteTogglesInFlight === 1) {
          writeFavouriteIdsStore(confirmed);
        }
      } catch (mutationError) {
        // Revert ONLY this agent; concurrent toggles may have advanced the
        // store since.
        const current = readFavouriteIdsStore() ?? [];
        writeFavouriteIdsStore(
          removing
            ? current.includes(agentId)
              ? current
              : [...current, agentId]
            : current.filter((id) => id !== agentId),
        );
        throw mutationError;
      } finally {
        favouriteTogglesInFlight--;
      }
    },
    [seed, updateFavourites, userId],
  );

  const fetched: Agent[] | undefined =
    data?.agentByIds ?? previousData?.agentByIds;
  // Client filter keeps un-starring instant while the query catches up.
  const favourites = React.useMemo(
    () => (fetched ?? []).filter((agent) => favouriteIds.includes(agent.id)),
    [fetched, favouriteIds],
  );

  return { favouriteIds, favourites, loading, toggleFavourite };
}
