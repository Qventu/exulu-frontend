import type { DemoChapter } from "../tour";
import { SOFTWARE_DOC_CONTEXT_ID } from "../fixtures/software-docs";

const CTX = `/data/${SOFTWARE_DOC_CONTEXT_ID}`;

/**
 * Chapter 3 — what actually happens to a document.
 *
 * The list fills across three auto-advancing steps, then a STAGE interrupts to
 * show the part no product screen can: a PDF page being read. That beat is a
 * stage rather than a popover because its subject is not on the page behind
 * it — there is nothing to anchor to, and dimming a screen to point at nothing
 * is worse than covering it deliberately.
 *
 * The nine documents are real (fixtures/software-docs.ts) and chapter 5 cites
 * one of them, so a visitor meets that citation having watched the file
 * arrive. The knowledge base fills 0 → 4 → 7 → 9 across the four steps below —
 * fixtures/chapter-aufnahme.ts's own `COUNTS` — not the eighteen an earlier
 * draft of this plan miscounted.
 */
export const aufnahmeChapter: DemoChapter = {
  id: "aufnahme",
  title: "Aufnahme",
  steps: [
    {
      id: "aufnahme-empty",
      route: CTX,
      anchor: "knowledge-items",
      scrollBlock: "start",
      title: "Niemand lädt das von Hand hoch",
      content: [
        {
          kind: "paragraph",
          text: "Dokumente kommen aus dem Laufwerk, aus SharePoint, über die API — oder per Upload, wenn es einmal schnell gehen muss. Die Basis beginnt leer.",
        },
      ],
      // This step is reached by a CROSS-ROUTE navigation (struktur's /data ->
      // this chapter's /data/[ctx]) landing on an ANCHORED step
      // ("knowledge-items"), and the auto-advance timer starts on the URL
      // change, not once the anchor is actually on screen. shepherd-step.ts
      // gives that anchor up to ANCHOR_WAIT_MS (4000ms) to resolve, so the
      // budget here has to exceed navigation + Apollo + anchor resolution or
      // this step — "Die Basis beginnt leer", the beat the whole 0 → 4 → 9
      // fill depends on — gets skipped before a visitor ever reads it. Raised
      // from 2000 to 3600, matching the same-class fix in struktur.ts
      // (2200 -> 3600).
      advanceAfterMs: 3600,
    },
    {
      id: "aufnahme-running",
      route: CTX,
      anchor: "knowledge-items",
      scrollBlock: "start",
      title: "Die Aufnahme läuft",
      content: [
        {
          kind: "paragraph",
          text: "Jede Datei durchläuft dieselbe Strecke. Bei tausend Dokumenten dauert das Stunden und niemand sieht dabei zu — hier ist es beschleunigt.",
        },
      ],
      advanceAfterMs: 2000,
    },
    {
      id: "aufnahme-page",
      route: CTX,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Was mit einer Seite geschieht",
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
      advanceAfterMs: 5200,
    },
    {
      id: "aufnahme-items",
      route: CTX,
      anchor: "knowledge-items",
      scrollBlock: "start",
      title: "Neun Dokumente, durchsuchbar",
      content: [
        {
          kind: "paragraph",
          text: "Aus jeder Datei sind Passagen geworden, jede mit ihrer Herkunft verknüpft. Das ist es, was die Suche in Kapitel 5 tatsächlich durchsucht — und warum jede Aussage dort eine Quelle nennen kann.",
        },
      ],
    },
  ],
};
