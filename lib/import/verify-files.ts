import type { ImportField, ImportRow } from "@/lib/import/types";

/** Unique storage keys referenced by file cells (CSV flow — no attached File). */
export function fileKeysOf(rows: ImportRow[], fields: ImportField[]): string[] {
  const fileFieldNames = new Set(
    fields.filter((f) => f.type === "file").map((f) => f.name),
  );
  const keys = new Set<string>();
  for (const row of rows) {
    for (const [name, cell] of Object.entries(row.cells)) {
      if (!fileFieldNames.has(name) || cell.file) continue;
      if (typeof cell.value === "string" && cell.value !== "")
        keys.add(cell.value);
    }
  }
  return [...keys];
}

/**
 * Concurrency-capped existence check with an injectable probe. A probe
 * failure counts as missing — the user sees "not found in storage" rather
 * than importing a broken reference.
 */
export async function findMissingFileKeys(
  keys: string[],
  exists: (key: string) => Promise<boolean>,
  concurrency = 5,
): Promise<Set<string>> {
  const unique = [...new Set(keys)];
  const missing = new Set<string>();
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const key = unique[cursor++];
      if (!key) return;
      try {
        if (!(await exists(key))) missing.add(key);
      } catch {
        missing.add(key);
      }
    }
  };
  const n = Math.max(1, Math.min(concurrency, unique.length || 1));
  await Promise.all(Array.from({ length: n }, worker));
  return missing;
}

/** Set fileNotFound errors on missing keys; clear stale ones on found keys. */
export function applyMissingFileErrors(
  rows: ImportRow[],
  fields: ImportField[],
  missing: Set<string>,
): ImportRow[] {
  const fileFieldNames = new Set(
    fields.filter((f) => f.type === "file").map((f) => f.name),
  );
  return rows.map((row) => {
    let changed = false;
    const cells = { ...row.cells };
    for (const [name, cell] of Object.entries(cells)) {
      if (!fileFieldNames.has(name) || cell.file) continue;
      if (typeof cell.value !== "string" || cell.value === "") continue;
      if (missing.has(cell.value)) {
        cells[name] = { ...cell, error: { code: "fileNotFound" } };
        changed = true;
      } else if (cell.error?.code === "fileNotFound") {
        cells[name] = { raw: cell.raw, value: cell.value };
        changed = true;
      }
    }
    return changed ? { ...row, cells } : row;
  });
}
