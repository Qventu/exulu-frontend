"use client";

import { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { User } from "@EXULU_SHARED/models/user";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { ClaudeCodeToggle } from "./claude-code-toggle";
import { SuperAdminToggle } from "./super-admin-toggle";
import { RoleSelector } from "@/components/ui/role-selector";

export const createColumns = (currentUser: any, roleChange: (role: string) => void): ColumnDef<User>[] => [
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
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      return (
        <div className="gap-x-2 flex">
          <RoleSelector value={row.original.role} onChange={(role) => {
                // warning modal
                // todo rbac and / or super_admin check
                const confirm = window.confirm("Are you sure you want to update the role for this user?");
                if (!confirm) {
                  return;
                }
                roleChange(role);
              }} />
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
  ...(currentUser?.super_admin ? [{
    accessorKey: "super_admin",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Super Admin" />
    ),
    cell: ({ row }) => {
      return (
        <SuperAdminToggle user={row.original} />
      );
    },
    enableSorting: false,
  }] : []),
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
