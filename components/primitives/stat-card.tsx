"use client";

/**
 * StatCard — one of the only two dashboard widget shapes (philosophy §5).
 *
 * Spec: design/codebase-structure.md §2.2 (stat-card.tsx) —
 * `{ label, value, delta?, loading?, href?, icon? }` — extracted from
 * components/dashboard/summary-cards.tsx with the `isLoading` ASI bug fixed
 * (dashboard.md UX review #3: both range queries gate the skeleton, so a
 * trend is never rendered against an unloaded comparison value).
 *
 * Generic additions on the spec'd API (primitives contract, README §5):
 * - `delta.emphasis` — "status is quiet until it isn't" (philosophy §4):
 *   the delta renders muted by default; the consumer sets `emphasis` when the
 *   change is anomalous (dashboard.md: beyond ±25%) and only then does it
 *   earn semantic color (up = success, down = destructive).
 * - `caption` — muted comparison line ("vs 7-day avg: N"), kept visible so
 *   the datum never hides behind hover (responsive.md T7).
 *
 * Token-only colors; numbers are formatted locale-aware in place; skeleton
 * state mirrors the real layout (philosophy §6).
 */

import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardDelta {
  /** Already-formatted change ("+12%", "−3%"). */
  value: string;
  direction: "up" | "down" | "flat";
  /** Earn semantic color (anomalous change); muted otherwise. */
  emphasis?: boolean;
}

export interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  value: string | number;
  delta?: StatCardDelta;
  /** Quiet comparison caption, always visible (no hover-only data). */
  caption?: string;
  /** Second quiet caption line for contextual hints (e.g. unattributed spend). */
  hint?: string;
  loading?: boolean;
  /** Makes the whole card a link (e.g. Home → /analytics). */
  href?: string;
  icon?: LucideIcon;
}

const DELTA_ICONS: Record<StatCardDelta["direction"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { label, value, delta, caption, hint, loading = false, href, icon, className, ...props },
    ref,
  ) => {
    const locale = useLocale();
    const Icon = icon;
    const DeltaIcon = delta ? DELTA_ICONS[delta.direction] : null;

    const formattedValue =
      typeof value === "number"
        ? new Intl.NumberFormat(locale).format(value)
        : value;

    const deltaColor = delta?.emphasis
      ? delta.direction === "up"
        ? "text-success"
        : delta.direction === "down"
          ? "text-destructive"
          : "text-muted-foreground"
      : "text-muted-foreground";

    const body = loading ? (
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    ) : (
      <div className="space-y-2 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </p>
          {Icon && (
            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {formattedValue}
        </p>
        {(delta || caption || hint) && (
          <div className="space-y-0.5">
            {delta && DeltaIcon && (
              <p className={cn("flex items-center gap-1 text-xs font-medium", deltaColor)}>
                <DeltaIcon aria-hidden="true" className="size-3.5 shrink-0" />
                {delta.value}
              </p>
            )}
            {caption && (
              <p className="text-xs text-muted-foreground/70">{caption}</p>
            )}
            {hint && (
              <p className="text-xs text-muted-foreground/50">{hint}</p>
            )}
          </div>
        )}
      </div>
    );

    if (href && !loading) {
      return (
        <Card
          ref={ref}
          className={cn("transition-colors duration-150", className)}
          {...props}
        >
          <Link
            href={href}
            className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&:hover]:bg-accent/50"
          >
            {body}
          </Link>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={className} {...props}>
        {body}
      </Card>
    );
  },
);
StatCard.displayName = "StatCard";

export { StatCard };
