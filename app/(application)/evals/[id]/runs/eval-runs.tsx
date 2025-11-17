"use client";

import { useContext, useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/config-context";
import { Brain, Plus, AlertTriangle, ListChecks, RefreshCcw, Loader2, ChevronsUpDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_EVAL_SET_BY_ID, GET_EVAL_RUNS, RUN_EVAL } from "@/queries/queries";
import { CreateEvalRunModal } from "./components/create-eval-run-modal";
import { EvalRunsTable } from "./components/eval-runs-table";
import { QueueManagement } from "./components/queue-management";
import { EvalSet } from "@/types/models/eval-set";
import { EvalRun } from "@/types/models/eval-run";
import { useToast } from "@/components/ui/use-toast";
import { QueueJob } from "@/types/models/job";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { ListBulletIcon } from "@radix-ui/react-icons";

export default function EvalRuns({ id }: { id: string }) {
  const { user } = useContext(UserContext);
  const config = useContext(ConfigContext);
  const eval_set_id = id;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();

  // Check if user has evals access
  const hasEvalsAccess = user.super_admin || user.role?.evals === "read" || user.role?.evals === "write";
  const canWrite = user.super_admin || user.role?.evals === "write";

  const [runEval] = useMutation(RUN_EVAL, {
    onCompleted: (data) => {
      toast({
        title: "Eval run started",
        description: `Scheduled ${data.runEval.count} test cases to run.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to start eval run",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch eval set
  const { loading: loadingEvalSet, data: evalSetData } = useQuery(GET_EVAL_SET_BY_ID, {
    variables: { id: eval_set_id },
    skip: !eval_set_id,
  });

  // Fetch eval runs
  const { loading: loadingRuns, data: runsData, refetch: refetchRuns } = useQuery(GET_EVAL_RUNS, {
    variables: {
      page: 1,
      limit: 100,
      filters: [{ eval_set_id: { eq: eval_set_id } }],
    },
    skip: !eval_set_id,
    pollInterval: 10000, // Poll every 10 seconds to update job statuses
  });

  if (!hasEvalsAccess) {
    return (
      <div className="flex h-full flex-1 flex-col space-y-8 p-8">
        <Alert variant="destructive">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access Eval Runs. Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loadingEvalSet) {
    return (
      <div className="flex h-full flex-1 flex-col space-y-8 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const evalSet: EvalSet = evalSetData?.eval_setById;
  const evalRuns: EvalRun[] = runsData?.eval_runsPagination?.items || [];

  return (
    <div className="flex h-full flex-1 flex-col pb-8">

      {/* Workers Warning */}
      {(!config?.workers?.enabled || !config?.workers?.redisHost) && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Workers are not enabled. You can view existing eval runs but cannot create or run new evaluations.
            Configure Redis to enable running eval runs.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="space-y-6">
        {/* Eval Runs Matrix */}
        <Card>
          <CardHeader className="border-b bg-accent/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ListChecks className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle>Evaluation runs</CardTitle>
                  <CardDescription>
                    Matrix view of test case scores across eval runs. Click on a completed cell to view detailed results.{" "}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {canWrite && config?.workers?.enabled && config?.workers?.redisHost && (
                  <Button size="sm" onClick={() => setCreateModalOpen(true)}>
                    <Plus className="mr-2 h-3 w-3" />
                    New Eval Run
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingRuns ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : evalRuns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No eval runs yet. {canWrite && config?.workers?.enabled && config?.workers?.redisHost && "Click 'New Eval Run' to create one."}
              </div>
            ) : (
              <EvalRunsTable
                evalRuns={evalRuns}
                evalSet={evalSet}
                canWrite={canWrite}
                onRefetch={refetchRuns}
              />
            )}
          </CardContent>
        </Card>

        {/* Queue Management */}
        {config?.workers?.enabled && config?.workers?.redisHost && evalRuns.length > 0 && (
          <Card className="shadow-lg">
            <Collapsible>
              <CardHeader className="border-b bg-accent/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ListBulletIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Queue management</CardTitle>
                      <CardDescription>
                        Manage the queue of eval runs.{" "}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <ChevronsUpDown className="size-4" />
                        <span className="sr-only">Toggle</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <QueueManagement
                  queueName="eval_runs"
                  nameGenerator={(job) => {
                    return `Eval Run ${job.data?.eval_run_name || job.data?.eval_run_id} - Test Case ${job.data?.test_case_name || job.data?.test_case_id}`;
                  }}
                  retryJob={(job: QueueJob) => {
                    if (!job.data?.test_case_id || !job.data?.eval_run_id) {
                      return;
                    }
                    runEval({
                      variables: {
                        id: job.data?.eval_run_id,
                        test_case_ids: [job.data?.test_case_id]
                      }
                    });
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>

      <CreateEvalRunModal
        modalKey={`create-eval-run-modal-${eval_set_id}`}
        eval_set_id={eval_set_id}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreateSuccess={() => {
          refetchRuns();
        }}
      />
    </div>
  );
}
