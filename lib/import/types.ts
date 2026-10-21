import type { ParsedCsv } from "@/lib/import/parse-csv";

/** One importable column: a core item field or a context custom field. */
export interface ImportField {
  /** GraphQL input key, e.g. "name" or "document_s3key". */
  name: string;
  /** Human label used in CSV templates, mapping and grid headers. */
  label: string;
  /** ExuluFieldTypes plus backend-only "date"/"uuid" — kept as string. */
  type: string;
  required: boolean;
  core: boolean;
  enumValues?: string[];
  allowedFileTypes?: string[];
}

export type CellValue = string | number | boolean | null;

/** i18n-translatable error: code resolves to knowledge.workspace.import.errors.<code>. */
export interface CellError {
  code: string;
  params?: Record<string, string>;
}

export interface ImportCell {
  /** Original text (CSV cell / grid input) for display and error reports. */
  raw: string;
  /** Coerced value ready for the mutation input. */
  value: CellValue;
  error?: CellError;
  /** File cells: the matched local file, uploaded at run time. */
  file?: File;
}

export type RowAction = "create" | "update";
export type RowRunState =
  | "pending"
  | "uploading"
  | "saving"
  | "done"
  | "failed";

export interface ImportRow {
  /** Stable per-batch key, e.g. "csv-3" or "file-0-report.pdf". */
  key: string;
  cells: Record<string, ImportCell>;
  action: RowAction;
  /** Item id this row updates (set by classifyRows). */
  targetItemId?: string;
  /** Row-level error (duplicate key, unknown id). */
  error?: CellError;
  runState: RowRunState;
  runError?: string;
}

/**
 * Batch-level access chosen in the import wizard. Applied to CREATED rows
 * only — update rows keep their existing access (spec decision #2).
 */
export interface BatchAccess {
  rights_mode: "private" | "users" | "roles" | "teams" | "public";
  users: { id: number; rights: "read" | "write" }[];
  roles: { id: string; rights: "read" | "write" }[];
  teams: { id: string; rights: "read" | "write" }[];
}

/**
 * The CSV the wizard is working on. `parsed` is a SAMPLE (the first
 * `IMPORT_SAMPLE_ROWS` rows) — complete for a client-mode file, a preview
 * for a server-mode one — while `totalRows` and `bytes` describe the whole
 * file and are what `decideImportMode` runs on. `file` is kept because a
 * server-side import uploads it untouched.
 */
export interface ImportCsvSource {
  name: string;
  parsed: ParsedCsv;
  file: File;
  /** Data rows in the whole file (header excluded), from `countCsvRows`. */
  totalRows: number;
  bytes: number;
  /** Detected delimiter, forwarded to the worker in `options.delimiter`. */
  delimiter?: string;
}
