import type { Item } from "@/types/models/item";

import type { DemoWorld } from "../types";
import { techdocWorld } from "./chapter-techdoc";
import RAW_CHUNKS from "./chunks-fst2xt-de.json";
import { type DemoChunk, demoItem } from "./item";

/**
 * Chapter 2 — how a document becomes searchable knowledge.
 *
 * Everything here is the real software documentation knowledge base from the
 * Newlift staging deployment, read out in full: all nine documents, their real
 * ids, their real chunk counts (24 + 24 + 5 + 84 + 93 + 2 + 2 + 4 + 6 = 244,
 * which is the context's actual total), and the real timestamps from the run
 * that ingested them.
 *
 * Using the whole context rather than a curated subset matters for the same
 * reason chapter 3 ships all 55 glossary terms. A prospect sees German and
 * English variants of the same manual sitting side by side, a two-chunk
 * changelog next to a ninety-three-chunk one, and nine documents that were all
 * pulled from a storage bucket within four seconds of each other. A tidied
 * sample of three would show none of that.
 *
 * THE DOCUMENT IS NOT ARBITRARY. Chapter 1's answer cites
 * FST2XTchanges-customer-DE.docx (d92dd3f2-…, chunk 02d50a8f-…), so chapter 2
 * opens the exact document chapter 1 just answered from. An earlier fixture
 * invented a "CTRL-3000 Service Manual" here, which meant the tour claimed to
 * show where the answer came from while displaying a document that had nothing
 * to do with it.
 *
 * ONE DEPARTURE FROM PRODUCTION, and it is deliberate. The real `external_id`
 * and chunk metadata carry the customer's Cloud Storage bucket
 * (`dx-newlift-newton-knowledge-<suffix>/…`). That is infrastructure, not
 * content: it is never rendered anywhere the tour goes, it is not part of the
 * story, and this bundle is served to the public. The bucket prefix is dropped
 * and the object path kept, so what is shown is true in shape and in substance
 * without publishing a customer's storage layout. The chunk metadata keeps only
 * its real `page`.
 */

const CONTEXT_ID = "software_documentation_context";

/** The document chapter 1 cites, and therefore the one chapter 2 opens. */
export const INGESTION_ITEM_ID = "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c";

/**
 * The first ten of the document's 93 chunks, verbatim.
 *
 * Ten is not an arbitrary trim: the chunks table pages at ten, and with
 * server-side chunk pagination still behind a flag the product itself renders
 * the inline chunks it was given and prints "showing first N" underneath. So a
 * ten-chunk fixture against a chunks_count of 93 is not a half-truth — it is
 * exactly what this screen does in production today, footnote included.
 */
const CHUNKS = RAW_CHUNKS as DemoChunk[];

/**
 * The nine documents, ordered as the table sorts them (updatedAt DESC) so the
 * fixture reads in the order a visitor sees.
 */
const ITEMS: Item[] = [
  demoItem({
    id: "9a21d272-d69b-4f20-b237-39efce07dd89",
    name: "CAN-to-LON_EN.pdf",
    source: "google-storage",
    external_id: "FST/Software/CAN-to-LON_EN.pdf",
    chunks_count: 24,
    createdAt: "2026-02-23T01:24:49.403Z",
    last_processed_at: "2026-05-12T22:35:02.376Z",
    embeddings_updated_at: "2026-05-12T22:35:24.049Z",
  }),
  demoItem({
    id: "cd37981e-5582-4ae2-acec-02bfd6cc24f6",
    name: "CAN-to-LON_DE.pdf",
    source: "google-storage",
    external_id: "FST/Software/CAN-to-LON_DE.pdf",
    chunks_count: 24,
    createdAt: "2026-02-23T01:24:48.659Z",
    last_processed_at: "2026-05-12T22:35:02.372Z",
    embeddings_updated_at: "2026-05-12T22:35:16.912Z",
  }),
  demoItem({
    id: "14c4db32-f71c-4629-9f56-c6daa41a36a6",
    name: "FSTBugFixes.docx",
    source: "google-storage",
    external_id: "FST/Software/FSTBugFixes.docx",
    chunks_count: 5,
    createdAt: "2026-02-23T01:24:48.274Z",
    last_processed_at: "2026-05-12T22:34:58.400Z",
    embeddings_updated_at: "2026-05-12T22:35:04.302Z",
  }),
  demoItem({
    id: "b581209b-99fa-4879-ab31-f87336c4b6de",
    name: "FST2XTchanges-customer-EN.docx",
    source: "google-storage",
    external_id: "FST/Software/fuer_FST-2XT/FST2XTchanges-customer-EN.docx",
    chunks_count: 84,
    createdAt: "2026-02-23T01:24:46.772Z",
    last_processed_at: "2026-05-12T22:35:00.353Z",
    embeddings_updated_at: "2026-05-12T22:35:17.802Z",
  }),
  // The one chapter 1 answered from.
  demoItem({
    id: INGESTION_ITEM_ID,
    name: "FST2XTchanges-customer-DE.docx",
    source: "google-storage",
    external_id: "FST/Software/fuer_FST-2XT/FST2XTchanges-customer-DE.docx",
    chunks_count: 93,
    createdAt: "2026-02-23T01:24:45.861Z",
    last_processed_at: "2026-05-12T22:35:01.345Z",
    embeddings_updated_at: "2026-05-12T22:35:18.917Z",
    chunks: CHUNKS,
  }),
  demoItem({
    id: "85e3e8fc-d866-4bbc-bbff-15e98d003489",
    name: "FST-FSM2-changes-customer-EN.docx",
    source: "google-storage",
    external_id: "FST/Software/FST-FSM2-changes-customer-EN.docx",
    chunks_count: 2,
    createdAt: "2026-02-23T01:24:45.078Z",
    last_processed_at: "2026-05-12T22:34:59.402Z",
    embeddings_updated_at: "2026-05-12T22:35:07.441Z",
  }),
  demoItem({
    id: "7d1d0d6e-f4ae-4fe4-aa90-a8b210d3df59",
    name: "FST-FSM2-changes-customer-DE.docx",
    source: "google-storage",
    external_id: "FST/Software/FST-FSM2-changes-customer-DE.docx",
    chunks_count: 2,
    createdAt: "2026-02-23T01:24:44.257Z",
    last_processed_at: "2026-05-12T22:34:58.432Z",
    embeddings_updated_at: "2026-05-12T22:35:04.118Z",
  }),
  demoItem({
    id: "ac753b77-c055-4581-ab68-a0e9ff637864",
    name: "EAZTFT-110_changes.doc",
    source: "google-storage",
    external_id: "EAZ/EAZTFT-110_changes.doc",
    chunks_count: 4,
    createdAt: "2026-02-23T01:24:43.663Z",
    last_processed_at: "2026-05-12T22:34:59.457Z",
    embeddings_updated_at: "2026-05-12T22:35:07.405Z",
  }),
  demoItem({
    id: "a49716ce-20e0-4b09-b2e9-b2d6b3a2ca6e",
    name: "EAZ-TFT.110_Neuron_Changes.docx",
    source: "google-storage",
    external_id: "EAZ/EAZ-TFT.110_Neuron_Changes.docx",
    chunks_count: 6,
    createdAt: "2026-02-23T01:24:42.670Z",
    last_processed_at: "2026-05-12T22:34:58.512Z",
    embeddings_updated_at: "2026-05-12T22:35:06.237Z",
  }),
];

/**
 * NOT COVERED, deliberately: the /data/[ctx] Pipeline tab.
 *
 * Every item here records `source: "google-storage"`, so the deployment plainly
 * has a storage source configured — but context configuration does not live in
 * the Postgres database this fixture was read from, so its real schedule, retry
 * and backoff settings were not available. The chapter stays on the item list
 * and the item detail page, which are reproduced exactly. Writing a plausible
 * cron expression to fill the Pipeline tab would have put invented
 * infrastructure on screen next to nine real documents, which is the one thing
 * this fixture is trying not to do. The context fixture's `sources: []` is
 * therefore still a known gap.
 */

/**
 * Chapter 2 borrows chapter 1's agent, contexts and session — the visitor has
 * just come from that conversation, and the shell is the same application —
 * and adds the real documents behind the software documentation knowledge base.
 */
export function ingestionWorld(_step: number): DemoWorld {
  const base = techdocWorld(0);
  return {
    ...base,
    itemsByContext: {
      ...base.itemsByContext,
      [CONTEXT_ID]: ITEMS,
    },
  };
}

export { CONTEXT_ID as INGESTION_CONTEXT_ID };
