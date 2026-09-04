import type { DemoWorld } from "../types";
import { AUFNAHME_COMPLETE_STEP, aufnahmeWorld } from "./chapter-aufnahme";

/**
 * Chapter 4 — who may read what.
 *
 * Deliberately the COMPLETED ingestion world: the chapter opens on the same
 * knowledge base the previous chapter just filled, so the permissions being
 * set are visibly the permissions on documents the visitor watched arrive.
 * Reusing chapter 3's own derived final step — rather than rebuilding the
 * world or hardcoding its index — means the two chapters cannot drift apart:
 * if `chapter-aufnahme.ts`'s `COUNTS` ever grows or shrinks,
 * `AUFNAHME_COMPLETE_STEP` moves with it and this still opens on the
 * genuinely last, fully-ingested world rather than a step frozen in place.
 */
export function zugriffWorld(_step: number): DemoWorld {
  return aufnahmeWorld(AUFNAHME_COMPLETE_STEP);
}
