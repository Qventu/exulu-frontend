import type { ImportRow } from "@/lib/import/types";

export interface ExistingRefs {
  /** external_id → item id, from the server lookup. */
  byExternalId: Map<string, string>;
  /** Item ids confirmed to exist. */
  knownIds: Set<string>;
}

/**
 * Pure classification: id column > external_id match > create. Always resets
 * previous classification so it can safely re-run after grid edits.
 */
export function classifyRows(rows: ImportRow[], existing: ExistingRefs): ImportRow[] {
  const seenIds = new Set<string>();
  const seenExternal = new Set<string>();
  return rows.map((row) => {
    const next: ImportRow = { ...row, action: "create", targetItemId: undefined, error: undefined };
    const id = typeof row.cells.id?.value === "string" ? row.cells.id.value : "";
    const ext =
      typeof row.cells.external_id?.value === "string" ? row.cells.external_id.value : "";
    if (id) {
      if (seenIds.has(id)) {
        return { ...next, error: { code: "duplicateKey", params: { field: "id" } } };
      }
      seenIds.add(id);
      if (!existing.knownIds.has(id)) return { ...next, error: { code: "idNotFound" } };
      return { ...next, action: "update", targetItemId: id };
    }
    if (ext) {
      if (seenExternal.has(ext)) {
        return { ...next, error: { code: "duplicateKey", params: { field: "external_id" } } };
      }
      seenExternal.add(ext);
      const target = existing.byExternalId.get(ext);
      if (target) return { ...next, action: "update", targetItemId: target };
    }
    return next;
  });
}
