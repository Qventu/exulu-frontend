import type { DemoChapter } from "../tour";
import { MEMORY_CHAT } from "../routes";

export const memoryChapter: DemoChapter = {
  id: "memory",
  title: "Korrigieren",
  steps: [
    {
      id: "memory-miss",
      route: MEMORY_CHAT,
      anchor: "chat-messages",
      size: "wide",
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
      noDim: true,
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
      id: "memory-item",
      route: "/data/newton_memory_context",
      anchor: null,
      title: "Und ein Wissenseintrag, der Ihnen gehört",
      content: [
        {
          kind: "paragraph",
          text: "Die Korrektur liegt jetzt als Eintrag in einer eigenen Wissensbasis — einsehbar, änderbar, löschbar. Ab sofort bekommen alle Kollegen die richtige Antwort.",
        },
      ],
    },
  ],
};
