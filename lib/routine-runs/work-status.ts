/**
 * Work statuses of routine runs (backend spec
 * 2026-11-16-routine-work-status-design): a routine may define its own list
 * (workflow_templates.work_statuses), each run carries one. Pure helpers —
 * no React, no DOM — shared by the runs list and the status editor.
 */

export const WORK_STATUS_COLORS = ["gray", "red", "orange", "yellow", "green", "blue", "purple"] as const;
export type WorkStatusColor = (typeof WORK_STATUS_COLORS)[number];

export interface WorkStatus {
  key: string;
  label: string;
  color?: WorkStatusColor;
  /** Runs with this status count as done and move to the "Erledigt" area. */
  done?: boolean;
}

export interface WorkStatusConfig {
  statuses: WorkStatus[];
  default: string | null;
}

export interface WorkStatusActor {
  kind: "user" | "tool" | "agent" | "default";
  id?: number | string;
  user?: number;
}

/** Same pattern the backend enforces. */
export const WORK_STATUS_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

const isColor = (value: unknown): value is WorkStatusColor =>
  typeof value === "string" && (WORK_STATUS_COLORS as readonly string[]).includes(value);

/** Never throws. Anything unusable → no statuses configured. */
export function parseWorkStatusConfig(raw: unknown): WorkStatusConfig {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { statuses: [], default: null };
    }
  }
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
  if (!obj || !Array.isArray(obj.statuses)) return { statuses: [], default: null };
  const seen = new Set<string>();
  const statuses: WorkStatus[] = [];
  for (const entry of obj.statuses) {
    if (!entry || typeof entry !== "object") continue;
    const { key, label, color, done } = entry as Record<string, unknown>;
    if (typeof key !== "string" || !WORK_STATUS_KEY_PATTERN.test(key) || seen.has(key)) continue;
    seen.add(key);
    statuses.push({
      key,
      label: typeof label === "string" && label.trim() ? label : key,
      ...(isColor(color) ? { color } : {}),
      ...(typeof done === "boolean" ? { done } : {}),
    });
  }
  return { statuses, default: typeof obj.default === "string" && seen.has(obj.default) ? obj.default : null };
}

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Key for a new status, derived from its label: lower case, umlauts spelled
 * out, everything else non-alphanumeric → "_". Always matches
 * WORK_STATUS_KEY_PATTERN; a collision with `taken` gets "_2", "_3", …
 */
export function deriveStatusKey(label: string, taken: string[]): string {
  let base = label
    .toLowerCase()
    .replace(/[äöüß]/g, (ch) => UMLAUTS[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) base = "status";
  else if (!/^[a-z]/.test(base)) base = `status_${base}`;
  if (base.length < 2) base = `${base}_1`;
  base = base.slice(0, 40).replace(/_+$/g, "");
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

/** Message keys under routines.workStatus.validation.*; errors block the save, warnings do not. */
export function validateWorkStatusDraft(config: WorkStatusConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (config.statuses.length === 0) return { errors, warnings };
  if (config.statuses.some((status) => !status.label.trim())) errors.push("labelEmpty");
  const def = config.statuses.find((status) => status.key === config.default);
  if (!def) errors.push("defaultMissing");
  else if (def.done) errors.push("defaultIsDone");
  if (!config.statuses.some((status) => status.done)) warnings.push("noDoneStatus");
  return { errors, warnings };
}

const BADGE_CLASS: Record<WorkStatusColor, string> = {
  gray: "bg-muted text-muted-foreground border-border",
  red: "bg-destructive/15 text-destructive border-destructive/30",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  yellow: "bg-warning/15 text-warning border-warning/30",
  green: "bg-success/15 text-success border-success/30",
  blue: "bg-info/15 text-info border-info/30",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
};

export function workStatusBadgeClass(color?: string): string {
  return BADGE_CLASS[isColor(color) ? color : "gray"];
}

/** Solid swatch for menus and the colour picker. */
export const WORK_STATUS_DOT_CLASS: Record<WorkStatusColor, string> = {
  gray: "bg-muted-foreground",
  red: "bg-destructive",
  orange: "bg-orange-500",
  yellow: "bg-warning",
  green: "bg-success",
  blue: "bg-info",
  purple: "bg-purple-500",
};

/** The status a run shows; a key no longer configured comes back as `removed`. */
export function resolveRunStatus(
  config: WorkStatusConfig,
  key?: string | null,
): { key: string; label: string; color?: string; removed: boolean } | null {
  if (!key) return null;
  const status = config.statuses.find((entry) => entry.key === key);
  if (!status) return { key, label: key, removed: true };
  return { key, label: status.label, ...(status.color ? { color: status.color } : {}), removed: false };
}
