export interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  owner: number
  visibility: 'PRIVATE' | 'USERS' | 'ROLES' | 'PUBLIC'
  shared_user_ids?: Array<{ id: string; rights: 'read' | 'write' }>
  shared_role_ids?: Array<{ id: string; rights: 'read' | 'write' }>
  variables?: Array<{
    name: string
    description?: string
    type: 'string'
    required: boolean
    defaultValue?: string
  }>
  steps_json: Array<{
    id: string
    type: 'user' | 'assistant' | 'tool'
    content?: string
    contentExample?: string
    toolName?: string
  }>
  example_metadata_json?: {
    observedToolCalls?: Array<{
      stepRef: string
      toolName: string
      exampleArgs: Record<string, any>
      exampleResultSummary?: string
    }>
  }
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplatePagination {
  pageInfo: {
    pageCount: number
    itemCount: number
    currentPage: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  items: WorkflowTemplate[]
}