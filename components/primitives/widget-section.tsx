"use client";

/**
 * WidgetSection — RBAC-gated, error-isolated dashboard region wrapper.
 *
 * Spec: design/codebase-structure.md §2.3 (WidgetSection) —
 * `{ title, allowed: boolean; href?; children }`. Consumers: Home regions,
 * knowledge usage panel.
 *
 * - RBAC: the predicate is evaluated by the consumer (via lib/rights.ts
 *   `can()`, same predicates as nav-config) and its RESULT is passed in as
 *   `allowed` — when false the section renders nothing at all (RBAC trims,
 *   never greys out; navigation.md §1.1).
 * - Error isolation: an ErrorBoundary inside the section means one failing
 *   region never blanks the page (dashboard.md §3) — the region fails alone
 *   with a quiet inline error + Retry (re-mounts its children).
 *
 * Generic additions on the spec'd sketch (primitives contract, README §5):
 * `href` carries a label (a bare string can't render an accessible link);
 * `meta` is an inline heading slot (e.g. a count badge).
 */

import { ArrowRight, CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WidgetSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Already-translated group label (h2, text-lg). */
  title: string;
  /** Result of the consumer's RBAC predicate; false renders nothing. */
  allowed: boolean;
  /** Optional quiet deep link at the heading's right edge ("Open analytics"). */
  href?: { label: string; href: string };
  /** Optional inline heading slot (count badge etc.). */
  meta?: React.ReactNode;
  children: React.ReactNode;
}

interface BoundaryProps {
  fallback: (reset: () => void) => React.ReactNode;
  children: React.ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

/** Minimal error boundary — quiet regional failure, never the whole page. */
class WidgetErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Surface for debugging without crashing the page (philosophy §8).
    console.error("[WidgetSection] region failed:", error);
  }

  reset = () => this.setState({ failed: false });

  render() {
    if (this.state.failed) return this.props.fallback(this.reset);
    return this.props.children;
  }
}

const WidgetSection = React.forwardRef<HTMLElement, WidgetSectionProps>(
  ({ title, allowed, href, meta, children, className, ...props }, ref) => {
    const t = useTranslations("common");
    const headingId = React.useId();

    if (!allowed) return null;

    return (
      <section
        ref={ref}
        aria-labelledby={headingId}
        className={cn("space-y-4", className)}
        {...props}
      >
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={headingId} className="text-lg font-medium tracking-tight">
            {title}
          </h2>
          {meta}
          {href && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="ml-auto text-xs text-muted-foreground max-md:h-11"
            >
              <Link href={href.href}>
                {href.label}
                <ArrowRight aria-hidden="true" className="ml-1 size-3" />
              </Link>
            </Button>
          )}
        </div>
        <WidgetErrorBoundary
          fallback={(reset) => (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center"
            >
              <CircleAlert aria-hidden="true" className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("somethingWentWrong")}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                {t("retry")}
              </Button>
            </div>
          )}
        >
          {children}
        </WidgetErrorBoundary>
      </section>
    );
  },
);
WidgetSection.displayName = "WidgetSection";

export { WidgetSection };
