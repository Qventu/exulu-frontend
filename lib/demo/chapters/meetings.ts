import type { DemoChapter } from "../tour";
import { ALGI_MEETING_ID, ALGI_MEETING_TALLY as T } from "../fixtures/chapter-meetings";
import { capitalise, germanCount } from "../fixtures/meeting-tally";

/**
 * The review PAGE, not the old `?review=` sheet. /transcriptions redirects
 * the legacy param to this route and drops everything else in the query —
 * the tour position included — so the chapter goes straight there.
 */
const REVIEW = `/transcriptions/review/${ALGI_MEETING_ID}`;

export const meetingsChapter: DemoChapter = {
  id: "meetings",
  // The recordings, durations and statuses are from a live deployment; the
  // work instruction in the last step is the one artefact the product did
  // not produce, and the body says so on screen.
  title: "Festhalten, was besprochen wurde",
  goal: "Aus Besprechungen werden Dokumente, die jemand liest.",
  steps: [
    {
      id: "meetings-list",
      route: "/transcriptions",
      anchor: "transcriptions",
      title: `${capitalise(germanCount(T.hours))} Stunden, die niemand nachhören wird`,
      content: [
        { kind: "figure", src: "/demo/ch7-meetings.webp", alt: "Von der Aufzeichnung zur Arbeitsanweisung" },
        {
          kind: "paragraph",
          text: `${T.count} Besprechungen, aufgezeichnet von einem Bot, der einfach mitkommt — Produktionsplanung, Service, Schulung. ${capitalise(germanCount(T.cancelled, true))} abgebrochen, ${germanCount(T.failed, true)} fehlgeschlagen.`,
        },
      ],
    },
    {
      id: "meetings-guide",
      route: REVIEW,
      anchor: "meeting-guide",
      // The outputs render at the BOTTOM of the review sheet's scroll;
      // "start" brings the document itself on screen, not just its header.
      scrollBlock: "start",
      title: "Also wird ein Dokument daraus",
      content: [
        {
          kind: "paragraph",
          text: "Dieselbe Besprechung als Arbeitsanweisung: Freigabe prüfen, Lüftung nicht aus der Kabinentür ableiten, offene Punkte benennen. Alles Entschiedene, nichts vom Rauschen. Dieses eine Dokument entstand von Hand — der Kunde hat den Schritt noch nicht ausgeführt.",
        },
      ],
    },
  ],
};
