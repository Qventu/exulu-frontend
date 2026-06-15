"use client";

/**
 * Range-scoped data hooks for /analytics — LiteLLM-driven.
 *
 * Calls the backend's /admin/litellm/tag-activity proxy (which attaches
 * LITELLM_MASTER_KEY server-side). One canonical primitive:
 *   - useTagActivity(query) → fetch + cache the full TagActivityResponse
 *
 * Three lens-shaped derivations:
 *   - useActivityTotals(lens) — KPI strip numbers (current + previous window)
 *   - useActivityDaily(lens)  — Trend chart rows
 *   - useActivityByTag(lens)  — Breakdown card rows for the active dimension
 *
 * Each derivation memoises around the lens. Current + previous queries
 * both gate `loading`, so the legacy ASI bug (analytics.md bug 2.a — a
 * trend rendered against an unloaded comparator) cannot reappear by
 * construction.
 *
 * The Lens types + URL (de)serializers live in `./lens` (no "use client")
 * so the server `page.tsx` can call `lensFromSearchParams` without crossing
 * the client boundary. This file re-exports them so existing client
 * consumers (`from "../hooks"`) don't need to change.
 */

import * as React from "react";

import {
  useTagActivity as useTagActivityPrimitive,
  type TagActivityQuery,
  type TagActivityResponse,
  type UseTagActivityResult,
} from "@/lib/litellm-activity";

import {
  CANONICAL_DEDUPE_TAG_PREFIX,
  DIMENSION_TAG_PREFIX,
  resolveWindow,
  type Dimension,
  type Lens,
} from "./lens";
import {
  measureFromByTag,
  measureFromTotals,
  type TagActivityDailyRow,
} from "./queries";

// Re-export the shared types so existing call sites (`from "../hooks"`)
// don't need to know about the lib promotion.
export {
  buildTagActivityPath,
  type TagActivityByModelRow,
  type TagActivityByTagRow,
  type TagActivityDailyRow,
  type TagActivityPagination,
  type TagActivityQuery,
  type TagActivityResponse,
  type TagActivityTotals,
} from "@/lib/litellm-activity";

// Back-compat: re-export every public lens API from ./lens so existing
// imports of `from "../hooks"` keep resolving. New code may import directly
// from "../lens".
export {
  BREAKDOWN_VIEWS,
  CANONICAL_DEDUPE_TAG_PREFIX,
  DEFAULT_DIMENSION,
  DEFAULT_MEASURE,
  DEFAULT_PRESET,
  DEFAULT_VIEW,
  DIMENSIONS,
  DIMENSION_TAG_PREFIX,
  MAX_RANGE_DAYS,
  MEASURES,
  RANGE_PRESETS,
  lensFromSearchParams,
  lensToSearchParams,
  resolveWindow,
  wasRangeReset,
  type BreakdownView,
  type Dimension,
  type Lens,
  type Measure,
  type RangePreset,
  type RangeWindow,
} from "./lens";

// ---------------------------------------------------------------------------
// useTagActivity — re-export of the lib/ primitive
// ---------------------------------------------------------------------------
//
// The implementation moved to `lib/litellm-activity.ts` so Home's
// `useTodayVitals` (a different feature folder) can call the same primitive
// without crossing the feature-boundary lint (codebase-structure §1.2).
// Existing call sites still import `useTagActivity` from this module.

export type { UseTagActivityResult };
export const useTagActivity = useTagActivityPrimitive;

// ---------------------------------------------------------------------------
// useActivityTotals — KPI strip numbers (current + previous window)
// ---------------------------------------------------------------------------

export interface RangeTotalsStat {
  /** Total for the current window; null until loaded (or on error). */
  current: number | null;
  /** Total for the equal-length previous window; null until loaded. */
  previous: number | null;
  loading: boolean;
  error: boolean;
  /** Raw response for the current window (callers may want totals.api_requests etc). */
  currentTotals: TagActivityResponse["totals"] | null;
}

/**
 * Two parallel /tag-activity calls — current + previous-equal-length — both
 * gate `loading`. The legacy SummaryCard ASI bug stays fixed by
 * construction.
 *
 * `measure` selects which field from `totals` to project (spend / tokens /
 * requests). Both calls always slice on the CANONICAL_DEDUPE_TAG_PREFIX so
 * the backend collapses the double-tag duplication (each Exulu LLM call
 * double-tags itself per dimension — id + name); without the slice we'd
 * count both halves and inflate totals.
 */
export function useActivityTotals(
  lens: Lens,
  measureOverride?: "spend" | "tokens" | "requests",
): RangeTotalsStat {
  // `range` (not `window`) to avoid shadowing the global — keeps
  // react-hooks/exhaustive-deps from complaining about a phantom dep.
  const range = React.useMemo(() => resolveWindow(lens), [lens]);

  const currentQuery = React.useMemo<TagActivityQuery>(
    () => ({
      start_date: range.current.from,
      end_date: range.current.to,
      tag_prefix: CANONICAL_DEDUPE_TAG_PREFIX,
    }),
    [range.current.from, range.current.to],
  );
  const previousQuery = React.useMemo<TagActivityQuery>(
    () => ({
      start_date: range.previous.from,
      end_date: range.previous.to,
      tag_prefix: CANONICAL_DEDUPE_TAG_PREFIX,
    }),
    [range.previous.from, range.previous.to],
  );

  const current = useTagActivity(currentQuery);
  const previous = useTagActivity(previousQuery);

  const measure = measureOverride ?? lens.measure;

  const loading = current.loading || previous.loading;
  const error = Boolean(current.error || previous.error);

  return {
    current: loading || current.error ? null : measureFromTotals(current.data?.totals, measure),
    previous: loading || previous.error ? null : measureFromTotals(previous.data?.totals, measure),
    loading,
    error,
    currentTotals: current.data?.totals ?? null,
  };
}

// ---------------------------------------------------------------------------
// useActivityDaily — Trend chart rows
// ---------------------------------------------------------------------------

export interface DailyTrendStat {
  rows: TagActivityDailyRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useActivityDaily(lens: Lens): DailyTrendStat {
  const range = React.useMemo(() => resolveWindow(lens), [lens]);
  const query = React.useMemo<TagActivityQuery>(
    () => ({
      start_date: range.current.from,
      end_date: range.current.to,
      tag_prefix: CANONICAL_DEDUPE_TAG_PREFIX,
    }),
    [range.current.from, range.current.to],
  );
  const { data, loading, error, refetch } = useTagActivity(query);
  return {
    rows: data?.daily ?? [],
    loading,
    error,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// useActivityByTag — Breakdown card rows for the ACTIVE dimension
// ---------------------------------------------------------------------------

export interface BreakdownRow {
  /**
   * Reconciliation id parsed off the tag (stripped of the dimension's
   * `_id_` prefix). null when the tag has no recognised prefix.
   */
  id: string | null;
  /** Raw tag name as LiteLLM reports it (carries prefix). */
  tag: string;
  value: number;
}

export interface BreakdownStat {
  rows: BreakdownRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Breakdown rows for the active dimension. The dimension drives the
 * tag_prefix forwarded to the backend. Totals/daily slice on the
 * CANONICAL_DEDUPE_TAG_PREFIX (deduped global view); the breakdown
 * slices on the dimension's own prefix — so swapping dimensions never
 * refetches the totals.
 */
export function useActivityByTag(lens: Lens): BreakdownStat {
  const range = React.useMemo(() => resolveWindow(lens), [lens]);
  const dimensionPrefix = DIMENSION_TAG_PREFIX[lens.dimension];
  const query = React.useMemo<TagActivityQuery>(
    () => ({
      start_date: range.current.from,
      end_date: range.current.to,
      tag_prefix: dimensionPrefix,
    }),
    [range.current.from, range.current.to, dimensionPrefix],
  );
  const { data, loading, error, refetch } = useTagActivity(query);

  const rows = React.useMemo<BreakdownRow[]>(() => {
    const byTag = data?.byTag ?? [];
    return byTag
      .map((row): BreakdownRow => {
        const id = stripPrefix(row.tag, dimensionPrefix);
        return {
          id,
          tag: row.tag,
          value: measureFromByTag(row, lens.measure),
        };
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data, dimensionPrefix, lens.measure]);

  return { rows, loading, error, refetch };
}

function stripPrefix(tag: string, prefix: string): string | null {
  if (!tag.startsWith(prefix)) return null;
  return tag.slice(prefix.length) || null;
}

// ---------------------------------------------------------------------------
// Convenience export for the breakdown card: which prefix maps to which
// hydration query? The card still hydrates ids → names via GraphQL.
// ---------------------------------------------------------------------------

/** Used by breakdown-chart-card.tsx to decide which hydration query to fire. */
export const HYDRATABLE_DIMENSIONS: ReadonlySet<Dimension> = new Set([
  "agents",
  "users",
  "projects",
  "routines",
]);
