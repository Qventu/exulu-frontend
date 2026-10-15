import { DAY_MS, type TimeWindow } from "./map-data";

/**
 * The frames of a one-time sweep of the time window's end from the first day
 * to the last, then a clearing frame (null = the whole span). Pure, so the
 * plan can be tested without a clock; the card plays it with setInterval.
 */
export function sweepFrames(
  bounds: TimeWindow,
  durationMs: number,
  stepMs: number,
): (TimeWindow | null)[] {
  if (durationMs <= 0 || stepMs <= 0 || bounds.to - bounds.from < DAY_MS) return [];
  const steps = Math.max(1, Math.round(durationMs / stepMs));
  const frames: (TimeWindow | null)[] = [];
  for (let i = 0; i <= steps; i++) {
    const to = bounds.from + Math.round(((bounds.to - bounds.from) * i) / steps);
    frames.push({ from: bounds.from, to });
  }
  frames.push(null);
  return frames;
}
