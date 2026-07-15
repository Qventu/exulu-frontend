import type { ImportField, ImportRow } from "@/lib/import/types";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Header-only CSV template using human labels (mapping matches labels too). */
export function buildCsvTemplate(fields: ImportField[]): string {
  return fields.map((f) => csvEscape(f.label)).join(",") + "\n";
}

/**
 * Failed rows as a re-importable CSV: raw values in template column order
 * plus a trailing translated `error` column.
 */
export function buildErrorReportCsv(
  rows: ImportRow[],
  fields: ImportField[],
  errorFor: (row: ImportRow) => string,
): string {
  const failed = rows.filter(
    (r) =>
      r.runState === "failed" ||
      r.error ||
      Object.values(r.cells).some((c) => c.error),
  );
  const header = [...fields.map((f) => csvEscape(f.label)), "error"].join(",");
  const lines = failed.map((row) =>
    [
      ...fields.map((f) => csvEscape(row.cells[f.name]?.raw ?? "")),
      csvEscape(errorFor(row)),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
