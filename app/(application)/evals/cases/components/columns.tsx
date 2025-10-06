"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { TestCase } from "@/types/models/test-case";
import { User } from "@EXULU_SHARED/models/user";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export const createColumns = (user: User): ColumnDef<TestCase>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex space-x-2">
          <span className="max-w-[400px] truncate font-medium">
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
    accessorKey: "inputs",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Messages" />
    ),
    cell: ({ row }) => {
      const inputs = row.getValue("inputs") as any[];
      return (
        <Badge variant="secondary">
          {inputs?.length || 0} messages
        </Badge>
      );
    },
  },
  {
    accessorKey: "expectedTools",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expected Tools" />
    ),
    cell: ({ row }) => {
      const tools = row.getValue("expectedTools") as string[];
      if (!tools || tools.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant="outline">
          {tools.length} tools
        </Badge>
      );
    },
  },
  {
    accessorKey: "expectedKnowledgeSources",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expected Contexts" />
    ),
    cell: ({ row }) => {
      const contexts = row.getValue("expectedKnowledgeSources") as string[];
      if (!contexts || contexts.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant="outline">
          {contexts.length} contexts
        </Badge>
      );
    },
  },
  {
    accessorKey: "expectedAgentTools",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expected Agents" />
    ),
    cell: ({ row }) => {
      const agents = row.getValue("expectedAgentTools") as string[];
      if (!agents || agents.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant="outline">
          {agents.length} agents
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
