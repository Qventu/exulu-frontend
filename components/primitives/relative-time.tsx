"use client";

/**
 * RelativeTime — locale-aware relative timestamp ("2d ago") rendered as a
 * semantic `<time>` element, with the absolute date-time available on
 * hover AND keyboard focus via tooltip.
 *
 * Spec: design/codebase-structure.md §2.3 (RelativeTime) —
 * `{ date: Date|string; live?: boolean }` — "2d ago" + absolute tooltip,
 * locale-aware, 1s tick scoped inside (§2.1 merge: absorbs the
 * RelativeTime + use-ticker copies in projects/transcriptions/feedback).
 *
 * Locale comes from next-intl's active locale; formatting is done with
 * Intl.RelativeTimeFormat / Intl.DateTimeFormat — no message keys needed.
 */

import * as React from "react";
import { useLocale } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RelativeTimeProps
  extends Omit<React.TimeHTMLAttributes<HTMLTimeElement>, "dateTime" | "children"> {
  date: Date | string;
  /** Re-render every second so "5s ago" stays live. Off by default. */
  live?: boolean;
}

type Unit = { unit: Intl.RelativeTimeFormatUnit; seconds: number };

const UNITS: Unit[] = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

function formatRelative(rtf: Intl.RelativeTimeFormat, diffMs: number): string {
  const diffSeconds = Math.round(diffMs / 1000);
  for (const { unit, seconds } of UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      // +0 avoids rendering "-0 seconds" artifacts for sub-second diffs.
      return rtf.format(Math.trunc(diffSeconds / seconds) + 0, unit);
    }
  }
  return rtf.format(0, "second");
}

const RelativeTime = React.forwardRef<HTMLTimeElement, RelativeTimeProps>(
  ({ date, live = false, className, ...props }, ref) => {
    const locale = useLocale();
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
      if (!live) return;
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, [live]);

    const parsed = React.useMemo(
      () => (date instanceof Date ? date : new Date(date)),
      [date],
    );

    const { relativeFormatter, absoluteFormatter } = React.useMemo(
      () => ({
        relativeFormatter: new Intl.RelativeTimeFormat(locale, {
          numeric: "auto",
          style: "narrow",
        }),
        absoluteFormatter: new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      }),
      [locale],
    );

    if (Number.isNaN(parsed.getTime())) return null;

    const relative = formatRelative(relativeFormatter, parsed.getTime() - now);
    const absolute = absoluteFormatter.format(parsed);

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <time
              ref={ref}
              dateTime={parsed.toISOString()}
              tabIndex={0}
              suppressHydrationWarning
              className={cn(
                "whitespace-nowrap rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className,
              )}
              {...props}
            >
              {relative}
            </time>
          </TooltipTrigger>
          <TooltipContent>{absolute}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);
RelativeTime.displayName = "RelativeTime";

export { RelativeTime };
