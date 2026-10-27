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
 * useFavouriteAgents (re-exported from hooks/use-favourite-agents.ts, shared
 * with /chat) owns the per-user star list — see that module.
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

import type { PageInfo } from "@/components/primitives/data-table";
import type { Agent } from "@/types/models/agent";

import {
  COPY_AGENT_INDEX,
  CREATE_AGENT,
  GET_AGENTS_INDEX,
  SET_AGENT_INSTRUCTIONS,
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

/* ------------------- favourites ------------------- */

/**
 * The star list lives in hooks/use-favourite-agents.ts (shared with /chat's
 * picker — one module store, so both surfaces always agree); re-exported so
 * the index keeps importing from its own hooks module.
 */
export { useFavouriteAgents } from "@/hooks/use-favourite-agents";

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
