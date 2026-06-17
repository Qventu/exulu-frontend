"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import { useMutation } from "@apollo/client";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { DELETE_TEST_CASE } from "@/queries/queries";
import { UserWithRole } from "@EXULU_SHARED/models/user";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  user: UserWithRole;
  edit: () => void;
  onDeleted?: () => void;
}

export function DataTableRowActions<TData>({
  row,
  user,
  edit,
  onDeleted,
}: DataTableRowActionsProps<TData>) {
  const t = useTranslations("evals.cases");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const testCase = row.original as any;

  const canWrite = user.super_admin || user.role?.evals === "write";

  const [deleteTestCase] = useMutation(DELETE_TEST_CASE);

  const handleDelete = async () => {
    try {
      await deleteTestCase({ variables: { id: testCase.id } });
      toast.success(t("deleteSuccess.title"));
      onDeleted?.();
    } catch (error: any) {
      toast.error(t("deleteError.title"), { description: error?.message });
      throw error;
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">{t("rowActions.menu")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              edit();
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t("rowActions.edit")}
          </DropdownMenuItem>
          {canWrite && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("rowActions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("deleteConfirm.title")}
        description={t("deleteConfirm.description", { name: testCase.name })}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
