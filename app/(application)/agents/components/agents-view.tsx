"use client";

/**
 * /agents L1 surface — the P2 build-area index (work item 2.8, owner "index";
 * agents.md §3 "Default view"; primary persona P2, #1 job: open the agent I'm
 * iterating on and get back into the loop).
 *
 * Deliberately boring: a list, a search, one purple button. PageHeader (H1 =
 * nav label "Agents", ONE primary action "New agent", write-gated) → Toolbar
 * (server-side name search debounced in the hook, Status filter, sort menu —
 * collapsing below md to search + one Filters bottom sheet, T3) → ListDetail
 * rows with real prev/next pagination from pageInfo (kills the legacy
 * limit:100 cap + client-only filter, agents.md review #6).
 *
 * Grouping (2026-10-22): the list body is three stacked blocks —
 *   1. Favourites — the user's starred agents as cards (agent-favourites.tsx),
 *      hidden while a search or status filter is active;
 *   2. Active — published agents, its own paginated AgentsIndex call;
 *   3. Inactive — unpublished agents, its own paginated call, below.
 * Section headings appear only once both halves are on screen (status "all"
 * with at least one inactive agent) — an install with only active agents sees
 * exactly the plain list. Starred agents stay in their section too: the cards
 * are a shortcut, not a third bucket.
 *
 * detailPresentation="sheet" is REQUIRED here: /agents is a centered content
 * page, where the docked aside is banned (list-detail.tsx JSDoc / keys
 * 2026-06-11 QA decision — newer than agents.md's docked-panel sketch).
 *
 * No category filter: {category:{eq}} has no verified backend support (see
 * queries.ts header) — a new affordance, not one of the 69 inventory items.
 *
 * Palette convention: arriving with ?new=1 opens the create dialog
 * (navigation.md §4; keys-view.tsx precedent).
 */

import { Bot, ChevronLeft, ChevronRight, Plus, SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { EmptyState } from "@/components/primitives/empty-state";
import { ListDetail } from "@/components/primitives/list-detail";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { StatusDot } from "@/components/primitives/status-dot";
import { Toolbar } from "@/components/primitives/toolbar";
import { MobileTopbarAction } from "@/components/shell/mobile-topbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/rights";
import type { Agent } from "@/types/models/agent";

import { resolveFavouriteAgents } from "../favourites-utils";
import {
  type AgentsSection,
  type AgentsSort,
  type AgentStatusFilter,
  DEFAULT_AGENTS_SORT,
  useAgentsIndex,
  useDuplicateAgent,
  useFavouriteAgents,
} from "../hooks";
import { AgentDetailPanel } from "./agent-detail-panel";
import { AgentFavourites } from "./agent-favourites";
import { AgentRow } from "./agent-row";
import { CreateAgentDialog } from "./create-agent-dialog";

const SKELETON_ROWS = 8;

type SortValue = "lastUpdated" | "newest" | "nameAsc" | "nameDesc";

const SORT_OPTIONS: Record<SortValue, AgentsSort> = {
  lastUpdated: { field: "updatedAt", direction: "DESC" },
  newest: { field: "createdAt", direction: "DESC" },
  nameAsc: { field: "name", direction: "ASC" },
  nameDesc: { field: "name", direction: "DESC" },
};

function sortValueOf(sort: AgentsSort): SortValue {
  const match = (Object.keys(SORT_OPTIONS) as SortValue[]).find(
    (key) =>
      SORT_OPTIONS[key].field === sort.field &&
      SORT_OPTIONS[key].direction === sort.direction,
  );
  return match ?? "lastUpdated";
}

export function AgentsView() {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = React.useContext(UserContext);

  // Shared RBAC predicate — same source as the nav entry and route guard.
  const canWrite = can(user, { area: "agents", level: "write" });

  const {
    active,
    inactive,
    search,
    setSearch,
    status,
    setStatus,
    sort,
    setSort,
  } = useAgentsIndex();
  const { favouriteIds, favourites, toggleFavourite } = useFavouriteAgents();
  const { duplicate } = useDuplicateAgent();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Palette deep-link: /agents?new=1 opens the create dialog, then the param
  // is stripped (keys-view.tsx:75-81 precedent). Read users just lose the
  // param — the action is write-gated.
  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      if (canWrite) setCreateOpen(true);
      router.replace("/agents", { scroll: false });
    }
  }, [searchParams, router, canWrite]);

  const searching = search.trim().length > 0;
  const filtered = searching || status !== "all";

  // Favourites (cards): star order, resolved by the by-ids query with
  // already-loaded index rows filling in while it resolves. Hidden while the
  // user is looking for something specific (search or status filter).
  const favouriteRows = React.useMemo(
    () =>
      filtered
        ? []
        : resolveFavouriteAgents(favouriteIds, favourites, [
            ...active.agents,
            ...inactive.agents,
          ]),
    [filtered, favouriteIds, favourites, active.agents, inactive.agents],
  );

  // Flat order backing ListDetail's keyboard navigation + selection — a
  // starred agent appears in a card AND its section, so de-dupe by id.
  const allRows = React.useMemo(() => {
    const seen = new Set<string>();
    return [...favouriteRows, ...active.agents, ...inactive.agents].filter(
      (agent) => {
        if (seen.has(agent.id)) return false;
        seen.add(agent.id);
        return true;
      },
    );
  }, [favouriteRows, active.agents, inactive.agents]);

  // Selection derives from the live list; a paged-away row closes the panel.
  const selected = React.useMemo(
    () => allRows.find((agent) => agent.id === selectedId) ?? null,
    [allRows, selectedId],
  );

  const openCreate = React.useCallback(() => setCreateOpen(true), []);

  const handleToggleFavourite = React.useCallback(
    (agent: Agent) => {
      void toggleFavourite(agent.id).catch(() => {
        // Optimistic state already reverted in the hook; just say so.
        toast.error(t("favourites.error"));
      });
    },
    [toggleFavourite, t],
  );

  const handleDuplicate = React.useCallback(
    async (agent: Agent) => {
      try {
        const copyId = await duplicate(agent.id);
        toast.success(t("duplicateSuccess"));
        router.push(`/agents/edit/${copyId}`);
      } catch (err) {
        toast.error(t("duplicateFailed"), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [duplicate, router, t],
  );

  const activeFilterCount =
    (status !== "all" ? 1 : 0) +
    (sortValueOf(sort) !== "lastUpdated" ? 1 : 0);

  const rowCount = active.agents.length + inactive.agents.length;
  const loading = active.loading || inactive.loading;
  const error = active.error ?? inactive.error;
  const showSkeleton = loading && rowCount === 0;
  const showError = !!error && rowCount === 0;
  const showEmpty = !loading && !showError && rowCount === 0;
  // Headings only once both halves are on screen — see the header comment.
  const showSectionHeadings = status === "all" && inactive.agents.length > 0;
  const sectionIdBase = React.useId();

  // Item 13 fix: a real EmptyState for zero agents / zero hits — write users
  // get the create action, read users get ask-your-admin copy.
  const emptyState = filtered ? (
    <EmptyState
      icon={SearchX}
      title={t("searchEmptyTitle")}
      description={t("searchEmptyDescription")}
    />
  ) : canWrite ? (
    <EmptyState
      icon={Bot}
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={{ label: t("newAgent"), onClick: openCreate }}
    />
  ) : (
    <EmptyState
      icon={Bot}
      title={t("emptyReadOnlyTitle")}
      description={t("emptyReadOnlyDescription")}
    />
  );

  const renderPagination = (section: AgentsSection) => {
    const { pageInfo } = section;
    if (!pageInfo || pageInfo.pageCount <= 1) return null;
    // Item 1: real prev/next pagination from pageInfo (agent #101 lives).
    return (
      <div className="flex items-center justify-end gap-4">
        <span
          className="whitespace-nowrap text-sm font-medium"
          aria-live="polite"
        >
          {tCommon("pageOf", {
            page: pageInfo.currentPage,
            count: Math.max(pageInfo.pageCount, 1),
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            onClick={() => section.setPage(pageInfo.currentPage - 1)}
            disabled={!pageInfo.hasPreviousPage}
          >
            <span className="sr-only">{tCommon("goToPreviousPage")}</span>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            onClick={() => section.setPage(pageInfo.currentPage + 1)}
            disabled={!pageInfo.hasNextPage}
          >
            <span className="sr-only">{tCommon("goToNextPage")}</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderSection = (section: AgentsSection, kind: "active" | "inactive") => {
    if (section.agents.length === 0 && !section.error) return null;
    const headingId = `${sectionIdBase}-${kind}`;
    const label = kind === "active" ? tCommon("active") : tCommon("inactive");
    return (
      <section
        key={kind}
        aria-labelledby={showSectionHeadings ? headingId : undefined}
        className="flex flex-col gap-3"
      >
        {showSectionHeadings ? (
          <div className="flex items-center gap-2">
            {/* The dot is decorative inside StatusDot; the heading's name is
                the label alone, so the count sits outside the <h2>. */}
            <h2 id={headingId} className="text-sm font-medium">
              <StatusDot
                status={kind === "active" ? "success" : "muted"}
                label={label}
              />
            </h2>
            {section.pageInfo ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {section.pageInfo.itemCount}
              </span>
            ) : null}
          </div>
        ) : null}
        {section.error && section.agents.length === 0 ? (
          <EmptyState
            variant="error"
            title={t("errorLoading")}
            description={t("errorLoadingDescription")}
            action={{ label: tCommon("retry"), onClick: () => section.refetch() }}
          />
        ) : (
          <div className="rounded-md border">
            <ul className="divide-y divide-border">
              {section.agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  canEdit={canWrite}
                  selected={agent.id === selectedId}
                  onSelect={(item) => setSelectedId(item.id)}
                  onDuplicate={handleDuplicate}
                  isFavourite={favouriteIds.includes(agent.id)}
                  onToggleFavourite={handleToggleFavourite}
                />
              ))}
            </ul>
          </div>
        )}
        {renderPagination(section)}
      </section>
    );
  };

  const list = (
    <div className="flex flex-col gap-6">
      {showError ? (
        // Item 3: inline error block in PageShell — with Retry, never blank.
        <EmptyState
          variant="error"
          title={t("errorLoading")}
          description={t("errorLoadingDescription")}
          action={{
            label: tCommon("retry"),
            onClick: () => {
              active.refetch();
              inactive.refetch();
            },
          }}
        />
      ) : showSkeleton ? (
        // Item 2: row-shaped skeletons mirroring the list (no card-grid pulse).
        <div aria-busy="true" className="rounded-md border">
          <ul className="divide-y divide-border">
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <li
                key={index}
                className="flex items-center gap-3 px-3 py-2 md:px-4"
              >
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="hidden h-3 w-24 md:block" />
                </div>
                <Skeleton className="hidden h-4 w-16 md:block" />
                <Skeleton className="size-8 rounded-md" />
              </li>
            ))}
          </ul>
        </div>
      ) : showEmpty ? (
        emptyState
      ) : (
        <>
          <AgentFavourites
            agents={favouriteRows}
            selectedId={selectedId}
            onSelect={(item) => setSelectedId(item.id)}
            onToggleFavourite={handleToggleFavourite}
          />
          {renderSection(active, "active")}
          {renderSection(inactive, "inactive")}
        </>
      )}
    </div>
  );

  const filterControls = (
    <>
      <Select
        value={status}
        onValueChange={(value) => setStatus(value as AgentStatusFilter)}
      >
        <SelectTrigger
          aria-label={t("filters.statusLabel")}
          className="w-full md:w-40"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filters.statusAll")}</SelectItem>
          <SelectItem value="active">{tCommon("active")}</SelectItem>
          <SelectItem value="inactive">{tCommon("inactive")}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={sortValueOf(sort)}
        onValueChange={(value) => setSort(SORT_OPTIONS[value as SortValue])}
      >
        <SelectTrigger
          aria-label={t("sort.label")}
          className="w-full md:w-44"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lastUpdated">{t("sort.lastUpdated")}</SelectItem>
          <SelectItem value="newest">{t("sort.newest")}</SelectItem>
          <SelectItem value="nameAsc">{t("sort.nameAsc")}</SelectItem>
          <SelectItem value="nameDesc">{t("sort.nameDesc")}</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <PageShell variant="content">
      {canWrite ? (
        <MobileTopbarAction>
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" className="mr-1 size-4" />
            {t("newAgent")}
          </Button>
        </MobileTopbarAction>
      ) : null}

      <PageHeader
        title={t("title")}
        description={t("pageDescription")}
        action={
          canWrite ? (
            // Item 5: the page's single purple action, write-gated.
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("newAgent")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4">
        <Toolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("searchPlaceholder"),
            // Item 4: the 300 ms debounce lives in useAgentsIndex — never
            // double-debounce the keystroke.
            debounceMs: 0,
          }}
          filters={filterControls}
          activeFilterCount={activeFilterCount}
          onResetFilters={() => {
            setStatus("all");
            setSort(DEFAULT_AGENTS_SORT);
          }}
        />

        <ListDetail<Agent>
          detailPresentation="sheet"
          items={allRows}
          selected={selected}
          onSelect={(item) => setSelectedId(item ? item.id : null)}
          detailTitle={(item) => item.name}
          detail={(item) => (
            <AgentDetailPanel agentId={item.id} canEdit={canWrite} />
          )}
          list={list}
        />
      </div>

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageShell>
  );
}
