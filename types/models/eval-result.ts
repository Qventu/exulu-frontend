import { UIMessage } from "ai"

export interface EvalResult {
  id: string
  evalRunId: string
  testCaseId: string
  evalFunctionId: string
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
