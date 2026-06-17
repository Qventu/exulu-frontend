/**
 * Route-local query surface for /analytics.
 *
 * /analytics is 100% LiteLLM-driven — it does NOT touch trackingStatistics.
 * The frontend talks to the backend's purpose-built proxy at
 * `GET /admin/litellm/tag-activity` which attaches the master key
 * server-side (LITELLM_MASTER_KEY is never exposed to the browser).
 *
 * The shared `queries/queries.ts` remains the single declaration site for
 * GraphQL operations consumed across the app; this module declares ONLY:
 *   - the REST URL builder for the new tag-activity endpoint
 *   - the typed Query / Response interfaces shared by hooks.ts and the
 *     downstream chart cards
 *   - re-exports of the id→name hydration GraphQL queries the breakdown
 *     card still needs (users / projects / agents)
 *
 * The breakdown card still hydrates id→name via GraphQL — that's the
 * unique "reconcile LiteLLM tag ids against Postgres rows" boundary.
 *
 * Per the file's docblock contract, every operation /analytics touches is
 * still ONE grep away from this module.
 */

import {
  buildTagActivityPath as buildPath,
  type TagActivityByModelRow as ByModelRow,
  type TagActivityByTagRow as ByTagRow,
  type TagActivityDailyRow as DailyRow,
  type TagActivityPagination as Pagination,
  type TagActivityQuery as Query,
  type TagActivityResponse as Response,
  type TagActivityTotals as Totals,
} from "@/lib/litellm-activity";

import { type Dimension, type Measure } from "./lens";

// ---------------------------------------------------------------------------
// id → name hydration queries (still GraphQL — Postgres is the source of
// truth for entity names; LiteLLM tags only carry stable ids).
// ---------------------------------------------------------------------------

export {
  GET_AGENTS_BY_IDS,
  GET_PROJECTS_BY_IDS,
  GET_ROLES_BY_IDS,
  GET_ROUTINES_BY_IDS,
  GET_TEAMS_BY_IDS,
  GET_USERS_BY_IDS,
} from "@/queries/queries";

// ---------------------------------------------------------------------------
// /admin/litellm/tag-activity — request/response shapes + URL builder
// ---------------------------------------------------------------------------
//
// The shapes + URL builder live in `lib/litellm-activity.ts` so Home and
// Analytics share one source of truth (codebase-structure §1.2 forbids
// cross-feature folder imports). Re-exported here so the "one grep away
// from queries.ts" contract still holds for analytics-local consumers.

export type TagActivityQuery = Query;
export type TagActivityTotals = Totals;
export type TagActivityDailyRow = DailyRow;
export type TagActivityByTagRow = ByTagRow;
export type TagActivityByModelRow = ByModelRow;
export type TagActivityPagination = Pagination;
export type TagActivityResponse = Response;
export const buildTagActivityPath = buildPath;

// ---------------------------------------------------------------------------
// Measure → field projection (single source of truth for "which number on
// each totals/daily/byTag row is THIS measure?").
// ---------------------------------------------------------------------------

export function measureFromTotals(
  totals: TagActivityTotals | null | undefined,
  measure: Measure,
): number | null {
  if (!totals) return null;
  switch (measure) {
    case "spend":
      return totals.spend ?? 0;
    case "tokens":
      return (totals.prompt_tokens ?? 0) + (totals.completion_tokens ?? 0);
    case "requests":
      return totals.successful_requests ?? 0;
  }
}

export function measureFromDaily(row: TagActivityDailyRow, measure: Measure): number {
  switch (measure) {
    case "spend":
      return row.spend ?? 0;
    case "tokens":
      return (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0);
    case "requests":
      return row.successful_requests ?? 0;
  }
}

export function measureFromByTag(row: TagActivityByTagRow, measure: Measure): number {
  switch (measure) {
    case "spend":
      return row.spend ?? 0;
    case "tokens":
      return (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0);
    case "requests":
      return row.successful_requests ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Lens-friendly type re-exports so this module is the one-grep landing site
// for analytics data plumbing.
// ---------------------------------------------------------------------------

export type { Dimension, Measure };
