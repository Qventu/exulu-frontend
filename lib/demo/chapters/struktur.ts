import type { DemoChapter } from "../tour";

/**
 * Chapter 2 — structure is the price of access.
 *
 * The list fills across three steps because motion here IS the argument: a
 * prospect watching seven knowledge bases appear understands "we organise your
 * data" faster than any sentence saying so. Each step is a complete world
 * (fixtures/chapter-structure.ts), so the chapter menu can land on any of them.
 *
 * All three wait for a click. The timers that used to chain them were removed
 * on 2026-09-14 — "so schnell ist halt keiner zum Lesen" — so the motion now
 * costs the visitor two clicks. What keeps those clicks honest is
 * lib/demo/tour.test.ts's "never puts two consecutive steps on the same
 * anchor": struktur-filling and struktur-full share a route and an anchor on
 * purpose, and that test passes only because the world underneath visibly
 * moves (3 knowledge bases to 7).
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
