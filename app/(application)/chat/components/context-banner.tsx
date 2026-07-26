"use client";

/**
 * ContextBanner — the 80%-warn / 95%-block surface for context-window
 * management (spec 2026-07-07 §5b). Lives in the composer banner stack.
 * Warn: dismissible, reappears after a further 5-point climb. Blocked:
 * non-dismissible; the composer disables itself alongside.
 * Warning/amber tones only (no violet — design rule).
 */

import { Archive, Loader2, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ChatSessionController } from "../hooks";
import { deriveContextBudget } from "../lib/context-budget";

export function ContextBanner({
  controller,
  manualOpen = false,
  onCloseManual,
}: {
  controller: ChatSessionController;
  manualOpen?: boolean;
  onCloseManual?: () => void;
}) {
  const t = useTranslations("chat");
  const { contextState, contextWindow, contextOccupancy, compacting, session, status } = controller;

  const [steerOpen, setSteerOpen] = React.useState(false);
  const [steer, setSteer] = React.useState("");
  // Warn-dismissal: remember the percent at dismissal; reappear at +5 points.
  const [dismissedAtPct, setDismissedAtPct] = React.useState<number | null>(null);

  const budget = contextWindow ? deriveContextBudget(contextWindow) : null;
  const percent = budget ? Math.min(999, Math.round((contextOccupancy / budget.usableWindow) * 100)) : 0;

  // Manual mode wins only when there is no warn/blocked state to show — a
  // real context alert takes visual priority and its own copy stays. The X
  // still clears manualOpen (the close handler runs regardless of copy).
  const manualMode = manualOpen && contextState === "ok";

  // Manual mode is entered by the AttachMenu '+' entry — the steer input
  // IS the reason the user opened it, so pre-open it as soon as manualMode
  // flips true. Runs once per open-transition; if the user closes the
  // steer input manually while manualMode is still true, we don't reopen.
  React.useEffect(() => {
    if (manualMode) setSteerOpen(true);
  }, [manualMode]);

  if (!session || session.id === "new") return null;
  if (contextState === "ok" && !manualOpen) return null;
  const blocked = contextState === "blocked";
  if (!blocked && dismissedAtPct !== null && percent < dismissedAtPct + 5) return null;

  const streaming = status === "streaming" || status === "submitted";

  const onCompact = async () => {
    const ok = await controller.compactConversation(steer);
    if (ok) {
      setSteer("");
      setSteerOpen(false);
      setDismissedAtPct(null);
      onCloseManual?.();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mb-2 rounded-md border px-3 py-2 text-xs",
        manualMode
          ? "border-border bg-muted/30 text-foreground"
          : "border-warning/50 bg-warning/10",
        !manualMode && (blocked ? "text-foreground" : "text-muted-foreground"),
      )}
    >
      <div className="flex items-start gap-2">
        {manualMode ? (
          <Archive className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <span className="font-medium text-foreground">
            {manualMode
              ? t("context.manualTitle")
              : blocked
                ? t("context.blockedTitle")
                : t("context.warnTitle")}
          </span>{" "}
          — {manualMode
            ? t("context.manualBody")
            : blocked
              ? t("context.blockedBody")
              : t("context.warnBody", { percent })}
          {steerOpen && (
            <input
              type="text"
              value={steer}
              onChange={(e) => setSteer(e.target.value)}
              placeholder={t("context.steerPlaceholder")}
              aria-label={t("context.steerToggle")}
              className="mt-2 w-full rounded-md border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-warning/50 text-xs"
              disabled={compacting || streaming}
              onClick={() => void onCompact()}
            >
              {compacting ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" aria-hidden="true" />
                  {t("context.compacting")}
                </>
              ) : (
                <>
                  <Archive className="mr-1 size-3" aria-hidden="true" />
                  {t("context.compact")}
                </>
              )}
            </Button>
            {!steerOpen && !compacting && (
              <button
                type="button"
                onClick={() => setSteerOpen(true)}
                className="text-xs underline underline-offset-2 hover:text-foreground"
              >
                {t("context.steerToggle")}
              </button>
            )}
          </div>
        </div>
        {manualMode ? (
          <button
            type="button"
            onClick={() => {
              setSteerOpen(false);
              setSteer("");
              onCloseManual?.();
            }}
            aria-label={t("context.manualClose")}
            className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : !blocked ? (
          <button
            type="button"
            onClick={() => {
              setDismissedAtPct(percent);
              onCloseManual?.();
            }}
            aria-label={t("context.dismiss")}
            className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
