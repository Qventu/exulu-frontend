import type { DemoChapter } from "../tour";
import { DEMO_BOOKING_LABEL, DEMO_BOOKING_URL } from "../routes";
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
      title: "Erst ausprobieren oder gleich richtig?",
      lead: "Alles, was du gesehen hast, läuft auch mit euren Dokumenten — auf zwei Wegen, beide beginnen mit einem Gespräch.",
      content: [],
      ...(DEMO_BOOKING_URL
        ? { cta: { label: DEMO_BOOKING_LABEL, href: DEMO_BOOKING_URL } }
        : {}),
    },
  ],
};
