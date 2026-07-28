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
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  formatRunDuration,
  KNOWN_FILTERED_REASONS,
  mapRunDot,
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
import { cn } from "@/lib/utils";

export interface RoutineRunsListProps {
  /** Scope to one routine (per-routine Runs section). Omit = global page. */
  workflow?: string;
  /** Prefix each row with the routine name (global page only). */
  showRoutineColumn?: boolean;
  /** Start with the needs-attention lens on (global page default). */
  defaultNeedsAttention?: boolean;
  pageSize?: number;
}

export function RoutineRunsList({
  workflow,
  showRoutineColumn = false,
  defaultNeedsAttention = false,
  pageSize = 20,
}: RoutineRunsListProps) {
  const t = useTranslations("routineRuns");

  const [filter, setFilter] = React.useState<RunsFilterState>({
    ...DEFAULT_RUNS_FILTER,
    needsAttention: defaultNeedsAttention,
  });
  const [searchInput, setSearchInput] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showRawById, setShowRawById] = React.useState<Record<string, boolean>>(
    {},
  );
  const [cancelTarget, setCancelTarget] = React.useState<RoutineRun | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<RoutineRun | null>(
    null,
  );

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

  const { data, loading, refetch } = useQuery<{
    routineRuns?: RoutineRunPage;
  }>(ROUTINE_RUNS, {
    variables: buildRoutineRunsVariables(filter, { workflow, limit: pageSize }),
    fetchPolicy: "cache-and-network",
  });

  const [cancelMutate] = useMutation(CANCEL_ROUTINE_RUN);
  const [deleteMutate] = useMutation(DELETE_ROUTINE_RUN);
  const [retryMutate, retryState] = useMutation(RETRY_ROUTINE_RUN);

  const runs = data?.routineRuns?.items ?? [];
  const total = data?.routineRuns?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const patchFilter = (patch: Partial<RunsFilterState>) =>
    setFilter((f) => ({ ...f, ...patch, page: 1 }));

  const stateLabel = (state: string) =>
    (ALL_RUN_STATES as readonly string[]).includes(state)
      ? t(`state.${state}`)
      : state;

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutate({ variables: { id: cancelTarget.id } });
      toast.success(t("toast.cancelled"));
      await refetch();
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
      await refetch();
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
      await refetch();
    } catch (err) {
      toast.error(t("toast.deleteFailed"), {
        description: (err as Error).message,
      });
      throw err; // keep ConfirmDialog open
    }
  };

  return (
    <div className="space-y-3">
      {/* Filter bar (design §7.2: state, trigger source, date range, search) */}
      <div className="flex flex-wrap items-center gap-2">
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

        <Button
          type="button"
          size="sm"
          variant={filter.needsAttention ? "default" : "outline"}
          aria-pressed={filter.needsAttention}
          onClick={() =>
            patchFilter({ needsAttention: !filter.needsAttention })
          }
        >
          {t("filters.needsAttention")}
        </Button>

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
            />
          ))}
        </ul>
      )}

      {/* Pagination (routineRuns returns items + total, pages are 1-based) */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>
            {t("pagination", { page: filter.page, pages: pageCount })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("previousPage")}
            disabled={filter.page <= 1}
            onClick={() => setFilter((f) => ({ ...f, page: f.page - 1 }))}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("nextPage")}
            disabled={filter.page >= pageCount}
            onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}
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
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex w-full min-h-11 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
          expanded && "bg-muted/30",
        )}
      >
        <StatusDot status={mapped.status} pulse={mapped.pulse} />
        <Badge
          variant="outline"
          className={cn(RUN_STATE_BADGE[run.state] ?? "")}
        >
          {stateLabel(run.state)}
        </Badge>
        <Badge
          variant="outline"
          className="max-w-44 truncate font-normal text-muted-foreground"
        >
          {triggerLabel}
        </Badge>
        <span className="hidden min-w-0 flex-1 truncate text-sm sm:inline">
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
            className="ml-auto shrink-0 text-xs text-muted-foreground sm:ml-0"
          />
        ) : null}
        {duration ? (
          <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground md:inline">
            {duration}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t bg-muted/10 px-3 py-3">
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
