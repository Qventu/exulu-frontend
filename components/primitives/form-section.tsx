"use client";

/**
 * FormSection — titled, described form section with divider rhythm.
 *
 * Spec: design/codebase-structure.md §2.3 (registry prop sketch:
 * `{ title, description?, collapsible?: boolean; summary?: string; children }`,
 * where `summary` is the collapsed-header value) and §2.1 D9: FormSection ⊇
 * SettingsSection —
 * `collapsible` defaults to false, which IS the SettingsSection shape proposed
 * by design/pages/settings-config.md §3 (`h2 text-lg font-medium` + muted
 * description + content slot; sections separated by whitespace/Separator,
 * never nested Cards — philosophy §4: dividers over boxes).
 *
 * `collapsible: true` is the L3 "Advanced" pattern (models/variables forms,
 * agents sections): the header becomes a real <button> trigger — keyboard
 * focusable by construction (the settings-config doc's U10 class of bugs:
 * clickable-div headers) — with an optional `summary` value shown while
 * collapsed and a chevron that rotates 200 ms (motion budget; the global
 * reduced-motion kill switch in globals.css applies).
 *
 * i18n: no built-in strings — all copy arrives via props (primitives
 * contract, components/primitives/README.md §3).
 */

import { ChevronDown } from "lucide-react";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface FormSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: string;
  /** One-line purpose, `text-sm text-muted-foreground`. */
  description?: string;
  /** L3 "Advanced" pattern — header becomes a focusable toggle. */
  collapsible?: boolean;
  /** Quiet current-value summary shown in the header while collapsed. */
  summary?: string;
  /** Initial open state when `collapsible` (default false = collapsed). */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const FormSection = React.forwardRef<HTMLElement, FormSectionProps>(
  (
    {
      title,
      description,
      collapsible = false,
      summary,
      defaultOpen = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(defaultOpen);
    const contentId = React.useId();

    if (!collapsible) {
      return (
        <section
          ref={ref}
          className={cn("flex flex-col gap-4", className)}
          {...props}
        >
          <div className="space-y-1">
            <h2 className="text-lg font-medium">{title}</h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {children}
        </section>
      );
    }

    return (
      <Collapsible open={open} onOpenChange={setOpen} asChild>
        <section
          ref={ref}
          className={cn("flex flex-col gap-4", className)}
          {...props}
        >
          <div className="space-y-1">
            <h2 className="text-lg font-medium">
              <CollapsibleTrigger asChild>
                {/* A real button: keyboard-focusable header (never a clickable
                    div), ≥44px touch target below md. */}
                <button
                  type="button"
                  aria-controls={contentId}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left md:min-h-0",
                    "transition-colors duration-150 ease-in-out hover:text-foreground motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  <span className="min-w-0 truncate">{title}</span>
                  <span className="flex min-w-0 shrink-0 items-center gap-2">
                    {!open && summary ? (
                      <span className="max-w-40 truncate text-sm font-normal text-muted-foreground">
                        {summary}
                      </span>
                    ) : null}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none",
                        open && "rotate-180",
                      )}
                    />
                  </span>
                </button>
              </CollapsibleTrigger>
            </h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <CollapsibleContent id={contentId} className="flex flex-col gap-4">
            {children}
          </CollapsibleContent>
        </section>
      </Collapsible>
    );
  },
);
FormSection.displayName = "FormSection";

export { FormSection };
