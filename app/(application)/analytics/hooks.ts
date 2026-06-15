"use client";

/**
 * Range-scoped data hooks for /analytics (work item 3.3).
 *
 * Mirrors the shape of (home)/hooks.ts useStatPair — current window + an
 * equal-length previous window — but every query takes the lens's `range`
 * (24h / 7d / 14d / 30d / custom) instead of a hardcoded 24h-vs-7d snapshot.
 * Both queries gate `loading`, so the legacy SummaryCard ASI bug
 * (analytics.md bug 2.a / UX#3) cannot reappear by construction.
 *
 * The Lens types + URL (de)serializers live in `./lens` (no "use client")
 * so the server `page.tsx` can call `lensFromSearchParams` without crossing
 * the client boundary. This file re-exports them so existing client
 * consumers (`from "../hooks"`) don't need to change.
 */

import { useQuery, type DocumentNode } from "@apollo/client";
import * as React from "react";

import {
  GET_AGENT_RUN_STATISTICS,
  GET_AGENT_SESSIONS_STATISTICS,
  GET_FUNCTION_CALLS_STATISTICS,
  GET_TOKEN_USAGE_STATISTICS,
  GET_WORKFLOW_RUNS_STATISTICS,
} from "@/queries/queries";

import { resolveWindow, type Lens } from "./lens";

// Back-compat: re-export every public lens API from ./lens so existing
// imports of `from "../hooks"` keep resolving. New code may import directly
// from "../lens".
export {
  BREAKDOWN_VIEWS,
  DEFAULT_DIMENSION,
  DEFAULT_MEASURE,
  DEFAULT_PRESET,
  DEFAULT_TYPE,
  DEFAULT_VIEW,
  DIMENSIONS,
  MAX_RANGE_DAYS,
  MEASURES,
  RANGE_PRESETS,
  lensFromSearchParams,
  lensToSearchParams,
  resolveWindow,
  type BreakdownView,
  type Dimension,
  type Lens,
  type Measure,
  type RangePreset,
  type RangeWindow,
} from "./lens";

// ---------------------------------------------------------------------------
// KPI strip — useRangeStat
// ---------------------------------------------------------------------------

export interface RangeStat {
  /** Total over the lens's current window; null until loaded (or on error). */
  current: number | null;
  /** Total over the equal-length previous window; null until loaded. */
  previous: number | null;
  loading: boolean;
  error: boolean;
}

type StatisticsResult = Record<string, Array<{ group?: string | null; count?: number | null }> | undefined>;

function totalOf(rows: Array<{ count?: number | null }> | undefined): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
}

/**
 * Two parallel queries — current + previous-equal-length — both gate
 * `loading`, so a trend can never render against an unloaded comparator
 * (legacy ASI bug fixed by construction; analytics.md bug 2.a).
 */
function useRangeStat(query: DocumentNode, root: string, lens: Lens, skip = false): RangeStat {
  const window = React.useMemo(() => resolveWindow(lens), [lens]);

  const current = useQuery<StatisticsResult>(query, {
    variables: { from: window.current.from, to: window.current.to },
    skip,
  });
  const previous = useQuery<StatisticsResult>(query, {
    variables: { from: window.previous.from, to: window.previous.to },
    skip,
  });

  const loading = !skip && (current.loading || previous.loading);
  const error = Boolean(current.error || previous.error);

  return {
    current: skip || loading || current.error ? null : totalOf(current.data?.[root]),
    previous: skip || loading || previous.error ? null : totalOf(previous.data?.[root]),
    loading,
    error,
  };
}

export function useSessionsStat(lens: Lens): RangeStat {
  return useRangeStat(GET_AGENT_SESSIONS_STATISTICS, "agent_sessionsStatistics", lens);
}
export function useAgentCallsStat(lens: Lens): RangeStat {
  return useRangeStat(GET_AGENT_RUN_STATISTICS, "trackingStatistics", lens);
}
export function useTokensStat(lens: Lens): RangeStat {
  return useRangeStat(GET_TOKEN_USAGE_STATISTICS, "trackingStatistics", lens);
}
export function useWorkflowRunsStat(lens: Lens): RangeStat {
  return useRangeStat(GET_WORKFLOW_RUNS_STATISTICS, "jobsStatistics", lens);
}
export function useToolCallsStat(lens: Lens): RangeStat {
  return useRangeStat(GET_FUNCTION_CALLS_STATISTICS, "trackingStatistics", lens);
}
