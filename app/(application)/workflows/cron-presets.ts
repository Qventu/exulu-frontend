/**
 * CRON_PRESETS for the routine schedule editor — work item 2.12.
 *
 * Relocated unchanged from the legacy
 * `app/(application)/workflows/components/columns.tsx:405-414`. The new
 * `matchPreset()` helper enables the editor's prefill round-trip
 * (workflows.md UX #13): when an existing cron matches a preset value, the
 * editor opens on the Presets tab with the option pre-selected; otherwise it
 * opens on the Custom tab. Whitespace is normalized before comparing —
 * alternate forms (`0 0 * * 0` vs `0 0 * * SUN`) deliberately land in custom
 * mode (acceptable, documented in workflows.md §4 architect risks).
 *
 * Labels stay in code (not i18n): consumers map this list through the i18n
 * layer if/when localized; today the legacy strings are reproduced exactly so
 * downstream display copy is identical. The presets are an editor convenience
 * — i18n integration is a follow-up.
 */

export interface CronPreset {
  /** Human label rendered in the Select. */
  label: string;
  /** Canonical cron expression saved on selection. */
  value: string;
  /** One-line description rendered beneath the label. */
  description: string;
}

export const CRON_PRESETS: CronPreset[] = [
  {
    label: "Every day at 00:00",
    value: "0 0 * * *",
    description: "Runs once daily at midnight",
  },
  {
    label: "Every hour",
    value: "0 * * * *",
    description: "Runs at the start of every hour",
  },
  {
    label: "Weekdays at 09:00",
    value: "0 9 * * 1-5",
    description: "Monday to Friday at 9 AM",
  },
  {
    label: "Every 15 minutes",
    value: "*/15 * * * *",
    description: "Runs 4 times per hour",
  },
  {
    label: "Every 30 minutes",
    value: "*/30 * * * *",
    description: "Runs twice per hour",
  },
  {
    label: "Weekly on Sunday 00:00",
    value: "0 0 * * 0",
    description: "Every Sunday at midnight",
  },
  {
    label: "Monthly on 1st at 09:00",
    value: "0 9 1 * *",
    description: "First day of month at 9 AM",
  },
];

/**
 * Normalize a cron expression for preset matching.
 * Squashes runs of whitespace to a single space and trims edges. Does NOT
 * rewrite alternate forms (numeric weekday vs SUN/MON, etc.) — those land in
 * custom mode by design.
 */
function normalize(cron: string): string {
  return cron.replace(/\s+/g, " ").trim();
}

/**
 * Returns the preset whose value matches the given cron, or null when none
 * does. Drives the editor's prefill round-trip (workflows.md UX #13).
 */
export function matchPreset(cron: string | undefined | null): CronPreset | null {
  if (!cron) return null;
  const normalized = normalize(cron);
  return CRON_PRESETS.find((p) => normalize(p.value) === normalized) ?? null;
}
