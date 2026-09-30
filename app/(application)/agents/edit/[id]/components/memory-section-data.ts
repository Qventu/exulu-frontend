/**
 * memory-section-data.ts — pure helpers for the Workbench memory section.
 *
 * `normalizeMemoryConfig` re-implements the backend's `resolveMemoryConfig`
 * (src/exulu/memory/config.ts, Task 1) client-side: same defaults, same
 * clamp (1..50), same tolerant string/object parsing. Keep both in sync.
 *
 * `sortContextsForPicker` orders the memory-base picker: valid bases already
 * used by another agent first, then other valid bases, then invalid ones
 * (missing the `information`/`type` fields) — disabled, not selectable.
 */

export type MemoryConfig = {
  retrieval: { enabled: boolean; limit: number };
  visibility: "ask" | "preselect_private";
  guests: { showRecalled: boolean };
};

export const MEMORY_LIMIT_MIN = 1;
export const MEMORY_LIMIT_MAX = 50;

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  retrieval: { enabled: true, limit: 10 },
  visibility: "ask",
  guests: { showRecalled: false },
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Same rules as backend src/exulu/memory/config.ts resolveMemoryConfig. */
export function normalizeMemoryConfig(raw: unknown): MemoryConfig {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = undefined;
    }
  }
  if (!isRecord(value)) return structuredClone(DEFAULT_MEMORY_CONFIG);
  const retrieval = isRecord(value.retrieval) ? value.retrieval : {};
  const guests = isRecord(value.guests) ? value.guests : {};
  const n = Number(retrieval.limit);
  return {
    retrieval: {
      enabled: typeof retrieval.enabled === "boolean" ? retrieval.enabled : true,
      limit: Number.isFinite(n) ? Math.min(MEMORY_LIMIT_MAX, Math.max(MEMORY_LIMIT_MIN, Math.round(n))) : 10,
    },
    visibility: value.visibility === "preselect_private" ? "preselect_private" : "ask",
    guests: { showRecalled: typeof guests.showRecalled === "boolean" ? guests.showRecalled : false },
  };
}

export type PickerContext = {
  id: string;
  name: string;
  description?: string | null;
  memoryBase?: { ok: boolean; missing: string[] } | null;
};
export type PickerEntry = PickerContext & { disabled: boolean; missing: string[]; usedBy: string[] };

/** Valid bases used by other agents first, then valid, then invalid (disabled). */
export function sortContextsForPicker(
  contexts: PickerContext[],
  usedBy: Record<string, string[]>,
): PickerEntry[] {
  const entries = contexts.map<PickerEntry>((c) => ({
    ...c,
    disabled: !(c.memoryBase?.ok ?? false),
    missing: c.memoryBase?.missing ?? ["information", "type"],
    usedBy: usedBy[c.id] ?? [],
  }));
  const rank = (e: PickerEntry) => (e.disabled ? 2 : e.usedBy.length > 0 ? 0 : 1);
  return entries.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
