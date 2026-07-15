import type { ImportField } from "@/lib/import/types";

/** Lowercase, trim, and unify space/dash separators to underscores. */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export interface ColumnMapping {
  header: string;
  index: number;
  fieldName: string | null;
}

/** Best-effort header → field auto-match; unmatched columns map to null. */
export function autoMapColumns(
  headers: string[],
  fields: ImportField[],
): ColumnMapping[] {
  const used = new Set<string>();
  return headers.map((header, index) => {
    const n = normalizeHeader(header);
    const match = fields.find(
      (f) =>
        !used.has(f.name) &&
        (normalizeHeader(f.name) === n || normalizeHeader(f.label) === n),
    );
    if (!match) return { header, index, fieldName: null };
    used.add(match.name);
    return { header, index, fieldName: match.name };
  });
}
