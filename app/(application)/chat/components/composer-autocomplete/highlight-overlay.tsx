"use client";

/**
 * Mirror layer painting subtle purple pills behind recognized /tool and
 * @file tokens (spec 2026-07-07). Renders the SAME text as the textarea with
 * identical typography metrics but transparent color; only the token spans'
 * backgrounds are visible. Mount absolutely inside a `relative` wrapper
 * directly around the textarea; the textarea (already bg-transparent) paints
 * the real glyphs on top. Metric contract: every typography-affecting class
 * here must match the textarea's (px-2 py-2.5 text-base md:text-sm max-h-40).
 * Scroll is synced by the composer via the textarea's onScroll.
 */

import * as React from "react";

import type { TokenRange } from "./matching";

export const HighlightOverlay = React.forwardRef<
  HTMLDivElement,
  { value: string; ranges: TokenRange[] }
>(function HighlightOverlay({ value, ranges }, ref) {
  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push(value.slice(cursor, range.start));
    }
    segments.push(
      // px + negative mx cancel out, so glyph positions are untouched while
      // the pill bleeds 2px past the token on each side.
      <span key={range.start} className="-mx-0.5 rounded bg-primary/10 px-0.5">
        {value.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < value.length) segments.push(value.slice(cursor));

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 max-h-40 overflow-hidden whitespace-pre-wrap break-words px-2 py-2.5 text-base text-transparent md:text-sm"
    >
      {segments}
    </div>
  );
});
