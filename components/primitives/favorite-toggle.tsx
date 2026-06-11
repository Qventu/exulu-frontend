"use client";

/**
 * FavoriteToggle — star toggle with `aria-pressed` and a subtle confirm
 * animation.
 *
 * Spec: design/codebase-structure.md §2.3 registry —
 * `{ pressed: boolean; onToggle: () => void; label: string }`; first consumer
 * projects, next prompts (chat history later).
 *
 * Contract details:
 * - Controlled component; `label` is the accessible name, already translated
 *   by the consumer (primitives carry no feature copy; tooltip mirrors it).
 * - The click never navigates/bubbles, so rows that are links can host the
 *   toggle safely.
 * - Touch targets (responsive.md §2 / DoD: ≥44px hit area on touch):
 *   `size-11` (44px) below `md`; compact `size-8` is desktop-pointer sugar
 *   at `md+`.
 * - Motion (projects.md §3 motion 2): 200 ms scale pop confirming the toggle
 *   registered — `motion-safe` only, so reduced-motion gets an instant swap.
 * - Color: the filled star keeps the conventional favorite-yellow with an
 *   explicit dark-mode value (projects.md §3 theming note) — the one
 *   sanctioned non-token color, mirroring SessionItemBadge's amber.
 */

import { Star } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FavoriteToggleProps {
  pressed: boolean;
  onToggle: () => void;
  /** Accessible name + tooltip text, already translated. */
  label: string;
  className?: string;
}

const FavoriteToggle = React.forwardRef<HTMLButtonElement, FavoriteToggleProps>(
  ({ pressed, onToggle, label, className }, ref) => {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={pressed}
              aria-label={label}
              className={cn("size-11 shrink-0 md:size-8", className)}
              onClick={(event) => {
                // Rows hosting the toggle are often links — never navigate.
                event.preventDefault();
                event.stopPropagation();
                onToggle();
              }}
            >
              <Star
                aria-hidden="true"
                // Remount on state change so the pop replays per toggle.
                key={pressed ? "on" : "off"}
                className={cn(
                  "size-4",
                  pressed
                    ? "fill-yellow-400 text-yellow-400 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200 dark:fill-yellow-500 dark:text-yellow-500"
                    : "text-muted-foreground",
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
FavoriteToggle.displayName = "FavoriteToggle";

export { FavoriteToggle };
