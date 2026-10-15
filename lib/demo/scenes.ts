import { DEMO_BOOKING_URL } from "./routes";
import type { ContentBlock } from "./content";

/**
 * The four beats with no product screen behind them.
 *
 * They used to render full-bleed over the app, which is half of why the tour
 * felt "stuck together" — the presentation changed mid-story. They are pages
 * now, so the layout is the same on all 37 steps: content area plus the docked
 * panel. The app shell stays visible here deliberately; hiding it would
 * reintroduce exactly the mode-switch this change exists to remove.
 *
 * Keyed by the step id they serve, so a scene traces back to its beat.
 *
 * CONTENT ONLY — no title. Each of these four carried a `title` identical to
 * its step's, rendered as an <h1> on the page while the panel rendered the
 * same words as an <h2> beside it: the same sentence twice on one screen,
 * with nothing keeping the two in step. scripts/export-demo-copy.ts emits
 * only the step's, so a reviewer editing "Titel" in the sheet would have
 * changed one of the two. The step's title is now the only one.
 */
export const DEMO_SCENES: Record<string, { content: ContentBlock[] }> = {
  "daten-pile": {
    content: [
      {
        kind: "figure",
        src: "/demo/daten-pile.webp",
        alt: "Unstrukturierte Dokumente, E-Mails und Zeichnungen",
      },

      {
        kind: "stat",
        value: "10.000+",
        label: "Dokumente in einem typischen Aufzugsunternehmen",
      },

      {
        kind: "paragraph",
        text: "Handbücher, Datenblätter, Schaltpläne, E-Mails, Support-Tickets, Besprechungsaufzeichnungen. In jedem Unternehmen liegt das Wissen bereits vor — verteilt über Laufwerke, Postfächer und Köpfe.",
      },
    ],
  },
  "daten-problem": {
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
  "aufnahme-page": {
    content: [
      {
        kind: "figure",
        src: "/demo/aufnahme-page.webp",
        alt: "Eine PDF-Seite wird analysiert",
      },
      {
        kind: "sequence",
        steps: [
          "Seite als Bild analysieren — Tabellen, Zeichnungen, Beschriftungen",
          "In strukturierten Text übersetzen, Layout erhalten",
          "In Passagen zerlegen, die für sich verständlich bleiben",
          "Fachbegriffe, Typen und Fehlercodes herauslösen",
        ],
      },
      {
        kind: "paragraph",
        text: "Ein Schaltplan ist kein Fließtext. Wird er wie einer behandelt, findet die Suche ihn nie — deshalb wird jede Seite angesehen, nicht nur ausgelesen.",
      },
    ],
  },
  "zugriff-consequence": {
    content: [
      {
        kind: "figure",
        src: "/demo/zugriff.webp",
        alt: "Dieselbe Frage, zwei Berechtigungen",
      },
      {
        kind: "callout",
        tone: "fact",
        text: "Ein Assistent kann nur nennen, was der Fragende lesen darf. Das ist keine Zusicherung im Systemprompt, sondern eine Prüfung bei jedem Suchlauf.",
      },
      {
        kind: "paragraph",
        text: "Derselbe Assistent beantwortet die Frage eines Technikers also anders als die eines externen Gasts — ohne dass jemand dafür einen zweiten Assistenten bauen muss.",
      },
    ],
  },
  // Reached only from contact.1 — the one chapter allowed to name the
  // reference customers (lib/demo/chapters/index.test.ts skips it by id).
  "contact-close": {
    // No figure: the chapter's illustration sits on its opening step
    // (tour.test.ts, "illustrates chapter openings and nothing else"); here
    // the three numbers are the visual.
    content: [
      {
        kind: "paragraph",
        text: "NEW Lift Steuerungsbau (technische Dokumentation und Service) und ALGI Hydraulic (Angebots- und Ersatzteilprozesse) arbeiten produktiv mit OPEN IMP. Alles, was Sie eben gesehen haben, ist daraus abgeleitet — verallgemeinert, aber realistisch.",
      },
      { kind: "stat", value: "10", label: "Ihrer Handbücher" },
      { kind: "stat", value: "2 Wochen", label: "echte Fragen Ihres Serviceteams" },
      { kind: "stat", value: "30 Minuten", label: "reichen für die Planung" },
      {
        kind: "paragraph",
        text: "Zehn Ihrer Handbücher, zwei Wochen, echte Fragen Ihres Serviceteams — auf genau dem, was Sie eben gesehen haben. Dreißig Minuten reichen für die Planung.",
      },
      ...(DEMO_BOOKING_URL ? [{ kind: "cta" as const, label: "30-Minuten-Termin buchen", href: DEMO_BOOKING_URL }] : []),
    ],
  },
};

export function sceneRoute(id: string): string {
  return `/demo/szene/${id}`;
}
