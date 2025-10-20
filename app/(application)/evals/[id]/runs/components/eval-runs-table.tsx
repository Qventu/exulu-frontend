"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, XCircle, Pause, AlertTriangle, Loader2, ChevronLeft, MoreVertical, Edit, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { EvalRun } from "@/types/models/eval-run";
import { GET_TEST_CASES, RUN_EVAL } from "@/queries/queries";
import { EvalSet } from "@/types/models/eval-set";
import { useQuery, useMutation } from "@apollo/client";
import { CreateEvalRunModal } from "./create-eval-run-modal";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EvalRunsTableProps {
  evalRuns: EvalRun[];
  evalSet: EvalSet;
  canWrite: boolean;
  onRefetch: () => void;
}

interface JobResult {
  id: string;
  eval_run_id: string;
  test_case_id: string;
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
  const { toast } = useToast();
  const [visibleRuns, setVisibleRuns] = useState(5);
  const [selectedResult, setSelectedResult] = useState<JobResult | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [runToEdit, setRunToEdit] = useState<EvalRun | null>(null);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [runToStart, setRunToStart] = useState<EvalRun | null>(null);

  console.log("[EXULU] Eval set", evalSet);
  const { data: testCasesData, loading: loadingTestCases, refetch: refetchTestCases } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSet.id } }],
    },
    skip: !evalSet.id
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

  console.log("[EXULU] Test cases", testCasesData);

  const testCasesList = testCasesData?.test_casesPagination?.items || [];

  console.log("[EXULU] Test cases list", testCasesList);

  const [runEval, { loading: runningEval }] = useMutation(RUN_EVAL, {
    onCompleted: (data) => {
      toast({
        title: "Eval run started",
        description: `Scheduled ${data.runEval.count} test cases to run.`,
      });
      onRefetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to start eval run",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sortedEvalRuns = [...evalRuns].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const displayedRuns = sortedEvalRuns.slice(-visibleRuns);
  const hasMoreRuns = sortedEvalRuns.length > visibleRuns;

  const getCellData = (test_case_id: string, eval_run_id: string): JobResult | null => {
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

  const handleCellClick = (result: JobResult | null) => {
    if (result && result.status === "completed") {
      setSelectedResult(result);
      setIsSheetOpen(true);
    }
  };

  const handleLoadMore = () => {
    setVisibleRuns(prev => Math.min(prev + 5, sortedEvalRuns.length));
  };

  const handleEditRun = (run: EvalRun) => {
    setRunToEdit(run);
    setEditModalOpen(true);
  };

  const handleStartRun = (run: EvalRun) => {
    setRunToStart(run);
    setStartConfirmOpen(true);
  };

  const confirmStartRun = () => {
    if (runToStart) {
      runEval({
        variables: {
          id: runToStart.id,
        },
      });
    }
    setStartConfirmOpen(false);
    setRunToStart(null);
  };

  const handleStopRun = (run: EvalRun) => {
    // TODO: Implement stop functionality
    console.log("Stop run:", run);
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
    <div className="space-y-4 max-w-full">
      <ScrollArea className="w-full">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-background p-3 text-left font-medium text-sm min-w-[200px] border-r">
                  Test Case
                </th>
                {hasMoreRuns && (
                  <th className="text-center min-w-[20px] border-r">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadMore}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </th>
                )}
                {displayedRuns.map((run) => (
                  <th
                    key={run.id}
                    className="px-2 py-1.5 text-center font-medium text-sm min-w-[100px] border-r bg-muted/30"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 text-xs font-semibold text-foreground truncate">
                          {run.name}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:bg-background/80"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRun(run)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStartRun(run)}>
                              <Play className="mr-2 h-4 w-4" />
                              Start
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStopRun(run)}>
                              <Square className="mr-2 h-4 w-4" />
                              Stop
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal leading-tight">
                        {format(new Date(run.createdAt), "MMM d, yyyy · HH:mm")}
                      </div>
                    </div>
                  </th>
                ))}
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
                  {hasMoreRuns && (
                    <td className="p-3 border-r bg-muted/20" />
                  )}
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
                    const statusColor = result?.status ? statusColors[result.status] : "bg-transparent";

                    return (
                      <td
                        key={run.id}
                        className="p-3 text-center border-r"
                      >
                        <div
                          onClick={() => handleCellClick(result)}
                          className={cn(
                            "w-full h-full min-h-[48px] rounded transition-colors flex items-center justify-center gap-2",
                            cellColor || statusColor || "border-gray-200 bg-gray-50",
                            result?.status === "completed" && "cursor-pointer hover:opacity-80",
                            (!result || result.status !== "completed") && "cursor-default"
                          )}
                        >
                          {result ? (
                            <>
                              {result.status === "completed" && result.score !== undefined ? (
                                <span className="font-semibold text-sm hover:underline">
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
                        </div>
                      </td>
                    );
                  })}
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

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Test Result Details</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedResult && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium">Score</div>
                  <div className="text-2xl font-bold">{selectedResult.score?.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-sm capitalize">{selectedResult.status}</div>
                </div>
                {selectedResult.error && (
                  <div>
                    <div className="text-sm font-medium">Error</div>
                    <div className="text-sm text-red-600">{selectedResult.error}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CreateEvalRunModal
        eval_set_id={evalSet.id}
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) {
            setRunToEdit(null);
          }
        }}
        existingRun={runToEdit}
        onCreateSuccess={onRefetch}
      />

      <AlertDialog open={startConfirmOpen} onOpenChange={setStartConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Eval Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will schedule all {runToStart?.test_case_ids.length || 0} test cases in "{runToStart?.name}" to be run.
              The eval run will execute each test case against the configured agent and eval functions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRunToStart(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStartRun} disabled={runningEval}>
              {runningEval && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
