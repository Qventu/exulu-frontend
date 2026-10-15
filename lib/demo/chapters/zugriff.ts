import type { DemoChapter } from "../tour";
import { DEMO_AGENT_ID } from "../fixtures/chapter-techdoc";
import { sceneRoute } from "../scenes";

/**
 * Chapter 4 — the same question, two different answers, on purpose.
 *
 * Step 0 runs on the assistant's own access section: the assistant is shared
 * with one role, and the control that says so is the product's real one.
 * Before sub-project 5 this step sat on a single knowledge item's edit form —
 * the right control at the bottom of a form the visitor had no other reason
 * to see. The `config` chapter returns to this editor three chapters later
 * for a different section; the two visits are about different things (who
 * may ask, then how it answers).
 */
export const zugriffChapter: DemoChapter = {
  id: "zugriff",
  title: "Berechtigungen und Zugriff",
  goal: "Wer lesen darf, bestimmt auch, was die Antwort enthält.",
  steps: [
    {
      id: "zugriff-agent",
      route: `/agents/edit/${DEMO_AGENT_ID}`,
      anchor: "agent-access",
      // "start", as config.0: the section sits far below the fold of a
      // 6,400px editor page, and "nearest" would park it at the bottom edge.
      scrollBlock: "start",
      title: "Nicht jeder darf alles lesen",
      content: [
        {
          kind: "paragraph",
          text: "Dieser Assistent gehört dem Technikerteam: Nur die Rolle Techniker darf ihn befragen. Was er dabei lesen darf, ist zusätzlich pro Wissensbasis und pro Eintrag geregelt — interne Serviceanweisungen bleiben intern, Produktdatenblätter dürfen an den Kunden.",
        },
      ],
    },
    {
      // Routes to a scene (lib/demo/scenes.ts): step 0 already points at the
      // real rights control on screen. This step draws the CONCLUSION from it
      // — a diagram of two readers and a callout about per-search enforcement
      // — which has nothing on screen to point at.
      id: "zugriff-consequence",
      route: sceneRoute("zugriff-consequence"),
      anchor: null,
      title: "Die Antwort richtet sich nach dem Fragenden",
      content: [],
    },
  ],
};
