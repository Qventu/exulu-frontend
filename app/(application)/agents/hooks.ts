"use client";

/**
 * Data hooks for the /agents index (codebase-structure §3.2: redesigned pages
 * never call useQuery(GET_X) inline; keys/hooks.ts is the reference pattern).
 *
 * useAgentsIndex owns: server-side name search ({name:{contains}}, 300 ms
 * debounce INSIDE the hook), sort (SortBy), and TWO paginated sections —
 * Active and Inactive — each its own AgentsIndex call with an {active:{eq}}
 * filter entry and its own page (PAGE_SIZE 20 — kills the legacy hard
 * limit:100, agents.md review #6). The list is server-paginated, so the split
 * cannot be a client-side regroup of one page (page boundaries would mix the
 * two); the status filter simply skips the section it excludes. Fetch
 * policies + previousData fallback so a page change never blanks a section.
 *
 * useFavouriteAgents owns the per-user star list (users.favourite_agents),
 * mirroring projects/hooks.ts useFavoriteProjects: one module-scoped store so
 * every consumer agrees, re-anchored to the backend on mount, optimistic
 * toggle with a per-id revert, and a by-ids resolve for the cards.
 *
 * The optional category filter from the hook contract is OMITTED:
 * {category:{eq}} has zero existing consumers and could not be
 * introspection-verified (work-item data layer — never invent resolver args).
 *
 * useCreateAgent owns the two-step create: CREATE_AGENT (description
 * defaulted to "" client-side — $description is String!, agents.md item 7) →
 * optional SET_AGENT_INSTRUCTIONS follow-up (existing $instructions arg of
 * agentsUpdateOneById) → resolve with the new id. Follow-up failure: warning
 * toast, still resolve — the agent exists, instructions are editable in the
 * editor, no data loss (never silently dropped).
 */

import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import type { PageInfo } from "@/components/primitives/data-table";
import type { Agent } from "@/types/models/agent";

import { toggleFavouriteId } from "./favourites-utils";
import {
  COPY_AGENT_INDEX,
  CREATE_AGENT,
  GET_AGENTS_INDEX,
  GET_FAVOURITE_AGENTS_BY_IDS,
  GET_USER_FAVOURITE_AGENTS,
  SET_AGENT_INSTRUCTIONS,
  UPDATE_USER_FAVOURITE_AGENTS,
} from "./queries";

export const AGENTS_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export type AgentStatusFilter = "all" | "active" | "inactive";

export interface AgentsSort {
  field: "updatedAt" | "name" | "createdAt";
  direction: "ASC" | "DESC";
}

export const DEFAULT_AGENTS_SORT: AgentsSort = {
  field: "updatedAt",
  direction: "DESC",
};

interface AgentsConnection {
  pageInfo: PageInfo;
  items: Agent[];
}

/** One of the two paginated halves of the index (Active / Inactive). */
export interface AgentsSection {
  agents: Agent[];
  pageInfo: PageInfo | undefined;
  loading: boolean;
  error: Error | undefined;
  /** ADDITIVE to the hook contract: the inline error block needs a Retry
   * action (DataTable's shared error contract, codebase-structure §2.2). */
  refetch: () => void;
  page: number;
  setPage: (p: number) => void;
}

interface AgentsSectionArgs {
  active: boolean;
  term: string;
  sort: AgentsSort;
  page: number;
  setPage: (p: number) => void;
  /** The status filter excludes this section — no request, no rows. */
  skip: boolean;
}

function useAgentsSection({
  active,
  term,
  sort,
  page,
  setPage,
  skip,
}: AgentsSectionArgs): AgentsSection {
  // Filters AND together as array entries (proven shapes only — see queries.ts).
  const filters = React.useMemo(() => {
    const list: Array<Record<string, unknown>> = [{ active: { eq: active } }];
    if (term) list.push({ name: { contains: term } });
    return list;
  }, [active, term]);

  const { data, previousData, loading, error, refetch } = useQuery(
    GET_AGENTS_INDEX,
    {
      fetchPolicy: "cache-first",
      nextFetchPolicy: "network-only",
      skip,
      variables: {
        page,
        limit: AGENTS_PAGE_SIZE,
        filters,
        sort: { field: sort.field, direction: sort.direction },
      },
    },
  );

  // A skipped section must not leak its previousData back into the view.
  const connection: AgentsConnection | undefined = skip
    ? undefined
    : (data?.agentsPagination ?? previousData?.agentsPagination);

  return {
    agents: connection?.items ?? [],
    pageInfo: connection?.pageInfo,
    loading: skip ? false : loading,
    error: skip ? undefined : error,
    refetch,
    page,
    setPage,
  };
}

export function useAgentsIndex(): {
  active: AgentsSection;
  inactive: AgentsSection;
  search: string;
  setSearch: (s: string) => void;
  status: AgentStatusFilter;
  setStatus: (s: AgentStatusFilter) => void;
  sort: AgentsSort;
  setSort: (s: AgentsSort) => void;
} {
  const [activePage, setActivePage] = React.useState(1);
  const [inactivePage, setInactivePage] = React.useState(1);
  const [search, setSearchState] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [status, setStatusState] = React.useState<AgentStatusFilter>("all");
  const [sort, setSortState] = React.useState<AgentsSort>(DEFAULT_AGENTS_SORT);

  const resetPages = React.useCallback(() => {
    setActivePage(1);
    setInactivePage(1);
  }, []);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  // 300 ms debounce lives HERE (the Toolbar consumer passes debounceMs: 0 so
  // the keystroke is never double-debounced); a new term resets both sections
  // to page 1.
  const setSearch = React.useCallback(
    (value: string) => {
      setSearchState(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDebouncedSearch(value);
        resetPages();
      }, SEARCH_DEBOUNCE_MS);
    },
    [resetPages],
  );

  // Filter/sort changes also restart at page 1 (a kept page index can point
  // past the new result set's last page).
  const setStatus = React.useCallback(
    (value: AgentStatusFilter) => {
      setStatusState(value);
      resetPages();
    },
    [resetPages],
  );

  const setSort = React.useCallback(
    (value: AgentsSort) => {
      setSortState(value);
      resetPages();
    },
    [resetPages],
  );

  const term = debouncedSearch.trim();

  const active = useAgentsSection({
    active: true,
    term,
    sort,
    page: activePage,
    setPage: setActivePage,
    skip: status === "inactive",
  });
  const inactive = useAgentsSection({
    active: false,
    term,
    sort,
    page: inactivePage,
    setPage: setInactivePage,
    skip: status === "active",
  });

  return {
    active,
    inactive,
    search,
    setSearch,
    status,
    setStatus,
    sort,
    setSort,
  };
}

/* ------------------- favourites: ONE shared source of truth ------------------- */

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

export function useCreateAgent(): {
  create: (input: {
    name: string;
    model?: string;
    instructions?: string;
  }) => Promise<string>;
  creating: boolean;
} {
  const t = useTranslations("agents");
  const [creating, setCreating] = React.useState(false);

  const [createAgent] = useMutation(CREATE_AGENT);
  const [setInstructions] = useMutation(SET_AGENT_INSTRUCTIONS);

  const create = React.useCallback(
    async (input: {
      name: string;
      model?: string;
      instructions?: string;
    }): Promise<string> => {
      setCreating(true);
      try {
        const result = await createAgent({
          variables: {
            name: input.name,
            // $description is String! on the existing document — sanctioned
            // client-side default (agents.md ladder item 7 / review #18).
            description: "",
            // Hard-coded exactly as today (queries/queries.ts CREATE_AGENT usage).
            rights_mode: "private",
            model: input.model || undefined,
          },
        });
        const id: string | undefined =
          result.data?.agentsCreateOne?.item?.id;
        if (!id) {
          throw new Error(t("createDialog.createFailed"));
        }

        const instructions = input.instructions?.trim();
        if (instructions) {
          try {
            await setInstructions({ variables: { id, instructions } });
          } catch {
            // Partial failure: the agent exists and the field is right there
            // in the editor — warn, never block, never silently drop.
            toast.warning(t("createDialog.instructionsSaveFailed"));
          }
        }

        return id;
      } finally {
        setCreating(false);
      }
    },
    [createAgent, setInstructions, t],
  );

  return { create, creating };
}

/**
 * List-row overflow "Duplicate" (ladder item 33 — also lives in the editor
 * header overflow, editor-owned). Additive hook export beyond the contract's
 * two named hooks; same colocation rule (no inline useMutation in the view).
 * Resolves with the copy's id; the caller navigates to its editor.
 */
export function useDuplicateAgent(): {
  duplicate: (id: string) => Promise<string>;
  duplicating: boolean;
} {
  const t = useTranslations("agents");
  const [duplicating, setDuplicating] = React.useState(false);
  const [copyAgent] = useMutation(COPY_AGENT_INDEX);

  const duplicate = React.useCallback(
    async (id: string): Promise<string> => {
      setDuplicating(true);
      try {
        const result = await copyAgent({ variables: { id } });
        const copyId: string | undefined =
          result.data?.agentsCopyOneById?.item?.id;
        if (!copyId) {
          throw new Error(t("duplicateFailed"));
        }
        return copyId;
      } finally {
        setDuplicating(false);
      }
    },
    [copyAgent, t],
  );

  return { duplicate, duplicating };
}
