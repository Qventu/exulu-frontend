import { MEMORY_CORRECTION_PROMPT } from "./fixtures/memory-turns";
import { TECHDOC_QUESTION } from "./fixtures/techdoc-turns";
import type { TourPosition } from "./tour";

/**
 * What the tour types into the composer, and at which step.
 *
 * The chat chapters used to open with the answer already rendered. That kept
 * every step working for a visitor who only clicks Next, but it meant the one
 * thing worth watching — a question going in and an answer coming back with its
 * retrieval visible — never happened. The copy had to be written around the
 * absence ("here is what came back" rather than "watch it find it"), which is
 * weaker than the product deserves.
 *
 * Typing it instead satisfies both: nothing is required of the visitor, and the
 * flow is the real one. The transport already streams the reply chunk by chunk;
 * only the question was missing.
 *
 * KEYED TO THE STEP THAT ASKS, NOT THE CHAPTER. Steps after it anchor to parts
 * of the answer — the retrieval card, a citation, the memory tool call — so
 * they need the conversation already there. A visitor who deep-links or jumps
 * via the Tour menu to one of those must not be made to sit through the typing
 * before the step makes sense; those steps load their scrollback instead. See
 * scrollbackFor(), which is the other half of this rule.
 */
export function autotypeFor(position: TourPosition): string | null {
  if (position.chapter === "techdoc" && position.step === 0) {
    return TECHDOC_QUESTION;
  }
  // Chapter 5 opens on the refusal (scrollback) and the visitor's move is the
  // correction, so the typing belongs on the step that narrates sending it.
  if (position.chapter === "memory" && position.step === 1) {
    return MEMORY_CORRECTION_PROMPT;
  }
  return null;
}

/**
 * Per-character delay, and the pause before typing starts.
 *
 * Fast enough not to test anyone's patience on a ~60-character question,
 * slow enough to read as typing rather than a paste. The lead-in gives the
 * step's popover time to land first, so the visitor is looking at the composer
 * when it starts.
 */
export const AUTOTYPE_CHAR_MS = 28;
export const AUTOTYPE_START_MS = 900;
