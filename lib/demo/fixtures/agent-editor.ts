/**
 * Chapter 3's payload: the agent editor, and specifically the knowledge-search
 * wizard (Sources -> Routing -> Vocabulary -> Memory -> Behavior -> Review).
 *
 * The tool configuration below is Newlift's REAL production configuration,
 * exported from the running deployment and used with their approval. It is what
 * makes the chapter worth showing -- six knowledge bases across three distinct
 * content kinds, five plain-language routing rules, 55 German elevator
 * abbreviations taught to the retriever, identifier sets matched fuzzily for
 * product names and exactly for standards, and 8 mechanical query rewrites.
 *
 * It is reproduced in full rather than trimmed. An earlier version cut the
 * glossary to 18 terms because a shorter list "reads better"; that was the
 * wrong call. The length IS the point -- a prospect scrolling 55 real terms is
 * seeing how much domain knowledge a deployment actually accumulates, which no
 * abbreviated sample conveys.
 *
 * ONE departure, recorded so nobody mistakes it for the record: production
 * gives new_servicedb_context the instructions "Support tickets and customer
 * correspondence." -- verbatim the same string as support_tickets_context, evidently a
 * copy-paste. Reproducing it would show the same sentence twice on the Sources
 * step and read as a bug in the product rather than in one config field. It is
 * "Strukturierte Servicedatensätze." here. Everything else is byte-for-byte.
 */

const KNOWLEDGE_BASES = {
  tech_doc_context: {
    enabled: true,
    kind: "documents",
    instructions:
      "Technische Handbücher und Datenblätter für FST-Steuerungen. Bei Fragen zu Produkten, Fehlercodes, Parametern und Installation zuerst hier nachschlagen.",
    overrides: {},
  },
  vorschriften_context: {
    enabled: true,
    kind: "documents",
    instructions:
      "Normen, Standards, Richtlinien und Vorschriften (DIN, EN, ISO, VDI, EU-Richtlinien).",
    overrides: {},
  },
  software_documentation_context: {
    enabled: true,
    kind: "documents",
    instructions: "Software-Release-Notes, Updates und Änderungsdokumentation.",
    overrides: {},
  },
  custom_documents_context: {
    enabled: true,
    kind: "documents",
    instructions: "Manuell hochgeladene Dokumente; breite Ausweichquelle.",
    overrides: {},
  },
  support_tickets_context: {
    enabled: true,
    kind: "conversations",
    instructions: "Support-Tickets und Kundenkorrespondenz.",
    overrides: {
      limit: 10,
    },
  },
  new_servicedb_context: {
    enabled: true,
    kind: "records",
    instructions: "Strukturierte Servicedatensätze.",
    overrides: {
      limit: 10,
    },
  },
};

const ROUTING = {
  rules: [
    {
      id: "technical",
      label: "Technik",
      description:
        "Die Frage betrifft ein konkretes Produkt, System oder Bauteil — Abmessungen, Fehlercodes, Spezifikationen und Ähnliches.",
      main: ["tech_doc_context"],
      fallback: [
        "new_servicedb_context",
        "support_tickets_context",
        "custom_documents_context",
        "software_documentation_context",
      ],
    },
    {
      id: "service",
      label: "Service",
      description:
        "Es wird gezielt nach einem Ticket oder einer Kundenkorrespondenz gefragt.",
      main: ["support_tickets_context", "new_servicedb_context"],
      fallback: ["custom_documents_context"],
    },
    {
      id: "software",
      label: "Software",
      description: "Es wird gezielt nach Software-Updates oder Änderungen gefragt.",
      main: ["software_documentation_context"],
      fallback: [
        "new_servicedb_context",
        "support_tickets_context",
        "tech_doc_context",
        "vorschriften_context",
        "custom_documents_context",
      ],
    },
    {
      id: "regulatory",
      label: "Vorschriften",
      description:
        "Es wird gezielt nach einer Vorschrift, Norm oder gesetzlichen Anforderung gefragt.",
      main: [
        "vorschriften_context",
        "support_tickets_context",
        "new_servicedb_context",
      ],
      fallback: [
        "tech_doc_context",
        "software_documentation_context",
        "custom_documents_context",
      ],
    },
    {
      id: "market",
      label: "Markt",
      description:
        "Es wird nach Marktinformationen gefragt — Marktanteile, Trends, Marktgröße und Ähnliches.",
      main: [
        "tech_doc_context",
        "vorschriften_context",
        "software_documentation_context",
        "support_tickets_context",
        "new_servicedb_context",
        "custom_documents_context",
      ],
      fallback: ["custom_documents_context"],
    },
  ],
};

const VOCABULARY = {
  glossary: [
    {
      term: "ABS",
      meaning: "Absinkschutz",
    },
    {
      term: "ADM",
      meaning: "Außenrufmodul (auch Außendrückermodul genannt)",
    },
    {
      term: "AKM",
      meaning: "Aufzugswärterkabinenmodul (Zusatzmodul in der Kabine)",
    },
    {
      term: "ASM",
      meaning: "Aufzugswärterschaltschrankmodul (Zusatzmodul im Schaltschrank)",
    },
    {
      term: "ASV",
      meaning: "Aufsetzvorrichtung (verhindert Absinken bei schweren Lasten)",
    },
    {
      term: "AUX",
      meaning: "Rückholsteuerung (Hilfssteuerung im Schaltschrank)",
    },
    {
      term: "AWE",
      meaning: "Aufzugswärtereinheit",
    },
    {
      term: "AWM",
      meaning: "Aufzugswärtermodul",
    },
    {
      term: "CBM / CBM2",
      meaning: "Contactorless Brake Module (schützloses Bremsmodul)",
    },
    {
      term: "CMM",
      meaning: "Critical Module Monitoring (Überwachung kritischer LON-Module)",
    },
    {
      term: "DMS",
      meaning: "Dehnungsmessstreifen (Sensor zur Lastmessung)",
    },
    {
      term: "DMT",
      meaning:
        "Destino Mechanical Terminal (Zielrufterminal mit mechanischen Tasten)",
    },
    {
      term: "DOOR-Relais",
      meaning: "Relais der Safebox für die Türüberbrückung",
    },
    {
      term: "EAZ",
      meaning: "Etagenanzeige / Etagenanzeiger",
    },
    {
      term: "ECO",
      meaning: "Homelift-Steuerung (Steuerung für Plattformlifte)",
    },
    {
      term: "EVAC",
      meaning: "Evakuierungssignal / Notevakuierung",
    },
    {
      term: "FK / FKT",
      meaning: "Fahrkorb / Fahrkorbtür",
    },
    {
      term: "FPA",
      meaning: "Fahrkorbpaneladapter (ersetzt 50-polige Tableauverdrahtung)",
    },
    {
      term: "FPE",
      meaning: "Fahrkorbpanelerweiterung (Erweiterung für mehr Innenrufe)",
    },
    {
      term: "FPM",
      meaning: "Fahrkorbpanelmodul (Steuerung der Innentableaus)",
    },
    {
      term: "FSM",
      meaning: "Fahrkorbsteuermodul (Schnittstelle zu allen Fahrkorbsignalen)",
    },
    {
      term: "FSM-CAN",
      meaning:
        "CAN-Modul für FSM (zur Entstörung von Sicherheitskreiseingängen)",
    },
    {
      term: "FST",
      meaning: "Feldbussteuerung (das zentrale Steuerungssystem)",
    },
    {
      term: "GB",
      meaning: "Geschwindigkeitsbegrenzer",
    },
    {
      term: "GND",
      meaning: "Ground (Bezugspotential 0 V / Masse)",
    },
    {
      term: "GST",
      meaning: "Gruppensteuerung / Gruppensteuerungsplatine",
    },
    {
      term: "HEM",
      meaning: "Hängekabelentkopplungsmodul (zur Entstörung bei langen Kabeln)",
    },
    {
      term: "HHT",
      meaning: "Hand Held Terminal (Handterminal zur Parametrierung)",
    },
    {
      term: "HSG",
      meaning: "Hilfsstromgerät / Hilfsspannungsquelle",
    },
    {
      term: "KO",
      meaning: "Korrektur Oben (Schalter/Magnet am Schachtkopf)",
    },
    {
      term: "KU",
      meaning: "Korrektur Unten (Schalter/Magnet an der Schachtgrube)",
    },
    {
      term: "L",
      meaning: "Live wire (Außenleiter / spannungsführender Leiter)",
    },
    {
      term: "LBG",
      meaning: "LON-Bluetooth-Gateway (verbindet LON-Bus mit Mobilgeräten)",
    },
    {
      term: "LCS",
      meaning: "Lastwiegesystem (Load-Control-System)",
    },
    {
      term: "LED",
      meaning: "Leuchtdiode",
    },
    {
      term: "LON",
      meaning: "Local Operating Network (verwendete Netzwerktechnologie)",
    },
    {
      term: "LSU",
      meaning: "Laufzeitüberwachung (Sammelbegriff für Überwachungsfehler)",
    },
    {
      term: "MRL",
      meaning: "Maschinenraumlos (Aufzug ohne separaten Triebwerksraum)",
    },
    {
      term: "MSB-RC / MSB2",
      meaning: "Montagesteuerbirne (kabellos oder kabelgebunden)",
    },
    {
      term: "NBM",
      meaning: "Notbetrieb-Monitor (Anzeige zur Personenbefreiung)",
    },
    {
      term: "PE",
      meaning: "Protective Earth (Schutzleiter)",
    },
    {
      term: "RIO",
      meaning: "Remote I/O (I/O-Erweiterungsmodul am LON-Bus)",
    },
    {
      term: "S1 / Safebox",
      meaning: "Sicherheitssystem (magnetbandbasiert)",
    },
    {
      term: "SAM",
      meaning: "Sprachausgabemodul",
    },
    {
      term: "SBR",
      meaning: "Sicherheitsbremse (oder Relais für SBR/ABS)",
    },
    {
      term: "SG",
      meaning: "Schachtgrube",
    },
    {
      term: "SHK",
      meaning: "Sicherheitskreis",
    },
    {
      term: "SK",
      meaning: "Schachtkopf",
    },
    {
      term: "TCH",
      meaning: "Teach-Modus",
    },
    {
      term: "TDF",
      meaning: "Modul für Temperatur, Druck und Feuchte",
    },
    {
      term: "UCM",
      meaning: "Unintended Car Movement (unbeabsichtigte Fahrkorbbewegung)",
    },
    {
      term: "UGW",
      meaning: "Universal Gateway (Schnittstelle zwischen Protokollen)",
    },
    {
      term: "ve",
      meaning: "Einfahrgeschwindigkeit",
    },
    {
      term: "MIPA",
      meaning: "Montage-, Inbetriebnahme- & Prüfanleitung",
    },
    {
      term: "LS",
      meaning: "Lichtschrank",
    },
  ],
  identifiers: [
    {
      name: "Product names",
      description:
        "Produkt- und Steuerungsnamen wie FST, ECO, CBM-2. Stamm und volle Form zurückgeben (FST-3 → FST und FST-3).",
      examples: ["FST", "FST-2XT", "ECO", "CBM-2", "PAM", "EAZ"],
      strategy: "fuzzy",
      contexts: ["tech_doc_context"],
    },
    {
      name: "Norms and standards",
      description:
        'Norms, standards, directives or regulations — e.g. "DIN 8100", "DIN EN ISO 8100-1-2", "EN 81-20", "VDI 4707", "2014/33/EU".',
      examples: [
        "DIN 8100",
        "EN 81-20",
        "VDI 4707",
        "2014/33/EU",
        "ISO 8100-1",
      ],
      strategy: "exact",
      contexts: ["vorschriften_context"],
    },
  ],
  rewrites: [
    {
      find: "umgehung",
      replace: "bypass",
    },
    {
      find: "fehlt",
      replace: "FEHL",
    },
    {
      find: "fehler",
      replace: "FEHL",
    },
    {
      find: "störung",
      replace: "FEHL",
    },
    {
      find: "eingang",
      replace: "INPUT",
    },
    {
      find: "ausgang",
      replace: "OUTPUT",
    },
    {
      find: "input",
      replace: "INPUT",
    },
    {
      find: "output",
      replace: "OUTPUT",
    },
  ],
  styleHint:
    "Deutsche technische Handbücher für Aufzugssteuerungen: Menüpfade, Parameter, Klemmen, Register, Bit-Belegungen, Funktionsnamen und Fehlercodes (z.B. S2-FEHL.CMP-INPUT).",
};

/**
 * The saved tool config, in the product's own storage shape: an array of
 * `{ name, type, variable }` where JSON-typed options are stringified. The
 * wizard parses this, so a plain nested object here would leave every step
 * showing its defaults -- a wizard that renders perfectly and reflects nothing.
 */
export const CONTEXT_SEARCH_TOOL = {
  // Must match AGENTIC_RETRIEVAL_TOOL.id: the section matches the agent's
  // installed tool against the catalogue by id, not by name.
  id: "agentic_context_search",
  type: "tool",
  name: "Context Search",
  config: [
    { name: "instructions", type: "string", variable: "" },
    { name: "reranker", type: "string", variable: "cohere/rerank-v4.0-pro" },
    {
      name: "utility_model",
      type: "string",
      variable: "gemini-3.1-flash-lite",
    },
    { name: "max_steps", type: "number", variable: "3" },
    { name: "managed_context", type: "boolean", variable: "false" },
    {
      name: "require_preselected_contexts",
      type: "boolean",
      variable: "false",
    },
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

/**
 * The deployment's tool catalogue entry. The Knowledge section looks for a tool
 * with exactly this id before rendering the Agentic retrieval card
 * (hooks.ts:587, sections/knowledge.tsx) -- an empty catalogue hides the wizard
 * entirely while leaving the rest of the editor looking perfectly healthy.
 *
 * The catalogue carries the config SCHEMA, not values: switching the card on
 * maps over this to stage empty entries (`toggleAgentic`). Derived from the
 * saved config above so the two cannot drift into disagreeing about which
 * options exist -- which is why it is declared after it.
 */
export const AGENTIC_RETRIEVAL_TOOL = {
  id: "agentic_context_search",
  name: "Context Search",
  category: "knowledge",
  description:
    "Multi-phase retrieval over the configured knowledge bases: routing, search, rerank.",
  type: "tool",
  config: CONTEXT_SEARCH_TOOL.config.map(({ name, type }) => ({
    name,
    type,
    variable: "",
  })),
};
