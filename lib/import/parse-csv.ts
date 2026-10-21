import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  errors: string[];
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
  return { headers, rows, errors };
}

export function parseCsvText(text: string): ParsedCsv {
  return toParsedCsv(Papa.parse<string[]>(text, { skipEmptyLines: "greedy" }));
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  return parseCsvText(await file.text());
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

function scanLines(
  text: string,
  state: LineScanState,
): { completedLines: number; state: LineScanState } {
  let { inQuotes, lineHasContent } = state;
  let completedLines = 0;
  for (const c of text) {
    if (c === '"') {
      inQuotes = !inQuotes;
      lineHasContent = true;
    } else if (!inQuotes && c === "\r") {
      // Part of a CRLF terminator (or a stray CR); never content on its own.
    } else if (!inQuotes && c === "\n") {
      if (lineHasContent) completedLines += 1;
      lineHasContent = false;
    } else {
      lineHasContent = true;
    }
  }
  return { completedLines, state: { inQuotes, lineHasContent } };
}

/**
 * Counts data rows (header excluded) in a CSV file without loading it into
 * memory at once: reads 1 MB chunks via `file.slice()`, carrying quote state
 * across chunk boundaries so a quoted field (and any newline inside it)
 * spanning two chunks is still scanned correctly.
 */
export async function countCsvRows(file: Blob): Promise<number> {
  let state: LineScanState = { inQuotes: false, lineHasContent: false };
  let totalLines = 0;
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    const chunkText = await file.slice(offset, offset + CHUNK_BYTES).text();
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
 * 1 MB chunks via `file.slice()` until that many complete (newline-
 * terminated) rows past the header are available, or EOF is reached,
 * then hands the accumulated text to Papa.parse with a matching preview
 * limit. Because `scanLines` only counts a row once its terminator has
 * been seen, a row split across a chunk boundary is never counted early —
 * another chunk is read instead of yielding a truncated sample row.
 */
export async function peekCsvFile(
  file: Blob,
  sampleRows: number,
): Promise<ParsedCsv> {
  const needed = sampleRows + 1; // header + sample data rows
  let state: LineScanState = { inQuotes: false, lineHasContent: false };
  let totalLines = 0;
  let text = "";
  for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
    const chunkText = await file.slice(offset, offset + CHUNK_BYTES).text();
    text += chunkText;
    const scanned = scanLines(chunkText, state);
    totalLines += scanned.completedLines;
    state = scanned.state;
    if (totalLines >= needed) break;
  }
  return toParsedCsv(
    Papa.parse<string[]>(text, { skipEmptyLines: "greedy", preview: needed }),
  );
}
