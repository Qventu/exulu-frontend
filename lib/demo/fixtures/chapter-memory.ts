import type { AgentSession } from "@/types/models/agent-session";
import type { Item } from "@/types/models/item";

import type { DemoWorld } from "../types";
import { DEMO_AGENT_ID, techdocWorld } from "./chapter-techdoc";
import { demoItem } from "./item";
import { MEMORY_SCROLLBACK_ROWS } from "./memory-turns";

/**
 * Chapter 4: correcting the assistant.
 *
 * The world has a before and an after. Steps up to the correction show the
 * memory context holding three items; from the correction onward it holds
 * four, the new one being exactly what Newton wrote in the chat a moment
 * earlier. That is the chapter's argument in one screen: the fix an engineer
 * typed is now a durable knowledge item anyone can read, edit or delete — not
 * a hidden fine-tune and not a prompt someone has to remember to maintain.
 *
 * All four memory items are real production records, each one created by a
 * real engineer correction in a real session. Their ids are the production
 * ids; 2f78a38c is the one chapter 4's own conversation produces.
 */

export const MEMORY_CONTEXT_ID = "newton_memory_context";

/** The session the scrollback belongs to; its id is the production one. */
export const MEMORY_SESSION_ID = MEMORY_SCROLLBACK_ROWS[0].session;

const memoryItem = (
  id: string,
  name: string,
  information: string,
  createdAt: string,
): Item =>
  demoItem({
    id,
    name,
    // Production leaves these memory items' description empty; the memory text
    // lives in `information`. demoItem turns that into an explicit null, which
    // is what the API returns and what Apollo's cache needs to see.
    //
    // `type` and `information` are the memory context's own fields. FACT is
    // what the production classifier assigned to each of these; the context
    // also uses PREFERENCE and INSIGHT for corrections that shape behaviour
    // rather than state a fact.
    type: "FACT",
    information,
    createdAt,
  });

/** Present before chapter 4's correction. */
const EXISTING_MEMORIES: Item[] = [
  memoryItem(
    "bee835c0-9af3-4f1b-896f-31f6bf01bd2b",
    "FST-2XT Endschaltertest blockiert durch Endhaltestellensperre",
    "Die Endhaltestellen können über I/O-Ports, über Kartenleser oder über das FST-Menü gesperrt sein, wodurch der Endschaltertest im Testmenü blockiert wird.",
    "2026-01-08T15:14:07.639Z",
  ),
  memoryItem(
    "c9111a66-2b30-412d-a2db-1831c1d9de7f",
    "Statistical Information in Zendesk Tickets",
    "Statistical data regarding elevators in Europe, including existing units and new installations per country, can be found in Zendesk tickets, specifically referencing reports from the ELA (European Lift Association). For example, Zendesk Ticket #2065 contains such a report.",
    "2026-01-09T08:29:43.582Z",
  ),
  memoryItem(
    "f75b3fd4-28cd-4ba6-b109-e1a9e9b5dfec",
    "LSU-Motor-Fehler Eigenschaft",
    "Der LSU-Motor-Fehler ist nicht selbsthaltend.",
    "2026-01-15T08:28:55.792Z",
  ),
];

/** Written during chapter 4, by the conversation the visitor drives. */
export const CORRECTION_MEMORY: Item = memoryItem(
  "2f78a38c-3ba9-4c78-9053-0517065c5e2d",
  "FST-2XT Kalibrierfahrt Menüpunkt",
  "Der Menüpunkt zum Starten der Kalibrierfahrt bei der FST-2XT lautet: HAUPTMENUE/Konfig/Inbetriebnahme/Kalibrierfahrt.",
  "2026-01-06T08:27:50.756Z",
);

/**
 * The step at which the correction has been sent and the memory written.
 * Before this, the memory context must NOT contain it — otherwise the payoff
 * is spoiled before the visitor has done anything.
 */
export const MEMORY_WRITTEN_AT_STEP = 2;

const SESSION: AgentSession = {
  id: MEMORY_SESSION_ID,
  agent: DEMO_AGENT_ID,
  project: "demo-project",
  title: "Kalibrierfahrt FST-2 / FST-2XT",
  metadata: null,
  // Must equal getDemoUser().id, or checkChatSessionWriteAccess denies write
  // and the composer renders read-only. See chapter-techdoc.ts.
  created_by: 0,
  session_items: [],
  rights_mode: "private",
  createdAt: "2026-01-06T08:20:37.386Z",
  updatedAt: "2026-01-06T08:27:50.756Z",
};

export function memoryWorld(step: number): DemoWorld {
  const base = techdocWorld(0);

  // The correction is stamped when the world is built, not when this file was
  // written. It carried a fixed January date, so the knowledge base listed the
  // item the PREVIOUS step had just created as "Updated 7mo ago" — two
  // consecutive steps contradicting each other on the chapter whose whole
  // point is that a correction takes effect immediately.
  //
  // Reading the clock is safe here: memoryWorld runs inside a demo resolver,
  // answering an Apollo query from the browser, so there is no server render
  // for it to disagree with. The other memories keep their real dates — they
  // genuinely predate the visit.
  const writtenAt = new Date().toISOString();
  const memories =
    step >= MEMORY_WRITTEN_AT_STEP
      ? [
          {
            ...CORRECTION_MEMORY,
            createdAt: writtenAt,
            updatedAt: writtenAt,
            // The processing columns too, or the row reads "Updated: now" and
            // "Processed: 7mo ago" side by side — the same contradiction one
            // column across. A memory is embedded as it is written.
            last_processed_at: writtenAt,
            embeddings_updated_at: writtenAt,
          },
          ...EXISTING_MEMORIES,
        ]
      : EXISTING_MEMORIES;

  return {
    ...base,
    sessions: [SESSION],
    // Keyed by context so /data/[ctx] can answer for whichever knowledge base
    // is open. Chapter 4 only populates memory; the rest keep chapter 1's —
    // which now means SPREADING the base rather than replacing it, since the
    // real software documentation library lives in base.itemsByContext. A bare
    // assignment dropped it, so opening Knowledge during chapter 4 showed the
    // invented placeholder library instead of the real one.
    items: base.items,
    itemsByContext: {
      ...base.itemsByContext,
      [MEMORY_CONTEXT_ID]: memories,
    },
  };
}
