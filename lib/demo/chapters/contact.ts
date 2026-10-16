import type { DemoChapter } from "../tour";
import { DEMO_BOOKING_LABEL } from "../routes";
import { panelBookingUrl } from "../booking";
import { sceneRoute } from "../scenes";

/**
 * This chapter's number for utm_medium — 12, the last. Written here because
 * the chapter cannot see CHAPTERS (index.ts imports it); tour.test.ts asserts
 * the number against the real position.
 */
const CHAPTER_NUMBER = 12;
const BOOKING_HREF = panelBookingUrl(CHAPTER_NUMBER, "contact-close");

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
      ...(BOOKING_HREF ? { cta: { label: DEMO_BOOKING_LABEL, href: BOOKING_HREF } } : {}),
    },
  ],
};
