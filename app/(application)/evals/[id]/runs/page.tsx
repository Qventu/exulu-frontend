"use client";

import { useContext, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@apollo/client";
import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/config-context";
import { Brain, ArrowLeft, Plus, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_EVAL_SET_BY_ID, GET_EVAL_RUNS } from "@/queries/queries";
import { CreateEvalRunModal } from "./components/create-eval-run-modal";
import { EvalRunsTable } from "./components/eval-runs-table";
import { EvalSet } from "@/types/models/eval-set";
import { EvalRun } from "@/types/models/eval-run";

export const dynamic = "force-dynamic";

export default function EvalRunsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useContext(UserContext);
  const config = useContext(ConfigContext);
  const eval_set_id = params.id as string;
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Check if user has evals access
  const hasEvalsAccess = user.super_admin || user.role?.evals === "read" || user.role?.evals === "write";
  const canWrite = user.super_admin || user.role?.evals === "write";

  // Fetch eval set
  const { loading: loadingEvalSet, data: evalSetData } = useQuery(GET_EVAL_SET_BY_ID, {
    variables: { id: eval_set_id },
    skip: !eval_set_id,
  });

  // Fetch eval runs
  const { loading: loadingRuns, data: runsData, refetch } = useQuery(GET_EVAL_RUNS, {
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
    <div className="flex h-full flex-1 flex-col space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/evals/${eval_set_id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Eval Runs for {evalSet?.name}</h2>
            <p className="text-muted-foreground">
              {evalSet?.name} - View and manage evaluation runs for the eval set "{evalSet?.name}".
            </p>
          </div>
        </div>
        {canWrite && config?.workers?.enabled && config?.workers?.redisHost && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Eval Run
          </Button>
        )}
      </div>

      {/* Workers Warning */}
      {(!config?.workers?.enabled || !config?.workers?.redisHost) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Workers are not enabled. You can view existing eval runs but cannot create or run new evaluations.
            Configure Redis to enable running eval runs.
          </AlertDescription>
        </Alert>
      )}

      {/* Eval Runs Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Run Results</CardTitle>
          <CardDescription>
            Matrix view of test case scores across eval runs. Click on a completed cell to view detailed results.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              onRefetch={refetch}
            />
          )}
        </CardContent>
      </Card>

      <CreateEvalRunModal
        eval_set_id={eval_set_id}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreateSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
}
