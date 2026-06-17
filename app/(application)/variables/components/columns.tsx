"use client";

/**
 * Columns for the /variables list (Phase 4.5 redesign — variables.md §3).
 *
 * Notable departures from the pre-redesign table:
 *  - No `value` column. Secrets do not travel to the browser to render rows;
 *    reveal happens inside the detail panel's SecretField via
 *    GET_VARIABLE_VALUE (no-cache). (variables.md §3 / philosophy §9.)
 *  - Type uses the warning palette for plain-text — not hard-coded green —
 *    inverting the prior "encryption = positive" signal: plain text is the
 *    cautious state (variables.md U8).
 *  - Used-by surfaces THREE states: count, "—" (empty array), italic muted
 *    "Usage unavailable" (field missing — BE-1 not shipped). Never a fake
 *    "0 resources" against absent backend data.
 *  - Updated column uses RelativeTime (tooltip = absolute) — fixes U12.
 *  - Created column hidden by default, surfaced via the view menu.
 *  - The `currentUser` param is dropped; permissions gate at the page level.
 */

import { ColumnDef } from "@tanstack/react-table";
import { Lock, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { CopyButton } from "@/components/primitives/copy-button";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

export interface Variable {
  id: string;
  name: string;
  encrypted: boolean;
  /** Optional — only populated when BE-1 ships and a usage fetch resolves. */
  used_by?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnsOptions {
  /** Hide row-actions menu actions that require write permission. */
  readOnly?: boolean;
  /** Backend has shipped used_by? Until then we render "Usage unavailable". */
  usageAvailable?: boolean;
}

function NameCell({ name }: { name: string }) {
  const t = useTranslations();
  return (
    <div className="group flex items-center gap-2 min-w-0">
      <span className="font-mono text-sm font-medium truncate min-w-0">
        {name}
      </span>
      <CopyButton
        value={name}
        label={t("variables.detail.copyName")}
        size="icon"
        className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}

function TypeCell({ encrypted }: { encrypted: boolean }) {
  const t = useTranslations();
  if (encrypted) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock aria-hidden="true" className="size-4" strokeWidth={1} />
        <span>{t("variables.type.secret")}</span>
      </div>
    );
  }
  // Plain text — warning palette per variables.md §3 / U8.
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        // Tokenized warning palette (matches ConfirmDialog's amber treatment).
        "text-amber-700 dark:text-amber-400",
      )}
    >
      <Unlock aria-hidden="true" className="size-4" strokeWidth={1} />
      <span>{t("variables.type.plain")}</span>
    </div>
  );
}

function UsedByCell({
  usedBy,
  usageAvailable,
}: {
  usedBy: string[] | null | undefined;
  usageAvailable: boolean;
}) {
  const t = useTranslations();
  if (!usageAvailable || usedBy === undefined || usedBy === null) {
    return (
      <span className="text-xs italic text-muted-foreground">
        {t("variables.usedBy.unavailable")}
      </span>
    );
  }
  if (usedBy.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <Badge variant="secondary">
      {t("variables.usedBy.count", { count: usedBy.length })}
    </Badge>
  );
}

export function createColumns(
  options: ColumnsOptions = {},
): ColumnDef<Variable>[] {
  const { readOnly = false, usageAvailable = false } = options;

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(event) => event.stopPropagation()}
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => <NameCell name={row.original.name} />,
    },
    {
      accessorKey: "encrypted",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => <TypeCell encrypted={row.original.encrypted} />,
      filterFn: (row, id, value) => {
        return (value as unknown[]).includes(row.getValue(id));
      },
    },
    {
      accessorKey: "used_by",
      header: () => <span>Used by</span>,
      cell: ({ row }) => (
        <UsedByCell
          usedBy={row.original.used_by}
          usageAvailable={usageAvailable}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          <RelativeTime date={row.original.updatedAt} />
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          <RelativeTime date={row.original.createdAt} />
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions row={row} readOnly={readOnly} />
      ),
    },
  ];
}
