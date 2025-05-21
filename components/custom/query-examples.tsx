"use client"

import { useState } from "react"
import { Clipboard, Check, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface QueryExample {
  title: string
  description: string
  query: string
}

export default function QueryExamples() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const examples: QueryExample[] = [
    {
      title: "Created After Date",
      description: "Find items created after a specific date",
      query: `{"createdAt":{"$gt":"2025-01-01T00:00:00.000Z"}}`,
    },
    {
      title: "All Condition",
      description: "Find items that have all tags in a list",
      query: `{tags: { $all: [ "fire" ]}}`,
    },
  ]

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="mb-6">
      <Button
        type={"button"}
        variant="outline"
        className="flex w-full justify-between border-dashed mb-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Query Examples</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {isExpanded && (
        <div className="grid gap-2 mt-2">
          {examples.map((example, index) => (
            <Card key={index} className="p-3 bg-background border border-muted">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-sm">{example.title}</h3>
                  <p className="text-xs text-muted-foreground">{example.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type={"button"}
                  onClick={() => copyToClipboard(example.query, index)}
                  className="h-8 px-2"
                >
                  {copiedIndex === index ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <pre className="mt-2 p-2 text-xs bg-muted rounded overflow-x-auto">
                <code>{example.query}</code>
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

