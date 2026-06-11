"use client";

/**
 * BulkActionBar — the selection bar shown while table/card-list rows are
 * selected: "n selected" + Clear on the left, bulk actions on the right.
 *
 * Spec: design/codebase-structure.md §2.3 (registry prop sketch:
 * `{ count, onClear, actions: {label, onClick, destructive?}[] }`,
 * "sticky-bottom <md"; merges budgets/models/users BulkActionBar with
 * feedback's SelectionBar — §2.1); design/pages/budgets.md polish spec
 * (`rounded-md border bg-muted/40 px-4 py-2`, 200 ms enter motion);
 * design/responsive.md T1 (bulk bar becomes a sticky bottom bar above the
 * safe area below `md`) and V3 (`pb-[env(safe-area-inset-bottom)]`) /
 * V5 (sticky, not fixed).
 *
 * Renders nothing while `count` is 0 — consumers (DataTable selection) keep
 * it mounted and drive `count`. Destructive actions must be gated behind the
 * shared ConfirmDialog by the consumer's `onClick`.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkActionBarAction {
  /** Visible button label (already translated by the consumer). */
  label: string;
  /** Destructive actions: open the shared ConfirmDialog from here. */
  onClick: () => void;
  /** Renders as a destructive Button instead of the primary variant. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  /** Number of selected rows; the bar is hidden while 0. */
  count: number;
  /** Clears the selection (the bar disappears via `count` returning to 0). */
  onClear: () => void;
  actions: BulkActionBarAction[];
  className?: string;
}

const BulkActionBar = React.forwardRef<HTMLDivElement, BulkActionBarProps>(
  ({ count, onClear, actions, className }, ref) => {
    const t = useTranslations();

    if (count <= 0) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-4 py-2",
          // budgets.md motion #3: 200 ms slide/fade on first selection.
          "animate-in fade-in slide-in-from-bottom-2 duration-200 ease-in-out motion-reduce:animate-none",
          // T1/V3/V5: sticky bottom bar above the safe area below `md`,
          // opaque enough to cover the content scrolling beneath it.
          "max-md:sticky max-md:bottom-0 max-md:z-20",
          "max-md:bg-background/95 max-md:backdrop-blur max-md:supports-[backdrop-filter]:bg-background/80",
          "max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
          className,
        )}
      >
        <p aria-atomic="true" aria-live="polite" className="text-sm">
          {t("common.selectedCount", { count })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label={t("common.clearSelection")}
          className="max-md:h-11"
        >
          {t("common.clear")}
        </Button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {actions.map((action, index) => (
            <Button
              key={`${index}-${action.label}`}
              type="button"
              size="sm"
              variant={action.destructive ? "destructive" : "default"}
              disabled={action.disabled}
              onClick={action.onClick}
              className="max-md:h-11"
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    );
  },
);
BulkActionBar.displayName = "BulkActionBar";

export { BulkActionBar };
