import type { DemoChapter } from "../tour";

export const configChapter: DemoChapter = {
  id: "config",
  // Runs on the product's real agent editor; `?wizard=` is a genuine deep
  // link into the retrieval wizard, not demo scaffolding.
  title: "Anpassen ohne Code",
  steps: [
    {
      id: "config-overview",
      route: "/agents/edit/demo-agent-newton",
      anchor: "agent-agentic-retrieval",
      size: "wide",
      title: "Der ganze Assistent ist Konfiguration",
      content: [
        { kind: "figure", src: "/demo/ch3-config.webp", alt: "Der Assistent als Konfiguration" },
        {
          kind: "paragraph",
          text: "Kein Feintuning, kein Code. Sieben Wissensbasen, fünf Routing-Regeln, Gedächtnis an — alles in einem Editor, den Ihr eigenes Team bedienen kann.",
        },
      ],
    },
    {
      // SEVEN because the screen says seven: the summary card reads
      // "7 knowledge bases", the seventh being the assistant's own memory.
      id: "config-sources",
      route: "/agents/edit/demo-agent-newton?wizard=sources",
      anchor: "agent-wizard-sources",
      placement: "left",
      title: "Sieben Wissensbasen, drei Lesarten",
      content: [
        {
          kind: "paragraph",
          text: "Handbücher werden wie Dokumente gelesen, Support-Tickets wie Gespräche, die Servicedatenbank wie Datensätze. Jede Basis trägt einen Satz, wann der Assistent dort nachschlägt. Die siebte ist sein eigenes Gedächtnis — dort landete eben Ihre Korrektur.",
        },
      ],
    },
    {
      id: "config-routing",
      route: "/agents/edit/demo-agent-newton?wizard=routing",
      anchor: "agent-wizard-routing",
      placement: "left",
      title: "Routing, in ganzen Sätzen",
      content: [
        {
          kind: "paragraph",
          text: "Fünf Regeln entscheiden, wo eine Frage zuerst landet und wohin sie ausweicht. Geschrieben als Sätze, nicht als Code — ein Fachexperte ändert sie ohne Entwickler.",
        },
      ],
    },
    {
      id: "config-vocabulary",
      route: "/agents/edit/demo-agent-newton?wizard=vocabulary",
      anchor: "agent-wizard-vocabulary",
      placement: "left",
      title: "Er lernt Ihre Sprache",
      content: [
        {
          kind: "paragraph",
          text: "55 Abkürzungen aus der Aufzugstechnik — ADM, SHK, UCM — dazu Produktnamen und Normen. Deshalb findet eine Frage zum SHK die richtigen Seiten, egal wie sie formuliert ist.",
        },
      ],
    },
    {
      id: "config-behavior",
      route: "/agents/edit/demo-agent-newton?wizard=behavior",
      anchor: "agent-wizard-behavior",
      placement: "left",
      title: "Und wie gründlich er sucht",
      content: [
        {
          kind: "paragraph",
          text: "Wie viele Suchdurchläufe, wie viele Treffer, wann er aufgibt und ehrlich passt — die Einstellung hinter der Absage aus Kapitel 6.",
        },
      ],
    },
  ],
};
