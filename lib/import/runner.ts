import { buildCreateInput, buildUpdateInput, rowIsValid } from "@/lib/import/rows";
import type { ImportField, ImportRow, RowRunState } from "@/lib/import/types";

export interface RunnerEffects {
  /** Uploads one file, resolves to the s3key to store in the file field. */
  uploadFile: (file: File) => Promise<string>;
  createItem: (input: Record<string, unknown>) => Promise<void>;
  updateItem: (id: string, input: Record<string, unknown>) => Promise<void>;
}

export interface RunOptions {
  concurrency?: number;
  isCancelled?: () => boolean;
  onRowState: (key: string, state: RowRunState, error?: string) => void;
}

export interface RunSummary {
  created: number;
  updated: number;
  failed: number;
  skipped: number;
}

/**
 * Client-side execution: per row upload file cells then fire the mutation.
 * Mutates row.runState and file-cell values in place; a second call skips
 * done rows, which is what "retry failed rows" relies on. A row failure
 * never halts the batch; cancel stops issuing rows, in-flight rows finish.
 */
export async function runImport(
  rows: ImportRow[],
  fields: ImportField[],
  effects: RunnerEffects,
  options: RunOptions,
): Promise<RunSummary> {
  const queue = rows.filter((r) => rowIsValid(r) && r.runState !== "done");
  const summary: RunSummary = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: rows.length - queue.length,
  };
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      if (options.isCancelled?.()) return;
      const row = queue[cursor++];
      if (!row) return;
      try {
        const fileCells = Object.values(row.cells).filter((c) => c.file);
        if (fileCells.length > 0) {
          row.runState = "uploading";
          options.onRowState(row.key, "uploading");
          for (const cell of fileCells) {
            cell.value = await effects.uploadFile(cell.file as File);
            // Uploaded — drop the File so a retry doesn't re-upload it.
            cell.file = undefined;
          }
        }
        row.runState = "saving";
        options.onRowState(row.key, "saving");
        if (row.action === "update" && row.targetItemId) {
          await effects.updateItem(row.targetItemId, buildUpdateInput(row, fields));
          summary.updated += 1;
        } else {
          await effects.createItem(buildCreateInput(row, fields));
          summary.created += 1;
        }
        row.runState = "done";
        options.onRowState(row.key, "done");
      } catch (e) {
        summary.failed += 1;
        row.runState = "failed";
        row.runError = e instanceof Error ? e.message : String(e);
        options.onRowState(row.key, "failed", row.runError);
      }
    }
  };

  const n = Math.max(1, Math.min(options.concurrency ?? 4, queue.length || 1));
  await Promise.all(Array.from({ length: n }, worker));
  return summary;
}
