import type { DemoChapter } from "../tour";
import { ALGI_MEETING_ID } from "../fixtures/chapter-meetings";

/**
 * Sub-project 8: the list step states the platform (Teams, Meet, Zoom,
 * on-site audio, rights); the tally stays available for other copy.
 *
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
      title: "Besprechungen, die zu Wissen werden",
      content: [
        { kind: "figure", src: "/demo/ch7-meetings.webp", alt: "Von der Aufzeichnung zur Arbeitsanweisung" },
        {
          kind: "paragraph",
          text: "OPEN IMP vereint euer Wissen, Besprechungen eingeschlossen: Transkripte aus Teams, Google Meet und Zoom, Audioaufnahmen aus Vor-Ort-Terminen mit Sprecherzuordnung — und ein Rechtemanagement, das ein Transkript nur den richtigen Personen zeigt.",
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
      title: "Hier wird ein lesbares Dokument daraus",
      content: [
        {
          kind: "paragraph",
          text: "Dieselbe Besprechung als Arbeitsanweisung: Freigabe prüfen, Lüftung nicht aus der Kabinentür ableiten, offene Punkte benennen. Ein Transkript lässt sich automatisch an einen eurer Assistenten geben: zusammenfassen, Follow-up-Mails verschicken, Tickets anlegen und mehr. Dieses eine Dokument entstand noch von Hand — der Kunde hat den Schritt nicht ausgeführt.",
        },
      ],
    },
  ],
};
