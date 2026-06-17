"use client";

/**
 * NotFoundView — client-side not-found state for /prompts/[id]. Owns the
 * EmptyState copy so the server page can stay translation-free (the
 * project's `next-intl/server` getRequestConfig pathway is not wired — see
 * ./page.tsx note, mirrors agents/edit/[id]/components/editor-error-view).
 */

import { ClipboardType } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";

export function NotFoundView() {
  const t = useTranslations("prompts");

  return (
    <PageShell variant="narrow">
      <EmptyState
        icon={ClipboardType}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
        action={{ label: t("backToPrompts"), href: "/prompts" }}
      />
    </PageShell>
  );
}
