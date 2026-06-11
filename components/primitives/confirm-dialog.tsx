"use client";

/**
 * ConfirmDialog — THE single destructive-confirmation primitive.
 *
 * Spec: design/codebase-structure.md §2.2 (`confirm-dialog.tsx`) — replaces all native
 * `confirm()` call sites and ad-hoc AlertDialogs (design-system audit R5 / H6;
 * responsive.md hard rule 5). Built on `ui/alert-dialog.tsx` (Radix AlertDialog).
 *
 * Features per spec:
 * - Async pending state: `onConfirm` returns a Promise. While it is in flight the
 *   actions are disabled, a spinner shows, and the dialog cannot be dismissed.
 *   **Resolve = success → the dialog closes itself. Reject = failure → the dialog
 *   stays open** (surface details via the `errors` prop or a toast, then let the
 *   user retry or cancel).
 * - `typeToConfirm`: type-the-entity-name friction for high-blast-radius deletes
 *   (agents / workflows). The confirm action stays disabled until the input matches.
 * - `options`: cascade checkboxes ("also delete …") — selected ids are passed to
 *   `onConfirm` (projects / evals / knowledge).
 * - `errors`: per-item bulk-operation failure report (access U4) rendered as an
 *   inline destructive list, announced via `role="alert"`.
 * - `children`: generic extension slot rendered between description and options.
 *
 * Responsive: simple centered dialog (responsive.md T5 — `max-w-lg` fits at 390px);
 * body is capped at `max-h-[85dvh]` (V1: dvh, never vh) with the middle region
 * scrolling and the title/footer pinned.
 *
 * Documented alongside (codebase-structure §2.1): deletes that originate INSIDE an
 * already-open dialog (e.g. the budgets editor) must NOT stack a ConfirmDialog on
 * top — one overlay at a time, never modal-on-modal. Use the two-step inline
 * confirm pattern instead: the destructive button swaps in place to a
 * "Confirm — this cannot be undone" destructive button + cancel, with the same
 * async-pending semantics as this component.
 */

import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ConfirmDialogOption {
  id: string;
  label: string;
  /** Affected-item count shown next to the label (blast radius). */
  count?: number;
}

export interface ConfirmDialogError {
  item: string;
  message: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Blast-radius statement — what exactly happens, what is affected. */
  description?: React.ReactNode;
  variant?: "destructive" | "default";
  /** Defaults to common.delete (destructive) / common.confirm (default). */
  confirmLabel?: string;
  /** Entity name the user must type before the confirm action enables. */
  typeToConfirm?: string;
  /** Cascade checkboxes; selected ids are passed to `onConfirm`. */
  options?: ConfirmDialogOption[];
  /**
   * Resolve to close the dialog; reject to keep it open (pending state is
   * handled internally either way).
   */
  onConfirm: (optionIds?: string[]) => Promise<void>;
  /** Per-item bulk failure report; keep the dialog open by rejecting `onConfirm`. */
  errors?: ConfirmDialogError[];
  /** Extension slot rendered between description and options. */
  children?: React.ReactNode;
}

/**
 * The only destructive-confirmation surface in the app
 * (design/codebase-structure.md §2.2).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "destructive",
  confirmLabel,
  typeToConfirm,
  options,
  onConfirm,
  errors,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations();
  const inputId = React.useId();
  const [pending, setPending] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Fresh state every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setPending(false);
      setTyped("");
      setSelectedIds([]);
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (pending) return; // never dismissible mid-flight
    onOpenChange(next);
  };

  const toggleOption = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((v) => v !== id),
    );
  };

  const typeGateOpen =
    !typeToConfirm || typed.trim() === typeToConfirm.trim();

  const handleConfirm = async () => {
    if (pending || !typeGateOpen) return;
    setPending(true);
    try {
      await onConfirm(options ? selectedIds : undefined);
      onOpenChange(false);
    } catch {
      // Rejection = stay open; the consumer surfaces details (errors prop / toast).
    } finally {
      setPending(false);
    }
  };

  const resolvedConfirmLabel =
    confirmLabel ??
    (variant === "destructive" ? t("common.delete") : t("common.confirm"));

  const hasBody =
    Boolean(children) ||
    (options?.length ?? 0) > 0 ||
    Boolean(typeToConfirm) ||
    (errors?.length ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex max-h-[85dvh] flex-col gap-4">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {hasBody ? (
          <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
            {children}

            {options && options.length > 0 ? (
              <div className="flex flex-col gap-1">
                {options.map((option) => {
                  const optionId = `${inputId}-option-${option.id}`;
                  return (
                    <div
                      key={option.id}
                      className="flex min-h-10 items-center gap-2"
                    >
                      <Checkbox
                        id={optionId}
                        checked={selectedIds.includes(option.id)}
                        onCheckedChange={(checked) =>
                          toggleOption(option.id, checked === true)
                        }
                        disabled={pending}
                      />
                      <Label
                        htmlFor={optionId}
                        className="flex flex-1 cursor-pointer items-center gap-2 py-2 font-normal"
                      >
                        <span>{option.label}</span>
                        {option.count !== undefined ? (
                          <span className="text-xs text-muted-foreground">
                            {option.count}
                          </span>
                        ) : null}
                      </Label>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {typeToConfirm ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={inputId} className="font-normal">
                  {t("common.typeToConfirmLabel", { name: typeToConfirm })}
                </Label>
                <Input
                  id={inputId}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  disabled={pending}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={typeToConfirm}
                />
              </div>
            ) : null}

            {errors && errors.length > 0 ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3"
              >
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                  {t("common.bulkErrorSummary", { count: errors.length })}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {errors.map((error, index) => (
                    <li
                      key={`${error.item}-${index}`}
                      className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
                    >
                      <span className="break-all font-medium">
                        {error.item}
                      </span>
                      <span className="text-muted-foreground">
                        {error.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending || !typeGateOpen}
            aria-busy={pending}
            className={cn(pending && "gap-2")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {resolvedConfirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
