import type { DemoChapter } from "../tour";
import { TECHDOC_CHAT } from "../routes";

export const techdocChapter: DemoChapter = {
  id: "techdoc",
  title: "Eine schwierige Frage",
  steps: [
    {
      // No illustration: the popover flips up over the transcript here, and
      // an image made it tall enough to cover the answer the step says to
      // watch. The answer streams above the composer, so nothing is dimmed.
      id: "techdoc-ask",
      route: TECHDOC_CHAT,
      anchor: "chat-composer",
      noDim: true,
      title: "Eine Frage mit einer präzisen Antwort",
      content: [
        {
          kind: "paragraph",
          text: "Ein Servicetechniker fragt nach einem Fehlerbild. Sehen Sie zu, wie der Assistent sucht und antwortet — live, keine Aufzeichnung.",
        },
      ],
    },
    {
      // `chat-retrieval`, not `chat-tool-trace`: Context_Search renders its
      // own card, not the generic tool block.
      id: "techdoc-retrieval",
      route: TECHDOC_CHAT,
      anchor: "chat-retrieval",
      title: "Die Suche, offen gezeigt",
      content: [
        {
          kind: "paragraph",
          text: "Der Assistent entscheidet selbst, welche Wissensbasen er durchsucht — und zeigt jeden Schritt.",
        },
      ],
    },
    {
      // `chat-citation`, not `chat-sources`: this agent's citations travel
      // inline and render as badges; the source-URL block never mounts.
      id: "techdoc-answer",
      route: TECHDOC_CHAT,
      anchor: "chat-citation",
      title: "Jede Aussage mit Quelle",
      content: [
        {
          kind: "paragraph",
          text: "Die Antwort belegt jede Aussage mit dem Dokument, aus dem sie stammt. Öffnen Sie eine Quelle und prüfen Sie selbst.",
        },
      ],
    },
  ],
};
