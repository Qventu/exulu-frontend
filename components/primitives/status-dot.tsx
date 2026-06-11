"use client";

/**
 * StatusDot — semantic status indicator.
 *
 * Spec: design/codebase-structure.md §2.3 (StatusDot) —
 * `{ status: "success"|"warning"|"error"|"info"|"muted"; label?: string; pulse?: boolean }`,
 * semantic tokens only (design-system R1).
 *
 * Philosophy §4 "status is quiet until it isn't": healthy/neutral states stay muted;
 * warning/error labels earn color and weight. Color is never the only carrier of
 * meaning — when no visible label is given, a translated sr-only status name is
 * rendered for screen readers (WCAG 1.4.1).
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const statusDotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    status: {
      success: "bg-success",
      warning: "bg-warning",
      error: "bg-destructive",
      info: "bg-info",
      muted: "bg-muted-foreground/40",
    },
    pulse: {
      true: "motion-safe:animate-pulse",
      false: "",
    },
  },
  defaultVariants: {
    status: "muted",
    pulse: false,
  },
});

const statusLabelVariants = cva("truncate text-sm", {
  variants: {
    status: {
      // Quiet states recede; problems earn color and weight (philosophy §4).
      success: "text-muted-foreground",
      warning: "font-medium text-warning",
      error: "font-medium text-destructive",
      info: "text-muted-foreground",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    status: "muted",
  },
});

export type StatusDotStatus = NonNullable<
  VariantProps<typeof statusDotVariants>["status"]
>;

export interface StatusDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: StatusDotStatus;
  /** Visible label next to the dot; consumers pass already-translated copy. */
  label?: string;
  /** Gentle pulse for live/in-progress states. Honors prefers-reduced-motion. */
  pulse?: boolean;
}

const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ status, label, pulse = false, className, ...props }, ref) => {
    const t = useTranslations("common");

    return (
      <span
        ref={ref}
        className={cn("inline-flex min-w-0 items-center gap-2", className)}
        {...props}
      >
        <span aria-hidden="true" className={statusDotVariants({ status, pulse })} />
        {label ? (
          <span className={statusLabelVariants({ status })}>{label}</span>
        ) : (
          <span className="sr-only">{t(`status.${status}`)}</span>
        )}
      </span>
    );
  },
);
StatusDot.displayName = "StatusDot";

export { StatusDot, statusDotVariants };
