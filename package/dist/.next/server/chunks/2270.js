"use strict";exports.id=2270,exports.ids=[2270],exports.modules={42270:(e,t,i)=>{i.d(t,{$6:()=>ei,$W:()=>eq,A1:()=>P,Ak:()=>ep,Az:()=>M,B4:()=>eJ,B_:()=>ee,Dt:()=>E,E3:()=>T,Ep:()=>eV,Eq:()=>_,GJ:()=>m,Hk:()=>ed,JL:()=>B,JM:()=>W,Jq:()=>ex,L5:()=>z,MU:()=>C,Md:()=>s,Mh:()=>eS,Mp:()=>Z,N:()=>h,Nu:()=>eT,OP:()=>eW,P3:()=>g,Pe:()=>k,QW:()=>eF,Qf:()=>H,RV:()=>eA,S9:()=>L,Tj:()=>er,Ts:()=>ej,Ul:()=>G,W6:()=>es,W9:()=>q,Wc:()=>r,Wr:()=>eG,YH:()=>e$,Yr:()=>ef,ZX:()=>O,Zy:()=>X,_J:()=>et,as:()=>b,b2:()=>ey,bI:()=>S,ci:()=>K,d5:()=>ec,dc:()=>c,eY:()=>Q,fA:()=>eL,fB:()=>U,fG:()=>V,fM:()=>el,fV:()=>p,fc:()=>eE,fo:()=>j,hx:()=>eC,i9:()=>ew,iA:()=>eb,iC:()=>eN,j9:()=>eu,jL:()=>eg,jm:()=>eB,k9:()=>eU,kH:()=>N,kZ:()=>en,kk:()=>ea,kp:()=>eP,l1:()=>D,lU:()=>Y,lW:()=>eh,lk:()=>R,mN:()=>v,oo:()=>eO,ps:()=>f,qK:()=>F,r1:()=>A,rR:()=>x,s5:()=>ek,tK:()=>eo,tO:()=>y,ty:()=>I,ui:()=>J,uw:()=>l,vP:()=>eR,ve:()=>w,ym:()=>$});var a=i(74904);let s="_itemsPagination",r="_itemsCreateOne",n=`
    id
    name
    description
    embedder
    slug
    active
    fields
    configuration
`,o=e=>`
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
${e.join("\n")}
`,d=`
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
`,u=`
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
`,$=(0,a.Ps)`
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
        ${u}
      }
    }
  }
`,m=(0,a.Ps)`
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
`,l=(0,a.Ps)`
  query GetContexts {
    contexts {
      items {
        ${n}
      }
    }
  }
`,p=(0,a.Ps)`
  query GetContextById($id: ID!) {
    contextById(id: $id) {
      ${n}
    }
  }
`,g=(e,t)=>{let i=e.charAt(0).toUpperCase()+e.slice(1);return(0,a.Ps)`
    query ${e}Pagination($page: Int!, $limit: Int!, $filters: [Filter${i}_items], $sort: SortBy = { field: "updatedAt", direction: DESC }) {
      ${e}${s}(page: $page, limit: $limit, filters: $filters, sort: $sort) {
        pageInfo {
          pageCount
          itemCount
          currentPage
          hasPreviousPage
          hasNextPage
        }
        items {
          ${o(t)}
        }
      }
    }
  `},c=e=>(0,a.Ps)`
    mutation ProcessItemField${e}($item: ID!, $field: ${e}_itemsProcessorFieldEnum!) {
      ${e}_itemsProcessItemField(item: $item, field: $field) {
        message
        result
        job
      }
    }
  `,P=(e,t,i=!1)=>(0,a.Ps)`
    query ${e}ById($id: ID!) {
      ${e}_itemsById(id: $id) {
        ${o(t)}
        ${i?"chunks { fts_rank hybrid_score content source chunk_index chunk_id chunk_created_at chunk_updated_at embedding_size }":""}
      }
    }
  `,y=e=>(0,a.Ps)`
    mutation CreateOne${e}($input: ${e}_itemsInput!) {
      ${e}_itemsCreateOne(input: $input) {
        item {
          id
        }
        job
      }
    }
  `,f=e=>{let t=e.charAt(0).toUpperCase()+e.slice(1);return(0,a.Ps)`
    mutation DeleteChunks${e}($where: [Filter${t}_items]) {
      ${e}_itemsDeleteChunks(where: $where) {
        items
        jobs
      }
    }
  `},_=e=>{let t=e.charAt(0).toUpperCase()+e.slice(1);return(0,a.Ps)`
    mutation GenerateChunks${e}($where: [Filter${t}_items]) {
      ${e}_itemsGenerateChunks(where: $where) {
        items
        jobs
      }
    }
  `},I=e=>(0,a.Ps)`
    mutation UpdateOneById${e}($id: ID!, $input: ${e}_itemsInput!) {
      ${e}_itemsUpdateOneById(id: $id, input: $input) {
        item {
          id
        }
        job
      }
    }
  `,v=(e,t)=>(0,a.Ps)`
    mutation DeleteOneById${e}($id: ID!) {
      ${e}_itemsRemoveOneById(id: $id) {
        id
        ${t.join("\n")}
      }
    }
  `,A=(0,a.Ps)`
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
`,C=(0,a.Ps)`
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
`,S=(0,a.Ps)`
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
`,h=(0,a.Ps)`
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
`,B=(0,a.Ps)`
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
`,D=(0,a.Ps)`
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
`,j=(0,a.Ps)`
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
`;(0,a.Ps)`
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
`,(0,a.Ps)`
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
`;let b=(0,a.Ps)`
  query GetAgentById($id: ID!) {
    agentById(id: $id) {
      ${u}
    }
  }
`,q=(0,a.Ps)`
  query GetAgentsByIds($ids: [ID!]!) {
    agentByIds(ids: $ids) {
      ${u}
    }
  }
`,R=(0,a.Ps)`
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
`;(0,a.Ps)`
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
`;let k=(0,a.Ps)`
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
            ${d}
          }
        }
    }
`,w=(0,a.Ps)`
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
`,O=(0,a.Ps)`
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
`;(0,a.Ps)`
   query GetUserByEmail($email: String!) {
        userOne(filters: {email: $email}) {
            ${d}
        }
    }
`;let U=(0,a.Ps)`
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
`,x=(0,a.Ps)`
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
`,G=(0,a.Ps)`
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
`,E=(0,a.Ps)`
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
`,N=(0,a.Ps)`
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
`,F=(0,a.Ps)`
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
`,J=(0,a.Ps)`
  mutation ResetUserPassword($id: ID!, $password: String!) {
    usersUpdateOneById(id: $id, input: { password: $password }) {
      item {
        id
      }
    }
  }
`,T=(0,a.Ps)`
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
`,Q=(0,a.Ps)`
  mutation RemoveUserById($id: ID!) {
    usersRemoveOneById(id: $id) {
      id
    }
  }
`;(0,a.Ps)`
  mutation RemoveJobResultById($id: ID!) {
    job_resultsRemoveOneById(id: $id) {
      id
    }
  }
`;let W=(0,a.Ps)`
  mutation RemoveUserRoleById($id: ID!) {
    rolesRemoveOneById(id: $id) {
      id
    }
  }
`,V=(0,a.Ps)`
  mutation RemoveAgentById($id: ID!) {
    agentsRemoveOneById(id: $id) {
      id
    }
  }
`,L=(0,a.Ps)`
  mutation RemoveAgentSessionById($id: ID!) {
    agent_sessionsRemoveOneById(id: $id) {
      id
    }
  }
`;(0,a.Ps)`
  query GetJobStatistics($user: Float, $agent: String, $from: String, $to: String) {
    jobStatistics(user: $user, agent: $agent, from: $from, to: $to) {
      completedCount
      failedCount
      averageDuration
    }
  }
`;let M=(0,a.Ps)`
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
`,H=(0,a.Ps)`
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
`,K=(0,a.Ps)`
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
`,Y=(0,a.Ps)`
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
`,Z=(0,a.Ps)`
  mutation RemoveVariableById($id: ID!) {
    variablesRemoveOneById(id: $id) {
      id
    }
  }
`,z=(0,a.Ps)`
  query GetUserById($id: ID!) {
    userById(id: $id) {
      id
      name
      firstname
      lastname
      email
    }
  }
`,X=(0,a.Ps)`
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
`;(0,a.Ps)`
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
`;let ee=(0,a.Ps)`
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
`,et=(0,a.Ps)`
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
`,ei=(0,a.Ps)`
  mutation RemoveWorkflowTemplateById($id: ID!) {
    workflow_templatesRemoveOneById(id: $id) {
      id
    }
  }
`,ea=(0,a.Ps)`
  query GetJobStatisticsEnhanced($user: Float, $agent: String, $from: String, $to: String) {
    jobStatistics(user: $user, agent: $agent, from: $from, to: $to) {
      runningCount
      erroredCount
      completedCount
      failedCount
      averageDuration
    }
  }
`,es=(0,a.Ps)`
  query AgentSessionsStatistics($from: Date!, $to: Date!) {
    agent_sessionsStatistics(filters: {
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`,er=(0,a.Ps)`
  query WorkflowRunsStatistics($from: Date!, $to: Date!) {
    jobsStatistics(filters: {
      type: { eq: "workflow" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;(0,a.Ps)`
  query EmbeddingJobsStatistics($from: Date!, $to: Date!) {
    jobsStatistics(filters: {
      type: { eq: "embedder" }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`;let en=(0,a.Ps)`
  query FunctionCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      type: { eq: TOOL_CALL }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`,eo=(0,a.Ps)`  
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
`,ed=(0,a.Ps)`  
  query AgentCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      name: { in: ["inputTokens", "outputTokens"] }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`,eu=(0,a.Ps)`
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
`,e$=(0,a.Ps)`
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
`,em=`
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
`,el=(0,a.Ps)`
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
        ${em}
      }
    }
  }
`,ep=(0,a.Ps)`
  query GetProjectsByIds($ids: [ID!]!) {
    projectByIds(ids: $ids) {
      ${em}
    }
  }
`,eg=(0,a.Ps)`
  query GetProjectById($id: ID!) {
    projectById(id: $id) {
      ${em}
    }
  }
`,ec=(0,a.Ps)`
  mutation UpdateUserFavouriteProjects($id: ID!, $favourite_projects: JSON) {
    userUpdateById(input: { favourite_projects: $favourite_projects }, filter: { id: $id }) {
      item {
        id
        favourite_projects
      }
    }
  }
`,eP=(0,a.Ps)`
  mutation CreateProject($input: projectInput!) {
    projectsCreateOne(input: $input) {
      item {
        ${em}
      }
    }
  }
`,ey=(0,a.Ps)`
  mutation UpdateProject($id: ID!, $input: projectInput!) {
    projectsUpdateOneById(id: $id, input: $input) {
      item {
        ${em}
      }
    }
  }
`,ef=(0,a.Ps)`
  mutation DeleteProject($id: ID!) {
    projectsRemoveOneById(id: $id) {
      id
      name
    }
  }
`,e_=`
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
`,eI=`
  id
  name
  description
  createdAt
  updatedAt
`,ev=`
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
`,eA=(0,a.Ps)`
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
        ${e_}
      }
    }
  }
`;(0,a.Ps)`
  query GetTestCaseById($id: ID!) {
    test_caseById(id: $id) {
      ${e_}
    }
  }
`;let eC=(0,a.Ps)`
  mutation CreateTestCase($data: test_caseInput!) {
    test_casesCreateOne(input: $data) {
      item {
        ${e_}
      }
    }
  }
`,eS=(0,a.Ps)`
  mutation UpdateTestCase($id: ID!, $data: test_caseInput!) {
    test_casesUpdateOneById(id: $id, input: $data) {
      item {
        ${e_}
      }
    }
  }
`,eh=(0,a.Ps)`
  mutation DeleteTestCase($id: ID!) {
    test_casesRemoveOneById(id: $id) {
      id
      name
    }
  }
`,eB=(0,a.Ps)`
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
        ${eI}
      }
    }
  }
`,eD=`
  id
  name
  description
  config {
    name
    description
  }
  llm
`,ej=(0,a.Ps)`
  query GetEvals {
    evals {
      items {
        ${eD}
      }
    }
  }
`,eb=(0,a.Ps)`
  query GetEvalSetById($id: ID!) {
    eval_setById(id: $id) {
      ${eI}
    }
  }
`,eq=(0,a.Ps)`
  mutation CreateEvalSet($data: eval_setInput!) {
    eval_setsCreateOne(input: $data) {
      item {
        ${eI}
      }
    }
  }
`,eR=(0,a.Ps)`
  mutation UpdateEvalSet($id: ID!, $data: eval_setInput!) {
    eval_setsUpdateOneById(id: $id, input: $data) {
      item {
        ${eI}
      }
    }
  }
`,ek=(0,a.Ps)`
  mutation DeleteEvalSet($id: ID!) {
    eval_setsRemoveOneById(id: $id) {
      id
      name
    }
  }
`,ew=(0,a.Ps)`
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
        ${ev}
      }
    }
  }
`;(0,a.Ps)`
  query GetEvalRunById($id: ID!) {
    eval_runById(id: $id) {
      ${ev}
    }
  }
`;let eO=(0,a.Ps)`
  mutation CreateEvalRun($data: eval_runInput!) {
    eval_runsCreateOne(input: $data) {
      item {
        ${ev}
      }
    }
  }
`,eU=(0,a.Ps)`
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
`,ex=(0,a.Ps)`
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
`,eG=(0,a.Ps)`
  mutation DeleteJob($queue: QueueEnum!, $id: String!) {
    deleteJob(queue: $queue, id: $id) {
      success
    }
  }
`,eE=(0,a.Ps)`
  mutation PauseQueue($queue: QueueEnum!) {
    pauseQueue(queue: $queue) {
      success
    }
  }
`,eN=(0,a.Ps)`
  mutation ResumeQueue($queue: QueueEnum!) {
    resumeQueue(queue: $queue) {
      success
    }
  }
`,eF=(0,a.Ps)`
  mutation DrainQueue($queue: QueueEnum!) {
    drainQueue(queue: $queue) {
      success
    }
  }
`,eJ=(0,a.Ps)`
  mutation RunEval($id: ID!) {
    runEval(id: $id) {
      jobs
      count
    }
  }
`,eT=(0,a.Ps)`
  mutation UpdateEvalRun($id: ID!, $data: eval_runInput!) {
    eval_runsUpdateOneById(id: $id, input: $data) {
      item {
        ${ev}
      }
    }
  }
`;(0,a.Ps)`
  mutation DeleteEvalRun($id: ID!) {
    eval_runsRemoveOneById(id: $id) {
      id
    }
  }
`;let eQ=`
  id
  config_key
  config_value
  description
  createdAt
  updatedAt
`,eW=(0,a.Ps)`
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
        ${eQ}
      }
    }
  }
`;(0,a.Ps)`
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
        ${eQ}
      }
    }
  }
`;let eV=(0,a.Ps)`
  mutation CreatePlatformConfiguration($data: platform_configurationInput!) {
    platform_configurationsCreateOne(input: $data) {
      item {
        ${eQ}
      }
    }
  }
`,eL=(0,a.Ps)`
  mutation UpdatePlatformConfiguration($id: ID!, $data: platform_configurationInput!) {
    platform_configurationsUpdateOneById(id: $id, input: $data) {
      item {
        ${eQ}
      }
    }
  }
`;(0,a.Ps)`
  mutation DeletePlatformConfiguration($id: ID!) {
    platform_configurationsRemoveOneById(id: $id) {
      id
    }
  }
`}};