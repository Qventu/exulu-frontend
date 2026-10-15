import type { DemoChapter } from "../tour";
import { MEMORY_CONTEXT_ID, MEMORY_CONTRIBUTORS, MEMORY_COUNT_AFTER_CORRECTION } from "../fixtures/chapter-memory";
import { capitalise, germanCount } from "../fixtures/meeting-tally";
import { MEMORY_CHAT } from "../routes";

export const memoryChapter: DemoChapter = {
  id: "memory",
  title: "Ein Assistent, der mitlernt",
  goal: "Eine Korrektur im Chat wird zu Wissen für alle Kollegen.",
  steps: [
    {
      id: "memory-miss",
      route: MEMORY_CHAT,
      anchor: "chat-messages",
      title: "Wenn er etwas nicht weiß, sagt er das",
      content: [
        { kind: "figure", src: "/demo/ch4-memory.webp", alt: "Aus einer Korrektur wird ein Wissenseintrag" },
        {
          kind: "paragraph",
          text: "Ein Techniker fragt nach einem exakten Menüpfad. Der KI-Assistent nennt, was die Dokumente hergeben, belegt es, und erfindet nichts dazu.",
        },
      ],
    },
    {
      id: "memory-correct",
      route: MEMORY_CHAT,
      anchor: "chat-composer",
      title: "Fehler gefunden, der Techniker korrigiert",
      content: [
        {
          kind: "paragraph",
          text: "In diesem Beispiel hat der KI-Assistent den genauen Menüpfad nicht gefunden, nur die Stelle im Handbuch. Der Techniker schickt den richtigen Pfad zurück. Schau, was der KI-Assistent daraus macht.",
        },
      ],
    },
    // MEMORY_WRITTEN_AT_STEP in fixtures/chapter-memory.ts is tied to this
    // index: the memory must not appear in the knowledge base before this.
    {
      id: "memory-write",
      route: MEMORY_CHAT,
      anchor: "chat-tool-trace",
      title: "Aus der Korrektur wird Gedächtnis",
      content: [
        {
          kind: "paragraph",
          text: "Das Merken ist ein sichtbarer Schritt, kein verborgener Nebeneffekt. Du siehst genau, was gespeichert wurde.",
        },
      ],
    },
    {
      id: "memory-base",
      route: "/memory",
      anchor: "memory-bases",
      title: "Ein Gedächtnis, das dir gehört",
      content: [
        {
          kind: "paragraph",
          // The count is the fixture's, not typed: the row on screen shows it.
          text: `${capitalise(germanCount(MEMORY_COUNT_AFTER_CORRECTION))} Einträge, ein Assistent, ${germanCount(MEMORY_CONTRIBUTORS.length)} Beitragende — der jüngste ist deine Korrektur von eben; die meisten sind Beispieleinträge aus acht Wochen Servicealltag. Jeder Eintrag ist einsehbar, änderbar, löschbar.`,
        },
      ],
    },
    {
      id: "memory-map",
      route: `/memory/${MEMORY_CONTEXT_ID}`,
      anchor: "memory-map",
      scrollBlock: "start",
      title: "Ein Gedächtnis, das wächst",
      content: [
        {
          kind: "paragraph",
          text: "Jeder Punkt ist ein Eintrag, die Farben sind Themen. Der Zeitregler läuft einmal von selbst durch: Sieh zu, wie sich das Gedächtnis über acht Wochen füllt — aus Korrekturen, Hinweisen und Entscheidungen des Serviceteams. Die Einträge hier sind Beispieleinträge; die Mechanik ist die echte.",
        },
      ],
    },
  ],
};
