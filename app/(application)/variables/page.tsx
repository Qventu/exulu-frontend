"use client";

/**
 * /variables — Phase 4.5 redesign (variables.md §3).
 *
 * Page chrome: PageShell + PageHeader + Toolbar + DataTable with detail
 * Sheet, exactly as the spec mandates (variables.md §3 / responsive.md T2).
 *
 * Read-only mode: when the user has `variables:read` without `:write`, the
 * primary action (Add variable) is suppressed and a small banner explains
 * the gate; the data table and detail panel further suppress write
 * affordances per the readOnly prop chain.
 */

import { useContext, Suspense } from "react";
import { useTranslations } from "next-intl";

import { UserContext } from "@/app/(application)/authenticated";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { hasRight } from "@/lib/rights";
import type { UserWithRole } from "@/types/models/user";
import Link from "next/link";
import { Plus } from "lucide-react";

import { VariableList } from "./components/variable-list";

export const dynamic = "force-dynamic";

export default function VariablesPage() {
  const t = useTranslations();
  const { user } = useContext(UserContext) as { user: UserWithRole };

  const canWrite =
    user?.super_admin === true || hasRight(user?.role, "variables", "write");
  const readOnly = !canWrite;

  return (
    <PageShell>
      <PageHeader
        title={t("variables.title")}
        description={t("variables.description")}
        action={
          !readOnly ? (
            <Button asChild>
              <Link href="/variables/create">
                <Plus className="mr-2 size-4" strokeWidth={1} />
                {t("variables.actions.add")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          {t("variables.readOnly.banner")}
        </p>
      ) : null}

      <Suspense fallback={null}>
        <VariableList readOnly={readOnly} />
      </Suspense>
    </PageShell>
  );
}
