import { gql } from "@apollo/client";

export const PAGINATION_POSTFIX = "_itemsPagination";
export const CREATE_ONE_POSTFIX = "_itemsCreateOne";

const CONTEXT_FIELDS = `
    id
    name
    description
    embedder
    slug
    active
    fields
    configuration
`;

const ITEM_FIELDS = (fields: string[]) => `
id
name
description
tags
external_id
createdAt
embeddings_updated_at
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
  projects {
    id
    rights
  }
}
${fields.join("\n")}
`;

const USER_FIELDS = `
id
firstname
lastname
email
super_admin
apikey
anthropic_token
type
role
favourite_agents
`;

const AGENT_FIELDS = `
id
name
providerapikey
instructions
description
active
image
tools
providerName
modelName
maxContextLength
provider
slug
category
rateLimit {
  name
  rate_limit {
    time
    limit
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
backend
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
      projects {
        id
        rights
      }
}
createdAt
updatedAt
`;

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
          user
          title
          agent
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
            projects {
              id
              rights
            }
          }
          id
      }
    }
  }
`;

export const GET_CONTEXTS = gql`
  query GetContexts {
    contexts {
      items {
        ${CONTEXT_FIELDS}
      }
    }
  }
`;

export const GET_CONTEXT_BY_ID = gql`
  query GetContextById($id: ID!) {
    contextById(id: $id) {
      ${CONTEXT_FIELDS}
    }
  }
`;

export const GET_ITEMS = (context: string, fields: string[]) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1)
  return gql`
    query ${context}Pagination($page: Int!, $limit: Int!, $filters: [Filter${upperCaseContext}_items], $sort: SortBy = { field: "updatedAt", direction: DESC }) {
      ${context}${PAGINATION_POSTFIX}(page: $page, limit: $limit, filters: $filters, sort: $sort) {
        pageInfo {
          pageCount
          itemCount
          currentPage
          hasPreviousPage
          hasNextPage
        }
        items {
          ${ITEM_FIELDS(fields)}
        }
      }
    }
  `;
};

export const PROCESS_ITEM_FIELD = (context: string) => {
  return gql`
    mutation ProcessItemField${context}($item: ID!, $field: ${context}_itemsProcessorFieldEnum!) {
      ${context}_itemsProcessItemField(item: $item, field: $field) {
        message
        result
        job
      }
    }
  `;
};

export const GET_ITEM_BY_ID = (context: string, fields: string[], chunks: boolean = false) => {
  return gql`
    query ${context}ById($id: ID!) {
      ${context}_itemsById(id: $id) {
        ${ITEM_FIELDS(fields)}
        ${chunks ? "chunks { fts_rank hybrid_score content source chunk_index chunk_id chunk_created_at chunk_updated_at embedding_size }" : ""}
      }
    }
  `;
};

export const CREATE_ITEM = (context: string) => {
  return gql`
    mutation CreateOne${context}($input: ${context}_itemsInput!) {
      ${context}_itemsCreateOne(input: $input) {
        item {
          id
        }
        job
      }
    }
  `;
};

export const DELETE_CHUNKS = (context: string) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1)
  return gql`
    mutation DeleteChunks${context}($where: [Filter${upperCaseContext}_items]) {
      ${context}_itemsDeleteChunks(where: $where) {
        items
        jobs
      }
    }
  `;
};


export const GENERATE_CHUNKS = (context: string) => {
  const upperCaseContext = context.charAt(0).toUpperCase() + context.slice(1)
  return gql`
    mutation GenerateChunks${context}($where: [Filter${upperCaseContext}_items]) {
      ${context}_itemsGenerateChunks(where: $where) {
        items
        jobs
      }
    }
  `;
};

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

export const GET_JOB_RESULTS = gql`
  query GetJobResults(
    $page: Int!
    $limit: Int!
    $filters: [FilterJob_result]
    $sort: SortBy = {
      field: "createdAt",
      direction: DESC
    }
  ) {
    job_resultsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      items {
        job_id
        state
        error
        label
        result
        metadata
        createdAt
        updatedAt
        id
      }
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
    }
  }
`;
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
        name
      }
    }
  }
`;
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
        role
      }
    }
  }
`;
export const GET_USER_ROLE_BY_ID = gql`
  query GetUserRoleById($id: ID!) {
    roleById(id: $id) {
      id
      name
      agents
      workflows
      api
      variables
      users
      createdAt
      updatedAt
    }
  }
`;
export const GET_JOB_RESULT_BY_ID = gql`
  query GetJobResultById($id: ID!) {
    job_resultById(id: $id) {
        id
        job_id
        state
        error
        label
        result
        metadata
        createdAt
        updatedAt
    }
  }
`;
export const GET_AGENT_BY_ID = gql`
  query GetAgentById($id: ID!) {
    agentById(id: $id) {
      ${AGENT_FIELDS}
    }
  }
`;
export const GET_AGENTS_BY_IDS = gql`
  query GetAgentsByIds($ids: [ID!]!) {
    agentByIds(ids: $ids) {
      ${AGENT_FIELDS}
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
          projects {
            id
            rights
          }
        }
        id
    }
  }
`;
export const GET_AGENT_SESSION = gql`
  query GetAgentSession($filters: [FilterAgent_session]) {
    agent_sessionOne(filters: $filters) {
        createdAt
        updatedAt
        user
        title
        agent
        id
    }
  }
`;

export const UPDATE_USER_BY_ID = gql`
    mutation UpdateUser(
      $email: String,
      $firstname: String,
      $anthropic_token: String,
      $super_admin: Boolean,
      $lastname: String,
      $role: String,
      $favourite_agents: JSON,
      $id: ID!
     ) {
        usersUpdateOneById(id: $id, input: {
            email: $email,
            firstname: $firstname,
            anthropic_token: $anthropic_token,
            super_admin: $super_admin,
            lastname: $lastname,
            role: $role,
            favourite_agents: $favourite_agents
        }) {
          item {
            ${USER_FIELDS}
          }
        }
    }
`;
export const CREATE_API_USER = gql`
    mutation CreateUser(
      $firstname: String,
      $type: String,
      $apikey: String,
      $email: String,
      $role: String
     ) {
      usersCreateOne(input: {
            firstname: $firstname,
            type: $type,
            apikey: $apikey,
            email: $email,
            role: $role
        }) {
            item {
              id
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
        }
    }
  }
`;
export const GET_USER_BY_EMAIL = gql`
   query GetUserByEmail($email: String!) {
        userOne(filters: {email: $email}) {
            ${USER_FIELDS}
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
      input: { agent: $agent, user: $user, title: $title, project: $project, rights_mode: $rights_mode, RBAC: $RBAC }
    ) {
      item {
        id
      }
    }
  }
`;
export const CREATE_AGENT = gql`
  mutation createAgent(
    $name: String!
    $description: String!
    $rights_mode: String!
    $backend: String!
    $image: String
    $RBAC: RBACInput
  ) {
    agentsCreateOne(
      input: {
        name: $name
        description: $description
        rights_mode: $rights_mode
        backend: $backend
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
          projects {
            id
            rights
          }
        }
        createdAt
       }
    }
  }
`;

export const GET_TOOLS = gql`
  query GetTools {
    tools {
      items {
        id
        name
        description
        config
        type
      }
    }
  }
`;

export const UPDATE_AGENT_BY_ID = gql`
  mutation UpdateAgent(
    $id: ID!
    $name: String
    $backend: String
    $description: String
    $instructions: String
    $rights_mode: String
    $category: String
    $tools: JSON
    $active: Boolean
    $providerapikey: String
    $RBAC: RBACInput
  ) {
    agentsUpdateOneById(
      input: { 
        name: $name
        backend: $backend
        description: $description
        category: $category
        instructions: $instructions
        rights_mode: $rights_mode
        active: $active
        tools: $tools
        providerapikey: $providerapikey
        RBAC: $RBAC
      }
      id: $id
    ) {
        item {
          id
          name
          description
          instructions
          category
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
            projects {
              id
              rights
            }
          }
        }
    }
  }
`;
export const CREATE_USER_ROLE = gql`
  mutation CreateUserRole($name: String!, $agents: String, $workflows: String, $variables: String, $users: String, $api: String) {
    rolesCreateOne(input: { name: $name, agents: $agents, workflows: $workflows, variables: $variables, users: $users, api: $api}) {
        item {
          id
          createdAt
          agents
          api
          workflows
          variables
          users
          name
        }
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($email: String!, $password: String, $type: String, $emailVerified: String) {
    usersCreateOne(input: { email: $email, password: $password, type: $type, emailVerified: $emailVerified }) {
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

export const GET_PROVIDERS = gql`
  query GetProviders {
    providers {
      items {
        id
        name
        description
        provider
        modelName
        providerName
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
export const REMOVE_JOB_RESULT_BY_ID = gql`
  mutation RemoveJobResultById($id: ID!) {
    job_resultsRemoveOneById(id: $id) {
      id
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
export const REMOVE_AGENT_BY_ID = gql`
  mutation RemoveAgentById($id: ID!) {
    agentsRemoveOneById(id: $id) {
      id
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

export const GET_JOB_STATISTICS = gql`
  query GetJobStatistics($user: Float, $agent: String, $from: String, $to: String) {
    jobStatistics(user: $user, agent: $agent, from: $from, to: $to) {
      completedCount
      failedCount
      averageDuration
    }
  }
`;

export const GET_VARIABLES = gql`
  query GetVariables(
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

export const GET_VARIABLE_BY_ID = gql`
  query GetVariableById($id: ID!) {
    variableById(id: $id) {
      id
      name
      value
      encrypted
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_VARIABLE = gql`
  mutation CreateVariable(
    $name: String!
    $value: String!
    $encrypted: Boolean
  ) {
    variablesCreateOne(
      input: {
        name: $name
        value: $value
        encrypted: $encrypted
      }
    ) {
      item {
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

export const UPDATE_VARIABLE = gql`
  mutation UpdateVariable(
    $id: ID!
    $name: String
    $value: String
    $encrypted: Boolean
  ) {
    variablesUpdateOneById(
      id: $id
      input: {
        name: $name
        value: $value
        encrypted: $encrypted
      }
    ) {
      id
      name
      value
      encrypted
      createdAt
      updatedAt
    }
  }
`;

export const REMOVE_VARIABLE_BY_ID = gql`
  mutation RemoveVariableById($id: ID!) {
    variablesRemoveOneById(id: $id) {
      id
    }
  }
`;

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

export const GET_WORKFLOW_TEMPLATES = gql`
  query GetWorkflowTemplates(
    $page: Int!
    $limit: Int!
    $filters: [FilterWorkflow_template]
    $sort: SortBy = { field: "updatedAt", direction: DESC }
  ) {
    workflow_templatesPagination(
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
        owner
        rights_mode
        variables
        steps_json
        example_metadata_json
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
          projects {
            id
            rights
          }
        }
      }
    }
  }
`;

export const GET_WORKFLOW_TEMPLATE_BY_ID = gql`
  query GetWorkflowTemplateById($id: ID!) {
    workflow_templateById(id: $id) {
      id
      name
      description
      owner
      rights_mode
      variables
      steps_json
      example_metadata_json
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_WORKFLOW_TEMPLATE = gql`
  mutation CreateWorkflowTemplate(
    $name: String!
    $description: String
    $owner: Float!
    $rights_mode: String!
    $RBAC: RBACInput
    $variables: JSON
    $steps_json: JSON!
    $example_metadata_json: JSON
  ) {
    workflow_templatesCreateOne(
      input: {
        name: $name
        description: $description
        owner: $owner
        rights_mode: $rights_mode
        RBAC: $RBAC
        variables: $variables
        steps_json: $steps_json
        example_metadata_json: $example_metadata_json
      }
    ) {
      id
      name
      description
      owner
      rights_mode
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
        projects {
          id
          rights
        }
      }
      variables
      steps_json
      example_metadata_json
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_WORKFLOW_TEMPLATE = gql`
  mutation UpdateWorkflowTemplate(
    $id: ID!
    $name: String
    $description: String
    $rights_mode: String
    $RBAC: RBACInput
    $variables: JSON
    $steps_json: JSON
    $example_metadata_json: JSON
  ) {
    workflow_templatesUpdateOneById(
      id: $id
      input: {
        name: $name
        description: $description
        rights_mode: $rights_mode
        RBAC: $RBAC
        variables: $variables
        steps_json: $steps_json
        example_metadata_json: $example_metadata_json
      }
    ) {
      id
      name
      description
      owner
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
        projects {
          id
          rights
        }
      }
      variables
      steps_json
      example_metadata_json
      createdAt
      updatedAt
    }
  }
`;

export const REMOVE_WORKFLOW_TEMPLATE_BY_ID = gql`
  mutation RemoveWorkflowTemplateById($id: ID!) {
    workflow_templatesRemoveOneById(id: $id) {
      id
    }
  }
`;

export const GET_JOB_STATISTICS_ENHANCED = gql`
  query GetJobStatisticsEnhanced($user: Float, $agent: String, $from: String, $to: String) {
    jobStatistics(user: $user, agent: $agent, from: $from, to: $to) {
      runningCount
      erroredCount
      completedCount
      failedCount
      averageDuration
    }
  }
`;

// Analytics Dashboard Queries

// Summary Cards Queries (24h vs 7-day average)
export const GET_AGENT_SESSIONS_STATISTICS = gql`
  query AgentSessionsStatistics($from: Date!, $to: Date!) {
    agent_sessionsStatistics(filters: {
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_WORKFLOW_RUNS_STATISTICS = gql`
  query WorkflowRunsStatistics($from: Date!, $to: Date!) {
    jobsStatistics(filters: {
      type: { eq: "workflow" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_EMBEDDING_JOBS_STATISTICS = gql`
  query EmbeddingJobsStatistics($from: Date!, $to: Date!) {
    jobsStatistics(filters: {
      type: { eq: "embedder" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_FUNCTION_CALLS_STATISTICS = gql`
  query FunctionCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      type: { eq: TOOL_CALL }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_AGENT_RUN_STATISTICS = gql`  
  query AgentCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      type: { eq: AGENT_RUN }
      name: { eq: "count" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;

export const GET_TOKEN_USAGE_STATISTICS = gql`  
  query AgentCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      name: { in: ["inputTokens", "outputTokens"] }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;


// Time Series Chart Query
export const GET_TIME_SERIES_STATISTICS = gql`
  query TimeSeriesStatistics($type: typeEnum!, $from: Date!, $to: Date!) {
    trackingStatistics(
      groupBy: "createdAt"
      filters: {
        type: { eq: $type }
        createdAt: { and: [{ gte: $from }, { lte: $to }] }
      }
    ) {
      group
      count
    }
  }
`;

// Donut Chart Query  
export const GET_DONUT_STATISTICS = gql`
  query DonutStatistics($type: typeEnum!, $groupBy: String!, $from: Date!, $to: Date!) {
    trackingStatistics(
      groupBy: $groupBy
      filters: {
        type: { eq: $type }
        createdAt: { and: [{ gte: $from }, { lte: $to }] }
      }
    ) {
      group
      count
    }
  }
`;

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

export const GET_PROJECTS_BY_IDS = gql`
  query GetProjectsByIds($ids: [ID!]!) {
    projectByIds(ids: $ids) {
      ${PROJECT_FIELDS}
    }
  }
`;

export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($id: ID!) {
    projectById(id: $id) {
      ${PROJECT_FIELDS}
    }
  }
`;

export const UPDATE_USER_FAVOURITE_PROJECTS = gql`
  mutation UpdateUserFavouriteProjects($id: ID!, $favourite_projects: JSON) {
    userUpdateById(input: { favourite_projects: $favourite_projects }, filter: { id: $id }) {
      item {
        id
        favourite_projects
      }
    }
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: projectInput!) {
    projectsCreateOne(input: $input) {
      item {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

export const UPDATE_PROJECT = gql`
  mutation UpdateProject($id: ID!, $input: projectInput!) {
    projectsUpdateOneById(id: $id, input: $input) {
      item {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

export const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!) {
    projectsRemoveOneById(id: $id) {
      id
      name
    }
  }
`;

// ============================================
// EVAL-RELATED QUERIES
// ============================================

const TEST_CASE_FIELDS = `
  id
  name
  description
  inputs
  expected_output
  expected_tools
  expected_knowledge_sources
  expected_agent_tools
  eval_set_id
  createdAt
  updatedAt
`;

const EVAL_SET_FIELDS = `
  id
  name
  description
  createdAt
  updatedAt
`;

const EVAL_RUN_FIELDS = `
  id
  name
  eval_set_id
  agent_id
  eval_functions
  config
  scoring_method
  pass_threshold
  test_case_ids
  createdAt
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
    projects {
      id
      rights
    }
  }
`;

// Test Cases
export const GET_TEST_CASES = gql`
  query GetTestCases(
    $page: Int!
    $limit: Int!
    $filters: [FilterTest_case]
  ) {
    test_casesPagination(page: $page, limit: $limit, filters: $filters) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${TEST_CASE_FIELDS}
      }
    }
  }
`;

export const GET_TEST_CASE_BY_ID = gql`
  query GetTestCaseById($id: ID!) {
    test_caseById(id: $id) {
      ${TEST_CASE_FIELDS}
    }
  }
`;

export const CREATE_TEST_CASE = gql`
  mutation CreateTestCase($data: test_caseInput!) {
    test_casesCreateOne(input: $data) {
      item {
        ${TEST_CASE_FIELDS}
      }
    }
  }
`;

export const UPDATE_TEST_CASE = gql`
  mutation UpdateTestCase($id: ID!, $data: test_caseInput!) {
    test_casesUpdateOneById(id: $id, input: $data) {
      item {
        ${TEST_CASE_FIELDS}
      }
    }
  }
`;

export const DELETE_TEST_CASE = gql`
  mutation DeleteTestCase($id: ID!) {
    test_casesRemoveOneById(id: $id) {
      id
      name
    }
  }
`;

// Eval Sets
export const GET_EVAL_SETS = gql`
  query GetEvalSets(
    $page: Int!
    $limit: Int!
    $filters: [FilterEval_set]
  ) {
    eval_setsPagination(page: $page, limit: $limit, filters: $filters) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${EVAL_SET_FIELDS}
      }
    }
  }
`;

const EVAL_FIELDS = `
  id
  name
  description
  config {
    name
    description
  }
  llm
`;

export const GET_EVAL_FUNCTIONS = gql`
  query GetEvals {
    evals {
      items {
        ${EVAL_FIELDS}
      }
    }
  }
`;

export const GET_EVAL_SET_BY_ID = gql`
  query GetEvalSetById($id: ID!) {
    eval_setById(id: $id) {
      ${EVAL_SET_FIELDS}
    }
  }
`;

export const CREATE_EVAL_SET = gql`
  mutation CreateEvalSet($data: eval_setInput!) {
    eval_setsCreateOne(input: $data) {
      item {
        ${EVAL_SET_FIELDS}
      }
    }
  }
`;

export const UPDATE_EVAL_SET = gql`
  mutation UpdateEvalSet($id: ID!, $data: eval_setInput!) {
    eval_setsUpdateOneById(id: $id, input: $data) {
      item {
        ${EVAL_SET_FIELDS}
      }
    }
  }
`;

export const DELETE_EVAL_SET = gql`
  mutation DeleteEvalSet($id: ID!) {
    eval_setsRemoveOneById(id: $id) {
      id
      name
    }
  }
`;

// Eval Runs
export const GET_EVAL_RUNS = gql`
  query GetEvalRuns(
    $page: Int!
    $limit: Int!
    $filters: [FilterEval_run]
  ) {
    eval_runsPagination(page: $page, limit: $limit, filters: $filters) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${EVAL_RUN_FIELDS}
      }
    }
  }
`;

export const GET_EVAL_RUN_BY_ID = gql`
  query GetEvalRunById($id: ID!) {
    eval_runById(id: $id) {
      ${EVAL_RUN_FIELDS}
    }
  }
`;

export const CREATE_EVAL_RUN = gql`
  mutation CreateEvalRun($data: eval_runInput!) {
    eval_runsCreateOne(input: $data) {
      item {
        ${EVAL_RUN_FIELDS}
      }
    }
  }
`;

export const GET_QUEUE = gql`
  query GetQueue($queue: QueueEnum!) {
    queue(queue: $queue) {
      name
      concurrency
      ratelimit
      isMaxed
      isPaused
      jobs {
        paused
        completed
        failed
        waiting
        active
        delayed
      }
    }
  }
`;

export const GET_JOBS = gql`
  query GetJobs($queue: QueueEnum!, $statusses: [JobStateEnum!]) {
    jobs(queue: $queue, statusses: $statusses) {
      items {
        name
        id
        returnvalue
        stacktrace
        failedReason
        state
        data
        timestamp
      }
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
    }
  }
`;

export const DELETE_JOB = gql`
  mutation DeleteJob($queue: QueueEnum!, $id: String!) {
    deleteJob(queue: $queue, id: $id) {
      success
    }
  }
`;

export const PAUSE_QUEUE = gql`
  mutation PauseQueue($queue: QueueEnum!) {
    pauseQueue(queue: $queue) {
      success
    }
  }
`;

export const RESUME_QUEUE = gql`
  mutation ResumeQueue($queue: QueueEnum!) {
    resumeQueue(queue: $queue) {
      success
    }
  }
`;

export const DRAIN_QUEUE = gql`
  mutation DrainQueue($queue: QueueEnum!) {
    drainQueue(queue: $queue) {
      success
    }
  }
`;

export const RUN_EVAL = gql`
  mutation RunEval($id: ID!) {
    runEval(id: $id) {
      jobs
      count
    }
  }
`;

export const UPDATE_EVAL_RUN = gql`
  mutation UpdateEvalRun($id: ID!, $data: eval_runInput!) {
    eval_runsUpdateOneById(id: $id, input: $data) {
      item {
        ${EVAL_RUN_FIELDS}
      }
    }
  }
`;

export const DELETE_EVAL_RUN = gql`
  mutation DeleteEvalRun($id: ID!) {
    eval_runsRemoveOneById(id: $id) {
      id
    }
  }
`;

const PLATFORM_CONFIGURATION_FIELDS = `
  id
  config_key
  config_value
  description
  createdAt
  updatedAt
`;

export const GET_PLATFORM_CONFIGURATIONS = gql`
  query GetPlatformConfigurations {
    platform_configurationsPagination {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${PLATFORM_CONFIGURATION_FIELDS}
      }
    }
  }
`;

export const GET_PLATFORM_CONFIGURATION_BY_KEY = gql`
  query GetPlatformConfigurationByKey($config_key: FilterOperatorString!) {
    platform_configurationsPagination(page: 1, limit: 1, filters: { config_key: $config_key }) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        ${PLATFORM_CONFIGURATION_FIELDS}
      }
    }
  }
`;

export const CREATE_PLATFORM_CONFIGURATION = gql`
  mutation CreatePlatformConfiguration($data: platform_configurationInput!) {
    platform_configurationsCreateOne(input: $data) {
      item {
        ${PLATFORM_CONFIGURATION_FIELDS}
      }
    }
  }
`;

export const UPDATE_PLATFORM_CONFIGURATION = gql`
  mutation UpdatePlatformConfiguration($id: ID!, $data: platform_configurationInput!) {
    platform_configurationsUpdateOneById(id: $id, input: $data) {
      item {
        ${PLATFORM_CONFIGURATION_FIELDS}
      }
    }
  }
`;

export const DELETE_PLATFORM_CONFIGURATION = gql`
  mutation DeletePlatformConfiguration($id: ID!) {
    platform_configurationsRemoveOneById(id: $id) {
      id
    }
  }
`;