import type { DemoChapter } from "../tour";
import { SOFTWARE_DOC_CONTEXT_ID, SOFTWARE_DOC_ITEM_ID } from "../fixtures/software-docs";
import { sceneRoute } from "../scenes";

const ITEM = `/data/${SOFTWARE_DOC_CONTEXT_ID}/items/${SOFTWARE_DOC_ITEM_ID}`;

/**
 * Chapter 4 — the same question, two different answers, on purpose.
 *
 * Runs on the ITEM the previous chapter just ingested, so the permissions on
 * screen are visibly the permissions on a document the visitor watched arrive.
 *
 * Deliberately NOT the agent editor's access section: the `config` chapter
 * already runs on that route, and sending the visitor there twice costs the
 * story its forward motion. This chapter owns the knowledge side; `config`
 * owns the assistant side.
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
      // Routes to a scene (lib/demo/scenes.ts), not ITEM: step 0 already
      // points at the real rights control on screen. This step draws the
      // CONCLUSION from it — a diagram of two readers and a callout about
      // per-search enforcement — which has nothing on screen to point at.
      id: "zugriff-consequence",
      route: sceneRoute("zugriff-consequence"),
      anchor: null,
      title: "Die Antwort richtet sich nach dem Fragenden",
      content: [],
    },
  ],
};
