import { gql } from "@apollo/client";

/**
 * GraphQL operations for /users (and the consolidated Roles/Teams tabs),
 * colocated per codebase-structure §1.1/§3.2 — copied (not edited) from
 * queries/queries.ts; the monolith stays untouched. Operation NAMES are kept
 * identical so Apollo's name-based `refetchQueries` keep working across the
 * app (e.g. other features mutating users still invalidate this list).
 *
 * Feature flags (rule 4 — schema gating): UI capability gated on confirmed
 * server support. The Users-tab role/team filters and column sorting wire
 * through ONLY when these constants are true; the GraphQL contract is
 * additive-only.
 *
 * - ACCESS_FILTER_ROLE_SUPPORTED — set true once the backend confirms
 *   `FilterUser` accepts a `role` filter key. Today GET_USERS already accepts
 *   a generic `filters: [FilterUser]` arg, but the role/team fields are not
 *   confirmed on that input type. Until flipped, the Role Select does not
 *   render — capability is preserved (the user can still filter via search
 *   and the role inline-edit cell).
 * - ACCESS_FILTER_TEAM_SUPPORTED — same gate for the Team Select.
 * - ACCESS_USER_SORT_SUPPORTED — flips on column header sorting (U10 fix).
 *   GET_USERS already declares `sort: SortBy`; pageless current code
 *   hardcoded `createdAt DESC`. The hook keeps the same hardcoded sort
 *   until this flips true.
 * - ACCESS_ROLES_PAGINATION_SUPPORTED — UI-only flag for surfacing the
 *   roles pagination footer past 100 (U12). GET_USER_ROLES already accepts
 *   `page` + `limit`.
 * - ACCESS_TEAMS_PAGINATION_SUPPORTED — same, for teams.
 * - ACCESS_USER_UPDATED_AT_SUPPORTED — the monolith GET_USERS selection set
 *   does NOT include `updatedAt` on the user item (verified queries/queries.ts
 *   :676-693). Until the backend confirms the field exists on the User type,
 *   the Updated column falls back to `createdAt` for the audit timestamp.
 *   Honest fallback labelling lives in the column renderer (no silent decay).
 */
export const ACCESS_FILTER_ROLE_SUPPORTED = false;
export const ACCESS_FILTER_TEAM_SUPPORTED = false;
export const ACCESS_USER_SORT_SUPPORTED = false;
export const ACCESS_ROLES_PAGINATION_SUPPORTED = true;
export const ACCESS_TEAMS_PAGINATION_SUPPORTED = true;
export const ACCESS_USER_UPDATED_AT_SUPPORTED = false;

/** Page sizes for each tab (server-paginated). */
export const USERS_PAGE_SIZE = 10;
export const ROLES_PAGE_SIZE = 50;
export const TEAMS_PAGE_SIZE = 50;

/* ----------------------------- Users tab ------------------------------ */

export const GET_USERS = gql`
  query GetUsers(
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
        lastname
        email
        last_used
        createdAt
        type
        apikey
        emailVerified
        anthropic_token
        super_admin
        scope_mode
        agent_ids
        role
        team
      }
    }
  }
`;

export const UPDATE_USER_BY_ID = gql`
  mutation UpdateUser(
    $email: String
    $firstname: String
    $anthropic_token: String
    $personal_system_prompt: String
    $super_admin: Boolean
    $lastname: String
    $role: String
    $team: String
    $favourite_agents: JSON
    $id: ID!
  ) {
    usersUpdateOneById(
      id: $id
      input: {
        email: $email
        firstname: $firstname
        anthropic_token: $anthropic_token
        personal_system_prompt: $personal_system_prompt
        super_admin: $super_admin
        lastname: $lastname
        role: $role
        team: $team
        favourite_agents: $favourite_agents
      }
    ) {
      item {
        id
        email
        firstname
        lastname
        super_admin
        role
        team
      }
    }
  }
`;

export const REMOVE_USER_BY_ID = gql`
  mutation RemoveUserById($id: ID!) {
    usersRemoveOneById(id: $id) {
      id
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser(
    $email: String!
    $password: String
    $type: String
    $emailVerified: String
  ) {
    usersCreateOne(
      input: {
        email: $email
        password: $password
        type: $type
        emailVerified: $emailVerified
      }
    ) {
      item {
        id
        createdAt
        emailVerified
        type
        name
      }
    }
  }
`;

export const RESET_USER_PASSWORD = gql`
  mutation ResetUserPassword($id: ID!, $password: String!) {
    usersUpdateOneById(id: $id, input: { password: $password }) {
      item {
        id
      }
    }
  }
`;

/* ----------------------------- Roles tab ------------------------------ */

export const GET_USER_ROLES = gql`
  query GetUserRoles($page: Int!, $limit: Int!) {
    rolesPagination(page: $page, limit: $limit) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        id
        createdAt
        updatedAt
        agents
        workflows
        api
        variables
        users
        evals
        budget_management
        name
      }
    }
  }
`;

export const CREATE_USER_ROLE = gql`
  mutation CreateUserRole(
    $name: String!
    $agents: String
    $workflows: String
    $variables: String
    $users: String
    $api: String
    $evals: String
    $budget_management: String
  ) {
    rolesCreateOne(
      input: {
        name: $name
        agents: $agents
        workflows: $workflows
        variables: $variables
        users: $users
        api: $api
        evals: $evals
        budget_management: $budget_management
      }
    ) {
      item {
        id
        createdAt
        agents
        api
        workflows
        variables
        users
        evals
        budget_management
        name
      }
    }
  }
`;

export const UPDATE_USER_ROLE_BY_ID = gql`
  mutation UpdateUserRole(
    $id: ID!
    $name: String
    $agents: String
    $workflows: String
    $api: String
    $variables: String
    $users: String
    $evals: String
    $budget_management: String
  ) {
    rolesUpdateOneById(
      id: $id
      input: {
        name: $name
        agents: $agents
        workflows: $workflows
        api: $api
        variables: $variables
        users: $users
        evals: $evals
        budget_management: $budget_management
      }
    ) {
      item {
        id
        createdAt
        updatedAt
        agents
        api
        workflows
        variables
        users
        evals
        budget_management
        name
      }
    }
  }
`;

export const REMOVE_USER_ROLE_BY_ID = gql`
  mutation RemoveUserRoleById($id: ID!) {
    rolesRemoveOneById(id: $id) {
      id
    }
  }
`;

/* ----------------------------- Teams tab ------------------------------ */

export const GET_TEAMS = gql`
  query GetTeams($page: Int!, $limit: Int!) {
    teamsPagination(page: $page, limit: $limit) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        id
        createdAt
        updatedAt
        name
        description
      }
    }
  }
`;

export const CREATE_TEAM = gql`
  mutation CreateTeam($name: String!, $description: String) {
    teamsCreateOne(input: { name: $name, description: $description }) {
      item {
        id
        createdAt
        updatedAt
        name
        description
      }
    }
  }
`;

export const UPDATE_TEAM_BY_ID = gql`
  mutation UpdateTeam($id: ID!, $name: String, $description: String) {
    teamsUpdateOneById(
      id: $id
      input: { name: $name, description: $description }
    ) {
      item {
        id
        createdAt
        updatedAt
        name
        description
      }
    }
  }
`;

export const REMOVE_TEAM_BY_ID = gql`
  mutation RemoveTeamById($id: ID!) {
    teamsRemoveOneById(id: $id) {
      id
    }
  }
`;
