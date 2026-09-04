import type { DemoChapter } from "../tour";

/**
 * Chapter 2 — structure is the price of access.
 *
 * The list fills across three steps because motion here IS the argument: a
 * prospect watching seven knowledge bases appear understands "we organise your
 * data" faster than any sentence saying so. Each step is a complete world
 * (fixtures/chapter-structure.ts), so the Tour bubble can land on any of them.
 *
 * The first two steps auto-advance; the third waits. A chapter never
 * auto-advances off its own end — chapters/index.test.ts enforces that.
 */
export const strukturChapter: DemoChapter = {
  id: "struktur",
  title: "Struktur",
  steps: [
    {
      id: "struktur-empty",
      route: "/data",
      anchor: null,
      // The figure lives here, not on struktur-full where the payoff is. This
      // screen is blank — the figure fills a void instead of competing with
      // it. Putting it on struktur-full would compete with the very thing
      // the chapter spends the next two steps building up to: the filled
      // list itself. Do not "helpfully" move it there.
      size: "wide",
      title: "Wissen braucht einen Ort",
      content: [
        {
          kind: "figure",
          src: "/demo/struktur.webp",
          alt: "Geordnete Wissensbasen",
        },
        {
          kind: "paragraph",
          text: "Damit ein Assistent etwas nachschlagen kann, muss es irgendwo liegen — getrennt nach Art des Wissens, nicht in einem einzigen Topf.",
        },
      ],
      // Raised from 2200: a figure that flashes past in 2.2s is worse than
      // no figure.
      advanceAfterMs: 3600,
    },
    {
      id: "struktur-filling",
      route: "/data",
      anchor: "knowledge-contexts",
      scrollBlock: "start",
      title: "Eine Wissensbasis je Wissensart",
      content: [
        {
          kind: "paragraph",
          text: "Technische Dokumentation wird anders gelesen als ein Support-Ticket. Normen anders als eine Servicedatenbank. Jede Basis bekommt eigene Regeln.",
        },
      ],
      advanceAfterMs: 2200,
    },
    {
      id: "struktur-full",
      route: "/data",
      anchor: "knowledge-contexts",
      scrollBlock: "start",
      title: "Sieben Basen, sieben Lesarten",
      content: [
        {
          kind: "paragraph",
          text: "Diese sieben laufen in der gezeigten Umgebung. Die Anzahl ist nicht begrenzt — und welche ein Assistent durchsuchen darf, ist eine Einstellung pro Assistent, wie Kapitel 7 zeigt.",
        },
      ],
    },
  ],
};
