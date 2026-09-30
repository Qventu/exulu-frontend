/**
 * Memory area (agent memory redesign, sub-project 2) — route-local GraphQL
 * documents. Copies of the knowledge/chat/users documents this feature needs:
 * the lint rules forbid importing other features' folders and the queries
 * monolith. Operation names are unique so demo resolvers can map them.
 */
import { gql } from "@apollo/client";

export const MEMORY_STATS_FIELDS = `
  total
  public
  private
  contributors
  visible
  lastSavedAt
  lastSavedBy { id name }
`;

export const GET_MEMORY_BASES = gql`
  query MemoryBases {
    memoryBases {
      id
      name
      description
      valid
      missing
      missingFromCode
      agents { id name }
      stats { ${MEMORY_STATS_FIELDS} }
    }
  }
`;

/**
 * The agent total behind "N of M agents use a memory base". Server-side and
 * unscoped, like `memoryBases` itself — agentsPagination is RBAC-scoped, which
 * made the two halves of that sentence count different populations.
 */
export const GET_MEMORY_AGENT_COUNT = gql`
  query MemoryAgentCount {
    memoryAgentCount
  }
`;

/**
 * Who saved into this base. Replaces usersPagination, which requires the
 * `users` right the Memory area does not ask for (agents:read) and throws
 * without it. Ids + display names only, gated on agents-read server-side.
 */
export const GET_MEMORY_BASE_CONTRIBUTORS = gql`
  query MemoryBaseContributors($contextId: ID!) {
    memoryBaseContributors(contextId: $contextId) { id name }
  }
`;

/** The base's contract (fields → type enum, source_session) and default rights mode. */
export const GET_MEMORY_BASE = gql`
  query MemoryBaseById($id: ID!) {
    contextById(id: $id) {
      id
      name
      description
      fields
      configuration
      memoryBase { ok missing }
    }
  }
`;

const LIST_ITEM_FIELDS = (fields: string[]) => `
  id
  name
  description
  createdAt
  updatedAt
  rights_mode
  ${fields.join("\n")}
`;

/** The list only shows the rights_mode label; grants are read on the detail page. */
const DETAIL_ITEM_FIELDS = (fields: string[]) => `
  ${LIST_ITEM_FIELDS(fields)}
  RBAC {
    type
    users { id rights }
    roles { id rights }
  }
`;

export const memoryItemFields = (withSourceSession: boolean) => [
  "information",
  "type",
  "created_by",
  ...(withSourceSession ? ["source_session"] : []),
];

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const MEMORY_ITEMS_KEY = (context: string) => `${context}_itemsPagination`;
export const MEMORY_ITEM_KEY = (context: string) => `${context}_itemsById`;

export const GET_MEMORY_ITEMS = (context: string, withSourceSession: boolean) => gql`
  query ${context}MemoriesPagination($page: Int!, $limit: Int!, $filters: [Filter${upperFirst(context)}_items], $sort: SortBy = { field: "createdAt", direction: DESC }) {
    ${context}_itemsPagination(page: $page, limit: $limit, filters: $filters, sort: $sort) {
      pageInfo { pageCount itemCount currentPage hasPreviousPage hasNextPage }
      items { ${LIST_ITEM_FIELDS(memoryItemFields(withSourceSession))} }
    }
  }
`;

export const GET_MEMORY_ITEM_BY_ID = (context: string, withSourceSession: boolean) => gql`
  query ${context}MemoryById($id: ID!) {
    ${context}_itemsById(id: $id) { ${DETAIL_ITEM_FIELDS(memoryItemFields(withSourceSession))} }
  }
`;

export const DELETE_MEMORY_ITEM = (context: string) => gql`
  mutation DeleteMemory${context}($id: ID!) {
    ${context}_itemsRemoveOneById(id: $id) { id }
  }
`;

/** Same operation shape as knowledge's BULK_UPDATE_ITEM_RBAC (BulkAccessDialog contract). */
export const BULK_UPDATE_MEMORY_RBAC = (context: string) => gql`
  mutation BulkUpdateMemoryRBAC${context}($ids: [ID!]!, $rights_mode: String!, $rbac: RBACInput) {
    ${context}_itemsBulkUpdateRBAC(ids: $ids, rights_mode: $rights_mode, RBAC: $rbac) {
      message
      itemCount
    }
  }
`;

export const GET_SOURCE_SESSION = gql`
  query MemorySourceSession($id: ID!) {
    agent_sessionById(id: $id) { id agent }
  }
`;

export const GET_SOURCE_MESSAGES = gql`
  query MemorySourceMessages($session: String!) {
    agent_messagesPagination(page: 1, limit: 5, sort: { field: "createdAt", direction: ASC }, filters: [{ session: { eq: $session } }]) {
      items { id content createdAt }
    }
  }
`;
