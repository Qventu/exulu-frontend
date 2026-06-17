"use client";

/**
 * CreateEvalRunModal — create/edit a run config.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1):
 * - Fields reorganised into three sections:
 *     1. Essentials  — Name, Agent, Test cases (multi-select)
 *     2. Eval functions — multi-select with per-function config textareas
 *     3. Advanced (Collapsible, closed by default) — Scoring method, Pass
 *        threshold, Timeout. Trigger summary: "average · pass ≥ 70 · 300s".
 * - All copy goes through next-intl keys (evals.runs.runConfig.*).
 * - Data contract is UNCHANGED — `rights_mode`, `RBAC.users/roles`, and
 *   the scoring-method casing (uppercase on submit) are all preserved.
 *   The previous mutation shape stays bit-for-bit identical so the BE
 *   schema doesn't need to move with this redesign.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { ChevronDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  CREATE_EVAL_RUN,
  GET_AGENTS,
  GET_EVAL_FUNCTIONS,
  GET_TEST_CASES,
  UPDATE_EVAL_RUN,
} from "@/queries/queries";
import type { Eval } from "@/types/models/eval";
import type { EvalRun, ScoringMethod } from "@/types/models/eval-run";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CreateEvalRunModalProps {
  modalKey: string;
  eval_set_id: string;
  onCreateSuccess?: () => void;
  existingRun?: EvalRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEvalRunModal({
  modalKey,
  eval_set_id,
  onCreateSuccess,
  existingRun = null,
  open,
  onOpenChange,
}: CreateEvalRunModalProps) {
  const t = useTranslations("evals.runs.runConfig");
  const isEditing = !!existingRun && !!existingRun.id;

  const [evalRun, setEvalRun] = useState<EvalRun>({
    id: "",
    name: "",
    rights_mode: "private",
    createdAt: "",
    updatedAt: "",
    eval_set_id,
    agent_id: "",
    eval_functions: [],
    scoring_method: "average",
    pass_threshold: 70,
    timeout_in_seconds: 300,
    test_case_ids: [],
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (existingRun) {
      setEvalRun(existingRun);
    } else {
      setEvalRun({
        id: "",
        name: "",
        rights_mode: "private",
        createdAt: "",
        updatedAt: "",
        eval_set_id,
        agent_id: "",
        eval_functions: [],
        scoring_method: "average",
        pass_threshold: 70,
        timeout_in_seconds: 300,
        test_case_ids: [],
      });
    }
  }, [existingRun, eval_set_id]);

  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 100, filters: [] },
    skip: !eval_set_id,
  });
  const { data: evalFunctionsData } = useQuery(GET_EVAL_FUNCTIONS, {
    skip: !eval_set_id,
  });
  const { data: testCasesData } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: eval_set_id } }],
    },
    skip: !eval_set_id,
  });

  const testCasesList = testCasesData?.test_casesPagination?.items || [];
  const evalFunctionsList: Eval[] = evalFunctionsData?.evals?.items || [];

  const [createEvalRun, { loading: createLoading }] = useMutation(
    CREATE_EVAL_RUN,
    {
      onCompleted: () => {
        toast.success(t("submit.create"));
        onCreateSuccess?.();
        onOpenChange(false);
      },
      onError: (error) =>
        toast.error(t("submit.create"), { description: error.message }),
    },
  );
  const [updateEvalRun, { loading: updateLoading }] = useMutation(
    UPDATE_EVAL_RUN,
    {
      onCompleted: () => {
        toast.success(t("submit.update"));
        onCreateSuccess?.();
        onOpenChange(false);
      },
      onError: (error) =>
        toast.error(t("submit.update"), { description: error.message }),
    },
  );
  const loading = createLoading || updateLoading;

  const toggleTestCase = (id: string) =>
    setEvalRun((p) => ({
      ...p,
      test_case_ids: p.test_case_ids.includes(id)
        ? p.test_case_ids.filter((v) => v !== id)
        : [...p.test_case_ids, id],
    }));
  const toggleAllTestCases = () =>
    setEvalRun((p) => ({
      ...p,
      test_case_ids:
        p.test_case_ids.length === testCasesList.length
          ? []
          : testCasesList.map((tc: any) => tc.id),
    }));
  const toggleEvalFunction = (fn: { id: string; name: string }) =>
    setEvalRun((p) => ({
      ...p,
      eval_functions: p.eval_functions.some((ef) => ef.id === fn.id)
        ? p.eval_functions.filter((ef) => ef.id !== fn.id)
        : [...p.eval_functions, { ...fn, config: {} }],
    }));
  const toggleAllEvalFunctions = () =>
    setEvalRun((p) => ({
      ...p,
      eval_functions:
        p.eval_functions.length === evalFunctionsList.length
          ? []
          : evalFunctionsList.map((e) => ({
              id: e.id,
              name: e.name,
              config: {},
            })),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalRun.name) {
      toast.error(t("validation.nameRequired"));
      return;
    }
    if (!evalRun.agent_id) {
      toast.error(t("validation.agentRequired"));
      return;
    }
    if (evalRun.test_case_ids.length === 0) {
      toast.error(t("validation.casesRequired"));
      return;
    }
    if (evalRun.eval_functions.length === 0) {
      toast.error(t("validation.functionsRequired"));
      return;
    }

    const data = {
      name: evalRun.name,
      eval_set_id,
      agent_id: evalRun.agent_id,
      test_case_ids: evalRun.test_case_ids,
      eval_functions: evalRun.eval_functions,
      scoring_method: evalRun.scoring_method.toUpperCase() as ScoringMethod,
      pass_threshold: evalRun.pass_threshold,
      timeout_in_seconds: evalRun.timeout_in_seconds,
      rights_mode: evalRun.rights_mode,
      RBAC: {
        users: evalRun.RBAC?.users,
        roles: evalRun.RBAC?.roles,
      },
    };
    if (isEditing) {
      updateEvalRun({ variables: { id: evalRun.id, data } });
    } else {
      createEvalRun({ variables: { data } });
    }
  };

  const advancedSummary = t("advanced", {
    summary: t("advancedSummary", {
      method: t(`scoringMethod.${evalRun.scoring_method}` as const),
      threshold: evalRun.pass_threshold,
      timeout: evalRun.timeout_in_seconds,
    }),
  });

  return (
    <Dialog key={modalKey} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? t("editTitle") : t("createTitle")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="-mx-6 flex-1 px-6">
            <div className="space-y-6 pb-4">
              {/* ─── Essentials ───────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="eval-run-name" className="text-sm font-semibold">
                    {t("nameLabel")}
                  </Label>
                  <Input
                    id="eval-run-name"
                    type="text"
                    placeholder="e.g., GPT-4 baseline evaluation"
                    value={evalRun.name}
                    onChange={(e) =>
                      setEvalRun((p) => ({ ...p, name: e.target.value }))
                    }
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {t("agentLabel")}
                  </Label>
                  <Select
                    value={evalRun.agent_id}
                    onValueChange={(value) =>
                      setEvalRun((p) => ({ ...p, agent_id: value }))
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select an agent…" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentsData?.agentsPagination?.items?.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">
                        {t("testCasesLabel")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {evalRun.test_case_ids.length} of {testCasesList.length}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllTestCases();
                      }}
                    >
                      {evalRun.test_case_ids.length === testCasesList.length
                        ? t("deselectAll")
                        : t("selectAll")}
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-card">
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-2 p-3">
                        {testCasesList.map((tc: any) => (
                          <label
                            key={tc.id}
                            htmlFor={`tc-${tc.id}`}
                            className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-accent"
                          >
                            <Checkbox
                              id={`tc-${tc.id}`}
                              checked={evalRun.test_case_ids.includes(tc.id)}
                              onCheckedChange={() => toggleTestCase(tc.id)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">
                                  {tc.name}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 text-[10px]"
                                >
                                  {tc.inputs?.length || 0} msgs
                                </Badge>
                              </div>
                              {tc.description ? (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {tc.description}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </section>

              <Separator />

              {/* ─── Eval functions ──────────────────────────────────── */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">
                      {t("evalFunctionsLabel")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {evalRun.eval_functions.length} of{" "}
                      {evalFunctionsList.length}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAllEvalFunctions();
                    }}
                  >
                    {evalRun.eval_functions.length === evalFunctionsList.length
                      ? t("deselectAll")
                      : t("selectAll")}
                  </Button>
                </div>
                <div className="rounded-lg border bg-card">
                  <div className="space-y-2 p-3">
                    {evalFunctionsList.map((_eval: Eval) => {
                      const checked = evalRun.eval_functions.some(
                        (ef) => ef.id === _eval.id,
                      );
                      return (
                        <label
                          key={_eval.id}
                          htmlFor={`eval-${_eval.id}`}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-border hover:bg-accent"
                        >
                          <Checkbox
                            id={`eval-${_eval.id}`}
                            checked={checked}
                            onCheckedChange={() =>
                              toggleEvalFunction({
                                id: _eval.id,
                                name: _eval.name,
                              })
                            }
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {_eval.name}
                              </span>
                            </div>
                            {_eval.description ? (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {_eval.description}
                              </p>
                            ) : null}
                            {_eval.config &&
                            _eval.config.length > 0 &&
                            checked ? (
                              <div className="mt-3 space-y-3 border-t pt-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Configuration
                                </p>
                                {_eval.config.map((cfg: any) => (
                                  <div
                                    key={cfg.name}
                                    className="space-y-1.5"
                                  >
                                    <Label
                                      htmlFor={`${_eval.id}-${cfg.name}`}
                                      className="text-xs font-medium"
                                    >
                                      {cfg.name}
                                    </Label>
                                    <Textarea
                                      id={`${_eval.id}-${cfg.name}`}
                                      placeholder={cfg.description}
                                      value={
                                        evalRun.eval_functions.find(
                                          (ef) => ef.id === _eval.id,
                                        )?.config?.[cfg.name] || ""
                                      }
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setEvalRun((prev) => ({
                                          ...prev,
                                          eval_functions:
                                            prev.eval_functions.map((ef) =>
                                              ef.id === _eval.id
                                                ? {
                                                    ...ef,
                                                    config: {
                                                      ...ef.config,
                                                      [cfg.name]:
                                                        e.target.value,
                                                    },
                                                  }
                                                : ef,
                                            ),
                                        }));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="min-h-[80px] resize-none text-xs"
                                    />
                                    {cfg.description ? (
                                      <p className="text-xs leading-relaxed text-muted-foreground">
                                        {cfg.description}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>

              <Separator />

              {/* ─── Advanced (collapsible) ──────────────────────────── */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="font-medium">{advancedSummary}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        advancedOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="scoringMethod"
                        className="text-xs font-semibold"
                      >
                        {t("scoringMethodLabel")}
                      </Label>
                      <Select
                        value={evalRun.scoring_method}
                        onValueChange={(v) =>
                          setEvalRun((p) => ({
                            ...p,
                            scoring_method: v as ScoringMethod,
                          }))
                        }
                      >
                        <SelectTrigger id="scoringMethod" className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="average">
                            {t("scoringMethod.average")}
                          </SelectItem>
                          <SelectItem value="median">
                            {t("scoringMethod.median")}
                          </SelectItem>
                          <SelectItem value="sum">
                            {t("scoringMethod.sum")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="passThreshold"
                        className="text-xs font-semibold"
                      >
                        {t("passThresholdLabel")}
                      </Label>
                      <Input
                        id="passThreshold"
                        type="number"
                        min={0}
                        max={100}
                        value={evalRun.pass_threshold}
                        onChange={(e) =>
                          setEvalRun((p) => ({
                            ...p,
                            pass_threshold: Number(e.target.value),
                          }))
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label
                        htmlFor="timeoutInSeconds"
                        className="text-xs font-semibold"
                      >
                        {t("timeoutLabel")}
                      </Label>
                      <Input
                        id="timeoutInSeconds"
                        type="number"
                        min={1}
                        value={evalRun.timeout_in_seconds}
                        onChange={(e) =>
                          setEvalRun((p) => ({
                            ...p,
                            timeout_in_seconds: Number(e.target.value),
                          }))
                        }
                        className="h-10"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>

          <Separator className="my-4" />
          <DialogFooter className="shrink-0">
            <Button
              type="submit"
              disabled={
                loading ||
                !evalRun.name ||
                !evalRun.agent_id ||
                evalRun.test_case_ids.length === 0 ||
                evalRun.eval_functions.length === 0
              }
              className="h-11 w-full"
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? t("submit.update") : t("submit.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
