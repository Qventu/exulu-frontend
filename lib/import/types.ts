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
export type RowRunState = "pending" | "uploading" | "saving" | "done" | "failed";

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
