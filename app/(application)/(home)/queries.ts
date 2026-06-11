import { gql } from "@apollo/client";

/**
 * GraphQL operations for the Home / "Today" dashboard, colocated per
 * design/codebase-structure.md §1.1/§3.2 (work item 2.7).
 *
 * Copies of the dashboard/analytics-consumed operations in queries/queries.ts
 * — identical selections against identical resolvers — so the backend
 * contract is untouched (dashboard.md §4: "No backend changes strictly
 * required (all queries exist)"). The monolith itself is NOT edited; Home
 * simply never imports from it. Two deliberate, recorded differences:
 *
 * 1. GET_TOKEN_USAGE_STATISTICS's monolith copy reuses the operation name
 *    `AgentCallsStatistics` (a known duplicate-name bug, codebase-structure
 *    §3.1). The route-local copy is renamed `TokenUsageStatistics` — same
 *    selection, unique name. Nothing refetches it by string.
 * 2. HOME_AGENT_NAMES / HOME_EVAL_RUNS_COUNT are field SUBSETS of the
 *    monolith's GET_AGENTS / GET_EVAL_RUNS against the same pagination
 *    resolvers — Home only needs id/name (resp. the pageInfo count), not the
 *    full field sets (and unlike GET_AGENTS_WITH_BUDGETS, no per-row LiteLLM
 *    budget lookup is paid). Unique operation names avoid clashing with the
 *    monolith's observers.
 */

// ---------------------------------------------------------------------------
// Region A — Resume (dashboard.md §3 #2)
// ---------------------------------------------------------------------------

/** Verbatim copy of queries/queries.ts GET_AGENT_SESSIONS (GetAgentSessions). */
export const GET_AGENT_SESSIONS = gql`
  query GetAgentSessions(
    $page: Int!
    $limit: Int!
    $filters: [FilterAgent_session]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    agent_sessionsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
          createdAt
          updatedAt
          created_by
          user
          title
          agent
          project
          rights_mode
          session_items
          RBAC {
            type
            users {
              id
              rights
            }
            roles {
              id
              rights
            }
          }
          id
      }
    }
  }
`;

/** Light id→name map for the resume cards (field subset of GET_AGENTS). */
export const HOME_AGENT_NAMES = gql`
  query HomeAgentNames($page: Int!, $limit: Int!) {
    agentsPagination(page: $page, limit: $limit) {
      items {
        id
        name
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Region B — Vitals (24h vs 7-day average; dashboard.md §3 #3)
// Verbatim copies of the "Analytics Dashboard Queries" block.
// ---------------------------------------------------------------------------

export const GET_AGENT_SESSIONS_STATISTICS = gql`
  query AgentSessionsStatistics($from: Date!, $to: Date!) {
    agent_sessionsStatistics(filters: {
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_WORKFLOW_RUNS_STATISTICS = gql`
  query WorkflowRunsStatistics($from: Date!, $to: Date!) {
    jobsStatistics(filters: {
      type: { eq: "workflow" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_AGENT_RUN_STATISTICS = gql`
  query AgentCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(limit: 10, filters: {
      type: { eq: AGENT_RUN }
      name: { eq: "count" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

/** Selection identical to the monolith's GET_TOKEN_USAGE_STATISTICS; renamed op (see header). */
export const GET_TOKEN_USAGE_STATISTICS = gql`
  query TokenUsageStatistics($from: Date!, $to: Date!) {
    trackingStatistics(limit: 10, filters: {
      name: { in: ["inputTokens", "outputTokens"] }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

/** Count-only subset of GET_EVAL_RUNS (role-slot fallback card; see header). */
export const HOME_EVAL_RUNS_COUNT = gql`
  query HomeEvalRunsCount($page: Int!, $limit: Int!, $filters: [FilterEval_run]) {
    eval_runsPagination(page: $page, limit: $limit, filters: $filters) {
      pageInfo {
        itemCount
      }
      items {
        id
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Region C — Needs attention (dashboard.md §3 #4)
// ---------------------------------------------------------------------------

/** Verbatim copy of queries/queries.ts GET_JOB_RESULTS_LIGHT (GetJobResultsLight). */
export const GET_JOB_RESULTS_LIGHT = gql`
  query GetJobResultsLight(
    $page: Int!
    $limit: Int!
    $filters: [FilterJob_result]
    $sort: SortBy = {
      field: "createdAt",
      direction: DESC
    }
  ) {
    job_resultsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      items {
        id
        state
        label
        createdAt
      }
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
    }
  }
`;

// Budget overview — verbatim copies of the queries the /budgets page uses
// (queries/queries.ts "Budget overview queries"). The `budget` field is
// resolved from LiteLLM server-side; Home reuses the exact same contract.

const BUDGET_PAGE_INFO = `
  pageInfo {
    pageCount
    itemCount
    currentPage
    hasPreviousPage
    hasNextPage
  }
`;

export const GET_USERS_WITH_BUDGETS = gql`
  query GetUsersWithBudgets($page: Int!, $limit: Int!, $filters: [FilterUser]) {
    usersPagination(page: $page, limit: $limit, filters: $filters) {
      ${BUDGET_PAGE_INFO}
      items {
        id
        name
        firstname
        type
        lastname
        email
        budget
      }
    }
  }
`;

export const GET_ROLES_WITH_BUDGETS = gql`
  query GetRolesWithBudgets($page: Int!, $limit: Int!, $filters: [FilterRole]) {
    rolesPagination(page: $page, limit: $limit, filters: $filters) {
      ${BUDGET_PAGE_INFO}
      items {
        id
        name
        budget
      }
    }
  }
`;

export const GET_TEAMS_WITH_BUDGETS = gql`
  query GetTeamsWithBudgets($page: Int!, $limit: Int!, $filters: [FilterTeam]) {
    teamsPagination(page: $page, limit: $limit, filters: $filters) {
      ${BUDGET_PAGE_INFO}
      items {
        id
        name
        budget
      }
    }
  }
`;

export const GET_PROJECTS_WITH_BUDGETS = gql`
  query GetProjectsWithBudgets($page: Int!, $limit: Int!, $filters: [FilterProject]) {
    projectsPagination(page: $page, limit: $limit, filters: $filters) {
      ${BUDGET_PAGE_INFO}
      items {
        id
        name
        budget
      }
    }
  }
`;

export const GET_AGENTS_WITH_BUDGETS = gql`
  query GetAgentsWithBudgets($page: Int!, $limit: Int!, $filters: [FilterAgent]) {
    agentsPagination(page: $page, limit: $limit, filters: $filters) {
      ${BUDGET_PAGE_INFO}
      items {
        id
        name
        budget
      }
    }
  }
`;
