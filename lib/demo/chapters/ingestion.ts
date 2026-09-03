import type { DemoChapter } from "../tour";

export const ingestionChapter: DemoChapter = {
  id: "ingestion",
  // Trimmed from four steps to two on review: the pipeline step highlighted
  // a screen of form fields and "stays current" highlighted nothing at all.
  // What survives of both lives in these two bodies.
  title: "Woher das Wissen kommt",
  steps: [
    {
      id: "ingestion-library",
      route: "/data/software_documentation_context",
      anchor: "knowledge-items",
      size: "wide",
      title: "Niemand hat diese Dateien hochgeladen",
      content: [
        { kind: "figure", src: "/demo/ch2-ingestion.webp", alt: "Dokumente fließen automatisch in die Wissensbasis" },
        {
          kind: "paragraph",
          text: "Neun Dokumente, direkt aus der Dateiablage des Herstellers — deutsche und englische Fassungen nebeneinander. Neue Revisionen erscheinen hier von selbst, und der Assistent wählt pro Frage die passende.",
        },
      ],
    },
    {
      id: "ingestion-chunks",
      route:
        "/data/software_documentation_context/items/d92dd3f2-2803-41e4-8136-a1a0ccb99e6c?section=embeddings",
      anchor: "item-chunks",
      // "start": the anchor heads a 93-row list. "nearest" left the header at
      // the bottom edge and every chunk below the fold — the visible screen
      // was empty form fields under a step about the chunks.
      scrollBlock: "start",
      title: "Was die Suche wirklich durchsucht",
      content: [
        {
          kind: "paragraph",
          text: "Das Handbuch, zerlegt in 93 einzeln durchsuchbare Passagen. Genau deshalb kann eine Antwort einen Absatz zitieren statt nur einen Dateinamen — eine davon haben Sie in Kapitel 2 geöffnet.",
        },
      ],
    },
  ],
};
