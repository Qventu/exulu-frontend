"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Edit, Eye, Info, List, Play, Settings, Trash2, Calendar, Clock, MoreHorizontal, Lock, Globe, Users, Shield, CheckCircle2, AlertCircle, XCircle, Minus } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaveWorkflowModal } from "@/components/save-workflow-modal";
import { formatDistanceToNow, format } from "date-fns";
import { useQuery, useMutation } from "@apollo/client";
import { GET_JOBS, REMOVE_WORKFLOW_TEMPLATE_BY_ID, GET_WORKFLOW_TEMPLATES, GET_JOB_RESULTS, GET_JOB_RESULTS_LIGHT, GET_JOB_RESULT_BY_ID, GET_AGENT_BY_ID, GET_WORKFLOW_SCHEDULE, UPSERT_WORKFLOW_SCHEDULE, DELETE_WORKFLOW_SCHEDULE } from "@/queries/queries";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { CodePreview } from "@/components/custom/code-preview";
import { TextPreview } from "@/components/custom/text-preview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import cron from "cron-validator";

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  agent: string;
  created_by: number;
  rights_mode: "private" | "users" | "roles" | "teams" | "public"/*  | "projects" */;
  RBAC: {
    users: Array<{ id: number; rights: "read" | "write" }>;
    roles: Array<{ id: string; rights: "read" | "write" }>;
    teams: Array<{ id: string; rights: "read" | "write" }>;
    // projects: Array<{ id: string; rights: "read" | "write" }>;
  };
  variables?: any[];
  steps_json?: any[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowWithLastRun = Workflow & {
  lastRunAt?: string;
  lastRunStatus?: string;
};

function useLastRunForWorkflow(workflowId: string) {
  const { data: lastJobData, loading: lastJobLoading, previousData: lastJobPreviousData } = useQuery(GET_JOB_RESULTS, {
    skip: !workflowId,
    variables: {
      page: 1,
      limit: 1,
      filters: [
        {
          label: { contains: workflowId }
        }
      ],
      sort: { field: "createdAt", direction: "DESC" }
    },
    pollInterval: 5000 // Poll every 5 seconds for recent runs
  });

  const lastJob = lastJobData?.job_resultsPagination?.items?.[0] || lastJobPreviousData?.job_resultsPagination?.items?.[0];

  return {
    result: lastJob?.result,
    error: lastJob?.error,
    metadata: lastJob?.metadata,
    lastRunAt: lastJob?.createdAt,
    lastRunStatus: lastJob?.state
  };
}

function StatusIndicator({ status }: { status?: string }) {
  if (!status) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Minus className="h-4 w-4 text-gray-400" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Never run</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, color: 'text-green-600', label: 'Completed successfully' };
      case 'failed':
      case 'stuck':
        return { icon: XCircle, color: 'text-red-600', label: 'Failed' };
      case 'active':
      case 'waiting':
      case 'delayed':
      case 'paused':
        return { icon: AlertCircle, color: 'text-blue-600', label: 'In progress' };
      default:
        return { icon: Minus, color: 'text-gray-400', label: 'Unknown status' };
    }
  };

  const { icon: Icon, color, label } = getStatusIcon();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={`h-4 w-4 ${color}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LastRunCell({ workflowId }: { workflowId: string }) {
  const { lastRunAt, lastRunStatus } = useLastRunForWorkflow(workflowId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Fetch lightweight list of runs for this workflow (only id, state, label, createdAt)
  const { data: allRunsData, loading: allRunsLoading } = useQuery(GET_JOB_RESULTS_LIGHT, {
    skip: !workflowId || !isDialogOpen,
    variables: {
      page: 1,
      limit: 50, // Get last 50 runs
      filters: [
        {
          label: { contains: workflowId }
        }
      ],
      sort: { field: "createdAt", direction: "DESC" }
    },
    fetchPolicy: "network-only",
  });

  // Fetch full details for the selected run
  const { data: selectedRunData, loading: selectedRunLoading } = useQuery(GET_JOB_RESULT_BY_ID, {
    skip: !selectedRunId,
    variables: { id: selectedRunId },
    fetchPolicy: "network-only",
  });

  const allRuns = allRunsData?.job_resultsPagination?.items || [];
  const selectedRun = selectedRunData?.job_resultById;

  // Auto-select the first run when data loads
  useEffect(() => {
    if (isDialogOpen && allRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(allRuns[0]?.id);
    }
  }, [allRuns, isDialogOpen, selectedRunId]);

  // Handle dialog open/close
  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedRunId(null);
    }
  };

  if (!lastRunAt) {
    return (
      <div className="flex items-center gap-2">
        <StatusIndicator />
        <span className="text-muted-foreground text-sm">Never run</span>
      </div>
    );
  }

  const hasResultOrError = lastRunStatus;

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-2">
              <StatusIndicator status={lastRunStatus} />
              <div className="flex flex-col gap-1">
                <div onClick={() => {
                  if (hasResultOrError) {
                    handleDialogOpenChange(true);
                  }
                }} className={`text-sm flex items-center gap-2 ${hasResultOrError ? 'cursor-pointer hover:underline' : ''}`}>
                  {formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>View run details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-[90vw] h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Template Run History</DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Previous Runs List - Left Sidebar */}
            <div className="w-80 border-r flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold">Previous Runs ({allRuns.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {allRunsLoading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Loading runs...
                  </div>
                ) : allRuns.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No runs found
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {allRuns.map((run: any) => {
                      const isSelected = selectedRun?.id === run.id;
                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case 'completed': return 'text-green-600';
                          case 'failed': case 'stuck': return 'text-red-600';
                          case 'active': case 'waiting': case 'delayed': case 'paused': return 'text-blue-600';
                          default: return 'text-gray-600';
                        }
                      };

                      return (
                        <button
                          key={run.id}
                          onClick={() => setSelectedRunId(run.id)}
                          className={`w-full text-left p-3 rounded-md transition-colors ${
                            isSelected
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-muted/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIndicator status={run.state} />
                            <span className={`text-xs font-medium ${getStatusColor(run.state)}`}>
                              {run.state}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(run.createdAt), "PPp")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Run Details - Main Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {selectedRunLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                    <p className="text-sm text-muted-foreground">Loading run details...</p>
                  </div>
                </div>
              ) : selectedRun ? (
                <div className="space-y-6">
                  {/* Run Header */}
                  <div className="flex items-center justify-between pb-4 border-b">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIndicator status={selectedRun.state} />
                        <Badge variant="outline" className={
                          selectedRun.state === 'completed' ? 'bg-green-100 text-green-800' :
                          selectedRun.state === 'failed' || selectedRun.state === 'stuck' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {selectedRun.state}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(selectedRun.createdAt), "PPpp")}
                      </div>
                    </div>
                  </div>

                  {/* Result */}
                  {selectedRun.result && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Result</h3>
                      <CodePreview
                        code={typeof selectedRun.result === 'string' ? selectedRun.result : JSON.stringify(selectedRun.result, null, 2)}
                        language="json"
                        slice={null}
                      />
                    </div>
                  )}

                  {/* Error */}
                  {selectedRun.error && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-red-600">Error</h3>
                      <CodePreview
                        code={typeof selectedRun.error === 'string' ? selectedRun.error : JSON.stringify(selectedRun.error, null, 2)}
                        language="json"
                        slice={null}
                      />
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedRun.metadata && Object.keys(selectedRun.metadata).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Metadata</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-1/3">Key</TableHead>
                              <TableHead>Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(selectedRun.metadata).map(([key, value]) => {
                              let valueContent = typeof value === 'object'
                                ? JSON.stringify(value, null, 2)
                                : String(value);
                              return (
                                <TableRow key={key}>
                                  <TableCell className="font-medium">{key}</TableCell>
                                  <TableCell>
                                    <TextPreview text={valueContent} />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* No Data Message */}
                  {!selectedRun.result && !selectedRun.error && (!selectedRun.metadata || Object.keys(selectedRun.metadata).length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No additional details available for this run</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a run from the list to view details</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// CRON presets
const CRON_PRESETS = [
  { label: "Every day at 00:00", value: "0 0 * * *", description: "Runs once daily at midnight" },
  { label: "Every hour", value: "0 * * * *", description: "Runs at the start of every hour" },
  { label: "Weekdays at 09:00", value: "0 9 * * 1-5", description: "Monday to Friday at 9 AM" },
  { label: "Every 15 minutes", value: "*/15 * * * *", description: "Runs 4 times per hour" },
  { label: "Every 30 minutes", value: "*/30 * * * *", description: "Runs twice per hour" },
  { label: "Weekly on Sunday 00:00", value: "0 0 * * 0", description: "Every Sunday at midnight" },
  { label: "Monthly on 1st at 09:00", value: "0 9 1 * *", description: "First day of month at 9 AM" },
];

function ScheduleManagementDialog({
  workflowId,
  workflowName,
  isOpen,
  onClose,
}: {
  workflowId: string;
  workflowName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [scheduleMode, setScheduleMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customCron, setCustomCron] = useState<string>("");
  const [cronError, setCronError] = useState<string>("");

  const { data: scheduleData, loading: scheduleLoading, refetch } = useQuery(GET_WORKFLOW_SCHEDULE, {
    variables: { workflow: workflowId },
    skip: !workflowId || !isOpen,
    fetchPolicy: "network-only",
  });

  const [upsertSchedule, { loading: upserting }] = useMutation(UPSERT_WORKFLOW_SCHEDULE, {
    refetchQueries: [
      { query: GET_WORKFLOW_SCHEDULE, variables: { workflow: workflowId } }
    ],
    onCompleted: () => {
      toast({
        title: "Schedule saved",
        description: "The workflow schedule has been successfully saved.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save schedule: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const [deleteSchedule, { loading: deleting }] = useMutation(DELETE_WORKFLOW_SCHEDULE, {
    refetchQueries: [
      { query: GET_WORKFLOW_SCHEDULE, variables: { workflow: workflowId } }
    ],
    onCompleted: () => {
      toast({
        title: "Schedule deleted",
        description: "The workflow schedule has been successfully deleted.",
      });
      setSelectedPreset("");
      setCustomCron("");
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete schedule: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const existingSchedule = scheduleData?.workflowSchedule?.schedule;

  const validateAndSetCustomCron = (value: string) => {
    setCustomCron(value);
    if (!value) {
      setCronError("");
      return;
    }

    if (cron.isValidCron(value, { seconds: false })) {
      setCronError("");
    } else {
      setCronError("Invalid CRON expression. Format: minute hour day month weekday");
    }
  };

  const handleSave = async () => {
    const scheduleToSave = scheduleMode === "preset" ? selectedPreset : customCron;

    if (!scheduleToSave) {
      toast({
        title: "Error",
        description: "Please select a preset or enter a custom CRON expression.",
        variant: "destructive",
      });
      return;
    }

    if (!cron.isValidCron(scheduleToSave, { seconds: false })) {
      toast({
        title: "Error",
        description: "Invalid CRON expression. Please check your input.",
        variant: "destructive",
      });
      return;
    }

    await upsertSchedule({
      variables: {
        workflow: workflowId,
        schedule: scheduleToSave,
      },
    });
  };

  const handleDelete = async () => {
    await deleteSchedule({
      variables: {
        workflow: workflowId,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Schedule for "{workflowName}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {scheduleLoading ? (
            <div className="text-sm text-muted-foreground">Loading schedule...</div>
          ) : existingSchedule ? (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Current Schedule</h3>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete Schedule
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <code className="text-sm font-mono">{existingSchedule}</code>
              </div>
              {scheduleData?.workflowSchedule?.next && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Next run: {format(new Date(scheduleData.workflowSchedule.next), "PPpp")}
                </div>
              )}
            </div>
          ) : null}

          <Tabs value={scheduleMode} onValueChange={(v) => setScheduleMode(v as "preset" | "custom")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preset">Presets</TabsTrigger>
              <TabsTrigger value="custom">Custom CRON</TabsTrigger>
            </TabsList>

            <TabsContent value="preset" className="space-y-3 mt-4">
              <Label>Select a schedule preset</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{preset.label}</span>
                        <span className="text-xs text-muted-foreground">{preset.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">CRON Expression:</div>
                  <code className="text-sm font-mono">{selectedPreset}</code>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-3 mt-4">
              <div>
                <Label htmlFor="custom-cron">CRON Expression</Label>
                <Input
                  id="custom-cron"
                  value={customCron}
                  onChange={(e) => validateAndSetCustomCron(e.target.value)}
                  placeholder="e.g., 0 12 * * *"
                  className={cronError ? "border-red-500" : ""}
                />
                {cronError && (
                  <p className="text-xs text-red-500 mt-1">{cronError}</p>
                )}
              </div>
              <div className="p-3 bg-muted rounded-md text-xs space-y-1">
                <div className="font-semibold mb-2">CRON Format:</div>
                <div className="font-mono">minute hour day month weekday</div>
                <div className="text-muted-foreground mt-2">
                  <div>• minute: 0-59</div>
                  <div>• hour: 0-23</div>
                  <div>• day: 1-31</div>
                  <div>• month: 1-12</div>
                  <div>• weekday: 0-7 (0 and 7 are Sunday)</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={upserting}>
            {upserting ? "Saving..." : "Save Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VisibilityIndicator({ workflow }: { workflow: Workflow }) {
  const getVisibilityInfo = () => {
    const visibility = workflow.rights_mode || 'private';
    switch (visibility) {
      case 'private':
        return {
          icon: Lock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          label: 'Private',
          description: 'Only you can access'
        };
      case 'public':
        return {
          icon: Globe,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          label: 'Public',
          description: 'Everyone can access'
        };
      case 'users':
        return {
          icon: Users,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          label: `Users (${workflow.RBAC.users?.length || 0})`,
          description: `Shared with ${workflow.RBAC.users?.length || 0} specific users`
        };
      case 'roles':
        return {
          icon: Shield,
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          label: `Roles (${workflow.RBAC.roles?.length || 0})`,
          description: `Shared with ${workflow.RBAC.roles?.length || 0} roles`
        };
      default:
        return {
          icon: Lock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          label: 'Private',
          description: 'Only you can access'
        };
    }
  };

  const { icon: Icon, color, bgColor, label, description } = getVisibilityInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${bgColor}`}>
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className={`text-xs font-medium ${color}`}>{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function QueueAndScheduleCell({
  workflowId,
  workflowName,
  agentId,
  onShowQueueManagementModal
}: {
  workflowId: string;
  workflowName: string;
  agentId: string;
  onShowQueueManagementModal: (queueName: string) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: agentData, loading: agentLoading, previousData } = useQuery(GET_AGENT_BY_ID, {
    skip: !agentId,
    variables: { id: agentId },
    fetchPolicy: "cache-first",
  });

  const { data: scheduleData, loading: scheduleLoading } = useQuery(GET_WORKFLOW_SCHEDULE, {
    variables: { workflow: workflowId },
    skip: !workflowId,
    pollInterval: 30000, // Poll every 30 seconds
  });

  const data = agentData || previousData;
  const queueName = data?.agentById?.workflows?.queue?.name;
  const hasSchedule = scheduleData?.workflowSchedule?.schedule;
  const loading = agentLoading || scheduleLoading;

  if (!agentId) {
    return <span className="text-sm text-muted-foreground">No Agent</span>;
  }

  if (loading && !data) {
    return <span className="text-sm text-muted-foreground">Loading...</span>;
  }

  if (!queueName) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">No queue configured.</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Queue Info */}
        <div
          className="text-sm capitalize cursor-pointer hover:underline flex items-center gap-1"
          onClick={() => onShowQueueManagementModal(queueName)}
        >
          <List className="h-3 w-3 text-muted-foreground" />
          {queueName?.replaceAll("_", " ")}
        </div>

        {/* Schedule Info */}
        <div className="flex items-center gap-2">
          {hasSchedule ? (
            <>
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  Scheduled
                </Badge>
                <code className="text-xs font-mono text-muted-foreground">
                  {scheduleData.workflowSchedule.schedule}
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsDialogOpen(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsDialogOpen(true)}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Add Schedule
            </Button>
          )}
        </div>
      </div>

      <ScheduleManagementDialog
        workflowId={workflowId}
        workflowName={workflowName}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}

function WorkflowActionsCell({
  workflow,
  user,
  onRunWorkflow,
}: {
  workflow: WorkflowWithLastRun;
  user: any;
  onRunWorkflow: (workflowId: string) => void;
}
) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const { toast } = useToast();

  // Determine if user has write access
  const hasWriteAccess = (() => {
    if (workflow.created_by === user.id) return true;
    if (workflow.rights_mode === 'public') return false; // Public workflows can only be edited by owner
    if (workflow.rights_mode === 'users' && workflow.RBAC.users) {
      const userAccess = workflow.RBAC.users.find(u => u.id === user.id.toString());
      return userAccess?.rights === 'write';
    }
    if (workflow.rights_mode === 'roles' && workflow.RBAC.roles && user.role) {
      const roleAccess = workflow.RBAC.roles.find(r => r.id === user.role);
      return roleAccess?.rights === 'write';
    }
    return false;
  })();

  const [removeWorkflow] = useMutation(REMOVE_WORKFLOW_TEMPLATE_BY_ID, {
    refetchQueries: [GET_WORKFLOW_TEMPLATES, "GetWorkflowTemplates"],
  });

  const handleDelete = async () => {
    if (deleteConfirmation !== workflow.name) {
      toast({
        title: "Error",
        description: "Please type the workflow name exactly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    try {
      await removeWorkflow({
        variables: { id: workflow.id },
      });
      toast({
        title: "Workflow deleted",
        description: `"${workflow.name}" has been successfully deleted.`,
      });
      setIsDeleteModalOpen(false);
      setDeleteConfirmation('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Primary Action: Run Workflow */}
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            onRunWorkflow(workflow.id);
          }}
          className="h-8"
        >
          <Play className="h-3.5 w-3.5 mr-1" />
          Run
        </Button>

        {/* Secondary Actions: Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
              {hasWriteAccess ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </>
              )}
            </DropdownMenuItem>
            {hasWriteAccess && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SaveWorkflowModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        messages={workflow.steps_json || []}
        sessionTitle={workflow.name}
        existingWorkflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          rights_mode: workflow.rights_mode,
          RBAC: workflow.RBAC,
          steps_json: workflow.steps_json
        }}
        isReadOnly={!hasWriteAccess}
      />

      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the workflow "{workflow.name}" and cannot be undone.
              <br /><br />
              To confirm, please type the workflow name "<b className="cursor-pointer hover:underline" onClick={() => {
                navigator.clipboard.writeText(workflow.name);
                toast({
                  title: "Copied workflow name",
                  description: "The workflow name has been copied to your clipboard.",
                });
              }}>{workflow.name}</b>" below:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirmation" className="text-sm font-medium">
              Workflow name
            </Label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={workflow.name}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmation !== workflow.name}
            >
              Delete Workflow
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function createColumns(
  user: any,
  onShowQueueManagementModal: (queueName: string) => void,
  onRunWorkflow: (
    workflowId: string,
    queueName?: string | undefined,
    variables?: string[] | undefined
  ) => void
): ColumnDef<WorkflowWithLastRun>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const workflow = row.original;
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium">{workflow.name}</div>
            {workflow.description && (
              <div className="text-sm text-muted-foreground line-clamp-1">
                {workflow.description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "agent",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Agent
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const agent = row.original.agent;
        const { data: agentData, loading, previousData } = useQuery(GET_AGENT_BY_ID, {
          skip: !agent,
          variables: { id: agent },
          fetchPolicy: "cache-first",
        });

        if (!agent) {
          return <div className="text-muted-foreground text-sm">No Agent</div>;
        }

        const data = agentData || previousData;

        if (loading && !data) {
          return <div className="text-sm">Loading...</div>;
        }

        if (!data?.agentById) {
          return <div className="text-sm">No Agent</div>;
        }

        return <div className="text-sm">
          <Link className="text-muted-foreground hover:text-primary hover:underline" href={`/agents/edit/${agent}`}>{data?.agentById.name}</Link>
        </div>;
      }
    },
    {
      id: "lastRun",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status & Last Run
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <LastRunCell workflowId={row.original.id} />;
      },
    },
    {
      id: "queueAndSchedule",
      header: "Queue & Schedule",
      cell: ({ row }) => {
        return (
          <QueueAndScheduleCell
            workflowId={row.original.id}
            workflowName={row.original.name}
            agentId={row.original.agent}
            onShowQueueManagementModal={onShowQueueManagementModal}
          />
        );
      },
    },
    /* {
      accessorKey: "visibility",
      header: "Visibility",
      cell: ({ row }) => {
        return <VisibilityIndicator workflow={row.original} />;
      },
    }, */
    {
      accessorKey: "updatedAt",
      header: ({ column }) => {
        return (
          <Button
            className="p-0"
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Updated
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const updatedAt = row.getValue("updatedAt") as string;
        return (
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const agent = row.original.agent;
        const { data: agentData, loading, previousData } = useQuery(GET_AGENT_BY_ID, {
          skip: !agent,
          variables: { id: agent },
          fetchPolicy: "cache-first",
        });

        if (!agent) {
          return <div className="text-muted-foreground text-sm">No Agent</div>;
        }

        const data = agentData || previousData;

        if (loading && !data) {
          return <div className="text-sm">Loading...</div>;
        }

        return <WorkflowActionsCell workflow={row.original} user={user} onRunWorkflow={(workflowId) => onRunWorkflow(
          workflowId,
          data?.agentById.workflows?.queue?.name || undefined,
          row.original.variables || undefined
        )} />;
      },
    },
  ];
}