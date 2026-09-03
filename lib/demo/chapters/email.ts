import type { DemoChapter } from "../tour";
import { ALGI_ROUTINE_ID } from "../fixtures/chapter-email";

export const emailChapter: DemoChapter = {
  id: "email",
  // A second deployment, deliberately unnamed on screen: the point of the
  // switch is that a prospect stops watching one company's clever setup and
  // starts seeing a product that runs in more than one place.
  title: "Arbeitet, während Sie schlafen",
  steps: [
    {
      id: "email-routine",
      route: "/workflows",
      anchor: "routine-runs",
      size: "wide",
      title: "Ein zweiter Einsatz, dasselbe Produkt",
      content: [
        { kind: "figure", src: "/demo/ch6-email.webp", alt: "Die E-Mail-Routine" },
        {
          kind: "paragraph",
          text: "Ortswechsel: ein Hersteller hydraulischer Aufzugssysteme. Hier beantwortet der Assistent keine Fragen im Chat — er bearbeitet eingehende Ersatzteilanfragen per E-Mail, von selbst.",
        },
      ],
    },
    {
      id: "email-trigger",
      route: `/workflows/${ALGI_ROUTINE_ID}`,
      anchor: "routine-email-trigger",
      title: "Der Posteingang ist der Auslöser",
      content: [
        {
          kind: "paragraph",
          text: "Nur Absender der eigenen Domain starten die Routine — 60 pro Stunde, 10 je Absender. Keine Integration nötig: eine Weiterleitung genügt, den Rest übernimmt die Routine.",
        },
      ],
    },
    {
      id: "email-runs",
      route: `/workflows/${ALGI_ROUTINE_ID}`,
      anchor: "routine-runs",
      // "start" for the same reason as the chunks step: the anchor heads the
      // runs list, and the step is about the runs.
      scrollBlock: "start",
      title: "Auch die, die schiefgegangen sind",
      content: [
        {
          kind: "paragraph",
          text: "25 Läufe: 14 erledigt, 8 fehlgeschlagen, einer wartet auf einen Menschen, zwei abgewiesen. Dazwischen korrigiert ein Verkäufer die Entwürfe — und jede Korrektur wandert sofort ins Gedächtnis.",
        },
      ],
    },
  ],
};
