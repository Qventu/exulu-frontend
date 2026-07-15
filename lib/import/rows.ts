import { coerceValue } from "@/lib/import/coerce";
import type { FileIndex } from "@/lib/import/match-files";
import { findFile } from "@/lib/import/match-files";
import type { ColumnMapping } from "@/lib/import/map-columns";
import type { ParsedCsv } from "@/lib/import/parse-csv";
import type { ImportCell, ImportField, ImportRow } from "@/lib/import/types";

function stripExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/** One create-row per dropped file, file landing in `targetFieldName`. */
export function rowsFromFiles(
  files: File[],
  targetFieldName: string,
  keyPrefix = "file",
): ImportRow[] {
  return files.map((file, i) => ({
    key: `${keyPrefix}-${i}-${file.name}`,
    action: "create" as const,
    runState: "pending" as const,
    cells: {
      name: { raw: stripExtension(file.name), value: stripExtension(file.name) },
      [targetFieldName]: { raw: file.name, value: file.name, file },
    },
  }));
}

/** One row per CSV data row; only mapped columns become cells. */
export function rowsFromCsv(
  parsed: ParsedCsv,
  mapping: ColumnMapping[],
  fields: ImportField[],
  fileIndex: FileIndex,
): ImportRow[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  return parsed.rows.map((raw, i) => {
    const cells: Record<string, ImportCell> = {};
    for (const m of mapping) {
      if (!m.fieldName) continue;
      const field = byName.get(m.fieldName);
      if (!field) continue;
      const cell = coerceValue(field, raw[m.index] ?? "");
      if (field.type === "file" && typeof cell.value === "string" && cell.value !== "") {
        const file = findFile(fileIndex, cell.value);
        if (file) cell.file = file;
        else cell.error = { code: "fileMissing", params: { name: cell.value } };
      }
      cells[m.fieldName] = cell;
    }
    return { key: `csv-${i}`, action: "create" as const, runState: "pending" as const, cells };
  });
}

const isEmpty = (cell: ImportCell | undefined) =>
  !cell || ((cell.value === null || cell.value === "") && !cell.file);

/** Required + allowedFileTypes checks; returns a new row, cells replaced. */
export function validateRow(row: ImportRow, fields: ImportField[]): ImportRow {
  const cells = { ...row.cells };
  for (const f of fields) {
    const cell = cells[f.name];
    if (f.required) {
      const mustHaveValue = row.action === "create" || cell !== undefined;
      if (mustHaveValue && isEmpty(cell)) {
        cells[f.name] = {
          raw: cell?.raw ?? "",
          value: cell?.value ?? null,
          file: cell?.file,
          error: { code: "required", params: { field: f.label } },
        };
        continue;
      }
      if (cell?.error?.code === "required" && !isEmpty(cell)) {
        cells[f.name] = { raw: cell.raw, value: cell.value, file: cell.file };
      }
    }
    if (f.type === "file" && f.allowedFileTypes?.length && cell?.file) {
      const ok = f.allowedFileTypes.some((ext) =>
        cell.file!.name.toLowerCase().endsWith(ext.toLowerCase()),
      );
      if (!ok) {
        cells[f.name] = {
          ...cell,
          error: { code: "fileType", params: { values: f.allowedFileTypes.join(", ") } },
        };
      }
    }
  }
  return { ...row, cells };
}

export function rowIsValid(row: ImportRow): boolean {
  if (row.error) return false;
  return Object.values(row.cells).every((c) => !c.error);
}

/** Create-mutation input, mirroring new-item-dialog.tsx but source "import". */
export function buildCreateInput(row: ImportRow, fields: ImportField[]): Record<string, unknown> {
  const description =
    typeof row.cells.description?.value === "string" ? row.cells.description.value : "";
  const input: Record<string, unknown> = {
    name: row.cells.name?.value ?? "",
    description,
    external_id: (row.cells.external_id?.value as string) || null,
    tags: typeof row.cells.tags?.value === "string" ? row.cells.tags.value : "",
    source: "import",
    textlength: description.length,
  };
  for (const f of fields) {
    if (f.core) continue;
    const cell = row.cells[f.name];
    if (cell === undefined) continue;
    input[f.name] = cell.value;
  }
  return input;
}

/** Partial update input: only mapped/filled cells; id and source never sent. */
export function buildUpdateInput(row: ImportRow, fields: ImportField[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.name === "id") continue;
    const cell = row.cells[f.name];
    if (cell === undefined) continue;
    input[f.name] = cell.value;
  }
  if (typeof input.description === "string") {
    input.textlength = input.description.length;
  }
  return input;
}
