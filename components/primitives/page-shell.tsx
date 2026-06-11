import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * PageShell — the page-level layout wrapper with exactly three named widths
 * (design/codebase-structure.md §2.2; design-system audit R2/R3).
 *
 * - `content` (default): centered work area, `max-w-7xl p-4 md:p-8 space-y-8`.
 * - `narrow`: settings-like pages, `max-w-2xl`.
 * - `full-bleed`: edge-to-edge, bounded-height work surfaces (chat, explorer,
 *   data); children own their internal scroll (responsive.md V1/V2 — dvh-safe,
 *   one scroll container per region).
 *
 * NEVER hides children by breakpoint (kills the `hidden md:flex` shells,
 * design-system H2/R3; responsive.md hard rule #1). No per-page width values.
 */
const pageShellVariants = cva("w-full", {
  variants: {
    variant: {
      content: "mx-auto max-w-7xl space-y-8 p-4 md:p-8",
      narrow: "mx-auto max-w-2xl space-y-8 p-4 md:p-8",
      "full-bleed": "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
    },
  },
  defaultVariants: {
    variant: "content",
  },
});

export interface PageShellProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pageShellVariants> {
  children: React.ReactNode;
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(pageShellVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
PageShell.displayName = "PageShell";

export { PageShell, pageShellVariants };
