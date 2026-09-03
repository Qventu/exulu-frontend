import type { DemoChapter } from "../tour";
import { DEMO_BOOKING_URL, TECHDOC_CHAT } from "../routes";

export const contactChapter: DemoChapter = {
  id: "contact",
  // The case studies live HERE, not on the demo data: the premise is
  // generalized-but-realistic data with no attribution, and the one place
  // names are allowed is next to the ask, where references belong.
  title: "Sprechen Sie mit uns",
  steps: [
    {
      id: "contact-references",
      route: TECHDOC_CHAT,
      anchor: null,
      size: "wide",
      title: "Wer damit arbeitet",
      content: [
        { kind: "figure", src: "/demo/structure.webp", alt: "Der Aufbau der Tour" },
        {
          kind: "paragraph",
          text: "NEW Lift Steuerungsbau (technische Dokumentation und Service) und ALGI Hydraulic (Angebots- und Ersatzteilprozesse) arbeiten produktiv mit OPEN IMP. Alles, was Sie eben gesehen haben, ist daraus abgeleitet — verallgemeinert, aber realistisch.",
        },
      ],
    },
    {
      id: "contact-close",
      route: TECHDOC_CHAT,
      anchor: null,
      title: "Mit Ihren eigenen Dokumenten",
      content: [
        {
          kind: "paragraph",
          text: "Zehn Ihrer Handbücher, zwei Wochen, echte Fragen Ihres Serviceteams — auf genau dem, was Sie eben gesehen haben. Dreißig Minuten reichen für die Planung.",
        },
      ],
      ...(DEMO_BOOKING_URL
        ? { cta: { label: "30-Minuten-Termin buchen", href: DEMO_BOOKING_URL } }
        : {}),
    },
  ],
};
