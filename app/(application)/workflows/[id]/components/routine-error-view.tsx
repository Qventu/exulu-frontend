"use client";

/**
 * RoutineErrorView — client-side not-found / fetch-error state for the routine
 * workbench. Mirrors agents EditorErrorView. Owns the EmptyState copy so the
 * server page can stay translation-free (the project's `next-intl/server`
 * getRequestConfig pathway is not wired — see ./page.tsx note).
 */

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";

export interface RoutineErrorViewProps {
  kind: "not-found" | "error";
  message?: string;
}

export function RoutineErrorView({ kind, message }: RoutineErrorViewProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");

  const title =
    kind === "not-found"
      ? t("workbench.notFoundTitle")
      : tCommon("somethingWentWrong");

  const description =
    kind === "not-found"
      ? t("workbench.notFoundDescription")
      : message ?? t("workbench.notFoundDescription");

  return (
    <PageShell variant="content">
      <EmptyState
        variant="error"
        title={title}
        description={description}
        action={{ label: t("title"), href: "/workflows" }}
      />
    </PageShell>
  );
}
