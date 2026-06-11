"use client";

import { useContext, useEffect } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { UserContext } from "@/app/(application)/authenticated";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useMutation } from "@apollo/client";
import { RUN_WORKFLOW } from "@/queries/queries";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Zap, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { QueueManagement } from "../evals/[id]/runs/components/queue-management";
import { QueueJob } from "@/types/models/job";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default function WorkflowsPage() {

  const { user } = useContext(UserContext);

  const [queueManagementModalOpen, setQueueManagementModalOpen] = useState<string | null>(null);

  const onRunWorkflow = (
    workflowId: string,
    queueName?: string | undefined,
    variables?: string[] | undefined
  ) => {
    setDialogOpen({
      id: workflowId,
      queue: queueName,
      variables: variables,
    });
  };

  const onShowQueueManagementModal = (queueName: string) => {
    setQueueManagementModalOpen(queueName);
  };

  const columns = createColumns(user, onShowQueueManagementModal, onRunWorkflow);
  const [dialogOpen, setDialogOpen] = useState<{
    id: string;
    queue?: string | undefined;
    variables?: string[] | undefined;
  } | null>(null);

  const [runWorkflow, { loading }] = useMutation(RUN_WORKFLOW, {
    onCompleted: (data) => {
      toast("Template run completed", {
        description: "The template has been run successfully.",
      });
    },
    onError: (error) => {
      console.error("Failed to run template:", error);
      toast("Failed to run template", {
        description: error.message,
      });
    },
  });

  const reactForm = useForm<{
    variables: Record<string, string>;
  }>({
    defaultValues: {
      variables: {},
    },
  });

  useEffect(() => {
    if (dialogOpen?.variables) {
      reactForm.reset({
        variables: dialogOpen?.variables.reduce((acc, variable) => {
          acc[variable] = "";
          return acc;
        }, {} as Record<string, string>),
      });
    }
  }, [dialogOpen?.variables]);

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Routines</h2>
            <p className="text-muted-foreground">
              Manage your routines and monitor running jobs.
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">How to create a new conversation routine</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            Start a new chat with an agent, then save your conversation as a routine.
            You can run saved routines on-demand or schedule them to run automatically using CRON expressions
            if a queue is configured for the agent running the routine and you have setup workers to process the queue.
          </AlertDescription>
        </Alert>

        {/* Templates Table */}
        <DataTable columns={columns} />
      </div>

      <Dialog modal={true} open={
        dialogOpen !== null &&
        dialogOpen !== undefined
      } onOpenChange={(open) => {
        setDialogOpen(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Start Template Run</DialogTitle>
            <DialogDescription>
              Configure and start your template execution
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Execution Mode Info */}
            <Alert className={dialogOpen?.queue ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20" : "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"}>
              <div className="flex items-start gap-3">
                {dialogOpen?.queue ? (
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                ) : (
                  <Zap className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertTitle className="text-base font-semibold mb-1">
                    {dialogOpen?.queue ? "Scheduled Execution" : "Immediate Execution"}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {dialogOpen?.queue ? (
                      <>
                        This routine will be queued for execution in the{" "}
                        <span className="font-semibold text-blue-700 dark:text-blue-300">{dialogOpen.queue}</span> queue.
                        Jobs are processed asynchronously based on queue priority and availability.
                      </>
                    ) : (
                      <>
                        This routine will execute immediately without queuing.
                        No queue is configured for the agent running this routine.
                      </>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>

            {/* Input Variables Section */}
            {dialogOpen?.variables && dialogOpen.variables.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Input Variables</h3>
                  <span className="text-xs text-muted-foreground">
                    ({dialogOpen.variables.length} required)
                  </span>
                </div>

                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                  {dialogOpen.variables.map((variable) => (
                    <div key={variable} className="space-y-1.5">
                      <Label
                        className="text-sm font-medium flex items-center gap-1.5"
                        htmlFor={variable}
                      >
                        <span className="capitalize">{variable?.replaceAll("_", " ")}</span>
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={variable}
                        placeholder={`Enter ${variable?.replaceAll("_", " ")}...`}
                        className="h-10"
                        {...reactForm.register(`variables.${variable}`, {
                          required: true
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Variables Message */}
            {(!dialogOpen?.variables || dialogOpen.variables.length === 0) && (
              <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg bg-muted/30">
                No input variables required for this routine
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(null);
                reactForm.reset();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={loading}
              onClick={() => {
                // Check if all variables are filled
                if (dialogOpen?.variables && dialogOpen.variables.length > 0) {
                  const values = reactForm.getValues("variables");
                  const allVariablesFilled = Object.values(values).every((value) => value?.trim() !== "");

                  if (!allVariablesFilled) {
                    toast("Missing required variables", {
                      description: "Please fill in all required variables before starting the workflow.",
                    });
                    return;
                  }
                }

                const values = reactForm.getValues("variables");

                runWorkflow({
                  variables: {
                    id: dialogOpen?.id,
                    variables: values,
                  },
                }).then(() => {
                  setDialogOpen(null);
                  reactForm.reset();
                });
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  {dialogOpen?.queue ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Schedule Routine
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Run Routine
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {
        queueManagementModalOpen && (
          <Dialog modal={true} open={queueManagementModalOpen !== null && queueManagementModalOpen !== undefined} onOpenChange={(open) => {
            setQueueManagementModalOpen(null);
          }}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Queue Management</DialogTitle>
              </DialogHeader>
              <QueueManagement queueName={queueManagementModalOpen} nameGenerator={(job: QueueJob) => {
                return `Routine Run: ${job.data?.workflow}`;
              }} retryJob={(job: QueueJob) => {
                setDialogOpen({
                  id: job.data?.workflow || "",
                  queue: queueManagementModalOpen,
                  variables: job.data?.inputs,
                })
              }} />
            </DialogContent>
          </Dialog>
        )
      }
    </>
  );
}