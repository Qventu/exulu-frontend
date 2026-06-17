import { gql } from "@apollo/client";

/**
 * GraphQL operations for the chat feature, colocated per
 * design/codebase-structure.md §1.1/§3.2 (work item 2.3, owner: orchestration).
 *
 * VERBATIM copies of the chat-consumed operations in queries/queries.ts —
 * identical operation names and selections — so Apollo observers of either
 * document instance refresh on `refetchQueries: ["GetAgentSessions"]`-style
 * string names. The monolith itself is untouched; chat simply stops importing
 * from it. The duplicate documents are intentional until the Tail work item
 * deletes the monolith's chat ops (codebase-structure §4 Wave 2.2).
 *
 * NOTE: UPDATE_AGENT_SESSION_ITEMS deliberately keeps the monolith's
 * (duplicated) operation name `UpdateAgentSessionTitle` — byte-identical copy
 * by contract; renaming it would silently break string-based refetch wiring
 * that targets the monolith's document.
 *
 * GET_CHUNK_BY_ID intentionally stays in the monolith — its only chat-side
 * consumer is the READ-ONLY components/ai-elements/response.tsx.
 */

// ---------------------------------------------------------------------------
// Shared field fragments (copied verbatim from queries/queries.ts)
// ---------------------------------------------------------------------------

const AGENT_FIELDS = `
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
`;

const FEEDBACK_FIELDS = `
id
status
agent
description
session
score
user
createdAt
`;

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
  }
`;

const CONTEXT_PRESET_FIELDS = `
  id
  name
  description
  preset_items
  tags
  usage_count
  favorite_count
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
  }
`;

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const GET_AGENTS = gql`
  query GetAgents(
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
        ${AGENT_FIELDS}
      }
    }
  }
`;

export const GET_AGENT_BY_ID = gql`
  query GetAgentById($id: ID!, $project: ID) {
    agentById(id: $id, project: $project) {
      ${AGENT_FIELDS}
    }
  }
`;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

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

export const GET_AGENT_SESSION_BY_ID = gql`
  query GetAgentSessionById($id: ID!) {
    agent_sessionById(id: $id) {
        createdAt
        updatedAt
        user
        title
        agent
        created_by
        rights_mode
        session_items
        project
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
`;

export const GET_AGENT_MESSAGES = gql`
  query GetAgentSessionMessages(
    $page: Int!
    $limit: Int!
    $filters: [FilterAgent_message]
    $sort: SortBy = { field: "createdAt", direction: ASC }
  ) {
    agent_messagesPagination(
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
        session
        content
        createdAt
      }
    }
  }
`;

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

export const REMOVE_AGENT_SESSION_BY_ID = gql`
  mutation RemoveAgentSessionById($id: ID!) {
    agent_sessionsRemoveOneById(id: $id) {
      id
    }
  }
`;

export const UPDATE_AGENT_SESSION_TITLE = gql`
  mutation UpdateAgentSessionTitle(
    $id: ID!
    $title: String
  ) {
    agent_sessionsUpdateOneById(id: $id, input: {title: $title}) {
      item {
        id
        title
      }
    }
  }
`;

export const UPDATE_AGENT_SESSION_RBAC = gql`
  mutation UpdateAgentSessionRbac(
    $id: ID!
    $RBAC: RBACInput
    $rights_mode: String
  ) {
    agent_sessionsUpdateOneById(id: $id, input: { rights_mode: $rights_mode, RBAC: $RBAC }) {
      item {
        id
      }
    }
  }
`;

// NOTE: operation name `UpdateAgentSessionTitle` is a verbatim copy of the
// monolith's (pre-existing duplicate name) — see file header.
export const UPDATE_AGENT_SESSION_ITEMS = gql`
  mutation UpdateAgentSessionTitle(
    $id: ID!
    $session_items: JSON!
  ) {
    agent_sessionsUpdateOneById(id: $id, input: {session_items: $session_items}) {
      item {
        id
        session_items
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const GET_USER_BY_ID = gql`
  query GetUserById($id: ID!) {
    userById(id: $id) {
      id
      name
      firstname
      lastname
      email
    }
  }
`;

// ---------------------------------------------------------------------------
// Prompts (composer ?promptId= deep link + prompt selector)
// ---------------------------------------------------------------------------

export const GET_PROMPT_BY_ID = gql`
  query GetPromptById($id: ID!) {
    prompt_library_itemById(id: $id) {
      ${PROMPT_LIBRARY_FIELDS}
    }
  }
`;

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const CREATE_FEEDBACK = gql`
  mutation CreateFeedback($input: feedbackInput!) {
    feedbackCreateOne(input: $input) {
      item {
        ${FEEDBACK_FIELDS}
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Models (per-request model override)
// ---------------------------------------------------------------------------

export const GET_LITELLM_CATALOG = gql`
  query GetLiteLLMCatalog {
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

// ---------------------------------------------------------------------------
// Knowledge items (source deactivation — dynamic factory, hand-typed,
// codegen-excluded per codebase-structure D6)
// ---------------------------------------------------------------------------

export const UPDATE_ITEM = (context: string) => {
  return gql`
    mutation UpdateOneById${context}($id: ID!, $input: ${context}_itemsInput!) {
      ${context}_itemsUpdateOneById(id: $id, input: $input) {
        item {
          id
        }
        job
      }
    }
  `;
};

// ---------------------------------------------------------------------------
// Context presets (composer "Save context preset")
// ---------------------------------------------------------------------------

export const GET_CONTEXT_PRESETS = gql`
  query GetContextPresets(
    $page: Int!
    $limit: Int!
    $filters: [FilterContext_preset]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    context_presetsPagination(
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
        ${CONTEXT_PRESET_FIELDS}
      }
    }
  }
`;

export const CREATE_CONTEXT_PRESET = gql`
  mutation CreateContextPreset(
    $name: String!
    $description: String
    $preset_items: JSON!
    $tags: JSON
    $rights_mode: String!
    $RBAC: RBACInput
  ) {
    context_presetsCreateOne(
      input: {
        name: $name
        description: $description
        preset_items: $preset_items
        tags: $tags
        rights_mode: $rights_mode
        RBAC: $RBAC
      }
    ) {
      item {
        ${CONTEXT_PRESET_FIELDS}
      }
    }
  }
`;

export const UPDATE_CONTEXT_PRESET = gql`
  mutation UpdateContextPreset(
    $id: ID!
    $name: String
    $description: String
    $preset_items: JSON
    $tags: JSON
    $rights_mode: String
    $RBAC: RBACInput
  ) {
    context_presetsUpdateOneById(
      id: $id
      input: {
        name: $name
        description: $description
        preset_items: $preset_items
        tags: $tags
        rights_mode: $rights_mode
        RBAC: $RBAC
      }
    ) {
      item {
        ${CONTEXT_PRESET_FIELDS}
      }
    }
  }
`;
