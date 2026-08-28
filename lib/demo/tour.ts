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
  {
    id: "ingestion",
    title: "How it learned that",
    // Runs on the product's real knowledge routes, and on the exact document
    // chapter 1 answered from — FST2XTchanges-customer-DE.docx. The tour claims
    // to show where the answer came from, so it has to be that document and not
    // a representative one.
    steps: [
      {
        id: "ingestion-library",
        route: "/data/software_documentation_context",
        anchor: "knowledge-items",
        title: "Nobody uploaded these",
        body: "Nine documents, pulled straight from Newlift's own storage. German and English versions of the same manual sit side by side — the assistant is not told which to read, it works that out per question.",
      },
      {
        id: "ingestion-pipeline",
        route:
          "/data/software_documentation_context/items/d92dd3f2-2803-41e4-8136-a1a0ccb99e6c",
        anchor: "item-pipeline",
        title: "Four stages, and you can watch all four",
        body: "This is the document that answered chapter 1. Ingested, processed, embedded, retrievable — with real timestamps: read at 22:35:01, searchable seventeen seconds later. Nothing here is a black box you have to trust.",
      },
      {
        id: "ingestion-chunks",
        route:
          "/data/software_documentation_context/items/d92dd3f2-2803-41e4-8136-a1a0ccb99e6c?section=embeddings",
        anchor: "item-chunks",
        title: "What retrieval actually searches",
        body: "The manual is split into 93 passages, each embedded separately. These are the real ones. Search does not run over a document — it runs over these, which is why an answer can cite a paragraph instead of a filename.",
      },
      {
        id: "ingestion-loop",
        route:
          "/data/software_documentation_context/items/d92dd3f2-2803-41e4-8136-a1a0ccb99e6c?section=embeddings",
        anchor: null,
        title: "And it stays current",
        body: "When Newlift publishes a revision, the pipeline re-reads it and the old passages are replaced. No retraining, no re-uploading, no waiting on us. Next: how the assistant decides which knowledge base a question should reach in the first place.",
      },
    ],
  },
  {
    id: "config",
    title: "Making it yours",
    // Every step here runs on the product's real agent editor. The `?wizard=`
    // parameter is a genuine deep link into the retrieval wizard, not demo
    // scaffolding — without it the tour would have to ask the visitor to find
    // and open the right drawer step by hand, and a step whose anchor never
    // mounts spotlights nothing.
    steps: [
      {
        id: "config-overview",
        route: "/agents/edit/demo-agent-newton",
        anchor: "agent-agentic-retrieval",
        title: "The whole assistant is configuration",
        body: "No fine-tuning, no code. This is the same editor Newlift uses — and everything on the next few screens is their live production setup.",
      },
      {
        id: "config-sources",
        route: "/agents/edit/demo-agent-newton?wizard=sources",
        anchor: "agent-wizard-sources",
        // Says SEVEN because the screen says seven. The Sources step lists
        // seven checked knowledge bases and the summary card above it reads
        // "7 knowledge bases" — the seventh is Newton's own memory, which the
        // agentic retrieval config treats as a searchable source like any
        // other. An earlier draft said six, counting only the document and
        // ticket sources, and contradicted the card the visitor was looking at.
        title: "Seven knowledge bases, read three different ways",
        body: "Manuals are read like documents, support tickets like conversations, the service database like records. Each carries a sentence telling the assistant when to reach for it. The seventh is the assistant's own memory — which is the chapter after this one.",
      },
      {
        id: "config-routing",
        route: "/agents/edit/demo-agent-newton?wizard=routing",
        anchor: "agent-wizard-routing",
        title: "Routing, in plain language",
        body: "Five rules decide where a question goes first and where it falls back. They are written as sentences, not code — a domain expert can change them without an engineer.",
      },
      {
        id: "config-vocabulary",
        route: "/agents/edit/demo-agent-newton?wizard=vocabulary",
        anchor: "agent-wizard-vocabulary",
        title: "Teaching it your language",
        body: "55 elevator abbreviations — ADM, SHK, UCM — plus product names matched loosely and standards matched exactly. This is why a question about the SHK finds the Sicherheitskreis pages.",
      },
      {
        id: "config-behavior",
        route: "/agents/edit/demo-agent-newton?wizard=behavior",
        anchor: "agent-wizard-behavior",
        title: "And how hard to look",
        // Was "Chapter 4 showed that last one mattering", which pointed
        // backwards at a chapter that comes next — memory is chapter 4 and
        // configuration is chapter 3.
        body: "How many passes, how many results, which reranker, when to give up and say it does not know. That last one is the whole of the next chapter.",
      },
    ],
  },
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
  {
    id: "evals",
    title: "Proving it",
    // The questions and the suite structure are real; the SCORES are not, and
    // cannot be — scoring a case means executing a run against a live model.
    // See the note in fixtures/evals.ts. The narration below is written to
    // demonstrate the mechanism and deliberately claims no measured result.
    steps: [
      {
        id: "evals-suites",
        route: "/evals",
        anchor: "evals-suites",
        title: "The part nobody demos",
        body: "Anyone can show you a good answer. The question is what happens to the other ten thousand. Two suites here: one for the technical documentation, one for questions that must be answered from the standards rather than the product manuals.",
      },
      {
        id: "evals-matrix",
        route: "/evals/evalset-techdoc-regression",
        anchor: "evals-matrix",
        title: "Every question, every run, one grid",
        body: "Rows are questions a Newlift engineer actually asked. Columns are runs. A cell is what the assistant scored on that question in that run — so a change that helps one question and quietly breaks another has nowhere to hide.",
      },
      {
        id: "evals-regression",
        route: "/evals/evalset-techdoc-regression",
        anchor: "evals-matrix",
        title: "A regression is a red cell",
        body: "The earlier run misses the terminology question badly and drags the suite average below its pass threshold. That is the whole mechanism: you set a bar, and every change is measured against the same questions rather than against an impression.",
      },
      {
        id: "evals-sources",
        route: "/evals/evalset-techdoc-regression",
        anchor: null,
        title: "And it checks where the answer came from",
        body: "A case can require not just the right answer but the right source — a regulatory question has to be answered from EN and DIN, not from a product manual that happens to mention a number. Sounding right and being right are scored separately.",
      },
    ],
  },
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

/**
 * The tour position lives in the URL, as `?tour=<chapter>.<step>`.
 *
 * It has to. Chapters 3 and 4 end on the product's own routes — the agent
 * editor, the knowledge base — which are in a different route group with its
 * own layout, so React state in a provider does not survive the navigation.
 * Held in the URL it does, and the position is shareable and reloadable as a
 * bonus: a salesperson can send a prospect a link to step 3 of chapter 5.
 */
export const TOUR_PARAM = "tour";

export function encodePosition(pos: TourPosition): string {
  return `${pos.chapter}.${pos.step}`;
}

/**
 * Returns null for anything unparseable, so a hand-edited or stale URL starts
 * the tour from the beginning rather than rendering a chapter with no steps.
 */
export function parsePosition(
  raw: string | null | undefined,
  chapters: DemoChapter[] = CHAPTERS,
): TourPosition | null {
  if (!raw) return null;
  const [chapterId, rawStep] = raw.split(".");
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) return null;
  const step = Number(rawStep);
  if (!Number.isInteger(step) || step < 0 || step >= chapter.steps.length) {
    return null;
  }
  return { chapter: chapter.id, step };
}

/** The href a step lives at: its route, carrying the position. */
export function hrefFor(
  pos: TourPosition,
  chapters: DemoChapter[] = CHAPTERS,
): string {
  const step = resolveStep(chapters, pos);
  const route = step?.route ?? "/demo/tour";
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}${TOUR_PARAM}=${encodePosition(pos)}`;
}
