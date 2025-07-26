"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Copy, Check, ChevronDown, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { TextPreview } from "@/components/custom/text-preview"

interface JsonViewerProps {
  data: any
  title?: string
}

interface JsonNodeProps {
  data: any
  keyName?: string
  level?: number
  isLast?: boolean
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems((prev) => new Set([...prev, id]))
      setTimeout(() => {
        setCopiedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const jsonToMarkdown = (obj: any, level = 1): string => {
    const indent = "  ".repeat(Math.max(0, level - 1))
    const headerPrefix = "#".repeat(Math.min(level, 6))

    if (obj === null) return "null"
    if (typeof obj === "boolean") return obj.toString()
    if (typeof obj === "number") return obj.toString()
    if (typeof obj === "string") return obj

    if (Array.isArray(obj)) {
      return obj
        .map((item, index) => {
          if (typeof item === "object" && item !== null) {
            return `${indent}- **Item ${index + 1}:**\n${jsonToMarkdown(item, level + 1)
              .split("\n")
              .map((line) => `${indent}  ${line}`)
              .join("\n")}`
          } else {
            return `${indent}- ${jsonToMarkdown(item, level)}`
          }
        })
        .join("\n")
    }

    if (typeof obj === "object") {
      return Object.entries(obj)
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            return `${headerPrefix} ${key}\n\n${jsonToMarkdown(value, level + 1)}`
          } else {
            return `${indent}**${key}:** ${jsonToMarkdown(value, level)}`
          }
        })
        .join("\n\n")
    }

    return String(obj)
  }

  const copyAsMarkdown = () => {
    const markdown = `${jsonToMarkdown(data)}`
    copyToClipboard(markdown, "markdown")
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <Button variant="outline" size="sm" onClick={copyAsMarkdown} className="flex items-center gap-2">
          {copiedItems.has("markdown") ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Copy as Markdown
        </Button>
      </CardHeader>
      <CardContent>
        <JsonNode data={data} level={0} />
      </CardContent>
    </Card>
  )
}

const JsonNode: React.FC<JsonNodeProps> = ({ data, keyName, level = 0, isLast = true }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems((prev) => new Set([...prev, id]))
      setTimeout(() => {
        setCopiedItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const getValueType = (value: any): string => {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    return typeof value
  }

  const getValuePreview = (value: any): string => {
    if (value === null) return "null"
    if (typeof value === "string") return `"${value.length > 50 ? value.substring(0, 50) + "..." : value}"`
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return `Array(${value.length})`
    if (typeof value === "object") return `Object(${Object.keys(value).length} keys)`
    return String(value)
  }

  const renderPrimitiveValue = (value: any, copyId: string) => {
    const displayValue = value === null ? "null" : typeof value === "string" ? `"${value}"` : String(value)

    return (
      <div className="flex items-center gap-2 group w-[80%]">
        <span
          className={cn(
            "text-sm px-2 py-1 rounded",
            typeof value === "number" && "bg-green-50 text-green-700",
            typeof value === "boolean" && "bg-purple-50 text-purple-700",
            value === null && "bg-gray-50 text-gray-500",
          )}
        >
          <TextPreview text={displayValue} markdown={true} />
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
          onClick={() => copyToClipboard(String(value), copyId)}
        >
          {copiedItems.has(copyId) ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    )
  }

  if (typeof data !== "object" || data === null) {
    return (
      <div className="flex items-center justify-between py-3 hover:bg-muted border-l-2 border-purple-500 pl-2">
        {keyName && <span className="font-medium mr-3 max-w-[20%] pl-3">{keyName}:</span>}
        {renderPrimitiveValue(data, `${keyName || "root"}-${level}`)}
      </div>
    )
  }

  const isArray = Array.isArray(data)
  const entries = isArray ? data.map((item, index) => [index, item]) : Object.entries(data)
  const isEmpty = entries.length === 0

  return (
    <div className={cn("", level > 0 && "ml-2")}>
      {keyName && (
        <div className="flex items-center gap-2 py-2 group hover:bg-muted cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <span className="font-semibold">{keyName}</span>
          <Badge variant="secondary" className="text-xs">
            {getValueType(data)}
          </Badge>
          <span className="text-sm">{getValuePreview(data)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ml-auto"
            onClick={() => copyToClipboard(JSON.stringify(data, null, 2), `${keyName}-object-${level}`)}
          >
            {copiedItems.has(`${keyName}-object-${level}`) ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-1 mt-2">
          {isEmpty ? (
            <div className="text-sm italic py-2">{isArray ? "Empty array" : "Empty object"}</div>
          ) : (
            entries.map(([key, value], index) => (
              <div key={key} className="relative">
                <JsonNode
                  data={value}
                  keyName={isArray ? `[${key}]` : String(key)}
                  level={level + 1}
                  isLast={index === entries.length - 1}
                />
                {index < entries.length - 1 && level === 0 && <Separator className="my-2" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}