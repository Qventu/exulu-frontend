// OWNERSHIP (Phase 0, codebase-structure D6): hand-maintained GraphQL model types.
// This directory is the explicit type source until GraphQL codegen lands
// (lib/graphql/__generated__/, see codegen.ts); then features migrate to generated
// types per-feature and this file is deleted. Keep in sync with the backend schema.

import { UIMessage } from "ai"

export interface EvalResult {
  id: string
  eval_run_id: string
  test_case_id: string
  eval_function_id: string
  score: number // 0-100
  passed: boolean
  messages: UIMessage[] // Conversation from running the agent
  metadata?: {
    tokens?: {
      totalTokens?: number
      reasoningTokens?: number
      inputTokens?: number
      outputTokens?: number
      cachedInputTokens?: number
    }
    duration?: number // milliseconds
  }
  error?: string
  createdAt: string
  updatedAt: string
}

export interface EvalResultPagination {
  pageInfo: {
    pageCount: number
    itemCount: number
    currentPage: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  items: EvalResult[]
}
