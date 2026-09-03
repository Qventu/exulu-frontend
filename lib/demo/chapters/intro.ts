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
        // The drawing shows seven doors and the copy says nine chapters — a
        // real mismatch, but not a stale asset: it WAS regenerated. The cause
        // is scripts/generate-demo-image.py's "structure" prompt, which still
        // asks for "Seven identical elevator landing doors" while this copy
        // already says "Neun Kapitel". The follow-on narrative plan moves this
        // to twelve chapters anyway, so reconcile the prompt and the copy
        // together there rather than patching either alone now. The previous
        // copy said "Seven chapters" against a "1 of 9" badge, which was
        // worse: wrong on its own screen.
        { kind: "figure", src: "/demo/structure.webp", alt: "Der Aufbau der Tour" },
        {
          kind: "paragraph",
          text: "Eine laufende OPEN IMP Umgebung — echte Oberflächen, realistische Daten aus der Aufzugsbranche. Mit Weiter geht es Schritt für Schritt; über den Tour-Knopf unten rechts springen Sie frei zwischen den Kapiteln.",
        },
      ],
    },
  ],
};
