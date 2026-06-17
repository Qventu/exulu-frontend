"use client";

/**
 * Route-local wrapper around the shared `<BudgetEditor>` widget that adds:
 *  (a) i18n'd Dialog chrome (title / description per single|bulk mode);
 *  (b) keyboard/touch-reachable "current status" bar via BudgetBarWithDetails
 *      — the editor's own inline `<BudgetBar>` is suppressed via the
 *      additive `hideCurrentStatus` prop (budgets.md ladder item 32);
 *  (c) a `<ConfirmDialog>` gate in front of the Remove path (the page-doc's
 *      #1 High UX bug — item 39); the editor's own inline destructive button
 *      is suppressed via the additive `hideRemove` prop, so admins cannot
 *      hit an unconfirmed delete by visual proximity (the previous "two
 *      Remove buttons" foot-gun the adversarial review flagged);
 *  (d) a partial-failure detail Dialog after bulk apply (budgets.md item 38)
 *      that lists each entity's error via `BulkBudgetResult.error` instead
 *      of collapsing everything into a single "x failed" line.
 *
 * Note on the modal-on-modal compromise: philosophy.md §59 calls
 * "dialog opens dialog" a bug and budgets.md concept §3 proposes an INLINE
 * two-step remove confirm inside `BudgetEditor`. We took the additive-prop
 * route instead because the cross-feature stability constraint allows that
 * (only additive props on the editor; no rewrite of the destructive button
 * contract inside the shared widget). The inline-confirm refactor is queued
 * as a follow-up.
 */

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { BudgetEditor } from "@/components/budget-editor";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { budgetsApi, type BulkBudgetResult } from "@/lib/api/budgets";
import type { BudgetEntityType, BudgetInfo } from "@/lib/budget";

import { BudgetBarWithDetails } from "./budget-bar-with-details";

export type EditorState =
  | { mode: "single"; entityId: string; label: string; initial: BudgetInfo | null }
  | { mode: "bulk"; entityIds: string[]; label: string }
  | null;

export interface BudgetEditorDialogProps {
  state: EditorState;
  entityType: BudgetEntityType;
  onClose: () => void;
  onDone: () => void;
}

interface BulkFailure {
  entityId: string;
  message: string;
}

export function BudgetEditorDialog({
  state,
  entityType,
  onClose,
  onDone,
}: BudgetEditorDialogProps) {
  const t = useTranslations("budgets");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [bulkFailures, setBulkFailures] = React.useState<BulkFailure[]>([]);

  const hasExistingBudget =
    state?.mode === "single" && !!state.initial?.max_budget;

  const handleRemoveConfirm = React.useCallback(async () => {
    if (state?.mode !== "single") return;
    try {
      await budgetsApi.remove(entityType, state.entityId);
      toast.success(t("editor.removedTitle"), {
        description: t("editor.removedDescription", { name: state.label }),
      });
      onDone();
    } catch (err) {
      toast.error(t("editor.removeFailedTitle"), {
        description:
          err instanceof Error ? err.message : t("editor.unknownError"),
      });
      // Reject to keep the ConfirmDialog open per the primitive contract.
      throw err;
    }
  }, [state, entityType, onDone, t]);

  const handleBulkComplete = React.useCallback(
    (results: BulkBudgetResult[]) => {
      const failures = results
        .filter((r) => !r.ok)
        .map((r) => ({
          entityId: r.entityId,
          message: r.error ?? t("editor.unknownError"),
        }));
      const ok = results.length - failures.length;
      if (failures.length === 0) {
        toast.success(t("editor.bulkAppliedTitle"), {
          description: t("editor.bulkAllSucceeded", { ok }),
        });
        onDone();
        return;
      }
      // Partial failure — show the inline detail list and DEFER onDone until
      // the user has seen the per-entity errors (budgets.md item 38).
      toast.error(t("editor.bulkAppliedTitle"), {
        description: t("editor.bulkPartialSummary", {
          ok,
          failed: failures.length,
        }),
      });
      setBulkFailures(failures);
    },
    [onDone, t],
  );

  const handleFailureDetailsClose = React.useCallback(() => {
    setBulkFailures([]);
    onDone();
  }, [onDone]);

  return (
    <>
      <Dialog
        open={!!state}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {state?.mode === "bulk"
                ? t("editor.titleBulk")
                : hasExistingBudget
                  ? t("editor.titleEdit")
                  : t("editor.titleSet")}
            </DialogTitle>
            <DialogDescription>{state ? state.label : ""}</DialogDescription>
          </DialogHeader>
          {state ? (
            <div className="space-y-4">
              {state.mode === "single" && hasExistingBudget && state.initial ? (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t("editor.currentStatus")}
                  </span>
                  <BudgetBarWithDetails
                    budget={state.initial}
                    triggerLabel={state.label}
                  />
                </div>
              ) : null}
              {state.mode === "single" ? (
                <BudgetEditor
                  mode="single"
                  entityType={entityType}
                  entityId={state.entityId}
                  initial={state.initial}
                  label={state.label}
                  onDone={onDone}
                  onCancel={onClose}
                  hideRemove
                  hideCurrentStatus
                />
              ) : (
                <BudgetEditor
                  mode="bulk"
                  entityType={entityType}
                  entityIds={state.entityIds}
                  label={state.label}
                  onDone={onDone}
                  onCancel={onClose}
                  onBulkComplete={handleBulkComplete}
                />
              )}
              {state.mode === "single" && hasExistingBudget ? (
                <div className="flex justify-end border-t pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t("editor.removeBudget")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("editor.removeConfirmTitle")}
        description={
          state?.mode === "single"
            ? t("editor.removeConfirmBody", { name: state.label })
            : undefined
        }
        confirmLabel={t("editor.removeConfirmAction")}
        onConfirm={handleRemoveConfirm}
      />

      <Dialog
        open={bulkFailures.length > 0}
        onOpenChange={(open) => {
          if (!open) handleFailureDetailsClose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editor.bulkFailureTitle")}</DialogTitle>
            <DialogDescription>
              {t("editor.bulkFailureDescription", {
                count: bulkFailures.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <ul
            role="alert"
            className="-mx-1 max-h-[50dvh] space-y-2 overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          >
            {bulkFailures.map((failure) => (
              <li
                key={failure.entityId}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
              >
                <span className="break-all font-medium text-destructive">
                  {failure.entityId}
                </span>
                <span className="text-muted-foreground">{failure.message}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={handleFailureDetailsClose}>
              {t("editor.bulkFailureDone")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
