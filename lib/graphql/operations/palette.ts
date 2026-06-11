// Command-palette entity-search operations (navigation.md §4 "Search").
//
// These mirror the paginated list operations in queries/queries.ts
// (GET_AGENTS, GET_AGENT_SESSIONS, GET_PROJECTS, GET_PROMPTS, GET_SKILLS,
// GET_CONTEXTS) against the same backend resolvers — the tier rules forbid
// components/shell/** from importing the queries monolith directly
// (eslint "exulu/tier-shell"), and the palette only needs id + display
// fields, so these lean documents are both the sanctioned location
// (codegen.ts: "operations … live in lib/graphql/operations/") and cheaper
// than the monolith's full field sets. All results are RBAC-scoped by the
// backend, same as the originals.
//
// Operation names are Palette-prefixed: codegen scans lib/** and operation
// names must stay globally unique.

import { gql } from "@apollo/client";

/**
 * Chat sessions, newest first. Serves both palette uses:
 * - Recent: `{ page: 1, limit: 3 }` (no filters)
 * - Search: `{ page: 1, limit: 5, filters: [{ title: { contains: term } }] }`
 * `agent` is the owning agent's id — sessions deep-link to
 * `/chat/{agent}/{id}`.
 */
export const PALETTE_CHAT_SESSIONS = gql`
  query PaletteChatSessions(
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
      items {
        id
        title
        agent
        updatedAt
      }
    }
  }
`;

export const PALETTE_SEARCH_AGENTS = gql`
  query PaletteSearchAgents(
    $page: Int!
    $limit: Int!
    $filters: [FilterAgent]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    agentsPagination(page: $page, limit: $limit, sort: $sort, filters: $filters) {
      items {
        id
        name
      }
    }
  }
`;

export const PALETTE_SEARCH_PROJECTS = gql`
  query PaletteSearchProjects(
    $page: Int!
    $limit: Int!
    $filters: [FilterProject]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    projectsPagination(page: $page, limit: $limit, sort: $sort, filters: $filters) {
      items {
        id
        name
      }
    }
  }
`;

export const PALETTE_SEARCH_PROMPTS = gql`
  query PaletteSearchPrompts(
    $page: Int!
    $limit: Int!
    $filters: [FilterPrompt_library_item]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    prompt_libraryPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      items {
        id
        name
      }
    }
  }
`;

export const PALETTE_SEARCH_SKILLS = gql`
  query PaletteSearchSkills(
    $page: Int!
    $limit: Int!
    $filters: [FilterSkill]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    skillsPagination(page: $page, limit: $limit, sort: $sort, filters: $filters) {
      items {
        id
        name
      }
    }
  }
`;

/**
 * The contexts resolver takes no filter arguments (see GET_CONTEXTS) —
 * the palette fetches the (small, RBAC-scoped) list once per search session
 * and substring-filters client-side.
 */
export const PALETTE_KNOWLEDGE_CONTEXTS = gql`
  query PaletteKnowledgeContexts {
    contexts {
      items {
        id
        name
      }
    }
  }
`;
