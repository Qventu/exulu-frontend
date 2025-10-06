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
