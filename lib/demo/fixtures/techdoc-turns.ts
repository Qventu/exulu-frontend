import type { ScriptedTurn } from "../script";

/**
 * Chapter 1's script is a REAL, positively-rated exchange from the Newlift
 * deployment (session b5597e32, feedback score 1), reproduced with Newlift's
 * approval. The retrieval trace, the answer and its inline citations are all as
 * the production system produced them.
 *
 * Nothing here is invented, and that is the point: the tour's credibility rests
 * on this being a true record rather than a plausible-sounding reconstruction.
 * If this content is ever edited for polish, it stops being evidence.
 *
 * The steps array is trimmed to those that read well on screen; the wording of
 * each is unchanged. The production call also returned ~640 KB of matched
 * chunks, which the tool card does not display and which are omitted.
 */

const RETRIEVAL_STEPS = [
  "Classified the request as: technical because: The user is asking for the meaning of a specific error code (Nothalt COP) in a technical system (FST error log).",
  "Main contexts: tech_doc_context, Fallback contexts: new_servicedb_context, zendesk_context, custom_documents_context, software_documentation_context",
  "Detected Product names in the question: FST",
  "Reranking 321 chunks",
  "Rerank_score min: 0.5979366, Rerank_score max: 0.8704211",
  "Using fallback search in new_servicedb_context, zendesk_context, custom_documents_context, software_documentation_context",
  "Memory prioritizes specific document(s); pinning 2 file(s) into the search: FST2XTchanges-customer-DE.docx, MIPA_FST-3_DE.pdf",
];

const CITE_SWDOC =
  "{item_name: FST2XTchanges-customer-DE.docx, item_id: d92dd3f2-2803-41e4-8136-a1a0ccb99e6c, context: software_documentation_context, chunk_id: 02d50a8f-e703-4461-9c0c-5ab6c695cdfd, chunk_index: 0}";
const CITE_ZENDESK =
  "{item_name: FST Meldung, item_id: e9e5c0df-d9cb-442e-ae13-85528da96a84, context: zendesk_context, chunk_id: ce3ecab9-ca4b-4cb0-b646-fccff533a445, chunk_index: 0}";

/**
 * The `{item_name: ...}` markers are not noise — message-renderer.tsx parses
 * them into inline citations, so keeping them verbatim is what makes citations
 * render exactly as the product renders them.
 */
const ANSWER = `Die Meldung **„Nothalt COP“** im FST-Fehlerspeicher bezieht sich auf die Betätigung des Nothalt- bzw. Not-Aus-Schalters direkt im Fahrkorb (COP steht für *Car Operating Panel*, also das Fahrkorbtableau) ${CITE_SWDOC}.

Hier sind die genauen Hintergründe und Details zu dieser Meldung:

### 1. Bedeutung und Funktion
Die Steuerung registriert mit diesem Eintrag, dass der **Not-Aus-Knopf in der Kabine betätigt wurde, während der Aufzug in einer Etage steht und die Türen geöffnet sind** ${CITE_ZENDESK}.

### 2. Typischer Hintergrund (Fehlbedienung)
In der Praxis wird diese Funktion häufig genutzt, um **Fehlbedienungen aufzudecken**. Oft missbrauchen Mitarbeiter oder externe Firmen den Not-Aus-Schalter in der Kabine, um den Aufzug gezielt auf einer Etage zu blockieren (beispielsweise für längere Be- oder Entladearbeiten), anstatt die dafür vorgesehene Ladefunktion zu nutzen ${CITE_ZENDESK}. Durch den Eintrag im Fehlerspeicher lässt sich dieses Verhalten nachvollziehen und analysieren.

### 3. Software-Versionen und Überwachung
* **Ab Version V0184:** Im Zuge verbesserter Überwachungsfunktionen für Industrie- und Lastenaufzüge wurde die Erkennung verfeinert, um genau zu protokollieren, wenn der Notausschalter im Fahrkorb bei offenen Türen im Stand betätigt wird ${CITE_SWDOC}.
* **Ab Version V0188:** Die Signalisierung wurde offiziell als **„Nothalt COP“** benannt und in das Fernüberwachungssystem **Elevision 4.0** integriert, sodass dieser Zustand auch in der Live-Ansicht der Cloud-Überwachung direkt angezeigt wird ${CITE_SWDOC}.

Falls dieser Fehler bei einer Anlage sehr häufig oder sporadisch ohne ersichtlichen Grund auftritt, empfiehlt es sich, die Verdrahtung des Not-Aus-Schalters im Innentableau (COP) sowie das Hängekabel auf Wackelkontakte zu überprüfen.`;

export const TECHDOC_TURNS: ScriptedTurn[] = [
  {
    id: "techdoc-turn-1",
    toolCalls: [
      {
        toolCallId: "tc-context-search-1",
        // Matches production: the AI SDK derives the part type
        // `tool-Context_Search` from this name, and that is what the real
        // renderer discriminates on.
        toolName: "Context_Search",
        input: {
          userQuery: 'was bedeutet "Nothalt COP" im FST Fehlerspeicher?',
          importantKeyword: "Nothalt COP",
          relevantKeywords: [
            "Nothalt COP",
            "FST Fehlerspeicher",
            "Fehlercode",
            "COP",
          ],
        },
        output: {
          result: JSON.stringify({
            steps: RETRIEVAL_STEPS.map((text) => ({
              stepNumber: 1,
              text,
              toolCalls: [],
              chunks: [],
              tokens: 0,
            })),
          }),
        },
      },
    ],
    text: ANSWER,
    // Empty by design: production emits no source-url parts for this agent.
    // Citations travel inline in the text and the renderer extracts them, so
    // synthetic source chunks here would diverge from what the product does.
    sources: [],
  },
];
