"use client";

/**
 * ScoreCell — the single primitive for a matrix cell in the eval-runs grid.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1): the runs matrix used to
 * hand-roll cell appearance per state inside `eval-run-column.tsx`, leaking
 * raw `text-green-XXX` / `text-red-XXX` literals (design-system R1/R6
 * violation) and silently rendering non-interactive completed cells as
 * `<div>`s (a11y P0 — keyboard users couldn't open the result sheet).
 *
 * States:
 * - `completed`: score colored against the run's pass threshold; rendered
 *   as a keyboard-accessible <button> with a visible focus ring. `onClick`
 *   opens the result-detail Sheet.
 * - `waiting` / `active` / `failed` / `delayed` / `paused` / `stuck`: status
 *   icon + i18n label, never clickable.
 * - `not-started`: muted "Not started" label.
 * - `empty`: striped `—` for cases not included in the run.
 *
 * All colors are semantic tokens (text-success / text-warning /
 * text-destructive / text-info / text-muted-foreground).
 */

import { AlertTriangle, Clock, Loader2, Pause, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type ScoreCellState =
  | "completed"
  | "waiting"
  | "active"
  | "failed"
  | "delayed"
  | "paused"
  | "stuck"
  | "not-started"
  | "empty";

export interface ScoreCellProps {
  state: ScoreCellState;
  /** Numeric result for `completed` cells; otherwise ignored. */
  score?: number;
  /** Pass threshold (0–100); colors the completed cell relative to this. */
  threshold?: number;
  /** Optional aria label override (composed automatically when omitted). */
  label?: string;
  onClick?: () => void;
}

const STATUS_ICONS: Record<
  Exclude<ScoreCellState, "completed" | "not-started" | "empty">,
  React.ReactNode
> = {
  waiting: <Clock aria-hidden="true" className="h-3 w-3" />,
  active: <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />,
  failed: <XCircle aria-hidden="true" className="h-3 w-3" />,
  delayed: <Clock aria-hidden="true" className="h-3 w-3" />,
  paused: <Pause aria-hidden="true" className="h-3 w-3" />,
  stuck: <AlertTriangle aria-hidden="true" className="h-3 w-3" />,
};

function scoreColor(score: number, threshold: number): string {
  if (score >= threshold) return "text-success";
  if (score >= threshold - 20) return "text-warning";
  return "text-destructive";
}

export function ScoreCell({
  state,
  score,
  threshold = 70,
  label,
  onClick,
}: ScoreCellProps) {
  const t = useTranslations("evals.runs.matrix");

  // Empty / not-included cell.
  if (state === "empty") {
    return (
      <div
        aria-label={label ?? t("notIncluded")}
        className="flex h-full w-full min-h-[48px] items-center justify-center rounded striped-background text-xs text-muted-foreground"
      >
        <span aria-hidden="true">—</span>
      </div>
    );
  }

  // Not started (no job result yet).
  if (state === "not-started") {
    return (
      <div className="flex h-full w-full min-h-[48px] items-center justify-center gap-2 rounded text-xs text-muted-foreground">
        <Clock aria-hidden="true" className="h-3 w-3" />
        <span>{label ?? t("notStarted")}</span>
      </div>
    );
  }

  // Completed — interactive button.
  if (state === "completed") {
    const display =
      typeof score === "number" && !Number.isNaN(score)
        ? score.toFixed(1)
        : "—";
    const color =
      typeof score === "number" && !Number.isNaN(score)
        ? scoreColor(score, threshold)
        : "text-muted-foreground";

    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ?? `${display}`}
        className={cn(
          "flex h-full w-full min-h-[48px] items-center justify-center rounded text-sm font-semibold transition-colors hover:underline",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          color,
        )}
      >
        {display}
      </button>
    );
  }

  // Any other in-flight / terminal status with an icon + label.
  const statusLabel = label ?? t(`status.${state}` as const);
  const color =
    state === "failed" || state === "stuck"
      ? "text-destructive"
      : state === "active"
        ? "text-info"
        : state === "delayed"
          ? "text-warning"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-[48px] items-center justify-center gap-2 rounded text-xs",
        color,
      )}
    >
      {STATUS_ICONS[state]}
      <span className="capitalize">{statusLabel}</span>
    </div>
  );
}
