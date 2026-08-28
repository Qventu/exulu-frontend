import type { Item } from "@/types/models/item";

import { type DemoChunk, demoItem } from "./item";
import RAW_CHUNKS from "./chunks-fst2xt-de.json";

/**
 * The real software documentation knowledge base from the Newlift staging
 * deployment: all nine documents, real ids, real chunk counts summing to the
 * context's real 244, real timestamps.
 *
 * Lives here rather than inside chapter-ingestion.ts because EVERY chapter
 * needs it, not just chapter 2. getWorld() routes chapters 5, 6 and 7 to
 * chapter 1's world by default, so with these documents owned by chapter 2 the
 * knowledge base showed two invented placeholders ("CTRL-3000 Service Manual",
 * "EN 81-20:2024") on every other chapter — including chapter 1, whose answer
 * cites a document in this very context. Found by opening /data with a stale
 * ?tour= value and seeing the wrong library.
 *
 * ONE REDACTION, deliberate. The real external_id and chunk metadata carry the
 * customer's Cloud Storage bucket. That is infrastructure rather than content,
 * it is never rendered anywhere the tour goes, and this bundle is served to the
 * public — so the bucket prefix is dropped and the object path kept. The chunk
 * metadata keeps only its real `page`.
 */

/** The document chapter 1 cites, and therefore the one chapter 2 opens. */
export const SOFTWARE_DOC_ITEM_ID = "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c";

export const SOFTWARE_DOC_CONTEXT_ID = "software_documentation_context";

/**
 * The first ten of the cited document's 93 chunks, verbatim.
 *
 * Ten is not an arbitrary trim: the chunks table pages at ten, and with
 * server-side chunk pagination still behind a flag the product renders the
 * inline chunks it was given and prints "showing first N" underneath. So ten
 * against a chunks_count of 93 is not a half-truth — it is exactly what this
 * screen does in production, footnote included.
 */
const CHUNKS = RAW_CHUNKS as DemoChunk[];

export const SOFTWARE_DOC_ITEMS: Item[] = [
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
    id: SOFTWARE_DOC_ITEM_ID,
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
