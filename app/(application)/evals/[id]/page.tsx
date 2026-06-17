"use client";

/**
 * Eval-set detail page.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1): the JTBD here is "run an
 * evaluation and inspect results". Editing set-level metadata and managing
 * test-case membership are secondary — promoted into a Tabs split and an
 * overflow menu so they don't compete with the primary action ("Run eval").
 *
 *   PageShell
 *     PageHeader: back crumb · set name · description · primary "Run eval"
 *                 · ⋯ overflow (Edit details / New run config)
 *     WorkersWarning (shared)
 *     Tabs
 *       Results  → <EvalRuns>          (Builder C-owned)
 *       Test cases · n → cases list + toolbar (this file)
 *
 * No more hero card, no more Collapsible-in-Card shells, no more in-page
 * Save bar (replaced by the EditEvalSetDialog).
 */

import { useMutation, useQuery } from "@apollo/client";
import { MoreHorizontal, Play, Plus, X, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/shell/config-context";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { can } from "@/lib/rights";
import {
  GET_EVAL_SET_BY_ID,
  GET_TEST_CASES,
  UPDATE_TEST_CASE,
} from "@/queries/queries";
import { TestCase } from "@/types/models/test-case";

import { TestCaseModal } from "../cases/components/test-case-modal";
import { EvalsAccessDenied } from "../_shared/access-denied";
import { WorkersWarning } from "../_shared/workers-warning";
import { EditEvalSetDialog } from "./components/edit-eval-set-dialog";
import { TestCaseSelectionModal } from "./components/test-case-selection-modal";
import EvalRuns from "./runs/eval-runs";

export const dynamic = "force-dynamic";

const MAX_TEST_CASES_PER_SET = 500;

export default function EvalSetEditorPage() {
  const params = useParams();
  const { user } = useContext(UserContext);
  const config = useContext(ConfigContext);
  const t = useTranslations("evals.detail");
  const tCommon = useTranslations("evals.common");
  const evalSetId = params.id as string;

  const hasEvalsAccess = can(user, { area: "evals", level: "read" });
  const canWrite = can(user, { area: "evals", level: "write" });

  const [activeTab, setActiveTab] = useState<"results" | "testCases">(
    "results",
  );
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [testCaseToRemove, setTestCaseToRemove] = useState<string | null>(null);

  // Fetch eval set
  const {
    loading: loadingEvalSet,
    data: evalSetData,
    refetch,
  } = useQuery(GET_EVAL_SET_BY_ID, {
    variables: { id: evalSetId },
    skip: !evalSetId,
  });

  // Fetch the test cases that belong to this set (capped at 500 per product
  // rule). Membership is the source of truth — we no longer track a parallel
  // `testCases` state array (the old code carried a dead `useState<string[]>`).
  const { data: testCasesData, refetch: refetchTestCases } = useQuery(
    GET_TEST_CASES,
    {
      variables: {
        page: 1,
        limit: MAX_TEST_CASES_PER_SET,
        filters: [{ eval_set_id: { eq: evalSetId } }],
      },
    },
  );

  const [updateTestCase] = useMutation(UPDATE_TEST_CASE);

  const evalSet = evalSetData?.eval_setById ?? null;
  const testCasesList: TestCase[] =
    testCasesData?.test_casesPagination?.items ?? [];
  const memberCaseIds = useMemo(
    () => testCasesList.map((tc) => tc.id),
    [testCasesList],
  );
  const caseCount = testCasesList.length;
  const capReached = caseCount >= MAX_TEST_CASES_PER_SET;

  const workersConfigured = Boolean(
    config?.workers?.enabled && config?.workers?.redisHost,
  );
  const canRunEval = canWrite && workersConfigured;
  const runEvalDisabled = caseCount === 0;

  if (!hasEvalsAccess) {
    return (
      <PageShell>
        <EvalsAccessDenied />
      </PageShell>
    );
  }

  if (loadingEvalSet || !evalSet) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  const handleAddTestCases = async (selectedTestCaseIds: string[]) => {
    // Dedupe against current membership; the modal already filters but a
    // race with a concurrent edit could slip a dup through, and the BE would
    // reject one update so the user-facing "added N" count would lie.
    const toAdd = selectedTestCaseIds.filter(
      (id) => !memberCaseIds.includes(id),
    );
    if (toAdd.length === 0) {
      setShowSelectionModal(false);
      return;
    }

    if (memberCaseIds.length + toAdd.length > MAX_TEST_CASES_PER_SET) {
      toast.error(t("testCases.capReached"));
      return;
    }

    setShowSelectionModal(false);

    // BE-3 backlog: replace this loop with a single bulk-add mutation. Until
    // then we serialize so progress is meaningful (Promise.all would race the
    // toast updates and obscure partial failures).
    const total = toAdd.length;
    const toastId = toast.loading(
      t("bulkAdd.progress", { done: 0, total }),
    );
    let succeeded = 0;
    const errors: string[] = [];

    for (let i = 0; i < toAdd.length; i++) {
      const id = toAdd[i];
      try {
        await updateTestCase({
          variables: { id, data: { eval_set_id: evalSetId } },
        });
        succeeded += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      toast.loading(t("bulkAdd.progress", { done: i + 1, total }), {
        id: toastId,
      });
    }

    if (errors.length === 0) {
      toast.success(t("bulkAdd.success", { count: succeeded }), {
        id: toastId,
      });
    } else {
      toast.error(t("bulkAdd.errorTitle"), {
        id: toastId,
        description: errors[0],
      });
    }

    // Single refetch at the end — racing one per loop iteration kept the UI
    // flickery and burned through unnecessary requests.
    await refetchTestCases();
  };

  const handleRemoveTestCase = async () => {
    if (!testCaseToRemove) return;
    await updateTestCase({
      variables: { id: testCaseToRemove, data: { eval_set_id: null } },
    });
    toast.success(t("removeCaseSuccess.title"));
    await refetchTestCases();
    setTestCaseToRemove(null);
  };

  const runEvalButton = (
    <Button
      onClick={() => setActiveTab("results")}
      disabled={runEvalDisabled}
    >
      <Play aria-hidden="true" className="mr-2 size-4" />
      {t("runEval")}
    </Button>
  );

  const primaryAction = canRunEval ? (
    <>
      {runEvalDisabled ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrap disabled button in a span so the Tooltip still fires */}
              <span tabIndex={0}>{runEvalButton}</span>
            </TooltipTrigger>
            <TooltipContent>{t("runEvalDisabledTooltip")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        runEvalButton
      )}
      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("overflow.menu")}
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
              {t("overflow.editDetails")}
            </DropdownMenuItem>
            {/* Builder C owns the actual CreateEvalRunModal; the EvalRuns
                child already exposes its own "+ New run" trigger, so we keep
                this entry forwarding into the Results tab where that trigger
                lives. */}
            <DropdownMenuItem
              onSelect={() => setActiveTab("results")}
              disabled={!workersConfigured || caseCount === 0}
            >
              {t("overflow.newRunConfig")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  ) : canWrite ? (
    // Workers are off, but the user can still admin set metadata.
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("overflow.menu")}>
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
          {t("overflow.editDetails")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : undefined;

  return (
    <PageShell>
      <PageHeader
        title={evalSet.name ?? ""}
        description={evalSet.description ?? undefined}
        truncateDescription
        breadcrumb={{ label: t("back"), href: "/evals" }}
        action={primaryAction}
      />

      <WorkersWarning />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "results" | "testCases")}
        className="flex flex-col gap-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="results">{t("tabs.results")}</TabsTrigger>
          <TabsTrigger value="testCases" className="gap-2">
            {t("tabs.testCases")}
            <Badge variant="secondary" className="ml-1 px-1.5 py-0">
              {caseCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-0">
          {/* Builder C owns EvalRuns; we just render it here. Any deep-link
              from a zero-cases EmptyState into the Test cases tab will be
              wired by Builder C when they extend the component's props. */}
          <EvalRuns id={evalSetId} />
        </TabsContent>

        <TabsContent value="testCases" className="mt-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("testCases.toolbar.count", { count: caseCount })}
            </p>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Reset stale edit context — without this, opening
                    // "New case" right after editing one would put the modal
                    // into edit-mode against the previous record.
                    setEditingTestCase(null);
                    setShowCreateModal(true);
                  }}
                  disabled={capReached}
                >
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  {t("testCases.toolbar.newCase")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSelectionModal(true)}
                  disabled={capReached}
                >
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  {t("testCases.toolbar.addExisting")}
                </Button>
              </div>
            ) : null}
          </div>

          {capReached ? (
            <p className="text-xs text-muted-foreground">
              {t("testCases.capReached")}
            </p>
          ) : null}

          {caseCount === 0 ? (
            <EmptyState
              title={t("testCases.empty.title")}
              description={t("testCases.empty.description")}
            />
          ) : (
            <ul className="divide-y rounded-md border">
              {testCasesList.map((testCase) => (
                <li
                  key={testCase.id}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {testCase.name}
                    </p>
                    {testCase.description ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {testCase.description}
                      </p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    // Always-visible row actions — the prior `opacity-0
                    // group-hover` pattern was a hard rule violation
                    // (a11y / touch). Tooltips supply the label so the buttons
                    // can stay icon-only.
                    <TooltipProvider delayDuration={200}>
                      <div className="flex shrink-0 gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("testCases.row.edit")}
                              onClick={() => {
                                setEditingTestCase(testCase);
                                setShowCreateModal(true);
                              }}
                            >
                              <Pencil
                                aria-hidden="true"
                                className="size-4"
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("testCases.row.edit")}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("testCases.row.remove")}
                              onClick={() => setTestCaseToRemove(testCase.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X aria-hidden="true" className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("testCases.row.remove")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <TestCaseSelectionModal
        open={showSelectionModal}
        onClose={() => setShowSelectionModal(false)}
        onSelect={handleAddTestCases}
        excludeIds={memberCaseIds}
      />

      <TestCaseModal
        open={showCreateModal}
        // The previous version forgot to reset `editingTestCase` on close,
        // which silently kept the next "New case" click in edit-mode.
        onClose={() => {
          setShowCreateModal(false);
          setEditingTestCase(null);
        }}
        evalSetId={evalSetId}
        evalSetName={evalSet.name ?? undefined}
        onSuccess={() => {
          setShowCreateModal(false);
          setEditingTestCase(null);
          refetchTestCases();
          refetch();
        }}
        testCase={editingTestCase}
      />

      <EditEvalSetDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        evalSet={evalSet}
        canWrite={canWrite}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={!!testCaseToRemove}
        onOpenChange={(open) => !open && setTestCaseToRemove(null)}
        title={t("removeCaseConfirm.title")}
        description={t("removeCaseConfirm.description")}
        confirmLabel={t("removeCaseConfirm.confirm")}
        variant="destructive"
        onConfirm={handleRemoveTestCase}
      />
    </PageShell>
  );
}
