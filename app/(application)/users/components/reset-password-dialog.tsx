"use client";

/**
 * Reset-password dialog — extracted from the legacy row-actions component
 * (access.md ladder #25). Uses the shared CopyField primitive (no hand-rolled
 * show/hide + copy buttons) and the secure password generator from hooks.ts
 * (U14). Toast fires only AFTER the mutation resolves (U4).
 */

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { CopyField } from "@/components/primitives/copy-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { generateSecurePassword, useResetPassword } from "../hooks";

export interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string | number; email: string };
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
}: ResetPasswordDialogProps) {
  const t = useTranslations("access.users.resetPassword");
  const resetPassword = useResetPassword();
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPassword(generateSecurePassword());
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await resetPassword(user.id, password);
      toast.success(t("successTitle"), {
        description: t("successDescription", { email: user.email }),
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(t("failedTitle"), {
        description:
          error instanceof Error ? error.message : t("failedDescription"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { email: user.email })}
          </DialogDescription>
        </DialogHeader>

        <CopyField value={password} label={t("passwordLabel")} masked />

        <p className="text-xs text-muted-foreground">{t("handoffHint")}</p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !password}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("resetting")}
              </>
            ) : (
              t("confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
