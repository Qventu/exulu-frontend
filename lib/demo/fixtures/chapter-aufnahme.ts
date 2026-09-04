import type { DemoWorld } from "../types";
import { techdocWorld } from "./chapter-techdoc";
import { SOFTWARE_DOC_CONTEXT_ID, SOFTWARE_DOC_ITEMS } from "./software-docs";

/**
 * Chapter 3 — a knowledge base filling with documents.
 *
 * Four worlds: empty, two partial, complete. The counts are deliberately
 * uneven (0, 4, 7, 9) because a linear fill reads as a progress bar and an
 * uneven one reads as work arriving — which is what ingestion actually looks
 * like when a queue drains.
 *
 * The documents are the REAL nine from software-docs.ts, not invented ones.
 * (The plan this fixture was written from said eighteen; software-docs.ts's
 * own docstring, the commit that created it, and demo-ingestion.test.ts's
 * existing `toHaveLength(9)` / 244-chunk assertions all agree the real
 * Newlift deployment has nine. Built against the real number rather than
 * padding the library with nine invented documents to match a stale plan.)
 * Chapter 5 cites FST2XTchanges-customer-DE.docx by id, so a visitor who later
 * sees that citation has already watched this exact file arrive.
 */
const COUNTS = [0, 4, 7, SOFTWARE_DOC_ITEMS.length];

/**
 * The step at which the knowledge base is fully ingested — derived from
 * `COUNTS` rather than written again as a literal, so that chapter 4
 * (`chapter-zugriff.ts`) cannot silently drift onto a half-filled base if
 * `COUNTS` ever gains or loses entries.
 */
export const AUFNAHME_COMPLETE_STEP = COUNTS.length - 1;

export function aufnahmeWorld(step: number): DemoWorld {
  const base = techdocWorld(0);
  const count = COUNTS[Math.min(Math.max(step, 0), COUNTS.length - 1)];
  return {
    ...base,
    itemsByContext: {
      ...(base.itemsByContext ?? {}),
      [SOFTWARE_DOC_CONTEXT_ID]: SOFTWARE_DOC_ITEMS.slice(0, count),
    },
  };
}
