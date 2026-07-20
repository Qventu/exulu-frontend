/** Fixed-window per-IP limiter for the public registration route (spec §7). */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

let windows = new Map<string, { start: number; count: number }>();

export const resetEnsureUserRateLimit = (): void => {
  windows = new Map();
};

export const ensureUserRateLimited = (
  ip: string,
  now: number = Date.now(),
): boolean => {
  const state = windows.get(ip) ?? { start: now, count: 0 };
  if (now - state.start >= WINDOW_MS) {
    state.start = now;
    state.count = 0;
  }
  state.count += 1;
  windows.set(ip, state);
  return state.count > MAX_PER_WINDOW;
};
