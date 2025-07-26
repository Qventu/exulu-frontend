"use client";

import { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { User } from "@EXULU_SHARED/models/user";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { ClaudeCodeToggle } from "./claude-code-toggle";

export const columns: ColumnDef<User>[] = [
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
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => {
      /*const label = labels.find((label) => label.value === row.original.label)*/

      return (
        <div className="flex space-x-2">
          {/*{label && <Badge variant="outline">{label.label}</Badge>}*/}
          <span className="max-w-[300px] truncate font-medium">
            {row.original.email}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "roles",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Roles" />
    ),
    cell: ({ row }) => {
      return (
        <div className="gap-x-2 flex">
          {row.original.roles?.length ? (
            <>
              {row.original.roles.slice(0, 3).map((role, index) => (
                <Badge key={index} variant={"outline"}>
                  {role.role}
                </Badge>
              ))}
              {row.original.roles.length > 3 && (
                <Badge variant={"outline"}>
                  + {row.original.roles.length - 3} more
                </Badge>
              )}
            </>
          ) : (
            <Badge variant={"outline"}>N/a</Badge>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex w-[100px] items-center">
          {row.original.emailVerified ? (
            <p className="text-primary">verified</p>
          ) : (
            <p className="text-orange-400">pending</p>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "anthropic_token",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Claude Code" />
    ),
    cell: ({ row }) => {
      return (
        <ClaudeCodeToggle user={row.original} />
      );
    },
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
