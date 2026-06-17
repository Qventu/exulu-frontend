"use client";

/**
 * EditEvalSetDialog — name + description editor for an eval set, extracted
 * from the previous in-page Card so the detail surface can be split into
 * Results / Test cases tabs without bloating the page (design/pages/evals.md
 * §5.1 — overflow menu entry, write-only).
 *
 * The eval-set membership (which test cases belong here) is a separate flow
 * and is NOT touched here.
 */

import { useMutation } from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UPDATE_EVAL_SET } from "@/queries/queries";
import { EvalSet } from "@/types/models/eval-set";

export interface EditEvalSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evalSet: Pick<EvalSet, "id" | "name" | "description"> | null;
  canWrite: boolean;
  onSaved?: () => void;
}

export function EditEvalSetDialog({
  open,
  onOpenChange,
  evalSet,
  canWrite,
  onSaved,
}: EditEvalSetDialogProps) {
  const t = useTranslations("evals.detail.editDialog");
  const tCommon = useTranslations("evals.common");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Seed local form state from the eval set every time the dialog opens so
  // canceling and reopening discards uncommitted edits.
  useEffect(() => {
    if (open && evalSet) {
      setName(evalSet.name ?? "");
      setDescription(evalSet.description ?? "");
    }
  }, [open, evalSet]);

  const [updateEvalSet, { loading }] = useMutation(UPDATE_EVAL_SET, {
    onCompleted: () => {
      toast.success(t("successTitle"));
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(t("errorTitle"), { description: error.message });
    },
  });

  const handleSave = () => {
    if (!evalSet) return;
    if (!name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }
    updateEvalSet({
      variables: {
        id: evalSet.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-eval-set-name">{t("nameLabel")}</Label>
            <Input
              id="edit-eval-set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canWrite || loading}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-eval-set-description">
              {t("descriptionLabel")}
            </Label>
            <Textarea
              id="edit-eval-set-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canWrite || loading}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canWrite || loading || !name.trim()}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
