import type { DemoChapter } from "../tour";
import { sceneRoute } from "../scenes";

/**
 * Chapter 1 — the problem, before any product.
 *
 * Both steps route to a scene (lib/demo/scenes.ts) rather than a product
 * screen: there is nothing on screen to point at yet, and a cinematic opening
 * is not a tooltip over a dimmed application. Their copy lives in
 * lib/demo/scenes.ts now — see that file's docblock for why.
 *
 * This chapter replaces the old `intro`, which opened on a chat window and
 * asked the visitor to be impressed by a citation before they had any reason
 * to care. The tour now starts where the customer's problem starts.
 */
export const datenChapter: DemoChapter = {
  id: "daten",
  title: "Ihre Daten",
  steps: [
    {
      id: "daten-pile",
      route: sceneRoute("daten-pile"),
      anchor: null,
      title: "Das Wissen ist längst da",
      content: [],
    },
    {
      id: "daten-problem",
      route: sceneRoute("daten-problem"),
      anchor: null,
      title: "Nur nicht in einer Form, mit der eine KI arbeiten kann",
      content: [],
    },
  ],
};
