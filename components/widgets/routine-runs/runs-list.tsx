"use client";

/**
 * RoutineRunsList — the runs-v2 list (email-triggered routines design
 * §7.2/§7.3): filter bar (state, trigger source, date range, text search,
 * needs-attention lens, show-filtered toggle) above expandable run rows with
 * Open session / Cancel / Retry actions.
 *
 * Lives in the widgets tier and is rendered twice inside the workflows
 * feature: the routines list page's runs console (app/(application)/
 * workflows, unscoped) and the per-routine Runs section
 * (app/(application)/workflows/[id], scoped via `workflow`).
 *
 * Assumes the Plan-1 `routineRuns` API exists.
 */

import { useMutation, useQuery } from "@apollo/client";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  ALL_RUN_STATES,
  buildRoutineRunsVariables,
  canCancelRun,
  canDeleteRun,
  canRetryRun,
  DEFAULT_RUNS_FILTER,
  filteredReason,
  formatCompactTokens,
  formatRunCost,
  formatRunDuration,
  KNOWN_FILTERED_REASONS,
  mapRunDot,
  partitionSelection,
  RUN_STATE_BADGE,
  RUN_TRIGGERS,
  runTitle,
  triggerBadge,
  type RunsFilterState,
} from "@/lib/routine-runs/presentation";
import {
  CANCEL_ROUTINE_RUN,
  DELETE_ROUTINE_RUN,
  RETRY_ROUTINE_RUN,
  ROUTINE_RUNS,
} from "@/lib/routine-runs/queries";
import type { RoutineRun, RoutineRunPage } from "@/lib/routine-runs/types";
import type { WorkStatusConfig } from "@/lib/routine-runs/work-status";
import { cn } from "@/lib/utils";

import { WorkStatusBadge } from "./work-status-badge";

export interface RoutineRunsListProps {
  /** Scope to one routine (per-routine Runs section). Omit = global page. */
  workflow?: string;
  /** Prefix each row with the routine name (global page only). */
  showRoutineColumn?: boolean;
  /** Start with the needs-attention lens on (global page default). */
  defaultNeedsAttention?: boolean;
  pageSize?: number;
  /**
   * The routine's work statuses (per-routine list only). With statuses the
   * list splits into an open and a done area and every row gets a status
   * badge; without, it is the single list it always was.
   */
  workStatuses?: WorkStatusConfig;
}

export function RoutineRunsList({
  workflow,
  showRoutineColumn = false,
  defaultNeedsAttention = false,
  pageSize = 20,
  workStatuses,
}: RoutineRunsListProps) {
  const t = useTranslations("routineRuns");

  const [filter, setFilter] = React.useState<RunsFilterState>({
    ...DEFAULT_RUNS_FILTER,
    needsAttention: defaultNeedsAttention,
  });
  const [searchInput, setSearchInput] = React.useState("");
  // "Done" is defined per routine, so the areas exist only in a list
  // scoped to one routine that has statuses.
  const statuses = workflow ? (workStatuses?.statuses ?? []) : [];
  const hasStatuses = statuses.length > 0;
  const [chosenStatuses, setStatusFilter] = React.useState<string[]>([]);
  // A status removed from the routine cannot stay in the filter.
  const statusKeys = statuses.map((status) => status.key).join(",");
  const statusFilter = React.useMemo(() => {
    const known = statusKeys.split(",");
    const kept = chosenStatuses.filter((key) => known.includes(key));
    return kept.length > 0 ? kept : NO_STATUS_FILTER;
  }, [chosenStatuses, statusKeys]);
  // Which statuses count as done decides which area a run is in.
  const doneSignature = statuses.filter((status) => status.done).map((status) => status.key).join(",");
  // A change in one area (a status moved, a run deleted) reloads the other.
  const [refresh, setRefresh] = React.useState<{ version: number; from: string }>({ version: 0, from: "" });

  // Debounced text search — 300 ms, resets to page 1 on change.
  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilter((f) =>
        f.search === searchInput.trim()
          ? f
          : { ...f, search: searchInput.trim(), page: 1 },
      );
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const patchFilter = (patch: Partial<RunsFilterState>) =>
    setFilter((f) => ({ ...f, ...patch, page: 1 }));

  const stateLabel = (state: string) =>
    (ALL_RUN_STATES as readonly string[]).includes(state)
      ? t(`state.${state}`)
      : state;

  return (
    <div className="space-y-3">
      {/* Filter bar (design §7.2: state, trigger source, date range, search) */}
      {/* The demo tour anchors here rather than on the wrapper above. That
          wrapper grows to roughly 1200px once the runs load, and a popover
          placed against a block that tall is off-screen whichever way it
          resolves: "bottom" sits below the section's bottom edge, and
          floating-ui's flip then puts it above the section's top edge. The
          filter bar is a fixed-height row at the top of the same section, so
          it scrolls into view with the runs visible underneath it. */}
      <div
        className="flex flex-wrap items-center gap-2"
        data-demo-id="routine-runs"
      >
        <Select
          value={filter.state}
          onValueChange={(value) => patchFilter({ state: value })}
        >
          <SelectTrigger className="w-44" aria-label={t("filters.state")}>
            <SelectValue placeholder={t("filters.allStates")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStates")}</SelectItem>
            {ALL_RUN_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {stateLabel(state)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.trigger}
          onValueChange={(value) => patchFilter({ trigger: value })}
        >
          <SelectTrigger className="w-36" aria-label={t("filters.trigger")}>
            <SelectValue placeholder={t("filters.allTriggers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allTriggers")}</SelectItem>
            {RUN_TRIGGERS.map((trigger) => (
              <SelectItem key={trigger} value={trigger}>
                {t(`trigger.${trigger}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasStatuses ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label={t("workStatus.filter")}>
                {t("workStatus.filter")}
                {statusFilter.length > 0 ? ` (${statusFilter.length})` : ""}
                <ChevronDown aria-hidden className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {statuses.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status.key}
                  checked={statusFilter.includes(status.key)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    setStatusFilter((prev) =>
                      checked ? [...prev, status.key] : prev.filter((key) => key !== status.key),
                    )
                  }
                >
                  {status.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <Input
          type="datetime-local"
          className="w-fit"
          value={filter.from ?? ""}
          onChange={(e) => patchFilter({ from: e.target.value || undefined })}
          aria-label={t("filters.from")}
        />
        <Input
          type="datetime-local"
          className="w-fit"
          value={filter.to ?? ""}
          onChange={(e) => patchFilter({ to: e.target.value || undefined })}
          aria-label={t("filters.to")}
        />

        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("filters.searchPlaceholder")}
          className="w-48"
          aria-label={t("filters.searchPlaceholder")}
        />

        <div className="flex items-center gap-2">
          <Switch
            id="needs-attention-filter"
            checked={filter.needsAttention}
            onCheckedChange={(checked) =>
              patchFilter({ needsAttention: checked })
            }
          />
          <Label
            htmlFor="needs-attention-filter"
            className="text-xs text-muted-foreground"
          >
            {t("filters.needsAttention")}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="show-filtered-runs"
            checked={filter.showFiltered}
            onCheckedChange={(checked) =>
              patchFilter({ showFiltered: checked })
            }
            disabled={filter.state !== "all"}
          />
          <Label
            htmlFor="show-filtered-runs"
            className="text-xs text-muted-foreground"
          >
            {t("filters.showFiltered")}
          </Label>
        </div>
      </div>

      {(hasStatuses ? (["open", "done"] as const) : ([undefined] as const)).map((area) => (
        <RunsArea
          key={area ?? "all"}
          area={area}
          filter={filter}
          statusFilter={hasStatuses ? statusFilter : NO_STATUS_FILTER}
          workflow={workflow}
          workStatuses={hasStatuses ? workStatuses : undefined}
          showRoutineColumn={showRoutineColumn}
          pageSize={pageSize}
          refresh={refresh}
          doneSignature={doneSignature}
          onMutated={(from) => setRefresh((r) => ({ version: r.version + 1, from }))}
          stateLabel={stateLabel}
          t={t}
        />
      ))}
    </div>
  );
}

const NO_STATUS_FILTER: string[] = [];

interface RunsAreaProps {
  /** "open" / "done" when the routine has work statuses; undefined = the single list. */
  area?: "open" | "done";
  filter: RunsFilterState;
  statusFilter: string[];
  workflow?: string;
  workStatuses?: WorkStatusConfig;
  showRoutineColumn: boolean;
  pageSize: number;
  refresh: { version: number; from: string };
  /** Changes when the routine's done statuses change: the areas reload. */
  doneSignature: string;
  onMutated: (from: string) => void;
  stateLabel: (state: string) => string;
  t: ReturnType<typeof useTranslations>;
}

/**
 * One list of runs with its own query, page, selection and dialogs. The
 * filter bar above is shared; with work statuses there are two of these
 * (open, done), each under a heading that carries its count.
 */
function RunsArea({
  area,
  filter,
  statusFilter,
  workflow,
  workStatuses,
  showRoutineColumn,
  pageSize,
  refresh,
  doneSignature,
  onMutated,
  stateLabel,
  t,
}: RunsAreaProps) {
  const areaKey = area ?? "all";
  // Done work is out of the way until someone looks for it.
  const [collapsed, setCollapsed] = React.useState(area === "done");
  // The page belongs to the area; any filter change starts again at page 1.
  const filterKey = JSON.stringify({ filter, statusFilter });
  const [pageState, setPageState] = React.useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });
  const variables = {
    ...buildRoutineRunsVariables({ ...filter, page }, { workflow, limit: pageSize }),
    ...(area ? { workStatusOpen: area === "open" } : {}),
    ...(statusFilter.length > 0 ? { workStatuses: statusFilter } : {}),
  };

  // `?run=<id>` opens that row on load — a deep link for a notification or a
  // guided walk. Read once; the user's clicks own the state afterwards.
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = React.useState<string | null>(
    () => searchParams?.get("run") ?? null,
  );
  // The param can change while the list stays mounted (a client-side
  // navigation to the same page with a different `run`): follow it.
  const runParam = searchParams?.get("run") ?? null;
  React.useEffect(() => {
    if (runParam) setExpandedId(runParam);
  }, [runParam]);
  const [showRawById, setShowRawById] = React.useState<Record<string, boolean>>(
    {},
  );
  const [cancelTarget, setCancelTarget] = React.useState<RoutineRun | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<RoutineRun | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const { data, loading, refetch } = useQuery<{
    routineRuns?: RoutineRunPage;
  }>(ROUTINE_RUNS, {
    variables,
    fetchPolicy: "cache-and-network",
  });

  const [cancelMutate] = useMutation(CANCEL_ROUTINE_RUN);
  const [deleteMutate] = useMutation(DELETE_ROUTINE_RUN);
  const [retryMutate, retryState] = useMutation(RETRY_ROUTINE_RUN);

  const runs = data?.routineRuns?.items ?? [];
  const total = data?.routineRuns?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const reload = async () => {
    await refetch();
    onMutated(areaKey);
  };
  const { version: refreshVersion, from: refreshFrom } = refresh;
  React.useEffect(() => {
    if (refreshVersion > 0 && refreshFrom !== areaKey) void refetch();
  }, [refreshVersion, refreshFrom, areaKey, refetch]);
  const loadedSignature = React.useRef(doneSignature);
  React.useEffect(() => {
    if (loadedSignature.current === doneSignature) return;
    loadedSignature.current = doneSignature;
    void refetch();
  }, [doneSignature, refetch]);
  // The last run of a page left it (set to done, deleted): show the page
  // before instead of an empty list under a count that says there are runs.
  const loadedPage = data?.routineRuns ? page : null;
  React.useEffect(() => {
    if (loadedPage !== null && !loading && runs.length === 0 && loadedPage > pageCount) {
      setPage(pageCount);
    }
    // setPage is recreated every render; the values above decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPage, loading, runs.length, pageCount]);
  // A deep-linked run that sits in the collapsed area opens that area.
  const linkedRunHere = !!runParam && runs.some((r) => r.id === runParam);
  React.useEffect(() => {
    if (linkedRunHere) setCollapsed(false);
  }, [linkedRunHere]);


  const { cancellable, deletable } = partitionSelection(runs, selectedIds);
  const selectedCount = runs.filter((r) => selectedIds.has(r.id)).length;
  const allSelected = runs.length > 0 && selectedCount === runs.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleSelectAll = (checked: boolean) =>
    setSelectedIds(checked ? new Set(runs.map((r) => r.id)) : new Set());

  const [bulkConfirm, setBulkConfirm] = React.useState<
    "cancel" | "delete" | null
  >(null);

  const runBulk = async () => {
    if (!bulkConfirm) return;
    const ids = bulkConfirm === "cancel" ? cancellable : deletable;
    const mutate = bulkConfirm === "cancel" ? cancelMutate : deleteMutate;
    const results = await Promise.allSettled(
      ids.map((id) => mutate({ variables: { id } })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (failed === 0) {
      toast.success(
        t(bulkConfirm === "cancel" ? "bulk.toast.cancelled" : "bulk.toast.deleted", {
          count: ok,
        }),
      );
    } else {
      toast.error(t("bulk.toast.partial", { ok, failed }));
    }
    setBulkConfirm(null);
    setSelectedIds(new Set());
    await reload();
  };

  const selectionResetKey = JSON.stringify({ filterKey, page, workflow, pageSize });
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [selectionResetKey]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutate({ variables: { id: cancelTarget.id } });
      toast.success(t("toast.cancelled"));
      await reload();
    } catch (err) {
      toast.error(t("toast.cancelFailed"), {
        description: (err as Error).message,
      });
      throw err; // keep ConfirmDialog open
    }
  };

  const handleRetry = async (run: RoutineRun) => {
    try {
      await retryMutate({ variables: { id: run.id } });
      toast.success(t("toast.retried"));
      await reload();
    } catch (err) {
      toast.error(t("toast.retryFailed"), {
        description: (err as Error).message,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutate({ variables: { id: deleteTarget.id } });
      toast.success(t("toast.deleted"));
      await reload();
    } catch (err) {
      toast.error(t("toast.deleteFailed"), {
        description: (err as Error).message,
      });
      throw err; // keep ConfirmDialog open
    }
  };

  return (
    <div className="space-y-3">
      {area ? (
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="flex items-center gap-1.5 rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            aria-hidden
            className={cn("size-4 text-muted-foreground transition-transform", collapsed && "-rotate-90")}
          />
          {data?.routineRuns
            ? `${t(`workStatus.areas.${area}`)} (${total})`
            : t(`workStatus.areas.${area}`)}
        </button>
      ) : null}
      {collapsed ? null : (
        <>
      {runs.length > 0 ? (
        <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(checked) => toggleSelectAll(checked === true)}
            aria-label={t("bulk.selectAll")}
          />
          {selectedCount > 0 ? (
            <>
              <span className="text-muted-foreground">
                {t("bulk.selected", { count: selectedCount })}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancellable.length === 0}
                  onClick={() => setBulkConfirm("cancel")}
                >
                  {t("bulk.cancel", { count: cancellable.length })}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletable.length === 0}
                  onClick={() => setBulkConfirm("delete")}
                >
                  {t("bulk.delete", { count: deletable.length })}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  {t("bulk.clear")}
                </Button>
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">{t("bulk.selectAll")}</span>
          )}
        </div>
      ) : null}

      {/* List */}
      {loading && runs.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-14 w-full" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          variant="quiet"
          icon={Info}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              showRoutineColumn={showRoutineColumn}
              expanded={expandedId === run.id}
              onToggle={() =>
                setExpandedId((id) => (id === run.id ? null : run.id))
              }
              showRaw={!!showRawById[run.id]}
              onToggleRaw={() =>
                setShowRawById((m) => ({ ...m, [run.id]: !m[run.id] }))
              }
              onCancel={() => setCancelTarget(run)}
              onDelete={() => setDeleteTarget(run)}
              onRetry={() => handleRetry(run)}
              retrying={retryState.loading}
              stateLabel={stateLabel}
              t={t}
              selected={selectedIds.has(run.id)}
              onSelectChange={(checked) => toggleSelected(run.id, checked)}
              workStatuses={workStatuses}
              onStatusChanged={() => void reload()}
            />
          ))}
        </ul>
      )}

      {/* Pagination (routineRuns returns items + total, pages are 1-based) */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>
            {t("pagination", { page, pages: pageCount })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("previousPage")}
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("nextPage")}
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t("cancelConfirm.title")}
        description={t("cancelConfirm.description")}
        variant="destructive"
        confirmLabel={t("cancelConfirm.confirmLabel")}
        onConfirm={handleConfirmCancel}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteConfirm.title")}
        description={t("deleteConfirm.description")}
        variant="destructive"
        confirmLabel={t("deleteConfirm.confirmLabel")}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={bulkConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setBulkConfirm(null);
        }}
        title={
          bulkConfirm === "delete"
            ? t("bulk.deleteConfirm.title", { count: deletable.length })
            : t("bulk.cancelConfirm.title", { count: cancellable.length })
        }
        description={
          bulkConfirm === "delete"
            ? t("bulk.deleteConfirm.description")
            : t("bulk.cancelConfirm.description")
        }
        variant="destructive"
        confirmLabel={
          bulkConfirm === "delete"
            ? t("bulk.deleteConfirm.confirmLabel")
            : t("bulk.cancelConfirm.confirmLabel")
        }
        onConfirm={runBulk}
      />
        </>
      )}
    </div>
  );
}

interface RunRowProps {
  run: RoutineRun;
  showRoutineColumn: boolean;
  expanded: boolean;
  onToggle: () => void;
  showRaw: boolean;
  onToggleRaw: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRetry: () => void;
  retrying: boolean;
  stateLabel: (state: string) => string;
  t: ReturnType<typeof useTranslations>;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  workStatuses?: WorkStatusConfig;
  onStatusChanged?: () => void;
}

function RunRow({
  run,
  showRoutineColumn,
  expanded,
  onToggle,
  showRaw,
  onToggleRaw,
  onCancel,
  onDelete,
  onRetry,
  retrying,
  stateLabel,
  t,
  selected,
  onSelectChange,
  workStatuses,
  onStatusChanged,
}: RunRowProps) {
  const mapped = mapRunDot(run.state);
  const badge = triggerBadge(run);
  const title = runTitle(run);
  const duration = formatRunDuration(run.createdAt, run.updatedAt, run.state);
  const reason = filteredReason(run);
  const reasonLabel = reason
    ? (KNOWN_FILTERED_REASONS as readonly string[]).includes(reason)
      ? t(`filteredReason.${reason}`)
      : reason
    : null;
  const errorText = run.error
    ? typeof run.error === "string"
      ? run.error
      : JSON.stringify(run.error)
    : null;

  const triggerLabel =
    badge.key === "none"
      ? t("trigger.none")
      : badge.detail
        ? `${t(`trigger.${badge.key}`)} · ${badge.detail}`
        : t(`trigger.${badge.key}`);

  return (
    <li className={cn(run.state === "filtered" && "opacity-60")}>
      <div
        className={cn(
          "grid items-center gap-3 px-3",
          // The status badge has its own menu, so it sits beside the row's
          // toggle button, not inside it.
          workStatuses ? "grid-cols-[auto_200px_1fr]" : "grid-cols-[auto_1fr]",
          expanded && "bg-muted/30",
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectChange(checked === true)}
          aria-label={t("bulk.selectRow")}
        />
        {workStatuses ? (
          <WorkStatusBadge run={run} config={workStatuses} onChanged={onStatusChanged} />
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="grid min-h-11 grid-cols-[auto_150px_190px_minmax(0,1fr)_auto_auto_auto_auto_auto] items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <StatusDot status={mapped.status} pulse={mapped.pulse} />
          <Badge
            variant="outline"
            className={cn("justify-self-start", RUN_STATE_BADGE[run.state] ?? "")}
          >
            {stateLabel(run.state)}
          </Badge>
          <Badge
            variant="outline"
            className="max-w-full justify-self-start truncate font-normal text-muted-foreground"
          >
            {triggerLabel}
          </Badge>
          <span className="hidden min-w-0 truncate text-sm sm:block">
            {showRoutineColumn && run.workflowName ? (
              <span className="text-muted-foreground">
                {run.workflowName}
                {title !== "" && title !== run.workflowName ? " — " : ""}
              </span>
            ) : null}
            {title !== run.workflowName || !showRoutineColumn ? title : null}
          </span>
          {run.createdAt ? (
            <RelativeTime
              date={run.createdAt}
              className="shrink-0 text-xs text-muted-foreground"
            />
          ) : (
            <span />
          )}
          {duration ? (
            <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground md:block">
              {duration}
            </span>
          ) : (
            <span className="hidden md:block" />
          )}
          <span
            className="hidden shrink-0 text-xs tabular-nums text-muted-foreground lg:block"
            aria-label={`${t("row.tokensIn")}: ${run.inputTokens ?? "—"}, ${t("row.tokensOut")}: ${run.outputTokens ?? "—"}`}
          >
            {"↑"}{formatCompactTokens(run.inputTokens)}{" ↓"}{formatCompactTokens(run.outputTokens)}
          </span>
          <span
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
            title={t("row.costTooltip")}
            aria-label={`${t("row.cost")}: ${formatRunCost(run.costUsd)}`}
          >
            {formatRunCost(run.costUsd)}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t bg-muted/10 px-3 py-3" data-demo-id="routine-run-open">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {run.trigger_metadata?.from ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.from")}
                </dt>
                <dd className="min-w-0 break-all">
                  {run.trigger_metadata.from}
                </dd>
              </>
            ) : null}
            {run.trigger_metadata?.subject ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.subject")}
                </dt>
                <dd className="min-w-0 break-all">
                  {run.trigger_metadata.subject}
                </dd>
              </>
            ) : null}
            {run.trigger_metadata?.message_id ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.messageId")}
                </dt>
                <dd className="min-w-0 break-all font-mono">
                  {run.trigger_metadata.message_id}
                </dd>
              </>
            ) : null}
            {run.trigger_metadata?.cron ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.cron")}
                </dt>
                <dd className="font-mono">{run.trigger_metadata.cron}</dd>
              </>
            ) : null}
            {reasonLabel ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.filteredReason")}
                </dt>
                <dd>{reasonLabel}</dd>
              </>
            ) : null}
            {run.trigger_metadata?.failed_rule ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.failedRule")}
                </dt>
                <dd className="min-w-0 break-all font-mono">
                  {run.trigger_metadata.failed_rule}
                </dd>
              </>
            ) : null}
            {typeof run.tries === "number" && run.tries > 0 ? (
              <>
                <dt className="font-medium text-muted-foreground">
                  {t("row.tries")}
                </dt>
                <dd className="tabular-nums">{run.tries}</dd>
              </>
            ) : null}
          </dl>

          {errorText ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertCircle aria-hidden="true" className="size-4" />
                {t("row.errorHeading")}
              </p>
              <p className="break-all text-xs text-destructive">{errorText}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {run.session && run.agent ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/chat/${run.agent}/${run.session}`}>
                  {t("row.openSession")}
                </Link>
              </Button>
            ) : null}
            {canCancelRun(run.state) ? (
              <Button variant="outline" size="sm" onClick={onCancel}>
                {t("row.cancel")}
              </Button>
            ) : null}
            {canRetryRun(run.state) ? (
              <Button
                variant="outline"
                size="sm"
                disabled={retrying}
                onClick={onRetry}
              >
                {t("row.retry")}
              </Button>
            ) : null}
            {canDeleteRun(run.state) ? (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                {t("row.delete")}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleRaw}
              className="-ml-2"
            >
              {showRaw ? t("row.hideRaw") : t("row.showRaw")}
            </Button>
          </div>

          {showRaw ? (
            <pre className="max-h-64 overflow-auto rounded-md border bg-background p-3 font-mono text-xs">
              {JSON.stringify(run, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
