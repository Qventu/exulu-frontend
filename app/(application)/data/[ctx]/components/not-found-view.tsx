"use client";

/**
 * Client-side not-found state for /data/[ctx]. Mirrors the prompts/[id]
 * pattern so the server page stays translation-free (i18n/config.ts has no
 * getRequestConfig default export — see ../page.tsx).
 */

import { FolderSearch } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";

export interface NotFoundViewProps {
  contextId: string;
}

export function NotFoundView({ contextId: _contextId }: NotFoundViewProps) {
  const t = useTranslations("knowledge");

  return (
    <PageShell variant="narrow">
      <EmptyState
        icon={FolderSearch}
        title={t("workspace.notFoundTitle")}
        description={t("workspace.notFoundDescription")}
        action={{ label: t("workspace.backToLibrary"), href: "/data" }}
      />
    </PageShell>
  );
}
