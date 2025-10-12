"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, XCircle, Pause, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { EvalRun } from "@/types/models/eval-run";
import { TestCase } from "@/types/models/test-case";
import { GET_JOBS, GET_TEST_CASES } from "@/queries/queries";
import { EvalSet } from "@/types/models/eval-set";
import { useQuery } from "@apollo/client";

interface EvalRunsTableProps {
  evalRuns: EvalRun[];
  evalSet: EvalSet;
  canWrite: boolean;
  onRefetch: () => void;
}

interface JobResult {
  id: string;
  evalRunId: string;
  testCaseId: string;
  status: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused" | "stuck";
  score?: number;
  error?: string;
}

const statusIcons = {
  waiting: <Clock className="h-3 w-3" />,
  active: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: null,
  failed: <XCircle className="h-3 w-3" />,
  delayed: <Clock className="h-3 w-3" />,
  paused: <Pause className="h-3 w-3" />,
  stuck: <AlertTriangle className="h-3 w-3" />,
};

const statusColors = {
  waiting: "text-yellow-600 bg-yellow-50 border-yellow-200",
  active: "text-blue-600 bg-blue-50 border-blue-200",
  completed: "",
  failed: "text-red-600 bg-red-50 border-red-200",
  delayed: "text-orange-600 bg-orange-50 border-orange-200",
  paused: "text-gray-600 bg-gray-50 border-gray-200",
  stuck: "text-red-600 bg-red-50 border-red-200",
};

export function EvalRunsTable({ evalRuns, evalSet, canWrite, onRefetch }: EvalRunsTableProps) {
  const router = useRouter();
  const [visibleRuns, setVisibleRuns] = useState(5);

  const { data: testCasesData, loading: loadingTestCases, refetch: refetchTestCases } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSet.id } }],
    },
    skip: !!evalSet.id
  });

  /* 
  Get jobs per column (eval run)
  const { data: jobsData, loading: loadingJobs, refetch: refetchJobs } = useQuery(GET_JOBS, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSet.id } }],
    },
    skip: !!evalSet.id
  }); */

  const testCasesList = testCasesData?.test_casesPagination?.items || [];

  const sortedEvalRuns = [...evalRuns].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const displayedRuns = sortedEvalRuns.slice(0, visibleRuns);
  const hasMoreRuns = sortedEvalRuns.length > visibleRuns;

  const getCellData = (testCaseId: string, evalRunId: string): JobResult | null => {
    return null; // todo
  };

  const getCellColor = (result: JobResult | null, run: EvalRun): string => {
    if (!result || result.status !== "completed" || result.score === undefined) {
      return "";
    }

    const score = result.score;
    const threshold = run.pass_threshold;

    if (score >= threshold) {
      return "bg-green-100 border-green-300 hover:bg-green-200";
    } else if (score >= threshold - 20) {
      return "bg-orange-100 border-orange-300 hover:bg-orange-200";
    } else {
      return "bg-red-100 border-red-300 hover:bg-red-200";
    }
  };

  const handleCellClick = (testCaseId: string, evalRunId: string, result: JobResult | null) => {
    if (result && result.status === "completed") {
      router.push(`/evals/results/${result.id}`);
    }
  };

  const handleLoadMore = () => {
    setVisibleRuns(prev => Math.min(prev + 5, sortedEvalRuns.length));
  };

  if (loadingTestCases) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (testCasesList.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No test cases in this eval set.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="w-full">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-background p-3 text-left font-medium text-sm min-w-[200px] border-r">
                  Test Case
                </th>
                {displayedRuns.map((run) => (
                  <th
                    key={run.id}
                    className="p-3 text-center font-medium text-sm min-w-[120px] border-r"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(run.createdAt), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(run.createdAt), "HH:mm")}
                      </div>
                    </div>
                  </th>
                ))}
                {hasMoreRuns && (
                  <th className="p-3 text-center min-w-[80px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadMore}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {testCasesList.map((testCase) => (
                <tr key={testCase.id} className="border-b hover:bg-muted/50">
                  <td className="sticky left-0 z-10 bg-background p-3 border-r">
                    <div>
                      <div className="font-medium text-sm">{testCase.name}</div>
                      {testCase.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {testCase.description}
                        </div>
                      )}
                    </div>
                  </td>
                  {displayedRuns.map((run) => {
                    const isIncluded = run.test_case_ids.includes(testCase.id);
                    const result = getCellData(testCase.id, run.id);

                    if (!isIncluded) {
                      return (
                        <td
                          key={run.id}
                          className="p-3 text-center border-r bg-muted/20"
                        >
                          <span className="text-xs text-muted-foreground">—</span>
                        </td>
                      );
                    }

                    const cellColor = getCellColor(result, run);
                    const statusColor = result?.status ? statusColors[result.status] : "";

                    return (
                      <td
                        key={run.id}
                        className="p-3 text-center border-r"
                      >
                        <button
                          onClick={() => handleCellClick(testCase.id, run.id, result)}
                          disabled={!result || result.status !== "completed"}
                          className={cn(
                            "w-full h-full min-h-[48px] rounded border-2 transition-colors flex items-center justify-center gap-2",
                            cellColor || statusColor || "border-gray-200 bg-gray-50",
                            result?.status === "completed" && "cursor-pointer",
                            (!result || result.status !== "completed") && "cursor-default"
                          )}
                        >
                          {result ? (
                            <>
                              {result.status === "completed" && result.score !== undefined ? (
                                <span className="font-semibold text-sm">
                                  {result.score.toFixed(1)}
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {statusIcons[result.status]}
                                  <span className="text-xs capitalize">
                                    {result.status}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                  {hasMoreRuns && (
                    <td className="p-3 border-r bg-muted/20" />
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* {loadingResults && (
        <div className="text-center text-sm text-muted-foreground">
          Loading results...
        </div>
      )} */}
    </div>
  );
}
