import { gql } from "@apollo/client";

/**
 * GraphQL operations for the /agents index surface, colocated per
 * codebase-structure §1.1/§3.2 (work item 2.8, owner "index").
 *
 * Copied (and deliberately narrowed) from queries/queries.ts — the monolith is
 * untouched; this feature simply stops importing from it. Operation names are
 * globally unique (codebase-structure §3.1) to avoid codegen collisions with
 * the monolith's documents and chat's route-local copies.
 *
 * VERIFIED RESOLVER ARGS (never invent new ones — work-item data layer):
 * - `agentsPagination(page, limit, sort, filters)` with full pageInfo:
 *   queries/queries.ts:168-193.
 * - Filter shapes proven in production: `[{ name: { contains } }]`
 *   (lib/graphql/operations/palette.ts), `[{ active: { eq } }]`
 *   (chat/components/agent-grid.tsx). Array entries AND together; no `or:`
 *   combinator exists for FilterAgent anywhere in the codebase, so server
 *   search is NAME-ONLY (agents.md §4 sanctioned fallback).
 * - `{ category: { eq } }` has ZERO existing usage and could not be
 *   introspection-verified in this environment → the category filter is NOT
 *   shipped (new affordance, not one of the 69 inventory items; hook contract
 *   marks it optional).
 */

/* -----------------------------------------------------------------------------
 * Schema-gated extension (contracts §5).
 *
 * `firewall` is selected by GET_AGENT_DETAIL so the detail panel's Safety
 * section shows REAL state (inventory item 27 — the legacy details sheet was
 * blind: AGENT_FIELDS never fetched the field, agents.md review #2).
 *
 * MERGE PRECONDITION: verify via live introspection that `Agent.firewall`
 * exists as a JSON scalar field. An unknown selection is a hard GraphQL
 * validation error that breaks the whole detail query — if the backend lacks
 * the field, flip this to `false` (the panel then renders an honest
 * "not available" line instead of fake "Unprotected").
 *
 * NOTE: the editor (edit/[id]/queries.ts) declares its own
 * AGENT_FIREWALL_SUPPORTED per contracts §5; the cross-owner import rule
 * ("index imports nothing of the editor's") forces this read-side duplicate.
 * Both constants must be flipped together at verification time.
 * -------------------------------------------------------------------------- */
export const AGENT_FIREWALL_SUPPORTED = true;

/**
 * Deliberate SUBSET of the monolith's AGENT_FIELDS for list rows — rows need
 * no tools/instructions payloads. Nothing is dropped: the detail panel and the
 * editor fetch the full shape by id.
 */
export const AGENT_LIST_FIELDS = `
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
`;

/** Index list — server-side search/status/sort + real pagination (item 1). */
export const GET_AGENTS_INDEX = gql`
  query AgentsIndex(
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
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${AGENT_LIST_FIELDS}
      }
    }
  }
`;

/**
 * Detail panel fetch — AGENT_FIELDS-equivalent (queries/queries.ts:114-166)
 * plus the schema-gated `firewall` read (items 27/69 read side). The
 * monolith's optional `$project` arg is not used by this consumer (the legacy
 * details sheet never passed it either).
 */
export const GET_AGENT_DETAIL = gql`
  query AgentDetail($id: ID!) {
    agentById(id: $id) {
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
      }
      createdAt
      updatedAt
      ${AGENT_FIREWALL_SUPPORTED ? "firewall" : ""}
    }
  }
`;

/**
 * Copy of the details-sheet's bare GET_TOOLS usage
 * (agent-details-sheet.tsx:40-44), narrowed to the fields the panel renders.
 * All of GET_TOOLS' args are optional (queries/queries.ts:1000) — the legacy
 * sheet passed none, and neither do we (identical request semantics).
 */
export const GET_AGENT_DETAIL_TOOLS = gql`
  query AgentDetailTools {
    tools {
      items {
        id
        name
        type
      }
    }
  }
`;

/**
 * Verbatim copy of CREATE_AGENT (queries/queries.ts:948-987) under a unique
 * operation name. `$description: String!` is kept — the create dialog
 * defaults it to "" client-side (agents.md ladder item 7, review #18).
 * `rights_mode` is passed as "private" by the caller, exactly as today.
 * There is NO $instructions on this mutation (verified :949-956) — see
 * SET_AGENT_INSTRUCTIONS below for the chained follow-up.
 */
export const CREATE_AGENT = gql`
  mutation CreateAgentIndex(
    $name: String!
    $description: String!
    $rights_mode: String!
    $model: String
    $image: String
    $RBAC: RBACInput
  ) {
    agentsCreateOne(
      input: {
        name: $name
        description: $description
        rights_mode: $rights_mode
        model: $model
        image: $image
        RBAC: $RBAC
      }
    ) {
      item {
        id
        name
        description
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
        createdAt
      }
    }
  }
`;

/**
 * Minimal agentsUpdateOneById carrying ONLY instructions — `$instructions` is
 * an EXISTING update arg (queries/queries.ts:1034). The create dialog chains
 * CREATE → (instructions? SET) → navigate: two existing operations sequenced,
 * semantically identical contracts, no backend change.
 */
export const SET_AGENT_INSTRUCTIONS = gql`
  mutation AgentSetInstructionsOnCreate($id: ID!, $instructions: String) {
    agentsUpdateOneById(input: { instructions: $instructions }, id: $id) {
      item {
        id
        instructions
      }
    }
  }
`;

/**
 * Copy of agentsCopyOneById (queries/queries.ts:989-997) for the list-row
 * overflow Duplicate (ladder item 33 "also row overflow on list").
 */
export const COPY_AGENT_INDEX = gql`
  mutation CopyAgentIndex($id: ID!) {
    agentsCopyOneById(id: $id) {
      item {
        id
      }
    }
  }
`;

/* -----------------------------------------------------------------------------
 * Model-selector reads — colocated per codebase-structure §3.2/D5.
 *
 * Copied verbatim (field-for-field) from queries/queries.ts:1266-1278
 * (GET_MODELS_LITE) and :1367-1388 (GET_LITELLM_CATALOG) under
 * unique operation names (§3.1) so the selector — used only inside agents
 * (basics.tsx + create-agent-dialog.tsx) — no longer reaches into the monolith.
 * Backend contracts unchanged: identical fields, identical args.
 * -------------------------------------------------------------------------- */
export const GET_AGENT_MODELS_LITE = gql`
  query GetAgentModelsLite($page: Int!, $limit: Int!) {
    modelsPagination(
      page: $page
      limit: $limit
      sort: { field: "name", direction: ASC }
    ) {
      items {
        id
        name
        description
        provider
        active
      }
    }
  }
`;

export const GET_AGENT_LITELLM_CATALOG = gql`
  query GetAgentLiteLLMCatalog {
    litellmCatalog {
      model_name
      active
      upstream_model
      type
      tags
      brand
      region
      max_tokens
      max_input_tokens
      max_output_tokens
      supports_vision
      supports_function_calling
      supports_pdf_input
      supports_audio_input
      input_cost_per_million_tokens
      output_cost_per_million_tokens
    }
  }
`;
