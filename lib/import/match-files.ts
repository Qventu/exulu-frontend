import type { ImportRow } from "@/lib/import/types";

/** Basename (either separator style), trimmed and lowercased. */
export function fileMatchKey(value: string): string {
  const base = value.split(/[\\/]/).pop() ?? value;
  return base.trim().toLowerCase();
}

export interface FileIndex {
  byName: Map<string, File>;
  duplicateNames: string[];
}

/** First file wins on name collisions; later duplicates are reported. */
export function indexFiles(files: File[]): FileIndex {
  const byName = new Map<string, File>();
  const duplicateNames: string[] = [];
  for (const file of files) {
    const key = fileMatchKey(file.name);
    if (byName.has(key)) duplicateNames.push(file.name);
    else byName.set(key, file);
  }
  return { byName, duplicateNames };
}

export function findFile(
  index: FileIndex,
  cellValue: string,
): File | undefined {
  return index.byName.get(fileMatchKey(cellValue));
}

/** Dropped files not referenced by any row's file cell. */
export function leftoverFiles(files: File[], rows: ImportRow[]): File[] {
  const used = new Set<File>();
  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      if (cell.file) used.add(cell.file);
    }
  }
  return files.filter((file) => !used.has(file));
}
