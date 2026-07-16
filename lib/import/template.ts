import type { ImportField, ImportRow } from "@/lib/import/types";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exampleValueFor(field: ImportField): string {
  if (field.name === "id") return "";
  if (field.name === "external_id") return "example-id-123";
  if (field.name === "name") return "Example item";
  if (field.name === "description") return "Example description";
  if (field.name === "tags") return "tag1,tag2";
  switch (field.type) {
    case "number":
      return "1.5";
    case "boolean":
      return "true";
    case "enum":
      return field.enumValues?.[0] ?? "";
    case "date":
      return "2026-07-16";
    case "json":
      return "{}";
    case "file":
    case "uuid":
      return "";
    default:
      return "Example text";
  }
}

/** Header row + one example row showing what each column expects. */
export function buildCsvTemplate(fields: ImportField[]): string {
  const header = fields.map((f) => csvEscape(f.label)).join(",");
  const example = fields.map((f) => csvEscape(exampleValueFor(f))).join(",");
  return `${header}\n${example}\n`;
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
      ...fields.map((f) => {
        const cell = row.cells[f.name];
        if (
          f.type === "file" &&
          cell &&
          !cell.file &&
          typeof cell.value === "string" &&
          cell.value !== ""
        ) {
          return csvEscape(cell.value);
        }
        return csvEscape(cell?.raw ?? "");
      }),
      csvEscape(errorFor(row)),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
