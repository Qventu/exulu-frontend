"use client";

/**
 * AttentionList — presentational cross-domain "needs attention" feed.
 *
 * Spec: design/codebase-structure.md §2.3 (AttentionList) —
 * `{ items: {id, severity:"error"|"warn", title, meta?, href}[]; loading?;
 * allClearLabel }`. Sources are composed per page (Home; later /budgets'
 * over/at-risk strip and /evals' failing strip).
 *
 * Design (dashboard.md §3 Region C): a single bordered `divide-y` list — not
 * nested cards (philosophy anti-pattern #6). Each row is a full-surface link
 * with a visible chevron affordance (responsive.md T7: never hover-only),
 * ≥44px tall (touch targets). Healthy state collapses to one muted all-clear
 * row with a success check — "status is quiet until it isn't" (philosophy §4).
 */

import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { StatusDot } from "@/components/primitives/status-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AttentionSeverity = "error" | "warn";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  /** Already-translated one-line description. */
  title: string;
  /** Quiet trailing metadata (e.g. a RelativeTime). */
  meta?: React.ReactNode;
  /** Deep link to the owning object. */
  href: string;
}

export interface AttentionListProps
  extends Omit<React.HTMLAttributes<HTMLUListElement>, "children"> {
  items: AttentionItem[];
  loading?: boolean;
  /** Already-translated healthy-state line. */
  allClearLabel: string;
}

const AttentionList = React.forwardRef<HTMLUListElement, AttentionListProps>(
  ({ items, loading = false, allClearLabel, className, ...props }, ref) => {
    if (loading) {
      return (
        <div
          role="status"
          className={cn("divide-y rounded-lg border", className)}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex min-h-11 items-center gap-3 px-3 py-2.5">
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-full max-w-sm" />
              <Skeleton className="ml-auto h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <p
          role="status"
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
            className,
          )}
        >
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
          {allClearLabel}
        </p>
      );
    }

    return (
      <ul
        ref={ref}
        className={cn(
          "divide-y rounded-lg border motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
          className,
        )}
        {...props}
      >
        {items.map((item) => (
          <li key={item.id} className="first:[&>a]:rounded-t-lg last:[&>a]:rounded-b-lg">
            <Link
              href={item.href}
              className="flex min-h-11 items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <StatusDot
                status={item.severity === "error" ? "error" : "warning"}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {item.title}
              </span>
              {item.meta && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.meta}
                </span>
              )}
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    );
  },
);
AttentionList.displayName = "AttentionList";

export { AttentionList };
