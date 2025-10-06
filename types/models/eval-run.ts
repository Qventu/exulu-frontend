export type ScoringMethod = "mean" | "sum" | "average"

export interface EvalRun {
  id: string
  eval_set_id: string
  agent_id: string
  eval_function_ids: string[] // Array of ExuluEval IDs
  config?: Record<string, any> // Optional config for eval functions
  scoring_method: ScoringMethod
  pass_threshold: number // 0-100 percentage
  test_case_ids: string[] // Subset of test cases from the eval set
  rights_mode: "private" | "users" | "roles" | "projects" | "public"
  RBAC?: {
    type?: string
    users?: Array<{ id: number; rights: "read" | "write" }>
    roles?: Array<{ id: string; rights: "read" | "write" }>
    projects?: Array<{ id: string; rights: "read" | "write" }>
  }
  createdAt: string
  updatedAt: string
}

export interface EvalRunPagination {
  pageInfo: {
    pageCount: number
    itemCount: number
    currentPage: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  items: EvalRun[]
}
