"use client"

import { useState, type FormEvent } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  onSearch?: (query: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({
  onSearch = (query) => console.log(`Search query: ${query}`),
  placeholder = "Search...",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState("")

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSearch(query)
  }

  const clearSearch = () => {
    setQuery("")
    onSearch("")
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
          aria-label="Search input"
        />
        {query && (
          <>
            <span className="absolute right-10 text-xs text-muted-foreground">Press Enter ↵</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 h-full rounded-l-none"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </form>
  )
}
