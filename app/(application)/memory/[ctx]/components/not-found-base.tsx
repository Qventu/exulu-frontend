"use client";

/**
 * Client-side not-found state for a memory base, in its own file on purpose.
 * Three routes show it — the base page, its Conflicts route and a memory's
 * detail page — and it used to live in `base-shell.tsx`. Since that shell
 * imports the map card, which in turn dynamic-imports the renderer, every one
 * of those routes carried the card's module in its client graph even though
 * only the base page's overview tab can draw a map.
 *
 * It mirrors ../../../data/[ctx]/components/not-found-view.tsx: the server
 * pages must stay translation-free (i18n/config.ts has no getRequestConfig
 * default export — see ../page.tsx), so the copy lives in a client component.
 */

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";

export function NotFoundBase({ contextId }: { contextId: string }) {
  const t = useTranslations("memory");
  return (
    <PageShell>
      <EmptyState title={t("base.missingFromCode")} description={contextId} action={{ label: t("empty.backToOverview"), href: "/memory" }} />
    </PageShell>
  );
}
