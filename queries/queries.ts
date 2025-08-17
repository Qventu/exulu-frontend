import { gql } from "@apollo/client";

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
        id
        name
        description
        type
        providerApiKey
        extensions
        backend
        active
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
          id
      }
    }
  }
`;

export const GET_AGENT_MESSAGES = gql`
  query GetAgentSessionMessages(
    $page: Int!
    $limit: Int!
    $filters: [FilterAgent_message]
    $sort: SortBy = { field: "createdAt", direction: DESC }
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

/**
* Statusses takes a comma seperated string
* of statusses to be included.
**/
export const GET_JOBS = gql`
  query GetJobs(
    $page: Int!
    $limit: Int!
    $filters: [FilterJob]
    $sort: SortBy = {
      field: "createdAt",
      direction: DESC
    }
  ) {
    jobsPagination(
      page: $page
      limit: $limit
      sort: $sort
      filters: $filters
    ) {
      items {
        id  
        status
        name
        createdAt
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
  ) {
    usersPagination(page: $page, limit: $limit, filters: $filters) {
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
export const GET_JOB_BY_ID = gql`
  query GetJobById($id: ID!) {
  jobById(id: $id) {
        id
        status
        name
        inputs
        result
        createdAt
    }
  }
`;
export const GET_AGENT_BY_ID = gql`
  query GetAgentById($id: ID!) {
    agentById(id: $id) {
      id
      name
      providerApiKey
      description
      type
      backend
      active
      tools
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
      $id: ID!
     ) {
        usersUpdateOneById(id: $id, input: {
            email: $email,
            firstname: $firstname,
            anthropic_token: $anthropic_token,
            super_admin: $super_admin,
            lastname: $lastname,
            role: $role,
        }) {
          ${USER_FIELDS}
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
            id
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
        id
        createdAt
        agents
        api
        workflows
        variables
        users
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
  ) {
    agent_sessionsCreateOne(
      input: { agent: $agent, user: $user, title: $title }
    ) {
      id
    }
  }
`;
export const CREATE_AGENT = gql`
  mutation createAgent(
    $name: String!
    $description: String!
    $type: String!
    $rights_mode: String!
    $backend: String!
    $RBAC: RBACInput
  ) {
    agentsCreateOne(
      input: {
        name: $name
        description: $description
        type: $type
        rights_mode: $rights_mode
        backend: $backend
        RBAC: $RBAC
      }
    ) {
        id
        name
        description
        type
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
`;
export const UPDATE_AGENT = gql`
  mutation UpdateAgent(
    $id: ID!
    $name: String
    $backend: String
    $description: String
    $rights_mode: String
    $tools: JSON
    $active: Boolean
    $providerApiKey: String
    $RBAC: RBACInput
  ) {
    agentsUpdateOne(
      input: { 
        name: $name
        backend: $backend
        description: $description
        rights_mode: $rights_mode
        active: $active
        tools: $tools
        providerApiKey: $providerApiKey
        RBAC: $RBAC
      }
      where: { id: $id }
    ) {
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
    }
  }
`;
export const CREATE_USER_ROLE = gql`
  mutation CreateUserRole($name: String!, $agents: String, $workflows: String, $variables: String, $users: String, $api: String) {
    rolesCreateOne(input: { name: $name, agents: $agents, workflows: $workflows, variables: $variables, users: $users, api: $api }) {
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
`;

export const CREATE_USER = gql`
  mutation CreateUser($email: String!, $password: String) {
    usersCreateOne(input: { email: $email, password: $password }) {
        id
        createdAt
        name
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
export const REMOVE_JOB_BY_ID = gql`
  mutation RemoveJobById($id: ID!) {
    jobsRemoveOneById(id: $id) {
      id
    }
  }
`;
export const REMOVE_USER_ROLE_BY_ID = gql`
  mutation RemoveUserRoleById($id: ID!) {
    userRoleRemoveById(id: $id) {
      error {
        message
        __typename
      }
      recordId
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
      id
      name
      value
      encrypted
      createdAt
      updatedAt
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
