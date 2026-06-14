"use client";

import { ExternalLink, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * /n8n client surface — adopts the new shell chrome around a guarded iframe
 * (workflows.md inventory items 45/46/47).
 *
 * Layout (full-bleed PageShell):
 *   - Slim compact PageHeader: title = nav label "Automation", with a single
 *     ghost "Open in new tab" action (the only escape hatch when the
 *     embedded editor is constrained — also the mobile fallback CTA).
 *   - Host: ≥md renders the iframe sized to fill the remaining viewport.
 *     Below md the iframe is replaced by an EmptyState — the n8n editor is
 *     desktop-only and shipping a 390px-wide canvas guarantees frustration
 *     (responsive.md: no hidden affordances; provide an explicit path out).
 *   - A Skeleton overlay covers the iframe until onLoad fires.
 *
 * Sizing: the app shell renders a fixed h-12 top bar at ≥md
 * (components/shell/top-bar.tsx) — the host subtracts 3rem to keep the
 * iframe canvas exact (mirrors the chat-shell pattern, V1: no 100vh).
 *
 * NOTE: when N8N_URL is unset the guard at page.tsx already returned
 * AccessDenied before reaching here — `url` is always non-empty at runtime,
 * but we keep a defensive guard for safety in dev / storybook.
 */
export interface N8nClientProps {
  url: string;
}

export function N8nClient({ url }: N8nClientProps) {
  const t = useTranslations("n8n");
  const isMobile = useIsMobile();
  const isDesktop = !isMobile;
  const [loaded, setLoaded] = React.useState(false);

  const openInNewTab = React.useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  return (
    <PageShell variant="full-bleed">
      <div className="border-b px-4 py-3 md:px-6">
        <PageHeader
          density="compact"
          title={t("title")}
          description={t("description")}
          truncateDescription
          action={
            url ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={openInNewTab}
                aria-label={t("openInNewTab")}
              >
                <ExternalLink aria-hidden="true" className="mr-2 size-4" />
                {t("openInNewTab")}
              </Button>
            ) : undefined
          }
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {isDesktop ? (
          <>
            {!loaded && (
              <Skeleton
                aria-hidden="true"
                className="absolute inset-0 h-full w-full rounded-none"
              />
            )}
            {url ? (
              <iframe
                src={url}
                title={t("iframeTitle")}
                className="h-full w-full border-0"
                allow="clipboard-read; clipboard-write"
                onLoad={() => setLoaded(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <EmptyState
                  icon={Workflow}
                  title={t("notConfiguredTitle")}
                  description={t("notConfiguredDescription")}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4">
            <EmptyState
              icon={Workflow}
              title={t("mobileTitle")}
              description={t("mobileDescription")}
              action={
                url
                  ? { label: t("openInNewTab"), onClick: openInNewTab }
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
