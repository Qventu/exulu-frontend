"use client";

import { useContext, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { UserContext } from "@/app/(application)/authenticated";
import { Brain, ArrowLeft, Plus, Save, Loader2, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { GET_EVAL_SET_BY_ID, UPDATE_EVAL_SET, GET_TEST_CASES, UPDATE_TEST_CASE } from "@/queries/queries";
import { TestCaseSelectionModal } from "./components/test-case-selection-modal";
import { TestCaseModal } from "../cases/components/test-case-modal";
import { TestCase } from "@/types/models/test-case";

export const dynamic = "force-dynamic";

export default function EvalSetEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useContext(UserContext);
  const { toast } = useToast();
  const evalSetId = params.id as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [testCases, setTestCases] = useState<string[]>([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [testCaseToRemove, setTestCaseToRemove] = useState<string | null>(null);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);

  // Check if user has evals access
  const hasEvalsAccess = user.super_admin || user.role?.evals === "read" || user.role?.evals === "write";
  const canWrite = user.super_admin || user.role?.evals === "write";

  // Fetch eval set
  const { loading: loadingEvalSet, data: evalSetData, refetch } = useQuery(GET_EVAL_SET_BY_ID, {
    variables: { id: evalSetId },
    skip: !evalSetId,
    onCompleted: (data) => {
      if (data?.eval_setById) {
        setName(data.eval_setById.name);
        setDescription(data.eval_setById.description || "");
      }
    },
  });

  // Fetch test cases details
  const { data: testCasesData, refetch: refetchTestCases } = useQuery(GET_TEST_CASES, {
    variables: {
      page: 1,
      limit: 500,
      filters: [{ eval_set_id: { eq: evalSetId } }],
    }
  });

  const [updateEvalSet, { loading: updating }] = useMutation(UPDATE_EVAL_SET, {
    onCompleted: () => {
      toast({
        title: "Eval set updated",
        description: "The eval set has been successfully updated.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Failed to update eval set",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Validation error",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    if (testCases.length > 500) {
      toast({
        title: "Validation error",
        description: "Maximum 500 test cases allowed per eval set.",
        variant: "destructive",
      });
      return;
    }

    updateEvalSet({
      variables: {
        id: evalSetId,
        data: {
          name: name.trim(),
          description: description.trim() || null,
        },
      },
    });
  };

  const handleRemoveTestCase = (testCaseId: string) => {
    setTestCaseToRemove(testCaseId);
  };

  const confirmRemoveTestCase = () => {
    if (!testCaseToRemove) return;

    updateTestCase({
      variables: {
        id: testCaseToRemove,
        data: { eval_set_id: null },
      },
      onCompleted: () => {
        toast({
          title: "Test case removed",
          description: "The test case has been removed from this eval set.",
        });
        refetchTestCases();
        setTestCaseToRemove(null);
      },
    });
  };

  const [updateTestCase, { loading: updatingTestCase }] = useMutation(UPDATE_TEST_CASE, {
    onError: (error) => {
      toast({
        title: "Failed to update test case",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddTestCases = (selectedTestCaseIds: string[]) => {
    // Add new test cases, avoiding duplicates
    const newTestCases = Array.from(new Set([...testCases, ...selectedTestCaseIds]));

    if (newTestCases.length > 500) {
      toast({
        title: "Too many test cases",
        description: "Maximum 500 test cases allowed per eval set.",
        variant: "destructive",
      });
      return;
    }

    console.log("newTestCases", newTestCases);

    for (const testCaseId of newTestCases) {
      updateTestCase({
        variables: {
          id: testCaseId,
          data: { eval_set_id: evalSetId },
        },
      });
    }

    refetchTestCases();
    setShowSelectionModal(false);
  };

  if (!hasEvalsAccess) {
    return (
      <div className="flex h-full flex-1 flex-col space-y-8 p-8">
        <Alert variant="destructive">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access Eval Sets. Contact your administrator to request access.
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

  const testCasesList = testCasesData?.test_casesPagination?.items || [];

  return (
    <div className="flex h-full flex-1 flex-col space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/evals")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Edit Eval Set</h2>
            <p className="text-muted-foreground">
              Configure test cases for this evaluation set.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/evals/${evalSetId}/runs`)}
          >
            <Play className="mr-2 h-4 w-4" />
            View Runs
          </Button>
          {canWrite && (
            <Button onClick={handleSave} disabled={updating}>
              {updating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Edit the name and description of this eval set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Eval set name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canWrite}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this eval set tests..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canWrite}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Cases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Test Cases</CardTitle>
              <CardDescription>
                Add up to 500 test cases to this eval set. {testCases.length}/500 selected.
              </CardDescription>
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSelectionModal(true)}
                  disabled={testCases.length >= 500}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Existing
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {testCasesList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No test cases added yet. Click "Add Test Cases" to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {testCasesList.map((testCase: any) => (
                <div
                  key={testCase.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{testCase.name}</span>
                    </div>
                    {testCase.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {testCase.description}
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <>
                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTestCase(testCase);
                        setShowCreateModal(true);
                      }}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTestCase(testCase.id)}>
                      Remove
                    </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <TestCaseSelectionModal
        open={showSelectionModal}
        onClose={() => setShowSelectionModal(false)}
        onSelect={handleAddTestCases}
        excludeIds={testCases}
      />

      <TestCaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          // Refetch to get the new test case in the list
          refetch();
        }}
        testCase={editingTestCase}
      />

      {/* Remove Test Case Confirmation Dialog */}
      <AlertDialog open={!!testCaseToRemove} onOpenChange={(open) => !open && setTestCaseToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove test case from eval set?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the test case from this eval set. The test case itself will not be deleted and can be added back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveTestCase}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
