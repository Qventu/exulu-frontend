export type SearchMode = "bm25" | "vector" | "rag"

export interface Article {
  id: string
  title: string
  excerpt: string
  content: string
  category: string
  date: string
  readTime: number
  imageUrl: string
  relevanceScore?: number
  vector?: number[] // For vector search
  keywords?: string[] // For BM25 search
}

