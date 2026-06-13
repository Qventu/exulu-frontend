"use client";

/**
 * LibraryRow — one row in the /data context library list (work item
 * 2.11, owner "library"; knowledge.md §3 "Default view (L1)" + ladder
 * rows 11, 12).
 *
 * Renders the spec'd row shape from the page-doc:
 *   {name} {one-line description (truncate)}
 *     ⋯ right meta ("{n} items · ingested 2h ago") + StatusDot
 *
 * Meta and health-dot rendering are SCHEMA-GATED on
 *   - KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED (item count + last
 *     ingested) — when false, meta column is omitted entirely (NEVER
 *     fall back to per-row N+1 queries, page-doc 4)
 *   - KNOWLEDGE_CONTEXT_HEALTH_SUPPORTED (failed-job count drives
 *     error dot + badge) — when false, the dot stays muted
 *
 * Token-only colors (StatusDot is semantic-only); the whole row is a
 * keyboard-focusable Link to /data/{id}; hover highlight via
 * `hover:bg-accent/50`. The row obeys the responsive touch-target rule
 * (≥44px below md via vertical padding).
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Badge } from "@/components/ui/badge";

import {
  KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED,
  KNOWLEDGE_CONTEXT_HEALTH_SUPPORTED,
} from "../queries";
import type { ContextLibraryRow } from "../hooks";

export interface LibraryRowProps {
  row: ContextLibraryRow;
}

export function LibraryRow({ row }: LibraryRowProps) {
  const t = useTranslations("knowledge");

  const showMeta = KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED;
  const showHealth = KNOWLEDGE_CONTEXT_HEALTH_SUPPORTED;

  const failed = row.failedJobCount ?? 0;
  const status = showHealth && failed > 0 ? "error" : "muted";

  const itemCountLabel =
    typeof row.itemCount === "number"
      ? t("library.row.itemCount", { count: row.itemCount })
      : null;

  return (
    <li>
      <Link
        href={`/data/${row.id}`}
        className="group flex min-h-11 items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-4 md:px-4 md:py-4"
      >
        <StatusDot
          status={status}
          aria-label={
            status === "error"
              ? t("library.row.statusFailed", { count: failed })
              : undefined
          }
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary md:text-base">
            {row.name}
          </p>
          {row.description && (
            <p className="hidden truncate text-sm text-muted-foreground md:block">
              {row.description}
            </p>
          )}
          {/* Below md: collapse meta under the title */}
          {showMeta && (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground md:hidden">
              {itemCountLabel}
              {itemCountLabel && row.lastIngestedAt && (
                <span aria-hidden="true">·</span>
              )}
              {row.lastIngestedAt && (
                <span className="inline-flex items-center gap-1">
                  <span>{t("library.row.ingested")}</span>
                  <RelativeTime date={row.lastIngestedAt} />
                </span>
              )}
            </p>
          )}
        </div>
        {showMeta && (
          <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground md:flex">
            {itemCountLabel && <span>{itemCountLabel}</span>}
            {row.lastIngestedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <span>{t("library.row.ingested")}</span>
                  <RelativeTime date={row.lastIngestedAt} />
                </span>
              </>
            )}
            {showHealth && failed > 0 && (
              <Badge variant="destructive" className="ml-1">
                {t("library.row.failedJobs", { count: failed })}
              </Badge>
            )}
          </div>
        )}
      </Link>
    </li>
  );
}
