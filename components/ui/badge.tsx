import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        info: "border-transparent bg-info text-info-foreground hover:bg-info/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Renders a <span>, not a <div>.
 *
 * Badges land inside paragraphs in two places that matter: the citation chips
 * the assistant's answers render inside markdown <p> blocks, and the
 * "enabled / disabled" chips beside section titles in the agent editor. A <div>
 * inside a <p> is invalid HTML, so the browser closes the paragraph early and
 * the server and client trees stop matching — which React reports as a
 * hydration FAILURE and recovers from by regenerating the whole subtree on the
 * client. On the chat surface that subtree is the entire conversation.
 *
 * Purely a correctness fix: the variants are already `inline-flex`, so a span
 * and a div lay out identically here.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
