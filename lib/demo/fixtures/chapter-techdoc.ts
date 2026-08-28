import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";
import type { DemoWorld } from "../types";

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
  instructions:
    "You are Newton, a technical documentation assistant for Newlift GmbH. " +
    "Answer questions about elevator control board maintenance, fault codes, " +
    "and applicable EN/DIN standards. Always cite the source document.",
  rights_mode: "public",
};

const CTX_TECHDOC: Context = {
  id: "ctx-techdoc",
  name: "Technical documentation",
  description:
    "Manufacturer documentation for elevator control boards, including " +
    "wiring diagrams, fault-code tables, and maintenance procedures.",
  active: true,
  slug: "techdoc",
  configuration: {
    calculateVectors: "on_write",
    defaultRightsMode: "users",
  },
  processor: {
    name: "pdf-extractor",
    description: "Extracts text and tables from PDF technical manuals.",
    queue: "default",
    trigger: "upload",
    timeoutInSeconds: 120,
    generateEmbeddings: true,
  },
  sources: [
    {
      id: "src-manual-upload",
      name: "Manual upload",
      description: "Service engineers upload PDFs through the web interface.",
      config: {},
    },
  ],
  fields: [
    {
      name: "title",
      label: "Title",
      type: "shortText",
      required: true,
      editable: true,
    },
    {
      name: "document_number",
      label: "Document number",
      type: "shortText",
      editable: true,
    },
    {
      name: "revision",
      label: "Revision",
      type: "shortText",
      editable: true,
    },
    {
      name: "content",
      label: "Content",
      type: "longText",
      editable: false,
    },
  ],
};

const CTX_VORSCHRIFTEN: Context = {
  id: "ctx-vorschriften",
  name: "Standards & regulations",
  description:
    "Applicable EN, ISO, and DIN standards for elevator installations, " +
    "safety components, and periodic inspections.",
  active: true,
  slug: "vorschriften",
  configuration: {
    calculateVectors: "on_write",
    defaultRightsMode: "users",
  },
  processor: {
    name: "pdf-extractor",
    description: "Extracts clauses and definitions from standards documents.",
    queue: "default",
    trigger: "upload",
    timeoutInSeconds: 180,
    generateEmbeddings: true,
  },
  sources: [
    {
      id: "src-standards-upload",
      name: "Standards upload",
      description: "Compliance team uploads current standards PDFs.",
      config: {},
    },
  ],
  fields: [
    {
      name: "title",
      label: "Title",
      type: "shortText",
      required: true,
      editable: true,
    },
    {
      name: "standard_number",
      label: "Standard number",
      type: "shortText",
      editable: true,
    },
    {
      name: "edition",
      label: "Edition",
      type: "shortText",
      editable: true,
    },
    {
      name: "content",
      label: "Content",
      type: "longText",
      editable: false,
    },
  ],
};

const CONTEXTS: Context[] = [CTX_TECHDOC, CTX_VORSCHRIFTEN];

const ITEMS: Item[] = [
  {
    id: "item-ctrl-3000-manual",
    name: "CTRL-3000 Service Manual Rev. 4",
    description: "Full service manual for the CTRL-3000 elevator control board.",
    source: "src-manual-upload",
    tags: ["ctrl-3000", "service-manual", "fault-codes"],
    chunks_count: 248,
    createdAt: "2025-03-12T09:00:00.000Z",
    updatedAt: "2025-03-12T09:00:00.000Z",
  },
  {
    id: "item-en81-20",
    name: "EN 81-20:2024 Safety rules for lifts",
    description: "European standard for safety rules for the construction and installation of lifts.",
    source: "src-standards-upload",
    tags: ["en81", "safety", "installation"],
    chunks_count: 412,
    createdAt: "2025-01-08T10:30:00.000Z",
    updatedAt: "2025-01-08T10:30:00.000Z",
  },
];

const SESSIONS: AgentSession[] = [
  {
    id: "session-demo-techdoc-1",
    agent: DEMO_AGENT_ID,
    project: "demo-project",
    title: "Fault E47 on CTRL-3000",
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
};

export function techdocWorld(_step: number): DemoWorld {
  return BASE;
}

// Re-exported so existing importers keep working. The script itself lives in
// techdoc-turns.ts because it is verbatim production content and deserves to
// be edited (or not edited) as a unit, separately from the world fixtures.
export { TECHDOC_TURNS } from "./techdoc-turns";
