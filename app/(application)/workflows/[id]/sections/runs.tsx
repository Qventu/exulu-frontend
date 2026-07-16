"use client";

/**
 * RunsSection — flat list of recent runs that expand IN PLACE.
 *
 * Wrapper for the /workflows/[id] workbench. The body (RunRow + listing
 * behaviour + lazy detail fetch) is COPIED BYTE-FOR-BYTE from the deleted
 * /workflows/components/runs-section.tsx — the 2026-06-14 flat-list inline-
 * disclosure pattern is the keeper and MUST NOT drift.
 *
 * Wrapper additions over the panel version:
 * - <section id="runs" className="scroll-mt-20" tabIndex={-1}> for useScrollSpy
 *   and SectionNav's scrollIntoView+focus contract.
 * - Optional onRetry prop — the workbench passes a handler that opens the
 *   RunRoutineDialog pre-filled with the row's last variables (where
 *   available). The base behaviour (collapse / expand / lazy fetch) is
 *   unaffected when onRetry is omitted.
 *
 * Original pattern: each run is a row showing summary inline (state badge +
 * timestamps + duration if available + a one-line error preview when failed);
 * clicking a row toggles an inline disclosure with the full error block,
 * metadata table, and a Raw JSON toggle. At most one run is expanded at a
 * time. No second navigation altitude.
 *
 * Detail data is fetched lazily on first expand (GET_JOB_RESULT_BY_ID,
 * cache-first); the row stays mounted so re-collapse is instant.
 *
 * Lists last 50 runs (GET_JOB_RESULTS_LIGHT, fetched on tab open, no poll).
 */

import { useQuery } from "@apollo/client";
import { format } from "date-fns";
import { AlertCircle, ChevronDown, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { TextPreview } from "@/components/custom/text-preview";
import { DetailSection } from "@/components/primitives/detail-section";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { RoutineRunsList } from "@/components/widgets/routine-runs/runs-list";

import { GET_JOB_RESULTS_LIGHT, GET_JOB_RESULT_BY_ID } from "../../queries";
import { ROUTINES_RUNS_V2_SUPPORTED } from "../../schema-flags";
import type { Routine } from "../../types";

type RunListItem = {
  id: string;
  state: string;
  label?: string;
  createdAt: string;
};

type RunDetailShape = {
  id: string;
  state: string;
  error?: unknown;
  result?: unknown;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

const STATE_BADGE: Record<string, string> = {
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  stuck: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-info/15 text-info border-info/30",
  waiting: "bg-info/15 text-info border-info/30",
  delayed: "bg-warning/15 text-warning border-warning/30",
  paused: "bg-muted text-muted-foreground border-border",
};

function mapDot(state?: string): {
  status: "success" | "warning" | "error" | "info" | "muted";
  pulse: boolean;
} {
  switch (state) {
    case "completed":
      return { status: "success", pulse: false };
    case "failed":
    case "stuck":
      return { status: "error", pulse: false };
    case "active":
      return { status: "info", pulse: true };
    case "waiting":
    case "delayed":
    case "paused":
      return { status: "info", pulse: false };
    default:
      return { status: "muted", pulse: false };
  }
}

function previewError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return null;
  }
}

export interface RunsSectionProps {
  routine: Routine;
  /** Subpage hosts the run dialog → row "Retry" calls back here (legacy path only). */
  onRetry?: (prefill: Record<string, string>) => void;
}

/**
 * Flag dispatcher (design §7.2): runs-v2 renders the shared RoutineRunsList
 * widget scoped to this routine (real `workflow` column filter, trigger
 * badges, needs-attention, cancel/retry/open-session). Fallback keeps the
 * byte-for-byte legacy list below. Two components — never conditional hooks.
 */
export function RunsSection(props: RunsSectionProps) {
  if (ROUTINES_RUNS_V2_SUPPORTED) {
    return <RunsSectionV2 routine={props.routine} />;
  }
  return <LegacyRunsSection {...props} />;
}

function RunsSectionV2({ routine }: { routine: Routine }) {
  const t = useTranslations("routines");
  return (
    <section id="runs" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection title={t("runs.title")} defaultOpen={true}>
        <RoutineRunsList workflow={routine.id} />
      </DetailSection>
    </section>
  );
}

function LegacyRunsSection({ routine, onRetry }: RunsSectionProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showRawById, setShowRawById] = React.useState<Record<string, boolean>>(
    {},
  );

  const { data: listData, loading: listLoading } = useQuery<{
    job_resultsPagination?: { items?: RunListItem[] };
  }>(GET_JOB_RESULTS_LIGHT, {
    variables: {
      page: 1,
      limit: 50,
      filters: [{ label: { contains: routine.id } }],
      sort: { field: "createdAt", direction: "DESC" },
    },
    fetchPolicy: "cache-and-network",
  });

  const runs = listData?.job_resultsPagination?.items ?? [];

  return (
    <section id="runs" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection
        title={t("runs.title")}
        defaultOpen={true}
        meta={listLoading ? undefined : t("runs.count", { count: runs.length })}
      >
        {listLoading && runs.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-14 w-full" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            variant="quiet"
            icon={Info}
            title={t("runs.emptyTitle")}
            description={t("runs.emptyDescription")}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                expanded={expandedId === run.id}
                onToggle={() =>
                  setExpandedId((id) => (id === run.id ? null : run.id))
                }
                showRaw={!!showRawById[run.id]}
                onToggleRaw={() =>
                  setShowRawById((m) => ({ ...m, [run.id]: !m[run.id] }))
                }
                onRetry={onRetry}
                t={t}
                tCommon={tCommon}
              />
            ))}
          </ul>
        )}
      </DetailSection>
    </section>
  );
}

interface RunRowProps {
  run: RunListItem;
  expanded: boolean;
  onToggle: () => void;
  showRaw: boolean;
  onToggleRaw: () => void;
  onRetry?: (prefill: Record<string, string>) => void;
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}

function RunRow({
  run,
  expanded,
  onToggle,
  showRaw,
  onToggleRaw,
  onRetry,
  t,
  tCommon,
}: RunRowProps) {
  // Lazy-load detail only when the row is first expanded; the row stays
  // mounted after collapse so re-expand is instant.
  const [hasExpanded, setHasExpanded] = React.useState(false);
  React.useEffect(() => {
    if (expanded) setHasExpanded(true);
  }, [expanded]);

  const { data: detailData, loading: detailLoading } = useQuery<{
    job_resultById?: RunDetailShape;
  }>(GET_JOB_RESULT_BY_ID, {
    variables: { id: run.id },
    skip: !hasExpanded,
    fetchPolicy: "cache-first",
  });

  const detail = detailData?.job_resultById;
  const mapped = mapDot(run.state);
  const errorPreview = previewError(detail?.error);

  // Build retry prefill from the run's metadata.inputs (mirrors the queue
  // panel's retry behaviour). When metadata is missing or inputs aren't
  // present, the retry button still opens the dialog (empty prefill).
  const handleRetry = onRetry
    ? () => {
        const inputs =
          (
            detail?.metadata as
              | { inputs?: Record<string, string> }
              | null
              | undefined
          )?.inputs ?? {};
        onRetry(inputs);
      }
    : undefined;

  return (
    <li>
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
          className={cn("capitalize", STATE_BADGE[run.state] ?? "")}
        >
          {run.state}
        </Badge>
        <RelativeTime
          date={run.createdAt}
          className="text-xs text-muted-foreground"
        />
        {errorPreview && !expanded ? (
          <span className="ml-2 hidden min-w-0 flex-1 truncate text-xs text-destructive sm:inline">
            {errorPreview}
          </span>
        ) : (
          <span aria-hidden className="ml-2 hidden flex-1 sm:inline" />
        )}
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
          {detailLoading && !detail ? (
            <Skeleton className="h-20 w-full" />
          ) : detail ? (
            <>
              <div className="text-xs text-muted-foreground">
                {format(new Date(detail.createdAt), "PPpp")}
              </div>

              {detail.error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertCircle aria-hidden="true" className="size-4" />
                    {t("runs.errorHeading")}
                  </p>
                  <p className="text-xs text-destructive">
                    {typeof detail.error === "string"
                      ? detail.error
                      : JSON.stringify(detail.error)}
                  </p>
                </div>
              ) : null}

              {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("runs.metadataHeading")}
                  </h4>
                  <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/3">
                            {t("runs.metadataKey")}
                          </TableHead>
                          <TableHead>{t("runs.metadataValue")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(detail.metadata).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="font-medium">{key}</TableCell>
                            <TableCell>
                              <TextPreview
                                text={
                                  typeof value === "object"
                                    ? JSON.stringify(value, null, 2)
                                    : String(value)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleRaw}
                  className="-ml-2"
                >
                  {showRaw ? t("runs.hideRaw") : t("runs.showRaw")}
                </Button>
                {handleRetry ? (
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    {t("runs.retry")}
                  </Button>
                ) : null}
              </div>
              {showRaw ? (
                <CodeBlock
                  language="json"
                  code={JSON.stringify(
                    {
                      result: detail.result,
                      error: detail.error,
                      metadata: detail.metadata,
                    },
                    null,
                    2,
                  )}
                >
                  <CodeBlockCopyButton />
                </CodeBlock>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {tCommon("somethingWentWrong")}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
