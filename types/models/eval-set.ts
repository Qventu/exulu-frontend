// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

export interface EvalSet {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface EvalSetPagination {
  pageInfo: {
    pageCount: number
    itemCount: number
    currentPage: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  items: EvalSet[]
}
