import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { Context } from "@/types/models/context";
import { CONTEXTS as REAL_CONTEXTS } from "./contexts";
import type { Item } from "@/types/models/item";
import type { DemoWorld } from "../types";
import { demoItem } from "./item";
import {
  SOFTWARE_DOC_CONTEXT_ID,
  SOFTWARE_DOC_ITEMS,
} from "./software-docs";

export const DEMO_AGENT_ID = "demo-agent-newton";
export const DEMO_AGENT_SLUG = "chat";

const AGENT: Agent = {
  id: DEMO_AGENT_ID,
  type: "agent",
  name: "Technical Documentation Assistant",
  slug: DEMO_AGENT_SLUG,
  description:
    "Answers technical questions about elevator control boards using " +
    "manufacturer documentation and applicable standards.",
  welcomemessage:
    "Hello! I can help you troubleshoot elevator control boards and look up " +
    "technical specifications. What would you like to know?",
  active: true,
  defaultagent: true,
  feedback: true,
  suggestions_enabled: true,
  sandbox_enabled: false,
  // The chapter that opens this editor says "everything on the next few screens
  // is their live production setup" while Model and Category both rendered
  // "Select a…" placeholders. A production agent with no model chosen is not a
  // production agent, and it was the first thing visible behind the popover.
  //
  // `category` is one of the nine the editor offers (basics.tsx); `model` is
  // the FK the agent carries and `modelName` is what the select displays when
  // the catalogue has not resolved.
  category: "knowledge",
  model: "gemini-3.1-pro",
  modelName: "gemini-3.1-pro",
  providerName: "Google",
  // Newton's memory context. Without it the same screen said two opposite
  // things at once: the agentic-retrieval summary read "7 knowledge bases ·
  // 5 routing rules · memory on" while the Long-term memory card directly
  // beneath it read "disabled — choose a context". The tour then spends a
  // whole chapter writing to that memory.
  memory: "newton_memory_context",
  instructions:
    "You are Newton, a technical documentation assistant for Newlift GmbH. " +
    "Answer questions about elevator control board maintenance, fault codes, " +
    "and applicable EN/DIN standards. Always cite the source document.",
  rights_mode: "public",
};

// The six real Newlift knowledge bases, with their production ids so that
// chapter 1's citations and chapter 3's routing table refer to contexts the
// tour actually shows. See ./contexts.ts.
const CONTEXTS: Context[] = REAL_CONTEXTS;

// The default library, used for any context without its own list in
// itemsByContext below.
//
// This was two invented placeholders — a "CTRL-3000 Service Manual Rev. 4"
// with 248 chunks and an "EN 81-20:2024" with 412 — and they were the last
// fabricated data left in the tour. Nothing on the scripted path opens a
// context that falls back here, but the sidebar's Knowledge link does, and a
// prospect who wanders into one found two manuals that do not exist wearing
// chunk counts precise enough to look checkable.
//
// Defaulting to the real software-documentation library is not a perfect fit
// for every context, but showing Newlift's actual documents beats showing
// invented ones on a tour whose whole claim is that the data is real.
const ITEMS: Item[] = SOFTWARE_DOC_ITEMS;

/** In the URL of every chat step: /chat/<agent>/<session>. */
export const TECHDOC_SESSION_ID = "session-demo-techdoc-1";

const SESSIONS: AgentSession[] = [
  {
    id: TECHDOC_SESSION_ID,
    agent: DEMO_AGENT_ID,
    project: "demo-project",
    // Was "Fault E47 on CTRL-3000" — a fault code and a control board that
    // appear nowhere else in the tour, in either whitepaper, or in Newlift's
    // range, sitting in the page header above a conversation that is actually
    // about Nothalt COP on the FST-2XT. The title is the first thing on screen
    // in chapter 1 and it contradicted everything under it.
    title: "Nothalt COP im FST-Fehlerspeicher",
    metadata: null,
    // Must equal getDemoUser().id. checkChatSessionWriteAccess grants write to
    // the session's creator; with rights_mode "private" and no RBAC entries,
    // any other value falls through to `return false` and the tour renders a
    // read-only composer.
    created_by: 0,
    session_items: [],
    rights_mode: "private",
    createdAt: "2026-08-27T08:00:00.000Z",
    updatedAt: "2026-08-27T08:05:00.000Z",
  },
];

/**
 * Chapter 1 shows one continuous conversation, so its three steps share a
 * world. Later chapters vary theirs per step (e.g. ingestion, where the
 * pipeline must look empty before and populated after).
 */
const BASE: DemoWorld = {
  agents: [AGENT],
  contexts: CONTEXTS,
  items: ITEMS,
  sessions: SESSIONS,
  // The real software documentation library, in EVERY chapter's world rather
  // than only chapter 2's. getWorld() sends chapters 5, 6 and 7 here by
  // default, and chapter 1's own answer cites a document in this context — so
  // when these lived in the ingestion fixture alone, opening Knowledge from any
  // other chapter showed the two placeholders below instead of the documents
  // the assistant had just quoted.
  itemsByContext: {
    [SOFTWARE_DOC_CONTEXT_ID]: SOFTWARE_DOC_ITEMS,
  },
};

export function techdocWorld(_step: number): DemoWorld {
  return BASE;
}

// Re-exported so existing importers keep working. The script itself lives in
// techdoc-turns.ts because it is verbatim production content and deserves to
// be edited (or not edited) as a unit, separately from the world fixtures.
export { TECHDOC_TURNS } from "./techdoc-turns";
