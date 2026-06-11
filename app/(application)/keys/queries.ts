import { gql } from "@apollo/client";

/**
 * GraphQL operations for /keys, colocated per codebase-structure §1.1/§3.2.
 * Copied (and deliberately narrowed) from queries/queries.ts — the monolith
 * itself is untouched; this feature simply stops importing from it.
 *
 * GET_API_KEYS is the narrowed replacement for GET_USERS on this page
 * (keys-token.md §4 / U4b): same `usersPagination` operation and variables,
 * WITHOUT `apikey`, `anthropic_token` AND `email` — the synthetic email embeds
 * the bcrypt hash (`<hash>@exulu-api-user.com`), so selecting it would ship
 * the credential hash to every client through the back door. The selection is
 * exactly the doc's field list: id, name, firstname, createdAt, last_used,
 * scope_mode, agent_ids, role (+ type/super_admin for display logic). Distinct
 * operation names avoid collisions with the monolith's documents, which other
 * features still load.
 */

export const GET_API_KEYS = gql`
  query GetApiKeys(
    $page: Int!
    $limit: Int!
    $filters: [FilterUser]
    $sort: SortBy
  ) {
    usersPagination(page: $page, limit: $limit, filters: $filters, sort: $sort) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        id
        name
        firstname
        last_used
        createdAt
        type
        super_admin
        scope_mode
        agent_ids
        role
      }
    }
  }
`;

/**
 * Narrowed from GET_AGENTS (same operation, same variables incl. the default
 * sort): the page only needs id + name for the allowlist builder and the
 * scope display.
 */
export const GET_KEY_AGENTS = gql`
  query GetKeyAgents(
    $page: Int!
    $limit: Int!
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    agentsPagination(page: $page, limit: $limit, sort: $sort) {
      items {
        id
        name
      }
    }
  }
`;

/**
 * Narrowed from GET_USER_ROLES: id + name lookup for the role-change
 * confirmation copy and the detail panel.
 */
export const GET_KEY_ROLES = gql`
  query GetKeyRoles($page: Int!, $limit: Int!) {
    rolesPagination(page: $page, limit: $limit) {
      items {
        id
        name
      }
    }
  }
`;

/** Copy of CREATE_API_USER — identical mutation root, input fields and variables. */
export const CREATE_API_KEY = gql`
  mutation CreateApiKeyUser(
    $firstname: String
    $type: String
    $apikey: String
    $email: String
    $role: String
    $super_admin: Boolean
    $scope_mode: String
    $agent_ids: JSON
  ) {
    usersCreateOne(
      input: {
        firstname: $firstname
        type: $type
        apikey: $apikey
        email: $email
        role: $role
        super_admin: $super_admin
        scope_mode: $scope_mode
        agent_ids: $agent_ids
      }
    ) {
      item {
        id
      }
    }
  }
`;

/**
 * Narrowed from UPDATE_USER_BY_ID to the one field this page ever writes
 * (`role`) — same mutation root; unset input fields behave identically to the
 * monolith's unprovided optional variables.
 */
export const UPDATE_API_KEY_ROLE = gql`
  mutation UpdateApiKeyRole($id: ID!, $role: String) {
    usersUpdateOneById(id: $id, input: { role: $role }) {
      item {
        id
        role
      }
    }
  }
`;

/** Copy of REMOVE_USER_BY_ID. */
export const REMOVE_API_KEY = gql`
  mutation RemoveApiKeyById($id: ID!) {
    usersRemoveOneById(id: $id) {
      id
    }
  }
`;
