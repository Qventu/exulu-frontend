/**
 * Shared budget types + projection math, used by the /budgets admin page, the
 * BudgetBar / BudgetEditor components, and the in-chat budget indicator.
 *
 * Budgets are LiteLLM tag budgets; the backend is the source of truth. The
 * "projection" is a deliberately simple linear burn-rate forecast that flags an
 * entity that is on track to exceed its budget before the window resets.
 */

export type BudgetEntityType = "user" | "role" | "team" | "project" | "agent";

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
