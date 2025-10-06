"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Loader2, Info, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { CREATE_EVAL_RUN, GET_AGENTS, GET_TEST_CASES } from "@/queries/queries";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface CreateEvalRunModalProps {
  evalSetId: string;
}

export function CreateEvalRunModal({
  evalSetId,
}: CreateEvalRunModalProps) {
  const { toast } = useToast();

  // State
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
  const [selectedEvalFunctions, setSelectedEvalFunctions] = useState<string[]>([]);
  const [evalFunctionConfigs, setEvalFunctionConfigs] = useState<Record<string, Record<string, any>>>({});
  const [scoringMethod, setScoringMethod] = useState<"median" | "sum" | "average">("average");
  const [passThreshold, setPassThreshold] = useState<number>(70);

  // Fetch agents
  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 100, filters: [] },
    skip: !open,
  });

  // Fetch test cases
  const { data: testCasesData } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSetId } }]
    },
    skip: !open,
  });

  const testCasesList = useMemo(() =>
    testCasesData?.test_casesPagination?.items || [],
    [testCasesData]
  );

  // Get selected agent details
  const selectedAgentData = useMemo(() => {
    if (!selectedAgent || !agentsData?.agentsPagination?.items) return null;
    return agentsData.agentsPagination.items.find((a: any) => a.id === selectedAgent);
  }, [selectedAgent, agentsData]);

  // Get eval functions from selected agent
  const availableEvalFunctions = useMemo(() => {
    return selectedAgentData?.evals || [];
  }, [selectedAgentData]);

  useEffect(() => {
    if (!open) {
      // Reset when closing
      setSelectedAgent("");
      setSelectedTestCases([]);
      setSelectedEvalFunctions([]);
      setEvalFunctionConfigs({});
      setScoringMethod("average");
      setPassThreshold(70);
    }
  }, [open]);

  const [createEvalRun, { loading }] = useMutation(CREATE_EVAL_RUN, {
    onCompleted: () => {
      toast({
        title: "Eval run created",
        description: "The eval run has been created successfully. You can now run it.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create eval run",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleTestCase = (testCaseId: string) => {
    setSelectedTestCases(prev =>
      prev.includes(testCaseId)
        ? prev.filter(id => id !== testCaseId)
        : [...prev, testCaseId]
    );
  };

  const handleToggleAllTestCases = () => {
    if (selectedTestCases.length === testCasesList.length) {
      setSelectedTestCases([]);
    } else {
      setSelectedTestCases(testCasesList.map((tc: any) => tc.id));
    }
  };

  const handleToggleEvalFunction = (evalFunctionId: string) => {
    setSelectedEvalFunctions(prev =>
      prev.includes(evalFunctionId)
        ? prev.filter(id => id !== evalFunctionId)
        : [...prev, evalFunctionId]
    );
  };

  const handleConfigChange = (evalFunctionId: string, configKey: string, value: any) => {
    setEvalFunctionConfigs(prev => ({
      ...prev,
      [evalFunctionId]: {
        ...(prev[evalFunctionId] || {}),
        [configKey]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAgent) {
      toast({
        title: "Validation error",
        description: "Please select an agent.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTestCases.length === 0) {
      toast({
        title: "Validation error",
        description: "Please select at least one test case.",
        variant: "destructive",
      });
      return;
    }

    if (selectedEvalFunctions.length === 0) {
      toast({
        title: "Validation error",
        description: "Please select at least one eval function.",
        variant: "destructive",
      });
      return;
    }

    createEvalRun({
      variables: {
        data: {
          evalSetId,
          agentId: selectedAgent,
          testCaseIds: selectedTestCases,
          evalFunctionIds: selectedEvalFunctions,
          config: evalFunctionConfigs,
          scoringMethod,
          passThreshold,
          rights_mode: "private",
          RBAC: null,
        },
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Eval Run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Eval Run</DialogTitle>
          <DialogDescription>
            Configure a new evaluation run for this eval set.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 p-1">
              {/* Agent Selection */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-sm">Agent</h3>
                  <p className="text-xs text-muted-foreground">Choose which agent to evaluate</p>
                </div>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
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
                {selectedAgentData && (
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <div className="text-sm">
                      <p className="font-medium">{selectedAgentData.name}</p>
                      {selectedAgentData.description && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {selectedAgentData.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {availableEvalFunctions.length} eval functions
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {selectedAgentData.backend}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Test Cases Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Test Cases</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedTestCases.length} of {testCasesList.length} selected
                    </p>
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
                    {selectedTestCases.length === testCasesList.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="border rounded-lg">
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {testCasesList.map((testCase: any) => (
                        <div
                          key={testCase.id}
                          className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleToggleTestCase(testCase.id)}
                        >
                          <Checkbox
                            checked={selectedTestCases.includes(testCase.id)}
                            onCheckedChange={() => handleToggleTestCase(testCase.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs truncate">{testCase.name}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {testCase.inputs?.length || 0} msgs
                              </Badge>
                            </div>
                            {testCase.description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                {testCase.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <Separator />

              {/* Eval Functions Selection */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-sm">Eval Functions</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedEvalFunctions.length} selected
                  </p>
                </div>
                {!selectedAgent ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Please select an agent first to see available eval functions.
                    </AlertDescription>
                  </Alert>
                ) : availableEvalFunctions.length === 0 ? (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This agent has no eval functions configured.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {availableEvalFunctions.map((evalFunc: any) => (
                      <div key={evalFunc.id} className="border rounded-lg">
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedEvalFunctions.includes(evalFunc.id)}
                              onCheckedChange={() => handleToggleEvalFunction(evalFunc.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{evalFunc.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {evalFunc.description}
                              </p>
                            </div>
                          </div>
                          {selectedEvalFunctions.includes(evalFunc.id) && evalFunc.config && evalFunc.config.length > 0 && (
                            <div className="mt-3 pl-7 space-y-2">
                              {evalFunc.config.map((configItem: any) => (
                                <div key={configItem.name} className="space-y-1">
                                  <Label htmlFor={`${evalFunc.id}-${configItem.name}`} className="text-xs">
                                    {configItem.name}
                                  </Label>
                                  <Textarea
                                    id={`${evalFunc.id}-${configItem.name}`}
                                    placeholder={configItem.description}
                                    value={evalFunctionConfigs[evalFunc.id]?.[configItem.name] || ""}
                                    onChange={(e) => handleConfigChange(evalFunc.id, configItem.name, e.target.value)}
                                    rows={2}
                                    className="text-xs"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Scoring Configuration */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-sm">Scoring</h3>
                  <p className="text-xs text-muted-foreground">Configure how scores are calculated</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scoringMethod" className="text-xs">Scoring Method</Label>
                    <Select
                      value={scoringMethod}
                      onValueChange={(value: any) => setScoringMethod(value)}
                    >
                      <SelectTrigger id="scoringMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="median">Median</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      How to combine multiple eval function scores
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passThreshold" className="text-xs">Pass Threshold</Label>
                    <Input
                      id="passThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={passThreshold}
                      onChange={(e) => setPassThreshold(Number(e.target.value))}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Minimum score (0-100) to pass
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            {/* <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button> */}
            <Button
              type="submit"
              disabled={loading || !selectedAgent || selectedTestCases.length === 0 || selectedEvalFunctions.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Eval Run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}