import type {Article, SearchMode} from "../types"
import {Card, CardContent} from "@/components/ui/card"
import Image from "next/image"
import RAGResults from "./rag-results"

interface SearchResultsProps {
    results: Article[] | {
        result: string,
        sources: Article[]
    }
    isLoading: boolean
    hasSearched: boolean
    searchMode: SearchMode
    searchQuery: string
}

export default function SearchResults({
                                          results,
                                          isLoading,
                                          hasSearched,
                                          searchMode,
                                          searchQuery,
                                      }: SearchResultsProps) {
    // If RAG mode is selected, use the RAG-specific results component
    if (searchMode === "rag" && !Array.isArray(results) && results.sources) {
        return <RAGResults result={results} searchQuery={searchQuery} isLoading={isLoading}/>
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mb-4"></div>
                <p className="text-slate-600">Searching...</p>
            </div>
        )
    }

    if (!hasSearched) {
        return (
            <div></div>
            /*<div className="flex flex-col items-center justify-center py-6">
                <div className="rounded-lg p-8 mb-6 max-w-md">
                    <Image
                        src="/assets/placeholder.png?height=200&width=200"
                        alt="Search illustration"
                        width={400}
                        height={400}
                        className="mx-auto mb-6"
                    />
                </div>
            </div>*/
        )
    }

    if (Array.isArray(results) && results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-slate-600 text-lg mb-2">No results found</p>
                <p className="text-slate-500">Try a different search term, search method, or adjust the similarity
                    threshold</p>
            </div>
        )
    }

    return (
        <div>
            <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Search Results</h3>
                <p className="text-slate-600">
                    Showing {Array.isArray(results) && results.length} results for "{searchQuery}" using{" "}
                    <span className="font-medium">
            {searchMode === "bm25" && "BM25 keyword search"}
                        {searchMode === "vector" && "Vector semantic search"}
          </span>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(results) && results.map((article) => (
                    <Card key={article.id} className="overflow-hidden hover:shadow-md transition-shadow rounded">
                        <div className="aspect-video relative bg-slate-100">
                            <Image src={article.imageUrl || "/placeholder.svg"} alt={article.title} fill
                                   className="object-cover"/>
                        </div>
                        <CardContent className="p-4 bg-white">
                            <div className="flex items-center mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {article.category}
                </span>
                                {article.relevanceScore !== undefined && (
                                    <span
                                        className={`ml-auto text-xs ${
                                            searchMode === "vector"
                                                ? "bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium"
                                                : "text-slate-500"
                                        }`}
                                    >
                    {searchMode === "vector"
                        ? `Similarity: ${article.relevanceScore.toFixed(2)}`
                        : `Score: ${article.relevanceScore.toFixed(2)}`}
                  </span>
                                )}
                            </div>
                            <h3 className="font-bold text-lg mb-2 line-clamp-2">{article.title}</h3>
                            <p className="text-slate-600 text-sm line-clamp-3 mb-3">{article.excerpt}</p>
                            <div className="flex items-center text-xs text-slate-500">
                                <span>{article.date}</span>
                                <span className="mx-2">•</span>
                                <span>{article.readTime} min read</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

