export type DemoChapterId =
  | "techdoc"
  | "ingestion"
  | "config"
  | "memory"
  | "evals"
  | "email"
  | "meetings";

export interface DemoStep {
  id: string;
  /** Route the shell navigates to for this step. */
  route: string;
  /** `data-demo-id` value to spotlight, or null for a full-screen step. */
  anchor: string | null;
  title: string;
  body: string;
}

export interface DemoChapter {
  id: DemoChapterId;
  title: string;
  steps: DemoStep[];
}

export interface TourPosition {
  chapter: DemoChapterId;
  step: number;
}

const stub = (id: string, title: string): DemoStep => ({
  id,
  route: "/demo/tour",
  anchor: null,
  title,
  body: "Coming soon.",
});

export const CHAPTERS: DemoChapter[] = [
  {
    id: "techdoc",
    title: "Answering a hard question",
    steps: [
      {
        id: "techdoc-ask",
        route: "/demo/tour",
        anchor: "chat-composer",
        title: "A question with a precise answer",
        body: "A service engineer asks about a specific fault condition. Watch how the assistant finds it.",
      },
      {
        id: "techdoc-retrieval",
        route: "/demo/tour",
        anchor: "chat-tool-trace",
        title: "Retrieval, in the open",
        body: "The assistant decides which knowledge bases to search, and shows its work.",
      },
      {
        id: "techdoc-answer",
        route: "/demo/tour",
        anchor: "chat-sources",
        title: "Every claim, sourced",
        body: "The answer cites the documents it came from. Open one to check it.",
      },
    ],
  },
  { id: "ingestion", title: "How it learned that", steps: [stub("ingestion-intro", "How it learned that")] },
  { id: "config", title: "Making it yours", steps: [stub("config-intro", "Making it yours")] },
  {
    id: "memory",
    title: "Correcting it",
    steps: [
      {
        id: "memory-miss",
        route: "/demo/tour",
        anchor: "chat-messages",
        title: "When it doesn't know, it says so",
        body: "An engineer asks for an exact menu path. The assistant offers what the documents do contain, cites it, and is explicit that the precise path is not among them. No invented answer.",
      },
      {
        id: "memory-correct",
        route: "/demo/tour",
        anchor: "chat-composer",
        title: "The engineer corrects it",
        body: "Send the correction. This is the real message a Newlift engineer sent, giving the right path and asking the assistant to remember it.",
      },
      // MEMORY_WRITTEN_AT_STEP in fixtures/chapter-memory.ts is tied to this
      // index: the new memory must not appear in the knowledge base before the
      // visitor has actually sent the correction.
      {
        id: "memory-write",
        route: "/demo/tour",
        anchor: "chat-tool-trace",
        title: "The correction becomes a memory",
        body: "Remembering is a visible tool call, not a hidden side effect. You can see exactly what was stored.",
      },
      {
        id: "memory-item",
        route: "/data/newton_memory_context",
        anchor: null,
        title: "And a knowledge item you own",
        body: "The memory lands in a knowledge base like any other — readable, editable, deletable, and auditable. Nothing was fine-tuned into a model where you cannot reach it.",
      },
    ],
  },
  { id: "evals", title: "Proving it", steps: [stub("evals-intro", "Proving it")] },
  { id: "email", title: "Working while you sleep", steps: [stub("email-intro", "Working while you sleep")] },
  { id: "meetings", title: "Capturing what is said", steps: [stub("meetings-intro", "Capturing what is said")] },
];

function chapterIndex(chapters: DemoChapter[], id: DemoChapterId): number {
  return chapters.findIndex((c) => c.id === id);
}

export function resolveStep(chapters: DemoChapter[], pos: TourPosition): DemoStep | null {
  const chapter = chapters[chapterIndex(chapters, pos.chapter)];
  if (!chapter) return null;
  return chapter.steps[pos.step] ?? null;
}

export function nextPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  const chapter = chapters[ci];
  if (pos.step + 1 < chapter.steps.length) {
    return { chapter: chapter.id, step: pos.step + 1 };
  }
  const next = chapters[ci + 1];
  return next ? { chapter: next.id, step: 0 } : null;
}

export function prevPosition(chapters: DemoChapter[], pos: TourPosition): TourPosition | null {
  const ci = chapterIndex(chapters, pos.chapter);
  if (ci < 0) return null;
  if (pos.step > 0) return { chapter: pos.chapter, step: pos.step - 1 };
  const prev = chapters[ci - 1];
  return prev ? { chapter: prev.id, step: prev.steps.length - 1 } : null;
}

export function startOfChapter(id: DemoChapterId): TourPosition {
  return { chapter: id, step: 0 };
}
