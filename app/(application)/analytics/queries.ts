/**
 * Route-local re-exports of the GraphQL operations consumed by /analytics
 * (codebase-structure §3.2: each redesigned route ships a `queries.ts` so
 * the operations a page touches are one grep away).
 *
 * The shared `queries/queries.ts` remains the single declaration site; this
 * module exists purely so consumers in app/(application)/analytics/ can
 * import via a stable in-route path and so future schema-gated additions
 * (e.g. a roles-by-ids hydration query, when
 * ANALYTICS_ROLE_HYDRATION_SUPPORTED flips true) land here.
 */

export {
  GET_AGENT_RUN_STATISTICS,
  GET_AGENT_SESSIONS_STATISTICS,
  GET_AGENT_STATISTICS,
  GET_DONUT_STATISTICS,
  GET_FUNCTION_CALLS_STATISTICS,
  GET_PROJECT_STATISTICS,
  GET_PROJECTS_BY_IDS,
  GET_TIME_SERIES_STATISTICS,
  GET_TOKEN_USAGE_STATISTICS,
  GET_USER_STATISTICS,
  GET_USERS_BY_IDS,
  GET_WORKFLOW_RUNS_STATISTICS,
} from "@/queries/queries";
