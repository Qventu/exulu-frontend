"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sharedArtifactsApi } from "@/lib/api/shared-artifacts";

export interface DeleteArtifactDialogProps {
  name: string | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (name: string) => void;
}

/** Deletes the share row (and its rbac scope). The object in storage is untouched. */
export function DeleteArtifactDialog({ name, onOpenChange, onDeleted }: DeleteArtifactDialogProps) {
  const t = useTranslations("artifacts");
  const [deleting, setDeleting] = React.useState(false);

  const confirm = async () => {
    if (!name) return;
    setDeleting(true);
    try {
      await sharedArtifactsApi.deleteByName(name);
      toast.success(t("deleted", { name }));
      onDeleted(name);
      onOpenChange(false);
    } catch (err) {
      toast.error(t("deleteFailed"), { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={name !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle", { name: name ?? "" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            {t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
