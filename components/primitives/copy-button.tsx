"use client";

/**
 * CopyButton — icon button that copies a value to the clipboard.
 *
 * Spec: design/codebase-structure.md §2.3 (CopyButton) —
 * `{ value: string; label: string }` (label = aria name) — icon button + clipboard +
 * check feedback + toast (sonner, the single toast stack per design-system R11).
 *
 * a11y: icon-only, so `label` (aria-label) is required (CLAUDE.md accessibility).
 * Touch: default size renders the 40px icon button (responsive.md "Touch targets").
 */

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CopyButtonProps
  extends Omit<ButtonProps, "children" | "onClick" | "aria-label" | "asChild"> {
  /** The text written to the clipboard. */
  value: string;
  /** Accessible name for the icon-only button, e.g. "Copy API key". */
  label: string;
}

const COPIED_RESET_MS = 2000;

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, label, className, variant = "ghost", size = "icon", ...props }, ref) => {
    const t = useTranslations("common");
    const [copied, setCopied] = React.useState(false);
    const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
      return () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
      };
    }, []);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(t("copied"));
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      } catch {
        toast.error(t("copyFailed"));
      }
    };

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        aria-label={label}
        onClick={handleCopy}
        className={cn("shrink-0", className)}
        {...props}
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4 text-success" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
      </Button>
    );
  },
);
CopyButton.displayName = "CopyButton";

export { CopyButton };
