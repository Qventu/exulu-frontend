"use client";

import { ColumnDef } from "@tanstack/react-table";

import { EvalSet } from "@/types/models/eval-set";
import { UserWithRole } from "@EXULU_SHARED/models/user";
import { RelativeTime } from "@/components/primitives/relative-time";

import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

// NOTE: BE-1 hasn't shipped the aggregate fields yet (cases count, last-run
// timestamp). design/pages/evals.md §3 forbids a client-side fan-out per row
// to keep the list fast — those columns wait until the backend exposes them
// on the eval set summary. Keys (evals.list.columns.cases / .lastRun) are
// already in the catalog so the next pass only needs to add the cells here.
export type EvalsListTranslator = (key: string) => string;

export const createColumns = (
  user: UserWithRole,
  t: EvalsListTranslator,
  onDeleted?: () => void,
): ColumnDef<EvalSet>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("columns.name")} />
    ),
    cell: ({ row }) => (
      <div className="flex space-x-2">
        <span className="max-w-[500px] truncate font-medium">
          {row.getValue("name")}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("columns.description")} />
    ),
    cell: ({ row }) => {
      const description = row.getValue("description") as string;
      return (
        <div className="flex space-x-2">
          <span className="max-w-[300px] truncate text-muted-foreground">
            {description || "—"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("columns.updated")} />
    ),
    cell: ({ row }) => {
      const date = row.getValue("updatedAt") as string;
      if (!date) return <span className="text-muted-foreground">—</span>;
      return (
        <RelativeTime
          date={date}
          className="text-sm text-muted-foreground"
        />
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DataTableRowActions row={row} user={user} onDeleted={onDeleted} />
    ),
  },
];
