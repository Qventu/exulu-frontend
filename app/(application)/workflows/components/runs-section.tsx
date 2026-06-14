"use client";

/**
 * RunsSection — DetailSection hosting a route-local RunInspector for routine
 * run history (workflows.md ladder items 20, 21).
 *
 * Lists last 50 runs (GET_JOB_RESULTS_LIGHT, fetched on tab open, no poll).
 * Selecting a row swaps the body to the run detail (GET_JOB_RESULT_BY_ID):
 * state Badge (token-only tints), absolute + relative timestamps, Error
 * block, Metadata table, and a Raw disclosure (CodeBlock + copy) for the
 * full result/error payload.
 *
 * Mobile: stacks vertically with a back chevron (panel navigation, NOT
 * nested dialog). The routine-panel already lives in a Sheet at <lg.
 */

import { useQuery } from "@apollo/client";
import { format } from "date-fns";
import { AlertCircle, ChevronLeft, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";
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

import { GET_JOB_RESULTS_LIGHT, GET_JOB_RESULT_BY_ID } from "../queries";
import type { Routine } from "../types";

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

export interface RunsSectionProps {
  routine: Routine;
}

export function RunsSection({ routine }: RunsSectionProps) {
  const t = useTranslations("routines");
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [showRaw, setShowRaw] = React.useState(false);

  const { data: listData, loading: listLoading } = useQuery<{
    job_resultsPagination?: {
      items?: Array<{
        id: string;
        state: string;
        label?: string;
        createdAt: string;
      }>;
    };
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

  // Auto-select newest on first load.
  React.useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const { data: detailData, loading: detailLoading } = useQuery<{
    job_resultById?: {
      id: string;
      state: string;
      error?: unknown;
      result?: unknown;
      metadata?: Record<string, unknown> | null;
      createdAt: string;
    };
  }>(GET_JOB_RESULT_BY_ID, {
    variables: { id: selectedRunId ?? "" },
    skip: !selectedRunId,
    fetchPolicy: "cache-first",
  });

  const detail = detailData?.job_resultById;

  return (
    <DetailSection
      title={t("runs.title")}
      defaultOpen={true}
      meta={listLoading ? undefined : t("runs.count", { count: runs.length })}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Run list — hidden on mobile when a run is selected */}
        <div
          className={cn(
            "flex flex-col gap-1 lg:w-64 lg:shrink-0",
            selectedRunId && "hidden lg:flex",
          )}
        >
          {listLoading && runs.length === 0 ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))
          ) : runs.length === 0 ? (
            <EmptyState
              variant="quiet"
              icon={Info}
              title={t("runs.emptyTitle")}
              description={t("runs.emptyDescription")}
            />
          ) : (
            <ul className="space-y-1">
              {runs.map((run) => {
                const isSelected = run.id === selectedRunId;
                const mapped = mapDot(run.state);
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setShowRaw(false);
                      }}
                      className={cn(
                        "min-h-11 w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:bg-muted/50",
                        isSelected && "border-border bg-muted",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <StatusDot status={mapped.status} pulse={mapped.pulse} />
                        <span className="text-xs font-medium capitalize">
                          {run.state}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        <RelativeTime date={run.createdAt} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Run detail */}
        <div
          className={cn(
            "min-w-0 flex-1",
            !selectedRunId && "hidden lg:block",
          )}
        >
          {selectedRunId ? (
            <div className="space-y-4">
              {/* Mobile back chevron */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRunId(null)}
                className="-ml-2 lg:hidden"
              >
                <ChevronLeft aria-hidden="true" className="mr-1 size-4" />
                {t("runs.backToList")}
              </Button>

              {detailLoading && !detail ? (
                <Skeleton className="h-24 w-full" />
              ) : detail ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        STATE_BADGE[detail.state] ?? "",
                      )}
                    >
                      {detail.state}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(detail.createdAt), "PPpp")}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <RelativeTime date={detail.createdAt} className="text-xs" />
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
                      <h4 className="text-sm font-medium">
                        {t("runs.metadataHeading")}
                      </h4>
                      <div className="overflow-hidden rounded-md border">
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

                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRaw((v) => !v)}
                    >
                      {showRaw ? t("runs.hideRaw") : t("runs.showRaw")}
                    </Button>
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
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <EmptyState
              variant="quiet"
              icon={Info}
              title={t("runs.selectPrompt")}
            />
          )}
        </div>
      </div>
    </DetailSection>
  );
}
