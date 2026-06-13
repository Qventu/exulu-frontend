"use client";

/**
 * ContextLibrary — /data L1 surface (work item 2.11, owner "library";
 * knowledge.md §3 "Default view (L1)"; primary persona P2, secondary P3
 * for the SA Usage panel).
 *
 * Replaces ContextsDashboard (split: SA-only Usage moved to UsagePanel;
 * the legacy non-admin "Recent Items" N+1 view is folded into per-row
 * meta — when the backend ships KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED;
 * until then rows carry no per-row meta column, per page-doc 4).
 *
 * Composition (knowledge.md §3 "Layout & components → /data"):
 *   PageShell(content) →
 *     PageHeader(title="Knowledge", quiet "Contexts are defined in your
 *               backend" hint, no primary action) →
 *     UsagePanel (super_admin only) →
 *     Toolbar(search) →
 *     Bordered row list / LibraryEmpty
 *
 * Inventory items resolved here:
 *   1 (route resolution — landing), 3 (error state — handled by
 *   route-level Suspense + error.tsx the integrator owns; we surface
 *   an inline Alert), 4 (full context list — 20-cap removed via
 *   route-local hooks.ts), 5 (loading skeleton — route-level
 *   loading.tsx), 7 (breadcrumb header — PageHeader at L1), 8 (SA
 *   usage header — UsagePanel), 9/10 (charts in UsagePanel), 11/12
 *   (recent-item metadata folded into row meta), 13 (honest empty
 *   state via LibraryEmpty), 15 (loading skeletons), 83 (RBAC gate via
 *   guardRoute("knowledge") in page.tsx), 84 (SA-only Usage gate).
 *
 * All i18n lives here (next-intl client-side hook); the server page
 * does not call getTranslations (i18n trap, rule 6 of the work item).
 */

import { CircleAlert, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Toolbar } from "@/components/primitives/toolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { useContextLibrary } from "../hooks";
import { LibraryEmpty } from "./library-empty";
import { LibraryRow } from "./library-row";
import { UsagePanel } from "./usage-panel";

export interface ContextLibraryProps {
  /** Server-fetched super_admin flag from page.tsx. */
  isSuperAdmin: boolean;
}

export function ContextLibrary({ isSuperAdmin }: ContextLibraryProps) {
  const t = useTranslations("knowledge");
  const tCommon = useTranslations("common");

  const [search, setSearch] = React.useState("");
  const { rows, loading, error } = useContextLibrary({ search });

  return (
    <PageShell variant="content">
      <PageHeader
        title={t("library.title")}
        description={t("library.description")}
        meta={
          <span className="inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>{t("library.backendHint")}</span>
            <Link
              href="/explorer"
              className="text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {t("library.backendHintLink")}
            </Link>
          </span>
        }
      />

      {isSuperAdmin && <UsagePanel />}

      <div className="flex flex-col gap-4">
        <Toolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("library.searchPlaceholder"),
            debounceMs: 0, // local filter — instant
          }}
        />

        {error && (
          <Alert variant="destructive" role="alert">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>{tCommon("error")}</AlertTitle>
            <AlertDescription>
              {error.message || tCommon("somethingWentWrong")}
            </AlertDescription>
          </Alert>
        )}

        {!error && loading && rows.length === 0 && (
          <div className="rounded-md border">
            <ul className="divide-y divide-border" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 px-3 py-4 md:px-4"
                >
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="hidden h-3 w-64 max-w-full md:block" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!error && !loading && rows.length === 0 && search === "" && (
          <LibraryEmpty />
        )}

        {!error && !loading && rows.length === 0 && search !== "" && (
          <div className="rounded-md border px-6 py-12 text-center">
            <Search
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-foreground">
              {t("library.noMatches.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("library.noMatches.description")}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="rounded-md border">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <LibraryRow key={row.id} row={row} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </PageShell>
  );
}

// Provide a default export too — keeps parity with the other Phase-2
// client wrappers (agents-view, prompts-view) so the Suspense compose
// in page.tsx works with either named or default import shape.
export default ContextLibrary;
