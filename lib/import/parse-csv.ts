import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  errors: string[];
  /**
   * The delimiter papaparse detected (`meta.delimiter`). A server-side import
   * passes it to the worker in `options.delimiter` so the uploaded file is
   * parsed exactly the way the browser parsed this sample.
   */
  delimiter?: string;
}

/** Bytes read per `file.slice()` chunk by the streaming helpers below. */
const CHUNK_BYTES = 1024 * 1024;

function toParsedCsv(result: Papa.ParseResult<string[]>): ParsedCsv {
  const data = result.data.filter((r) => Array.isArray(r));
  const headers = (data[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = data.slice(1).map((r) => r.map((v) => String(v ?? "")));
  const errors = result.errors.map(
    (e) =>
      `${e.message}${typeof e.row === "number" ? ` (row ${e.row + 1})` : ""}`,
  );
  return { headers, rows, errors, delimiter: result.meta?.delimiter };
}

export function parseCsvText(text: string): ParsedCsv {
  return toParsedCsv(Papa.parse<string[]>(text, { skipEmptyLines: "greedy" }));
}

/**
 * RFC 4180-aware line scanner used by `countCsvRows` and `peekCsvFile` to
 * find row boundaries without buffering (or re-parsing) the whole file.
 *
 * A quote toggles the in-quotes state (a doubled quote inside quotes nets
 * back to the same state, correctly treating it as an escaped literal
 * quote). A newline is only a row boundary outside quotes; a bare `\r` is
 * swallowed rather than treated as its own boundary, so both `\r\n` and
 * `\n` are accepted. Blank lines (no content before the newline) are not
 * counted. State carries across chunks so a row split at a chunk boundary
 * is still scanned correctly.
 */
interface LineScanState {
  inQuotes: boolean;
  lineHasContent: boolean;
}

interface LineScanResult {
  completedLines: number;
  /**
   * Offset into the scanned chunk just past the last unquoted-newline
   * boundary found in this chunk, or -1 if this chunk contains none. Used
   * by `peekCsvFile` to trim a buffer back to the last safe cut point.
   */
  lastBoundaryOffset: number;
  state: LineScanState;
}

function scanLines(text: string, state: LineScanState): LineScanResult {
  let { inQuotes, lineHasContent } = state;
  let completedLines = 0;
  let lastBoundaryOffset = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      lineHasContent = true;
    } else if (!inQuotes && c === "\r") {
      // Part of a CRLF terminator (or a stray CR); never content on its own.
    } else if (!inQuotes && c === "\n") {
      if (lineHasContent) completedLines += 1;
      lineHasContent = false;
      lastBoundaryOffset = i + 1;
    } else {
      lineHasContent = true;
    }
  }
  return {
    completedLines,
    lastBoundaryOffset,
    state: { inQuotes, lineHasContent },
  };
}

/**
 * Counts data rows (header excluded) in a CSV file without loading it into
 * memory at once: reads `chunkBytes`-sized chunks via `file.slice()`,
 * carrying quote state across chunk boundaries so a quoted field (and any
 * newline inside it) spanning two chunks is still scanned correctly.
 * `chunkBytes` defaults to 1 MB; callers only override it in tests, to
 * force a boundary at an exact byte offset.
 */
export async function countCsvRows(
  file: Blob,
  chunkBytes = CHUNK_BYTES,
): Promise<number> {
  let state: LineScanState = { inQuotes: false, lineHasContent: false };
  let totalLines = 0;
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    const chunkText = await file.slice(offset, offset + chunkBytes).text();
    const scanned = scanLines(chunkText, state);
    totalLines += scanned.completedLines;
    state = scanned.state;
  }
  // A final row with content but no trailing newline still counts.
  if (state.lineHasContent) totalLines += 1;
  return Math.max(0, totalLines - 1);
}

/**
 * Reads just enough of a CSV file to sample `sampleRows` data rows: pulls
 * `chunkBytes`-sized chunks via `file.slice()` (default 1 MB; callers only
 * override it in tests) until that many complete (newline-terminated) rows
 * past the header are available, or EOF is reached. Because `scanLines`
 * only counts a row once its terminator has been seen, a row split across
 * a chunk boundary is never counted early — another chunk is read instead
 * of yielding a truncated sample row.
 *
 * The accumulated buffer is parsed WITHOUT Papa's `preview` option — preview
 * counts raw lines, including blank ones, which undercounts data rows when
 * a blank line sits inside the sample window. Instead: if the loop stopped
 * before EOF, the buffer is trimmed back to the last complete line boundary
 * (so any trailing partial row is never parsed as data) before parsing;
 * at EOF the whole buffer is parsed as-is. The result is then sliced to
 * exactly `sampleRows` rows.
 */
export async function peekCsvFile(
  file: Blob,
  sampleRows: number,
  chunkBytes = CHUNK_BYTES,
): Promise<ParsedCsv> {
  const needed = sampleRows + 1; // header + sample data rows
  let state: LineScanState = { inQuotes: false, lineHasContent: false };
  let totalLines = 0;
  let text = "";
  let lastBoundary = 0;
  let brokeEarly = false;
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    const chunkStart = text.length;
    const chunkText = await file.slice(offset, offset + chunkBytes).text();
    text += chunkText;
    const scanned = scanLines(chunkText, state);
    totalLines += scanned.completedLines;
    state = scanned.state;
    if (scanned.lastBoundaryOffset !== -1) {
      lastBoundary = chunkStart + scanned.lastBoundaryOffset;
    }
    if (totalLines >= needed) {
      brokeEarly = true;
      break;
    }
  }
  const buffer = brokeEarly ? text.slice(0, lastBoundary) : text;
  const parsed = toParsedCsv(
    Papa.parse<string[]>(buffer, { skipEmptyLines: "greedy" }),
  );
  return { ...parsed, rows: parsed.rows.slice(0, sampleRows) };
}
