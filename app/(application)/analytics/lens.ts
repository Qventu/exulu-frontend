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
 *
 * STATISTICS_TYPE is retired from /analytics — LiteLLM has no event-type
 * taxonomy; spend/tokens/requests already cover what the GraphQL union
 * used to discriminate. URL backwards-compat for legacy ?type=AGENT_RUN /
 * ?type=WORKFLOW_RUN deep links is preserved below via
 * LENS_TYPE_FROM_LEGACY.
 */

// ---------------------------------------------------------------------------
// Lens constants + types
// ---------------------------------------------------------------------------

export const RANGE_PRESETS = ["24h", "7d", "14d", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const MEASURES = ["spend", "tokens", "requests"] as const;
export type Measure = (typeof MEASURES)[number];

export const DIMENSIONS = ["agents", "users", "projects", "teams", "roles"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const BREAKDOWN_VIEWS = ["list", "share"] as const;
export type BreakdownView = (typeof BREAKDOWN_VIEWS)[number];

/**
 * Lens type — replaces the legacy STATISTICS_TYPE enum. LiteLLM's
 * /tag/daily/activity has no event-type taxonomy; the dimension we pivot on
 * is the *tag prefix family* the backend emits via buildTags() — see
 * src/exulu/tags.ts. Each Exulu LLM call double-tags itself per dimension
 * (id + name); the lens type selects which family to filter / breakdown by.
 *
 * Note: 'workflows' is intentionally absent. buildTags() emits no
 * workflow_/routine_ prefix today (architect plan §HONEST GAP). When the
 * backend ships those prefixes, the dimension joins this union.
 */
export const LENS_TYPES = ["all", "agents", "users", "projects", "teams", "roles"] as const;
export type LensType = (typeof LENS_TYPES)[number];

/** Max days a custom range may span (matches legacy DateRangeSelector). */
export const MAX_RANGE_DAYS = 30;
export const DEFAULT_PRESET: RangePreset = "14d";
export const DEFAULT_TYPE: LensType = "all";
export const DEFAULT_MEASURE: Measure = "spend";
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
  type: LensType;
  measure: Measure;
  dimension: Dimension;
  view: BreakdownView;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Legacy ?type=STATISTICS_TYPE → new LensType. Honored verbatim for deep
 * links. Anything not in the map degrades silently to DEFAULT_TYPE per
 * analytics.md UX#10 (the same fall-back contract the rest of the parser
 * uses — no toast, no crash).
 *
 * HONEST FALLBACK for WORKFLOW_RUN / CONTEXT_*: buildTags() emits no
 * workflow_/routine_/context_ prefix — "all" is the only honest choice
 * over silently mis-attributing to agents.
 */
const LENS_TYPE_FROM_LEGACY: Record<string, LensType> = {
  AGENT_RUN: "agents",
  TOOL_CALL: "agents",
  WORKFLOW_RUN: "all",
  CONTEXT_RETRIEVE: "all",
  CONTEXT_UPSERT: "all",
  SOURCE_UPDATE: "all",
  EMBEDDER_GENERATE: "all",
  EMBEDDER_UPSERT: "all",
  EMBEDDER_DELETE: "all",
};

function parseLensType(value: string | null | undefined): LensType {
  if (!value) return DEFAULT_TYPE;
  if ((LENS_TYPES as readonly string[]).includes(value)) return value as LensType;
  if (value in LENS_TYPE_FROM_LEGACY) return LENS_TYPE_FROM_LEGACY[value]!;
  return DEFAULT_TYPE;
}

function parseMeasure(value: string | null | undefined): Measure {
  if (!value) return DEFAULT_MEASURE;
  // Legacy URL alias: ?measure=count → requests (the LiteLLM-shaped synonym).
  if (value === "count") return "requests";
  return (MEASURES as readonly string[]).includes(value)
    ? (value as Measure)
    : DEFAULT_MEASURE;
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
 * Inspect the raw URL params and decide whether a custom range deep link
 * was silently downgraded by `lensFromSearchParams` — i.e. preset=custom
 * was passed with missing / unparseable / out-of-bounds (>MAX_RANGE_DAYS)
 * dates. The view consumes this to fire the analytics.deepLinkRangeReset
 * one-shot toast (lens.ts doc-comment promise; analytics.md UX#10).
 *
 * Kept pure / server-safe so AnalyticsView (client) and any future SSR
 * inspection can call it.
 */
export function wasRangeReset(
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
): boolean {
  const get = (key: string) =>
    typeof (searchParams as URLSearchParams).get === "function"
      ? (searchParams as URLSearchParams).get(key)
      : null;
  if (get("range") !== "custom") return false;
  const fromRaw = get("from");
  const toRaw = get("to");
  if (!fromRaw || !toRaw) return true;
  const from = Date.parse(fromRaw);
  const to = Date.parse(toRaw);
  const valid = Number.isFinite(from) && Number.isFinite(to) && from <= to;
  if (!valid) return true;
  return to - from > MAX_RANGE_DAYS * DAY_MS;
}

/**
 * Parse the URL params honored by the lens. Unknown values fall back
 * silently (no crash, no toast — the user typed a deep link, we degrade).
 * The one exception is a custom range over MAX_RANGE_DAYS, which the view
 * component flags with a one-shot toast (analytics.md UX#10, i18n'd) —
 * detect via `wasRangeReset` above and surface the deepLinkRangeReset
 * i18n key.
 *
 * Backwards compat:
 *   - ?measure=count → "requests"
 *   - ?type=AGENT_RUN / ?type=TOOL_CALL → "agents"
 *   - ?type=WORKFLOW_RUN / ?type=CONTEXT_* / ?type=EMBEDDER_* → "all"
 *     (honest fallback per architect §HONEST GAP — buildTags emits no
 *     workflow_/context_/embedder_ prefix today)
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

  return {
    preset: effectivePreset,
    customFrom,
    customTo,
    type: parseLensType(get("type")),
    measure: parseMeasure(get("measure")),
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

/**
 * Canonical mapping from lens dimension → tag-prefix forwarded to the
 * backend /admin/litellm/tag-activity proxy. Encode this map twice — once
 * on the frontend (here) and once on the backend constant — so any drift
 * fails loudly rather than silently mis-attributing tag traffic.
 *
 * Prefix preference: use `_id_` forms for grouping (ids are stable across
 * renames; LiteLLM tag budgets already key off the id form per
 * budgetTagFor()). The `_name_` forms ride along but are redundant for
 * analytics — the frontend hydrates names via GraphQL using ids.
 */
export const DIMENSION_TAG_PREFIX: Record<Dimension, string> = {
  agents: "agent_id_",
  users: "user_id_",
  projects: "project_id_",
  teams: "team_id_",
  roles: "role_id_",
};

/**
 * Resolve the LensType to a tag_prefix for the backend's /admin/litellm/
 * tag-activity proxy. 'all' returns null (omit tag_prefix; global view).
 *
 * Lens.type and Lens.dimension can disagree (the type narrows totals; the
 * dimension drives the breakdown). When narrowing totals we use the type;
 * when computing the breakdown we use the dimension.
 */
export function tagPrefixForType(type: LensType): string | null {
  if (type === "all") return null;
  return DIMENSION_TAG_PREFIX[type];
}
