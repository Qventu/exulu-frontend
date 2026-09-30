/**
 * summariseEmbedderChange — pure derivation of what an embedder change
 * destroys, so `EmbedderChangeDialog` can state it plainly before the admin
 * confirms (context-embedder-settings plan, Task 7). The chunks table bakes
 * the vector dimension into its column: a different dimensionality means
 * the table is rebuilt, any other model change just empties it, and either
 * way every embedding must be regenerated.
 */

export type ChangeSummary = {
  action: "create" | "truncate" | "recreate" | "cleared";
  chunksDeleted: number;
  willRunInline: boolean;
};

export function summariseEmbedderChange(args: {
  nextModel: string | null;
  nextDimensionality: number | null;
  currentDimensionality: number | null;
  chunkCount: number;
  queue: string | null;
}): ChangeSummary {
  const { nextModel, nextDimensionality, currentDimensionality, chunkCount, queue } = args;
  if (!nextModel) return { action: "cleared", chunksDeleted: chunkCount, willRunInline: false };
  const action =
    chunkCount === 0 && currentDimensionality === null
      ? "create"
      : currentDimensionality !== null && currentDimensionality === nextDimensionality
        ? "truncate"
        : "recreate";
  return { action, chunksDeleted: chunkCount, willRunInline: !queue };
}
