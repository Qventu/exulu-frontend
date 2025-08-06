"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { UserContext } from "@/app/(application)/authenticated";

export const dynamic = "force-dynamic";

export default function VariablesPage() {
  const { user } = useContext(UserContext);
  const columns = createColumns(user);

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Variables</h2>
            <p className="text-muted-foreground">
              Manage your application variables and secrets.
            </p>
          </div>
        </div>
        <DataTable columns={columns} />
      </div>
    </>
  );
}