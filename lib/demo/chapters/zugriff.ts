import type { DemoChapter } from "../tour";
import { SOFTWARE_DOC_CONTEXT_ID, SOFTWARE_DOC_ITEM_ID } from "../fixtures/software-docs";

const ITEM = `/data/${SOFTWARE_DOC_CONTEXT_ID}/items/${SOFTWARE_DOC_ITEM_ID}`;

/**
 * Chapter 4 — the same question, two different answers, on purpose.
 *
 * Runs on the ITEM the previous chapter just ingested, so the permissions on
 * screen are visibly the permissions on a document the visitor watched arrive.
 *
 * Deliberately NOT the agent editor's access section: chapter 7 already runs
 * on that route, and sending the visitor there twice costs the story its
 * forward motion. This chapter owns the knowledge side; chapter 7 owns the
 * assistant side.
 */
export const zugriffChapter: DemoChapter = {
  id: "zugriff",
  title: "Zugriff",
  steps: [
    {
      id: "zugriff-item",
      route: ITEM,
      anchor: "item-access",
      scrollBlock: "start",
      title: "Nicht jeder darf alles lesen",
      content: [
        {
          kind: "paragraph",
          text: "Interne Serviceanweisungen gehören dem Technikerteam. Produktdatenblätter dürfen an den Kunden. Beides liegt in derselben Umgebung — getrennt wird pro Eintrag, nicht pro Ordner.",
        },
      ],
    },
    {
      // A stage, not a popover: step 0 already points at the real rights
      // control on screen. This step draws the CONCLUSION from it — a
      // diagram of two readers and a callout about per-search enforcement —
      // which has nothing on screen to point at, and would otherwise sit as
      // a popover over the same populated item page step 0 already spotlit.
      id: "zugriff-consequence",
      route: ITEM,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Die Antwort richtet sich nach dem Fragenden",
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
  ],
};
