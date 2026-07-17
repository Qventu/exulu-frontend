/**
 * Route-local GraphQL operations for /workflows (Routines) — work item 2.12.
 *
 * RULES:
 * - Operations are semantic copies of queries/queries.ts (do NOT edit the
 *   global). Any extension beyond the proven shape is gated by a
 *   ROUTINES_*_SUPPORTED flag from `./schema-flags.ts`, with a documented
 *   fallback path in `./hooks.ts`.
 * - `agentName` is NOT a real field — agent resolution lives in
 *   `useAgentsForPage(ids)` via GET_AGENT_BY_ID single-flight cache lookups.
 * - `lastRun` / `schedule` embedding ride their dedicated flags; absent flags
 *   mean the list query selection is identical to today's.
 */

import { gql } from "@apollo/client";

import {
  ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED,
  ROUTINES_RBAC_TEAMS_SUPPORTED,
  ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED,
} from "./schema-flags";

/* ------------------------------------------------------------------------- */
/* Composable selection fragments (kept inline — no shared GraphQL fragments
   needed yet; flag-gated extensions are easier to read here.) */

const RBAC_SELECTION = `
  type
  users { id rights }
  roles { id rights }
  ${ROUTINES_RBAC_TEAMS_SUPPORTED ? "teams { id rights }" : ""}
`;

const TEMPLATE_ITEM_SELECTION = `
  id
  agent
  name
  description
  rights_mode
  created_by
  steps_json
  variables
  createdAt
  updatedAt
  RBAC {
    ${RBAC_SELECTION}
  }
  ${ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED ? "lastRun { state createdAt }" : ""}
  ${ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED ? "schedule { schedule next }" : ""}
`;

/* ------------------------------------------------------------------------- */
/* List + detail */

export const GET_WORKFLOW_TEMPLATES = gql`
  query GetWorkflowTemplates(
    $page: Int!
    $limit: Int!
    $filters: [FilterWorkflow_template]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    workflow_templatesPagination(
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
        ${TEMPLATE_ITEM_SELECTION}
      }
    }
  }
`;

export const GET_WORKFLOW_TEMPLATE_BY_ID = gql`
  query GetWorkflowTemplateById($id: ID!) {
    workflow_templateById(id: $id) {
      id
      name
      agent
      description
      rights_mode
      steps_json
      variables
      createdAt
      updatedAt
      RBAC {
        ${RBAC_SELECTION}
      }
    }
  }
`;

/* ------------------------------------------------------------------------- */
/* Mutations */

export const CREATE_WORKFLOW_TEMPLATE = gql`
  mutation CreateWorkflowTemplate(
    $name: String!
    $description: String
    $rights_mode: String!
    $RBAC: RBACInput
    $agent: String!
    $steps_json: JSON!
  ) {
    workflow_templatesCreateOne(
      input: {
        name: $name
        description: $description
        rights_mode: $rights_mode
        agent: $agent
        RBAC: $RBAC
        steps_json: $steps_json
      }
    ) {
      item {
        id
        name
        description
        rights_mode
        created_by
        variables
        RBAC {
          ${RBAC_SELECTION}
        }
        steps_json
        createdAt
        agent
        updatedAt
      }
    }
  }
`;

export const UPDATE_WORKFLOW_TEMPLATE = gql`
  mutation UpdateWorkflowTemplate(
    $id: ID!
    $name: String
    $description: String
    $rights_mode: String
    $RBAC: RBACInput
    $steps_json: JSON
    $agent: String
  ) {
    workflow_templatesUpdateOneById(
      id: $id
      input: {
        name: $name
        description: $description
        rights_mode: $rights_mode
        RBAC: $RBAC
        steps_json: $steps_json
        agent: $agent
      }
    ) {
      item {
        id
        name
        description
        created_by
        rights_mode
        agent
        variables
        RBAC {
          ${RBAC_SELECTION}
        }
        steps_json
        createdAt
        updatedAt
      }
    }
  }
`;

export const REMOVE_WORKFLOW_TEMPLATE_BY_ID = gql`
  mutation RemoveWorkflowTemplateById($id: ID!) {
    workflow_templatesRemoveOneById(id: $id) {
      id
    }
  }
`;

export const RUN_WORKFLOW = gql`
  mutation RunWorkflow($id: ID!, $variables: JSON!) {
    runWorkflow(id: $id, variables: $variables) {
      result
      job
      metadata
    }
  }
`;

/* ------------------------------------------------------------------------- */
/* Schedule */

export const GET_WORKFLOW_SCHEDULE = gql`
  query GetWorkflowSchedule($workflow: ID!) {
    workflowSchedule(workflow: $workflow) {
      id
      schedule
      next
      iteration
    }
  }
`;

export const UPSERT_WORKFLOW_SCHEDULE = gql`
  mutation UpsertWorkflowSchedule($workflow: ID!, $schedule: String!) {
    upsertWorkflowSchedule(workflow: $workflow, schedule: $schedule) {
      status
    }
  }
`;

export const DELETE_WORKFLOW_SCHEDULE = gql`
  mutation DeleteWorkflowSchedule($workflow: ID!) {
    deleteWorkflowSchedule(workflow: $workflow) {
      status
    }
  }
`;

/* ------------------------------------------------------------------------- */
/* Email trigger (Plan-2 API — every call site is gated by
   ROUTINES_EMAIL_TRIGGER_SUPPORTED; the documents are inert until then). */

const WORKFLOW_TRIGGER_SELECTION = `
  id
  workflow
  type
  enabled
  address
  config
  run_as_user
  createdAt
  updatedAt
`;

export const GET_WORKFLOW_TRIGGERS = gql`
  query GetWorkflowTriggers($workflow: ID!) {
    workflowTriggers(workflow: $workflow) {
      ${WORKFLOW_TRIGGER_SELECTION}
    }
  }
`;

export const UPSERT_WORKFLOW_EMAIL_TRIGGER = gql`
  mutation UpsertWorkflowEmailTrigger(
    $workflow: ID!
    $enabled: Boolean!
    $config: JSON!
  ) {
    upsertWorkflowEmailTrigger(
      workflow: $workflow
      enabled: $enabled
      config: $config
    ) {
      ${WORKFLOW_TRIGGER_SELECTION}
    }
  }
`;

export const DELETE_WORKFLOW_TRIGGER = gql`
  mutation DeleteWorkflowTrigger($id: ID!) {
    deleteWorkflowTrigger(id: $id) {
      id
    }
  }
`;

/* ------------------------------------------------------------------------- */
/* Job results (run history) */

export const GET_JOB_RESULTS = gql`
  query GetJobResults(
    $page: Int!
    $limit: Int!
    $filters: [FilterJob_result]
    $sort: SortBy = { field: "createdAt", direction: DESC }
  ) {
    job_resultsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      items {
        id
        job_id
        state
        error
        label
        result
        metadata
        createdAt
        updatedAt
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

export const GET_JOB_RESULTS_LIGHT = gql`
  query GetJobResultsLight(
    $page: Int!
    $limit: Int!
    $filters: [FilterJob_result]
    $sort: SortBy = { field: "createdAt", direction: DESC }
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

export const GET_JOB_RESULT_BY_ID = gql`
  query GetJobResultById($id: ID!) {
    job_resultById(id: $id) {
      id
      job_id
      state
      error
      label
      result
      metadata
      createdAt
      updatedAt
    }
  }
`;

/* ------------------------------------------------------------------------- */
/* Agent resolution — used by useAgentsForPage. */

export const GET_AGENT_BY_ID = gql`
  query RoutinesGetAgentById($id: ID!) {
    agentById(id: $id) {
      id
      name
      workflows {
        enabled
        queue {
          name
        }
      }
    }
  }
`;

/**
 * Lightweight agents listing for the Basics agent dropdown. Bounded page
 * (limit 100) ordered by name — matches the rest of the platform's agent
 * picker UX. Standalone op-name keeps Apollo cache separate from the agents
 * route's index query.
 */
export const GET_AGENTS_FOR_ROUTINE = gql`
  query RoutinesGetAgentsList(
    $page: Int!
    $limit: Int!
    $sort: SortBy = { field: "name", direction: ASC }
  ) {
    agentsPagination(page: $page, limit: $limit, sort: $sort) {
      items {
        id
        name
      }
    }
  }
`;
