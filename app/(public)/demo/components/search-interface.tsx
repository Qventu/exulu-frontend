"use client"

import type React from "react"

import { useState } from "react"
import type { SearchMode } from "../types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import SearchMethodExplainer from "./search-methods-explained"

interface SearchInterfaceProps {
  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void
  onSearch: (query: string) => void
  maxCosineDistance: number
  setMaxCosineDistance: (value: number) => void
}

export default function SearchInterface({
  searchMode,
  setSearchMode,
  onSearch,
  maxCosineDistance,
  setMaxCosineDistance,
}: SearchInterfaceProps) {
  const [query, setQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(query)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-full p-1 inline-flex mb-6 shadow-sm">
        <button
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            searchMode === "bm25" ? "bg-red-500 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setSearchMode("bm25")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8" />
            <path d="M3 16.2V21m0 0h4.8M3 21l6-6" />
            <path d="M3 7.8V3m0 0h4.8M3 3l6 6" />
            <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6" />
          </svg>
          Keyword
        </button>
        <button
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            searchMode === "vector" ? "bg-red-500 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setSearchMode("vector")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          Vector
        </button>
        <button
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            searchMode === "rag" ? "bg-red-500 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setSearchMode("rag")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          AI
        </button>
      </div>

      <SearchMethodExplainer searchMode={searchMode} />

      {(searchMode === "vector" || searchMode === "rag") && (
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="cosine-threshold" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-500"
              >
                <path d="M12 2v20M4.93 10H2a10 10 0 0 0 20 0h-2.93a8 8 0 0 1-14.14 0Z" />
              </svg>
              Relevance Filter
            </label>
            <span className="text-sm text-slate-500">{maxCosineDistance.toFixed(2)}</span>
          </div>
          <Slider
            id="cosine-threshold"
            min={0}
            max={1}
            step={0.01}
            value={[maxCosineDistance]}
            onValueChange={(value) => setMaxCosineDistance(value[0])}
            className="my-2"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>More Results</span>
            <span>Higher Relevance</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Adjust this slider to control how closely results must match your search. Move right for fewer but more
            relevant results, or left for more varied results.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <Input
            type="search"
            placeholder={searchMode === "rag" ? "Ask a question..." : "Enter a search query..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-white pl-10 pr-20 py-6 w-full rounded-full border border-slate-200 focus:border-primary text-slate-700"
          />
          <Button type="submit" className="bg-red-500 absolute right-1 top-1 bottom-1 px-6 rounded-full text-white">
            {searchMode === "rag" ? "Ask" : "Search"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 justify-center">
        <span className="text-sm text-slate-500">Try this:</span>
        {["Wie zahle ich mit mein handy?", "Steuerbonus Solar", "Finanzierungs möglichkeiten"].map((suggestion) => (
          <button
            key={suggestion}
            className="inline-flex items-center px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-sm text-slate-800"
            onClick={() => {
              setQuery(suggestion)
              onSearch(suggestion)
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

