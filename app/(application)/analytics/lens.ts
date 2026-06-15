/**
 * Pure lens types + URL ↔ lens (de)serializers for /analytics.
 *
 * Extracted out of hooks.ts so the server `page.tsx` can call
 * `lensFromSearchParams` without crossing the "use client" boundary
 * (Next.js: any export from a "use client" module is a client reference
 * and cannot be invoked from a server component). hooks.ts re-exports
 * everything below, so client consumers still `import { … } from "./hooks"`
 * and don't need to change.
 *
 * No React. No Apollo. Anything React-touching lives in ./hooks.
 */

import {
  STATISTICS_TYPE_ENUM,
  type STATISTICS_TYPE,
} from "@/lib/enums/statistics";

// ---------------------------------------------------------------------------
// Lens constants + types
// ---------------------------------------------------------------------------

export const RANGE_PRESETS = ["24h", "7d", "14d", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const MEASURES = ["count", "tokens"] as const;
export type Measure = (typeof MEASURES)[number];

export const DIMENSIONS = ["agents", "users", "projects", "roles"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const BREAKDOWN_VIEWS = ["list", "share"] as const;
export type BreakdownView = (typeof BREAKDOWN_VIEWS)[number];

/** Max days a custom range may span (matches legacy DateRangeSelector). */
export const MAX_RANGE_DAYS = 30;
export const DEFAULT_PRESET: RangePreset = "14d";
export const DEFAULT_TYPE: STATISTICS_TYPE = "AGENT_RUN";
export const DEFAULT_MEASURE: Measure = "count";
export const DEFAULT_DIMENSION: Dimension = "agents";
export const DEFAULT_VIEW: BreakdownView = "list";

export interface RangeWindow {
  /** Inclusive start (ISO). */
  from: string;
  /** Inclusive end (ISO). */
  to: string;
  /** Length of the window in milliseconds, used to compute the previous-equal window. */
  durationMs: number;
}

export interface Lens {
  preset: RangePreset;
  /** Only used when preset === "custom"; otherwise derived from preset. */
  customFrom: string | null;
  customTo: string | null;
  type: STATISTICS_TYPE;
  measure: Measure;
  dimension: Dimension;
  view: BreakdownView;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStatisticsType(
  value: string | null | undefined,
): value is STATISTICS_TYPE {
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(STATISTICS_TYPE_ENUM, value);
}

function narrow<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Minimal interface satisfied by both Web's URLSearchParams and Next's ReadonlyURLSearchParams. */
interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}

// ---------------------------------------------------------------------------
// URL ↔ Lens
// ---------------------------------------------------------------------------

/**
 * Parse the five URL params honored by the lens. Unknown values fall back
 * silently (no crash, no toast — the user typed a deep link, we degrade).
 * The one exception is a custom range over MAX_RANGE_DAYS, which the view
 * component flags with a one-shot toast (analytics.md UX#10, i18n'd).
 */
export function lensFromSearchParams(
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
): Lens {
  const get = (key: string) =>
    typeof (searchParams as URLSearchParams).get === "function"
      ? (searchParams as URLSearchParams).get(key)
      : null;
  const presetRaw = get("range");
  const preset = narrow<RangePreset>(presetRaw, RANGE_PRESETS, DEFAULT_PRESET);
  const fromRaw = get("from");
  const toRaw = get("to");
  // Validate custom range; if invalid or too large, downgrade to default
  // preset and let the view surface a toast on next mount.
  let customFrom: string | null = null;
  let customTo: string | null = null;
  let effectivePreset: RangePreset = preset;
  if (preset === "custom" && fromRaw && toRaw) {
    const from = Date.parse(fromRaw);
    const to = Date.parse(toRaw);
    const valid = Number.isFinite(from) && Number.isFinite(to) && from <= to;
    const inBounds = valid && to - from <= MAX_RANGE_DAYS * DAY_MS;
    if (valid && inBounds) {
      customFrom = new Date(from).toISOString();
      customTo = new Date(to).toISOString();
    } else {
      effectivePreset = DEFAULT_PRESET;
    }
  } else if (preset === "custom") {
    effectivePreset = DEFAULT_PRESET;
  }

  const typeRaw = get("type");
  const type = isStatisticsType(typeRaw) ? typeRaw : DEFAULT_TYPE;

  return {
    preset: effectivePreset,
    customFrom,
    customTo,
    type,
    measure: narrow<Measure>(get("measure"), MEASURES, DEFAULT_MEASURE),
    dimension: narrow<Dimension>(get("dimension"), DIMENSIONS, DEFAULT_DIMENSION),
    view: narrow<BreakdownView>(get("view"), BREAKDOWN_VIEWS, DEFAULT_VIEW),
  };
}

/** Serialize the lens back to a stable query-string (sorted keys). */
export function lensToSearchParams(lens: Lens): string {
  const params = new URLSearchParams();
  if (lens.preset !== DEFAULT_PRESET) params.set("range", lens.preset);
  if (lens.preset === "custom" && lens.customFrom && lens.customTo) {
    params.set("from", lens.customFrom);
    params.set("to", lens.customTo);
  }
  if (lens.type !== DEFAULT_TYPE) params.set("type", lens.type);
  if (lens.measure !== DEFAULT_MEASURE) params.set("measure", lens.measure);
  if (lens.dimension !== DEFAULT_DIMENSION) params.set("dimension", lens.dimension);
  if (lens.view !== DEFAULT_VIEW) params.set("view", lens.view);
  const sorted = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const out = new URLSearchParams();
  for (const [k, v] of sorted) out.set(k, v);
  return out.toString();
}

/**
 * Resolve the lens preset (+ custom dates) to a concrete window with a
 * matched `previous` (equal-length window immediately preceding `from`).
 * Anchor is stable per call — the consumer hook memoizes around the lens.
 */
export function resolveWindow(
  lens: Lens,
  anchor: Date = new Date(),
): { current: RangeWindow; previous: RangeWindow } {
  const now = anchor.getTime();
  let fromMs: number;
  let toMs: number;
  if (lens.preset === "custom" && lens.customFrom && lens.customTo) {
    fromMs = Date.parse(lens.customFrom);
    toMs = Date.parse(lens.customTo);
  } else {
    toMs = now;
    const days =
      lens.preset === "24h"
        ? 1
        : lens.preset === "7d"
          ? 7
          : lens.preset === "30d"
            ? 30
            : 14;
    fromMs = now - days * DAY_MS;
  }
  const duration = toMs - fromMs;
  const prevTo = fromMs - 1;
  const prevFrom = prevTo - duration;
  return {
    current: {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      durationMs: duration,
    },
    previous: {
      from: new Date(prevFrom).toISOString(),
      to: new Date(prevTo).toISOString(),
      durationMs: duration,
    },
  };
}
