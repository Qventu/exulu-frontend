import type { DemoChapter } from "../tour";
import { DEMO_BOOKING_URL } from "../routes";
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
      title: "Eine Demo mit euren eigenen Dokumenten",
      lead: "Alles, was du gesehen hast, läuft auch mit euren Dokumenten — in zwei Wochen, nach 30 Minuten Planung.",
      content: [],
      ...(DEMO_BOOKING_URL
        ? { cta: { label: "30-Minuten-Termin buchen", href: DEMO_BOOKING_URL } }
        : {}),
    },
  ],
};
