import type { DemoChapter } from "../tour";
import { DEMO_BOOKING_URL, TECHDOC_CHAT } from "../routes";
import { sceneRoute } from "../scenes";

export const contactChapter: DemoChapter = {
  id: "contact",
  // The case studies live HERE, not on the demo data: the premise is
  // generalized-but-realistic data with no attribution, and the one place
  // names are allowed is next to the ask, where references belong.
  title: "Sprich mit uns",
  goal: "Wer damit arbeitet, und wie es bei euch weitergeht.",
  steps: [
    {
      id: "contact-references",
      route: TECHDOC_CHAT,
      anchor: null,
      title: "Wer jetzt schon mit OPEN IMP arbeitet",
      content: [
        { kind: "figure", src: "/demo/structure.webp", alt: "Anlagen unserer Referenzkunden" },
        {
          kind: "paragraph",
          text: "Die Unternehmen NEW Lift Steuerungsbau (technische Dokumentation und Service) und ALGI Hydraulic (Angebots- und Ersatzteilprozesse) arbeiten bereits jetzt produktiv mit OPEN IMP. Alles, was du eben gesehen hast, ist daraus abgeleitet — aus Datenschutzgründen verallgemeinert, aber realistisch.",
        },
      ],
    },
    {
      id: "contact-close",
      // A scene, not the chat: the close deserves a frame of its own — the
      // references, the three numbers of the pilot and (once the booking
      // URL exists) the button, full-width. Its copy lives in
      // lib/demo/scenes.ts like every scene's.
      route: sceneRoute("contact-close"),
      anchor: null,
      title: "Eine Demo mit euren eigenen Dokumenten",
      content: [],
      ...(DEMO_BOOKING_URL
        ? { cta: { label: "30-Minuten-Termin buchen", href: DEMO_BOOKING_URL } }
        : {}),
    },
  ],
};
