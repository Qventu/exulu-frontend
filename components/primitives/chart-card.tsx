"use client";

/**
 * ChartCard — the only other dashboard widget shape besides StatCard
 * (philosophy §5).
 *
 * Spec: design/codebase-structure.md §2.2 (chart-card.tsx) —
 * `{ title, description?, toolbar?, loading?, error?, children }`.
 * Chart content arrives via children; this primitive owns the frame, the
 * layout-mirroring skeleton, and the inline error + Retry state (never the
 * blank panel). It renders no chart itself — consumers must drive their
 * recharts surfaces with the `--chart-1..10` theme tokens (analytics doc /
 * design-system R1; no hardcoded hex).
 *
 * First consumers: Home (registry naming) and /analytics (work item 2.13);
 * built here so the extraction happens once (codebase-structure §4 Wave 1).
 */

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ChartCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  description?: string;
  /** Lens controls (range picker, type select…) — stacks under the title on phones (T3). */
  toolbar?: React.ReactNode;
  loading?: boolean;
  error?: { message: string; onRetry: () => void } | null;
  children: React.ReactNode;
}

const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(
  (
    { title, description, toolbar, loading = false, error = null, children, className, ...props },
    ref,
  ) => {
    const t = useTranslations("common");

    return (
      <Card ref={ref} className={cn("flex flex-col", className)} {...props}>
        <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="text-sm">{description}</CardDescription>
            )}
          </div>
          {toolbar && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar}</div>
          )}
        </CardHeader>
        <CardContent className="min-w-0 flex-1 p-4 pt-0">
          {loading ? (
            <div className="space-y-2" role="status">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex h-48 flex-col items-center justify-center gap-3 text-center"
            >
              <CircleAlert aria-hidden="true" className="size-8 text-destructive" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {error.message || t("somethingWentWrong")}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={error.onRetry}>
                {t("retry")}
              </Button>
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    );
  },
);
ChartCard.displayName = "ChartCard";

export { ChartCard };
