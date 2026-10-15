import type { DemoChapter } from "../tour";
import { MEMORY_COUNT_AFTER_CORRECTION } from "../fixtures/chapter-memory";
import { capitalise, germanCount } from "../fixtures/meeting-tally";
import { MEMORY_CHAT } from "../routes";

export const memoryChapter: DemoChapter = {
  id: "memory",
  title: "Korrigieren",
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
          text: "Ein Techniker fragt nach einem exakten Menüpfad. Der Assistent nennt, was die Dokumente hergeben, belegt es — und erfindet nichts dazu.",
        },
      ],
    },
    {
      id: "memory-correct",
      route: MEMORY_CHAT,
      anchor: "chat-composer",
      title: "Der Techniker korrigiert",
      content: [
        {
          kind: "paragraph",
          text: "Der Techniker schickt den richtigen Menüpfad zurück. Sehen Sie, was der Assistent daraus macht.",
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
          text: "Das Merken ist ein sichtbarer Werkzeugaufruf, kein verborgener Nebeneffekt. Sie sehen genau, was gespeichert wurde.",
        },
      ],
    },
    {
      id: "memory-base",
      route: "/memory",
      anchor: "memory-bases",
      title: "Ein Gedächtnis, das Ihnen gehört",
      content: [
        {
          kind: "paragraph",
          // The count is the fixture's, not typed: the row on screen shows it.
          text: `${capitalise(germanCount(MEMORY_COUNT_AFTER_CORRECTION))} Einträge, ein Assistent, ein Beitragender — der jüngste ist Ihre Korrektur von eben. Jeder Eintrag ist einsehbar, änderbar, löschbar; ab sofort bekommen alle Kollegen die richtige Antwort.`,
        },
      ],
    },
  ],
};
