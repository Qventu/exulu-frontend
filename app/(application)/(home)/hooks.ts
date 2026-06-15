"use client";

/**
 * Data hooks for the Home / "Today" dashboard (codebase-structure §3.2:
 * redesigned pages never call useQuery inline; hooks own fetch policy and
 * polling cadence).
 *
 * Fan-out mitigation (dashboard.md §4 risks): every source fires in parallel
 * on mount, regions own per-section skeletons, the attention feed polls at
 * 60s (not the legacy widgets' 10s) and the budget scan is capped at the
 * first page per entity type.
 */

import { useQuery, type DocumentNode } from "@apollo/client";
import * as React from "react";

import { useTagActivity } from "@/lib/litellm-activity";
import {
  computeBudgetProjection,
  type BudgetInfo,
  type BudgetLevel,
} from "@/lib/budget";

import {
  GET_AGENT_SESSIONS,
  GET_AGENT_SESSIONS_STATISTICS,
  GET_AGENTS_WITH_BUDGETS,
  GET_JOB_RESULTS_LIGHT,
  GET_PROJECTS_WITH_BUDGETS,
  GET_ROLES_WITH_BUDGETS,
  GET_TEAMS_WITH_BUDGETS,
  GET_USERS_WITH_BUDGETS,
  GET_WORKFLOW_RUNS_STATISTICS,
  HOME_AGENT_NAMES,
  HOME_EVAL_RUNS_COUNT,
} from "./queries";

const ATTENTION_POLL_MS = 60_000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Stable per-mount date anchors (the legacy SummaryCard pattern). */
function useDateAnchors() {
  const [anchors] = React.useState(() => {
    const now = Date.now();
    return {
      now: new Date(now).toISOString(),
      dayAgo: new Date(now - DAY_MS).toISOString(),
      weekAgo: new Date(now - 7 * DAY_MS).toISOString(),
    };
  });
  return anchors;
}

// ---------------------------------------------------------------------------
// Region A — Resume
// ---------------------------------------------------------------------------

export interface ResumeSession {
  id: string;
  agentId: string | null;
  agentName: string | null;
  title: string;
  updatedAt: string;
}

interface SessionsResult {
  agent_sessionsPagination?: {
    items?: Array<{
      id: string;
      title?: string | null;
      updatedAt: string;
      /** The list query may populate `agent` as an id or an object (chat contract). */
      agent?: string | { id?: string; name?: string } | null;
    }> | null;
  } | null;
}

interface AgentNamesResult {
  agentsPagination?: {
    items?: Array<{ id: string; name?: string | null }> | null;
  } | null;
}

export function useResumeSessions(limit = 4): {
  sessions: ResumeSession[];
  loading: boolean;
  error: boolean;
} {
  const sessionsQuery = useQuery<SessionsResult>(GET_AGENT_SESSIONS, {
    variables: { page: 1, limit },
    fetchPolicy: "cache-and-network",
  });
  const agentsQuery = useQuery<AgentNamesResult>(HOME_AGENT_NAMES, {
    variables: { page: 1, limit: 100 },
  });

  const sessions = React.useMemo<ResumeSession[]>(() => {
    const items = sessionsQuery.data?.agent_sessionsPagination?.items ?? [];
    const names = new Map(
      (agentsQuery.data?.agentsPagination?.items ?? []).map((agent) => [
        String(agent.id),
        agent.name ?? null,
      ]),
    );
    return items.map((session) => {
      const agentId =
        typeof session.agent === "string"
          ? session.agent
          : (session.agent?.id ?? null);
      const agentName =
        typeof session.agent === "object" && session.agent?.name
          ? session.agent.name
          : agentId
            ? (names.get(String(agentId)) ?? null)
            : null;
      return {
        id: session.id,
        agentId: agentId ? String(agentId) : null,
        agentName,
        title: session.title ?? "",
        updatedAt: session.updatedAt,
      };
    });
  }, [sessionsQuery.data, agentsQuery.data]);

  return {
    sessions,
    loading: sessionsQuery.loading && !sessionsQuery.data,
    error: Boolean(sessionsQuery.error) && !sessionsQuery.data,
  };
}

// ---------------------------------------------------------------------------
// Region B — Vitals (24h total vs 7-day daily average)
// ---------------------------------------------------------------------------

export interface StatPair {
  /** 24h total; null until loaded (or on error). */
  current: number | null;
  /** 7-day daily average; null until loaded (or on error). */
  average: number | null;
  loading: boolean;
  error: boolean;
}

type StatisticsResult = Record<string, Array<{ group?: string | null; count?: number | null }> | undefined>;

function totalOf(rows: Array<{ count?: number | null }> | undefined): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
}

/**
 * The 24h + 7d query pair behind one StatCard. Fixes the legacy SummaryCard
 * ASI bug by construction: BOTH queries gate `loading`, so a trend is never
 * computed against an unloaded average (dashboard.md UX review #3).
 */
function useStatPair(query: DocumentNode, root: string, skip: boolean): StatPair {
  const dates = useDateAnchors();
  const day = useQuery<StatisticsResult>(query, {
    variables: { from: dates.dayAgo, to: dates.now },
    skip,
  });
  const week = useQuery<StatisticsResult>(query, {
    variables: { from: dates.weekAgo, to: dates.now },
    skip,
  });

  const loading = !skip && (day.loading || week.loading);
  const error = Boolean(day.error || week.error);

  return {
    current: skip || loading || day.error ? null : totalOf(day.data?.[root]),
    average:
      skip || loading || week.error
        ? null
        : Math.round(totalOf(week.data?.[root]) / 7),
    loading,
    error,
  };
}

/**
 * `agent_sessions` is a Postgres-native concept (chat threads). LiteLLM has no
 * session model, so Sessions deliberately stays GraphQL-driven — if that
 * endpoint is ever retired the card silently breaks; see analytics.md §4.
 */
export function useSessionsStat(skip = false): StatPair {
  return useStatPair(GET_AGENT_SESSIONS_STATISTICS, "agent_sessionsStatistics", skip);
}

/**
 * Workflow / routine runs are Postgres `job_results` rows; LiteLLM's tag scheme
 * emits no `workflow_` / `routine_` prefix today (buildTags() honest gap, see
 * design/pages/analytics.md §4), so this card stays GraphQL-driven too.
 */
export function useWorkflowRunsStat(skip: boolean): StatPair {
  return useStatPair(GET_WORKFLOW_RUNS_STATISTICS, "jobsStatistics", skip);
}

// ---------------------------------------------------------------------------
// Region B.2 — Today Vitals via LiteLLM /admin/litellm/tag-activity
// ---------------------------------------------------------------------------
//
// The fetch primitive (`useTagActivity`) is owned by analytics/hooks.ts so
// every LiteLLM-driven surface (Home Vitals + /analytics KPI strip + Trend +
// Breakdown) shares one cache key shape and one ASI-bug-safe loading gate.
// The two hooks used to be a copy-pair; they are now a single primitive
// re-used here.

/** YYYY-MM-DD in UTC — matches the LiteLLM /tag/daily/activity contract. */
function toLiteLLMDate(iso: string): string {
  return iso.slice(0, 10);
}

export interface TodayVitals {
  spend: StatPair;
  tokens: StatPair;
  requests: StatPair;
}

/**
 * Today's LiteLLM-derived StatCards (Spend, Tokens, Requests) — one shared
 * fetch per window (24h + 7d) so the three cards cost two round-trips, not
 * six. Mirrors `useStatPair`'s ASI-bug-safe loading gate: every StatPair is
 * `loading` until BOTH windows resolve.
 *
 * Spend is reported in whatever currency LiteLLM has the model pricing config
 * set to — typically USD. Multi-currency display is a documented follow-up
 * (analytics.md §4 Risks).
 */
export function useTodayVitals(skip = false): TodayVitals {
  const dates = useDateAnchors();
  // LiteLLM /tag/daily/activity is day-granular; we send YYYY-MM-DD.
  const today = toLiteLLMDate(dates.now);
  const dayStart = toLiteLLMDate(dates.dayAgo);
  const weekStart = toLiteLLMDate(dates.weekAgo);

  const dayQuery = React.useMemo(
    () => ({ start_date: dayStart, end_date: today }),
    [dayStart, today],
  );
  const weekQuery = React.useMemo(
    () => ({ start_date: weekStart, end_date: today }),
    [weekStart, today],
  );

  const day = useTagActivity(dayQuery, skip);
  const week = useTagActivity(weekQuery, skip);

  const loading = !skip && (day.loading || week.loading);
  const error = Boolean(day.error || week.error);

  const dayTotals = day.data?.totals;
  const weekTotals = week.data?.totals;
  const ready = !skip && !loading && !error && dayTotals != null && weekTotals != null;

  const pair = (current: number, weekly: number, integer: boolean): StatPair => ({
    current,
    average: integer ? Math.round(weekly / 7) : weekly / 7,
    loading,
    error,
  });

  const empty: StatPair = { current: null, average: null, loading, error };

  return {
    spend: ready
      ? pair(dayTotals!.spend, weekTotals!.spend, false)
      : empty,
    tokens: ready
      ? pair(dayTotals!.total_tokens, weekTotals!.total_tokens, true)
      : empty,
    requests: ready
      ? pair(dayTotals!.successful_requests, weekTotals!.successful_requests, true)
      : empty,
  };
}

interface EvalRunsCountResult {
  eval_runsPagination?: {
    pageInfo?: { itemCount?: number | null } | null;
  } | null;
}

/**
 * Role-slot fallback for "Eval pass rate" (dashboard.md §3 #3): the backend
 * has no pass-rate aggregate (run scores live in per-run job_results), so the
 * card honestly reports the 24h RUN COUNT instead — recorded as the
 * documented fallback.
 */
export function useEvalRunsCount(skip: boolean): {
  count: number | null;
  loading: boolean;
  error: boolean;
} {
  const dates = useDateAnchors();
  const query = useQuery<EvalRunsCountResult>(HOME_EVAL_RUNS_COUNT, {
    variables: {
      page: 1,
      limit: 1,
      filters: [{ createdAt: { gte: dates.dayAgo } }],
    },
    skip,
  });
  const loading = !skip && query.loading;
  return {
    count:
      skip || loading || query.error
        ? null
        : (query.data?.eval_runsPagination?.pageInfo?.itemCount ?? 0),
    loading,
    error: Boolean(query.error),
  };
}

// ---------------------------------------------------------------------------
// Region C — Needs attention
// ---------------------------------------------------------------------------

export interface FailedJob {
  id: string;
  state: "failed" | "stuck";
  label: string | null;
  createdAt: string;
  /** Eval-run jobs are labeled "eval-run-<id>…" (eval-run-column contract). */
  isEval: boolean;
}

interface JobResultsResult {
  job_resultsPagination?: {
    items?: Array<{
      id: string;
      state?: string | null;
      label?: string | null;
      createdAt: string;
    }> | null;
  } | null;
}

/**
 * Failed/stuck background jobs of the last 24h — workflow runs, eval jobs and
 * knowledge embedding/processing jobs all land in `job_results`, so one query
 * covers the doc's three failure sources (the per-context item-error scan is
 * not implementable: context items carry no error-state field — recorded
 * fallback). 60s poll per the doc's fan-out mitigation.
 */
export function useFailedJobs(enabled: boolean): {
  jobs: FailedJob[];
  loading: boolean;
  error: boolean;
} {
  const dates = useDateAnchors();
  const query = useQuery<JobResultsResult>(GET_JOB_RESULTS_LIGHT, {
    variables: {
      page: 1,
      limit: 20,
      filters: [
        {
          state: { in: ["failed", "stuck"] },
          createdAt: { gte: dates.dayAgo },
        },
      ],
    },
    skip: !enabled,
    pollInterval: enabled ? ATTENTION_POLL_MS : 0,
    fetchPolicy: "cache-and-network",
  });

  const jobs = React.useMemo<FailedJob[]>(() => {
    const items = query.data?.job_resultsPagination?.items ?? [];
    return items.map((item) => ({
      id: item.id,
      state: item.state === "stuck" ? "stuck" : "failed",
      label: item.label ?? null,
      createdAt: item.createdAt,
      isEval: Boolean(item.label?.startsWith("eval-run-")),
    }));
  }, [query.data]);

  return {
    jobs,
    loading: enabled && query.loading && !query.data,
    error: Boolean(query.error) && !query.data,
  };
}

export interface BudgetAlert {
  id: string;
  entityType: "user" | "role" | "team" | "project" | "agent";
  name: string;
  level: Exclude<BudgetLevel, "ok">;
  percentUsed: number;
}

interface BudgetEntitiesResult {
  [root: string]:
    | {
        items?: Array<{
          id: string | number;
          name?: string | null;
          firstname?: string | null;
          lastname?: string | null;
          email?: string | null;
          budget?: BudgetInfo | null;
        }> | null;
      }
    | undefined;
}

const BUDGET_SOURCES: Array<{
  entityType: BudgetAlert["entityType"];
  query: DocumentNode;
  root: string;
}> = [
  { entityType: "user", query: GET_USERS_WITH_BUDGETS, root: "usersPagination" },
  { entityType: "role", query: GET_ROLES_WITH_BUDGETS, root: "rolesPagination" },
  { entityType: "team", query: GET_TEAMS_WITH_BUDGETS, root: "teamsPagination" },
  { entityType: "project", query: GET_PROJECTS_WITH_BUDGETS, root: "projectsPagination" },
  { entityType: "agent", query: GET_AGENTS_WITH_BUDGETS, root: "agentsPagination" },
];

/** Display-name fallback chain mirrors the /budgets page label function. */
function entityLabel(item: {
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  id: string | number;
}): string {
  return (
    item.name ||
    [item.firstname, item.lastname].filter(Boolean).join(" ") ||
    item.email ||
    String(item.id)
  );
}

const BUDGET_SCAN_VARIABLES = { page: 1, limit: 20, filters: [] };

/**
 * Budgets at/over their warning band (≥80% used or over-pace/over-budget —
 * lib/budget.ts `computeBudgetProjection`, the same math as /budgets).
 * No aggregate endpoint exists, so this scans the FIRST PAGE (20) of each
 * entity type — the documented fallback (dashboard.md names `budgetsApi`,
 * which has no list method; the GraphQL budget-overview queries are the
 * /budgets page's actual source).
 */
export function useBudgetAlerts(enabled: boolean): {
  alerts: BudgetAlert[];
  loading: boolean;
  error: boolean;
} {
  const options = { variables: BUDGET_SCAN_VARIABLES, skip: !enabled };
  const users = useQuery<BudgetEntitiesResult>(GET_USERS_WITH_BUDGETS, options);
  const roles = useQuery<BudgetEntitiesResult>(GET_ROLES_WITH_BUDGETS, options);
  const teams = useQuery<BudgetEntitiesResult>(GET_TEAMS_WITH_BUDGETS, options);
  const projects = useQuery<BudgetEntitiesResult>(GET_PROJECTS_WITH_BUDGETS, options);
  const agents = useQuery<BudgetEntitiesResult>(GET_AGENTS_WITH_BUDGETS, options);
  const results = [users, roles, teams, projects, agents];

  const alerts = React.useMemo<BudgetAlert[]>(() => {
    if (!enabled) return [];
    const data = [users.data, roles.data, teams.data, projects.data, agents.data];
    const rows: BudgetAlert[] = [];
    BUDGET_SOURCES.forEach(({ entityType, root }, index) => {
      const items = data[index]?.[root]?.items ?? [];
      for (const item of items) {
        if (!item.budget) continue;
        const projection = computeBudgetProjection(item.budget);
        if (projection.level === "ok") continue;
        rows.push({
          id: `${entityType}-${item.id}`,
          entityType,
          name: entityLabel(item),
          level: projection.level,
          percentUsed: Math.round(projection.percentUsed),
        });
      }
    });
    // Worst first, then by usage.
    return rows.sort((a, b) =>
      a.level === b.level
        ? b.percentUsed - a.percentUsed
        : a.level === "over"
          ? -1
          : 1,
    );
  }, [enabled, users.data, roles.data, teams.data, projects.data, agents.data]);

  return {
    alerts,
    loading: enabled && results.some((result) => result.loading && !result.data),
    error: enabled && results.every((result) => Boolean(result.error)),
  };
}
