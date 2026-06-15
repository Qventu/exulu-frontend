/**
 * Route-local GraphQL operations for /budgets — codebase-structure §3 rule:
 * each route imports from its own `queries.ts`, not the global
 * `queries/queries.ts`. To satisfy the colocation rule while keeping ONE
 * wire-level source of truth (rule #2: backend contracts untouchable, no
 * field changes), the constants are re-exported from the global file.
 *
 * Schema-gating (rule #3): no new fields are added to these queries this
 * work item — extensions ride on flags in `lib/budget-supported.ts`.
 */

export {
  GET_AGENTS_WITH_BUDGETS,
  GET_PROJECTS_WITH_BUDGETS,
  GET_ROLES_WITH_BUDGETS,
  GET_TEAMS_WITH_BUDGETS,
  GET_USERS_WITH_BUDGETS,
} from "@/queries/queries";
