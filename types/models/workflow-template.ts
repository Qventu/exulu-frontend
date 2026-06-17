// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface WorkflowTemplate {
  id: string
  name: string
  description?: string
  rights_mode: 'private' | 'users' | 'roles' | 'teams' | 'public'
  RBAC: {
    users?: Array<{ id: number; rights: 'read' | 'write' }>
    roles?: Array<{ id: string; rights: 'read' | 'write' }>
    teams?: Array<{ id: string; rights: 'read' | 'write' }>
  }
  variables?: Array<string>
  steps_json: Array<{
    id: string
    type: 'user' | 'assistant' | 'tool'
    content?: string
    contentExample?: string
    toolName?: string
  }>
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