"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, Clock, Zap, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { EvalRun } from "@/types/models/eval-run";
import { GET_TEST_CASES, RUN_EVAL, GET_AGENTS_BY_IDS, DELETE_EVAL_RUN_BY_ID } from "@/queries/queries";
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
import { formatDuration } from "@/lib/utils";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import { type Agent } from "@/types/models/agent";
import { TestCaseModal } from "../../../cases/components/test-case-modal";
import { TestCase } from "@/types/models/test-case";
import { Alert } from "@/components/ui/alert";

interface EvalRunsTableProps {
  evalRuns: EvalRun[];
  evalSet: EvalSet;
  canWrite: boolean;
  onRefetch: () => void;
}

export function EvalRunsTable({ evalRuns, evalSet, onRefetch }: EvalRunsTableProps) {
  const { toast } = useToast();
  const [visibleRuns, setVisibleRuns] = useState(3);
  const [selectedResult, setSelectedResult] = useState<JobResult | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRun, setModalRun] = useState<EvalRun | null>(null);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<EvalRun | null>(null);
  const [runToStart, setRunToStart] = useState<EvalRun | null>(null);
  const [viewingTestCase, setViewingTestCase] = useState<TestCase | null>(null);

  const { data: testCasesData, loading: loadingTestCases } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSet.id } }],
    },
    skip: !evalSet.id,
    pollInterval: 10000, // Poll every 10 seconds to update test case statuses
  });

  const testCasesList = testCasesData?.test_casesPagination?.items || [];

  // Fetch agents for all eval runs
  const uniqueAgentIds = Array.from(new Set(evalRuns.map(run => run.agent_id).filter(Boolean)));
  const { data: agentsData } = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: uniqueAgentIds },
    skip: uniqueAgentIds.length === 0,
  });

  const agentsMap: Map<string, Agent> = new Map((agentsData?.agentByIds || []).map((agent: any) => [agent.id, agent]));

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

  const [deleteEvalRun, { loading: deletingRun }] = useMutation(DELETE_EVAL_RUN_BY_ID, {
    onCompleted: () => {
      toast({
        title: "Eval run deleted",
        description: "The eval run has been successfully deleted.",
      });
      onRefetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete eval run",
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
    setModalRun(run);
    setModalOpen(true);
  };

  const handleCopyRun = (run: EvalRun) => {
    // Remove the ID so it creates a new run instead of updating
    setModalRun({ ...run, id: "", name: `${run.name} (Copy)` });
    setModalOpen(true);
  };

  const handleStartRun = (run: EvalRun) => {
    setRunToStart(run);
    setStartConfirmOpen(true);
  };

  const handleDeleteRun = (run: EvalRun) => {
    setRunToDelete(run);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteRun = () => {
    if (runToDelete) {
      deleteEvalRun({
        variables: {
          id: runToDelete.id,
        },
      });
    }
    setDeleteConfirmOpen(false);
    setRunToDelete(null);
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
    <div className="w-full overflow-hidden">
      <div className={`flex grid-cols-${3 + (hasMoreRuns ? 1 : 0) + 1} overflow-x-auto`}>
        {/* Test Cases Column (Sticky) */}
        <div className="sticky left-0 z-10 bg-background flex-shrink-0 min-w-[200px] col-span-1">
          {/* Header */}
          <div className="p-3 border-r border-b text-left font-medium text-sm h-[120px] flex">
            <span className="text-xs text-muted-foreground m-auto">Test Case \ Eval Run</span>
          </div>
          {/* Rows */}
          <div key={"average_result"} className="p-3 border-b border-b-[5px] border-r h-[60px] flex items-center bg-muted">
            <div>
              <div className="font-bold text-sm max-w-[500px] truncate ml-3">Average Result</div>
            </div>
          </div>
          {testCasesList.map((testCase: any) => (
            <div key={testCase.id} className="p-3 border-b border-r h-[60px] flex items-center">
              <div className="cursor-pointer hover:underline" onClick={() => setViewingTestCase(testCase)}>
                <div className="font-medium text-sm max-w-[500px] truncate">{testCase.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1 truncate max-w-[100px]">
                  {testCase.id}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button Column */}
        {hasMoreRuns && (
          <div className="flex-shrink-0 min-w-[60px] col-span-1">
            <div className="px-2 py-1.5 text-center font-medium text-sm border-r border-b bg-muted/30 h-[120px]">
              <div className="space-y-0.5 h-full flex my-auto mx-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadMore}
                  className="h-8 w-8 p-0 my-auto mx-auto"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Average Result Column */}
            <div key={"average_result_has_more_placeholder"} className="p-3 border-r bg-muted/20 min-h-[60px] striped-background" />

            {testCasesList.map((testCase: any) => (
              <div key={testCase.id} className="p-3 border-r bg-muted/20 min-h-[60px] striped-background" />
            ))}
          </div>
        )}

        {/* Eval Run Columns */}
        {displayedRuns.map((run) => (
          <div key={run.id} className="flex-1 grow col-span-1">
            {/* Column Header */}
            <div className="px-2 py-1.5 text-center font-medium text-sm border-r bg-muted/30 h-[60px]">
              <div className="space-y-0.5 mt-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex-1 text-xs font-semibold text-foreground truncate">
                    {run.name}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-normal leading-tight">
                  {format(new Date(run.createdAt), "MMM d, yyyy · HH:mm")}
                </div>
                <div className="text-[10px] text-muted-foreground font-normal leading-tight truncate max-w-[100px] text-center m-auto">
                  {agentsMap.get(run.agent_id)?.name || run.agent_id}
                </div>
              </div>
            </div>
            {/* Column Data */}
            <EvalRunColumn
              evalRun={run}
              testCases={testCasesList}
              onCellClick={handleCellClick}
              handleEditRun={handleEditRun}
              handleCopyRun={handleCopyRun}
              handleStartRun={handleStartRun}
              handleDeleteRun={handleDeleteRun}
            />
          </div>
        ))}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Test Result Details</SheetTitle>
          </SheetHeader>

          {selectedResult && (
            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="functions">Functions</TabsTrigger>
                <TabsTrigger value="raw">Raw Data</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                {/* Key Metrics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{selectedResult.result?.toFixed(1) ?? 'N/A'}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Duration
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">{formatDuration((selectedResult.metadata?.duration / 1000) || 0)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Status and Job ID */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Status & Job Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge
                        variant={selectedResult.state === 'completed' ? 'default' : selectedResult.state === 'failed' ? 'destructive' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        {selectedResult.state === 'completed' && <CheckCircle className="h-3 w-3" />}
                        {selectedResult.state === 'failed' && <XCircle className="h-3 w-3" />}
                        {selectedResult.state !== 'completed' && selectedResult.state !== 'failed' && <AlertCircle className="h-3 w-3" />}
                        <span className="capitalize">{selectedResult.state}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Job ID</span>
                      <span className="text-sm font-mono">{selectedResult.job_id}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Error Display */}
                {selectedResult.error && typeof selectedResult.error === 'object' && Object.keys(selectedResult.error).length > 0 && (
                  <Card className="border-destructive">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Error Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CodePreview code={JSON.stringify(selectedResult.error, null, 2)} />
                    </CardContent>
                  </Card>
                )}

                {/* Token Usage */}
                {selectedResult.metadata?.tokens && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Token Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Tokens</span>
                        <span className="text-lg font-semibold">{selectedResult.metadata.tokens.totalTokens?.toLocaleString() ?? 'N/A'}</span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Input</div>
                          <div className="text-base font-medium">{selectedResult.metadata.tokens.inputTokens?.toLocaleString() ?? 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Output</div>
                          <div className="text-base font-medium">{selectedResult.metadata.tokens.outputTokens?.toLocaleString() ?? 'N/A'}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    {/* @ts-ignore */}
                    <Conversation className="max-h-[600px] overflow-y-auto border-0 rounded-lg bg-muted/30">
                      {/* @ts-ignore */}
                      <ConversationContent className="px-6 py-4">
                        <MessageRenderer
                          messages={selectedResult.metadata?.messages || []}
                          config={{
                            marginTopFirstMessage: 'mt-0',
                            customAssistantClassnames: 'bg-secondary/50 rounded-lg px-3 py-1 border-l-2 border-primary/30'
                          }}
                          status={"ready"}
                          showActions={false}
                          showTokens={false}
                          writeAccess={false}
                        />
                      </ConversationContent>
                    </Conversation>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Eval Functions Tab */}
              <TabsContent value="functions" className="space-y-4">
                {selectedResult.metadata?.function_results && selectedResult.metadata.function_results.length > 0 ? (
                  <div className="space-y-3">
                    {selectedResult.metadata.function_results.map((result: any) => (
                      <Card key={result.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-medium">{result.eval_function_name}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-1">{result.eval_function_id}</p>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Result</span>
                            <span className="text-2xl font-bold">{result.result?.toFixed(2) ?? 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            {
                              Object.keys(result.eval_function_config || {}).map((key: string) => (
                                <div key={key} className="flex flex-col">
                                  <span className="text-sm text-muted-foreground capitalize">{key}:</span>
                                  <p className="text-xs text-muted-foreground font-mono mt-1">{result.eval_function_config[key]}</p>
                                </div>
                              ))
                            }
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No eval function results available
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Raw Data Tab */}
              <TabsContent value="raw" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metadata (JSON)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedResult.metadata ? (
                      <CodePreview code={JSON.stringify(selectedResult.metadata, null, 2)} />
                    ) : (
                      <div className="text-sm text-muted-foreground">No metadata available</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <CreateEvalRunModal
        modalKey={`eval-run-modal-table-${evalSet.id}`}
        eval_set_id={evalSet.id}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setModalRun(null);
          }
        }}
        existingRun={modalRun}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Eval Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the eval run "{runToDelete?.name}"
              and all associated results.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Highlight that this will not remove or pause any already scheduled jobs */}
          <Alert className="mt-4">
             This will not remove or pause any already scheduled jobs. If you have job queues
             enabled check the queue below.
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRunToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRun} disabled={deletingRun}>
              {deletingRun && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TestCaseModal
        open={!!viewingTestCase}
        onClose={() => setViewingTestCase(null)}
        evalSetId={evalSet.id}
        onSuccess={() => {
          setViewingTestCase(null);
          // Refetch to get the new test case in the list
        }}
        testCase={viewingTestCase}
      />
    </div>
  );
}
