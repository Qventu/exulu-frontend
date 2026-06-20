import { gql } from "@apollo/client";

/**
 * GraphQL operations for the /prompts surface, colocated per
 * codebase-structure.md §1.1/§3.2/D5 (work item 2.9).
 *
 * Copied (not edited) from queries/queries.ts. The monolith is untouched and
 * still exports the originals for the cross-feature consumers (chat composer
 * via useIncrementPromptUsage / usePrompts, agents form via PromptCard +
 * usePrompts, agents PromptBrowserSheet via usePrompts/useUniquePromptTags/
 * useUpdatePrompt) — they import from `hooks/use-prompts.tsx`, which still
 * points at queries/queries.ts. Only the redesigned route consumes these
 * route-local copies.
 *
 * Operation NAMES are globally unique (codebase-structure §3.1) so they never
 * collide with the monolith's documents on a single Apollo client.
 *
 * VERIFIED RESOLVER ARGS (proven shapes only — see queries/queries.ts):
 * - `prompt_libraryPagination(page, limit, sort, filters)` with the full
 *   pageInfo (queries/queries.ts:2607-2632).
 * - Filter shapes proven in production: `[{ name: { contains } }]`,
 *   `[{ tags: { contains } }]`, `[{ assigned_agents: { contains } }]`
 *   (app/(application)/prompts/page.tsx:62-77 in legacy). Array entries AND
 *   together. There is NO verified `or:` combinator for FilterPrompt_library_*
 *   — list search stays NAME-only server-side (spec deltas in prompts.md §3
 *   note widening search is a server-load tradeoff that needs backend
 *   support; we keep the existing semantic for this redesign — see
 *   PROMPTS_OR_SEARCH_SUPPORTED below).
 */

/* -----------------------------------------------------------------------------
 * Schema-gated extension (contracts §5).
 *
 * `prompts.md` §3 widens search to or(name/description/content). The monolith
 * has never combined `or:` filters on FilterPrompt_library_item — flipping
 * this on without backend confirmation would crash the list query. Default
 * OFF: search stays name-only server-side (no regression vs. today). Flip to
 * `true` only after introspection confirms the FilterPrompt_library_item
 * input type accepts an `or:` array — the query below is shaped to drop in
 * either way.
 * -------------------------------------------------------------------------- */
export const PROMPTS_OR_SEARCH_SUPPORTED = false;

/* -----------------------------------------------------------------------------
 * Schema-gated extension (contracts §5) — mirrors AGENT_RBAC_TEAMS_SUPPORTED
 * in app/(application)/agents/edit/[id]/queries.ts. Backend introspection on
 * 2026-06-12 (during agents 2.8) proved that `RBACData` has no `teams` field
 * and that selecting it crashes the editor with
 * "Cannot query field 'teams' on type 'RBACData'.". Since `RBACInput` is the
 * same shared type used by prompts, sending `teams` from /prompts will fail
 * symmetrically. Flag defaults OFF: the fragment omits `teams`, the editor
 * mutation omits `teams`, RBACControl drops the "teams" mode, and the editor
 * summary covers only the 4 supported modes.
 *
 * Enabled 2026-06-19: the backend now exposes `teams` on both `RBACData` and
 * `RBACInput` (src/graphql/schemas/index.ts), and the resolver/mutation layer
 * (ee/rbac-resolver.ts, ee/rbac-update.ts) reads and persists team grants, so
 * prompts can query and mutate `teams` symmetrically.
 * -------------------------------------------------------------------------- */
export const PROMPTS_RBAC_TEAMS_SUPPORTED = true;

const PROMPT_LIBRARY_FIELDS = `
  id
  name
  description
  content
  tags
  usage_count
  favorite_count
  assigned_agents
  rights_mode
  created_by
  createdAt
  updatedAt
  history
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
    ${PROMPTS_RBAC_TEAMS_SUPPORTED ? "teams { id rights }" : ""}
  }
`;

const PROMPT_FAVORITE_FIELDS = `
  id
  user_id
  prompt_id
  createdAt
`;

export const GET_PROMPTS_INDEX = gql`
  query PromptsIndex(
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
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${PROMPT_LIBRARY_FIELDS}
      }
    }
  }
`;

export const GET_PROMPT_BY_ID_INDEX = gql`
  query PromptByIdIndex($id: ID!) {
    prompt_library_itemById(id: $id) {
      ${PROMPT_LIBRARY_FIELDS}
    }
  }
`;

export const GET_UNIQUE_PROMPT_TAGS_INDEX = gql`
  query UniquePromptTagsIndex {
    getUniquePromptTags
  }
`;

export const GET_USER_PROMPT_FAVORITES_INDEX = gql`
  query UserPromptFavoritesIndex($user_id: Float!) {
    prompt_favoritesPagination(
      filters: [{ user_id: { eq: $user_id } }]
    ) {
      items {
        ${PROMPT_FAVORITE_FIELDS}
      }
    }
  }
`;

export const CREATE_PROMPT_FAVORITE_INDEX = gql`
  mutation CreatePromptFavoriteIndex($user_id: Float!, $prompt_id: String!) {
    prompt_favoritesCreateOne(
      input: { user_id: $user_id, prompt_id: $prompt_id }
    ) {
      item {
        ${PROMPT_FAVORITE_FIELDS}
      }
    }
  }
`;

export const DELETE_PROMPT_FAVORITE_INDEX = gql`
  mutation DeletePromptFavoriteIndex($id: ID!) {
    prompt_favoritesRemoveOneById(id: $id) {
      id
    }
  }
`;

export const INCREMENT_PROMPT_FAVORITES_INDEX = gql`
  mutation IncrementPromptFavoritesIndex($id: ID!, $favorite_count: Float!) {
    prompt_libraryUpdateOneById(
      id: $id
      input: { favorite_count: $favorite_count }
    ) {
      item {
        id
        favorite_count
      }
    }
  }
`;

export const INCREMENT_PROMPT_USAGE_INDEX = gql`
  mutation IncrementPromptUsageIndex($id: ID!, $usage_count: Float!) {
    prompt_libraryUpdateOneById(
      id: $id
      input: { usage_count: $usage_count }
    ) {
      item {
        id
        usage_count
      }
    }
  }
`;

export const DELETE_PROMPT_INDEX = gql`
  mutation DeletePromptIndex($id: ID!) {
    prompt_libraryRemoveOneById(id: $id) {
      id
    }
  }
`;

export const UPDATE_PROMPT_INDEX = gql`
  mutation UpdatePromptIndex(
    $id: ID!
    $name: String
    $description: String
    $content: String
    $tags: JSON
    $rights_mode: String
    $RBAC: RBACInput
    $assigned_agents: JSON
    $history: JSON
  ) {
    prompt_libraryUpdateOneById(
      id: $id
      input: {
        name: $name
        description: $description
        content: $content
        tags: $tags
        rights_mode: $rights_mode
        RBAC: $RBAC
        assigned_agents: $assigned_agents
        history: $history
      }
    ) {
      item {
        ${PROMPT_LIBRARY_FIELDS}
      }
    }
  }
`;

export const CREATE_PROMPT_INDEX = gql`
  mutation CreatePromptIndex(
    $name: String!
    $description: String
    $content: String!
    $tags: JSON
    $rights_mode: String!
    $RBAC: RBACInput
    $assigned_agents: JSON
  ) {
    prompt_libraryCreateOne(
      input: {
        name: $name
        description: $description
        content: $content
        tags: $tags
        rights_mode: $rights_mode
        RBAC: $RBAC
        assigned_agents: $assigned_agents
      }
    ) {
      item {
        ${PROMPT_LIBRARY_FIELDS}
      }
    }
  }
`;
