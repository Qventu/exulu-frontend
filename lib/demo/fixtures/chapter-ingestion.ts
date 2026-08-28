import type { DemoWorld } from "../types";
import { techdocWorld } from "./chapter-techdoc";
import { SOFTWARE_DOC_CONTEXT_ID, SOFTWARE_DOC_ITEM_ID } from "./software-docs";

/**
 * Chapter 2 — how a document becomes searchable knowledge.
 *
 * The documents themselves live in ./software-docs.ts, because every chapter's
 * world carries them, not just this one. What is left here is the chapter's
 * own framing.
 *
 * THE DOCUMENT IS NOT ARBITRARY. Chapter 1's answer cites
 * FST2XTchanges-customer-DE.docx (d92dd3f2-…, chunk 02d50a8f-…), so chapter 2
 * opens the exact document chapter 1 just answered from. An earlier fixture
 * invented a "CTRL-3000 Service Manual" here, which meant the tour claimed to
 * show where the answer came from while displaying a document that had nothing
 * to do with it.
 *
 * NOT COVERED, deliberately: the /data/[ctx] Pipeline tab.
 *
 * Every document records `source: "google-storage"`, so the deployment plainly
 * has a storage source configured — but context configuration does not live in
 * the Postgres database this fixture was read from, so its real schedule, retry
 * and backoff settings were not available. The chapter stays on the item list
 * and the item detail page, which are reproduced exactly. Writing a plausible
 * cron expression to fill the Pipeline tab would have put invented
 * infrastructure on screen next to nine real documents, which is the one thing
 * this fixture is trying not to do. The context fixture's `sources: []` is
 * therefore still a known gap.
 */

export const INGESTION_CONTEXT_ID = SOFTWARE_DOC_CONTEXT_ID;
export const INGESTION_ITEM_ID = SOFTWARE_DOC_ITEM_ID;

/**
 * Chapter 2 borrows chapter 1's world wholesale — same agent, same contexts,
 * same session, and since the extraction, the same nine documents. It is the
 * same application; the visitor has just walked into a different room.
 */
export function ingestionWorld(_step: number): DemoWorld {
  return techdocWorld(0);
}
