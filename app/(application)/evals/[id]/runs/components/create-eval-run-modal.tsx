"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CREATE_EVAL_RUN, UPDATE_EVAL_RUN, GET_AGENTS, GET_EVAL_FUNCTIONS, GET_TEST_CASES } from "@/queries/queries";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eval } from "@/types/models/eval";
import { EvalRun, ScoringMethod } from "@/types/models/eval-run";

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
  const { toast } = useToast();
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

  // Reset form when existingRun changes
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

  // Fetch agents
  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 100, filters: [] },
    skip: !eval_set_id,
  });

  const { data: evalFunctionsData } = useQuery(GET_EVAL_FUNCTIONS, {
    skip: !eval_set_id,
  });

  // Fetch test cases
  const { data: testCasesData } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: eval_set_id } }]
    },
    skip: !eval_set_id,
  });

  const testCasesList = testCasesData?.test_casesPagination?.items || [];

  const [createEvalRun, { loading: createLoading }] = useMutation(CREATE_EVAL_RUN, {
    onCompleted: () => {
      toast({
        title: "Eval run created",
        description: "The eval run has been created successfully. You can now run it.",
      });
      if (onCreateSuccess) {
        onCreateSuccess();
      }
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create eval run",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [updateEvalRun, { loading: updateLoading }] = useMutation(UPDATE_EVAL_RUN, {
    onCompleted: () => {
      toast({
        title: "Eval run updated",
        description: "The eval run has been updated successfully.",
      });
      if (onCreateSuccess) {
        onCreateSuccess();
      }
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update eval run",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loading = createLoading || updateLoading;

  const handleToggleTestCase = (testCaseId: string) => {
    setEvalRun(prev => ({
      ...prev,
      test_case_ids: prev.test_case_ids.includes(testCaseId)
        ? prev.test_case_ids.filter(id => id !== testCaseId)
        : [...prev.test_case_ids, testCaseId]
    }))
  };

  const handleToggleAllTestCases = () => {
    setEvalRun(prev => ({
      ...prev,
      test_case_ids: prev.test_case_ids.length === testCasesList.length
        ? []
        : testCasesList.map((tc: any) => tc.id)
    }))
  };

  const handleToggleEvalFunction = (evalFunction: { id: string; name: string }) => {
    setEvalRun(prev => ({
      ...prev,
      eval_functions: prev.eval_functions.some(ef => ef.id === evalFunction.id)
        ? prev.eval_functions.filter(ef => ef.id !== evalFunction.id)
        : [...prev.eval_functions, { ...evalFunction, config: {} }]
    }))
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log("[EXULU] Eval run", evalRun);

    if (!evalRun.name) {
      toast({
        title: "Validation error",
        description: "Please enter a name for this eval run.",
        variant: "destructive",
      });
      return;
    }

    if (!evalRun.agent_id) {
      toast({
        title: "Validation error",
        description: "Please select an agent.",
        variant: "destructive",
      });
      return;
    }

    if (evalRun.test_case_ids.length === 0) {
      toast({
        title: "Validation error",
        description: "Please select at least one test case.",
        variant: "destructive",
      });
      return;
    }

    if (evalRun.eval_functions.length === 0) {
      toast({
        title: "Validation error",
        description: "Please select at least one eval function.",
        variant: "destructive",
      });
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
        projects: evalRun.RBAC?.projects,
      },
    };

    if (isEditing) {
      updateEvalRun({
        variables: {
          id: evalRun.id,
          data,
        },
      });
    } else {
      createEvalRun({
        variables: {
          data,
        },
      });

    }
  };

  return (
    <Dialog key={modalKey} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Eval Run" : "Create Eval Run"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the configuration for this eval run." : "Configure a new evaluation run for this eval set."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-4">
              {/* Name Input */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">Name</h3>
                    <p className="text-xs text-muted-foreground">Give this eval run a descriptive name</p>
                  </div>
                </div>
                <Input
                  type="text"
                  placeholder="e.g., GPT-4 baseline evaluation"
                  value={evalRun.name}
                  onChange={(e) => setEvalRun(prev => ({ ...prev, name: e.target.value }))}
                  className="h-11"
                />
              </div>
              <Separator />
              {/* Agent Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">Agent</h3>
                    <p className="text-xs text-muted-foreground">Choose which agent to evaluate</p>
                  </div>
                </div>
                <Select value={evalRun.agent_id} onValueChange={(value: string) => setEvalRun(prev => ({ ...prev, agent_id: value }))}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select an agent..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agentsData?.agentsPagination?.items?.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              {/* Eval Functions Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <h3 className="font-semibold text-sm">Eval Functions</h3>
                      <p className="text-xs text-muted-foreground">
                        {evalRun.eval_functions.length} of {evalFunctionsData?.evals?.items?.length || 0} selected
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (evalRun.eval_functions.length === evalFunctionsData?.evals?.items?.length) {
                        setEvalRun(prev => ({
                          ...prev,
                          eval_functions: []
                        }));
                      } else {
                        setEvalRun(prev => ({
                          ...prev,
                          eval_functions: evalFunctionsData?.evals?.items?.map((e: Eval) => ({ id: e.id, name: e.name, config: {} })) || []
                        }));
                      }
                    }}
                  >
                    {evalRun.eval_functions.length === evalFunctionsData?.evals?.items?.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="border rounded-lg bg-card">
                  <div className="p-3 space-y-2">
                    {evalFunctionsData?.evals?.items?.map((_eval: Eval) => (
                      <label
                        key={_eval.id}
                        htmlFor={`eval-${_eval.id}`}
                        className="flex items-start gap-3 p-3 rounded-md hover:bg-accent transition-colors cursor-pointer border border-transparent hover:border-border"
                      >
                        <Checkbox
                          id={`eval-${_eval.id}`}
                          checked={evalRun.eval_functions.some(ef => ef.id === _eval.id)}
                          onCheckedChange={() => handleToggleEvalFunction({ id: _eval.id, name: _eval.name })}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{_eval.name}</span>
                          </div>
                          {_eval.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {_eval.description}
                            </p>
                          )}
                          {_eval.config && _eval.config.length > 0 && evalRun.eval_functions.some(ef => ef.id === _eval.id) && (
                            <div className="mt-3 space-y-3 pt-3 border-t">
                              <p className="text-xs font-medium text-muted-foreground">Configuration</p>
                              {_eval.config.map((config: any) => (
                                <div key={config.name} className="space-y-1.5">
                                  <Label htmlFor={`${_eval.id}-${config.name}`} className="text-xs font-medium">
                                    {config.name}
                                  </Label>
                                  <Textarea
                                    id={`${_eval.id}-${config.name}`}
                                    placeholder={config.description}
                                    value={evalRun.eval_functions.find(ef => ef.id === _eval.id)?.config?.[config.name] || ''}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setEvalRun(prev => ({ ...prev, eval_functions: prev.eval_functions.map(ef => ef.id === _eval.id ? { ...ef, config: { ...ef.config, [config.name]: e.target.value } } : ef) }));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="min-h-[80px] text-xs resize-none"
                                  />
                                  {config.description && (
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      {config.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Test Cases Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <h3 className="font-semibold text-sm">Test Cases</h3>
                      <p className="text-xs text-muted-foreground">
                        {evalRun.test_case_ids.length} of {testCasesList.length} selected
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleAllTestCases();
                    }}
                  >
                    {evalRun.test_case_ids.length === testCasesList.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="border rounded-lg bg-card">
                  <ScrollArea className="h-[250px]">
                    <div className="p-3 space-y-2">
                      {testCasesList.map((testCase: any) => (
                        <label
                          key={testCase.id}
                          htmlFor={`test-case-${testCase.id}`}
                          className="flex items-start gap-3 p-3 rounded-md hover:bg-accent transition-colors cursor-pointer border border-transparent hover:border-border"
                        >
                          <Checkbox
                            id={`test-case-${testCase.id}`}
                            checked={evalRun.test_case_ids.includes(testCase.id)}
                            onCheckedChange={() => handleToggleTestCase(testCase.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{testCase.name}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {testCase.inputs?.length || 0} msgs
                              </Badge>
                            </div>
                            {testCase.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {testCase.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <Separator />
              {/* Scoring Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">Scoring</h3>
                    <p className="text-xs text-muted-foreground">Configure how scores are calculated</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="scoringMethod" className="text-xs font-semibold">Scoring Method</Label>
                    <Select
                      value={evalRun.scoring_method}
                      onValueChange={(value: any) => setEvalRun(prev => ({ ...prev, scoring_method: value as ScoringMethod }))}>
                      <SelectTrigger id="scoringMethod" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="median">Median</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      How to combine multiple eval function scores
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passThreshold" className="text-xs font-semibold">Pass Threshold</Label>
                    <Input
                      id="passThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={evalRun.pass_threshold}
                      onChange={(e) => setEvalRun(prev => ({ ...prev, pass_threshold: Number(e.target.value) }))}
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Minimum score (0-100) to pass
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeoutInSeconds" className="text-xs font-semibold">Timeout (seconds)</Label>
                    <Input
                      id="timeoutInSeconds"
                      type="number"
                      min="1"
                      value={evalRun.timeout_in_seconds}
                      onChange={(e) => setEvalRun(prev => ({ ...prev, timeout_in_seconds: Number(e.target.value) }))}
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Max time per test case execution
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <DialogFooter className="shrink-0">
            <Button
              type="submit"
              disabled={loading || !evalRun.name || !evalRun.agent_id || evalRun.test_case_ids.length === 0 || evalRun.eval_functions.length === 0}
              className="w-full h-11">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Eval Run" : "Create Eval Run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog >
  );
}