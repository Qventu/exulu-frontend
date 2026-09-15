"use client";

import { useEffect } from "react";

/**
 * Makes the product non-operable during the tour, and no more than that.
 *
 * NOT pointer-events: none. That would kill scrolling, text selection AND the
 * ability to reach the panel with the keyboard; chapter 5's answer is ~1300px
 * of prose in a ~700px viewport — OPEN's marketing lead specifically
 * complained she could not scroll it.
 *
 * Attached to `document`, not `<main>`. A Radix Dialog/Sheet (chapter 7's
 * retrieval wizard among them) portals its content to `document.body` by
 * default, which makes it a DOM sibling of `<main>`, not a descendant — a
 * blocker scoped to `<main>` never sees events dispatched inside one, no
 * matter the capture phase, because capturing only visits actual ancestors
 * of the event target. Listening on `document` sees every target, portalled
 * or not, including ones added after this effect runs, without having to
 * enumerate portal roots.
 *
 * The panel is exempted by checking the event's TARGET rather than the
 * listener's scope, which is what lets it stay outside <main> and still work:
 * an event whose target is inside [data-demo-id="tour-panel"] is let through
 * untouched.
 *
 * ── What is blocked, and what deliberately is not ────────────────────────
 * The list is split by what each event's DEFAULT ACTION actually is, because
 * cancelling all five broke three things nobody tested (the walker only
 * clicks):
 *
 *  - `click` and `submit` keep preventDefault(): navigation and submission
 *    ARE their defaults, so cancelling them is the whole mechanism. This
 *    also covers the keyboard's activation path — Enter on a link or button,
 *    Space on a button, both dispatch a real `click` event that lands here.
 *
 *  - `pointerdown` gets stopPropagation() only.
 *
 *  - `mousedown` gets stopPropagation(), plus preventDefault() over anything
 *    FOCUSABLE (see `takesFocus`). preventDefault() on mousedown is the
 *    canonical way to stop text selection, so cancelling it everywhere
 *    silently removed the ability to select any text in the product. But
 *    cancelling it nowhere is worse: mousedown's other default is FOCUS, and
 *    focus is operable in this product — Radix Tabs use automatic activation,
 *    so merely focusing a trigger selects that tab. Measured with the walker:
 *    the /budgets scope tabs switched view AND rewrote the URL (dropping
 *    `?tour=` with it — see lib/demo/chapters/kosten.ts), the evals results/
 *    test-case tabs swapped panels, and the knowledge library's Archiviert
 *    filter navigated, all without a single click getting through. Splitting
 *    by target keeps both: prose stays selectable, controls stay dead.
 *
 *  - `keydown` gets stopPropagation(), plus preventDefault() in exactly one
 *    case: a keystroke aimed at an editable element (see `blocksTyping`).
 *    Cancelling every keydown meant focus could never leave <body> — the
 *    first Tab has `target === document.body`, outside the panel, so it was
 *    cancelled and "Weiter" was unreachable by keyboard, a regression against
 *    the popover era, which focus-trapped its popover. It also killed
 *    Space/PageDown/arrow/Home/End scrolling, reinstating the exact scroll
 *    complaint above for keyboard users, and Ctrl/Cmd+F/P/S.
 *
 * stopPropagation() in the CAPTURE phase on `document` is what does the work
 * in the three cases above that keep their default action: this app hydrates
 * with hydrateRoot(document, …), so React's delegated listeners sit on
 * `document` too, and an event stopped there reaches no React or Radix
 * handler. Confirmed by the walker — the chapter-7 wizard's own step tabs are
 * plain onClick buttons and stayed dead throughout; only the focus-activated
 * controls above ever got through, and only via a default action.
 */

/** input/textarea/select/contenteditable — a field a visitor could type into. */
function isEditable(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return node.isContentEditable || node.matches("input, textarea, select");
}

/**
 * Anything a mousedown would move focus into.
 *
 * `closest`, not `matches`: a mousedown lands on whatever is under the
 * cursor — the <span> of a button's label, an icon <svg> — while the focus
 * goes to the focusable ancestor. `[tabindex]` covers the custom widgets
 * (Radix puts one on every roving-focus item); the rest are the natively
 * focusable elements.
 */
const FOCUSABLE =
  "a[href], button, input, select, textarea, summary, label, [tabindex], [contenteditable]";

function takesFocus(node: EventTarget | null): boolean {
  return node instanceof Element && !!node.closest(FOCUSABLE);
}

/**
 * True only for a keystroke that would put characters into a product field.
 *
 * Tab is excluded deliberately: cancelling it with focus inside an input
 * would TRAP focus there, which is the same "the panel is unreachable" bug
 * one layer down. Modifier combos are excluded so Cmd/Ctrl+F/P/S keep
 * working from anywhere. Everything else — Enter and Space included — needs
 * nothing here, because their operable default is a `click` event, and that
 * is cancelled above.
 */
function blocksTyping(e: KeyboardEvent): boolean {
  if (e.key === "Tab") return false;
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return isEditable(e.target);
}

export function ContentInert() {
  useEffect(() => {
    const main = document.querySelector("main");

    // Looked up once and kept, rather than re-queried on every blocked
    // event (mousedown/pointerdown/keydown fire in bursts). The panel
    // unmounts whenever the tour has no step, so a cached node that has
    // left the document is re-resolved rather than trusted.
    let panel: Element | null = null;
    const tourPanel = () => {
      if (!panel?.isConnected) {
        panel = document.querySelector('[data-demo-id="tour-panel"]');
      }
      return panel;
    };

    const inPanel = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node)) return false;
      const el = tourPanel();
      return !!el && el.contains(target);
    };

    /** click, submit — their default action IS the operation. */
    const cancel = (e: Event) => {
      if (inPanel(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    /** pointerdown — keep every default, lose the handlers. */
    const mute = (e: Event) => {
      if (inPanel(e)) return;
      e.stopPropagation();
    };

    /** mousedown — as `mute`, except over a control, where focus operates. */
    const muteDown = (e: MouseEvent) => {
      if (inPanel(e)) return;
      if (takesFocus(e.target)) e.preventDefault();
      e.stopPropagation();
    };

    /** keydown — as `mute`, but a product field must not accept typing. */
    const muteKey = (e: KeyboardEvent) => {
      if (inPanel(e)) return;
      if (blocksTyping(e)) e.preventDefault();
      e.stopPropagation();
    };

    const cancelled = ["click", "submit"] as const;
    for (const t of cancelled) document.addEventListener(t, cancel, true);
    document.addEventListener("pointerdown", mute, true);
    document.addEventListener("mousedown", muteDown, true);
    document.addEventListener("keydown", muteKey, true);
    if (main) main.style.cursor = "default";
    return () => {
      for (const t of cancelled) document.removeEventListener(t, cancel, true);
      document.removeEventListener("pointerdown", mute, true);
      document.removeEventListener("mousedown", muteDown, true);
      document.removeEventListener("keydown", muteKey, true);
      if (main) main.style.cursor = "";
    };
  }, []);
  return null;
}
