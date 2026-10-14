/**
 * Keeps the demo's timestamps recent.
 *
 * The fixtures were captured around 2026-08-27 and every relative date on
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
 * and would otherwise land weeks in the future.
 */
export const DEMO_EPOCH = "2026-08-27T09:00:00.000Z";

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

export function shiftTimestamp(value: string, offsetMs: number): string {
  const m = STAMP.exec(value);
  if (!m) return value;
  const [, day, time, fraction = "", zone] = m;
  const ms = fraction ? fraction.slice(1, 4).padEnd(3, "0") : "000";
  const parsed = Date.parse(`${day}T${time}.${ms}${normaliseZone(zone)}`);
  if (Number.isNaN(parsed) || parsed === 0 || parsed >= CUTOFF_MS) return value;
  return new Date(parsed + offsetMs).toISOString();
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
