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
 * LensType is retired — the legacy "scope" axis collapsed into `dimension`
 * (analytics is global by default; the dimension drives the breakdown).
 * URL backwards-compat for legacy ?type=AGENT_RUN / ?type=USER_BUDGET deep
 * links is preserved below: ?type is read on parse and translated to a
 * `dimension` override; lensToSearchParams NEVER emits ?type so any
 * round-trip canonicalises the URL on first render (router.replace in
 * AnalyticsView).
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

/** Max days a custom range may span (matches legacy DateRangeSelector). */
export const MAX_RANGE_DAYS = 30;
export const DEFAULT_PRESET: RangePreset = "14d";
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
 * Legacy ?type=* → `dimension` override. Honored verbatim for deep links;
 * anything not in the map degrades silently to no override (the
 * DEFAULT_DIMENSION applies). Same fall-back contract the rest of the
 * parser uses — no toast, no crash.
 *
 * HONEST FALLBACK for WORKFLOW_RUN / CONTEXT_* / EMBEDDER_* / SOURCE_UPDATE:
 * buildTags() emits no workflow_/routine_/context_/embedder_ prefix today,
 * so the only honest move is to drop the override and let the default
 * Agents dimension apply. AnalyticsView still fires a one-shot toast so
 * the deep-link change is visible.
 */
const LEGACY_TYPE_TO_DIMENSION: Record<string, Dimension | undefined> = {
  AGENT_RUN: "agents",
  TOOL_CALL: "agents",
  USER_BUDGET: "users",
  PROJECT_BUDGET: "projects",
  TEAM_BUDGET: "teams",
  ROLE_BUDGET: "roles",
  // Honest drop — no prefix exists in buildTags() yet:
  WORKFLOW_RUN: undefined,
  CONTEXT_RETRIEVE: undefined,
  CONTEXT_UPSERT: undefined,
  SOURCE_UPDATE: undefined,
  EMBEDDER_GENERATE: undefined,
  EMBEDDER_UPSERT: undefined,
  EMBEDDER_DELETE: undefined,
};

function parseDimensionFromLegacyType(
  value: string | null | undefined,
): Dimension | null {
  if (!value) return null;
  // ?type=agents / ?type=users / … (lowercase dimension values — older URLs
  // already emit these per the previous LENS_TYPES set).
  if ((DIMENSIONS as readonly string[]).includes(value)) return value as Dimension;
  // Legacy STATISTICS_TYPE.
  if (value in LEGACY_TYPE_TO_DIMENSION) {
    return LEGACY_TYPE_TO_DIMENSION[value] ?? null;
  }
  return null;
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
 *   - ?type=AGENT_RUN / ?type=TOOL_CALL → dimension="agents"
 *   - ?type=USER_BUDGET → dimension="users"
 *   - ?type=PROJECT_BUDGET → dimension="projects"
 *   - ?type=TEAM_BUDGET → dimension="teams"
 *   - ?type=ROLE_BUDGET → dimension="roles"
 *   - ?type=WORKFLOW_RUN / CONTEXT_* / EMBEDDER_* / SOURCE_UPDATE → dropped
 *     (no override; honest fallback per architect §HONEST GAP). The view
 *     still fires a one-shot toast so the change is visible.
 *   - ?type=agents / users / projects / teams / roles (old canonical) →
 *     dimension override of the same value.
 *   - An explicit ?dimension=… ALWAYS wins over the legacy ?type seed.
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

  // Dimension precedence: explicit ?dimension= wins; otherwise fall back to
  // the legacy ?type= seed; otherwise DEFAULT_DIMENSION.
  const dimensionRaw = get("dimension");
  const explicitDimension =
    dimensionRaw && (DIMENSIONS as readonly string[]).includes(dimensionRaw)
      ? (dimensionRaw as Dimension)
      : null;
  const legacyDimension = parseDimensionFromLegacyType(get("type"));
  const dimension: Dimension =
    explicitDimension ?? legacyDimension ?? DEFAULT_DIMENSION;

  return {
    preset: effectivePreset,
    customFrom,
    customTo,
    measure: parseMeasure(get("measure")),
    dimension,
    view: narrow<BreakdownView>(get("view"), BREAKDOWN_VIEWS, DEFAULT_VIEW),
  };
}

/**
 * Serialize the lens back to a stable query-string (sorted keys). Never
 * emits ?type — the legacy param is read-only (see lensFromSearchParams).
 * Any roundtrip canonicalises the URL on first render via router.replace.
 */
export function lensToSearchParams(lens: Lens): string {
  const params = new URLSearchParams();
  if (lens.preset !== DEFAULT_PRESET) params.set("range", lens.preset);
  if (lens.preset === "custom" && lens.customFrom && lens.customTo) {
    params.set("from", lens.customFrom);
    params.set("to", lens.customTo);
  }
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
 * Canonical dedupe tag prefix sent to /tag-activity for totals + daily
 * queries. We always slice on user_id_ so the backend can collapse the
 * double-tag duplication (each Exulu call double-tags itself per dimension
 * — id + name — and the slice prevents counting both halves). The
 * breakdown card uses DIMENSION_TAG_PREFIX[lens.dimension] instead.
 */
export const CANONICAL_DEDUPE_TAG_PREFIX = "user_id_";
