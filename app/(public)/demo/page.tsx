"use client"

import { useState } from "react"
import SearchInterface from "./components/search-interface"
import SearchResults from "./components/search-results"
import type { SearchMode, Article } from "./types"
import { mockArticles } from "./data/mock-articles"
import { performSearch } from "./lib/search"

export default function Home() {
  const [searchMode, setSearchMode] = useState<SearchMode>("bm25")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Article[] | {
    result: string,
    sources: Article[]
}>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [maxCosineDistance, setMaxCosineDistance] = useState(0.8)

  const handleSearch = async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    setSearchQuery(query)

    // In a real application, this would call an API
    const results = await performSearch(query, searchMode, (1 - maxCosineDistance))

    setSearchResults(results)
    setIsSearching(false)
    setHasSearched(true)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center">
              <div className="bg-primary rounded-lg p-2 mr-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Search Demo</h1>
            </div>
            <button className="text-primary hover:underline">How it works?</button>
          </div>

          <h2 className="text-4xl font-bold text-center mb-2">
            <span className="text-slate-800">Modern </span>
            <span className="text-red-500">Search Experience</span>
          </h2>
          <p className="text-center text-slate-600 mb-8">
            Compare different search methods: BM25, Vector Search, and AI-powered RAG.
          </p>

          <SearchInterface
            searchMode={searchMode}
            setSearchMode={setSearchMode}
            onSearch={handleSearch}
            maxCosineDistance={maxCosineDistance}
            setMaxCosineDistance={setMaxCosineDistance}
          />
        </header>

        <SearchResults
          results={searchResults}
          isLoading={isSearching}
          hasSearched={hasSearched}
          searchMode={searchMode}
          searchQuery={searchQuery}
        />
      </div>
    </main>
  )
}

