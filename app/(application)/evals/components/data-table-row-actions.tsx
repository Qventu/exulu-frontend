"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";
import { useMutation } from "@apollo/client";
import { ExternalLink, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { DELETE_EVAL_SET } from "@/queries/queries";
import { UserWithRole } from "@EXULU_SHARED/models/user";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
  user: UserWithRole;
  /** Called after a successful delete so the parent table can refetch. */
  onDeleted?: () => void;
}

export function DataTableRowActions<TData>({
  row,
  user,
  onDeleted,
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const t = useTranslations("evals.list");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const evalSet = row.original as any;

  const canWrite = user.super_admin || user.role?.evals === "write";

  const [deleteEvalSet] = useMutation(DELETE_EVAL_SET);

  const handleDelete = async () => {
    try {
      await deleteEvalSet({ variables: { id: evalSet.id } });
      toast.success(t("deleteSuccess.title"), {
        description: t("deleteSuccess.description"),
      });
      onDeleted?.();
    } catch (error: any) {
      toast.error(t("deleteError.title"), { description: error?.message });
      throw error; // keeps the ConfirmDialog open on failure
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
              router.push(`/evals/${evalSet.id}`);
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("rowActions.open")}
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
        description={t("deleteConfirm.description", { name: evalSet.name })}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
