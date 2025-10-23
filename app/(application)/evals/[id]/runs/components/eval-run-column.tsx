"use client";

import { useQuery } from "@apollo/client";
import { GET_JOB_RESULTS } from "@/queries/queries";
import { JobResult } from "@/types/models/job-result";
import { EvalRun } from "@/types/models/eval-run";
import { TestCase } from "@/types/models/test-case";
import { Clock, XCircle, Pause, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EvalRunColumnProps {
  evalRun: EvalRun;
  testCases: TestCase[];
  onCellClick: (result: JobResult | null) => void;
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

export function EvalRunColumn({ evalRun, testCases, onCellClick }: EvalRunColumnProps) {
  const { data: jobResultsData, loading: loadingJobResults } = useQuery(GET_JOB_RESULTS, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ label: { contains: "eval-run-" + evalRun.id } }],
    },
    skip: !evalRun.id
  });

  const jobResults = jobResultsData?.job_resultsPagination?.items || [];

  const getCellData = (test_case_id: string): JobResult | null => {
    const result = jobResults.find((jr: JobResult) =>
      jr.label?.includes(test_case_id) && jr.label?.includes(evalRun.id)
    );

    if (!result) return null;

    return result;
  };

  const getCellColor = (result: JobResult | null): string => {
    console.log("[EXULU] result", result?.result);
    if (!result || result.state !== "completed" || result.result === undefined) {
      return "";
    }

    const score = result.result;
    const threshold = evalRun.pass_threshold;

    if (score >= threshold) {
      return "text-green-500";
    } else if (score >= threshold - 20) {
      return "text-orange-500";
    } else {
      return "text-red-500";
    }
  };

  return (
    <div className="flex-shrink-0 min-w-[100px]">
      {testCases.map((testCase) => {
        const isIncluded = evalRun.test_case_ids.includes(testCase.id);
        const result = getCellData(testCase.id);

        if (!isIncluded) {
          return (
            <div
              key={testCase.id}
              className="p-3 text-center border-r bg-muted/20 min-h-[72px] flex items-center justify-center"
            >
              <span className="text-xs text-muted-foreground">—</span>
            </div>
          );
        }

        const cellColor = getCellColor(result);
        const statusColor = result?.state ? statusColors[result.state] : "bg-transparent";

        return (
          <div
            key={testCase.id}
            className="p-3 text-center border-r min-h-[72px] flex items-center justify-center"
          >
            <div
              onClick={() => onCellClick(result)}
              className={cn(
                "w-full h-full min-h-[48px] rounded transition-colors flex items-center justify-center gap-2",
                cellColor || statusColor || "border-gray-200 bg-gray-50",
                result?.state === "completed" && "cursor-pointer hover:opacity-80",
                (!result || result.state !== "completed") && "cursor-default"
              )}
            >
              {loadingJobResults ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : result ? (
                <>
                  {result.state === "completed" && result.result !== undefined ? (
                    <span className="font-semibold text-sm hover:underline">
                      {result.result.toFixed(1)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {statusIcons[result.state]}
                      <span className="text-xs capitalize">
                        {result.state}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                {statusIcons["waiting"]}
                <span className="text-xs capitalize">
                  Not started
                </span>
              </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
