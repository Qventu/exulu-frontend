import { gql } from "@apollo/client";

/**
 * Agent favourites (star) — per-user, cross-device, persisted on the user row
 * as `users.favourite_agents` (JSON array of agent ids; backend
 * src/postgres/core-schema.ts — a sibling of `favourite_projects`). Shared by
 * /agents (the star + cards) and /chat (the picker's Favourites section) via
 * hooks/use-favourite-agents.ts, so the documents live here rather than in
 * either route's queries.ts. Same three documents as /projects and /data:
 * read the array, full-array write via the generic usersUpdateOne, and a
 * by-ids resolve. Distinct operation names (codebase-structure §3.1).
 */

/** Re-anchors the shared favourites store to the backend on mount. */
export const GET_USER_FAVOURITE_AGENTS = gql`
  query GetUserFavouriteAgents($id: ID!) {
    userById(id: $id) {
      id
      favourite_agents
    }
  }
`;

/** Full-array write (json fields are JSON-stringified server-side). */
export const UPDATE_USER_FAVOURITE_AGENTS = gql`
  mutation UpdateUserFavouriteAgents($id: Float!, $favourite_agents: JSON) {
    usersUpdateOne(
      input: { favourite_agents: $favourite_agents }
      where: { id: { eq: $id } }
    ) {
      item {
        id
        favourite_agents
      }
    }
  }
`;

/**
 * Resolves the starred ids to list rows regardless of which index page they
 * sit on — `agentByIds` is the existing batch root (queries/queries.ts
 * GET_AGENTS_BY_IDS), narrowed to the /agents row subset (AGENT_LIST_FIELDS
 * in agents/queries.ts — kept in step by hand, the index renders these rows).
 */
export const GET_FAVOURITE_AGENTS_BY_IDS = gql`
  query AgentsFavouritesByIds($ids: [ID!]!) {
    agentByIds(ids: $ids) {
      id
      name
      description
      image
      animation_idle
      animation_responding
      modelName
      providerName
      active
      category
      rights_mode
      updatedAt
    }
  }
`;
