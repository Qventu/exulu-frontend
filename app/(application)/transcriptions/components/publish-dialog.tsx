"use client";

/**
 * Explains what "saving" a reviewed transcript actually does before it
 * happens.
 *
 * The action used to be labelled "Save transcript", which reads like
 * persisting a draft. It is closer to publishing: the corrected text replaces
 * the raw one, the transcript enters the Transcriptions knowledge base, and
 * every agent with access can search and cite it from then on. Nothing on
 * screen said so, so reviewers had no way to know what they were agreeing to
 * — hence the rename and this one-time confirm.
 *
 * The three steps reveal in sequence rather than appearing at once: the point
 * is that something happens *to* the transcript, and a staggered reveal reads
 * as a pipeline instead of a wall of bullets.
 */
import { Check, Loader2, Share2, Sparkles, Users } from "lucide-react";
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
import { cn } from "@/lib/utils";

const STEP_ICONS = [Sparkles, Users, Check] as const;

export function PublishDialog({
  open,
  onOpenChange,
  onConfirm,
  busy,
  isPrivate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
  /** Drives the closing line only — sharing itself is set elsewhere. */
  isPrivate: boolean;
}) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const [revealed, setRevealed] = React.useState(0);

  // Reveal one step at a time while the dialog is open; reset on close so a
  // second visit animates again rather than snapping to the finished state.
  React.useEffect(() => {
    if (!open) {
      setRevealed(0);
      return;
    }
    const timers = [0, 1, 2].map((index) =>
      setTimeout(() => setRevealed((prev) => Math.max(prev, index + 1)), 120 + index * 160),
    );
    return () => timers.forEach(clearTimeout);
  }, [open]);

  const steps = [
    t("review.publishStep1"),
    t("review.publishStep2"),
    t("review.publishStep3"),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{t("review.publishTitle")}</DialogTitle>
          <DialogDescription>{t("review.publishLead")}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index];
            return (
              <li
                key={step}
                className={cn(
                  "flex items-start gap-3 transition-all duration-300 motion-reduce:transition-none",
                  index < revealed
                    ? "translate-y-0 opacity-100"
                    : "translate-y-1 opacity-0",
                )}
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <span className="text-sm leading-relaxed">{step}</span>
              </li>
            );
          })}
        </ol>

        <p className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          <Share2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {isPrivate
            ? t("review.publishSharingPrivate")
            : t("review.publishSharingShared")}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="max-md:h-11"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="max-md:h-11"
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
            ) : null}
            {busy ? t("review.publishRunning") : t("review.publishConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
