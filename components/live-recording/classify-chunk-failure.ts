/**
 * Maps a failed chunk POST onto the queue's policy (spec §4.4):
 * - transient (network, 429, 5xx, auth refresh) → retry forever with backoff
 * - deterministic (400/413/415) → send a skip marker for the same seq
 * - 409 not_recording / out_of_order → abort the recording
 */
export type ChunkFailure =
  | { kind: "retry" }
  | { kind: "skip" }
  | { kind: "abort"; reason: "not_recording" | "out_of_order" };

export function classifyChunkFailure(
  status: number | null,
  body?: { kind?: string } | null,
): ChunkFailure {
  if (status == null) return { kind: "retry" };
  if (status === 409) {
    if (body?.kind === "not_recording") return { kind: "abort", reason: "not_recording" };
    if (body?.kind === "out_of_order") return { kind: "abort", reason: "out_of_order" };
    return { kind: "retry" };
  }
  if (status === 400 || status === 413 || status === 415) return { kind: "skip" };
  return { kind: "retry" };
}
