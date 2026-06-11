// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

import { UIMessage } from "ai"

export interface TestCase {
  id: string
  name: string
  description?: string
  inputs: UIMessage[]
  expected_output: string
  expected_tools?: string[]
  expected_knowledge_sources?: string[]
  expected_agent_tools?: string[]
  createdAt: string
  updatedAt: string
}

export interface TestCasePagination {
  pageInfo: {
    pageCount: number
    itemCount: number
    currentPage: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  items: TestCase[]
}
