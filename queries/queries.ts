import { gql } from "@apollo/client";

const USER_FIELDS = `
id
firstname
lastname
email
super_admin
apikey
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
        agents
        is_admin
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
        firstname
        lastname
        email
        last_used
        createdAt
        type
        apikey
        emailVerified
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
      is_admin
      agents
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
      $firstname: String,
      $lastname: String,
      $roles: [MongoID],
      $id: MongoID!
     ) {
        userUpdateById(id: $id, record: {
            email: $email,
            firstname: $firstname,
            lastname: $lastname,
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
      $firstname: String,
      $type: String,
      $apikey: String,
      $email: String,
     ) {
      usersCreateOne(input: {
            firstname: $firstname,
            type: $type,
            apikey: $apikey,
            email: $email
        }) {
            id
        }
    }
`;
export const UPDATE_USER_ROLE_BY_ID = gql`
  mutation UpdateUserRole(
    $id: ID!
    $name: String
    $is_admin: Boolean
    $agents: JSON
  ) {
    rolesUpdateOneById(
      id: $id
      input: {
        name: $name
        is_admin: $is_admin
        agents: $agents
      }
    ) {
        id
        createdAt
        agents
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
    $id: ID!
    $name: String
    $backend: String
    $description: String
    $tools: JSON
    $active: Boolean
    $public: Boolean
  ) {
    agentsUpdateOne(
      input: { name: $name, backend: $backend, description: $description, active: $active, public: $public, tools: $tools }
      where: { id: $id }
    ) {
        id
        name
    }
  }
`;
export const CREATE_USER_ROLE = gql`
  mutation CreateUserRole($name: String!) {
    rolesCreateOne(input: { name: $name }) {
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
    agentSessionRemoveById(id: $id) {
      id
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
