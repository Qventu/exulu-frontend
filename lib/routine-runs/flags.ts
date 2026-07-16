/**
 * Schema-gating flags for the email-triggered-routines feature set
 * (design doc 2026-07-15, backend Plans 1+2).
 *
 * These are the canonical definitions. They live in lib/ (not in
 * app/(application)/workflows/schema-flags.ts like the other ROUTINES_*
 * flags) because eslint tier/feature boundaries forbid components/shell and
 * the runs/chat/configuration features from importing the workflows feature.
 * app/(application)/workflows/schema-flags.ts RE-EXPORTS both flags so the
 * workflows feature keeps its single import point.
 *
 * All flags default to FALSE — flip each in ONE place once the backend
 * capability is confirmed by introspection against a deployed backend.
 */

/**
 * Plan-1 runs API: `routineRuns`, `routineRunsNeedingAttentionCount`,
 * `cancelRoutineRun`, `retryRoutineRun`, plus job_results columns
 * trigger/trigger_metadata/session/workflow and states
 * waiting_approval/filtered/cancelled.
 *
 * Gates: RunsSection v2 (workflows feature), the global /runs page + nav
 * entry + sidebar badge, and the chat run-session banner.
 * Fallback (false): RunsSection keeps today's GET_JOB_RESULTS_LIGHT
 * label-substring listing; /runs renders an EmptyState; no nav entry, no
 * badge, no banner.
 */
export const ROUTINES_RUNS_V2_SUPPORTED = false;

/**
 * Plan-2 triggers/config API: `workflowTriggers`,
 * `upsertWorkflowEmailTrigger`, `deleteWorkflowTrigger`,
 * `emailInboundConfig`, `updateEmailInboundConfig`.
 *
 * Gates: the routine workbench TriggersSection and the super-admin
 * /configuration/email surface.
 * Fallback (false): the Triggers section is filtered out of the workbench
 * section list; /configuration/email renders an EmptyState.
 */
export const ROUTINES_EMAIL_TRIGGER_SUPPORTED = false;
