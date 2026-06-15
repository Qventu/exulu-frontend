/**
 * Analytics feature schema-gating flags (non-negotiable rule #3 of the
 * /analytics redesign work item; mirrors lib/budget-supported.ts).
 *
 * Centralized truthy flags for client-side feature toggles that depend on a
 * backend extension that has not shipped yet. Each flag MUST be checked in
 * the consuming component and the unsupported branch MUST degrade honestly
 * (documented fallback below each gate).
 *
 * Documented in `design/pages/analytics.md` §4 Risks / Dependencies.
 */

/**
 * P2 own-agent usage path. Today `/analytics` is gated `super_admin` only at
 * both the nav and route levels (components/shell/nav-config.ts → analytics
 * row; lib/route-guard for "analytics"). The page-doc proposes opening it to
 * P2 behind a future `role.analytics:read+` right with server-side
 * agent-scoping of trackingStatistics for non-SA callers. Until backend
 * ships:
 *   - the nav row stays `super_admin`,
 *   - hooks add no scope filter (SA-only callers, every row visible),
 *   - the Users / Roles dimensions remain available (audience is SA-only),
 *   - the constant ships `false` so flipping it is a one-line, one-PR
 *     change once the backend right exists.
 *
 * Fallback: identical to today — SA-only. No UI difference; the gate is the
 * deliverable per rule #3 (documented fallback).
 */
export const ANALYTICS_OWN_AGENT_USAGE_SUPPORTED = false;

/**
 * Backend `trackingStatistics` time-series query — does the resolver honor
 * `limit: 31` when grouping by day, or does it cap silently? The legacy
 * value of `limit: 12` truncates up to 19 day-groups for a 30-day range and
 * the zero-fill disguises the loss as "no activity on those days"
 * (analytics.md UX#2 / bug 2.c).
 *
 * Fallback when capped server-side: the chart degrades to today's behavior
 * (silent truncation at the cap). The companion fix in trend-chart-card.tsx
 * — sending `["inputTokens","outputTokens"]` instead of `[unit]` for the
 * tokens measure — is independent and lands regardless, killing the
 * tokens-fiction half of the bug.
 */
export const ANALYTICS_TIME_SERIES_LIMIT_31_SUPPORTED = true;

/**
 * Roles dimension hydration: the new Breakdown card's Roles tab uses
 * `GET_DONUT_STATISTICS` with `groupBy: "role"`. Rows return raw role IDs
 * (or names, depending on backend tracking writes) and there is no
 * `GET_ROLES_BY_IDS` query in queries/queries.ts today (analytics.md risk
 * #4).
 *
 * Fallback (flag=false): show the raw group value — identical to today's
 * donut behavior with `groupBy: "role"`. When the backend ships
 * `rolesByIds`, this flips to true and the Roles tab adds hydration to
 * `RankedList` matching the Users / Projects pattern.
 */
export const ANALYTICS_ROLE_HYDRATION_SUPPORTED = false;
