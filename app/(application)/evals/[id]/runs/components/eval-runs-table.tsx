"use client";

import { useState } from "react";
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
import { Loader2, ChevronLeft, MoreVertical, Edit, Play, Square } from "lucide-react";
import { format } from "date-fns";
import { EvalRun } from "@/types/models/eval-run";
import { GET_TEST_CASES, RUN_EVAL } from "@/queries/queries";
import { JobResult } from "@/types/models/job-result";
import { EvalSet } from "@/types/models/eval-set";
import { useQuery, useMutation } from "@apollo/client";
import { CreateEvalRunModal } from "./create-eval-run-modal";
import { useToast } from "@/components/ui/use-toast";
import { EvalRunColumn } from "./eval-run-column";
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
import { CodePreview } from "@/components/custom/code-preview";

interface EvalRunsTableProps {
  evalRuns: EvalRun[];
  evalSet: EvalSet;
  canWrite: boolean;
  onRefetch: () => void;
}

export function EvalRunsTable({ evalRuns, evalSet, canWrite, onRefetch }: EvalRunsTableProps) {
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

  const testCasesList = testCasesData?.test_casesPagination?.items || [];

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

  const handleCellClick = (result: JobResult | null) => {
    if (result && result.state === "completed") {
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
    <div className="w-full">
      <ScrollArea className="w-full">
        <div className="flex">
          {/* Test Cases Column (Sticky) */}
          <div className="sticky left-0 z-10 bg-background flex-shrink-0 min-w-[200px]">
            {/* Header */}
            <div className="p-3 border-b border-r text-left font-medium text-sm">
              Test Case
            </div>
            {/* Rows */}
            {testCasesList.map((testCase) => (
              <div key={testCase.id} className="p-3 border-b border-r min-h-[72px] flex items-center">
                <div>
                  <div className="font-medium text-sm">{testCase.name}</div>
                  {testCase.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1 truncate max-w-[100px]">
                      {testCase.id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button Column */}
          {hasMoreRuns && (
            <div className="flex-shrink-0 min-w-[60px]">
              <div className="text-center border-b border-r p-2 min-h-[48px] flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              {testCasesList.map((testCase) => (
                <div key={testCase.id} className="p-3 border-b border-r bg-muted/20 min-h-[72px]" />
              ))}
            </div>
          )}

          {/* Eval Run Columns */}
          {displayedRuns.map((run) => (
            <div key={run.id} className="flex-1 min-w-[100px]">
              {/* Column Header */}
              <div className="px-2 py-1.5 text-center font-medium text-sm border-b border-r bg-muted/30 min-h-[48px]">
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
                  <div className="text-[10px] text-muted-foreground font-normal leading-tight truncate max-w-[100px] text-center m-auto">
                    {run.id}
                  </div>
                </div>
              </div>
              {/* Column Data */}
              <EvalRunColumn
                evalRun={run}
                testCases={testCasesList}
                onCellClick={handleCellClick}
              />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Test Result Details</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedResult && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium">Job ID</div>
                  <div className="text-sm">{selectedResult.job_id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Score</div>
                  <div className="text-2xl font-bold">{selectedResult.result?.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-sm capitalize">{selectedResult.state}</div>
                </div>
                {selectedResult.error && typeof selectedResult.error === 'object' && Object.keys(selectedResult.error).length > 0 && (
                  <div>
                    <div className="text-sm font-medium">Error</div>
                    <div className="text-sm text-red-600">{JSON.stringify(selectedResult.error)}</div>
                  </div>
                )}
                {
                  selectedResult.metadata && (
                    <div>
                      <div className="text-sm font-medium">Metadata</div>
                      <CodePreview code={JSON.stringify(selectedResult.metadata, null, 2)} />
                    </div>
                  )
                }
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
