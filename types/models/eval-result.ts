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
