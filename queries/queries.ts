import { gql } from "@apollo/client";

const USER_FIELDS = `
id
firstName
lastName
email
super_admin
apiKey
type
roles {
 id
 role
}
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
        extensions
        backend
        active
        public
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
    $filters: FilterFindManyAgentSessionsInput
    $sort: SortFindManyAgentSessionsInput = UPDATEDAT_DESC
  ) {
    agentSessionPagination(
      page: $page
      perPage: $limit
      sort: $sort
      filter: $filters
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
          resourceId
          title
          agentId
          metadata
          id
          id
      }
    }
  }
`;

export const GET_AGENT_MESSAGES = gql`
  query GetAgentSessionMessages(
    $page: Int!
    $limit: Int!
    $filters: FilterFindManyAgentMessagesInput
    $sort: SortFindManyAgentMessagesInput = CREATEDAT_DESC
  ) {
    agentMessagePagination(
      page: $page
      perPage: $limit
      sort: $sort
      filter: $filters
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
        thread_id
        content
        role
        type
        createdAt
        id
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
    $filters: FilterFindManyJobsInput
    $sort: SortFindManyJobsInput = CREATEDAT_DESC
  ) {
    jobPagination(
      page: $page
      perPage: $limit
      sort: $sort
      filter: $filters
    ) {
      items {
        id
        status
        name
        result
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
    userRolePagination(page: $page, perPage: $limit) {
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
        agents {
          id
          name
        }
        is_admin
        role
      }
    }
  }
`;
export const GET_USERS = gql`
  query GetUsers(
    $page: Int!
    $limit: Int!
    $filters: FilterFindManyUsersInput
  ) {
    userPagination(page: $page, perPage: $limit, filter: $filters) {
      pageInfo {
        pageCount
        itemCount
        currentPage
        hasPreviousPage
        hasNextPage
      }
      items {
        id
        firstName
        lastName
        email
        lastUsed
        createdAt
        type
        apiKey
        emailVerified
        roles {
          id
          role
          agents {
            id
            name
          }
        }
      }
    }
  }
`;
export const GET_USER_ROLE_BY_ID = gql`
  query GetUserRoleById($id: MongoID!) {
    userRoleByid(id: $id) {
      id
      role
      is_admin
      agents {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;
export const GET_JOB_BY_ID = gql`
  query GetJobById($id: MongoID!) {
  jobById(id: $id) {
        id
        status
        name
        result
        createdAt
    }
  }
`;
export const GET_AGENT_BY_ID = gql`
  query GetAgentById($id: MongoID!) {
    agentById(id: $id) {
      id
      name
      description
      type
      backend
      public
      active
      tools
    }
  }
`;
export const GET_AGENT_SESSION_BY_ID = gql`
  query GetAgentSessionById($id: MongoID!) {
    agentSessionById(id: $id) {
        createdAt
        updatedAt
        resourceId
        title
        agentId
        metadata
        id
        id
    }
  }
`;
export const GET_AGENT_SESSION = gql`
  query GetAgentSession($filter: FilterFindOneAgentSessionsInput) {
    agentSessionOne(filter: $filter) {
        createdAt
        updatedAt
        resourceId
        title
        agentId
        metadata
        id
        id
    }
  }
`;

export const UPDATE_USER_BY_ID = gql`
    mutation UpdateUser(
      $email: String,
      $firstName: String,
      $lastName: String,
      $roles: [MongoID],
      $id: MongoID!
     ) {
        userUpdateById(id: $id, record: {
            email: $email,
            firstName: $firstName,
            lastName: $lastName,
            roles: $roles
        }) {
            record {
                ${USER_FIELDS}
            }
            error {
                message
                __typename
            }
        }
    }
`;
export const CREATE_API_USER = gql`
    mutation CreateUser(
      $firstName: String,
      $type: String,
      $apiKey: String,
      $email: String,
     ) {
        userCreateOne(record: {
            firstName: $firstName,
            type: $type,
            apiKey: $apiKey,
            email: $email
        }) {
            record {
                ${USER_FIELDS}
            }
            error {
                message
                __typename
            }
        }
    }
`;
export const UPDATE_USER_ROLE_BY_ID = gql`
  mutation UpdateUserRole(
    $id: MongoID!
    $role: String
    $is_admin: Boolean
    $agents: [MongoID]
  ) {
    userRoleUpdateById(
      id: $id
      record: {
        role: $role
        is_admin: $is_admin
        agents: $agents
      }
    ) {
      record {
        id
        createdAt
        agents {
          id
          name
        }
      }
      error {
        message
        __typename
      }
    }
  }
`;
export const GET_USER_BY_EMAIL = gql`
   query GetUserByEmail($email: String!) {
        userOne(filter: {email: $email}) {
            ${USER_FIELDS}
        }
    }
`;

export const CREATE_AGENT_SESSION = gql`
  mutation createAgentSession(
    $title: String,
    $user: String
    $agent: String
    $type: EnumAgentSessionsType
    $createdAt: String
    $updatedAt: String
  ) {
    agentSessionCreateOne(
      record: { agentId: $agent, resourceId: $user, type: $type, createdAt: $createdAt, updatedAt: $updatedAt, title: $title }
    ) {
      record {
        id
      }
    }
  }
`;
export const CREATE_AGENT = gql`
  mutation createAgent(
    $name: String!
    $description: String!
    $type: String!
    $backend: String!
  ) {
    agentsCreateOne(
      input: {
        name: $name
        description: $description
        type: $type
        backend: $backend
      }
    ) {
        id
        name
        description
        type
        createdAt
    }
  }
`;
export const UPDATE_AGENT = gql`
  mutation UpdateAgent(
    $id: MongoID!
    $name: String
    $backend: String
    $description: String
    $tools: [String]
    $active: Boolean
    $public: Boolean
  ) {
    agentsUpdateOne(
      record: { name: $name, backend: $backend, description: $description, active: $active, public: $public, tools: $tools }
      filter: { id: $id }
    ) {
      record {
        id
        name
      }
    }
  }
`;
export const CREATE_USER_ROLE = gql`
  mutation CreateUserRole($role: String!) {
    userRoleCreateOne(record: { role: $role }) {
      record {
        id
        createdAt
        role
      }
    }
  }
`;
export const REMOVE_USER_BY_ID = gql`
  mutation RemoveUserById($id: MongoID!) {
    userRemoveById(id: $id) {
      error {
        message
        __typename
      }
      recordId
    }
  }
`;
export const REMOVE_USER_ROLE_BY_ID = gql`
  mutation RemoveUserRoleById($id: MongoID!) {
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
  mutation RemoveAgentById($id: MongoID!) {
    agentRemoveById(id: $id) {
      error {
        message
        __typename
      }
      recordId
    }
  }
`;
export const REMOVE_AGENT_SESSION_BY_ID = gql`
  mutation RemoveAgentSessionById($id: MongoID!) {
    agentSessionRemoveById(id: $id) {
      error {
        message
        __typename
      }
      recordId
    }
  }
`;

export const GET_JOB_STATISTICS = gql`
  query GetJobStatistics($user: MongoID, $agent: String, $from: Date, $to: Date) {
    jobStatistics(user: $user, agent: $agent, from: $from, to: $to) {
      completedCount
      failedCount
      averageDuration
    }
  }
`;
