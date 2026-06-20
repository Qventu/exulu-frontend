import { gql } from "@apollo/client";

/**
 * GraphQL operations for the /skills surface, colocated per
 * codebase-structure.md §1.1/§3.2/D5 (work item 2.10).
 *
 * Copied (not edited) from queries/queries.ts:2937-3058. The monolith stays
 * untouched because hooks/use-skills.tsx still imports from it (parallel-
 * protocol rule 3; brief rule 3 — cross-feature exports stable).
 *
 * Operation NAMES are suffixed `Index` so the route-local documents never
 * collide with the monolith's documents on a single Apollo client (mirrors
 * app/(application)/prompts/queries.ts).
 *
 * VERIFIED RESOLVER ARGS (proven shapes only — queries/queries.ts):
 * - skillsPagination(page, limit, sort, filters) returns pageInfo +
 *   items { SKILL_FIELDS }.
 * - Filter shapes: [{ name: { contains } }] (proven in production — legacy
 *   skills/page.tsx:79-80) and [{ tags: { contains } }] (FilterSkill.tags is a
 *   FilterOperatorJSON; `contains` maps to Postgres jsonb `@>` containment, the
 *   same mechanism the prompts tag filter uses). Array entries AND together.
 *   No verified `or:` combinator on FilterSkill — free-text search stays
 *   NAME-only server-side (see SKILLS_OR_SEARCH_SUPPORTED). Tag filtering is a
 *   separate set of AND'd `tags: { contains }` entries, not an OR search.
 */

/* -----------------------------------------------------------------------------
 * Schema-gated extensions (brief rule 4) — mirror PROMPTS_*_SUPPORTED.
 *
 * SKILLS_RBAC_TEAMS_SUPPORTED — add teams { id rights } to RBAC selection.
 * Enabled 2026-06-19: the backend now exposes `teams` on both `RBACData` and
 * `RBACInput` (src/graphql/schemas/index.ts), and the resolver/mutation layer
 * (ee/rbac-resolver.ts, ee/rbac-update.ts) reads and persists team grants, so
 * skills can query and mutate `teams` symmetrically.
 *
 * SKILLS_OR_SEARCH_SUPPORTED — extend search to name-OR-tags via an `or:`
 * combinator on FilterSkill. Today: false. No existing consumer extends
 * FilterSkill with `or:` or `tags: { contains }`; search stays name-only
 * server-side. Mirrors PROMPTS_OR_SEARCH_SUPPORTED.
 *
 * SKILLS_ASSIGNED_AGENTS_SUPPORTED — reserved (no consumer in this PR).
 * -------------------------------------------------------------------------- */
export const SKILLS_RBAC_TEAMS_SUPPORTED = true;
export const SKILLS_OR_SEARCH_SUPPORTED = false;
export const SKILLS_ASSIGNED_AGENTS_SUPPORTED = false;

const SKILL_FIELDS_INDEX = `
  id
  name
  description
  s3folder
  tags
  usage_count
  favorite_count
  current_version
  history
  rights_mode
  created_by
  createdAt
  updatedAt
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
    ${SKILLS_RBAC_TEAMS_SUPPORTED ? "teams { id rights }" : ""}
  }
`;

export const GET_SKILLS_INDEX = gql`
  query GetSkillsIndex(
    $page: Int!
    $limit: Int!
    $filters: [FilterSkill]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    skillsPagination(
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
        ${SKILL_FIELDS_INDEX}
      }
    }
  }
`;

export const GET_UNIQUE_SKILL_TAGS_INDEX = gql`
  query UniqueSkillTagsIndex {
    getUniqueSkillTags
  }
`;

export const GET_SKILL_BY_ID_INDEX = gql`
  query GetSkillByIdIndex($id: ID!) {
    skillById(id: $id) {
      ${SKILL_FIELDS_INDEX}
    }
  }
`;

export const CREATE_SKILL_INDEX = gql`
  mutation CreateSkillIndex(
    $name: String!
    $description: String
    $tags: JSON
    $rights_mode: String!
    $RBAC: RBACInput
  ) {
    skillsCreateOne(
      input: {
        name: $name
        description: $description
        tags: $tags
        rights_mode: $rights_mode
        RBAC: $RBAC
      }
    ) {
      item {
        ${SKILL_FIELDS_INDEX}
      }
    }
  }
`;

export const UPDATE_SKILL_INDEX = gql`
  mutation UpdateSkillIndex(
    $id: ID!
    $name: String
    $description: String
    $tags: JSON
    $rights_mode: String
    $RBAC: RBACInput
    $history: JSON
    $current_version: Float
  ) {
    skillsUpdateOneById(
      id: $id
      input: {
        name: $name
        description: $description
        tags: $tags
        rights_mode: $rights_mode
        RBAC: $RBAC
        history: $history
        current_version: $current_version
      }
    ) {
      item {
        ${SKILL_FIELDS_INDEX}
      }
    }
  }
`;

export const DELETE_SKILL_INDEX = gql`
  mutation DeleteSkillIndex($id: ID!) {
    skillsRemoveOneById(id: $id) {
      id
    }
  }
`;
