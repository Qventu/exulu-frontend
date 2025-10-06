"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { UserContext } from "@/app/(application)/authenticated";
import { ArrowLeft, Brain } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TestCasesPage() {
  const { user } = useContext(UserContext);
  const columns = createColumns(user);
  const router = useRouter();

  // Check if user has evals access
  const hasEvalsAccess = user.super_admin || user.role?.evals === "read" || user.role?.evals === "write";

  if (!hasEvalsAccess) {
    return (
      <div className="flex h-full flex-1 flex-col space-y-8 p-8">
        <Alert variant="destructive">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access Test Cases. Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/evals")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Test Cases</h2>
              <p className="text-muted-foreground">
              Create and manage test cases for evaluating agent performance.
              </p>
            </div>
          </div>
        </div>

        {/* Test Cases Table */}
        <DataTable columns={columns} />
      </div>
    </>
  );
}
