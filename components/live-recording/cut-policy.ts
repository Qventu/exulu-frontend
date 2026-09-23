/**
 * When to end the current audio segment and start the next one. Pure so the
 * recorder hook can be reasoned about without a microphone.
 *
 * Spec: docs/superpowers/specs/2026-09-23-live-recording-transcription-design.md §4.4
 */
export const MIN_CHUNK_MS = 20_000;
export const MAX_CHUNK_MS = 60_000;
/** A quiet window at least this long is a cut point (after MIN_CHUNK_MS). */
export const SILENCE_MIN_MS = 500;
/** RMS below this is "silence". Adaptive noise floors are a follow-up. */
export const SILENCE_DBFS = -50;
/** Auto-stop guard: a forgotten phone must not record all night. */
export const MAX_RECORDING_MS = 4 * 60 * 60 * 1000;

export function rmsToDbfs(rms: number): number {
  return rms <= 0 ? -Infinity : 20 * Math.log10(rms);
}

export function shouldCut(input: {
  chunkElapsedMs: number;
  silentForMs: number;
  minChunkMs?: number;
  maxChunkMs?: number;
  silenceMinMs?: number;
}): boolean {
  const min = input.minChunkMs ?? MIN_CHUNK_MS;
  const max = input.maxChunkMs ?? MAX_CHUNK_MS;
  const silence = input.silenceMinMs ?? SILENCE_MIN_MS;
  if (input.chunkElapsedMs >= max) return true;
  if (input.chunkElapsedMs < min) return false;
  return input.silentForMs >= silence;
}
