import { gql } from "@apollo/client";

/**
 * GraphQL operations for /projects, colocated per codebase-structure
 * §1.1/§3.2. Verbatim copies of the monolith's operations (queries/queries.ts
 * is untouched — this feature simply stops importing from it, same migration
 * move as transcriptions/queries.ts). Narrowed copies carry distinct
 * operation names so they never collide with monolith documents other
 * features still load.
 *
 * Backend contracts are untouchable (projects.md §4): every selection,
 * mutation root and variable shape below is semantically identical to the
 * legacy ops consumed by project-nav/project-details/create-project-dialog.
 */

const PROJECT_FIELDS = `
  id
  name
  description
  image
  custom_instructions
  rights_mode
  created_by
  createdAt
  updatedAt
  project_items
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
`;

/** Verbatim copy of the monolith's GET_PROJECTS. */
export const GET_PROJECTS = gql`
  query GetProjects(
    $page: Int!
    $limit: Int!
    $filters: [FilterProject]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    projectsPagination(
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
        ${PROJECT_FIELDS}
      }
    }
  }
`;

/** Verbatim copy of GET_PROJECTS_BY_IDS (favorites pinning). */
export const GET_PROJECTS_BY_IDS = gql`
  query GetProjectsByIds($ids: [ID!]!) {
    projectByIds(ids: $ids) {
      ${PROJECT_FIELDS}
    }
  }
`;

/**
 * GET_PROJECT_BY_ID + the computed `budget` field (admin view or project
 * member view — spec docs/superpowers/specs/2026-07-20-project-budget-
 * visibility-design.md). `budget` is deliberately NOT in PROJECT_FIELDS so
 * list queries and mutation payloads skip the LiteLLM hydration round-trip.
 */
export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($id: ID!) {
    projectById(id: $id) {
      ${PROJECT_FIELDS}
      budget
    }
  }
`;

/** Verbatim copy of CREATE_PROJECT. */
export const CREATE_PROJECT = gql`
  mutation CreateProject($input: projectInput!) {
    projectsCreateOne(input: $input) {
      item {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

/** Verbatim copy of UPDATE_PROJECT. */
export const UPDATE_PROJECT = gql`
  mutation UpdateProject($id: ID!, $input: projectInput!) {
    projectsUpdateOneById(id: $id, input: $input) {
      item {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

/** Verbatim copy of DELETE_PROJECT. */
export const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!) {
    projectsRemoveOneById(id: $id) {
      id
      name
    }
  }
`;

/** Verbatim copy of UPDATE_USER_FAVOURITE_PROJECTS. */
export const UPDATE_USER_FAVOURITE_PROJECTS = gql`
  mutation UpdateUserFavouriteProjects($id: Float!, $favourite_projects: JSON) {
    usersUpdateOne(input: { favourite_projects: $favourite_projects }, where: { id: { eq: $id } }) {
      item {
        id
        favourite_projects
      }
    }
  }
`;

/**
 * Narrowed read of the monolith's `userById` root (GET_USER_BY_ID,
 * queries/queries.ts:1596) — same query root, distinct operation name,
 * read-only. Re-anchors the shared favorites store to the backend on mount:
 * the UserContext snapshot is fetched once per login and never refreshed, so
 * without this read the full-array UPDATE_USER_FAVOURITE_PROJECTS write
 * above would overwrite stars toggled elsewhere since login.
 */
export const GET_USER_FAVOURITE_PROJECTS = gql`
  query GetUserFavouriteProjects($id: ID!) {
    userById(id: $id) {
      id
      favourite_projects
    }
  }
`;

/**
 * Verbatim copy of GET_AGENT_SESSIONS — consumed here with the
 * `project eq <id>` filter (inventory item 29) and by the delete cascade's
 * pagination loop (ladder row 41).
 */
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

/** Verbatim copy of UPDATE_AGENT_SESSION_PROJECT (detach / undo re-attach). */
export const UPDATE_AGENT_SESSION_PROJECT = gql`
  mutation UpdateAgentSessionProject(
    $id: ID!
    $project: String
  ) {
    agent_sessionsUpdateOneById(id: $id, input: {project: $project}) {
      item {
        id
      }
    }
  }
`;

/** Verbatim copy of REMOVE_AGENT_SESSION_BY_ID. */
export const REMOVE_AGENT_SESSION_BY_ID = gql`
  mutation RemoveAgentSessionById($id: ID!) {
    agent_sessionsRemoveOneById(id: $id) {
      id
    }
  }
`;

/** Verbatim copy of CREATE_AGENT_SESSION (new session in this project). */
export const CREATE_AGENT_SESSION = gql`
  mutation createAgentSession(
    $title: String,
    $user: Float
    $agent: String
    $project: String
    $rights_mode: String
    $RBAC: RBACInput
  ) {
    agent_sessionsCreateOne(
      input: { agent: $agent, user: $user, project: $project, title: $title, rights_mode: $rights_mode, RBAC: $RBAC }
    ) {
      item {
        id
      }
    }
  }
`;

/**
 * Narrowed from the monolith's GET_AGENTS (same operation root, same
 * variables incl. the default sort): this page only needs identity + visual
 * fields for the session-row agent-name join (projects.md §3 SessionRow data
 * note) and the new-session picker. Distinct operation name — see file
 * header.
 */
export const GET_PROJECT_AGENTS = gql`
  query GetProjectAgents(
    $page: Int!
    $limit: Int!
    $filters: [FilterAgent]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    agentsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      items {
        id
        name
        description
        modelName
        image
        animation_idle
        animation_responding
      }
    }
  }
`;

/**
 * Verbatim copy of the monolith's ITEM_FIELDS base selection (used by the
 * dynamic factories below — the dynamic knowledge-context factories are
 * hand-typed and codegen-excluded, codebase-structure D6).
 */
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

/** Verbatim copy of the GET_ITEM_BY_ID factory (per-gid item card fetch). */
export const GET_ITEM_BY_ID = (
  context: string,
  fields: string[],
  chunks: boolean = false,
) => {
  return gql`
    query ${context}ById($id: ID!) {
      ${context}_itemsById(id: $id) {
        ${ITEM_FIELDS(fields)}
        ${chunks ? "chunks { chunk_content chunk_source chunk_index chunk_id chunk_created_at chunk_updated_at chunk_metadata }" : ""}
      }
    }
  `;
};

/** Verbatim copy of the DELETE_ITEM factory (delete-cascade, ladder row 41). */
export const DELETE_ITEM = (context: string, fields: string[]) => {
  return gql`
    mutation DeleteOneById${context}($id: ID!) {
      ${context}_itemsRemoveOneById(id: $id) {
        id
        ${fields.join("\n")}
      }
    }
  `;
};
