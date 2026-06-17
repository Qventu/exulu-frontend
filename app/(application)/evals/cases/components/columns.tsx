"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "@/components/primitives/relative-time";
import { TestCase } from "@/types/models/test-case";
import { UserWithRole } from "@EXULU_SHARED/models/user";

import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

export type CasesListTranslator = (key: string) => string;

/** Cell that renders the user-message count via ICU plural so the unit
 * agrees with the count. Lives as a component so we can call hooks. */
function MessagesCountCell({ inputs }: { inputs: any[] | undefined }) {
  const t = useTranslations("evals.cases.columns");
  // Test cases store [user, placeholder-assistant, user, ...] — counting all
  // entries inflates the number (a 2-turn case shows 4). We only care about
  // the user turns the author actually authored.
  const count = inputs?.filter((m) => m?.role === "user").length ?? 0;
  return (
    <Badge variant="secondary">
      {t("messagesCount", { count })}
    </Badge>
  );
}

export const createColumns = (
  user: UserWithRole,
  t: CasesListTranslator,
  edit: (test: TestCase) => void,
  onDeleted?: () => void,
): ColumnDef<TestCase>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("columns.name")} />
    ),
    cell: ({ row }) => (
      <div className="flex space-x-2">
        <span className="max-w-[400px] truncate font-medium">
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
          <span className="max-w-[500px] truncate text-muted-foreground">
            {description || "—"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "inputs",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t("columns.messages")} />
    ),
    cell: ({ row }) => (
      <MessagesCountCell inputs={row.getValue("inputs") as any[]} />
    ),
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
        <RelativeTime date={date} className="text-sm text-muted-foreground" />
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        user={user}
        onDeleted={onDeleted}
        edit={() => edit(row.original as TestCase)}
      />
    ),
  },
];
