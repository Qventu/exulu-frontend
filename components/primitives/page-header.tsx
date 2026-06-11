import Link from "next/link";
import * as React from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/**
 * PageHeader — `h1 text-2xl font-semibold tracking-tight`, ONE per page
 * (design/codebase-structure.md §2.2; philosophy.md §5; design-system audit R2).
 *
 * - `description`: one-line purpose, `text-sm text-muted-foreground`.
 * - `action`: THE primary action slot (the purple budget lives here).
 * - `breadcrumb`: single parent crumb; current page = `title`.
 * - `density="compact"`: for full-bleed work surfaces (explorer, skills editor,
 *   n8n, chat) — smaller title, tighter rhythm.
 * - `meta`: quiet inline summary (e.g. budgets default-policy line).
 * - `leading`: generic visual slot rendered before the title block (entity
 *   avatar / initial on detail pages — projects, agents). Additive, generic
 *   prop per the primitives contract (components/primitives/README.md §5);
 *   purely decorative content — pass `aria-hidden` nodes.
 *
 * Responsive (responsive.md T3, header rule): rows stack on phones — title row
 * first, primary action full-width beneath; never a non-wrapping
 * `justify-between` title-vs-actions row.
 */
export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: string;
  /** One-line purpose, rendered `text-sm text-muted-foreground`. */
  description?: string;
  /** THE primary action for the page. */
  action?: React.ReactNode;
  /** Single parent crumb; the current page (`title`) is appended automatically. */
  breadcrumb?: { label: string; href: string };
  density?: "default" | "compact";
  /** Quiet inline summary line under the description. */
  meta?: React.ReactNode;
  /** Decorative slot before the title block (entity avatar / initial). */
  leading?: React.ReactNode;
  /**
   * Clamp the description to one line (always true for `compact`). For
   * detail headers whose page doc specifies a one-line purpose with the full
   * text available deeper (e.g. projects detail → Settings tab).
   */
  truncateDescription?: boolean;
}

const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    {
      title,
      description,
      action,
      breadcrumb,
      density = "default",
      meta,
      leading,
      truncateDescription = false,
      className,
      ...props
    },
    ref,
  ) => {
    const compact = density === "compact";

    return (
      <header
        ref={ref}
        className={cn("flex flex-col", compact ? "gap-2" : "gap-3", className)}
        {...props}
      >
        {breadcrumb && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className={cn("flex min-w-0 items-start", compact ? "gap-2" : "gap-3")}>
            {leading && <div className="shrink-0 pt-0.5">{leading}</div>}
            <div className={cn("min-w-0", compact ? "space-y-0.5" : "space-y-1")}>
              <h1
                className={cn(
                  "font-semibold tracking-tight",
                  compact ? "text-lg" : "text-2xl",
                )}
              >
                {title}
              </h1>
              {description && (
                <p
                  className={cn(
                    "text-sm text-muted-foreground",
                    (compact || truncateDescription) && "truncate",
                  )}
                >
                  {description}
                </p>
              )}
              {meta && (
                <div className="text-sm text-muted-foreground">{meta}</div>
              )}
            </div>
          </div>
          {action && (
            <div className="flex w-full shrink-0 flex-col gap-2 [&>*]:w-full sm:w-auto sm:flex-row sm:items-center sm:[&>*]:w-auto">
              {action}
            </div>
          )}
        </div>
      </header>
    );
  },
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
