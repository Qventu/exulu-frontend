/**
 * Schema-gating flags for /workflows (Routines) — work item 2.12.
 *
 * Every GraphQL field/input/argument NOT already proven in queries/queries.ts
 * lives behind a flag here with a documented fallback path. Precedent:
 * AGENT_FIREWALL_SUPPORTED, PROMPTS_RBAC_TEAMS_SUPPORTED,
 * SKILLS_RBAC_TEAMS_SUPPORTED, KNOWLEDGE_*_SUPPORTED. Unflagged extensions are
 * an automatic must-fix.
 *
 * All flags default to FALSE — the redesign ships honest, then a release flips
 * each flag once the backend confirmation lands.
 */

/**
 * Add `teams { id rights }` to RBAC selections in GET_WORKFLOW_TEMPLATES /
 * GET_WORKFLOW_TEMPLATE_BY_ID / CREATE_WORKFLOW_TEMPLATE / UPDATE_WORKFLOW_TEMPLATE,
 * AND send `teams` in the RBACInput payload.
 *
 * Fallback (false): teams chip + sharing summary hide team counts; team
 * assignments are not persisted; rights mode "teams" downgrades to read-only
 * (the routine becomes inaccessible unless the user is owner — same as today's
 * silent-drop bug, but now explicit and dev-warn-logged once on save).
 *
 * Backend dep: `RBACInput.teams` + `RBAC.teams` exist on workflow_template.
 * (workflows.md §4 — unverified at time of write.)
 */
export const ROUTINES_RBAC_TEAMS_SUPPORTED = false;

/**
 * Embed `lastRun { state createdAt }` in workflow_templatesPagination items.
 *
 * Fallback (false): one combined `GET_JOB_RESULTS` query per visible page,
 * keyed by all visible workflow ids (label contains_any), then mapped to
 * per-id newest. If `contains_any` is unsupported by the backend, degrades to
 * N parallel queries scoped to the page (capped at the page size). NEVER
 * per-row polls — the storm the redesign eliminates.
 */
export const ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED = false;

/**
 * Embed `schedule { schedule next }` in workflow_templatesPagination items.
 *
 * Fallback (false): one combined `GET_WORKFLOW_SCHEDULE` request per visible
 * page; NEVER per-row polls. If the backend has no batch endpoint at all, the
 * column 3 cron chip ships without a chip rather than re-introducing per-row
 * polls — the L1 schedule chip is only honest when fed by batched data.
 */
export const ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED = false;

/**
 * Server-side filtering on last-run state + schedule existence in
 * `FilterWorkflow_template`.
 *
 * Fallback (false): the toolbar status filter is NOT rendered (toolbar = search
 * + view options only). Honest > fake (workflows.md L1 — same sin as UX #9).
 */
export const ROUTINES_STATUS_FILTER_SUPPORTED = false;

/**
 * Server-side sort by `lastRun.createdAt` via the existing `sort` variable on
 * GET_WORKFLOW_TEMPLATES.
 *
 * Fallback (false): the Last Run column has no sort affordance (deletes the
 * no-op sort button — workflows.md UX #9). Default sort (updatedAt DESC) is
 * unaffected because that's already supported.
 */
export const ROUTINES_LAST_RUN_SORT_SUPPORTED = false;

/**
 * Resolve N agent names in one query (`agentsByIds`).
 *
 * Fallback (false): one cache-first `GET_AGENT_BY_ID` per distinct agent id
 * on the visible page, lifted to a single page-level hook (NEVER inside row
 * cells). 10 rows -> <=10 cache-hits-after-first-load, not 30/row.
 */
export const ROUTINES_AGENTS_BATCH_SUPPORTED = false;

/**
 * Email-triggered-routines flags (design 2026-07-15). Defined in
 * lib/routine-runs/flags.ts because shell + runs/chat/configuration features
 * consume them and may not import this feature folder; re-exported here so
 * the workflows feature keeps ONE flag import point. Flip them THERE.
 */
export {
  ROUTINES_EMAIL_TRIGGER_SUPPORTED,
  ROUTINES_RUNS_V2_SUPPORTED,
} from "@/lib/routine-runs/flags";
