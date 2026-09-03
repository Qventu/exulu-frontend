import type { DemoChapter } from "../tour";

export const evalsChapter: DemoChapter = {
  id: "evals",
  // The questions and suite structure are real; the SCORES are illustrative
  // and the evals-matrix body says so on screen. See fixtures/evals.ts.
  title: "Belegen statt behaupten",
  steps: [
    {
      id: "evals-suites",
      route: "/evals",
      anchor: "evals-suites",
      size: "wide",
      title: "Der Teil, den niemand vorführt",
      content: [
        { kind: "figure", src: "/demo/ch5-evals.webp", alt: "Testreihen für die Antwortqualität" },
        {
          kind: "paragraph",
          text: "Eine gute Antwort kann jeder zeigen. Die Frage ist, was mit allen anderen passiert. Zwei Testreihen: eine für die technische Dokumentation, eine für Fragen, die aus Normen beantwortet werden müssen.",
        },
      ],
    },
    {
      id: "evals-matrix",
      route: "/evals/evalset-techdoc-regression",
      anchor: "evals-matrix",
      title: "Jede Frage, jeder Lauf, ein Raster",
      content: [
        {
          kind: "paragraph",
          text: "Zeilen sind echte Technikerfragen, Spalten sind Läufe. Fällt eine Antwort unter die Schwelle, wird die Zelle rot — eine Änderung, die eine Frage verbessert und eine andere verschlechtert, bleibt sichtbar. Die Werte hier sind beispielhaft.",
        },
      ],
    },
    {
      id: "evals-sources",
      route: "/evals/evalset-techdoc-regression?tab=testCases",
      anchor: "evals-cases",
      title: "Auch die Quelle wird geprüft",
      content: [
        {
          kind: "paragraph",
          text: "Ein Testfall kann neben der richtigen Antwort die richtige Quelle verlangen — eine Normfrage muss aus EN und DIN beantwortet werden, nicht aus einem Produkthandbuch. Richtig klingen und richtig sein werden getrennt bewertet.",
        },
      ],
    },
  ],
};
