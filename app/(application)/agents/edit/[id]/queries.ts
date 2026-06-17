import { gql } from "@apollo/client";

/**
 * GraphQL operations for the /agents/edit/[id] editor surface, colocated per
 * codebase-structure §1.1/§3.2 (work item 2.8, owner "editor").
 *
 * Copied (and deliberately extended) from queries/queries.ts — the monolith is
 * untouched; this feature stops importing from it. Operation names are globally
 * unique (codebase-structure §3.1) to avoid codegen collisions with the
 * monolith's documents and the index's route-local copies.
 *
 * Schema-gated extensions (contracts §5 — three SUPPORTED constants):
 * - `firewall` (selection + input field + variable) — item 69; the legacy
 *   form's `firewall: JSON.stringify(...)` was silently dropped because
 *   UPDATE_AGENT_BY_ID declared no `$firewall` variable (grep firewall
 *   queries/queries.ts = 0 hits).
 * - `RBAC.teams { id rights }` — item 45; the teams round-trip was broken
 *   because AGENT_FIELDS' RBAC selection and UPDATE_AGENT_BY_ID's RBAC return
 *   selection omitted teams.
 * - `$image` on agentsUpdateOneById — items 9-13; the create mutation accepts
 *   $image already, but the update did not — so an avatar generated/picked
 *   inside the editor would have been silently dropped.
 *
 * MERGE PRECONDITION: verify via live introspection that the backend schema
 * actually exposes/accepts these fields. An unknown selection or unknown input
 * field is a hard GraphQL validation error that breaks Save entirely. If a
 * flag is false at merge time, fallbacks per the binding contract apply
 * (Safety renders honest read-only notice; RBAC drops "teams" mode via
 * allowedModes; image-update gated in Appearance).
 */

/* ---------------------------------------------------------------------------
 * 1. FEATURE-FLAG CONSTANTS (contracts §5)
 * ------------------------------------------------------------------------- */

/** false → Safety section renders read-only "not supported" notice instead of
 *  switches; $firewall is omitted from the mutation.
 *  Backend introspection 2026-06-12: Agent has no `firewall` field —
 *  selecting it crashed the editor with "Cannot query field 'firewall' on
 *  type 'Agent'." Flag flipped to false; the read-side duplicate in
 *  ../../queries.ts is flipped to match (both must flip together). */
export const AGENT_FIREWALL_SUPPORTED = false;

/** false → RBACControl gets allowedModes WITHOUT "teams" (transcriptions
 *  precedent: composer.tsx:50-54). RBAC payload omits teams.
 *  Backend introspection 2026-06-12: RBACData has no `teams` field —
 *  selecting it crashed the editor with "Cannot query field 'teams' on
 *  type 'RBACData'." Flag flipped to false (architect's risk #1 fallback). */
export const AGENT_RBAC_TEAMS_SUPPORTED = false;

/** false → Appearance hides "Generate with AI"; the create dialog gains an
 *  optional collapsed avatar disclosure so items 9-13 stay reachable. */
export const AGENT_IMAGE_UPDATE_SUPPORTED = true;

/* ---------------------------------------------------------------------------
 * 2. FRAGMENTS
 * ------------------------------------------------------------------------- */

/**
 * Full AGENT_FIELDS (queries/queries.ts:114-166) plus the two read-side
 * restorations — firewall (item 69) and RBAC.teams (item 45). All
 * fetched-but-unsurfaced fields are KEPT (slug, streaming, maxContextLength,
 * authenticationInformation, workflows) per the relocation-contract-
 * completeness note (agents.md §1 tail). Slug + id surface in Developer
 * (item 35).
 */
export const AGENT_EDITOR_FIELDS = `
  id
  name
  model
  feedback
  suggestions_enabled
  memory
  instructions
  welcomemessage
  defaultagent
  description
  active
  image
  animation_idle
  animation_responding
  tools
  skills
  providerName
  modelName
  maxContextLength
  authenticationInformation
  systemInstructions
  slug
  category
  workflows {
    enabled
    queue {
      name
    }
  }
  streaming
  capabilities {
    text
    images
    files
    audio
    video
  }
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
    ${AGENT_RBAC_TEAMS_SUPPORTED ? "teams { id rights }" : ""}
  }
  createdAt
  updatedAt
  ${AGENT_FIREWALL_SUPPORTED ? "firewall" : ""}
`;

/* ---------------------------------------------------------------------------
 * 3. QUERIES
 * ------------------------------------------------------------------------- */

/** Editor server fetch (item 29) + post-save refetch. */
export const GET_AGENT_EDITOR = gql`
  query AgentEditorById($id: ID!) {
    agentById(id: $id) {
      ${AGENT_EDITOR_FIELDS}
    }
  }
`;

/**
 * Per-sub-agent summary chip data (item 61) — lite agentById for the
 * hierarchy view's per-enabled-sub-agent fetch. Behavior preserved from the
 * legacy GET_AGENT_BY_ID call site (agent-hierarchy-view.tsx:239); we narrow
 * the selection to what's actually rendered.
 */
export const GET_SUB_AGENT_SUMMARY = gql`
  query SubAgentSummary($id: ID!) {
    agentById(id: $id) {
      id
      name
      tools
      skills
      capabilities {
        text
        images
        files
        audio
        video
      }
    }
  }
`;

/** Tools query — verbatim args from queries/queries.ts:999 (item 57/58). */
export const GET_TOOLS_EDITOR = gql`
  query EditorTools($search: String, $category: String, $limit: Int, $page: Int) {
    tools(search: $search, category: $category, limit: $limit, page: $page) {
      items {
        id
        name
        category
        description
        config
        type
      }
      total
      page
      limit
    }
  }
`;

export const GET_TOOL_CATEGORIES_EDITOR = gql`
  query EditorToolCategories {
    toolCategories
  }
`;

export const GET_SKILLS_EDITOR = gql`
  query EditorSkills(
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
        id
        name
        description
      }
    }
  }
`;

export const GET_VARIABLES_EDITOR = gql`
  query EditorVariables(
    $page: Int!
    $limit: Int!
    $filters: [FilterVariable]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    variablesPagination(
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
        id
        name
        value
        encrypted
        createdAt
        updatedAt
      }
    }
  }
`;

export const GET_CONTEXTS_EDITOR = gql`
  query EditorContexts {
    contexts {
      items {
        id
        name
        description
      }
    }
  }
`;

/* ---------------------------------------------------------------------------
 * 4. MUTATIONS
 * ------------------------------------------------------------------------- */

/**
 * UPDATE_AGENT_BY_ID copy extended per contracts §5 with $firewall:JSON,
 * $image:String, and RBAC.teams in the return selection. The legacy mutation
 * (queries/queries.ts:1023-1094) is byte-identical without these additions —
 * they un-trap items 45, 69 and the editor-side avatar (items 9-13).
 *
 * Gating: when a SUPPORTED constant is false, the corresponding input field
 * and return slot collapse to empty string at template-build time so Apollo
 * never sends an undeclared variable.
 */
export const UPDATE_AGENT_EDITOR = gql`
  mutation UpdateAgentEditor(
    $id: ID!
    $name: String
    $feedback: Boolean
    $suggestions_enabled: Boolean
    $model: String
    $description: String
    $welcomemessage: String
    $defaultagent: Boolean
    $memory: String
    $instructions: String
    $rights_mode: String
    $animation_idle: String
    $animation_responding: String
    $category: String
    $tools: JSON
    $skills: JSON
    $active: Boolean
    $RBAC: RBACInput
    ${AGENT_FIREWALL_SUPPORTED ? "$firewall: JSON" : ""}
    ${AGENT_IMAGE_UPDATE_SUPPORTED ? "$image: String" : ""}
  ) {
    agentsUpdateOneById(
      input: {
        name: $name
        feedback: $feedback
        suggestions_enabled: $suggestions_enabled
        model: $model
        description: $description
        welcomemessage: $welcomemessage
        defaultagent: $defaultagent
        memory: $memory
        category: $category
        instructions: $instructions
        animation_idle: $animation_idle
        animation_responding: $animation_responding
        rights_mode: $rights_mode
        active: $active
        tools: $tools
        skills: $skills
        RBAC: $RBAC
        ${AGENT_FIREWALL_SUPPORTED ? "firewall: $firewall" : ""}
        ${AGENT_IMAGE_UPDATE_SUPPORTED ? "image: $image" : ""}
      }
      id: $id
    ) {
      item {
        id
        name
        description
        feedback
        suggestions_enabled
        welcomemessage
        defaultagent
        instructions
        memory
        category
        animation_idle
        animation_responding
        rights_mode
        active
        model
        ${AGENT_IMAGE_UPDATE_SUPPORTED ? "image" : ""}
        ${AGENT_FIREWALL_SUPPORTED ? "firewall" : ""}
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
          ${AGENT_RBAC_TEAMS_SUPPORTED ? "teams { id rights }" : ""}
        }
      }
    }
  }
`;

/** Duplicate (item 33). */
export const COPY_AGENT_EDITOR = gql`
  mutation CopyAgentEditor($id: ID!) {
    agentsCopyOneById(id: $id) {
      item {
        id
      }
    }
  }
`;

/** Delete (item 32). */
export const REMOVE_AGENT_EDITOR = gql`
  mutation RemoveAgentEditor($id: ID!) {
    agentsRemoveOneById(id: $id) {
      id
    }
  }
`;
