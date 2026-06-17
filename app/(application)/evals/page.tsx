"use client";

import { useContext, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { CreateEvalSetModal } from "./components/create-eval-set-modal";
import { EvalsAccessDenied } from "./_shared/access-denied";
import { WorkersWarning } from "./_shared/workers-warning";
import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { can } from "@/lib/rights";

export const dynamic = "force-dynamic";

export default function EvalsPage() {
  const { user } = useContext(UserContext);
  const t = useTranslations("evals.list");
  // Shared RBAC predicate — same source as the nav entry and the /evals
  // route guard (which catches this server-side; kept as defense in depth)
  const hasEvalsAccess = can(user, { area: "evals", level: "read" });

  // refetch ref is set by DataTable on mount so row-actions can request a
  // refresh after a delete without prop-drilling refs through tanstack.
  const refetchRef = useRef<() => void>(() => {});
  // Bumped by the modal's onSuccess to force the table to refetch.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const columns = useMemo(
    () => createColumns(user, t, () => refetchRef.current?.()),
    [user, t],
  );

  if (!hasEvalsAccess) {
    return (
      <PageShell>
        <EvalsAccessDenied />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <CreateEvalSetModal
            onSuccess={() => setRefreshNonce((n) => n + 1)}
          />
        }
      />
      <WorkersWarning />
      <DataTable
        columns={columns}
        refreshNonce={refreshNonce}
        refetchRef={refetchRef}
      />
    </PageShell>
  );
}
