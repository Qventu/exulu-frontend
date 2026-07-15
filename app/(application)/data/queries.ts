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
      model
      queue
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

// In-flight pipeline jobs for ONE item (knowledge V2 KB-7). job_results now
// carries indexed item + type columns and a "waiting" row written at enqueue
// time, so this one indexed query tells us which stages are queued/running
// for an item — and it survives a page refresh (unlike scanning the live
// BullMQ queue). `state in [waiting, active, delayed]` = not yet terminal.
export const GET_ITEM_ACTIVE_JOBS = gql`
  query GetItemActiveJobs($item: String!, $states: [String]) {
    job_resultsPagination(
      page: 1
      limit: 100
      filters: [{ item: { eq: $item }, state: { in: $states } }]
    ) {
      items {
        id
        type
        state
      }
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
// Context icons — a single shared platform_configurations row maps
// { [contextId]: glyphName } so admins can give each knowledge base a
// recognizable Fluent Emoji icon in the library list. Reuses the generic
// key-value store (same collection as theme_config / image styles); no Context
// schema change needed. Distinct operation names avoid colliding with the
// monolith's platform_configuration documents.
// ---------------------------------------------------------------------------

/** The one platform_configurations row this feature reads/writes. */
export const CONTEXT_ICONS_CONFIG_KEY = "knowledge_context_icons";

const CONTEXT_ICONS_FIELDS = `
  id
  config_key
  config_value
`;

export const GET_CONTEXT_ICONS = gql`
  query GetContextIcons($config_key: FilterOperatorString!) {
    platform_configurationsPagination(page: 1, limit: 1, filters: { config_key: $config_key }) {
      items {
        ${CONTEXT_ICONS_FIELDS}
      }
    }
  }
`;

export const CREATE_CONTEXT_ICONS = gql`
  mutation CreateContextIcons($data: platform_configurationInput!) {
    platform_configurationsCreateOne(input: $data) {
      item {
        ${CONTEXT_ICONS_FIELDS}
      }
    }
  }
`;

export const UPDATE_CONTEXT_ICONS = gql`
  mutation UpdateContextIcons($id: ID!, $data: platform_configurationInput!) {
    platform_configurationsUpdateOneById(id: $id, input: $data) {
      item {
        ${CONTEXT_ICONS_FIELDS}
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Per-user item pins — Favourites + Recently Viewed (cross-context).
//
// Both lists live as JSON arrays on the `users` row (favourite_items already
// existed; recently_viewed_items is new) and are written through the generic
// usersUpdateOne mutation — the exact mechanism /projects favourites use. Ids
// are stored as global "<contextId>/<itemId>" strings, most-recent / most-
// recently-added first. Names are resolved live (GET_ITEMS with an id-in
// filter, one query per distinct context) so /data needs no denormalized copy.
//
// The GET also reads the recents array in the same round-trip, hence the
// broader-than-the-name selection.
// ---------------------------------------------------------------------------

/**
 * Re-anchors the shared pin stores to the backend on mount (narrowed read of
 * the monolith's `userById` root, distinct operation name, read-only). The
 * UserContext snapshot is fetched once per login and never refreshed, so
 * without this the full-array write below could clobber pins set elsewhere
 * since login. Mirrors GET_USER_FAVOURITE_PROJECTS in /projects.
 */
export const GET_USER_CONTEXT_ITEM_FAVOURITES = gql`
  query GetUserContextItemFavourites($id: ID!) {
    userById(id: $id) {
      id
      favourite_items
      recently_viewed_items
    }
  }
`;

/**
 * Full-array write of the favourites list via the generic usersUpdateOne (json
 * fields are JSON-stringified server-side). Mirrors UpdateUserFavouriteProjects
 * in /projects.
 *
 * NB: favourites and recents are written by SEPARATE single-column mutations
 * on purpose. A combined mutation referencing both `$favourite_items` and
 * `$recently_viewed_items` would send the omitted variable as null (GraphQL
 * fills absent variables with null), and usersUpdateOne would then wipe that
 * column — so a favourites toggle would clobber recents and vice-versa.
 */
export const UPDATE_USER_CONTEXT_ITEM_FAVOURITES = gql`
  mutation UpdateUserContextItemFavourites($id: Float!, $favourite_items: JSON) {
    usersUpdateOne(
      input: { favourite_items: $favourite_items }
      where: { id: { eq: $id } }
    ) {
      item {
        id
        favourite_items
      }
    }
  }
`;

/** Full-array write of the recents list (sibling of the favourites write — see
 *  that mutation's note on why the two columns are written separately). */
export const UPDATE_USER_RECENTLY_VIEWED_ITEMS = gql`
  mutation UpdateUserRecentlyViewedItems($id: Float!, $recently_viewed_items: JSON) {
    usersUpdateOne(
      input: { recently_viewed_items: $recently_viewed_items }
      where: { id: { eq: $id } }
    ) {
      item {
        id
        recently_viewed_items
      }
    }
  }
`;

/**
 * Resolves a set of item ids within ONE context to display fields (id + name),
 * issued once per distinct context by the pin hooks. Reuses the items
 * pagination root with an `id IN` filter; `id` is a text field so
 * FilterOperatorString.in applies. `limit` is the id count (≤ a handful).
 */
export const GET_ITEMS_BY_IDS = (context: string) => {
  return gql`
    query ${context}ByIds($ids: [String], $limit: Int!) {
      ${context}${PAGINATION_POSTFIX}(page: 1, limit: $limit, filters: [{ id: { in: $ids } }]) {
        items {
          id
          name
          external_id
        }
      }
    }
  `;
};

export const GET_ITEMS_BY_EXTERNAL_IDS = (context: string) => {
  return gql`
    query ${context}ByExternalIds($ids: [String], $limit: Int!) {
      ${context}${PAGINATION_POSTFIX}(page: 1, limit: $limit, filters: [{ external_id: { in: $ids } }]) {
        items {
          id
          external_id
        }
      }
    }
  `;
};

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
