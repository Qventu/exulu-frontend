"use client";

/**
 * FolderSection — one admin-managed folder's slice of the /data context list
 * (knowledge-folders design D4/D6/D9).
 *
 * A header row (icon when the folder has one, name, count, collapse chevron)
 * over the list's existing <ul> of LibraryRow. Sections stack inside the
 * page's single bordered container, so the header carries the separator to its
 * rows and the container divides one section from the next.
 *
 * Collapse is owned by the page (it persists per browser); this component only
 * renders the state and reports the toggle. A collapsed section renders its
 * header alone — the rows unmount, which is also what keeps the row entrance
 * stagger cheap on a long list.
 */

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ContextIcon } from "@/components/primitives/context-icon/context-icon";
import { Badge } from "@/components/ui/badge";
import type {
  Folder,
  FolderSection as FolderSectionData,
} from "@/lib/knowledge/folders";
import { cn } from "@/lib/utils";

import type { ContextLibraryRow } from "../hooks";
import { LibraryRow } from "./library-row";

export interface FolderSectionProps {
  /** One section as computed by `groupContexts` (folder, or Ungrouped). */
  section: FolderSectionData<ContextLibraryRow>;
  collapsed: boolean;
  /** Toggle this section; `null` is the Ungrouped section. */
  onToggle: (folderId: string | null) => void;
  /** Index of this section's first row in the whole list (entrance stagger). */
  startIndex: number;
  /** contextId → glyph name, as the page read them. */
  icons: Record<string, string>;
  /** Super admin: rows get the icon picker and the move menu. */
  canEdit: boolean;
  onSetIcon?: (contextId: string, name: string | null) => void;
  /** Move targets for the row menu; omitted → no menu (see LibraryRow). */
  folders?: Folder[];
  onMoveToFolder?: (contextId: string, folderId: string | null) => void;
}

export function FolderSection({
  section,
  collapsed,
  onToggle,
  startIndex,
  icons,
  canEdit,
  onSetIcon,
  folders,
  onMoveToFolder,
}: FolderSectionProps) {
  const t = useTranslations("knowledge");

  const headingId = `knowledge-folder-${section.id ?? "ungrouped"}`;
  const count = section.rows.length;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 md:px-4">
        {section.icon && (
          <ContextIcon name={section.icon} className="size-4 shrink-0" />
        )}
        <h3
          id={headingId}
          className="truncate text-sm font-medium text-foreground"
        >
          {section.name}
        </h3>
        <Badge
          variant="secondary"
          aria-hidden="true"
          className="shrink-0 px-1.5 font-normal tabular-nums"
        >
          {count}
        </Badge>
        {/* The badge is a bare number for scanning; screen readers get the
            unit (and the plural) they need to make sense of it. */}
        <span className="sr-only">{t("library.folders.count", { count })}</span>
        <button
          type="button"
          onClick={() => onToggle(section.id)}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? t("library.folders.expand", { name: section.name })
              : t("library.folders.collapse", { name: section.name })
          }
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 transition-transform duration-200 ease-in-out",
              collapsed && "-rotate-90",
            )}
          />
        </button>
      </div>

      {!collapsed && count === 0 && (
        <p className="border-t px-3 py-4 text-sm text-muted-foreground md:px-4">
          {t("library.folders.emptySection")}
        </p>
      )}

      {!collapsed && count > 0 && (
        <ul className="divide-y divide-border border-t">
          {section.rows.map((row, offset) => (
            <LibraryRow
              key={row.id}
              index={startIndex + offset}
              row={row}
              icon={icons[row.id]}
              canEdit={canEdit}
              onSetIcon={onSetIcon}
              folders={folders}
              onMoveToFolder={onMoveToFolder}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
