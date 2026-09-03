import type { DemoChapter } from "../tour";
import { TECHDOC_CHAT } from "../routes";

// German throughout, per the change brief: the product content was always
// German; the tour chrome and copy now match. Sie-form — the audience is
// technical directors evaluating a purchase.
export const introChapter: DemoChapter = {
  id: "intro",
  title: "Was das hier ist",
  steps: [
    {
      id: "intro-overview",
      route: TECHDOC_CHAT,
      anchor: null,
      size: "wide",
      title: "Neun Kapitel, rund zwölf Minuten",
      content: [
        // The drawing shows seven elevators and the copy says nine chapters —
        // known mismatch, the asset needs regenerating (no image tooling in
        // this environment). The previous copy said "Seven chapters" against
        // a "1 of 9" badge, which was worse: wrong on its own screen.
        { kind: "figure", src: "/demo/structure.webp", alt: "Der Aufbau der Tour" },
        {
          kind: "paragraph",
          text: "Eine laufende OPEN IMP Umgebung — echte Oberflächen, realistische Daten aus der Aufzugsbranche. Mit Weiter geht es Schritt für Schritt; über den Tour-Knopf unten rechts springen Sie frei zwischen den Kapiteln.",
        },
      ],
    },
  ],
};
