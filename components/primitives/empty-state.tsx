"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * EmptyState — icon, one sentence of value, one primary action
 * (design/codebase-structure.md §2.2; philosophy.md §5).
 *
 * Variants:
 * - `default`: list/page empty state with a primary action.
 * - `quiet`: detail-pane placeholder (smaller, more muted).
 * - `error`: failure state with Retry styling (destructive icon, outline
 *   action); announced as an alert.
 *
 * All copy arrives via props (codebase-structure §3.5 — primitives only use
 * `common.*` for built-ins; EmptyState has none). Token-only colors
 * (design-system R1/R6); icon sizes per R7 (`size-10`+ lives here).
 */
const emptyStateVariants = cva(
  "flex w-full flex-col items-center justify-center text-center",
  {
    variants: {
      variant: {
        default: "gap-4 px-6 py-12",
        quiet: "gap-2 px-6 py-8",
        error: "gap-4 px-6 py-12",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type EmptyStateAction =
  | { label: string; onClick: () => void }
  | {
      label: string;
      href: string;
      /** Optional side effect on top of the navigation (the Link still owns
       *  it — modified clicks keep their open-in-new-tab semantics). */
      onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    };

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof emptyStateVariants> {
  icon?: LucideIcon;
  title: string;
  /** One sentence of value, `text-sm text-muted-foreground`. */
  description?: string;
  /** The ONE primary action. */
  action?: EmptyStateAction;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, variant, className, ...props }, ref) => {
    const resolvedVariant = variant ?? "default";
    const Icon = icon ?? (resolvedVariant === "error" ? CircleAlert : undefined);

    const actionButton = action ? (
      "href" in action ? (
        <Button
          asChild
          variant={resolvedVariant === "default" ? "default" : "outline"}
          size={resolvedVariant === "quiet" ? "sm" : "default"}
        >
          <Link href={action.href} onClick={action.onClick}>
            {action.label}
          </Link>
        </Button>
      ) : (
        <Button
          variant={resolvedVariant === "default" ? "default" : "outline"}
          size={resolvedVariant === "quiet" ? "sm" : "default"}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )
    ) : null;

    return (
      <div
        ref={ref}
        role={resolvedVariant === "error" ? "alert" : "status"}
        className={cn(emptyStateVariants({ variant }), className)}
        {...props}
      >
        {Icon && (
          <Icon
            aria-hidden="true"
            className={cn(
              resolvedVariant === "quiet" ? "size-8" : "size-10",
              resolvedVariant === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          />
        )}
        <div className={cn(resolvedVariant === "quiet" ? "space-y-1" : "space-y-1.5")}>
          <p
            className={cn(
              resolvedVariant === "quiet"
                ? "text-sm font-medium text-muted-foreground"
                : "text-base font-semibold text-foreground",
            )}
          >
            {title}
          </p>
          {description && (
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actionButton}
      </div>
    );
  },
);
EmptyState.displayName = "EmptyState";

export { EmptyState, emptyStateVariants };
