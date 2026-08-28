import type { Context } from "@/types/models/context";

/**
 * The six knowledge bases the Newlift deployment actually runs, using their
 * real context ids.
 *
 * The ids matter beyond cosmetics: chapter 1's answer cites
 * `software_documentation_context` and `zendesk_context`, and chapter 3's
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
    description: "Splits documents into chunks and generates embeddings.",
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
    "Technical documentation",
    "Technical manuals and datasheets for NEW LIFT controllers. Check here first for technical questions about products, error codes, parameters, and installation.",
  ),
  context(
    "vorschriften_context",
    "Standards & regulations",
    "Norms, standards, directives and regulations (DIN, EN, ISO, VDI, EU directives).",
  ),
  context(
    "software_documentation_context",
    "Software documentation",
    "Software release notes, updates and change documentation.",
  ),
  context(
    "custom_documents_context",
    "Custom documents",
    "Manually uploaded documents; broad backup source.",
  ),
  context(
    "zendesk_context",
    "Support tickets",
    "Support tickets and customer correspondence.",
  ),
  context(
    "new_servicedb_context",
    "Service database",
    "Structured service records.",
  ),
];
