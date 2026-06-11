"use client";

/**
 * SecretField — the canonical secret display pattern.
 *
 * Spec: design/codebase-structure.md §2.3 (SecretField) —
 * `{ getValue: () => Promise<string>; masked?: string; remaskAfterMs?: number;
 *   canCopyWithoutReveal?: boolean; onReveal? }` — masked mono value + deliberate
 * reveal toggle + copy affordance. First consumer: keys-token (work item 2.2);
 * next: /variables secrets, model credentials, users' token field.
 *
 * Philosophy §9 ("handle sensitive material with visible care"): masked by
 * default; reveal is an explicit user action; copying works without revealing
 * (configurable); the component never holds the value before reveal — it is
 * fetched through `getValue` on demand and dropped again on hide/remask.
 *
 * Responsive: the value truncates rather than stretching the row
 * (responsive.md S5); the copy affordance is always visible, never
 * hover-revealed (T7). Reveal swaps content instantly — secrets don't animate
 * into view (keys-token.md §3 motion).
 */

import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SecretFieldProps {
  /** Resolves the secret on demand (reveal / copy). Never pre-resolved here. */
  getValue: () => Promise<string>;
  /** The mask string shown while hidden; fixed-length so nothing leaks. */
  masked?: string;
  /** Auto re-mask (and drop the held value) this many ms after reveal. */
  remaskAfterMs?: number;
  /** Allow copying while still masked (default true). */
  canCopyWithoutReveal?: boolean;
  /** Audit hook — called whenever the value is revealed. */
  onReveal?: () => void;
  /** Optional caption above the field. */
  label?: string;
  /** Accessible name for the copy action, e.g. "Copy token". */
  copyLabel?: string;
  /** Render the value in the mono stack (default true). */
  mono?: boolean;
  className?: string;
}

const DEFAULT_MASK = "••••••••••••••••";
const COPIED_RESET_MS = 2000;

const SecretField = React.forwardRef<HTMLDivElement, SecretFieldProps>(
  (
    {
      getValue,
      masked = DEFAULT_MASK,
      remaskAfterMs,
      canCopyWithoutReveal = true,
      onReveal,
      label,
      copyLabel,
      mono = true,
      className,
    },
    ref,
  ) => {
    const t = useTranslations("common");
    const [value, setValue] = React.useState<string | null>(null);
    const [revealing, setRevealing] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const remaskTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    React.useEffect(() => {
      return () => {
        if (remaskTimer.current) clearTimeout(remaskTimer.current);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
      };
    }, []);

    const hide = React.useCallback(() => {
      // Drop the held value on hide — the field never retains the secret.
      setValue(null);
      if (remaskTimer.current) clearTimeout(remaskTimer.current);
    }, []);

    const reveal = async () => {
      if (revealing) return;
      setRevealing(true);
      try {
        const next = await getValue();
        setValue(next);
        onReveal?.();
        if (remaskAfterMs) {
          if (remaskTimer.current) clearTimeout(remaskTimer.current);
          remaskTimer.current = setTimeout(hide, remaskAfterMs);
        }
      } catch {
        toast.error(t("somethingWentWrong"));
      } finally {
        setRevealing(false);
      }
    };

    const revealed = value !== null;

    const handleCopy = async () => {
      try {
        const secret = value ?? (await getValue());
        await navigator.clipboard.writeText(secret);
        setCopied(true);
        toast.success(t("copied"));
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(
          () => setCopied(false),
          COPIED_RESET_MS,
        );
      } catch {
        toast.error(t("copyFailed"));
      }
    };

    return (
      <div
        ref={ref}
        className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      >
        {label ? (
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        ) : null}
        <div className="flex w-full min-w-0 items-center gap-1 rounded-md border border-input bg-muted/50 py-1 pl-3 pr-1">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              mono && "font-mono",
              revealed ? "select-all" : "select-none text-muted-foreground",
            )}
          >
            {revealed ? value : masked}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={revealed ? t("hide") : t("reveal")}
            aria-pressed={revealed}
            disabled={revealing}
            onClick={revealed ? hide : reveal}
            className="shrink-0"
          >
            {revealing ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : revealed ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={copyLabel ?? t("copy")}
            disabled={!revealed && !canCopyWithoutReveal}
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4 text-success" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
          </Button>
        </div>
      </div>
    );
  },
);
SecretField.displayName = "SecretField";

export { SecretField };
