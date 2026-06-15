"use client";

/**
 * Add-user dialog — replaces add-user-modal.tsx (access.md ladder #10-#12).
 *
 * Fixes:
 * - U10/inline: email validation surfaces as inline field error, not a toast.
 * - U14: secure password generator (crypto.getRandomValues) via the shared
 *   helper in hooks.ts. CopyField primitive replaces the hand-rolled
 *   show/hide/copy buttons.
 * - U17: SSO branch no longer sends an empty password string; proper
 *   try/catch around the mutation; success-only toast.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigContext } from "@/components/shell/config-context";

import { generateSecurePassword, useCreateUser } from "../hooks";

export interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "email" | "password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const t = useTranslations("access.users.addUser");
  const configContext = React.useContext(ConfigContext);
  const createUser = useCreateUser();

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Reset on open. Avoids stale state if the dialog is closed mid-flow.
  React.useEffect(() => {
    if (open) {
      setStep("email");
      setEmail("");
      setEmailError(null);
      setPassword("");
      setSubmitting(false);
    }
  }, [open]);

  const passwordMode = configContext?.auth_mode === "password";

  const validateEmail = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return t("errors.emailRequired");
    if (!EMAIL_REGEX.test(trimmed)) return t("errors.emailInvalid");
    return null;
  };

  const handleEmailNext = async () => {
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;

    if (passwordMode) {
      setPassword(generateSecurePassword());
      setStep("password");
      return;
    }

    // SSO branch — immediate create, no password sent (U17).
    setSubmitting(true);
    try {
      await createUser({
        email: email.trim(),
        type: "user",
        emailVerified: new Date().toISOString(),
      });
      toast.success(t("successTitle"), {
        description: t("successDescription", { email: email.trim() }),
      });
      onOpenChange(false);
    } catch (caught) {
      toast.error(t("failedTitle"), {
        description:
          caught instanceof Error ? caught.message : t("failedDescription"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordCreate = async () => {
    setSubmitting(true);
    try {
      await createUser({
        email: email.trim(),
        password,
      });
      toast.success(t("successTitle"), {
        description: t("successDescriptionTempPassword", {
          email: email.trim(),
        }),
      });
      onOpenChange(false);
    } catch (caught) {
      toast.error(t("failedTitle"), {
        description:
          caught instanceof Error ? caught.message : t("failedDescription"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = step === "email" ? t("title") : t("passwordTitle");
  const description =
    step === "email" ? t("description") : t("passwordDescription");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <div className="space-y-2">
            <Label htmlFor="add-user-email">{t("emailLabel")}</Label>
            <Input
              id="add-user-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(validateEmail(event.target.value));
              }}
              placeholder={t("emailPlaceholder")}
              autoFocus
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "add-user-email-error" : undefined}
            />
            {emailError ? (
              <p
                id="add-user-email-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {emailError}
              </p>
            ) : null}
          </div>
        )}

        {step === "password" && (
          <div className="space-y-2">
            <CopyField
              value={password}
              label={t("passwordLabel")}
              masked
            />
            <p className="text-xs text-muted-foreground">
              {t("handoffHint", { email: email.trim() })}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          {step === "email" ? (
            <Button onClick={handleEmailNext} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("creating")}
                </>
              ) : passwordMode ? (
                t("continue")
              ) : (
                t("create")
              )}
            </Button>
          ) : (
            <Button onClick={handlePasswordCreate} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                t("create")
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
