import type { UIMessage } from "ai";

import type { ScriptedTurn } from "../script";

/**
 * Chapter 4's script is a REAL correction from the Newlift deployment (staging
 * session b6251e12), reproduced with Newlift's approval. An engineer tells
 * Newton its answer is wrong, supplies the right menu path, and Newton writes
 * it to memory. The memory item it created — 2f78a38c — is still live in the
 * production memory context today, carrying exactly the text below.
 *
 * Nothing here is invented. Same rule as chapter 1: if this content is ever
 * edited for polish, it stops being evidence.
 *
 * Note what the assistant does BEFORE the correction. It does not bluff: it
 * says the exact menu path is not in the retrieved excerpts, offers what it did
 * find, and cites it. The correction loop is worth showing precisely because
 * the starting point is an honest miss rather than a hallucination.
 *
 * DEPARTURE, recorded so nobody mistakes it for the record: the three
 * Knowledge_context_search calls in the scrollback returned 137-200 KB of
 * matched chunks each (55 per call). Carrying ~500 KB of chunk text in a source
 * fixture is not defensible, and this chapter is about the correction, not
 * retrieval — chapter 1 shows a retrieval trace in full. The tool parts are
 * therefore omitted from the scrollback; the assistant TEXT is verbatim, and
 * its inline {item_name: ...} citations still render because the renderer
 * parses them out of the text itself.
 */

/**
 * Turns 1-4, already on screen when the chapter opens, exactly as a resumed
 * conversation would look. The visitor only sends the correction.
 */
export const MEMORY_SCROLLBACK: UIMessage[] = [
  {
    id: "1nV5QZkSQW5t5Puc",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Wie wird bei der FST-2 die Kalibrierfahr gestartet?",
      },
    ],
  },
  {
    id: "msg_-5h09RLKj1VvjCAfz",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Die Anleitung zum Starten einer Kalibrierfahrt für die FST-2 finden Sie in der Montage- & Inbetriebnahmeanleitung FST-2 (Dokument: mia_fst2-2s_2015-05_de.pdf {item_name: mia_fst2-2s_2015-05_de.pdf, item_id: 2bf5e9cb-e4c3-4911-8f23-78f0c9357579, context: tech_doc_context, chunk_id: 67d46153-d4ee-4d5a-bb31-ada5c7483fb6, chunk_index: 4}). Dort ist unter Punkt 6.4 auf Seite 41 beschrieben, wie die Kalibrierfahrt durchgeführt wird.",
      },
    ],
  },
  {
    id: "AY4bz42pvRTjppnI",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Kannst Du mir das bitte zusammenfassen?",
      },
    ],
  },
  {
    id: "msg_-yRGkvozi8iM5uk2J",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Gerne. Die genaue Anleitung zum Starten einer Kalibrierfahrt bei der FST-2 finden Sie in der Montage- & Inbetriebnahmeanleitung FST-2 (Dokument: mia_fst2-2s_2015-05_de.pdf {item_name: mia_fst2-2s_2015-05_de.pdf, item_id: 2bf5e9cb-e4c3-4911-8f23-78f0c9357579, context: tech_doc_context, chunk_id: 67d46153-d4ee-4d5a-bb31-ada5c7483fb6, chunk_index: 4}) unter Punkt 6.4 auf Seite 41. Ohne den Inhalt dieser Seite kann ich Ihnen die genauen Schritte hier leider nicht zusammenfassen.",
      },
    ],
  },
  {
    id: "nQDafFEOvx8H5FmK",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Und bei der FST-2XT?",
      },
    ],
  },
  {
    id: "msg_-gQ2T1UY8ds5g4y6Z",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: 'Für die FST-2XT gibt es ebenfalls Informationen zur Kalibrierfahrt. Aus den vorliegenden Dokumenten und Service-Tickets geht hervor, dass die FST-2XT automatische Kalibrier- und Lernfahrten durchführen kann {item_name: br_FST-2XT_2019-10_de.pdf, item_id: 7443180b-fb88-49a5-8f4c-818bd2b282d6, context: tech_doc_context, chunk_id: ede0acf3-073d-4ab4-b489-66e71cb6caa7, chunk_index: 3}.\n\nHier sind einige Hinweise aus den gefundenen Quellen, wie eine Kalibrierfahrt eingeleitet oder vorbereitet werden könnte:\n\n*   **Vorbereitung:** In einem Fall wurde die Lösung genannt, im Montagemodus den untersten Halt einzustellen und die Etage [n] zu setzen, bevor eine Kalibrierfahrt durchgeführt wird. Eine Lernfahrt geht der Kalibrierfahrt oft voraus {item_name: TC160283 - Seit Umbau auf neue FST-2XT läßt sich keine Kalibrierfahrt durchführen., item_id: dc542b91-fd2b-4397-9889-3c063639b061, context: new_servicedb_context, chunk_id: 80905994-185d-40e0-b070-4ffbecbe1e29, chunk_index: 0}.\n*   **Durchführung nach Einstellungen:** Nach Änderungen am Antrieb (z.B. mit ALGI) oder an den Einfahrtwegen ist oft eine "Neu kalibrieren" notwendig, nachdem ein Backup gespeichert, Türen gesperrt und die Außensteuerung ausgeschaltet wurde {item_name: TC161892 - Probleme mit dem Antrieb Mit ALGI den Antrieb neu eingestellt und die Einfahrtwege in der FST-2XT von Hand "nachgestellt" Aufzug fährt aber nicht bündig Lernfahrt und Kalibrierfahrt erfolgreich beend, item_id: 878c9b3e-c9f9-4d8d-bb00-de8672183402, context: new_servicedb_context, chunk_id: 2aa627de-4b0b-4daf-ae3b-0b3cb5ade0c6, chunk_index: 0}.\n*   **Im Kontext der Inbetriebnahme:** "Lern- und Kalibrierfahrt durchführen" ist ein allgemeiner Schritt bei der Inbetriebnahme einer FST-2XT {item_name: TC221811 - Nach Kurzschluß (Spannung?) FST-2XT, FSM-2, FPM ersetzt FPM und RIO- Module bereits abgezogen Nun Fernabschaltung SRC00 05 00 08 00 Nun Volllast X1.17 # im Display Türstatus wechselt permanent UCM, item_id: 68c8b7ce-57ef-4544-a378-ac326f8574ee, context: new_servicedb_context, chunk_id: 2d39faba-12da-40fa-8889-29e3f15e5683, chunk_index: 0}.\n\nFür eine detaillierte Schritt-für-Schritt-Anleitung sollten Sie die "FST-2XT Montage- & Inbetriebnahmeanleitung" konsultieren, da dieses Handbuch spezifische Anweisungen für die Inbetriebnahme der FST-2XT enthalten würde. Die gefundenen Handbücher für die FST-2XT MRL (z.B. hb_FST-2XT-MRL_2013-11_de.pdf {item_name: hb_FST-2XT-MRL_2013-11_de.pdf, item_id: 8a6a88ef-235a-46b2-bf37-00ef781317cc, context: tech_doc_context, chunk_id: 2cf2c1f0-03c2-48c8-87a0-ce2569a26bf0, chunk_index: 15} und hb_FST-2XT-MRL_2014-01_en.pdf {item_name: hb_FST-2XT-MRL_2014-01_en.pdf, item_id: d4b9b89c-fd97-4572-b51f-ada977e76677, context: tech_doc_context, chunk_id: 42bd8d0a-cd0b-4dee-8308-31d3e744bd0d, chunk_index: 16}) sprechen unter Punkt 3.3 vom "Prüfen der Treibfähigkeit", was ähnliche Fahrten beinhaltet.',
      },
    ],
  },
  {
    id: "7g5rOiLhgsK0IVfo",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Mit welchem Menüpunkt erfolgt die Kalibrierfahrt?",
      },
    ],
  },
  {
    id: "msg_-t9HElXHg5mPy8Cof",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: 'Die genauen Menüpunkte für die Kalibrierfahrt der FST-2XT sind in den vorliegenden Dokumentenauszügen nicht direkt als detaillierter Pfad wie "HAUPTMENUE/Kalibrierfahrt" aufgeführt.\n\nAllerdings wird mehrfach erwähnt, dass die Kalibrierfahrt oft nach einer Lernfahrt und im Rahmen der Inbetriebnahme durchgeführt wird. Einige Hinweise deuten auf folgende Zusammenhänge hin:\n\n*   **Vorbedingungen:** Es wird erwähnt, dass man in den Montagemodus wechseln, die unterste Haltestelle setzen ("Etage [n] setzen") und gegebenenfalls eine Lernfahrt durchführen muss, bevor die Kalibrierfahrt startet {item_name: TC160283 - Seit Umbau auf neue FST-2XT läßt sich keine Kalibrierfahrt durchführen., item_id: dc542b91-fd2b-4397-9889-3c063639b061, context: new_servicedb_context, chunk_id: 80905994-185d-40e0-b070-4ffbecbe1e29, chunk_index: 0}.\n*   **Kombinierte Fahrten:** Oftmals wird von "Lern- und Kalibrierfahrt durchführen" gesprochen {item_name: TC221811 - Nach Kurzschluß (Spannung?) FST-2XT, FSM-2, FPM ersetzt FPM und RIO- Module bereits abgezogen Nun Fernabschaltung SRC00 05 00 08 00 Nun Volllast X1.17 # im Display Türstatus wechselt permanent UCM, item_id: 68c8b7ce-57ef-4544-a378-ac326f8574ee, context: new_servicedb_context, chunk_id: 2d39faba-12da-40fa-8889-29e3f15e5683, chunk_index: 0}, was darauf hindeutet, dass dies zusammenhängende Prozesse sind.\n*   **Allgemeine Funktion:** Die FST-2XT bietet "Automatische Kalibrier- und Lernfahrten" als Funktion {item_name: br_FST-2XT_2019-10_de.pdf, item_id: 7443180b-fb88-49a5-8f4c-818bd2b282d6, context: tech_doc_context, chunk_id: 3f937b20-af86-43a9-b86e-7f439910db39, chunk_index: 4}.\n\nFür die exakte Menüführung sollten Sie das vollständige "FST-2XT Montage- & Inbetriebnahmeanleitung" konsultieren, da dort die detaillierten Schritte und Menüpfade für die Kalibrierfahrt beschrieben sein sollten.',
      },
    ],
  },
];

/** The row envelopes the GetAgentSessionMessages resolver replays them in. */
export const MEMORY_SCROLLBACK_ROWS = [
  {
    id: "9aadca7a-4de3-469a-8af5-ddc2f1b52164",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:20:37.386931+00:00",
  },
  {
    id: "44d0de31-e1f3-4543-bcd0-f59eca3aecae",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:20:37.393705+00:00",
  },
  {
    id: "0abb500c-e17f-4ae5-8476-8959456a7510",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:21:35.199387+00:00",
  },
  {
    id: "a0292bdb-1de4-4360-8fc4-4b59967edc25",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:21:35.202184+00:00",
  },
  {
    id: "da5160ac-bbc2-4c29-be4c-4db18638cd8f",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:22:21.279167+00:00",
  },
  {
    id: "4adaca17-a116-440c-af33-0fb092aee747",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:22:21.282596+00:00",
  },
  {
    id: "7aa03ffe-1561-40a5-aad7-2a968816dad1",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:26:08.911629+00:00",
  },
  {
    id: "7dbd93fd-4e79-4efc-9116-61668a0cc242",
    session: "b6251e12-1624-4197-a9b4-0ad657bae7f1",
    createdAt: "2026-01-06T08:26:08.91686+00:00",
  },
] as const;

/** What the visitor is prompted to send. Verbatim, typos and emphasis intact. */
export const MEMORY_CORRECTION_PROMPT =
  'Die Antwort ist leider falsch, der Menüpunkt lautet "HAUPTMENUE/Konfig/Inbetriebnahme/Kalibrierfahrt"! Merke Dir das bitte!';

export const MEMORY_TURNS: ScriptedTurn[] = [
  {
    id: "memory-turn-1",
    toolCalls: [
      {
        toolCallId: "sNAdn51QiSj4NLpW",
        // The AI SDK derives the part type `tool-Create_Newton_Memory_Item`
        // from this name. Memory is a TOOL, not a hidden side effect — the
        // visitor watches the write happen, which is the whole point.
        toolName: "Create_Newton_Memory_Item",
        input: {
          name: "FST-2XT Kalibrierfahrt Menüpunkt",
          description:
            "Menüpunkt zum Starten der Kalibrierfahrt bei der FST-2XT",
          information:
            "Der Menüpunkt zum Starten der Kalibrierfahrt bei der FST-2XT lautet: HAUPTMENUE/Konfig/Inbetriebnahme/Kalibrierfahrt.",
        },
        output: {
          result:
            "Created Newton Memory Item with the following ID: 2f78a38c-3ba9-4c78-9053-0517065c5e2d",
        },
      },
    ],
    text: "Die Information, dass der Menüpunkt für die Kalibrierfahrt bei der FST-2XT unter **HAUPTMENUE/Konfig/Inbetriebnahme/Kalibrierfahrt** zu finden ist, wurde in meinem Gedächtnis gespeichert. Vielen Dank für die Korrektur!",
    sources: [],
  },
];

/**
 * The correction and its reply, as scrollback.
 *
 * The visitor is asked to send this themselves and the transport replays it
 * when they do — but chapter 4's third step anchors to the memory tool call,
 * and a visitor who simply clicks Next never sent anything. From that step on
 * the exchange is on screen either way. See scrollbackFor().
 */
export const MEMORY_CORRECTION_EXCHANGE: UIMessage[] = [
  {
    id: "memory-correction-user",
    role: "user",
    parts: [{ type: "text", text: MEMORY_CORRECTION_PROMPT }],
  },
  {
    id: "memory-correction-assistant",
    role: "assistant",
    parts: [
      { type: "step-start" },
      {
        type: "tool-Create_Newton_Memory_Item",
        toolCallId: MEMORY_TURNS[0].toolCalls[0].toolCallId,
        state: "output-available",
        input: MEMORY_TURNS[0].toolCalls[0].input,
        output: MEMORY_TURNS[0].toolCalls[0].output,
      },
      { type: "step-start" },
      { type: "text", text: MEMORY_TURNS[0].text },
    ],
  },
] as unknown as UIMessage[];
