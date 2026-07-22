/**
 * Shared budget types + projection math, used by the /budgets admin page, the
 * BudgetBar / BudgetEditor components, and the in-chat budget indicator.
 *
 * Budgets are LiteLLM tag budgets; the backend is the source of truth. The
 * "projection" is a deliberately simple linear burn-rate forecast that flags an
 * entity that is on track to exceed its budget before the window resets.
 */

export type BudgetEntityType = "user" | "role" | "team" | "project" | "agent" | "routine";

export const BUDGET_ENTITY_TYPES: {
  type: BudgetEntityType;
  label: string;
  labelPlural: string;
}[] = [
  { type: "user", label: "User", labelPlural: "Users" },
  { type: "role", label: "Role", labelPlural: "Roles" },
  { type: "team", label: "Team", labelPlural: "Teams" },
  { type: "project", label: "Project", labelPlural: "Projects" },
  { type: "agent", label: "Agent", labelPlural: "Agents" },
  { type: "routine", label: "Routine", labelPlural: "Routines" },
];

export type BudgetDuration = "1d" | "7d" | "30d";

export const BUDGET_DURATIONS: { value: BudgetDuration; label: string }[] = [
  { value: "1d", label: "Daily" },
  { value: "7d", label: "Weekly" },
  { value: "30d", label: "Monthly" },
];

/** A budget snapshot from LiteLLM (matches the backend TagInfo / UserBudgetView). */
export type BudgetInfo = {
  name?: string;
  spend: number;
  max_budget: number | null;
  budget_duration: string | null;
  budget_reset_at: string | null;
  /** End-user display preference (only set on the self-view from /me/budget).
   *  "percent" → render a percentage instead of the exact USD amount. Absent /
   *  "amount" → show dollars (admin views always show dollars). */
  display?: "amount" | "percent";
};

export type BudgetLevel = "ok" | "warn" | "over";

export type BudgetProjection = {
  /** Percentage of the budget already spent (can exceed 100). */
  percentUsed: number;
  /** Forecast spend by the reset date, or null when it can't be computed. */
  projected: number | null;
  /** Forecast as a percentage of max_budget, or null. */
  projectedPercent: number | null;
  /** On track to exceed the budget before reset (but not yet over). */
  overPace: boolean;
  /** Already at/over the budget. */
  overBudget: boolean;
  /** Colour band: ok (green) / warn (amber) / over (red). */
  level: BudgetLevel;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Parse a LiteLLM budget_duration like "30d" into a day count. */
export function parseDurationDays(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const match = /^(\d+)d$/.exec(duration.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Linear burn-rate projection. windowStart = reset - duration; projected spend
 * = spend / elapsed * window. Elapsed is floored at 1h to avoid a blow-up at
 * the very start of a window.
 */
export function computeBudgetProjection(b: BudgetInfo | null | undefined): BudgetProjection {
  const max = b?.max_budget ?? 0;
  const spend = b?.spend ?? 0;
  const percentUsed = max > 0 ? (spend / max) * 100 : 0;
  const overBudget = max > 0 && spend >= max;

  let projected: number | null = null;
  let projectedPercent: number | null = null;

  const windowDays = parseDurationDays(b?.budget_duration);
  if (windowDays && b?.budget_reset_at && max > 0) {
    const resetMs = new Date(b.budget_reset_at).getTime();
    if (Number.isFinite(resetMs)) {
      const windowMs = windowDays * DAY_MS;
      const startMs = resetMs - windowMs;
      const elapsedMs = Math.max(Date.now() - startMs, HOUR_MS);
      projected = (spend / elapsedMs) * windowMs;
      projectedPercent = (projected / max) * 100;
    }
  }

  const overPace = projectedPercent != null && projectedPercent > 100 && !overBudget;
  const level: BudgetLevel = overBudget
    ? "over"
    : percentUsed >= 80 || overPace
      ? "warn"
      : "ok";

  return { percentUsed, projected, projectedPercent, overPace, overBudget, level };
}

/** Format a USD amount compactly (e.g. $19.50, $1,200). */
export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function durationLabel(duration: string | null | undefined): string {
  return BUDGET_DURATIONS.find((d) => d.value === duration)?.label ?? (duration ?? "—");
}

/** True when a budget exists and has a positive cap — the shared "should we
 *  render an indicator at all" predicate. */
export function hasCappedBudget(b: BudgetInfo | null | undefined): b is BudgetInfo {
  return !!b && b.max_budget != null && b.max_budget > 0;
}

/** One line of the shared budget detail block (popovers / tooltips). `key` is
 *  an i18n key under the "budgets" namespace, `values` its interpolations.
 *  Kept as data rather than JSX so the percent-mode "never leak USD" contract
 *  is unit-testable in the node vitest environment. */
export type BudgetDetailLine = {
  key:
    | "bar.usedOfMax"
    | "bar.percentUsed"
    | "bar.remainingDuration"
    | "bar.percentRemainingDuration"
    | "bar.projected"
    | "bar.projectedOverPace"
    | "bar.projectedPercent"
    | "bar.projectedPercentOverPace"
    | "bar.resetsOn";
  values: Record<string, string | number>;
  /** Headline line (rendered font-medium). */
  emphasis?: boolean;
  tone?: "warn" | "muted";
};

/**
 * Build the used / remaining / projection / reset-date lines shown in budget
 * popovers and tooltips. `display === "percent"` selects the percent-only
 * variants (no USD value anywhere — the admin setting user_budget_display);
 * absent / "amount" keeps the dollar variants. Mirrors the line selection
 * previously inlined in TopBarBudget.
 */
export function buildBudgetDetailLines(b: BudgetInfo): BudgetDetailLine[] {
  const percentMode = b.display === "percent";
  const p = computeBudgetProjection(b);
  const usedPct = Math.round(p.percentUsed);
  const leftPct = Math.max(0, 100 - usedPct);
  const remaining = Math.max((b.max_budget ?? 0) - b.spend, 0);

  const lines: BudgetDetailLine[] = [
    percentMode
      ? { key: "bar.percentUsed", values: { percent: usedPct }, emphasis: true }
      : {
          key: "bar.usedOfMax",
          values: { spend: formatUsd(b.spend), max: formatUsd(b.max_budget) },
          emphasis: true,
        },
    percentMode
      ? {
          key: "bar.percentRemainingDuration",
          values: { percent: leftPct, duration: durationLabel(b.budget_duration) },
        }
      : {
          key: "bar.remainingDuration",
          values: { remaining: formatUsd(remaining), duration: durationLabel(b.budget_duration) },
        },
  ];

  if (percentMode) {
    const projectedPct = p.projectedPercent != null ? Math.round(p.projectedPercent) : null;
    if (projectedPct != null) {
      const line: BudgetDetailLine = {
        key: p.overPace ? "bar.projectedPercentOverPace" : "bar.projectedPercent",
        values: { percent: projectedPct },
      };
      if (p.overPace) line.tone = "warn";
      lines.push(line);
    }
  } else if (p.projected != null) {
    const line: BudgetDetailLine = {
      key: p.overPace ? "bar.projectedOverPace" : "bar.projected",
      values: { amount: formatUsd(p.projected) },
    };
    if (p.overPace) line.tone = "warn";
    lines.push(line);
  }

  if (b.budget_reset_at) {
    lines.push({
      key: "bar.resetsOn",
      values: { date: new Date(b.budget_reset_at).toLocaleDateString() },
      tone: "muted",
    });
  }

  return lines;
}

/**
 * The standardized reset date a duration defaults to, mirroring LiteLLM's
 * scheme (duration_parser._handle_day_reset): daily → next midnight, weekly →
 * next Monday, monthly → 1st of next month. Computed at UTC day boundaries so
 * the monthly default lands on the 1st in UTC — the backend's window math keys
 * calendar-month alignment off `budget_reset_at.getUTCDate() === 1`.
 */
export function defaultResetDate(duration: BudgetDuration, now: Date = new Date()): Date {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  if (duration === "30d") {
    return new Date(Date.UTC(y, mo + 1, 1));
  }
  if (duration === "7d") {
    const dow = now.getUTCDay(); // Sun=0 … Sat=6
    const daysUntilMonday = ((1 - dow + 7) % 7) || 7; // next Monday; if Monday, +7
    return new Date(Date.UTC(y, mo, d + daysUntilMonday));
  }
  // "1d" → next UTC midnight
  return new Date(Date.UTC(y, mo, d + 1));
}
