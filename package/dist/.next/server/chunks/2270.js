"use strict";exports.id=2270,exports.ids=[2270],exports.modules={42270:(e,t,i)=>{i.d(t,{$6:()=>es,$W:()=>eU,A1:()=>y,Ak:()=>ef,Au:()=>el,Az:()=>K,B4:()=>eL,BK:()=>ee,B_:()=>ei,CN:()=>ep,Dt:()=>E,E3:()=>Q,Ep:()=>eH,Eq:()=>_,GJ:()=>m,Hk:()=>eu,JL:()=>h,JM:()=>V,Jq:()=>eJ,L5:()=>X,MU:()=>v,Md:()=>s,Mh:()=>ej,Mp:()=>z,N:()=>C,Nu:()=>eM,OP:()=>eZ,P3:()=>p,Pe:()=>R,QW:()=>eV,Qf:()=>Z,RV:()=>eD,S9:()=>M,Tj:()=>eo,Tp:()=>N,Ts:()=>ew,Ul:()=>x,W6:()=>en,W9:()=>b,Wc:()=>r,Wr:()=>eT,YH:()=>ec,Yr:()=>ev,ZA:()=>eg,ZX:()=>O,Zy:()=>et,_J:()=>ea,as:()=>j,b2:()=>eA,bI:()=>B,ci:()=>H,d5:()=>eI,dc:()=>c,eY:()=>W,fA:()=>eY,fB:()=>U,fG:()=>L,fM:()=>eP,fV:()=>g,fc:()=>eQ,fo:()=>q,hx:()=>eq,i9:()=>eN,iA:()=>eO,iC:()=>eW,j9:()=>em,jL:()=>e_,jm:()=>ek,k9:()=>eF,kH:()=>F,kZ:()=>ed,kk:()=>er,kp:()=>eS,l1:()=>D,lU:()=>Y,lW:()=>eb,lk:()=>k,mN:()=>S,oo:()=>eE,ps:()=>f,qK:()=>J,r1:()=>A,rR:()=>G,s5:()=>ex,tK:()=>e$,tO:()=>P,ty:()=>I,ui:()=>T,uw:()=>l,vP:()=>eG,ve:()=>w,ym:()=>u});var a=i(74904);let s="_itemsPagination",r="_itemsCreateOne",n=`
    id
    name
    description
    embedder
    slug
    active
    fields
    configuration
    sources {
      id
      name
      description
      config {
        schedule
        queue
        retries
        backoff {
          type
          delay
        }
      }
    }
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
`,$=`
id
name
providerapikey
instructions
description
active
image
animation_idle
animation_responding
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
`,u=(0,a.Ps)`
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
        ${$}
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
`,g=(0,a.Ps)`
  query GetContextById($id: ID!) {
    contextById(id: $id) {
      ${n}
    }
  }
`,p=(e,t)=>{let i=e.charAt(0).toUpperCase()+e.slice(1);return(0,a.Ps)`
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
  `,y=(e,t,i=!1)=>(0,a.Ps)`
    query ${e}ById($id: ID!) {
      ${e}_itemsById(id: $id) {
        ${o(t)}
        ${i?"chunks { fts_rank hybrid_score content source chunk_index chunk_id chunk_created_at chunk_updated_at embedding_size }":""}
      }
    }
  `,P=e=>(0,a.Ps)`
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
  `,S=(e,t)=>(0,a.Ps)`
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
`,v=(0,a.Ps)`
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
`,B=(0,a.Ps)`
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
`,C=(0,a.Ps)`
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
`,h=(0,a.Ps)`
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
`,q=(0,a.Ps)`
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
`;let j=(0,a.Ps)`
  query GetAgentById($id: ID!) {
    agentById(id: $id) {
      ${$}
    }
  }
`,b=(0,a.Ps)`
  query GetAgentsByIds($ids: [ID!]!) {
    agentByIds(ids: $ids) {
      ${$}
    }
  }
`,k=(0,a.Ps)`
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
`;let R=(0,a.Ps)`
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
`,G=(0,a.Ps)`
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
`,x=(0,a.Ps)`
  query GetTools($search: String, $category: String, $limit: Int, $page: Int) {
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
`,N=(0,a.Ps)`
  query GetToolCategories {
    toolCategories
  }
`,E=(0,a.Ps)`
  mutation UpdateAgent(
    $id: ID!
    $name: String
    $backend: String
    $description: String
    $instructions: String
    $rights_mode: String
    $animation_idle: String
    $animation_responding: String
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
        animation_idle: $animation_idle
        animation_responding: $animation_responding
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
          animation_idle
          animation_responding
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
`,F=(0,a.Ps)`
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
`,J=(0,a.Ps)`
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
`,T=(0,a.Ps)`
  mutation ResetUserPassword($id: ID!, $password: String!) {
    usersUpdateOneById(id: $id, input: { password: $password }) {
      item {
        id
      }
    }
  }
`,Q=(0,a.Ps)`
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
`,W=(0,a.Ps)`
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
`;let V=(0,a.Ps)`
  mutation RemoveUserRoleById($id: ID!) {
    rolesRemoveOneById(id: $id) {
      id
    }
  }
`,L=(0,a.Ps)`
  mutation RemoveAgentById($id: ID!) {
    agentsRemoveOneById(id: $id) {
      id
    }
  }
`,M=(0,a.Ps)`
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
`;let K=(0,a.Ps)`
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
`,Z=(0,a.Ps)`
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
`,H=(0,a.Ps)`
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
`,z=(0,a.Ps)`
  mutation RemoveVariableById($id: ID!) {
    variablesRemoveOneById(id: $id) {
      id
    }
  }
`,X=(0,a.Ps)`
  query GetUserById($id: ID!) {
    userById(id: $id) {
      id
      name
      firstname
      lastname
      email
    }
  }
`,ee=(0,a.Ps)`
  query GetUsersByIds($ids: [ID!]!) {
    userByIds(ids: $ids) {
      id
      name
      firstname
      lastname
      email
    }
  }
`,et=(0,a.Ps)`
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
`;let ei=(0,a.Ps)`
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
`,ea=(0,a.Ps)`
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
`,es=(0,a.Ps)`
  mutation RemoveWorkflowTemplateById($id: ID!) {
    workflow_templatesRemoveOneById(id: $id) {
      id
    }
  }
`,er=(0,a.Ps)`
  query GetJobStatisticsEnhanced($user: Float, $agent: String, $from: String, $to: String) {
    jobStatistics(user: $user, agent: $agent, from: $from, to: $to) {
      runningCount
      erroredCount
      completedCount
      failedCount
      averageDuration
    }
  }
`,en=(0,a.Ps)`
  query AgentSessionsStatistics($from: Date!, $to: Date!) {
    agent_sessionsStatistics(filters: {
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`,eo=(0,a.Ps)`
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
`;let ed=(0,a.Ps)`
  query FunctionCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      type: { eq: TOOL_CALL }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`,e$=(0,a.Ps)`  
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
`,eu=(0,a.Ps)`  
  query AgentCallsStatistics($from: Date!, $to: Date!) {
    trackingStatistics(filters: {
      name: { in: ["inputTokens", "outputTokens"] }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }) {
      group
      count
    }
  }
`,em=(0,a.Ps)`
  query TimeSeriesStatistics($type: typeEnum!, $from: Date!, $to: Date!, $names: [String!]) {
    trackingStatistics(
      groupBy: "createdAt"
      filters: {
        type: { eq: $type }
        createdAt: { and: [{ gte: $from }, { lte: $to }] }
        name: { in: $names }
      }
    ) {
      group
      count
    }
  }
`,el=(0,a.Ps)`
query UserStatistics($from: Date!, $to: Date!, $names: [String!]) {
  trackingStatistics(
    groupBy: "user"
    filters: {
      type: { eq: AGENT_RUN }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
      name: { in: $names }
    }
  ) {
    group
    count
  }
}
`,eg=(0,a.Ps)`
query ProjectStatistics($from: Date!, $to: Date!, $names: [String!]) {
  trackingStatistics(
    groupBy: "project"
    filters: {
      type: { eq: AGENT_RUN }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
      name: { in: $names }
    }
  ) {
    group
    count
  }
}
`,ep=(0,a.Ps)`
query AgentStatistics($from: Date!, $to: Date!, $names: [String!]) {
  trackingStatistics(
    groupBy: "label"
    filters: {
      type: { eq: AGENT_RUN }
      name: { in: $names }
      createdAt: { and: [{ gte: $from }, { lte: $to }] }
    }
  ) {
    group
    count
  }
}
`;(0,a.Ps)`
  query GetUserNameById($id: ID!) {
    userById(id: $id) {
      name
    }
  }
`,(0,a.Ps)`
  query GetProjectNameById($id: ID!) {
    projectById(id: $id) {
      name
    }
  }
`;let ec=(0,a.Ps)`
  query DonutStatistics($type: typeEnum!, $groupBy: String!, $from: Date!, $to: Date!, $names: [String!]) {
    trackingStatistics(
      groupBy: $groupBy
      filters: {
        type: { eq: $type }
        name: { in: $names }
        createdAt: { and: [{ gte: $from }, { lte: $to }] }
      }
    ) {
      group
      count
    }
  }
`,ey=`
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
`,eP=(0,a.Ps)`
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
        ${ey}
      }
    }
  }
`,ef=(0,a.Ps)`
  query GetProjectsByIds($ids: [ID!]!) {
    projectByIds(ids: $ids) {
      ${ey}
    }
  }
`,e_=(0,a.Ps)`
  query GetProjectById($id: ID!) {
    projectById(id: $id) {
      ${ey}
    }
  }
`,eI=(0,a.Ps)`
  mutation UpdateUserFavouriteProjects($id: ID!, $favourite_projects: JSON) {
    userUpdateById(input: { favourite_projects: $favourite_projects }, filter: { id: $id }) {
      item {
        id
        favourite_projects
      }
    }
  }
`,eS=(0,a.Ps)`
  mutation CreateProject($input: projectInput!) {
    projectsCreateOne(input: $input) {
      item {
        ${ey}
      }
    }
  }
`,eA=(0,a.Ps)`
  mutation UpdateProject($id: ID!, $input: projectInput!) {
    projectsUpdateOneById(id: $id, input: $input) {
      item {
        ${ey}
      }
    }
  }
`,ev=(0,a.Ps)`
  mutation DeleteProject($id: ID!) {
    projectsRemoveOneById(id: $id) {
      id
      name
    }
  }
`,eB=`
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
`,eC=`
  id
  name
  description
  createdAt
  updatedAt
`,eh=`
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
`,eD=(0,a.Ps)`
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
        ${eB}
      }
    }
  }
`;(0,a.Ps)`
  query GetTestCaseById($id: ID!) {
    test_caseById(id: $id) {
      ${eB}
    }
  }
`;let eq=(0,a.Ps)`
  mutation CreateTestCase($data: test_caseInput!) {
    test_casesCreateOne(input: $data) {
      item {
        ${eB}
      }
    }
  }
`,ej=(0,a.Ps)`
  mutation UpdateTestCase($id: ID!, $data: test_caseInput!) {
    test_casesUpdateOneById(id: $id, input: $data) {
      item {
        ${eB}
      }
    }
  }
`,eb=(0,a.Ps)`
  mutation DeleteTestCase($id: ID!) {
    test_casesRemoveOneById(id: $id) {
      id
      name
    }
  }
`,ek=(0,a.Ps)`
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
        ${eC}
      }
    }
  }
`,eR=`
  id
  name
  description
  config {
    name
    description
  }
  llm
`,ew=(0,a.Ps)`
  query GetEvals {
    evals {
      items {
        ${eR}
      }
    }
  }
`,eO=(0,a.Ps)`
  query GetEvalSetById($id: ID!) {
    eval_setById(id: $id) {
      ${eC}
    }
  }
`,eU=(0,a.Ps)`
  mutation CreateEvalSet($data: eval_setInput!) {
    eval_setsCreateOne(input: $data) {
      item {
        ${eC}
      }
    }
  }
`,eG=(0,a.Ps)`
  mutation UpdateEvalSet($id: ID!, $data: eval_setInput!) {
    eval_setsUpdateOneById(id: $id, input: $data) {
      item {
        ${eC}
      }
    }
  }
`,ex=(0,a.Ps)`
  mutation DeleteEvalSet($id: ID!) {
    eval_setsRemoveOneById(id: $id) {
      id
      name
    }
  }
`,eN=(0,a.Ps)`
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
        ${eh}
      }
    }
  }
`;(0,a.Ps)`
  query GetEvalRunById($id: ID!) {
    eval_runById(id: $id) {
      ${eh}
    }
  }
`;let eE=(0,a.Ps)`
  mutation CreateEvalRun($data: eval_runInput!) {
    eval_runsCreateOne(input: $data) {
      item {
        ${eh}
      }
    }
  }
`,eF=(0,a.Ps)`
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
`,eJ=(0,a.Ps)`
  query GetJobs($queue: QueueEnum!, $statusses: [JobStateEnum!], $page: Int, $limit: Int) {
    jobs(queue: $queue, statusses: $statusses, page: $page, limit: $limit) {
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
`,eT=(0,a.Ps)`
  mutation DeleteJob($queue: QueueEnum!, $id: String!) {
    deleteJob(queue: $queue, id: $id) {
      success
    }
  }
`,eQ=(0,a.Ps)`
  mutation PauseQueue($queue: QueueEnum!) {
    pauseQueue(queue: $queue) {
      success
    }
  }
`,eW=(0,a.Ps)`
  mutation ResumeQueue($queue: QueueEnum!) {
    resumeQueue(queue: $queue) {
      success
    }
  }
`,eV=(0,a.Ps)`
  mutation DrainQueue($queue: QueueEnum!) {
    drainQueue(queue: $queue) {
      success
    }
  }
`,eL=(0,a.Ps)`
  mutation RunEval($id: ID!) {
    runEval(id: $id) {
      jobs
      count
    }
  }
`,eM=(0,a.Ps)`
  mutation UpdateEvalRun($id: ID!, $data: eval_runInput!) {
    eval_runsUpdateOneById(id: $id, input: $data) {
      item {
        ${eh}
      }
    }
  }
`;(0,a.Ps)`
  mutation DeleteEvalRun($id: ID!) {
    eval_runsRemoveOneById(id: $id) {
      id
    }
  }
`;let eK=`
  id
  config_key
  config_value
  description
  createdAt
  updatedAt
`,eZ=(0,a.Ps)`
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
        ${eK}
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
        ${eK}
      }
    }
  }
`;let eH=(0,a.Ps)`
  mutation CreatePlatformConfiguration($data: platform_configurationInput!) {
    platform_configurationsCreateOne(input: $data) {
      item {
        ${eK}
      }
    }
  }
`,eY=(0,a.Ps)`
  mutation UpdatePlatformConfiguration($id: ID!, $data: platform_configurationInput!) {
    platform_configurationsUpdateOneById(id: $id, input: $data) {
      item {
        ${eK}
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