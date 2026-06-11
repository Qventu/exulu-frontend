"use client";

import { useContext } from "react";
import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { UserContext } from "@/app/(application)/authenticated";
import { Brain } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfigContext } from "@/components/shell/config-context";
import { can } from "@/lib/rights";

export const dynamic = "force-dynamic";

export default function EvalsPage() {
  const { user } = useContext(UserContext);
  const config = useContext(ConfigContext);
  const columns = createColumns(user);
  // Shared RBAC predicate — same source as the nav entry and the /evals
  // route guard (which catches this server-side; kept as defense in depth)
  const hasEvalsAccess = can(user, { area: "evals", level: "read" });

  if (!hasEvalsAccess) {
    return (
      <div className="flex h-full flex-1 flex-col space-y-8 p-8">
        <Alert variant="destructive">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access Evals. Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Eval Sets</h2>
          <p className="text-muted-foreground">
            Create and manage evaluation sets for testing your agents' performance.
          </p>
        </div>
      </div>

      {(!config?.workers?.enabled || !config?.workers?.redisHost) && (
        <Alert variant="destructive">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            Workers are not enabled. You can view eval sets but cannot run evaluations.
            Configure Redis to enable running eval runs.
          </AlertDescription>
        </Alert>
      )}

      {/* Eval Sets Table */}
      <DataTable columns={columns} />
    </div>
  );
}
