import type { DemoChapter } from "../tour";
import { ALGI_ROUTINE_ID } from "../fixtures/chapter-email";
import { ALGI_CHAT, ALGI_RUNS_OPEN } from "../routes";

export const emailChapter: DemoChapter = {
  id: "email",
  // A second deployment, deliberately unnamed on screen: the point of the
  // switch is that a prospect stops watching one company's clever setup and
  // starts seeing a product that runs in more than one place.
  title: "Arbeitet, während du schläfst",
  goal: "Dasselbe Produkt bearbeitet Ersatzteilanfragen, ohne dass jemand fragt.",
  steps: [
    {
      id: "email-routine",
      route: "/workflows",
      anchor: "routine-runs",
      title: "Gleiches Produkt, anderer Einsatzzweck",
      content: [
        { kind: "figure", src: "/demo/ch6-email.webp", alt: "Die E-Mail-Routine" },
        {
          kind: "paragraph",
          text: "Ein weiteres Anwendungsbeispiel für OPEN IMP: Bei einem Hersteller hydraulischer Aufzugssysteme beantwortet der KI-Assistent keine Fragen im Chat — er bearbeitet eingehende Ersatzteilanfragen selbstständig per E-Mail.",
        },
      ],
    },
    {
      id: "email-trigger",
      route: `/workflows/${ALGI_ROUTINE_ID}`,
      anchor: "routine-email-trigger",
      title: "Euer Posteingang ist der Auslöser",
      content: [
        {
          kind: "paragraph",
          text: "Eine Routine können nur Absender der eigenen Domain starten: 60 pro Stunde, 10 je Absender. Und dafür ist keine Integration nötig, eine Weiterleitung reicht und den Rest übernimmt die Routine für euch.",
        },
      ],
    },
    {
      id: "email-runs",
      route: ALGI_RUNS_OPEN,
      anchor: "routine-run-open",
      scrollBlock: "start",
      title: "Fünfundzwanzig Anfragen, von selbst bearbeitet",
      content: [
        {
          kind: "paragraph",
          text: "In zwei Wochen sind hier 25 Anfragen eingegangen und ohne Zutun bearbeitet worden. Eine ist geöffnet: eine Ersatzteilanfrage per Mail, mit Absender und Betreff. Was daraus wurde, siehst du im nächsten Schritt.",
        },
      ],
    },
    {
      id: "email-request",
      route: ALGI_CHAT,
      anchor: "chat-messages",
      scrollBlock: "start",
      title: "Worum es geht",
      content: [
        {
          kind: "paragraph",
          text: "Die Mail oben ist die Anfrage: ein Dichtungssatz für einen Hydraulikheber, Kommissionsnummer dabei. Der Assistent hat den Katalog durchsucht und einen Angebotsentwurf geschrieben — drei Positionen, Preise, Empfehlung. Ein Verkäufer hat ihn dreimal korrigiert; jede Korrektur ist ins Gedächtnis gewandert.",
        },
      ],
    },
    {
      id: "email-approval",
      route: ALGI_CHAT,
      anchor: "chat-tool-approval",
      title: "Der eine, der auf einen Menschen wartet",
      content: [
        {
          kind: "paragraph",
          text: "Das ist der Lauf, der wartet: Der Assistent hat die Anfrage gelesen, den Katalog durchsucht und drei Korrekturen des Verkäufers übernommen — und fragt jetzt, bevor er die Antwort an den Kunden schickt. Gesendet wird erst, wenn ein Mensch es freigibt.",
        },
      ],
    },
  ],
};
