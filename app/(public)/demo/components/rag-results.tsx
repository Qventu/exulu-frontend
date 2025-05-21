"use client"

import { useState, useEffect, useRef } from "react"
import type { Article } from "../types"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react"

interface RAGResultsProps {
  result: {
        result: string,
        sources: Article[]
    }
  searchQuery: string
  isLoading: boolean
}

export default function RAGResults({ result, searchQuery, isLoading }: RAGResultsProps) {
  const [generatedText, setGeneratedText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSources, setShowSources] = useState(false)
    const [feedback, setFeedback] = useState<"positive" | "negative" | null>(null)
  const [showFeedbackThanks, setShowFeedbackThanks] = useState(false)
  const fullAnswerRef = useRef("")
  const sourceRefs = useRef<string[]>([])

    // Handle feedback submission
  const handleFeedback = (type: "positive" | "negative") => {
    setFeedback(type)
    setShowFeedbackThanks(true)

    // In a real application, you would send this feedback to your backend
    console.log(`User provided ${type} feedback for query: "${searchQuery}"`)

    // Hide the thank you message after 3 seconds
    setTimeout(() => {
      setShowFeedbackThanks(false)
    }, 3000)
  }

  // Reset feedback when new search is performed
  useEffect(() => {
    setFeedback(null)
    setShowFeedbackThanks(false)
  }, [searchQuery, result])


  useEffect(() => {
    if (isLoading) {
      setGeneratedText("")
      setShowSources(false)
      return
    }

    if (result.sources.length === 0) return

    const simulateStreaming = async () => {
      setIsGenerating(true)
      setGeneratedText("")
      fullAnswerRef.current = result.result
      sourceRefs.current = result.sources.slice(0, 3).map((r) => r.id)

      // Simulate streaming by revealing one character at a time
      for (let i = 0; i < fullAnswerRef.current.length; i++) {
        setGeneratedText(fullAnswerRef.current.substring(0, i + 1))
        // Random delay between 5-15ms for more natural typing effect
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10 + 5))
      }

      setIsGenerating(false)
      // Show sources after the text is fully generated
      setTimeout(() => setShowSources(true), 300)
    }

    simulateStreaming()
  }, [result, isLoading])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-slate-600">Searching...</p>
      </div>
    )
  }

  if (result.sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-slate-600 text-lg mb-2">No results found</p>
        <p className="text-slate-500">Try a different search term or search method</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center mb-4">
          <div className="bg-blue-50 p-2 rounded-full mr-3">
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
              className="text-blue-600"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="font-medium text-lg text-slate-700">AI-Generated Answer</h3>
          {isGenerating && (
            <div className="ml-auto flex items-center text-sm text-slate-500">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Generating...
            </div>
          )}
        </div>

        <div className="prose prose-slate max-w-none">
          {generatedText.split("\n\n").map((paragraph, i) => (
            <p key={i} className={`mb-4 text-slate-800 ${isGenerating ? "animate-pulse" : ""}`}>
              {paragraph}
            </p>
          ))}
        </div>

        {isGenerating && <div className="h-5 w-3 bg-slate-900 animate-pulse inline-block ml-0.5"></div>}

         {!isGenerating && generatedText && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Was this answer helpful?</p>

              {showFeedbackThanks ? (
                <p className="text-sm text-green-600 animate-fade-in">Thanks for your feedback!</p>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleFeedback("positive")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      feedback === "positive"
                        ? "bg-green-50 text-green-600 border border-green-200"
                        : "hover:bg-slate-100 text-slate-600"
                    }`}
                    disabled={feedback !== null}
                  >
                    <ThumbsUp size={16} />
                    Yes
                  </button>
                  <button
                    onClick={() => handleFeedback("negative")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      feedback === "negative"
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "hover:bg-slate-100 text-slate-600"
                    }`}
                    disabled={feedback !== null}
                  >
                    <ThumbsDown size={16} />
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showSources && (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
          <h3 className="font-medium text-lg mb-4 flex items-center text-slate-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2 text-slate-600"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <rect width="22" height="20" x="1" y="3" rx="2" />
              <path d="m9 3-2 4h10l-2-4" />
            </svg>
            Sources
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.sources.slice(0, 4).map((article) => (
              <Card key={article.id} className="overflow-hidden hover:shadow-sm transition-shadow bg-white">
                <div className="flex">
                  <div className="w-24 h-24 relative bg-slate-100 flex-shrink-0">
                    <Image
                      src={article.imageUrl || "/placeholder.svg"}
                      alt={article.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm line-clamp-2 mb-1 text-slate-700">{article.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{article.excerpt}</p>
                    <small className="text-xs text-slate-500 line-clamp-2 mt-2">Score: {article.relevanceScore}</small>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

