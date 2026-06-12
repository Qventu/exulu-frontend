"use client";

/**
 * /prompts L1 surface (work item 2.9; prompts.md §3 "Default view (L1)";
 * primary persona P2 curator, secondary P1 user).
 *
 * Composition: PageShell content → PageHeader ("Prompts" + "New prompt") →
 * Toolbar (search + sort + Filters popover) → ListDetail with the slim row
 * list left and the prompt document right (static — always-visible panel
 * per the prompts.md detailMode mention and ListDetail's "static" semantics
 * — collapses to a Sheet below `lg`).
 *
 * Restores REAL pagination (prompts.md H1; ChevronLeft/Right are wired);
 * widens NOTHING on the server filter (the OR(name/description/content)
 * spec delta needs backend support — see PROMPTS_OR_SEARCH_SUPPORTED in
 * queries.ts).
 *
 * Palette deep-link: arriving with ?new=1 opens the create dialog (the
 * shell's command palette already deep-links here — command-palette.tsx
 * §"Create").
 *
 * Keyboard: "/" focuses search via React ref (replaces the legacy
 * placeholder-text DOM query which broke on translation, M6). ⌘K is
 * RESERVED for the shell's command palette — the legacy "Cmd+K opens
 * create" binding has been retired (the page doc explicitly forbids
 * re-squatting it, and the chat redesign already released the chord).
 */

import {
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardType,
  Plus,
  SearchX,
} from "lucide-react";
import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { UserContext } from "@/app/(application)/authenticated";
import { EmptyState } from "@/components/primitives/empty-state";
import { ListDetail } from "@/components/primitives/list-detail";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Toolbar } from "@/components/primitives/toolbar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { can } from "@/lib/rights";
import { GET_AGENTS } from "@/queries/queries";
import type { PromptLibrary } from "@/types/models/prompt-library";

import {
  DEFAULT_PROMPTS_SORT,
  PROMPTS_PAGE_SIZE,
  type PromptsSort,
  useUniquePromptTagsLocal,
  usePromptsIndex,
} from "../hooks";
import { PromptDetail } from "./prompt-detail";
import { PromptEditorModal } from "./prompt-editor-modal";
import { PromptRow } from "./prompt-row";

type SortValue =
  | "updatedAt"
  | "createdAt"
  | "favorite_count"
  | "usage_count"
  | "name";

const SORT_OPTIONS: Record<SortValue, PromptsSort> = {
  updatedAt: { field: "updatedAt", direction: "DESC" },
  createdAt: { field: "createdAt", direction: "DESC" },
  favorite_count: { field: "favorite_count", direction: "DESC" },
  usage_count: { field: "usage_count", direction: "DESC" },
  name: { field: "name", direction: "ASC" },
};

function sortValueOf(sort: PromptsSort): SortValue {
  return (Object.keys(SORT_OPTIONS) as SortValue[]).find(
    (k) =>
      SORT_OPTIONS[k].field === sort.field &&
      SORT_OPTIONS[k].direction === sort.direction,
  ) ?? "updatedAt";
}

const SKELETON_ROWS = 10;
const MAX_AGENTS_IN_FILTER = 100;

export function PromptsView() {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = React.useContext(UserContext);

  // Same predicate the nav uses (route guard layout.tsx also uses it).
  const canWrite = can(user, { area: "agents", level: "write" });

  const {
    items,
    pageInfo,
    loading,
    error,
    refetch,
    refetchFavorites,
    page,
    setPage,
    search,
    setSearch,
    tags,
    setTags,
    agents,
    setAgents,
    favoritesOnly,
    setFavoritesOnly,
    sort,
    setSort,
    favoriteIdByPromptId,
  } = usePromptsIndex({ userId: user?.id });

  const { data: tagsData } = useUniquePromptTagsLocal();
  const availableTags = React.useMemo(
    () => tagsData?.getUniquePromptTags ?? [],
    [tagsData],
  );

  // Agents list for the filter popover. The legacy filter capped at 100 too.
  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: MAX_AGENTS_IN_FILTER },
  });
  const availableAgents: Array<{ id: string; name: string }> =
    agentsData?.agentsPagination?.items ?? [];

  // Selection (URL-synced ?selected=<id> via ListDetail).
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = React.useMemo(
    () => items.find((p) => p.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Auto-select first prompt on lg+ static panel — only on lg+ via media
  // query so phones never open a sheet unprompted (ListDetail JSDoc rule).
  React.useEffect(() => {
    if (selectedId) return;
    if (items.length === 0) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    setSelectedId(items[0].id);
    // Intentionally only react to items length / id key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length === 0 ? "" : items[0]?.id, selectedId]);

  // Palette deep-link: ?new=1 opens the create dialog and strips the param.
  const [createOpen, setCreateOpen] = React.useState(false);
  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      if (canWrite) setCreateOpen(true);
      router.replace("/prompts", { scroll: false });
    }
  }, [searchParams, router, canWrite]);

  // Keyboard shortcuts (prompts.md §3 ladder items 7 + 8):
  //   "/"  → focus the toolbar search input (item 8).
  //   "N"  → open the create dialog (item 7) — single-key, list-focused.
  //          Cmd+K stays reserved for the shell's command palette.
  // Both ignore editable targets so they can't hijack typing inside dialogs.
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;

      if (event.key === "/") {
        // Toolbar's search input is the only one in the page chrome.
        const node = document.querySelector<HTMLInputElement>(
          'input[type="search"]',
        );
        if (node) {
          event.preventDefault();
          node.focus();
          searchRef.current = node;
        }
        return;
      }

      // Lowercase "n" only (uppercase implies Shift, which usually indicates
      // an intentional sequence the user is composing).
      if (event.key === "n" && !event.shiftKey && canWrite) {
        event.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canWrite]);

  // Dev-only console easter egg (prompts.md ladder item 9): announce the
  // current shortcuts in development builds so curious devs notice the
  // re-bound "N" + "/" pair. Production builds get nothing.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console
    console.info(
      "%c[prompts] shortcuts:%c  N → new prompt   /  → focus search",
      "color: hsl(257.9, 100%, 60%); font-weight: 600;",
      "color: inherit;",
    );
  }, []);

  const activeFilterCount =
    (tags.length > 0 ? 1 : 0) +
    (agents.length > 0 ? 1 : 0) +
    (favoritesOnly ? 1 : 0);
  const filtered =
    search.trim().length > 0 ||
    tags.length > 0 ||
    agents.length > 0 ||
    favoritesOnly;

  const handleResetFilters = React.useCallback(() => {
    setTags([]);
    setAgents([]);
    setFavoritesOnly(false);
  }, [setAgents, setFavoritesOnly, setTags]);

  const updatedFormatter = React.useMemo(
    () =>
      new Intl.RelativeTimeFormat(undefined, {
        numeric: "auto",
        style: "narrow",
      }),
    [],
  );

  const formatUpdated = React.useCallback(
    (iso: string) => {
      const diff = new Date(iso).getTime() - Date.now();
      const minutes = Math.round(diff / 60_000);
      if (Math.abs(minutes) < 60)
        return updatedFormatter.format(minutes, "minute");
      const hours = Math.round(minutes / 60);
      if (Math.abs(hours) < 24)
        return updatedFormatter.format(hours, "hour");
      const days = Math.round(hours / 24);
      if (Math.abs(days) < 30) return updatedFormatter.format(days, "day");
      const months = Math.round(days / 30);
      if (Math.abs(months) < 12)
        return updatedFormatter.format(months, "month");
      return updatedFormatter.format(Math.round(months / 12), "year");
    },
    [updatedFormatter],
  );

  const showSkeleton = loading && items.length === 0;
  const showError = !!error && items.length === 0;
  const showEmpty = !loading && !showError && items.length === 0;

  const emptyState = filtered ? (
    <EmptyState
      icon={SearchX}
      title={t("searchEmptyTitle")}
      description={t("searchEmptyDescription")}
      action={{ label: tCommon("reset"), onClick: handleResetFilters }}
    />
  ) : canWrite ? (
    <EmptyState
      icon={ClipboardType}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={{ label: t("newPrompt"), onClick: () => setCreateOpen(true) }}
    />
  ) : (
    <EmptyState
      icon={ClipboardType}
      title={t("emptyReadOnlyTitle")}
      description={t("emptyReadOnlyDescription")}
    />
  );

  const showActiveChips = tags.length > 0 || agents.length > 0;

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Loading / error / empty / rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showError ? (
          <div className="p-4">
            <EmptyState
              variant="error"
              title={t("errorTitle")}
              description={t("errorDescription")}
              action={{ label: tCommon("retry"), onClick: () => refetch() }}
            />
          </div>
        ) : showSkeleton ? (
          <ul aria-busy="true" className="divide-y divide-border">
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <li key={i} className="space-y-1.5 px-3 py-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))}
          </ul>
        ) : showEmpty ? (
          <div className="p-4">{emptyState}</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((prompt) => (
              <PromptRow
                key={prompt.id}
                prompt={prompt}
                selected={selectedId === prompt.id}
                onSelect={() => setSelectedId(prompt.id)}
                updatedLabel={formatUpdated(prompt.updatedAt)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Pagination footer (item 4 — restores prev/next, kills H1). */}
      {pageInfo && pageInfo.pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {t("rangeOfTotal", {
              from: Math.min(
                (page - 1) * PROMPTS_PAGE_SIZE + 1,
                pageInfo.itemCount,
              ),
              to: Math.min(page * PROMPTS_PAGE_SIZE, pageInfo.itemCount),
              total: pageInfo.itemCount,
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-8"
              onClick={() => setPage(page - 1)}
              disabled={!pageInfo.hasPreviousPage}
            >
              <span className="sr-only">{tCommon("goToPreviousPage")}</span>
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:size-8"
              onClick={() => setPage(page + 1)}
              disabled={!pageInfo.hasNextPage}
            >
              <span className="sr-only">{tCommon("goToNextPage")}</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  const filterControls = (
    <>
      <Select
        value={sortValueOf(sort)}
        onValueChange={(value) =>
          setSort(SORT_OPTIONS[value as SortValue])
        }
      >
        <SelectTrigger
          aria-label={t("sortLabel")}
          className="w-full md:w-48"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updatedAt">{t("sort.recentlyUpdated")}</SelectItem>
          <SelectItem value="createdAt">{t("sort.recentlyCreated")}</SelectItem>
          <SelectItem value="favorite_count">
            {t("sort.mostFavorited")}
          </SelectItem>
          <SelectItem value="usage_count">{t("sort.mostUsed")}</SelectItem>
          <SelectItem value="name">{t("sort.alphabetical")}</SelectItem>
        </SelectContent>
      </Select>

      <FiltersPopover
        availableTags={availableTags}
        availableAgents={availableAgents}
        tags={tags}
        onTagsChange={setTags}
        agents={agents}
        onAgentsChange={setAgents}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        activeCount={activeFilterCount}
      />
    </>
  );

  return (
    <PageShell variant="content">
      {canWrite ? (
        <MobileTopbarAction>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="mr-1 size-4" />
            {t("newPrompt")}
          </Button>
        </MobileTopbarAction>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          canWrite ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("newPrompt")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <Toolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("searchPlaceholder"),
            debounceMs: 0, // debounce lives in usePromptsIndex.
          }}
          filters={filterControls}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
        />

        {/* Active filter chips (item 13/14, only when active). */}
        {showActiveChips ? (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <Badge
                key={`tag-${tag}`}
                variant="secondary"
                className="gap-1"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  className="ml-0.5 inline-flex size-4 items-center justify-center rounded hover:bg-muted"
                  aria-label={t("removeFilter", { name: tag })}
                  onClick={() =>
                    setTags(tags.filter((entry) => entry !== tag))
                  }
                >
                  ×
                </button>
              </Badge>
            ))}
            {agents.map((agentId) => {
              const agent = availableAgents.find((a) => a.id === agentId);
              return (
                <Badge
                  key={`agent-${agentId}`}
                  variant="secondary"
                  className="gap-1"
                >
                  <Bot aria-hidden="true" className="size-3" />
                  <span>{agent?.name ?? agentId}</span>
                  <button
                    type="button"
                    className="ml-0.5 inline-flex size-4 items-center justify-center rounded hover:bg-muted"
                    aria-label={t("removeFilter", {
                      name: agent?.name ?? agentId,
                    })}
                    onClick={() =>
                      setAgents(agents.filter((entry) => entry !== agentId))
                    }
                  >
                    ×
                  </button>
                </Badge>
              );
            })}
          </div>
        ) : null}

        <div className="flex min-h-[60vh] overflow-hidden rounded-md border bg-card lg:min-h-[calc(100dvh-18rem)]">
          <ListDetail<PromptLibrary>
            detailMode="static"
            items={items}
            selected={selected}
            onSelect={(item) => setSelectedId(item ? item.id : null)}
            detailTitle={(item) => item.name}
            detail={(item) => (
              <PromptDetail
                prompt={item}
                favoriteId={favoriteIdByPromptId.get(item.id)}
                onUpdated={() => {
                  refetch();
                }}
                onFavoritesChanged={() => {
                  refetchFavorites();
                }}
                onDeleted={() => {
                  setSelectedId(null);
                  refetch();
                }}
              />
            )}
            emptyDetail={
              <EmptyState
                variant="quiet"
                icon={ClipboardType}
                title={t("detailEmptyTitle")}
              />
            }
            list={list}
            className="w-full"
          />
        </div>
      </div>

      <PromptEditorModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          setCreateOpen(false);
          refetch();
        }}
        user={user}
      />
    </PageShell>
  );
}

interface FiltersPopoverProps {
  availableTags: string[];
  availableAgents: Array<{ id: string; name: string }>;
  tags: string[];
  onTagsChange: (next: string[]) => void;
  agents: string[];
  onAgentsChange: (next: string[]) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (next: boolean) => void;
  activeCount: number;
}

function FiltersPopover({
  availableTags,
  availableAgents,
  tags,
  onTagsChange,
  agents,
  onAgentsChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  activeCount,
}: FiltersPopoverProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto">
          {tCommon("filters")}
          {activeCount > 0 ? (
            <Badge variant="secondary" className="ml-2 px-1.5">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 md:w-80">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-medium">{t("favoritesOnly")}</span>
          <Switch
            checked={favoritesOnly}
            onCheckedChange={onFavoritesOnlyChange}
            aria-label={t("favoritesOnly")}
          />
        </div>
        <div className="border-b border-border">
          <Command>
            <CommandInput placeholder={t("tagsPlaceholder")} />
            <CommandList className="max-h-40">
              <CommandEmpty>{t("noTags")}</CommandEmpty>
              <CommandGroup heading={t("tagsHeading")}>
                {availableTags.map((tag) => {
                  const checked = tags.includes(tag);
                  return (
                    <CommandItem
                      key={tag}
                      onSelect={() =>
                        onTagsChange(
                          checked
                            ? tags.filter((entry) => entry !== tag)
                            : [...tags, tag],
                        )
                      }
                    >
                      <span className="mr-2 inline-flex size-3 items-center justify-center">
                        {checked ? "✓" : ""}
                      </span>
                      <span className="truncate">{tag}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
        <Command>
          <CommandInput placeholder={t("agentsPlaceholder")} />
          <CommandList className="max-h-40">
            <CommandEmpty>{t("noAgents")}</CommandEmpty>
            <CommandGroup heading={t("agentsHeading")}>
              {availableAgents.map((agent) => {
                const checked = agents.includes(agent.id);
                return (
                  <CommandItem
                    key={agent.id}
                    value={agent.name}
                    onSelect={() =>
                      onAgentsChange(
                        checked
                          ? agents.filter((entry) => entry !== agent.id)
                          : [...agents, agent.id],
                      )
                    }
                  >
                    <span className="mr-2 inline-flex size-3 items-center justify-center">
                      {checked ? "✓" : ""}
                    </span>
                    <span className="truncate">{agent.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {activeCount > 0 ? (
          <div className="flex items-center justify-end border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onTagsChange([]);
                onAgentsChange([]);
                onFavoritesOnlyChange(false);
              }}
            >
              {tCommon("reset")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// Re-export DEFAULT_PROMPTS_SORT so the reducer in tests / parents can read it.
export { DEFAULT_PROMPTS_SORT };
