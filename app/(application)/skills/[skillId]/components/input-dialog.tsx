"use client";

/**
 * InputDialog (stub) — route-local stand-in for the future
 * `components/primitives/input-dialog.tsx` primitive named in
 * `design/codebase-structure.md` §2.3 (skills × 4 + prompts / agents /
 * knowledge rename flows). Built here in-tree per the parallel-protocol
 * (rule 11) — builders cannot touch `components/primitives/**`. When the
 * primitive is promoted, this file is deleted and import paths swap; the
 * prop sketch matches §2.3 so the swap is mechanical.
 *
 * Replaces FOUR legacy entry points in the skills editor (skills.md
 * inventory + UX review H4 + L4):
 *   #47 Save Version label  — `window.prompt("Version label (optional):")`
 *   #53 create file         — bespoke <CreateItemModal mode="create" type="file">
 *   #54 create folder       — bespoke <CreateItemModal mode="create" type="folder">
 *   #55/56 rename file/dir  — bespoke <CreateItemModal mode="rename">
 *
 * Behavior:
 *  - Resets `value` to `defaultValue` every time `open` flips to true (so
 *    rename pre-fills the current name, create starts empty).
 *  - `allowEmpty=false` (default) keeps the confirm disabled while the
 *    trimmed value is empty; Save Version sets `allowEmpty=true` because
 *    the label is optional.
 *  - `validate` runs on every change; the returned message renders under
 *    the input and gates the confirm.
 *  - `onSubmit` may return a promise; while pending the confirm shows a
 *    spinner, both buttons are disabled, and the dialog cannot be
 *    dismissed. Resolve closes; reject leaves the dialog open so the
 *    consumer can surface a toast and let the user retry (mirrors
 *    ConfirmDialog semantics).
 *  - Native `<form>` so Enter submits — matches the legacy CreateItemModal.
 *
 * Responsive: `sm:max-w-md` centered dialog (fits 390 px per
 * responsive.md T5).
 */

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

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
import { cn } from "@/lib/utils";

export interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  /** Helper line below the input (e.g. Save Version snapshot explanation). */
  helperText?: string;
  confirmLabel?: string;
  /** Allow empty submission. Save Version label is optional. @default false */
  allowEmpty?: boolean;
  /** Returns an error message (renders under input + blocks submit) or null. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => Promise<void> | void;
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = "",
  helperText,
  confirmLabel,
  allowEmpty = false,
  validate,
  onSubmit,
}: InputDialogProps) {
  const t = useTranslations("common");
  const inputId = React.useId();
  const [value, setValue] = React.useState(defaultValue);
  const [pending, setPending] = React.useState(false);

  // Reset every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setPending(false);
    }
  }, [open, defaultValue]);

  const trimmed = value.trim();
  const validationError = validate ? validate(value) : null;
  const isEmpty = trimmed.length === 0;
  const submitDisabled =
    pending || Boolean(validationError) || (!allowEmpty && isEmpty);

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitDisabled) return;
    setPending(true);
    try {
      await onSubmit(allowEmpty ? value : trimmed);
      onOpenChange(false);
    } catch {
      // Stay open — caller surfaces details (toast).
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={inputId}>{label}</Label>
            <Input
              id={inputId}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              disabled={pending}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {validationError ? (
              <p className="text-xs text-destructive" role="alert">
                {validationError}
              </p>
            ) : helperText ? (
              <p className="text-xs text-muted-foreground">{helperText}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitDisabled}
              aria-busy={pending}
              className={cn(pending && "gap-2")}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {confirmLabel ?? t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
