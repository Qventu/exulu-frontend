"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import {
  AUTOTYPE_CHAR_MS,
  AUTOTYPE_START_MS,
  autotypeFor,
} from "@/lib/demo/autotype";
import { isDemoMode } from "@/lib/demo/flag";
import { parsePosition } from "@/lib/demo/tour";

/**
 * Types the tour's scripted question into the composer and sends it.
 *
 * Reads the position from `?tour=` rather than the tour's React context: the
 * composer sits deep inside the chat tree and the provider is mounted beside
 * it in the layout, so there is no context to reach. The query parameter is the
 * source of truth for the tour's position anyway — the provider derives its own
 * state from it — so this is reading the same thing one hop earlier.
 *
 * Deliberately a no-op outside demo mode, and it never runs twice for the same
 * step: `played` is keyed by position, so returning to a step with Back does
 * not retype, and React's development double-effect cannot double-send.
 */
export function useDemoAutotype({
  setInput,
  submit,
  canSend,
}: {
  setInput: (value: string) => void;
  submit: () => void | Promise<void>;
  /** False while a reply is streaming, or when the composer is read-only. */
  canSend: boolean;
}) {
  const raw = useSearchParams().get("tour");
  const played = useRef(new Set<string>());

  // The live values, so the timer chain does not send through a stale closure
  // after a re-render.
  const latest = useRef({ setInput, submit, canSend });
  latest.current = { setInput, submit, canSend };

  useEffect(() => {
    if (!isDemoMode() || !raw) return;

    const position = parsePosition(raw);
    if (!position) return;

    const script = autotypeFor(position);
    if (!script) return;

    const key = `${position.chapter}.${position.step}`;
    if (played.current.has(key)) return;
    played.current.add(key);

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // One timer per character rather than an interval, so cancelling on
    // unmount or a step change cannot leave a half-typed question behind.
    for (let i = 1; i <= script.length; i++) {
      at(AUTOTYPE_START_MS + i * AUTOTYPE_CHAR_MS, () => {
        if (!cancelled) latest.current.setInput(script.slice(0, i));
      });
    }

    at(
      AUTOTYPE_START_MS + (script.length + 8) * AUTOTYPE_CHAR_MS,
      () => {
        if (cancelled) return;
        // If a reply is already streaming, leave the text in the composer
        // rather than queueing a second send behind it.
        if (!latest.current.canSend) return;
        void latest.current.submit();
      },
    );

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [raw]);
}
