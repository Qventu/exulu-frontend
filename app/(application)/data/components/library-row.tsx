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

import { motion, useReducedMotion } from "framer-motion";
import { FolderInput } from "lucide-react";

import { isDemoMode } from "@/lib/demo/flag";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { ContextIcon } from "@/components/primitives/context-icon/context-icon";
import { ContextIconPicker } from "@/components/primitives/context-icon/context-icon-picker";
import { REVEAL_ON_HOVER_CLASSES } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Folder } from "@/lib/knowledge/folders";
import { cn } from "@/lib/utils";

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
  /** Position in the list, for the demo's staggered entrance. */
  index: number;
  /**
   * Move targets for the "Move to folder…" menu. Omitted (or without
   * `onMoveToFolder`, or for a non-admin) → no menu, exactly as before
   * folders existed.
   */
  folders?: Folder[];
  /** Move this context into a folder, or out of all of them with `null`. */
  onMoveToFolder?: (contextId: string, folderId: string | null) => void;
}

/** Radix needs a non-empty value, and `null` is Ungrouped's real id. */
const UNGROUPED_VALUE = "__ungrouped__";

export function LibraryRow({
  row,
  icon,
  canEdit,
  onSetIcon,
  index,
  folders,
  onMoveToFolder,
}: LibraryRowProps) {
  const t = useTranslations("knowledge");
  const reduceMotion = useReducedMotion();
  const demoEntrance = isDemoMode() && !reduceMotion;

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

  // "Move to folder…" — admins only, and only where the page knows the
  // folders. The current folder is read off the membership arrays (the first
  // one wins, as in `groupContexts`), so the menu also says where the context
  // sits today.
  const currentFolderId =
    folders?.find((folder) => folder.context_ids.includes(row.id))?.id ?? null;

  const moveMenu =
    canEdit && folders && onMoveToFolder ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* The OverflowMenu primitive's trigger, down to its T7 reveal
              rule: always visible on touch, faded until row hover or focus
              on a mouse. `pointer-events-auto` lifts it out of the row's
              non-interactive content layer (see the stretched link above). */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("library.folders.moveRow", { name: row.name })}
            className={cn(
              "pointer-events-auto size-8 shrink-0 text-muted-foreground",
              REVEAL_ON_HOVER_CLASSES,
            )}
          >
            <FolderInput className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("library.folders.moveTo")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentFolderId ?? UNGROUPED_VALUE}
            onValueChange={(value) =>
              onMoveToFolder(row.id, value === UNGROUPED_VALUE ? null : value)
            }
          >
            {folders.map((folder) => (
              <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                {folder.name}
              </DropdownMenuRadioItem>
            ))}
            {folders.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuRadioItem value={UNGROUPED_VALUE}>
              {t("library.folders.ungrouped")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <motion.li
      className="group relative transition-colors hover:bg-accent/50"
      // Demo only: chapter 2's list grows 0 → 3 → 7 across three steps and
      // the step says the bases are being created; rows that pop in all at
      // once read as a reload. Keyed by id, so a refetch that grows the list
      // animates only the new rows. Off outside the demo and under reduced
      // motion (initial={false} renders the resting state).
      initial={demoEntrance ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index, 8) * 0.06, ease: "easeOut" }}
    >
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
        {moveMenu}
      </div>
    </motion.li>
  );
}
