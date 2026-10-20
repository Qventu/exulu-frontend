import type { DemoChapter } from "../tour";
import { sceneRoute } from "../scenes";

export const contactChapter: DemoChapter = {
  id: "contact",
  title: "Sprich mit uns",
  goal: "Wer damit arbeitet, und wie es bei euch weitergeht.",
  steps: [
    {
      // The references used to be their own step on the chat screen, with
      // nothing on that screen to point at (marketing, 2026-10-15). They
      // live in the closing scene now, with the customers' logos.
      id: "contact-close",
      route: sceneRoute("contact-close"),
      anchor: null,
      // Marketing's hero, box and button live in the scene (lib/demo/scenes.ts).
      // No `cta` here: the scene's button is the one ask, and the panel's
      // footer shows the persistent booking link like every other step rather
      // than a second button with a label that would not fit 420px.
      title: "Dein nächster Schritt",
      lead: "Alles, was du gesehen hast, läuft auch mit euren Dokumenten.",
      content: [],
    },
  ],
};
