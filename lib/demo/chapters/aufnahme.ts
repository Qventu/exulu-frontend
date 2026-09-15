import type { DemoChapter } from "../tour";
import { SOFTWARE_DOC_CONTEXT_ID } from "../fixtures/software-docs";
import { sceneRoute } from "../scenes";

const CTX = `/data/${SOFTWARE_DOC_CONTEXT_ID}`;

/**
 * Chapter 3 — what actually happens to a document.
 *
 * The knowledge base fills on the real /data/[ctx] screen, and between the
 * second and third of those steps a SCENE page interrupts to show the part no
 * product screen can: a PDF page being read. That beat routes to
 * /demo/szene/aufnahme-page (lib/demo/scenes.ts) rather than carrying an
 * anchor, because its subject is not on the product screen at all — there is
 * nothing to point at. It is a page like every other step now, not a
 * full-bleed takeover: the panel stays docked beside it.
 *
 * Every step waits for a click. The timers that used to chain the three
 * ingestion worlds were removed on 2026-09-14.
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
    },
    {
      // Routes to a scene (lib/demo/scenes.ts) rather than CTX: its copy is
      // the conclusion the previous two steps build toward, with nothing on
      // screen to point at.
      id: "aufnahme-page",
      route: sceneRoute("aufnahme-page"),
      anchor: null,
      title: "Was mit einer Seite geschieht",
      content: [],
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
