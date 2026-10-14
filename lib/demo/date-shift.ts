/**
 * Keeps the demo's timestamps recent.
 *
 * The fixtures were captured up to midday 2026-08-28 (the epoch sits just
 * past the latest stamp — fixture-dates.test.ts pins that) and every relative date on
 * screen ("vor 7 Monaten", "letzten Monat", "jetzt") drifts as the demo
 * outlives them. The demo link shifts every timestamp it returns by the
 * distance between that capture day and now, so the story stays internally
 * consistent: documents a few days old, a chat from last week, a memory
 * written just now.
 *
 * Handles the three formats the fixtures use: ISO with Z, ISO with a numeric
 * offset and six-digit fraction, and Postgres "YYYY-MM-DD HH:MM:SS.ffffff+00".
 * Output is always ISO with Z. Two things are deliberately NOT shifted: the
 * epoch sentinel (resolvers.ts uses new Date(0) for "unknown"), and anything
 * already within two days of the capture day or later — a resolver that
 * stamps `new Date()` (chapter-memory.ts, the correction) is already "now"
 * and would otherwise land weeks in the future. A stamp from later on the
 * capture day than now's time of day is clamped to a minute before now.
 */
export const DEMO_EPOCH = "2026-08-28T12:00:00.000Z";

const EPOCH_MS = Date.parse(DEMO_EPOCH);
const CUTOFF_MS = EPOCH_MS + 2 * 86_400_000;

const STAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,6})?(Z|[+-]\d{2}(?::?\d{2})?)$/;

export function demoDateOffsetMs(now: number = Date.now()): number {
  return now - EPOCH_MS;
}

function normaliseZone(zone: string): string {
  if (zone === "Z") return "Z";
  if (zone.length === 3) return `${zone}:00`;
  if (zone.includes(":")) return zone;
  return `${zone.slice(0, 3)}:${zone.slice(3)}`;
}

/** Milliseconds for a fixture timestamp in any of the three formats, or null. */
export function parseTimestamp(value: string): number | null {
  const m = STAMP.exec(value);
  if (!m) return null;
  const [, day, time, fraction = "", zone] = m;
  const ms = fraction ? fraction.slice(1, 4).padEnd(3, "0") : "000";
  const parsed = Date.parse(`${day}T${time}.${ms}${normaliseZone(zone)}`);
  return Number.isNaN(parsed) ? null : parsed;
}

export function shiftTimestamp(value: string, offsetMs: number): string {
  const parsed = parseTimestamp(value);
  if (parsed === null || parsed === 0 || parsed >= CUTOFF_MS) return value;
  // offset = now − epoch, so a stamp from later on the capture day would land
  // later than now ("in 23 Std." on the transcripts list). Nothing in the
  // demo's past may read as future: clamp to a minute before now, which is
  // epoch + offset.
  const nowMs = EPOCH_MS + offsetMs;
  return new Date(Math.min(parsed + offsetMs, nowMs - 60_000)).toISOString();
}

export function shiftDemoDates<T>(value: T, offsetMs: number): T {
  if (typeof value === "string") return shiftTimestamp(value, offsetMs) as T;
  if (Array.isArray(value)) return value.map((v) => shiftDemoDates(v, offsetMs)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = shiftDemoDates(v, offsetMs);
    return out as T;
  }
  return value;
}
