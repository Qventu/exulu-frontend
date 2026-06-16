/**
 * Route-local copies of the GraphQL operations consumed by the Knowledge
 * workspace and library routes (work item 2.11). Copied verbatim from
 * queries/queries.ts per codebase-structure §1.1 / D5 — never edit
 * queries/queries.ts from builder agents.
 *
 * Schema-gating flags (KNOWLEDGE_* constants) live alongside so consumers
 * can branch on backend capability. Every flag defaults to `false`; the
 * fallback path is what runs today.
 */

import { gql } from "@apollo/client";

// ---------------------------------------------------------------------------
// Schema-gating flags. Default = false (= fallback path runs).
// ---------------------------------------------------------------------------

/** When `true`, GET_CONTEXTS returns `item_count`, `last_ingested_at`,
 *  `failed_job_count` per context. Until shipped: rows hide meta columns
 *  (NEVER fall back to the N+1 query the page-doc forbids). */
export const KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED = false;

/** When `true`, GET_ITEM_BY_ID supports `chunks(page, limit)` arguments.
 *  Until shipped: chunks come back inline, paginated client-side. */
export const KNOWLEDGE_ITEM_CHUNKS_PAGINATED_SUPPORTED = false;

/** When `true`, per-context failed-job aggregates surface health colors on
 *  library rows. Until shipped: status dot stays muted. */
export const KNOWLEDGE_CONTEXT_HEALTH_SUPPORTED = false;

// ---------------------------------------------------------------------------
// GraphQL field sets — kept in lock-step with queries/queries.ts.
// ---------------------------------------------------------------------------

export const PAGINATION_POSTFIX = "_itemsPagination";
export const CREATE_ONE_POSTFIX = "_itemsCreateOne";

const CONTEXT_FIELDS = `
    id
    name
    description
    embedder {
      name
      id
      queue
      config {
        name
        description
        default
      }
    }
    slug
    active
    fields
    configuration
    processor {
      name
      description
      queue
      trigger
      timeoutInSeconds
      generateEmbeddings
    }
    sources {
      id
      name
      description
      config {
        params {
          name
          description
          default
        }
        schedule
        queue
        retries
        backoff {
          type
          delay
        }
      }
    }
`;

const ITEM_FIELDS = (fields: string[]) => `
id
name
description
tags
external_id
createdAt
embeddings_updated_at
last_processed_at
chunks_count
updatedAt
rights_mode
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
${fields.join("\n")}
`;

// ---------------------------------------------------------------------------
// Library queries (server-fetched on /data).
// ---------------------------------------------------------------------------

export const GET_CONTEXTS = gql`
  query GetContexts {
    contexts {
      items {
        ${CONTEXT_FIELDS}
      }
    }
  }
`;

export const GET_CONTEXT_BY_ID = gql`
  query GetContextById($id: ID!) {
    contextById(id: $id) {
      ${CONTEXT_FIELDS}
    }
  }
`;

// Pipeline-health aggregates (knowledge V2 KB-3/KB-4). Kept separate from
// CONTEXT_FIELDS so the workspace's context fetch never triggers the
// (lazy, but non-zero) server-side count queries — only the Pipeline tab's
// health overview requests these.
export const GET_CONTEXT_HEALTH = gql`
  query GetContextHealth($id: ID!) {
    contextById(id: $id) {
      id
      item_count
      chunk_total
      stuck_count
      stale_count
    }
  }
`;

// ---------------------------------------------------------------------------
// Per-context item operations.
// ---------------------------------------------------------------------------

export const GET_ITEMS = (context: string, fields: string[]) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1);
  return gql`
    query ${context}Pagination($page: Int!, $limit: Int!, $filters: [Filter${upperCaseContext}_items], $sort: SortBy = { field: "updatedAt", direction: DESC }) {
      ${context}${PAGINATION_POSTFIX}(page: $page, limit: $limit, filters: $filters, sort: $sort) {
        pageInfo {
          pageCount
          itemCount
          currentPage
          hasPreviousPage
          hasNextPage
        }
        items {
          ${ITEM_FIELDS(fields)}
        }
      }
    }
  `;
};

export const PROCESS_ITEM = (context: string) => gql`
  mutation ProcessItem${context}($item: ID!) {
    ${context}_itemsProcessItem(item: $item) {
      message
      results
      jobs
    }
  }
`;

export const PROCESS_ITEMS = (context: string) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1);
  return gql`
    mutation ${context}ProcessItems($limit: Int!, $filters: [Filter${upperCaseContext}_items], $sort: SortBy = { field: "updatedAt", direction: DESC }) {
      ${context}_itemsProcessItems(limit: $limit, filters: $filters, sort: $sort) {
        message
        results
        jobs
      }
    }
  `;
};

export const GET_ITEM_BY_ID = (
  context: string,
  fields: string[],
  chunks = false,
) => gql`
  query ${context}ById($id: ID!) {
    ${context}_itemsById(id: $id) {
      ${ITEM_FIELDS(fields)}
      ${chunks ? "chunks { chunk_content chunk_source chunk_index chunk_id chunk_created_at chunk_updated_at chunk_metadata }" : ""}
    }
  }
`;

export const CREATE_ITEM = (context: string, fields?: string[]) => gql`
  mutation CreateOne${context}($input: ${context}_itemsInput!) {
    ${context}_itemsCreateOne(input: $input) {
      item {
        id
        name
        description
        ${fields?.length ? fields.join("\n") : ""}
      }
      job
    }
  }
`;

export const DELETE_CHUNKS = (context: string) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1);
  return gql`
    mutation DeleteChunks${context}($where: [Filter${upperCaseContext}_items], $limit: Int) {
      ${context}_itemsDeleteChunks(where: $where, limit: $limit) {
        items
        jobs
      }
    }
  `;
};

export const GENERATE_CHUNKS = (context: string) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1);
  return gql`
    mutation GenerateChunks${context}($where: [Filter${upperCaseContext}_items], $limit: Int) {
      ${context}_itemsGenerateChunks(where: $where, limit: $limit) {
        items
        jobs
      }
    }
  `;
};

export const EXECUTE_SOURCE = (context: string) => gql`
  mutation ExecuteSource${context}($source: ID!, $inputs: JSON!) {
    ${context}_itemsExecuteSource(source: $source, inputs: $inputs) {
      message
      jobs
      items
    }
  }
`;

export const UPDATE_ITEM = (context: string) => gql`
  mutation UpdateOneById${context}($id: ID!, $input: ${context}_itemsInput!) {
    ${context}_itemsUpdateOneById(id: $id, input: $input) {
      item {
        id
      }
      job
    }
  }
`;

export const DELETE_ITEM = (context: string, fields: string[]) => gql`
  mutation DeleteOneById${context}($id: ID!) {
    ${context}_itemsRemoveOneById(id: $id) {
      id
      ${fields.join("\n")}
    }
  }
`;

// ---------------------------------------------------------------------------
// Embedder settings — copied verbatim from queries/queries.ts:1515-1558.
// Pipeline-tab Embedder stage variable bindings consume these.
// ---------------------------------------------------------------------------

export const GET_EMBEDDER_CONFIGS = gql`
  query GetEmbedderConfigs($context: String, $embedder: String) {
    embedder_settingsPagination(page: 1, limit: 100, filters: {
      context: {
        eq: $context
      },
      embedder: {
        eq: $embedder
      }
    }) {
      items {
        id
        name
        value
        createdAt
        updatedAt
      }
    }
  }
`;

export const CREATE_EMBEDDER_CONFIG = gql`
  mutation CreateEmbedderConfig($name: String!, $value: String, $context: String!, $embedder: String!) {
    embedder_settingsCreateOne(input: { name: $name, value: $value, context: $context, embedder: $embedder }) {
      item {
        id
        name
        value
        context
        embedder
      }
    }
  }
`;

export const UPDATE_EMBEDDER_CONFIG = gql`
  mutation UpdateEmbedderConfig($id: ID!, $name: String, $value: String) {
    embedder_settingsUpdateOneById(id: $id, input: { name: $name, value: $value }) {
      item {
        id
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Queue ops — copied verbatim from queries/queries.ts:2313-2394. Pipeline
// tab's per-stage QueuePanel consumes these via the shared widget; no
// schema additions are needed.
// ---------------------------------------------------------------------------

export const GET_QUEUE = gql`
  query GetQueue($queue: QueueEnum!) {
    queue(queue: $queue) {
      name
      concurrency {
        worker
        queue
      }
      timeoutInSeconds
      ratelimit
      isMaxed
      isPaused
      jobs {
        paused
        completed
        failed
        waiting
        active
        delayed
      }
    }
  }
`;

export const GET_JOBS = gql`
  query GetJobs($queue: QueueEnum!, $statusses: [JobStateEnum!], $page: Int, $limit: Int) {
    jobs(queue: $queue, statusses: $statusses, page: $page, limit: $limit) {
      items {
        name
        id
        returnvalue
        stacktrace
        failedReason
        processedOn
        finishedOn
        attemptsMade
        state
        data
        timestamp
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

export const DELETE_JOB = gql`
  mutation DeleteJob($queue: QueueEnum!, $id: String!) {
    deleteJob(queue: $queue, id: $id) {
      success
    }
  }
`;

export const PAUSE_QUEUE = gql`
  mutation PauseQueue($queue: QueueEnum!) {
    pauseQueue(queue: $queue) {
      success
    }
  }
`;

export const RESUME_QUEUE = gql`
  mutation ResumeQueue($queue: QueueEnum!) {
    resumeQueue(queue: $queue) {
      success
    }
  }
`;

export const DRAIN_QUEUE = gql`
  mutation DrainQueue($queue: QueueEnum!) {
    drainQueue(queue: $queue) {
      success
    }
  }
`;
