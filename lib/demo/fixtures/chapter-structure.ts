import type { DemoWorld } from "../types";
import { CONTEXTS } from "./contexts";
import { techdocWorld } from "./chapter-techdoc";

/**
 * Chapter 2 — the knowledge-base list filling.
 *
 * Three complete worlds rather than one world and a timer. types.ts requires
 * every step to be whole so the Tour bubble can jump anywhere, and the
 * alternative would need forced Apollo refetches on every tick because the
 * product's useQuery calls do not poll.
 *
 * The contexts are the REAL seven the deployment runs (contexts.ts) — the same
 * ids the `techdoc` chapter's citations reference and the `config` chapter's
 * routing table lists. The partial step takes the first three in declaration
 * order rather than a curated subset: it is a moment of filling, not a claim
 * about which three matter.
 */
export function structureWorld(step: number): DemoWorld {
  const base = techdocWorld(0);
  const shown = step <= 0 ? 0 : step === 1 ? 3 : CONTEXTS.length;
  return { ...base, contexts: CONTEXTS.slice(0, shown) };
}
