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
