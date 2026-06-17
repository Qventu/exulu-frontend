"use client";

/**
 * PromptSelectorModal — relocated from [agent]/[session]/components/ and made
 * responsive (chat.md item 65, fixes U17).
 *
 * Behavior unchanged: full-text search, tag-derived category rail,
 * usage-sorted list with relative timestamps, per-prompt {{variable}} form
 * with live preview, Copy, "Use template" (insert handled by the composer,
 * which also increments usage). Desktop keeps the three-column dialog;
 * below `md` it becomes a full-screen stepped sheet
 * (categories → list → detail with back — responsive.md T5).
 *
 * Public API unchanged: { open, onOpenChange, onSelectPrompt, agentId }.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Copy,
  Check,
  ArrowUp,
  ArrowLeft,
  AlignLeft,
  MessageSquare,
  FileText,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { RelativeTime } from "@/components/primitives/relative-time";
import { usePrompts } from "@/hooks/use-prompts";
import { PromptLibrary } from "@/types/models/prompt-library";
import {
  extractVariables,
  fillPromptVariables,
  formatVariableName,
} from "@/lib/prompts";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PromptSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (prompt: PromptLibrary, filledContent: string) => void;
  agentId?: string;
}

const CATEGORY_ALL = "__all__";

type MobileStep = "categories" | "list" | "detail";

// Map first tag to an icon
function promptIcon(tags?: string[]): LucideIcon {
  const tag = tags?.[0]?.toLowerCase() ?? "";
  if (tag.includes("support") || tag.includes("ticket")) return MessageSquare;
  if (tag.includes("engineer") || tag.includes("code") || tag.includes("tech"))
    return FileText;
  return AlignLeft;
}

function PreviewContent({
  content,
  values,
}: {
  content: string;
  values: Record<string, string>;
}) {
  // Split by {{variable}} tokens; filled values render on the primary tint,
  // unfilled placeholders on the warning tint (semantic tokens only).
  const parts = content.split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
        if (!match) return <span key={i}>{part}</span>;
        const varName = match[1];
        const filled = values[varName];
        if (filled) {
          return (
            <span key={i} className="rounded bg-primary/15 px-0.5 text-primary">
              {filled}
            </span>
          );
        }
        return (
          <span key={i} className="rounded bg-warning/20 px-0.5 text-warning">
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
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_ALL);
  const [activePrompt, setActivePrompt] = useState<PromptLibrary | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [copied, setCopied] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileStep>("categories");
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

  // Auto-select first prompt when list changes (desktop preview pane only —
  // mobile navigates by explicit steps).
  useEffect(() => {
    if (!isMobile && filteredPrompts.length > 0 && !activePrompt) {
      setActivePrompt(filteredPrompts[0]);
    }
  }, [filteredPrompts, isMobile, activePrompt]);

  // Reset variable values when prompt changes
  useEffect(() => {
    setVariableValues({});
  }, [activePrompt?.id]);

  // Focus search on open (desktop); reset everything on close.
  useEffect(() => {
    if (open) {
      if (!isMobile) {
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    } else {
      setSearchQuery("");
      setSelectedCategory(CATEGORY_ALL);
      setActivePrompt(null);
      setVariableValues({});
      setCopied(false);
      setMobileStep("categories");
    }
  }, [open, isMobile]);

  const variables = activePrompt ? extractVariables(activePrompt.content) : [];
  const filledContent = activePrompt
    ? fillPromptVariables(activePrompt.content, variableValues)
    : "";
  const allVariablesFilled = variables.every((v) => variableValues[v]?.trim());
  const canUse =
    !!activePrompt && (variables.length === 0 || allVariablesFilled);

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

  // ── Shared pieces ─────────────────────────────────────────────────────

  const categoryButton = (
    key: string,
    label: string,
    count: number,
    withChevron: boolean,
  ) => {
    const isActive = selectedCategory === key;
    return (
      <button
        key={key}
        onClick={() => {
          setSelectedCategory(key);
          if (isMobile) setMobileStep("list");
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors duration-150",
          "min-h-[44px] md:min-h-0",
          isActive && !isMobile
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 capitalize">
          <AlignLeft className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
          {count}
          {withChevron && (
            <ChevronRight
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </span>
      </button>
    );
  };

  const promptListItem = (prompt: PromptLibrary) => {
    const isActive = activePrompt?.id === prompt.id;
    const Icon = promptIcon(prompt.tags);
    return (
      <button
        key={prompt.id}
        onClick={() => {
          setActivePrompt(prompt);
          if (isMobile) setMobileStep("detail");
        }}
        className={cn(
          "mx-1 w-[calc(100%-8px)] rounded-lg px-3 py-3 text-left transition-colors duration-150",
          isActive && !isMobile ? "bg-accent" : "hover:bg-accent/50",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0 rounded-md bg-muted p-1.5 text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {prompt.name}
            </p>
            {prompt.description && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {prompt.description}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {prompt.tags?.[0] && (
                <span className="capitalize">{prompt.tags[0]}</span>
              )}
              {prompt.tags?.[0] && <span>·</span>}
              <span>
                {t("prompts.usedCount", { count: prompt.usage_count ?? 0 })}
              </span>
              {prompt.updatedAt && (
                <>
                  <span>·</span>
                  <RelativeTime date={prompt.updatedAt} />
                </>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const listContent = (
    <div className="py-2">
      {loading ? (
        <div className="space-y-2 px-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {t("prompts.noTemplates")}
        </div>
      ) : (
        filteredPrompts.map((prompt) => promptListItem(prompt))
      )}
    </div>
  );

  const detailBody = activePrompt && (
    <div className="space-y-4 px-5 py-4">
      {/* Meta */}
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {activePrompt.tags?.[0] ?? t("prompts.template")}
          {(activePrompt.usage_count ?? 0) > 0 && (
            <>
              {" · "}
              {t("prompts.usedCount", { count: activePrompt.usage_count ?? 0 })}
            </>
          )}
        </p>
        <h2 className="text-xl font-semibold leading-tight">
          {activePrompt.name}
        </h2>
        {activePrompt.description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {activePrompt.description}
          </p>
        )}
      </div>

      {/* Variables */}
      {variables.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("prompts.variables")}
          </p>
          {variables.map((v) => (
            <div key={v}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm">{formatVariableName(v)}</span>
                <code className="rounded bg-primary/10 px-1 py-0.5 text-xs text-primary">
                  {`{{${v}}}`}
                </code>
              </div>
              <Input
                value={variableValues[v] ?? ""}
                onChange={(e) =>
                  setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                }
                placeholder={formatVariableName(v)}
                className="h-10 text-base md:h-8 md:text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("prompts.preview")}
        </p>
        <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-foreground">
          <PreviewContent
            content={activePrompt.content}
            values={variableValues}
          />
        </div>
      </div>
    </div>
  );

  const detailFooter = (
    <div className="flex shrink-0 items-center gap-2 border-t px-5 py-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-9 gap-1.5 md:h-8"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? t("prompts.copied") : t("prompts.copy")}
      </Button>
      <div className="flex-1" />
      {variables.length > 0 && !allVariablesFilled && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t("prompts.fillVariables")}
        </span>
      )}
      {!isMobile && (
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {tCommon("cancel")}
        </Button>
      )}
      <Button
        size="sm"
        onClick={handleUse}
        disabled={!canUse}
        className="h-9 gap-1.5 md:h-8"
      >
        <ArrowUp className="size-4" aria-hidden="true" />
        {t("prompts.useTemplate")}
      </Button>
    </div>
  );

  // ── Mobile: full-screen stepped sheet (T5) ────────────────────────────

  if (isMobile) {
    const stepBack = () =>
      setMobileStep(mobileStep === "detail" ? "list" : "categories");

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-dvh max-h-dvh flex-col gap-0 p-0 pb-[env(safe-area-inset-bottom)]"
        >
          {/* Step header */}
          <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
            {mobileStep !== "categories" && (
              <button
                type="button"
                onClick={stepBack}
                aria-label={t("prompts.back")}
                className="flex size-11 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
            )}
            <SheetTitle className="min-w-0 flex-1 truncate px-1 text-base font-medium">
              {mobileStep === "detail" && activePrompt
                ? activePrompt.name
                : mobileStep === "list"
                  ? selectedCategory === CATEGORY_ALL
                    ? t("prompts.allTemplates")
                    : selectedCategory
                  : t("prompts.title")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("prompts.searchPlaceholder")}
            </SheetDescription>
          </div>

          {mobileStep === "categories" && (
            <div className="flex-1 overflow-y-auto px-2 py-3">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("prompts.categories")}
              </p>
              <div className="space-y-0.5">
                {categoryButton(
                  CATEGORY_ALL,
                  t("prompts.allTemplates"),
                  prompts.length,
                  true,
                )}
                {categories.map(([tag, count]) =>
                  categoryButton(tag, tag, count, true),
                )}
              </div>
            </div>
          )}

          {mobileStep === "list" && (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2">
                <Search
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("prompts.searchPlaceholder")}
                  aria-label={t("prompts.searchPlaceholder")}
                  className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex-1 overflow-y-auto">{listContent}</div>
            </>
          )}

          {mobileStep === "detail" && activePrompt && (
            <>
              <div className="flex-1 overflow-y-auto">{detailBody}</div>
              {detailFooter}
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: three-column dialog (unchanged layout) ───────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82vh] max-h-[85dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">{t("prompts.title")}</DialogTitle>
        {/* Search header */}
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("prompts.searchPlaceholder")}
            aria-label={t("prompts.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Three-column body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: Categories */}
          <div className="flex w-44 shrink-0 flex-col border-r">
            <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("prompts.categories")}
            </p>
            <ScrollArea className="flex-1">
              <div className="space-y-0.5 px-2 pb-3">
                {categoryButton(
                  CATEGORY_ALL,
                  t("prompts.allTemplates"),
                  prompts.length,
                  false,
                )}
                {categories.map(([tag, count]) =>
                  categoryButton(tag, tag, count, false),
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Middle: Prompt list */}
          <ScrollArea className="w-[340px] shrink-0 border-r">
            {listContent}
          </ScrollArea>

          {/* Right: Detail + preview */}
          {activePrompt ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <ScrollArea className="flex-1">{detailBody}</ScrollArea>
              {detailFooter}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t("prompts.selectToPreview")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
