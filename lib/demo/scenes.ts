import type { ContentBlock } from "./content";
import { bookingUrl, stepMedium } from "./booking";

/**
 * utm_medium of the closing step's buttons: chapter 12, step "contact-close".
 * The number is written here because this module cannot see CHAPTERS (the
 * chapters import it); tour.test.ts asserts it against the real position.
 */
const CLOSING_MEDIUM = stepMedium(12, "contact-close");

/** The offer's button, or nothing when the booking link is unset (see routes.ts). */
function offerCta(label: string, campaign: string): { cta?: { label: string; href: string } } {
  const href = bookingUrl(campaign, CLOSING_MEDIUM);
  return href ? { cta: { label, href } } : {};
}

/**
 * The four beats with no product screen behind them.
 *
 * They used to render full-bleed over the app, which is half of why the tour
 * felt "stuck together" — the presentation changed mid-story. They are pages
 * now, so the layout is the same on all 38 steps: content area plus the docked
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
        label: "Dokumente in einem typischen technischen Unternehmen",
      },

      {
        kind: "paragraph",
        text: "Handbücher, Datenblätter, Schaltpläne, E-Mails, Support-Tickets, Besprechungsaufzeichnungen, in den Köpfen eurer Mitarbeiter — hier stecken die Antworten auf fast jede technische Frage.",
      },
    ],
  },
  "daten-problem": {
    content: [
      {
        kind: "bullets",
        items: [
          "Niemand weiß, welches Dokument das richtige ist",
          "Niemand weiß, welche Fassung die gültige ist",
          "Die, die die Antworten kennen, sind in absehbarer Zeit in Rente",
        ],
      },
      {
        kind: "paragraph",
        text: "KI kann hier die Lösung sein. Aber ein Sprachmodell ohne Zugriff auf diese Unterlagen erfindet Antworten. Und ein Sprachmodell mit ungeordnetem Zugriff findet die falsche Fassung. Beides ist schlimmer als keine Antwort.",
      },
      {
        kind: "callout",
        tone: "fact",
        text: "Die nächsten Kapitel zeigen, was dazwischen liegt — und dass es Konfiguration ist, kein leeres Versprechen.",
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
        text: "Ein KI-Assistent kann nur nennen, was der Fragende lesen darf. Das ist keine Zusicherung im Systemprompt, sondern eine Prüfung der Nutzer-Berechtigung bei jedem Suchlauf.",
      },
      {
        kind: "paragraph",
        text: "Derselbe Assistent beantwortet die Frage eines Technikers also anders als die eines externen Gasts — ohne dass jemand dafür einen zweiten KI-Assistenten bauen muss.",
      },
    ],
  },
  // Reached only from contact.1 — the one chapter allowed to name the
  // reference customers (lib/demo/chapters/index.test.ts skips it by id).
  "contact-close": {
    // The chapter's only step: marketing's offer (2026-10-20), word for word
    // — the three-month trial at half price, one box, one ask. The second
    // path of sub-project 8 ("Vollwertig") is gone; the utm_campaign stays
    // "probe-3-monate" (lib/demo/booking.ts). No customer names; the `logos`
    // block kind stays for when the files and the decision exist.
    //
    // \u00A0 joins number and unit: at 100 % zoom the old price line broke
    // between "−50" and "%" (marketing's screenshot).
    //
    // "Bis Ende des Jahres" expires on 2026-12-31 — review the note then.
    content: [
      {
        kind: "offer",
        kicker: "Dein nächster Schritt",
        title: "Teste OPEN IMP mit deinen Dokumenten – 50 % Rabatt für Schnellstarter.",
        subtitle: "Keine Theorie mehr: Erlebe den Mehrwert direkt an deinen eigenen Dateien. Wir übernehmen die Einrichtung für dich.",
        box: {
          title: "3-Monats-Testphase zum Vorzugspreis",
          price: "600 € / Monat",
          priceNote: "50 % Rabatt auf den regulären Preis",
          items: [
            "Produktive Instanz startklar in zwei Tagen",
            "Unbegrenzte Dokumente, Transkripte und Aufnahmen",
            "Keine Systemintegration für den Start nötig",
            "Abrechnung variabler Kosten (Tokens) nach Nutzung, zzgl. 20 % Servicegebühr",
          ],
          note: "Limitiertes Onboarding: Bis Ende des Jahres vergeben wir noch maximal 15 Setup-Plätze.",
        },
        ...offerCta("Planungsgespräch buchen & Rabatt sichern", "probe-3-monate"),
        microCopy: "30 Minuten unverbindlicher Austausch: Wir klären offene Fragen und besprechen eure Datenbasis für das Setup.",
      },
    ],
  },
};

export function sceneRoute(id: string): string {
  return `/demo/szene/${id}`;
}
