"use client";

/**
 * DataTableRowActions — overflow menu for a variables-list row.
 *
 * Changes per Phase 4.5 (variables.md §3):
 *  - Uses the shared ConfirmDialog primitive — no ad-hoc AlertDialog
 *    (design-system audit R5 / H6).
 *  - "View usage" is ALWAYS rendered (not gated on a count we cannot get
 *    until BE-1 ships). It opens the deep-linked Usage page; the detail
 *    panel surfaces the same content inline.
 *  - In read-only mode (variables:read without write), Edit + Delete are
 *    suppressed — only View usage remains.
 */

import { useMutation } from "@apollo/client";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import { Edit, Eye, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GET_VARIABLES_LIST,
  REMOVE_VARIABLE_BY_ID,
} from "@/queries/queries";

import { Variable } from "./columns";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  readOnly?: boolean;
}

export function DataTableRowActions<TData>({
  row,
  readOnly = false,
}: DataTableRowActionsProps<TData>) {
  const t = useTranslations();
  const variable = row.original as Variable;
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [removeVariable] = useMutation(REMOVE_VARIABLE_BY_ID, {
    refetchQueries: [GET_VARIABLES_LIST, "GetVariablesList"],
  });

  const handleDelete = async () => {
    try {
      await removeVariable({ variables: { id: variable.id } });
      toast.success(t("variables.delete.success"));
    } catch (error) {
      toast.error(t("variables.delete.error"));
      throw error; // keep dialog open
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 p-0 data-[state=open]:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <DotsHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[180px]"
          onClick={(event) => event.stopPropagation()}
        >
          {!readOnly && (
            <DropdownMenuItem asChild>
              <Link href={`/variables/edit/${variable.id}`}>
                <Edit className="mr-2 size-4" strokeWidth={1} />
                {t("variables.actions.edit")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/variables/usage/${variable.id}`}>
              <Eye className="mr-2 size-4" strokeWidth={1} />
              {t("variables.actions.viewUsage")}
            </Link>
          </DropdownMenuItem>
          {!readOnly && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmOpen(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" strokeWidth={1} />
                {t("variables.actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("variables.delete.title")}
        description={t("variables.delete.bodyUnused", { name: variable.name })}
        confirmLabel={t("variables.delete.confirm")}
        onConfirm={handleDelete}
      />
    </>
  );
}
