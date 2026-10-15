import type { DemoChapter } from "../tour";

export const configChapter: DemoChapter = {
  id: "config",
  // Runs on the product's real agent editor; `?wizard=` is a genuine deep
  // link into the retrieval wizard, not demo scaffolding.
  title: "Anpassen ohne Code",
  goal: "Der Assistent ist Konfiguration, die euer eigenes Team bedient.",
  steps: [
    {
      id: "config-overview",
      route: "/agents/edit/demo-agent-newton",
      anchor: "agent-agentic-retrieval",
      // "start", not the default "nearest": the card is below the fold on a
      // 6,400px page, and "nearest" parks its top at the viewport's bottom.
      scrollBlock: "start",
      title: "Der ganze KI-Assistent ist Konfiguration",
      content: [
        { kind: "figure", src: "/demo/ch3-config.webp", alt: "Der Assistent als Konfiguration" },
        {
          kind: "paragraph",
          text: "Kein Feintuning, kein Code. Wissensbasen, Routing-Regeln, Gedächtnis an, und das alles in einem Editor, den euer Team selbst bedienen kann.",
        },
      ],
    },
    {
      // SEVEN because the screen says seven: the summary card reads
      // "7 knowledge bases", the seventh being the assistant's own memory.
      id: "config-sources",
      route: "/agents/edit/demo-agent-newton?wizard=sources",
      anchor: "agent-wizard-sources",
      title: "Drei verschiedene Lesarten",
      content: [
        {
          kind: "paragraph",
          text: "Handbücher werden wie Dokumente gelesen, Support-Tickets wie Gespräche, die Servicedatenbank wie Datensätze. Jede Basis trägt einen Satz, wann der KI-Assistent dort nachschlägt. Die letzte ist sein eigenes Gedächtnis, dort landete deine Korrektur.",
        },
      ],
    },
    {
      id: "config-routing",
      route: "/agents/edit/demo-agent-newton?wizard=routing",
      anchor: "agent-wizard-routing",
      title: "Routing-Regeln in ganzen Sätzen",
      content: [
        {
          kind: "paragraph",
          text: "Fünf Regeln entscheiden, wo eine Frage zuerst landet und wohin sie gegebenenfalls ausweicht. Geschrieben als ganze Sätze und nicht als Code: Ein Fachexperte kann sie ohne Entwickler ändern.",
        },
      ],
    },
    {
      id: "config-vocabulary",
      route: "/agents/edit/demo-agent-newton?wizard=vocabulary",
      anchor: "agent-wizard-vocabulary",
      title: "Der KI-Assistent lernt eure Sprache",
      content: [
        {
          kind: "paragraph",
          text: "In unserem Beispiel sind hier 55 Abkürzungen aus der Aufzugstechnik hinterlegt, wie ADM, SHK, UCM. Dazu kommen Produktnamen und Normen. Deshalb findet eine Frage zum SHK die richtigen Seiten, egal wie sie formuliert ist.",
        },
      ],
    },
    {
      id: "config-behavior",
      route: "/agents/edit/demo-agent-newton?wizard=behavior",
      anchor: "agent-wizard-behavior",
      title: "Und wie gründlich er suchen soll",
      content: [
        {
          kind: "paragraph",
          text: "Wie viele Suchdurchläufe, wie viele Treffer, wann er aufgibt und ehrlich passt — hier findest du die Einstellung hinter der Absage aus Kapitel 6.",
        },
      ],
    },
  ],
};
