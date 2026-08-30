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
  sendText,
  canSend,
}: {
  setInput: (value: string) => void;
  /**
   * Sends the given text, and takes it EXPLICITLY rather than reading the
   * composer's input state.
   *
   * The first version called the composer's own submit(), which reads `input`
   * from its render scope. The send fired a couple of hundred milliseconds
   * after the last character was typed, but React had not necessarily
   * committed that update yet, so the message went out truncated — the
   * transcript showed a half-finished question above a complete answer.
   * Typing is presentation; the text sent is never derived from it.
   */
  sendText: (text: string) => void | Promise<void>;
  /** False while a reply is streaming, or when the composer is read-only. */
  canSend: boolean;
}) {
  const raw = useSearchParams().get("tour");
  const played = useRef(new Set<string>());

  // The live values, so the timer chain does not send through a stale closure
  // after a re-render.
  const latest = useRef({ setInput, sendText, canSend });
  latest.current = { setInput, sendText, canSend };

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

    // Wait for the composer to be laid out before typing a character.
    //
    // This used to start on a fixed delay, which was a guess about how long
    // the chat takes to mount and a wrong one: measured on this route, the
    // composer has no box until roughly six seconds after navigation, while
    // typing began at nine hundred milliseconds. The visitor watched text
    // appear inside a half-assembled page — the message list not yet sized, so
    // the conversation sat at the top with a band of empty space beneath it.
    //
    // Polling for a real box is the honest test, and it is the same lesson as
    // waitForStableAnchor in tour-shepherd.tsx: wait for the DOM to be ready
    // rather than estimating how long ready takes.
    const composerReady = async () => {
      const deadline = performance.now() + 15000;
      while (performance.now() < deadline) {
        if (cancelled) return false;
        const box = document
          .querySelector('[data-demo-id="chat-composer"]')
          ?.getBoundingClientRect();
        if (box && box.height > 0 && box.bottom > 0) return true;
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      return false;
    };

    // One timer per character rather than an interval, so cancelling on
    // unmount or a step change cannot leave a half-typed question behind.
    const start = () => {
      for (let i = 1; i <= script.length; i++) {
        at(AUTOTYPE_START_MS + i * AUTOTYPE_CHAR_MS, () => {
          if (!cancelled) latest.current.setInput(script.slice(0, i));
        });
      }

      at(AUTOTYPE_START_MS + (script.length + 8) * AUTOTYPE_CHAR_MS, () => {
        if (cancelled) return;
        // If a reply is already streaming, leave the text in the composer
        // rather than queueing a second send behind it.
        if (!latest.current.canSend) return;
        void latest.current.sendText(script);
      });
    };

    void composerReady().then((ready) => {
      if (ready && !cancelled) start();
    });

    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [raw]);
}
