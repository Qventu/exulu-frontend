"use client";

/**
 * SaveBar — sticky dirty-state Save/Discard bar with companion unsaved-changes
 * guard hook.
 *
 * Spec: design/codebase-structure.md §2.1 (SaveBar = UnsavedChangesBar) and
 * §2.3 — `{ dirty, saving?, mode?, onSave, onDiscard, summary? }`; owns the
 * navigation guard. App Router has no route-change events, so the guard is a
 * companion hook (`useUnsavedChangesGuard`) exported from the same file —
 * spec-gap resolution, not a behavior cut.
 *
 * Behavior:
 * - Renders null when `!dirty && !saving` (no chrome when there's nothing to
 *   save).
 * - Sticky bottom INSIDE the page scroll container (responsive.md V5);
 *   `border-t bg-background/95 backdrop-blur`, `pb-[env(safe-area-inset-bottom)]`
 *   (V3 mobile safe-area).
 * - Slide-up + fade 200 ms ease-in-out; respects `prefers-reduced-motion`.
 * - Save = primary (purple); Discard = outline.
 * - Never hides Save off-screen on mobile (agents.md fixes #4).
 *
 * Guard hook:
 * - `beforeunload` while dirty (hard navigations / tab close).
 * - Capture-phase click interception of same-origin `<a>` while dirty → opens
 *   the shared ConfirmDialog (`common.unsavedChangesTitle` /
 *   `common.leaveWithoutSaving` / `common.stay`), proceeds on confirm.
 * - `confirmIfDirty(proceed)` for programmatic navigation (router.push).
 * - Returns `guardDialog` the consumer must render once.
 *
 * i18n: `common.save`, `common.publish`, `common.discard`,
 * `common.unsavedChangesTitle`, `common.leaveWithoutSaving`, `common.stay`
 * — primitive-only keys.
 */

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SaveBarProps {
  dirty: boolean;
  saving?: boolean;
  mode?: "save" | "publish";
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  /** Already-translated summary, e.g. agents.editor.unsavedChanges. */
  summary?: string;
  className?: string;
}

export function SaveBar({
  dirty,
  saving = false,
  mode = "save",
  onSave,
  onDiscard,
  summary,
  className,
}: SaveBarProps) {
  const t = useTranslations("common");

  if (!dirty && !saving) return null;

  const saveLabel = mode === "publish" ? t("publish") : t("save");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-in-out",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-8">
        <p className="min-w-0 text-sm text-muted-foreground">
          {summary ?? t("unsavedChanges")}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
            className="flex-1 sm:flex-initial"
          >
            {t("discard")}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => void onSave()}
            disabled={saving || !dirty}
            aria-busy={saving}
            className="flex-1 gap-2 sm:flex-initial"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Companion navigation guard. Returns `confirmIfDirty(proceed)` for
 * programmatic navigation and a `guardDialog` node the consumer must render
 * once at the page root.
 */
export function useUnsavedChangesGuard(dirty: boolean): {
  confirmIfDirty: (proceed: () => void) => void;
  guardDialog: React.ReactNode;
} {
  const t = useTranslations("common");
  const dirtyRef = React.useRef(dirty);
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const [pendingProceed, setPendingProceed] =
    React.useState<(() => void) | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // beforeunload: hard navigations + tab close.
  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Capture-phase click on same-origin <a>: intercept while dirty.
  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      // In-page anchors don't navigate — let them through.
      if (href.startsWith("#")) return;
      // External target → let the browser/beforeunload handle it.
      if (anchor.target && anchor.target !== "_self") return;
      // Different origin → let through (beforeunload still fires).
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Same URL (no real navigation) → let through.
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash !== ""
        )
          return;
      } catch {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const targetHref = anchor.getAttribute("href")!;
      setPendingProceed(() => () => {
        window.location.assign(targetHref);
      });
      setDialogOpen(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  const confirmIfDirty = React.useCallback(
    (proceed: () => void) => {
      if (!dirtyRef.current) {
        proceed();
        return;
      }
      setPendingProceed(() => proceed);
      setDialogOpen(true);
    },
    [],
  );

  const guardDialog = (
    <ConfirmDialog
      open={dialogOpen}
      onOpenChange={(next) => {
        if (!next) setPendingProceed(null);
        setDialogOpen(next);
      }}
      title={t("unsavedChangesTitle")}
      description={t("leaveWithoutSavingDescription")}
      variant="default"
      confirmLabel={t("leaveWithoutSaving")}
      onConfirm={async () => {
        const proceed = pendingProceed;
        setPendingProceed(null);
        if (proceed) proceed();
      }}
    />
  );

  return { confirmIfDirty, guardDialog };
}
