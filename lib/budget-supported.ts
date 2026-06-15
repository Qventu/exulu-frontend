/**
 * Budgets feature schema-gating flags (non-negotiable rule #3 of the
 * /budgets redesign work item).
 *
 * Centralized truthy flags for client-side feature toggles that depend on a
 * backend extension that has not shipped yet. Each flag MUST be checked in
 * the consuming component and the unsupported branch MUST degrade honestly
 * (no client-side fallback that lies about the rest of the dataset).
 *
 * Documented in `design/pages/budgets.md` §4 "Backend contract" /
 * "Dependencies".
 */

/**
 * Status filter on the entity-config table — "Over budget / At risk / OK /
 * No budget". Backend endpoint `GET /admin/budgets/{type}?status=…` is the
 * phase-1 carrier of the monitoring job (budgets.md §4 — phase-1 blocker).
 *
 * Fallback: the status Select is NOT rendered. The L1 "Budgets at risk"
 * AttentionList partially serves the same job from the existing GraphQL
 * scan; client-side sieving of the fetched page is explicitly forbidden
 * (would lie about rows on other pages).
 */
export const BUDGETS_STATUS_FILTER_SUPPORTED = false;

/**
 * Users search by name OR email. Today's GraphQL `FilterUser` only supports
 * per-field `contains`, so a search term targets `email` only (budgets.md
 * Medium UX bug — "Search users by name…" promise is broken). When this
 * flips true, the search input placeholder switches from "by email" to
 * "by name or email" and the underlying filter shape changes accordingly.
 *
 * Fallback: placeholder is honest ("by email…") and the filter targets
 * `email` only — the existing behavior, just with truthful copy.
 */
export const BUDGETS_USER_SEARCH_NAME_OR_EMAIL_SUPPORTED = false;

/**
 * Attribution + timestamps for budget changes — "who set this cap and when".
 * Audit-friendly criterion (6) on the /budgets redesign and a recurring
 * compliance request. Backend would need to extend `BudgetSettings` and the
 * per-entity `BudgetInfo` payloads with `updated_at` / `updated_by` fields
 * AND record an immutable change log. None of those have shipped yet.
 *
 * Fallback: surfaces no attribution UI but renders a single muted
 * "Audit trail unavailable" line in the policy dialog so admins know the
 * gap is acknowledged (rather than silently absent). When this flips true,
 * the dialog should add a quiet "Last changed {date} by {actor}" affordance
 * pulled from the new backend fields.
 */
export const BUDGETS_AUDIT_TRAIL_SUPPORTED = false;
