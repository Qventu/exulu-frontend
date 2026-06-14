"use client";

/**
 * DeleteRoutineDialog — type-the-name confirm with click-to-copy affordance.
 *
 * Workflows.md ladder #44: kept deliberately for parity. Uses the shared
 * ConfirmDialog's typeToConfirm prop; the copy-name shortcut renders the
 * name as a clickable span inside the description, copying to clipboard on
 * click (toast confirmation).
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";

import type { Routine } from "../types";

export interface DeleteRoutineDialogProps {
  routine: Routine | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteRoutineDialog({
  routine,
  onClose,
  onConfirm,
}: DeleteRoutineDialogProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");

  const copyName = async () => {
    if (!routine) return;
    try {
      await navigator.clipboard.writeText(routine.name);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  return (
    <ConfirmDialog
      open={routine !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("delete.title", { name: routine?.name ?? "" })}
      description={
        routine ? (
          <span>
            {t("delete.descriptionBefore")}{" "}
            <button
              type="button"
              onClick={copyName}
              className="cursor-pointer font-semibold underline-offset-2 hover:underline"
            >
              {routine.name}
            </button>{" "}
            {t("delete.descriptionAfter")}
          </span>
        ) : null
      }
      variant="destructive"
      typeToConfirm={routine?.name}
      onConfirm={async () => {
        if (!routine) return;
        try {
          await onConfirm(routine.id);
          toast.success(t("delete.success", { name: routine.name }));
        } catch (err) {
          toast.error(t("delete.failed"), {
            description: (err as Error).message,
          });
          throw err; // keep open
        }
      }}
      confirmLabel={t("delete.confirmLabel")}
    />
  );
}
