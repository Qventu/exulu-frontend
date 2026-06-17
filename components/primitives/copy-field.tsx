"use client";

/**
 * CopyField — read-only value display with a built-in CopyButton.
 *
 * Spec: design/codebase-structure.md §2.3 (CopyField) —
 * `{ value: string; label?: string; mono?: boolean }` — mono value + CopyButton.
 * Extended per the Phase 0 primitives mandate with an optional mask toggle
 * (`masked`) for secrets-safe display (philosophy §9 "handle sensitive material
 * with visible care": masked by default, deliberate reveal, copy without reveal).
 * Values that must be fetched on reveal belong to SecretField (§2.3), not here.
 *
 * Responsive: long values truncate, never stretch the row (responsive.md S5);
 * the copy affordance is always visible — never hover-revealed (T7).
 */

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/primitives/copy-button";
import { cn } from "@/lib/utils";

export interface CopyFieldProps {
  /** The real value — shown (or masked) and copied. */
  value: string;
  /** Optional caption above the field; also names the copy action for AT. */
  label?: string;
  /** Render the value in the mono stack (default true — keys, IDs, tokens). */
  mono?: boolean;
  /**
   * Mask the value behind fixed-length bullets with an explicit reveal toggle.
   * Copying always copies the real value, without requiring reveal.
   */
  masked?: boolean;
  className?: string;
}

/** Fixed-length mask so the rendered string never leaks the value's length. */
const MASK = "••••••••••••";

const CopyField = React.forwardRef<HTMLDivElement, CopyFieldProps>(
  ({ value, label, mono = true, masked = false, className }, ref) => {
    const t = useTranslations("common");
    const [revealed, setRevealed] = React.useState(false);

    const hidden = masked && !revealed;
    const copyLabel = label ? `${t("copy")}: ${label}` : t("copy");

    return (
      <div ref={ref} className={cn("flex w-full min-w-0 flex-col gap-1", className)}>
        {label ? (
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        ) : null}
        <div className="flex w-full min-w-0 items-center gap-1 rounded-md border border-input bg-muted/50 py-1 pl-3 pr-1">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              mono && "font-mono",
              hidden ? "select-none text-muted-foreground" : "select-all",
            )}
          >
            {hidden ? MASK : value}
          </span>
          {masked ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={revealed ? t("hide") : t("reveal")}
              aria-pressed={revealed}
              onClick={() => setRevealed((r) => !r)}
              className="shrink-0"
            >
              {revealed ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </Button>
          ) : null}
          <CopyButton value={value} label={copyLabel} />
        </div>
      </div>
    );
  },
);
CopyField.displayName = "CopyField";

export { CopyField };
