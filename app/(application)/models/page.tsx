"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { UserContext } from "@/app/(application)/authenticated";

export const dynamic = "force-dynamic";

export default function ModelsPage() {
  const { user } = useContext(UserContext);
  const columns = createColumns(user);

  return (
    <>
      <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Models</h2>
            <p className="text-muted-foreground">
              Manage the language models available to your agents. Each model
              pairs a code-defined provider with an encrypted authentication
              variable and optional rate / budget limits.
            </p>
          </div>
        </div>
        <DataTable columns={columns} />
      </div>
    </>
  );
}
