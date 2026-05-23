"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { CheckCircle, XCircle } from "lucide-react";

export interface Model {
  id: string;
  name: string;
  description?: string;
  provider: string;
  authvariable?: string;
  active: boolean;
  requests_per_window?: number;
  window_seconds?: number;
  token_budget?: number;
  cost_budget_usd?: number;
  budget_window?: string;
  rights_mode?: string;
  created_by?: string;
  createdAt: string;
  updatedAt: string;
}

const accessBadgeVariant = (mode?: string) => {
  switch (mode) {
    case "public":
      return { label: "Public", variant: "default" as const };
    case "private":
      return { label: "Private", variant: "outline" as const };
    case "users":
      return { label: "Users", variant: "secondary" as const };
    case "roles":
      return { label: "Roles", variant: "secondary" as const };
    default:
      return { label: mode ?? "—", variant: "outline" as const };
  }
};

export const createColumns = (_currentUser: any): ColumnDef<Model>[] => [
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
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="max-w-[260px] truncate font-medium">
          {row.original?.name}
        </span>
        {row.original?.description ? (
          <span className="max-w-[260px] truncate text-xs text-muted-foreground">
            {row.original?.description}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original?.provider}</span>
    ),
  },
  {
    accessorKey: "authvariable",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Auth variable" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original?.authvariable || "—"}
      </span>
    ),
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: ({ row }) =>
      row.original?.active ? (
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
            Active
          </Badge>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <XCircle className="h-4 w-4 text-gray-500" />
          <Badge variant="outline">Inactive</Badge>
        </div>
      ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: "rights_mode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Access" />
    ),
    cell: ({ row }) => {
      const { label, variant } = accessBadgeVariant(row.original?.rights_mode);
      return <Badge variant={variant}>{label}</Badge>;
    },
  },
  {
    id: "limits",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Limits" />
    ),
    cell: ({ row }) => {
      const r = row.original;
      const parts: string[] = [];
      if (r?.requests_per_window && r?.window_seconds) {
        parts.push(`${r?.requests_per_window}/${r?.window_seconds}s`);
      }
      if (r?.token_budget) parts.push(`${r?.token_budget} tok`);
      if (r?.cost_budget_usd) parts.push(`$${r?.cost_budget_usd}`);
      return (
        <span className="text-xs text-muted-foreground">
          {parts.length ? parts.join(" · ") : "—"}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {new Date(row.original?.createdAt).toLocaleDateString()}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
