"use client";

import { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

export interface Variable {
  id: string;
  name: string;
  value: string;
  encrypted: boolean;
  used_by: string[];
  createdAt: string;
  updatedAt: string;
}

export const createColumns = (currentUser: any): ColumnDef<Variable>[] => [
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
      return (
        <div className="flex space-x-2">
          <span className="max-w-[200px] truncate font-medium">
            {row.original.name}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "value",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Value" />
    ),
    cell: ({ row }) => {
      const [showValue, setShowValue] = React.useState(false);
      const isEncrypted = row.original.encrypted;
      const value = row.original.value;
      
      return (
        <div className="flex items-center space-x-2">
          <span className="max-w-[200px] truncate font-mono text-sm">
            {isEncrypted && !showValue ? 
              "••••••••••••••••" : 
              (showValue ? value : value.substring(0, 20) + (value.length > 20 ? "..." : ""))
            }
          </span>
          {(isEncrypted || value.length > 20) && (
            <button
              onClick={() => setShowValue(!showValue)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {showValue ? (
                <EyeOff className="h-4 w-4 text-gray-500" />
              ) : (
                <Eye className="h-4 w-4 text-gray-500" />
              )}
            </button>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "encrypted",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Encryption" />
    ),
    cell: ({ row }) => {
      const isEncrypted = row.original.encrypted;
      return (
        <div className="flex items-center space-x-2">
          {isEncrypted ? (
            <>
              <Lock className="h-4 w-4 text-green-600" />
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                Encrypted
              </Badge>
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4 text-gray-500" />
              <Badge variant="outline">
                Plain Text
              </Badge>
            </>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "used_by",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Used By" />
    ),
    cell: ({ row }) => {
      // todo query agents and users to check where the variable is used
      //  do this by creating a graphql query in graphql.ts that executes
      //  a database query on users counting where anthropic_token is the variable id
      //  and agents counting where the variable name occurs in their config json column
      const usedBy = row.original.used_by || [];
      return (
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {usedBy.length} resource{usedBy.length !== 1 ? 's' : ''}
          </Badge>
          {usedBy.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {usedBy.slice(0, 2).map(id => {
                const [type] = id.split('/');
                return type;
              }).join(', ')}
              {usedBy.length > 2 && ` +${usedBy.length - 2} more`}
            </span>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];