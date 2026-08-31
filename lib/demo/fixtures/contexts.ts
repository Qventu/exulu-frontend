import type { Context } from "@/types/models/context";

/**
 * The six knowledge bases the Newlift deployment actually runs, using their
 * real context ids.
 *
 * The ids matter beyond cosmetics: chapter 1's answer cites
 * `software_documentation_context` and `support_tickets_context`, and chapter 3's
 * knowledge-search config routes between all six by id. With invented ids the
 * chapters would quietly contradict each other — citations pointing at contexts
 * the tour never shows, and a routing table referencing knowledge bases absent
 * from the Knowledge page.
 *
 * Descriptions are the per-source retrieval instructions from the production
 * configuration, which is also what the wizard's Sources step displays.
 */

const context = (
  id: string,
  name: string,
  description: string,
): Context => ({
  id,
  name,
  description,
  active: true,
  slug: id.replace(/_context$/, ""),
  embedder: { model: "text-embedding-3-large", queue: "embeddings" },
  configuration: {
    calculateVectors: "on_write",
    defaultRightsMode: "users",
  },
  processor: {
    name: "default",
    description: "Zerlegt Dokumente in Passagen und erzeugt Embeddings.",
    queue: "processing",
    trigger: "on_write",
    timeoutInSeconds: 600,
    generateEmbeddings: true,
  },
  sources: [],
  fields: [
    { name: "name", label: "Name", type: "shortText" },
    { name: "content", label: "Content", type: "longText" },
  ],
});

export const CONTEXTS: Context[] = [
  context(
    "tech_doc_context",
    "Technische Dokumentation",
    "Technical manuals and datasheets for NEW LIFT controllers. Check here first for technical questions about products, error codes, parameters, and installation.",
  ),
  context(
    "vorschriften_context",
    "Normen & Vorschriften",
    "Norms, standards, directives and regulations (DIN, EN, ISO, VDI, EU directives).",
  ),
  context(
    "software_documentation_context",
    "Software-Dokumentation",
    "Software release notes, updates and change documentation.",
  ),
  context(
    "custom_documents_context",
    "Eigene Dokumente",
    "Manually uploaded documents; broad backup source.",
  ),
  context(
    "support_tickets_context",
    "Support-Tickets",
    "Support tickets and customer correspondence.",
  ),
  context(
    "new_servicedb_context",
    "Servicedatenbank",
    "Structured service records.",
  ),
  // The agent's own memory. It is a context like any other, which is exactly
  // the point chapter 4 makes: a correction an engineer gives in chat becomes
  // a durable, inspectable, editable knowledge item rather than a hidden
  // fine-tune. The id is the production one — the memory Newton writes in
  // chapter 4 cites `context: newton_memory_context`.
  //
  // Unlike the six above, this description is written for the tour rather than
  // lifted from the production retrieval instructions.
  context(
    "newton_memory_context",
    "Assistenten-Gedächtnis",
    "Fakten, Präferenzen und Erkenntnisse, die Techniker dem Assistenten im Gespräch beigebracht haben.",
  ),
];
