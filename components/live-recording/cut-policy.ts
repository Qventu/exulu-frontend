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
/** The quietest a room is ever assumed to be: the floor never pushes below this. */
export const SILENCE_DBFS = -50;
/** Auto-stop guard: a forgotten phone must not record all night. */
export const MAX_RECORDING_MS = 4 * 60 * 60 * 1000;
/**
 * How far the silence line sits above the running noise floor. 6 dB is half
 * the perceived loudness of the room tone — quiet enough that room tone alone
 * never reads as speech, loud enough that a mumbled word still does.
 */
export const SILENCE_MARGIN_DB = 6;
/**
 * How fast the floor may rise, per 100 ms tick: 0.05 dB → ~30 s to climb 15 dB.
 * Slow on purpose. A fast rise would let a long stretch of speech drag the
 * silence line up to the speaker's own level, and every pause would cut.
 */
export const FLOOR_DECAY_DB_PER_TICK = 0.05;
/** Start the floor where silenceThreshold() equals the fixed SILENCE_DBFS. */
export const INITIAL_NOISE_FLOOR_DBFS = SILENCE_DBFS - SILENCE_MARGIN_DB;

export function rmsToDbfs(rms: number): number {
  return rms <= 0 ? -Infinity : 20 * Math.log10(rms);
}

/** The level under which audio counts as silence, given the current floor. */
export function silenceThreshold(floorDbfs: number): number {
  return Math.max(SILENCE_DBFS, floorDbfs + SILENCE_MARGIN_DB);
}

/**
 * The running noise floor of a recording (spec §4.4: the silence threshold is
 * "adaptive to the running noise floor"). A fixed -50 dBFS never triggers in a
 * noisy room — a café, a projector fan, an open window all sit above it — so
 * every chunk would run to MAX_CHUNK_MS and cut mid-word.
 *
 * Instant downward attack (the room really did just get quieter) and a slow
 * upward decay (speech must not be able to redefine silence).
 */
export class NoiseFloorTracker {
  private floor: number;
  private readonly decayPerTick: number;

  constructor(initialDbfs = INITIAL_NOISE_FLOOR_DBFS, decayPerTick = FLOOR_DECAY_DB_PER_TICK) {
    this.floor = initialDbfs;
    this.decayPerTick = decayPerTick;
  }

  get value(): number {
    return this.floor;
  }

  /** Feed one tick's dBFS reading; returns the floor to threshold against. */
  update(dbfs: number): number {
    // Digital silence (rms 0 → -Infinity) is a muted track or a dropped
    // buffer, not a quieter room. Letting it set the floor would peg the
    // threshold at SILENCE_DBFS for the rest of the recording.
    if (!Number.isFinite(dbfs)) return this.floor;
    this.floor = dbfs < this.floor ? dbfs : Math.min(dbfs, this.floor + this.decayPerTick);
    return this.floor;
  }
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
