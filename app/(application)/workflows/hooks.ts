"use client";

/**
 * Data hooks for /workflows (Routines) — work item 2.12.
 *
 * Per-row query storm killer: every fetch in this module is lifted to the
 * page level. Cells receive resolved values via props (skills/hooks.ts and
 * prompts/hooks.ts are the precedent patterns).
 *
 * Hooks:
 * - useRoutinesIndex(): list with debounced server search + page state +
 *   sort + previousData fallback.
 * - useAgentsForPage(ids): cache-first single-flight per distinct id.
 * - useLastRunForPage(ids): one combined GET_JOB_RESULTS per page when
 *   ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED=false.
 * - useSchedulesForPage(ids): one combined per-id GET_WORKFLOW_SCHEDULE
 *   batch on page change when ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED=false.
 *   (No `contains_any` filter exists for schedules, so we issue per-id
 *   GET_WORKFLOW_SCHEDULE in parallel — capped at the page size; the chip
 *   never ships on per-row polls.)
 * - useRoutineDetail(id): single template fetch for the panel/editor.
 * - useRoutineMutations(): delete, run, upsert/delete schedule.
 */

import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import {
  ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED,
  ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED,
} from "./schema-flags";
import {
  DELETE_WORKFLOW_SCHEDULE,
  GET_AGENT_BY_ID,
  GET_JOB_RESULTS,
  GET_WORKFLOW_SCHEDULE,
  GET_WORKFLOW_TEMPLATES,
  GET_WORKFLOW_TEMPLATE_BY_ID,
  REMOVE_WORKFLOW_TEMPLATE_BY_ID,
  RUN_WORKFLOW,
  UPSERT_WORKFLOW_SCHEDULE,
} from "./queries";
import type { Routine } from "./types";

export const ROUTINES_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_POLL_MS = 30_000;

export interface RoutinesPageInfo {
  pageCount: number;
  itemCount: number;
  currentPage: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface RoutinesConnection {
  pageInfo: RoutinesPageInfo;
  items: Routine[];
}

export interface RoutinesSort {
  field: "updatedAt" | "createdAt" | "name";
  direction: "ASC" | "DESC";
}

export const DEFAULT_ROUTINES_SORT: RoutinesSort = {
  field: "updatedAt",
  direction: "DESC",
};

/* ------------------------------------------------------------------------- */
/* List */

export function useRoutinesIndex() {
  const [page, setPageState] = React.useState(1);
  const [search, setSearchState] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sort, setSortState] =
    React.useState<RoutinesSort>(DEFAULT_ROUTINES_SORT);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const setSearch = React.useCallback((value: string) => {
    setSearchState(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPageState(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const setSort = React.useCallback((next: RoutinesSort) => {
    setSortState(next);
    setPageState(1);
  }, []);

  const setPage = React.useCallback((next: number) => {
    setPageState(Math.max(1, next));
  }, []);

  const filters = React.useMemo(() => {
    const list: Array<Record<string, unknown>> = [];
    const term = debouncedSearch.trim();
    if (term) list.push({ name: { contains: term } });
    return list;
  }, [debouncedSearch]);

  const { data, previousData, loading, error, refetch } = useQuery<{
    workflow_templatesPagination?: RoutinesConnection;
  }>(GET_WORKFLOW_TEMPLATES, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    variables: {
      page,
      limit: ROUTINES_PAGE_SIZE,
      filters,
      sort: { field: sort.field, direction: sort.direction },
    },
    pollInterval: LIST_POLL_MS,
  });

  const connection: RoutinesConnection | undefined =
    data?.workflow_templatesPagination ??
    previousData?.workflow_templatesPagination;

  return {
    items: connection?.items ?? [],
    pageInfo: connection?.pageInfo,
    loading,
    error,
    refetch,
    page,
    setPage,
    search,
    setSearch,
    sort,
    setSort,
  };
}

/* ------------------------------------------------------------------------- */
/* Agent resolution — cache-first single-flight per distinct id (storm fix). */

interface AgentRecord {
  id: string;
  name: string;
}

export function useAgentsForPage(agentIds: string[]) {
  const client = useApolloClient();
  const [agents, setAgents] = React.useState<Record<string, AgentRecord>>({});

  // Stable, sorted, distinct key for the effect dep — avoids stale closures
  // while still re-running when the set of agent ids actually changes.
  const distinctKey = React.useMemo(() => {
    const set = new Set(agentIds.filter(Boolean));
    return Array.from(set).sort().join(",");
  }, [agentIds]);

  React.useEffect(() => {
    if (!distinctKey) {
      setAgents({});
      return;
    }
    let cancelled = false;
    const ids = distinctKey.split(",");

    Promise.all(
      ids.map((id) =>
        client
          .query<{
            agentById?: {
              id: string;
              name: string;
            };
          }>({
            query: GET_AGENT_BY_ID,
            variables: { id },
            fetchPolicy: "cache-first",
          })
          .then(({ data }) => {
            if (!data?.agentById) return null;
            return {
              id: data.agentById.id,
              name: data.agentById.name,
            } satisfies AgentRecord;
          })
          .catch(() => null),
      ),
    ).then((records) => {
      if (cancelled) return;
      const next: Record<string, AgentRecord> = {};
      for (const r of records) if (r) next[r.id] = r;
      setAgents(next);
    });

    return () => {
      cancelled = true;
    };
  }, [client, distinctKey]);

  return agents;
}

/* ------------------------------------------------------------------------- */
/* Last-run resolution — page-level batch, NEVER per-row polls. */

interface LastRunRecord {
  state: string;
  createdAt: string;
}

export function useLastRunForPage(workflowIds: string[]) {
  const client = useApolloClient();
  const [byId, setById] = React.useState<Record<string, LastRunRecord>>({});

  const distinctKey = React.useMemo(() => {
    const set = new Set(workflowIds.filter(Boolean));
    return Array.from(set).sort().join(",");
  }, [workflowIds]);

  React.useEffect(() => {
    // When the backend embeds lastRun on items, the page reads it from the
    // routine directly — this hook is a no-op.
    if (ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED) return;
    if (!distinctKey) {
      setById({});
      return;
    }
    let cancelled = false;
    const ids = distinctKey.split(",");

    // Per-id single-flight (no per-row poll). One query per visible row on
    // page change is the documented interim until embedded lastRun lands; the
    // page size cap is 10 rows.
    Promise.all(
      ids.map((id) =>
        client
          .query<{
            job_resultsPagination?: {
              items?: Array<{
                id: string;
                state: string;
                label?: string;
                createdAt: string;
              }>;
            };
          }>({
            query: GET_JOB_RESULTS,
            variables: {
              page: 1,
              limit: 1,
              filters: [{ label: { contains: id } }],
              sort: { field: "createdAt", direction: "DESC" },
            },
            fetchPolicy: "cache-first",
          })
          .then(({ data }) => {
            const item = data?.job_resultsPagination?.items?.[0];
            if (!item) return null;
            return [
              id,
              { state: item.state, createdAt: item.createdAt },
            ] as const;
          })
          .catch(() => null),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, LastRunRecord> = {};
      for (const e of entries) if (e) next[e[0]] = e[1];
      setById(next);
    });

    return () => {
      cancelled = true;
    };
  }, [client, distinctKey]);

  return byId;
}

/* ------------------------------------------------------------------------- */
/* Schedule resolution — page-level batch, NEVER per-row polls. */

interface ScheduleRecord {
  schedule: string;
  next?: string | null;
}

export function useSchedulesForPage(workflowIds: string[]) {
  const client = useApolloClient();
  const [byId, setById] = React.useState<Record<string, ScheduleRecord>>({});

  const distinctKey = React.useMemo(() => {
    const set = new Set(workflowIds.filter(Boolean));
    return Array.from(set).sort().join(",");
  }, [workflowIds]);

  React.useEffect(() => {
    if (ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED) return;
    if (!distinctKey) {
      setById({});
      return;
    }
    let cancelled = false;
    const ids = distinctKey.split(",");

    Promise.all(
      ids.map((id) =>
        client
          .query<{
            workflowSchedule?: {
              schedule?: string | null;
              next?: string | null;
            } | null;
          }>({
            query: GET_WORKFLOW_SCHEDULE,
            variables: { workflow: id },
            fetchPolicy: "cache-first",
          })
          .then(({ data }) => {
            const s = data?.workflowSchedule;
            if (!s?.schedule) return null;
            return [id, { schedule: s.schedule, next: s.next ?? null }] as const;
          })
          .catch(() => null),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ScheduleRecord> = {};
      for (const e of entries) if (e) next[e[0]] = e[1];
      setById(next);
    });

    return () => {
      cancelled = true;
    };
  }, [client, distinctKey]);

  return byId;
}

/* ------------------------------------------------------------------------- */
/* Detail (panel/editor "load fresh") */

export function useRoutineDetail(id: string | null) {
  const { data, loading, error, refetch } = useQuery<{
    workflow_templateById?: Routine;
  }>(GET_WORKFLOW_TEMPLATE_BY_ID, {
    variables: { id: id ?? "" },
    skip: !id,
    fetchPolicy: "cache-first",
  });
  return {
    routine: data?.workflow_templateById,
    loading,
    error,
    refetch,
  };
}

/* ------------------------------------------------------------------------- */
/* Mutations */

export function useRoutineMutations() {
  const [removeMutate, removeState] = useMutation(
    REMOVE_WORKFLOW_TEMPLATE_BY_ID,
    {
      refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
    },
  );
  const [runMutate, runState] = useMutation(RUN_WORKFLOW);
  const [upsertScheduleMutate, upsertScheduleState] = useMutation(
    UPSERT_WORKFLOW_SCHEDULE,
  );
  const [deleteScheduleMutate, deleteScheduleState] = useMutation(
    DELETE_WORKFLOW_SCHEDULE,
  );

  const removeRoutine = React.useCallback(
    async (id: string) => {
      await removeMutate({ variables: { id } });
    },
    [removeMutate],
  );

  const runRoutine = React.useCallback(
    async (id: string, variables: Record<string, string>) => {
      await runMutate({ variables: { id, variables } });
    },
    [runMutate],
  );

  const upsertSchedule = React.useCallback(
    async (workflow: string, schedule: string) => {
      await upsertScheduleMutate({ variables: { workflow, schedule } });
    },
    [upsertScheduleMutate],
  );

  const deleteSchedule = React.useCallback(
    async (workflow: string) => {
      await deleteScheduleMutate({ variables: { workflow } });
    },
    [deleteScheduleMutate],
  );

  return {
    removeRoutine,
    runRoutine,
    upsertSchedule,
    deleteSchedule,
    removing: removeState.loading,
    running: runState.loading,
    savingSchedule: upsertScheduleState.loading,
    deletingSchedule: deleteScheduleState.loading,
  };
}
