import type { UIMessage } from "ai";

import type { ScriptedTurn } from "../script";
import RAW_FST_CHUNKS from "./chunks-fst2xt-de.json";

/** Chunk 0 of the document chapter 1 cites, verbatim from the deployment. */
const FST_CHUNK = RAW_FST_CHUNKS[0];

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
        // SHAPE MATTERS MORE THAN CONTENT HERE. This was `{ steps: [...] }`,
        // which nothing reads: computeContextSearchData takes `reasoning` and
        // `chunks` off the parsed result, so the retrieval card had no items
        // and never rendered — for the whole life of the demo. Chapter 1's
        // middle step, the one about retrieval being visible, was narrating an
        // element that was not on the page.
        //
        // `chunks` carries ONE entry rather than the two the answer cites.
        // Both citations are real, but only the software-documentation chunk's
        // text was exported from Newlift before the tunnel closed, and the
        // Zendesk one is not going to be invented to balance the card.
        output: {
          result: JSON.stringify({
            reasoning: RETRIEVAL_STEPS.map((text) => ({ text, tools: [] })),
            text: [],
            tools: [],
            chunks: [
              {
                chunk_content: FST_CHUNK.chunk_content,
                chunk_index: FST_CHUNK.chunk_index,
                chunk_id: FST_CHUNK.chunk_id,
                chunk_source: FST_CHUNK.chunk_source,
                chunk_metadata: {},
                chunk_created_at: FST_CHUNK.chunk_created_at,
                chunk_updated_at: FST_CHUNK.chunk_updated_at,
                item_id: "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c",
                item_external_id:
                  "FST/Software/fuer_FST-2XT/FST2XTchanges-customer-DE.docx",
                item_name: "FST2XTchanges-customer-DE.docx",
                item_created_at: "2026-02-23T01:24:45.861Z",
                item_updated_at: "2026-02-23T01:24:45.861Z",
                context: {
                  name: "software_documentation_context",
                  id: "software_documentation_context",
                },
              },
            ],
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

/** The question the engineer actually asked, from the tool call's own input. */
export const TECHDOC_QUESTION =
  'was bedeutet "Nothalt COP" im FST Fehlerspeicher?';

/**
 * The same exchange as scrollback — already on screen when chapter 1 opens.
 *
 * Chapter 1 used to start on an empty conversation and invite the visitor to
 * type. Two of its three steps anchor to things that only exist once a message
 * has been sent (the retrieval trace, the citations), so a visitor who simply
 * pressed Next — which is what most people on a guided tour do — got step 2
 * narrating "the assistant shows its work" over an empty screen. The tour
 * cannot depend on an action nothing prompts or enforces.
 *
 * Reaching the controller's sendUserMessage from the tour would mean either an
 * escape-hatch prop on SessionScreen or synthesising DOM events; opening
 * mid-conversation needs neither, and chapter 4 already works this way.
 *
 * What is lost is watching the answer stream in, which was the theatre. What
 * is kept is the artefact — the same tool trace, expandable, and the same
 * inline citations — every time, for every visitor. The composer stays live,
 * so anyone who types still gets a scripted reply.
 */
export const TECHDOC_SCROLLBACK: UIMessage[] = [
  {
    id: "techdoc-scrollback-user",
    role: "user",
    parts: [{ type: "text", text: TECHDOC_QUESTION }],
  },
  {
    id: "techdoc-scrollback-assistant",
    role: "assistant",
    parts: [
      { type: "step-start" },
      {
        // Shape copied from a real stored message, not guessed: the renderer
        // discriminates on `type` and reads `state`, and a part missing either
        // renders as nothing at all.
        type: "tool-Context_Search",
        toolCallId: TECHDOC_TURNS[0].toolCalls[0].toolCallId,
        state: "output-available",
        input: TECHDOC_TURNS[0].toolCalls[0].input,
        output: TECHDOC_TURNS[0].toolCalls[0].output,
      },
      { type: "step-start" },
      { type: "text", text: TECHDOC_TURNS[0].text },
    ],
  },
] as unknown as UIMessage[];
