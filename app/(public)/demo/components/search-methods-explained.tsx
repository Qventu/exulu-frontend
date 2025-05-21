import type { SearchMode } from "../types"
import { Info } from "lucide-react"

interface SearchMethodExplainerProps {
  searchMode: SearchMode
}

export default function SearchMethodExplainer({ searchMode }: SearchMethodExplainerProps) {
  return (
    <div className="bg-white rounded-lg p-4 mb-6 border border-slate-200 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 bg-blue-50 p-1.5 rounded-full text-blue-600">
          <Info size={18} />
        </div>
        <div>
          <h3 className="font-medium text-slate-800 mb-1">
            {searchMode === "bm25" && "Keyword Search (BM25)"}
            {searchMode === "vector" && "Semantic Search (Vector)"}
            {searchMode === "rag" && "AI-Powered Search (RAG)"}
          </h3>
          <p className="text-sm text-slate-600">
            {searchMode === "bm25" &&
              "Finds content that contains the exact words you search for. Works best when you know the specific terms used in the content you're looking for."}
            {searchMode === "vector" &&
              "Understands the meaning behind your search, not just the words. Can find relevant content even when it uses different terminology than your search query."}
            {searchMode === "rag" &&
              "Generates a direct answer to your question using AI, with citations to relevant sources. Perfect for getting quick, comprehensive answers without having to read through multiple results."}
          </p>
        </div>
      </div>
    </div>
  )
}

