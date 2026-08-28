"use client";

/**
 * EvalRunsTable — the redesigned runs matrix.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1):
 * - Switched from a `flex grid-cols-N` hybrid (broken Tailwind class) to a
 *   real CSS grid: `minmax(200px,280px) repeat(N, minmax(140px,1fr))`.
 *   The sticky first column lists cases; each subsequent column is a single
 *   self-contained <EvalRunColumn /> lane that owns its own GET_JOB_RESULTS
 *   subscription. Lanes-as-components keeps Rules-of-Hooks intact as the
 *   visible-runs count changes.
 * - Average row pinned at the top of the data rows; computed completed-only
 *   per lane (never NaN — see eval-run-column.tsx).
 * - Last 3 runs by default; a quiet text "Show older runs" button reveals
 *   five more at a time.
 * - Empty test-case set surfaces the shared EmptyState with a deep-link
 *   into the parent's Test cases tab (via the `onSwitchToCasesTab` prop).
 * - `canWrite` is RESPECTED here and propagated to <EvalRunColumn />. The
 *   original component destructured this prop and discarded it, leaking
 *   write actions to readers — fixed.
 * - All confirmation flows now go through the shared <ConfirmDialog />
 *   primitive (variant=default for Start, variant=destructive for Delete).
 *   The "scheduled queue jobs are NOT removed" note is preserved as a
 *   `warning` inside the Delete dialog.
 * - The sticky-column TestCaseModal now refetches the case list on success
 *   (original code had a comment where the call should have been — bug fix).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { format } from "date-fns";
import {
  CheckCircle,
  ChevronsLeft,
  Clock,
  ListChecks,
  Loader2,
  XCircle,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { CodePreview } from "@/components/custom/code-preview";
import { formatDuration } from "@/lib/utils";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";

import {
  DELETE_EVAL_RUN_BY_ID,
  GET_AGENTS_BY_IDS,
  GET_TEST_CASES,
  RUN_EVAL,
} from "@/queries/queries";
import type { Agent } from "@/types/models/agent";
import type { EvalRun } from "@/types/models/eval-run";
import type { EvalSet } from "@/types/models/eval-set";
import type { JobResult } from "@/types/models/job-result";
import type { TestCase } from "@/types/models/test-case";

import { TestCaseModal } from "../../../cases/components/test-case-modal";
import { CreateEvalRunModal } from "./create-eval-run-modal";
import { EvalRunColumn } from "./eval-run-column";

interface EvalRunsTableProps {
  evalRuns: EvalRun[];
  evalSet: EvalSet;
  canWrite: boolean;
  onRefetch: () => void;
  /** Parent-provided callback to flip the page-level Tabs into the cases tab. */
  onSwitchToCasesTab?: () => void;
}

const INITIAL_VISIBLE = 3;
const PAGE_SIZE = 5;

export function EvalRunsTable({
  evalRuns,
  evalSet,
  canWrite,
  onRefetch,
  onSwitchToCasesTab,
}: EvalRunsTableProps) {
  const t = useTranslations("evals.runs");
  const tMatrix = useTranslations("evals.runs.matrix");

  const [visibleRuns, setVisibleRuns] = useState(INITIAL_VISIBLE);
  const [selectedResult, setSelectedResult] = useState<JobResult | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRun, setModalRun] = useState<EvalRun | null>(null);
  const [startTarget, setStartTarget] = useState<EvalRun | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvalRun | null>(null);
  const [viewingTestCase, setViewingTestCase] = useState<TestCase | null>(null);

  const {
    data: testCasesData,
    loading: loadingTestCases,
    refetch: refetchTestCases,
  } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSet.id } }],
    },
    skip: !evalSet.id,
    pollInterval: 10000,
  });

  const testCasesList: TestCase[] =
    testCasesData?.test_casesPagination?.items || [];

  const uniqueAgentIds = useMemo(
    () => Array.from(new Set(evalRuns.map((run) => run.agent_id).filter(Boolean))),
    [evalRuns],
  );
  const { data: agentsData } = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: uniqueAgentIds },
    skip: uniqueAgentIds.length === 0,
  });
  const agentsMap = useMemo(
    () =>
      new Map<string, Agent>(
        (agentsData?.agentByIds || []).map((agent: Agent) => [agent.id, agent]),
      ),
    [agentsData],
  );

  const [runEval] = useMutation(RUN_EVAL, {
    onCompleted: (data) => {
      toast.success(t("startSuccess.title"), {
        description: t("startSuccess.description", { count: data.runEval.count }),
      });
      onRefetch();
    },
    onError: (error) => {
      toast.error(t("startError.title"), { description: error.message });
    },
  });

  const [deleteEvalRun] = useMutation(DELETE_EVAL_RUN_BY_ID, {
    onCompleted: () => {
      toast.success(t("deleteSuccess.title"));
      onRefetch();
    },
    onError: (error) => {
      toast.error(t("deleteError.title"), { description: error.message });
    },
  });

  const sortedEvalRuns = useMemo(
    () =>
      [...evalRuns].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [evalRuns],
  );
  const displayedRuns = sortedEvalRuns.slice(-visibleRuns);
  const hasMoreRuns = sortedEvalRuns.length > visibleRuns;

  const handleCellClick = (result: JobResult | null) => {
    if (result && result.state === "completed") {
      setSelectedResult(result);
      setIsSheetOpen(true);
    }
  };

  const handleLoadMore = () =>
    setVisibleRuns((prev) => Math.min(prev + PAGE_SIZE, sortedEvalRuns.length));

  const handleEditRun = (run: EvalRun) => {
    setModalRun(run);
    setModalOpen(true);
  };
  const handleCopyRun = (run: EvalRun) => {
    setModalRun({ ...run, id: "", name: `${run.name} (Copy)` });
    setModalOpen(true);
  };
  const handleStartRun = (run: EvalRun) => setStartTarget(run);
  const handleDeleteRun = (run: EvalRun) => setDeleteTarget(run);

  const confirmStartRun = async () => {
    if (!startTarget) return;
    await runEval({ variables: { id: startTarget.id } });
    setStartTarget(null);
  };
  const confirmDeleteRun = async () => {
    if (!deleteTarget) return;
    await deleteEvalRun({ variables: { id: deleteTarget.id } });
    setDeleteTarget(null);
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
      <EmptyState
        icon={ListChecks}
        title={t("noCases.title")}
        description={t("noCases.description")}
        action={
          onSwitchToCasesTab
            ? { label: t("noCases.action"), onClick: onSwitchToCasesTab }
            : undefined
        }
      />
    );
  }

  // Grid template:
  //   - first column: sticky test-case names (220–280px)
  //   - optional "show older runs" rail (60px) when there are hidden runs
  //   - one column per visible run (140px min, 1fr each)
  const gridTemplateColumns = [
    "minmax(220px, 280px)",
    hasMoreRuns ? "60px" : null,
    `repeat(${displayedRuns.length}, minmax(140px, 1fr))`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full overflow-x-auto" data-demo-id="evals-matrix">
      <div className="grid w-full min-w-fit" style={{ gridTemplateColumns }}>
        {/* Sticky first column — cases list */}
        <div className="sticky left-0 z-10 bg-background">
          {/* 120px = the run lanes' TWO header rows: the metadata header
              below, plus the per-run overflow-menu row that EvalRunColumn
              renders itself. This column and the rail have only one header
              each, so at 60px every row below them sat a row higher than the
              scores it labels — the matrix read one case out of register,
              which is unnoticeable while the cells say "Not started" and
              badly misleading as soon as they carry numbers. */}
          <div className="flex h-[120px] items-center border-b border-r p-3">
            <span className="text-xs text-muted-foreground">
              {tMatrix("caseColumnHeader")}
            </span>
          </div>
          <div className="flex h-[60px] items-center border-b-[5px] border-r border-b bg-muted p-3">
            <div className="ml-3 truncate text-sm font-bold">
              {tMatrix("averageRow")}
            </div>
          </div>
          {testCasesList.map((testCase) => (
            <div
              key={testCase.id}
              className="flex h-[60px] items-center border-b border-r p-3"
            >
              <button
                type="button"
                onClick={() => setViewingTestCase(testCase)}
                className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:underline"
              >
                <div className="max-w-[260px] truncate text-sm font-medium">
                  {testCase.name}
                </div>
                <div className="mt-1 max-w-[120px] truncate text-xs text-muted-foreground">
                  {testCase.id}
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* "Show older runs" rail */}
        {hasMoreRuns ? (
          <div>
            {/* 120px for the same reason as the case column above. */}
            <div className="flex h-[120px] items-center justify-center border-b border-r bg-muted/30 p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                aria-label={tMatrix("showOlder")}
                className="h-7 px-2 text-xs"
              >
                <ChevronsLeft aria-hidden="true" className="mr-1 h-3 w-3" />
                {tMatrix("showOlder")}
              </Button>
            </div>
            <div className="h-[60px] border-b-[5px] border-r border-b bg-muted/20 striped-background" />
            {testCasesList.map((testCase) => (
              <div
                key={testCase.id}
                className="h-[60px] border-b border-r bg-muted/20 striped-background"
              />
            ))}
          </div>
        ) : null}

        {/* Lanes — one per visible run */}
        {displayedRuns.map((run) => (
          <div key={run.id} className="flex flex-col">
            {/* The lane header (label) lives here; the lane component owns
                the action menu + average row + cells. We split the visual
                header from the lane so we can show metadata (name / agent
                / date) without re-querying. */}
            {/* Fixed at 60px rather than sized by its content: three lines of
                metadata came to 54px, so every lane started six pixels above
                the case column even before the extra menu row below. */}
            <div className="flex h-[60px] flex-col justify-center border-b border-r bg-muted/30 px-2 py-1.5 text-center">
              <div className="truncate text-xs font-semibold text-foreground">
                {run.name}
              </div>
              <div className="text-[10px] leading-tight text-muted-foreground">
                {format(new Date(run.createdAt), "MMM d, yyyy · HH:mm")}
              </div>
              <div className="mx-auto max-w-[120px] truncate text-[10px] leading-tight text-muted-foreground">
                {agentsMap.get(run.agent_id)?.name || run.agent_id}
              </div>
            </div>
            <EvalRunColumn
              evalRun={run}
              testCases={testCasesList}
              canWrite={canWrite}
              onCellClick={handleCellClick}
              handleEditRun={handleEditRun}
              handleCopyRun={handleCopyRun}
              handleStartRun={handleStartRun}
              handleDeleteRun={handleDeleteRun}
            />
          </div>
        ))}
      </div>

      {/* Result detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t("resultSheet.title")}</SheetTitle>
          </SheetHeader>
          {selectedResult ? (
            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">
                  {t("resultSheet.tabs.overview")}
                </TabsTrigger>
                <TabsTrigger value="messages">
                  {t("resultSheet.tabs.messages")}
                </TabsTrigger>
                <TabsTrigger value="functions">
                  {t("resultSheet.tabs.functions")}
                </TabsTrigger>
                <TabsTrigger value="raw">
                  {t("resultSheet.tabs.raw")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {t("resultSheet.overview.score")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {selectedResult.result?.toFixed?.(1) ?? "N/A"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Clock aria-hidden="true" className="h-4 w-4" />
                        {t("resultSheet.overview.duration")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">
                        {formatDuration(
                          (selectedResult.metadata?.duration / 1000) || 0,
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {t("resultSheet.overview.status")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("resultSheet.overview.status")}
                      </span>
                      <Badge
                        variant={
                          selectedResult.state === "completed"
                            ? "default"
                            : selectedResult.state === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="flex items-center gap-1"
                      >
                        {selectedResult.state === "completed" ? (
                          <CheckCircle aria-hidden="true" className="h-3 w-3" />
                        ) : selectedResult.state === "failed" ? (
                          <XCircle aria-hidden="true" className="h-3 w-3" />
                        ) : null}
                        <span className="capitalize">{selectedResult.state}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("resultSheet.overview.jobId")}
                      </span>
                      <span className="font-mono text-sm">
                        {selectedResult.job_id}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {selectedResult.error &&
                typeof selectedResult.error === "object" &&
                Object.keys(selectedResult.error).length > 0 ? (
                  <Card className="border-destructive">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <XCircle aria-hidden="true" className="h-4 w-4" />
                        {t("resultSheet.overview.errorTitle")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CodePreview
                        code={JSON.stringify(selectedResult.error, null, 2)}
                      />
                    </CardContent>
                  </Card>
                ) : null}

                {selectedResult.metadata?.tokens ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <Zap aria-hidden="true" className="h-4 w-4" />
                        {t("resultSheet.overview.tokensTitle")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t("resultSheet.overview.tokensTotal")}
                        </span>
                        <span className="text-lg font-semibold">
                          {selectedResult.metadata.tokens.totalTokens?.toLocaleString() ??
                            "N/A"}
                        </span>
                      </div>
                      <div className="h-px bg-border" />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">
                            {t("resultSheet.overview.tokensInput")}
                          </div>
                          <div className="text-base font-medium">
                            {selectedResult.metadata.tokens.inputTokens?.toLocaleString() ??
                              "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">
                            {t("resultSheet.overview.tokensOutput")}
                          </div>
                          <div className="text-base font-medium">
                            {selectedResult.metadata.tokens.outputTokens?.toLocaleString() ??
                              "N/A"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="messages" className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    {/* @ts-ignore */}
                    <Conversation className="max-h-[600px] overflow-y-auto rounded-lg border-0 bg-muted/30">
                      {/* @ts-ignore */}
                      <ConversationContent className="px-6 py-4">
                        <MessageRenderer
                          messages={selectedResult.metadata?.messages || []}
                          config={{
                            marginTopFirstMessage: "mt-0",
                            customAssistantClassnames:
                              "bg-secondary/50 rounded-lg px-3 py-1 border-l-2 border-primary/30",
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

              <TabsContent value="functions" className="space-y-4">
                {selectedResult.metadata?.function_results &&
                selectedResult.metadata.function_results.length > 0 ? (
                  <div className="space-y-3">
                    {selectedResult.metadata.function_results.map(
                      (result: any) => (
                        <Card key={result.id}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base font-medium">
                              {result.eval_function_name}
                            </CardTitle>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              {result.eval_function_id}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                {t("resultSheet.overview.score")}
                              </span>
                              <span className="text-2xl font-bold">
                                {result.result?.toFixed?.(2) ?? "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              {Object.keys(result.eval_function_config || {}).map(
                                (key: string) => (
                                  <div key={key} className="flex flex-col">
                                    <span className="text-sm capitalize text-muted-foreground">
                                      {key}:
                                    </span>
                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                      {result.eval_function_config[key]}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      {t("resultSheet.functions.empty")}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="raw" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {t("resultSheet.tabs.raw")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedResult.metadata ? (
                      <CodePreview
                        code={JSON.stringify(selectedResult.metadata, null, 2)}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {t("resultSheet.raw.empty")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Create / edit / copy modal */}
      <CreateEvalRunModal
        modalKey={`eval-run-modal-table-${evalSet.id}`}
        eval_set_id={evalSet.id}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setModalRun(null);
        }}
        existingRun={modalRun}
        onCreateSuccess={onRefetch}
      />

      {/* Start run — informational (default) confirm */}
      <ConfirmDialog
        open={!!startTarget}
        onOpenChange={(open) => !open && setStartTarget(null)}
        title={t("startConfirm.title")}
        description={
          startTarget
            ? t("startConfirm.description", {
                name: startTarget.name,
                count: startTarget.test_case_ids.length,
              })
            : ""
        }
        variant="default"
        confirmLabel={t("startConfirm.confirm")}
        onConfirm={confirmStartRun}
      />

      {/* Delete run — destructive confirm with the queue-jobs warning */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteConfirm.title")}
        description={
          deleteTarget
            ? t("deleteConfirm.description", { name: deleteTarget.name })
            : ""
        }
        variant="destructive"
        confirmLabel={t("deleteConfirm.confirm")}
        warning={t("deleteConfirm.queueNote")}
        onConfirm={confirmDeleteRun}
      />

      {/* Sticky-column case modal — the original code had a comment where
          refetchTestCases() should have been called. Bug fix. */}
      <TestCaseModal
        open={!!viewingTestCase}
        onClose={() => setViewingTestCase(null)}
        evalSetId={evalSet.id}
        onSuccess={() => {
          setViewingTestCase(null);
          refetchTestCases();
        }}
        testCase={viewingTestCase}
      />
    </div>
  );
}
