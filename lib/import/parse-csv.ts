import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  errors: string[];
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const data = result.data.filter((r) => Array.isArray(r));
  const headers = (data[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = data.slice(1).map((r) => r.map((v) => String(v ?? "")));
  const errors = result.errors.map(
    (e) => `${e.message}${typeof e.row === "number" ? ` (row ${e.row + 1})` : ""}`,
  );
  return { headers, rows, errors };
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  return parseCsvText(await file.text());
}
