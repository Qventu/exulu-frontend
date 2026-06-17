"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useMemo, useRef, useState } from "react";

import { createColumns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { EvalsAccessDenied } from "../_shared/access-denied";
import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { can } from "@/lib/rights";
import { TestCase } from "@/types/models/test-case";

export const dynamic = "force-dynamic";

export default function TestCasesPage() {
  const { user } = useContext(UserContext);
  const t = useTranslations("evals.cases.list");
  const tCases = useTranslations("evals.cases");
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refetchRef = useRef<() => void>(() => {});

  const hasEvalsAccess = can(user, { area: "evals", level: "read" });
  const canWrite = user.super_admin || user.role?.evals === "write";

  const columns = useMemo(
    () =>
      createColumns(
        user,
        tCases,
        (testCase) => setEditingTestCase(testCase),
        () => refetchRef.current?.(),
      ),
    [user, tCases],
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
        breadcrumb={{ label: "Evals", href: "/evals" }}
        action={
          canWrite ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              {t("primaryAction")}
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        testCase={editingTestCase || undefined}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
        refreshNonce={refreshNonce}
        refetchRef={refetchRef}
        onSuccess={() => setRefreshNonce((n) => n + 1)}
        onEditingChange={setEditingTestCase}
      />
    </PageShell>
  );
}
