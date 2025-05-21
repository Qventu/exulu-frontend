"use client";

import { columns } from "./components/columns";
import { DataTable } from "./components/data-table";

export const dynamic = "force-dynamic";

export default function TaskPage() {
  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Jobs</h2>
            <p className="text-muted-foreground">
              Here's a list of all your jobs.
            </p>
          </div>
        </div>
        <DataTable columns={columns} />
      </div>
    </>
  );
}
