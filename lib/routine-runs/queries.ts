/**
 * GraphQL operations for the Plan-1 routine-runs API. Lives in lib/ so the
 * workflows feature, the runs feature, the chat feature AND the shell badge
 * can all import it (eslint feature isolation forbids cross-feature imports).
 */

import { gql } from "@apollo/client";

const ROUTINE_RUN_SELECTION = `
  id
  job_id
  state
  trigger
  trigger_metadata
  session
  workflow
  workflowName
  agent
  error
  tries
  createdAt
  updatedAt
  inputTokens
  outputTokens
  costUsd
`;

export const ROUTINE_RUNS = gql`
  query RoutineRuns(
    $page: Int
    $limit: Int
    $workflow: ID
    $states: [String!]
    $triggers: [String!]
    $from: Date
    $to: Date
    $search: String
    $needsAttention: Boolean
  ) {
    routineRuns(
      page: $page
      limit: $limit
      workflow: $workflow
      states: $states
      triggers: $triggers
      from: $from
      to: $to
      search: $search
      needsAttention: $needsAttention
    ) {
      items {
        ${ROUTINE_RUN_SELECTION}
      }
      total
    }
  }
`;

export const ROUTINE_RUNS_ATTENTION_COUNT = gql`
  query RoutineRunsNeedingAttentionCount {
    routineRunsNeedingAttentionCount
  }
`;

export const CANCEL_ROUTINE_RUN = gql`
  mutation CancelRoutineRun($id: ID!) {
    cancelRoutineRun(id: $id) {
      ${ROUTINE_RUN_SELECTION}
    }
  }
`;

export const RETRY_ROUTINE_RUN = gql`
  mutation RetryRoutineRun($id: ID!) {
    retryRoutineRun(id: $id) {
      ${ROUTINE_RUN_SELECTION}
    }
  }
`;

export const DELETE_ROUTINE_RUN = gql`
  mutation DeleteRoutineRun($id: ID!) {
    deleteRoutineRun(id: $id)
  }
`;

/**
 * Chat banner lookup: session.metadata.job_result_id → run state. Uses the
 * existing auto-generated job_resultById; `trigger`/`workflow` are Plan-1
 * columns.
 */
export const ROUTINE_RUN_FOR_SESSION = gql`
  query RoutineRunForSession($id: ID!) {
    job_resultById(id: $id) {
      id
      state
      trigger
      workflow
    }
  }
`;

/** Minimal routine name lookup for the chat banner (existing schema). */
export const ROUTINE_NAME_BY_ID = gql`
  query RoutineNameForRunBanner($id: ID!) {
    workflow_templateById(id: $id) {
      id
      name
    }
  }
`;
