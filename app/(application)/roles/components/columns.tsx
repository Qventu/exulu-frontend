"use client";

import { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserRole } from "@EXULU_SHARED/models/user-role";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

export const columns: ColumnDef<UserRole>[] = [
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
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      /*const label = labels.find((label) => label.value === row.original.label)*/

      return (
        <div className="flex space-x-2">
          {/*{label && <Badge variant="outline">{label.label}</Badge>}*/}
          <span className="max-w-[300px] truncate font-medium">
            {row.original.name}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "is_admin",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Admin" />
    ),
    cell: ({ row }) => {
      /*const label = labels.find((label) => label.value === row.original.label)*/

      return (
        <div className="flex space-x-2">
          {/*{label && <Badge variant="outline">{label.label}</Badge>}*/}
          <span className="max-w-[150px] truncate font-medium">
            {row.original.is_admin ? (
              <Badge variant={"default"}>Yes</Badge>
            ) : (
              <Badge variant={"outline"}>No</Badge>
            )}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "agents",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agents" />
    ),
    cell: ({ row }) => {
      return (
        <div className="gap-x-2 flex">
          {row.original.agents?.length ? (
            <>
              {row.original.agents.slice(0, 3).map((agent, index) => (
                <Badge key={index} variant={"outline"}>
                  {agent.name}
                </Badge>
              ))}
              {row.original.agents.length > 3 && (
                <Badge variant={"outline"}>
                  + {row.original.agents.length - 3} more
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
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
