"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { JobsStatusArea } from "./components/jobs-status-area";
import { UserContext } from "@/app/(application)/authenticated";

export const dynamic = "force-dynamic";

export default function WorkflowsPage() {
  const { user } = useContext(UserContext);
  const columns = createColumns(user);

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Workflows</h2>
            <p className="text-muted-foreground">
              Manage your workflow templates and monitor running jobs.
            </p>
          </div>
        </div>
        
        {/* Jobs Status Area */}
        <JobsStatusArea />
        
        {/* Workflows Table */}
        <DataTable columns={columns} />
      </div>
    </>
  );
}