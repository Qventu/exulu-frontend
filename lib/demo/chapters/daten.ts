import type { DemoChapter } from "../tour";
import { TECHDOC_CHAT } from "../routes";

/**
 * Chapter 1 — the problem, before any product.
 *
 * A stage rather than a popover: there is nothing on screen to point at yet,
 * and a cinematic opening is not a tooltip over a dimmed application. The
 * route is the chat only so that the app behind the overlay is a coherent
 * screen if the stage animates out before the next navigation lands.
 *
 * This chapter replaces the old `intro`, which opened on a chat window and
 * asked the visitor to be impressed by a citation before they had any reason
 * to care. The tour now starts where the customer's problem starts.
 */
export const datenChapter: DemoChapter = {
  id: "daten",
  title: "Ihre Daten",
  steps: [
    {
      id: "daten-pile",
      route: TECHDOC_CHAT,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Das Wissen ist längst da",
      content: [
        {
          kind: "figure",
          src: "/demo/daten-pile.webp",
          alt: "Unstrukturierte Dokumente, E-Mails und Zeichnungen",
        },
        {
          kind: "paragraph",
          text: "Handbücher, Datenblätter, Schaltpläne, E-Mails, Support-Tickets, Besprechungsaufzeichnungen. In jedem Unternehmen liegt das Wissen bereits vor — verteilt über Laufwerke, Postfächer und Köpfe.",
        },
        {
          kind: "stat",
          value: "10.000+",
          label: "Dokumente in einem typischen Aufzugsunternehmen",
        },
      ],
      advanceAfterMs: 4200,
    },
    {
      id: "daten-problem",
      route: TECHDOC_CHAT,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Nur nicht in einer Form, mit der eine KI arbeiten kann",
      content: [
        {
          kind: "bullets",
          items: [
            "Niemand weiß, welche Fassung die gültige ist",
            "Dieselbe Frage wird jedes Jahr neu beantwortet",
            "Wer die Antwort kennt, ist gerade im Urlaub",
          ],
        },
        {
          kind: "paragraph",
          text: "Ein Sprachmodell ohne Zugriff auf diese Unterlagen erfindet plausible Antworten. Ein Sprachmodell mit ungeordnetem Zugriff findet die falsche Fassung. Beides ist schlimmer als keine Antwort.",
        },
        {
          kind: "callout",
          tone: "fact",
          text: "Die nächsten Kapitel zeigen, was dazwischen liegt — und dass es Konfiguration ist, kein Versprechen.",
        },
      ],
    },
  ],
};
