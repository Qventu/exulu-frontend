/**
 * Chapter 3's payload: the agent editor, and specifically the knowledge-search
 * wizard (Sources → Routing → Vocabulary → Memory → Behavior → Review).
 *
 * The tool configuration below is Newlift's REAL production configuration,
 * used with their approval. It is what makes the chapter worth showing — six
 * knowledge bases with distinct content kinds, five plain-language routing
 * rules, a domain glossary of German elevator abbreviations, identifier sets
 * matched fuzzily for product names and exactly for standards, and mechanical
 * query rewrites. None of it is invented.
 *
 * One deliberate departure from chapter 1's rule: the glossary is TRIMMED to a
 * representative subset (the production one runs to ~55 terms). Chapter 1's
 * answer is evidence and must stay verbatim; this is configuration shown to
 * illustrate a feature, where a shorter list reads better on screen and loses
 * nothing. If the full list is ever wanted, it is one query away.
 */

const KNOWLEDGE_BASES = {
  tech_doc_context: {
    enabled: true,
    kind: "documents",
    instructions:
      "Technical manuals and datasheets for NEW LIFT controllers. Check here first for technical questions about products, error codes, parameters, and installation.",
    overrides: {},
  },
  vorschriften_context: {
    enabled: true,
    kind: "documents",
    instructions:
      "Norms, standards, directives and regulations (DIN, EN, ISO, VDI, EU directives).",
    overrides: {},
  },
  software_documentation_context: {
    enabled: true,
    kind: "documents",
    instructions: "Software release notes, updates and change documentation.",
    overrides: {},
  },
  custom_documents_context: {
    enabled: true,
    kind: "documents",
    instructions: "Manually uploaded documents; broad backup source.",
    overrides: {},
  },
  // Tickets are matched by names and keywords rather than read like a manual —
  // the Sources step's whole point.
  zendesk_context: {
    enabled: true,
    kind: "conversations",
    instructions: "Support tickets and customer correspondence.",
    overrides: { limit: 10 },
  },
  new_servicedb_context: {
    enabled: true,
    kind: "records",
    instructions: "Structured service records.",
    overrides: { limit: 10 },
  },
};

const ROUTING = {
  rules: [
    {
      id: "technical",
      label: "Technical",
      description:
        "The question is related to a specific product, system or part, asks for things like dimensions, error codes, specifications, etc.",
      main: ["tech_doc_context"],
      fallback: [
        "new_servicedb_context",
        "zendesk_context",
        "custom_documents_context",
        "software_documentation_context",
      ],
    },
    {
      id: "service",
      label: "Service",
      description:
        "The user specifically asks for a Ticket, or a correspondence with a client",
      main: ["zendesk_context", "new_servicedb_context"],
      fallback: ["custom_documents_context"],
    },
    {
      id: "software",
      label: "Software",
      description:
        "The user specifically asks for software updates or changes",
      main: ["software_documentation_context"],
      fallback: ["new_servicedb_context", "zendesk_context", "tech_doc_context"],
    },
    {
      id: "regulatory",
      label: "Regulatory",
      description:
        "The user specifically asks for a regulation, standard, or legal requirement",
      main: ["vorschriften_context", "zendesk_context"],
      fallback: ["tech_doc_context", "custom_documents_context"],
    },
  ],
};

const VOCABULARY = {
  glossary: [
    { term: "ADM", meaning: "Außenrufmodul (auch Außendrückermodul genannt)" },
    { term: "ASV", meaning: "Aufsetzvorrichtung (verhindert Absinken bei schweren Lasten)" },
    { term: "AUX", meaning: "Rückholsteuerung (Hilfssteuerung im Schaltschrank)" },
    { term: "CBM / CBM2", meaning: "Contactorless Brake Module (schützloses Bremsmodul)" },
    { term: "CMM", meaning: "Critical Module Monitoring (Überwachung kritischer LON-Module)" },
    { term: "EAZ", meaning: "Etagenanzeige / Etagenanzeiger" },
    { term: "ECO", meaning: "Homelift-Steuerung (Steuerung für Plattformlifte)" },
    { term: "FK / FKT", meaning: "Fahrkorb / Fahrkorbtür" },
    { term: "FPM", meaning: "Fahrkorbpanelmodul (Steuerung der Innentableaus)" },
    { term: "FSM", meaning: "Fahrkorbsteuermodul (Schnittstelle zu allen Fahrkorbsignalen)" },
    { term: "FST", meaning: "Feldbussteuerung (das zentrale Steuerungssystem)" },
    { term: "HHT", meaning: "Hand Held Terminal (Handterminal zur Parametrierung)" },
    { term: "LON", meaning: "Local Operating Network (verwendete Netzwerktechnologie)" },
    { term: "LSU", meaning: "Laufzeitüberwachung (Sammelbegriff für Überwachungsfehler)" },
    { term: "MRL", meaning: "Maschinenraumlos (Aufzug ohne separaten Triebwerksraum)" },
    { term: "SHK", meaning: "Sicherheitskreis" },
    { term: "UCM", meaning: "Unintended Car Movement (unbeabsichtigte Fahrkorbbewegung)" },
    { term: "MIPA", meaning: "Montage-, Inbetriebnahme- & Prüfanleitung" },
  ],
  identifiers: [
    {
      name: "Product names",
      description:
        "NEW LIFT product and controller names such as FST, ECO, CBM-2. Return both stem and full form (FST-3 → FST and FST-3).",
      examples: ["FST", "FST-2XT", "ECO", "CBM-2", "PAM", "EAZ"],
      strategy: "fuzzy",
      contexts: ["tech_doc_context"],
    },
    {
      name: "Norms and standards",
      description:
        'Norms, standards, directives or regulations — e.g. "DIN 8100", "EN 81-20", "VDI 4707", "2014/33/EU".',
      examples: ["DIN 8100", "EN 81-20", "VDI 4707", "2014/33/EU", "ISO 8100-1"],
      strategy: "exact",
      contexts: ["vorschriften_context"],
    },
  ],
  rewrites: [
    { find: "umgehung", replace: "bypass" },
    { find: "fehler", replace: "FEHL" },
    { find: "störung", replace: "FEHL" },
    { find: "eingang", replace: "INPUT" },
    { find: "ausgang", replace: "OUTPUT" },
  ],
  styleHint:
    "Deutsche technische Handbücher für Aufzugssteuerungen (NEW LIFT): Menüpfade, Parameter, Klemmen, Register, Bit-Belegungen, Funktionsnamen und Fehlercodes (z.B. S2-FEHL.CMP-INPUT).",
};

/**
 * The saved tool config, in the product's own storage shape: an array of
 * `{ name, type, variable }` where JSON-typed options are stringified. The
 * wizard parses this, so a plain nested object here would leave every step
 * showing defaults.
 */
/**
 * The deployment's tool catalogue entry. The Knowledge section looks for a tool
 * with exactly this id before rendering the Agentic retrieval card
 * (sections/knowledge.tsx:44) — an empty catalogue hides the wizard entirely
 * while leaving the rest of the editor looking perfectly healthy.
 */
export const AGENTIC_RETRIEVAL_TOOL = {
  id: "agentic_context_search",
  name: "Context Search",
  category: "knowledge",
  description:
    "Multi-phase retrieval over the configured knowledge bases: routing, search, rerank.",
  type: "tool",
};

export const CONTEXT_SEARCH_TOOL = {
  // Must match AGENTIC_RETRIEVAL_TOOL.id: the section matches the agent's
  // installed tool against the catalogue by id, not by name.
  id: "agentic_context_search",
  type: "tool",
  name: "Context Search",
  config: [
    { name: "instructions", type: "string", variable: "" },
    { name: "reranker", type: "string", variable: "cohere/rerank-v4.0-pro" },
    { name: "utility_model", type: "string", variable: "gemini-3.1-flash-lite" },
    { name: "max_steps", type: "number", variable: "3" },
    { name: "managed_context", type: "boolean", variable: "false" },
    { name: "require_preselected_contexts", type: "boolean", variable: "false" },
    { name: "logging", type: "boolean", variable: "false" },
    { name: "project_search", type: "boolean", variable: "true" },
    {
      name: "knowledge_bases",
      type: "json",
      variable: JSON.stringify(KNOWLEDGE_BASES),
    },
    { name: "routing", type: "json", variable: JSON.stringify(ROUTING) },
    { name: "vocabulary", type: "json", variable: JSON.stringify(VOCABULARY) },
    {
      name: "memory",
      type: "json",
      variable: JSON.stringify({
        enabled: true,
        override: true,
        filePrioritization: true,
        queryAugmentation: true,
      }),
    },
    {
      name: "tuning",
      type: "json",
      variable: JSON.stringify({
        topK: 10,
        fallbackThreshold: 0.95,
        pinBoost: 0.15,
        identifierBoost: 0.15,
        pageWindow: 1,
        maxQueriesPerContext: 5,
      }),
    },
  ],
};
