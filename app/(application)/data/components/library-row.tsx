"use client";

/**
 * LibraryRow — one row in the /data context library list (work item
 * 2.11, owner "library"; knowledge.md §3 "Default view (L1)" + ladder
 * rows 11, 12).
 *
 * Renders the spec'd row shape from the page-doc:
 *   [icon] {name} {one-line description (truncate)}
 *     ⋯ right meta ("{n} items · ingested 2h ago")
 *
 * Each row leads with a Fluent Emoji "emoji-style" glyph (default when
 * unset) that makes knowledge bases easier to recognize at a glance. For
 * admins the glyph is a picker trigger; for everyone else it's a static
 * tile. The whole row is a keyboard-focusable Link to /data/{id} via the
 * stretched-link pattern (an absolutely-positioned <Link> behind a
 * pointer-events-none content layer) so the picker button can live in the
 * same row without nesting interactive content inside the anchor.
 *
 * Meta and health-dot rendering are SCHEMA-GATED on
 *   - KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED (item count + last
 *     ingested) — when false, meta column is omitted entirely (NEVER
 *     fall back to per-row N+1 queries, page-doc 4)
 *   - KNOWLEDGE_CONTEXT_HEALTH_SUPPORTED (failed-job count drives an
 *     error dot on the glyph tile) — when false, no dot shows
 *
 * The row obeys the responsive touch-target rule (≥44px below md via
 * vertical padding).
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { ContextIcon } from "@/components/primitives/context-icon/context-icon";
import { ContextIconPicker } from "@/components/primitives/context-icon/context-icon-picker";
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
  /** Glyph name for this context (undefined → default fallback). */
  icon?: string;
  /** When true, the glyph tile is an interactive icon picker. */
  canEdit?: boolean;
  /** Persist (or clear, with `null`) this context's icon. */
  onSetIcon?: (contextId: string, name: string | null) => void;
}

export function LibraryRow({ row, icon, canEdit, onSetIcon }: LibraryRowProps) {
  const t = useTranslations("knowledge");

  const showMeta = KNOWLEDGE_CONTEXT_AGGREGATES_SUPPORTED;
  const showHealth = KNOWLEDGE_CONTEXT_HEALTH_SUPPORTED;

  const failed = row.failedJobCount ?? 0;
  const hasError = showHealth && failed > 0;

  const itemCountLabel =
    typeof row.itemCount === "number"
      ? t("library.row.itemCount", { count: row.itemCount })
      : null;

  // Glyph + (optional) health dot, shared by the picker and static variants.
  const tileInner = (
    <>
      <ContextIcon name={icon} className="size-full" />
      {hasError && (
        <StatusDot
          status="error"
          className="absolute -right-0.5 -top-0.5"
          aria-label={t("library.row.statusFailed", { count: failed })}
        />
      )}
    </>
  );

  const tileClassName =
    "relative flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/60 p-1.5";

  const tile =
    canEdit && onSetIcon ? (
      <ContextIconPicker
        value={icon ?? null}
        onSelect={(name) => onSetIcon(row.id, name)}
        align="start"
        labels={{
          title: t("library.iconPicker.title"),
          searchPlaceholder: t("library.iconPicker.searchPlaceholder"),
          reset: t("library.iconPicker.reset"),
          noResults: t("library.iconPicker.noResults"),
        }}
      >
        <button
          type="button"
          aria-label={t("library.row.setIcon", { name: row.name })}
          className={`pointer-events-auto transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tileClassName}`}
        >
          {tileInner}
        </button>
      </ContextIconPicker>
    ) : (
      <div className={tileClassName}>{tileInner}</div>
    );

  return (
    <li className="group relative transition-colors hover:bg-accent/50">
      {/* Stretched link: covers the whole row for navigation, sits behind the
          content so the picker button (pointer-events-auto) stays clickable. */}
      <Link
        href={`/data/${row.id}`}
        aria-label={row.name}
        className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="pointer-events-none relative z-10 flex min-h-11 items-center gap-3 px-3 py-3 md:gap-4 md:px-4 md:py-4">
        {tile}
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
            {hasError && (
              <Badge variant="destructive" className="ml-1">
                {t("library.row.failedJobs", { count: failed })}
              </Badge>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
