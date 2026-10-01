"use client";

/**
 * Seeds a composer's post-processing rows from the workspace's summary
 * presets (task-7 brief, Step 4) — shared by all three composers so the
 * re-sync logic below lives in exactly one place.
 *
 * Fix round 1, minor #2: `new-transcript-dialog.tsx` passes `undefined` for
 * `defaultPostProcessingPrompts` while `useTranscriptsSettings()` is still
 * loading, and the real (possibly empty) array once it resolves. A dialog
 * opened before that round trip completes must not lock in an empty seed
 * forever — but once the admin has touched the picker themselves, a
 * late-arriving default must never overwrite their choice. `seededRef` fires
 * the resync at most once; `touchedRef` permanently disarms it the moment the
 * admin edits a row.
 */
import * as React from "react";

import type { PostProcessingPrompt } from "../types";

export function useSeededPostProcessingRows(
  defaultPostProcessingPrompts: PostProcessingPrompt[] | undefined,
): [PostProcessingPrompt[], (rows: PostProcessingPrompt[]) => void] {
  const [rows, setRows] = React.useState<PostProcessingPrompt[]>(
    () => defaultPostProcessingPrompts ?? [],
  );
  const seededRef = React.useRef(defaultPostProcessingPrompts !== undefined);
  const touchedRef = React.useRef(false);

  React.useEffect(() => {
    if (seededRef.current || defaultPostProcessingPrompts === undefined) return;
    seededRef.current = true;
    if (!touchedRef.current) setRows(defaultPostProcessingPrompts);
  }, [defaultPostProcessingPrompts]);

  const onChange = React.useCallback((next: PostProcessingPrompt[]) => {
    touchedRef.current = true;
    setRows(next);
  }, []);

  return [rows, onChange];
}
