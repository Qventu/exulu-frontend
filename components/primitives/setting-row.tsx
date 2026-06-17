"use client";

/**
 * SettingRow — the ONE label + description + control row.
 *
 * Spec: design/codebase-structure.md §2.3 (SettingRow) —
 * `{ label, description?, children /* the control *\/ }`. Replaces the three
 * competing switch-row styles called out in agents.md review #10. Used by
 * agents sections, /settings, models form, budgets policy.
 *
 * Layout: `flex items-start justify-between gap-4 rounded-lg border p-4`
 * (control right-aligned); stacks below `sm` so dense controls don't crush
 * the label (responsive.md T4).
 *
 * Accessibility: optional `htmlFor` associates the label with the control.
 * Consumers that pass a Switch/Input pass its `id` here and on the control.
 *
 * i18n: no built-in strings — `label` and `description` are translated by the
 * consumer (primitives contract, codebase-structure §3.5).
 */

import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SettingRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  description?: string;
  /** id of the control for <label htmlFor> association. */
  htmlFor?: string;
  /** The control, right-aligned. */
  children: React.ReactNode;
}

const SettingRow = React.forwardRef<HTMLDivElement, SettingRowProps>(
  ({ label, description, htmlFor, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
          className,
        )}
        {...props}
      >
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor={htmlFor}
            className="text-sm font-medium leading-tight"
          >
            {label}
          </Label>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="shrink-0 sm:pt-0.5">{children}</div>
      </div>
    );
  },
);
SettingRow.displayName = "SettingRow";

export { SettingRow };
