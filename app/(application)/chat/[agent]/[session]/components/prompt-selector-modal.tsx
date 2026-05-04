"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Copy, Check, ArrowUp, AlignLeft, MessageSquare, FileText } from "lucide-react";
import { usePrompts } from "@/hooks/use-prompts";
import { PromptLibrary } from "@/types/models/prompt-library";
import { extractVariables, fillPromptVariables, formatVariableName } from "@/lib/prompts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface PromptSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (prompt: PromptLibrary, filledContent: string) => void;
  agentId?: string;
}

const CATEGORY_ALL = "__all__";

// Map first tag to an icon
function PromptIcon({ tags }: { tags?: string[] }) {
  const tag = tags?.[0]?.toLowerCase() ?? "";
  if (tag.includes("support") || tag.includes("ticket")) return <MessageSquare className="w-4 h-4" />;
  if (tag.includes("engineer") || tag.includes("code") || tag.includes("tech")) return <FileText className="w-4 h-4" />;
  return <AlignLeft className="w-4 h-4" />;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function PreviewContent({ content, values }: { content: string; values: Record<string, string> }) {
  // Split by {{variable}} tokens, render filled ones in blue, unfilled in amber
  const parts = content.split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
  return (
    <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
        if (!match) return <span key={i}>{part}</span>;
        const varName = match[1];
        const filled = values[varName];
        if (filled) {
          return (
            <span key={i} className="bg-blue-500/20 text-blue-300 dark:text-blue-300 rounded px-0.5">
              {filled}
            </span>
          );
        }
        return (
          <span key={i} className="bg-amber-500/20 text-amber-400 dark:text-amber-400 rounded px-0.5">
            {part}
          </span>
        );
      })}
    </pre>
  );
}

export function PromptSelectorModal({
  open,
  onOpenChange,
  onSelectPrompt,
  agentId,
}: PromptSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ALL);
  const [activePrompt, setActivePrompt] = useState<PromptLibrary | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filters: any[] = [];
  if (searchQuery) {
    filters.push({
      or: [
        { name: { contains: searchQuery } },
        { description: { contains: searchQuery } },
        { content: { contains: searchQuery } },
      ],
    });
  }

  const { data, loading } = usePrompts({
    page: 1,
    limit: 100,
    filters,
    sort: { field: "usage_count", direction: "DESC" },
  });

  const prompts = data?.prompt_libraryPagination?.items || [];

  // Derive categories from all tags
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of prompts) {
      for (const tag of p.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [prompts]);

  // Filter by category
  const filteredPrompts = useMemo(() => {
    if (selectedCategory === CATEGORY_ALL) return prompts;
    return prompts.filter((p) => p.tags?.includes(selectedCategory));
  }, [prompts, selectedCategory]);

  // Auto-select first prompt when list changes
  useEffect(() => {
    if (filteredPrompts.length > 0 && !activePrompt) {
      setActivePrompt(filteredPrompts[0]);
    }
  }, [filteredPrompts]);

  // Reset variable values when prompt changes
  useEffect(() => {
    setVariableValues({});
  }, [activePrompt?.id]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      // Reset on close
      setSearchQuery("");
      setSelectedCategory(CATEGORY_ALL);
      setActivePrompt(null);
      setVariableValues({});
      setCopied(false);
    }
  }, [open]);

  const variables = activePrompt ? extractVariables(activePrompt.content) : [];
  const filledContent = activePrompt
    ? fillPromptVariables(activePrompt.content, variableValues)
    : "";
  const allVariablesFilled = variables.every((v) => variableValues[v]?.trim());
  const canUse = !!activePrompt && (variables.length === 0 || allVariablesFilled);

  const handleUse = () => {
    if (!canUse) return;
    onSelectPrompt(activePrompt!, filledContent);
    onOpenChange(false);
  };

  const handleCopy = () => {
    if (!filledContent) return;
    navigator.clipboard.writeText(filledContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[82vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompt templates..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Three-column body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Categories */}
          <div className="w-44 shrink-0 border-r flex flex-col">
            <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Categories
            </p>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-3 space-y-0.5">
                <button
                  onClick={() => setSelectedCategory(CATEGORY_ALL)}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    selectedCategory === CATEGORY_ALL
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent/50 text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                    All templates
                  </span>
                  <span className="text-xs tabular-nums">{prompts.length}</span>
                </button>
                {categories.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedCategory(tag)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                      selectedCategory === tag
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-accent/50 text-muted-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2 capitalize truncate">
                      <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                      {tag}
                    </span>
                    <span className="text-xs tabular-nums shrink-0">{count}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Middle: Prompt list */}
          <ScrollArea className="w-[340px] shrink-0 border-r">
            <div className="py-2">
              {loading ? (
                <div className="px-3 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredPrompts.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No templates found
                </div>
              ) : (
                filteredPrompts.map((prompt) => {
                  const isActive = activePrompt?.id === prompt.id;
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => setActivePrompt(prompt)}
                      className={`w-full text-left px-3 py-3 mx-1 rounded-lg transition-colors ${
                        isActive
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                      style={{ width: "calc(100% - 8px)" }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 p-1.5 rounded-md bg-muted shrink-0 text-muted-foreground">
                          <PromptIcon tags={prompt.tags} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{prompt.name}</p>
                          {prompt.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                              {prompt.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
                            {prompt.tags?.[0] && (
                              <span className="capitalize">{prompt.tags[0]}</span>
                            )}
                            {prompt.tags?.[0] && <span>·</span>}
                            <span>used {prompt.usage_count ?? 0}×</span>
                            {prompt.updatedAt && (
                              <>
                                <span>·</span>
                                <span>{relativeTime(prompt.updatedAt)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Right: Detail + preview */}
          {activePrompt ? (
            <div className="flex-1 min-w-0 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="px-5 py-4 space-y-4">
                  {/* Meta */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      {activePrompt.tags?.[0] ?? "Template"}
                      {(activePrompt.usage_count ?? 0) > 0 && (
                        <> · used {activePrompt.usage_count} times</>
                      )}
                    </p>
                    <h2 className="text-xl font-semibold leading-tight">{activePrompt.name}</h2>
                    {activePrompt.description && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {activePrompt.description}
                      </p>
                    )}
                  </div>

                  {/* Variables */}
                  {variables.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Variables
                      </p>
                      {variables.map((v) => (
                        <div key={v}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{formatVariableName(v)}</span>
                            <code className="text-xs text-blue-400 bg-blue-500/10 rounded px-1 py-0.5">
                              {`{{${v}}}`}
                            </code>
                          </div>
                          <Input
                            value={variableValues[v] ?? ""}
                            onChange={(e) =>
                              setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                            }
                            placeholder={formatVariableName(v)}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Preview
                    </p>
                    <div className="rounded-lg border bg-muted/30 p-3 text-foreground max-h-48 overflow-y-auto">
                      <PreviewContent content={activePrompt.content} values={variableValues} />
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Footer actions */}
              <div className="flex items-center gap-2 px-5 py-3 border-t shrink-0">
                <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copy
                </Button>
                <div className="flex-1" />
                {variables.length > 0 && !allVariablesFilled && (
                  <span className="text-xs text-muted-foreground">
                    Fill in all variables to continue
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleUse} disabled={!canUse} className="gap-1.5">
                  <ArrowUp className="w-4 h-4" />
                  Use template
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a template to preview
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
