"use client";

/**
 * EditorErrorView — client-side not-found / fetch-error state for the editor
 * page. Owns the EmptyState copy so the server page can stay translation-free
 * (the project's `next-intl/server` getRequestConfig pathway is not wired —
 * see ./page.tsx note).
 */

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";

export interface EditorErrorViewProps {
  kind: "not-found" | "error";
  message?: string;
}

export function EditorErrorView({ kind, message }: EditorErrorViewProps) {
  const t = useTranslations("agents");
  const tCommon = useTranslations("common");

  const title =
    kind === "not-found"
      ? t("editor.notFoundTitle")
      : tCommon("somethingWentWrong");

  const description =
    kind === "not-found"
      ? t("editor.notFoundDescription")
      : message ?? t("editor.notFoundDescription");

  return (
    <PageShell variant="content">
      <EmptyState
        variant="error"
        title={title}
        description={description}
        action={{ label: t("title"), href: "/agents" }}
      />
    </PageShell>
  );
}
