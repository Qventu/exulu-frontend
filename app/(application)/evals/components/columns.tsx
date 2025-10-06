"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { EvalSet } from "@/types/models/eval-set";
import { User } from "@EXULU_SHARED/models/user";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export const createColumns = (user: User): ColumnDef<EvalSet>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex space-x-2">
          <span className="max-w-[500px] truncate font-medium">
            {row.getValue("name")}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
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
    accessorKey: "testCases",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Test Cases" />
    ),
    cell: ({ row }) => {
      const testCases = row.getValue("testCases") as string[];
      return (
        <Badge variant="secondary">
          {testCases?.length || 0} test cases
        </Badge>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("updatedAt") as string;
      return (
        <div className="flex w-[100px] items-center">
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} user={user} />,
  },
];
