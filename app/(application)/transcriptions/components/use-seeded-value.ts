"use client";

/**
 * Generic seed-once-never-clobber pattern (final fix wave, task-7 report):
 * the same discipline `use-seeded-post-processing-rows.ts` already applies to
 * the post-processing picker, generalised for a single scalar value so
 * `defaultRightsMode` (Fix 1) and `notifyChat` (Fix 3) can reuse it instead of
 * re-deriving the seeded-ref/touched-ref dance per composer.
 *
 * `seed` is `undefined` while the workspace settings round trip hasn't
 * resolved yet — the composer's state starts at `initial` and gets re-synced
 * to the real value exactly once, the first time `seed` stops being
 * `undefined`. Once the user changes the value themselves (`onChange`), a
 * late-arriving `seed` must never overwrite their choice.
 */
import * as React from "react";

export function useSeededValue<T>(
  seed: T | undefined,
  initial: T,
): [T, (next: T) => void] {
  const [value, setValue] = React.useState<T>(() =>
    seed !== undefined ? seed : initial,
  );
  const seededRef = React.useRef(seed !== undefined);
  const touchedRef = React.useRef(false);

  React.useEffect(() => {
    if (seededRef.current || seed === undefined) return;
    seededRef.current = true;
    if (!touchedRef.current) setValue(seed);
  }, [seed]);

  const onChange = React.useCallback((next: T) => {
    touchedRef.current = true;
    setValue(next);
  }, []);

  return [value, onChange];
}
