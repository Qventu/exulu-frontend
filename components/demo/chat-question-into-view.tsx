"use client";

import { useEffect } from "react";

import { useTour } from "./tour-provider";

/**
 * Brings the QUESTION back on screen once a chat exchange has finished.
 *
 * The chat sticks to the bottom while an answer streams, which is right: the
 * text arrives at the bottom and a visitor watching it wants to follow it. But
 * the answer in chapter 5 is ~1300px tall in a ~700px viewport, so when the
 * stream ends the conversation is parked at the foot of it and the question
 * has scrolled 463px off the top (measured). What is left is a wall of prose
 * with nothing to say what was asked — under a step whose own copy reads
 * "Ein Servicetechniker fragt nach einem Fehlerbild. Sehen Sie zu, wie der
 * Assistent sucht und antwortet". OPEN's marketing lead, walking the demo on
 * 2026-09-14: "ich sehe jetzt zum Beispiel gar nicht die Frage, die gestellt
 * wurde ... es wäre cool wenn das einfach hier oben startet".
 *
 * So: wait for the exchange to SETTLE, then put the last question at the top.
 * Waiting is the whole point — scrolling up mid-stream would take the answer
 * away from someone who is watching it arrive, which is the thing the step
 * asks them to do.
 *
 * Reads two product classes and writes none: `[data-demo-id="chat-messages"]`
 * (the Conversation wrapper, already the anchor for two steps) and `.is-user`
 * (set by components/ai-elements/message.tsx). Aligning the LAST user message
 * rather than scrolling to zero is what makes this correct in the memory
 * chapter too, where four earlier exchanges sit above as scrollback and the
 * top of the scroller is the wrong place to land.
 */
export function ChatQuestionIntoView() {
  const { position } = useTour();

  useEffect(() => {
    let cancelled = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const scrollerFor = (conv: Element): HTMLElement | null => {
      for (const node of conv.querySelectorAll("*")) {
        if (!(node instanceof HTMLElement)) continue;
        const overflowY = getComputedStyle(node).overflowY;
        if (!/auto|scroll/.test(overflowY)) continue;
        if (node.scrollHeight > node.clientHeight + 20) return node;
      }
      return null;
    };

    // A manual scroll means the visitor has taken over. Never yank the view
    // out from under someone who is reading.
    let taken = false;
    const takeOver = () => { taken = true; };
    window.addEventListener("wheel", takeOver, { passive: true });
    window.addEventListener("touchmove", takeOver, { passive: true });

    let lastHeight = -1;
    let stableFor = 0;
    const POLL_MS = 250;
    // Two stable polls. The scripted answer streams in ~250ms chunks, so one
    // is inside the noise; four would keep a finished exchange parked at the
    // bottom for a second after it visibly stopped moving.
    const NEEDED_STABLE = 2;
    // The chat route mounts slowly (~6s for the composer) and the scripted
    // exchange runs ~9s after that, so this has to outlast both.
    const GIVE_UP_AT = Date.now() + 30_000;

    const tick = () => {
      if (cancelled || taken) return;
      if (Date.now() > GIVE_UP_AT) return;

      const conv = document.querySelector('[data-demo-id="chat-messages"]');
      const scroller = conv ? scrollerFor(conv) : null;
      if (!conv || !scroller) {
        settleTimer = setTimeout(tick, POLL_MS);
        return;
      }

      const height = scroller.scrollHeight;
      stableFor = height === lastHeight ? stableFor + 1 : 0;
      lastHeight = height;

      if (stableFor < NEEDED_STABLE) {
        settleTimer = setTimeout(tick, POLL_MS);
        return;
      }

      const questions = conv.querySelectorAll(".is-user");
      const question = questions[questions.length - 1];
      if (!(question instanceof HTMLElement)) return;

      // Offset arithmetic rather than scrollIntoView: the latter walks every
      // scrollable ancestor, and the page behind the chat has its own. This
      // moves exactly one scroller.
      const delta = question.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      const target = Math.max(0, Math.min(scroller.scrollTop + delta, scroller.scrollHeight - scroller.clientHeight));
      if (Math.abs(target - scroller.scrollTop) > 8) {
        scroller.scrollTo({ top: target, behavior: "smooth" });
      }
    };

    settleTimer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (settleTimer) clearTimeout(settleTimer);
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchmove", takeOver);
    };
  }, [position.chapter, position.step]);

  return null;
}
