export type ScoringMethod = "median" | "sum" | "average"

export interface EvalRunEvalFunction {
  id: string
  name: string,
  config: Record<string, any>
}

export interface EvalRun {
  id: string
  name: string
  eval_set_id: string
  agent_id: string
  timeout_in_seconds: number
  eval_functions: EvalRunEvalFunction[]
  config?: Record<string, any> // Optional config for eval functions
  scoring_method: ScoringMethod
  pass_threshold: number // 0-100 percentage
  test_case_ids: string[] // Subset of test cases from the eval set
  rights_mode: "private" | "users" | "roles" |/*  "projects" | */ "public"
  RBAC?: {
    type?: string
    users?: Array<{ id: number; rights: "read" | "write" }>
    roles?: Array<{ id: string; rights: "read" | "write" }>
    // projects?: Array<{ id: string; rights: "read" | "write" }>
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
