"use client";

/**
 * EvalRunColumn — one column of the runs matrix.
 *
 * Phase 5.1 redesign:
 * - The five outline icon buttons (refresh / copy / edit / start / delete)
 *   collapsed into a SINGLE MoreVertical dropdown in the column header.
 *   Refresh is always visible; Start / Copy / Edit / Delete are gated on
 *   `canWrite` (RBAC leak fix — the original component took the
 *   convenience-by-default approach and showed Delete to readers).
 * - The lane component owns its own GET_JOB_RESULTS query so adding /
 *   removing visible runs doesn't violate Rules-of-Hooks in the parent.
 * - Score colors are semantic tokens via <ScoreCell />.
 * - Average math: only completed numeric results contribute; never NaN.
 *   When there are no completed results we surface the i18n "No results
 *   yet" copy in muted text instead of crashing the cell into "NaN".
 */

import { NetworkStatus, useQuery } from "@apollo/client";
import {
  Copy,
  Edit,
  MoreVertical,
  Play,
  RefreshCcw,
  Trash,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GET_JOB_RESULTS } from "@/queries/queries";
import type { EvalRun } from "@/types/models/eval-run";
import type { JobResult } from "@/types/models/job-result";
import type { TestCase } from "@/types/models/test-case";

import { ScoreCell, type ScoreCellState } from "./score-cell";

interface EvalRunColumnProps {
  evalRun: EvalRun;
  testCases: TestCase[];
  canWrite: boolean;
  onCellClick: (result: JobResult | null) => void;
  handleEditRun: (run: EvalRun) => void;
  handleCopyRun: (run: EvalRun) => void;
  handleStartRun: (run: EvalRun) => void;
  handleDeleteRun: (run: EvalRun) => void;
}

function toCellState(result: JobResult | null, isIncluded: boolean): ScoreCellState {
  if (!isIncluded) return "empty";
  if (!result) return "not-started";
  return result.state as ScoreCellState;
}

export function EvalRunColumn({
  evalRun,
  testCases,
  canWrite,
  onCellClick,
  handleEditRun,
  handleCopyRun,
  handleStartRun,
  handleDeleteRun,
}: EvalRunColumnProps) {
  const t = useTranslations("evals.runs");

  const {
    data: jobResultsData,
    loading: loadingJobResults,
    refetch: refetchJobResults,
    networkStatus: jobsNetworkStatus,
  } = useQuery(GET_JOB_RESULTS, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ label: { contains: "eval-run-" + evalRun.id } }],
    },
    skip: !evalRun.id,
  });

  const jobResults: JobResult[] = jobResultsData?.job_resultsPagination?.items || [];

  const getCellData = (test_case_id: string): JobResult | null => {
    const result = jobResults.find(
      (jr: JobResult) =>
        jr.label?.includes(test_case_id) && jr.label?.includes(evalRun.id),
    );
    return result ?? null;
  };

  // Average over COMPLETED numeric results only. Never produce NaN; if there
  // is nothing to average, the average row falls back to "No results yet".
  const completedResults = jobResults.filter(
    (jr) =>
      jr.state === "completed" &&
      typeof jr.result === "number" &&
      !Number.isNaN(jr.result),
  );
  const averageResult: number | null =
    completedResults.length > 0
      ? completedResults.reduce((acc, jr) => acc + (jr.result as number), 0) /
        completedResults.length
      : null;
  const averageColor =
    averageResult === null
      ? "text-muted-foreground"
      : averageResult >= evalRun.pass_threshold
        ? "text-success"
        : averageResult >= evalRun.pass_threshold - 20
          ? "text-warning"
          : "text-destructive";

  const isRefreshBusy =
    loadingJobResults ||
    jobsNetworkStatus === NetworkStatus.refetch ||
    jobsNetworkStatus === NetworkStatus.fetchMore ||
    jobsNetworkStatus === NetworkStatus.loading;

  return (
    <div className="flex flex-col">
      {/* Header — single overflow menu */}
      <div className="flex h-[60px] items-center justify-center border-b border-r bg-muted/20 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("column.menu")}
            >
              <MoreVertical aria-hidden="true" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                refetchJobResults();
              }}
              disabled={isRefreshBusy}
            >
              <RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />
              {t("column.refresh")}
            </DropdownMenuItem>
            {canWrite ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleStartRun(evalRun)}>
                  <Play aria-hidden="true" className="mr-2 h-4 w-4" />
                  {t("column.start")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCopyRun(evalRun)}>
                  <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
                  {t("column.copy")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleEditRun(evalRun)}>
                  <Edit aria-hidden="true" className="mr-2 h-4 w-4" />
                  {t("column.edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => handleDeleteRun(evalRun)}
                >
                  <Trash aria-hidden="true" className="mr-2 h-4 w-4" />
                  {t("column.delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Average row */}
      <div className="flex h-[60px] items-center justify-center border-b-[5px] border-r border-b p-3 text-center">
        <div
          className={cn(
            "flex h-full w-full min-h-[48px] items-center justify-center rounded text-sm",
            averageColor,
          )}
        >
          <span className={averageResult === null ? "text-xs" : "font-semibold"}>
            {averageResult === null
              ? t("matrix.noResults")
              : averageResult.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Per-case cells */}
      {testCases.map((testCase) => {
        const isIncluded = evalRun.test_case_ids.includes(testCase.id);
        const result = getCellData(testCase.id);
        const state = toCellState(result, isIncluded);

        return (
          <div
            key={testCase.id}
            className="flex h-[60px] items-center justify-center border-b border-r p-3"
          >
            <ScoreCell
              state={state}
              score={
                typeof result?.result === "number" ? result.result : undefined
              }
              threshold={evalRun.pass_threshold}
              onClick={
                state === "completed" ? () => onCellClick(result) : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
