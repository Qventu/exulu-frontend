# Demo Presentation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the demo tour's Shepherd tooltips into real React panels driven by structured content data, with auto-advancing steps and full-bleed stage beats, and restyle every generated asset to the OPEN brand — with the existing nine chapters still working end to end.

**Architecture:** Step copy becomes a `ContentBlock[]` discriminated union (pure data, node-testable) instead of an HTML string. `shepherdStepFor` takes a renderer function as a parameter so `lib/demo/shepherd-step.ts` stays free of React and keeps its node tests; the browser supplies a renderer that mounts a React root into a detached element and hands it to Shepherd's `text` thunk. Steps may carry `advanceAfterMs` (motion via more complete worlds, never a clock inside one world) and `kind: "stage"` (full-bleed, bypassing Shepherd entirely).

**Tech Stack:** Next.js App Router (RSC), TypeScript, Shepherd.js 15, framer-motion 12, Apollo Client 3.14, vitest 4 (`environment: "node"`, no DOM), Python 3 + gpt-image-2 for assets.

**Spec:** `docs/superpowers/specs/2026-09-03-demo-narrative-rebuild-design.md`

**Follow-on plan:** the twelve-chapter narrative rebuild (new chapters 1–4, the data-first reorder, all new German copy) is a SEPARATE plan that depends on this one. This plan changes how steps are presented; it does not change which steps exist or what they say.

## Global Constraints

- **Tests run in node with no DOM.** `vitest.config.ts` sets `environment: "node"` and includes only `lib/**/*.test.ts`, `components/**/*.test.ts`, `app/**/*.test.ts`. Never write a test that needs `document`, and never add `.test.tsx` — it will not be collected.
- **`lib/demo/shepherd-step.ts` must not import React or any browser API.** Its node tests are the only assertions on tour navigation.
- **Demo copy is hardcoded German, not next-intl.** The demo forces `locale = "de"`; demo-only strings must not enter `messages/*.json`, which every real deployment ships.
- **Every step must be a complete world.** `lib/demo/types.ts` forbids deltas between steps — the Tour menu can jump anywhere.
- **OPEN palette:** lime `#EFFE7C`, ink `#1A1A1A`, lavender `#C0ACF9`, sage `#C9D08F`, blush `#FFE1DE`, cream `#FFFDF3`.
- **Never commit the OpenAI key.** It is supplied via `OPENAI_API_KEY` in the environment only.
- **Pre-existing failure:** `components/shell/nav-config.test.ts` fails on `main` (the `models` entry). Not caused by this work; do not "fix" it as a side effect.
- Branch: `feat/demo-foundations`. Commit after every task.

## File Structure

**Create:**
- `lib/demo/content.ts` — the `ContentBlock` union and pure helpers. No React.
- `lib/demo/content.test.ts`
- `lib/demo/routes.ts` — shared route constants, extracted so chapter modules can import them without importing `tour.ts`.
- `lib/demo/chapters/{intro,techdoc,memory,ingestion,config,evals,email,meetings,contact}.ts` — one chapter each.
- `lib/demo/chapters/index.ts` — assembles `CHAPTERS`.
- `lib/demo/chapters/index.test.ts` — chapter integrity invariants.
- `lib/demo/auto-advance.ts` + `.test.ts` — pure delay policy.
- `components/demo/step-panel.tsx` — renders `ContentBlock[]`.
- `components/demo/step-content-host.tsx` — detached-element React roots, cached per step id.
- `components/demo/tour-stage.tsx` — full-bleed stage renderer.

**Modify:**
- `lib/demo/tour.ts` — `DemoStep` gains `content`, `kind`, `size`, `advanceAfterMs`; loses `body` and `image`. Re-exports `CHAPTERS` from `./chapters`.
- `lib/demo/shepherd-step.ts` — accepts a renderer; emits `text` thunk + `classes`.
- `components/demo/tour-provider.tsx` — auto-advance timer.
- `components/demo/tour-shepherd.tsx` — supply the renderer, skip stage steps, dispose roots.
- `components/demo/tour-overlay.tsx` — mount `TourStage`.
- `components/demo/shepherd-theme.css` — panel sizing and OPEN styling.
- `scripts/generate-demo-image.py` — OPEN collage `STYLE`.
- `lib/demo/tour.test.ts`, `lib/demo/shepherd-step.test.ts` — follow the type change.

**Why `routes.ts`:** chapter modules need `TECHDOC_CHAT` and friends, which live in `tour.ts` today. `tour.ts` will import `CHAPTERS` from `chapters/index.ts`, so leaving the constants in `tour.ts` creates a runtime import cycle. Type-only imports are erased and safe; runtime values are not.

---

### Task 1: The ContentBlock model

**Files:**
- Create: `lib/demo/content.ts`
- Test: `lib/demo/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type ContentBlock`, `function contentText(blocks: ContentBlock[]): string`, `function isEmptyContent(blocks: ContentBlock[]): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/content.test.ts
import { describe, expect, it } from "vitest";
import { contentText, isEmptyContent, type ContentBlock } from "./content";

describe("contentText", () => {
  it("flattens every block kind into searchable text", () => {
    const blocks: ContentBlock[] = [
      { kind: "paragraph", text: "Eine Frage." },
      { kind: "bullets", items: ["Erstens", "Zweitens"] },
      { kind: "callout", tone: "quote", text: "Zitat" },
      { kind: "stat", value: "1.000", label: "Dokumente" },
      { kind: "figure", src: "/demo/x.webp", alt: "Schema" },
      { kind: "sequence", steps: ["Lesen", "Zerlegen"] },
    ];
    const text = contentText(blocks);
    for (const fragment of [
      "Eine Frage.", "Erstens", "Zweitens", "Zitat",
      "1.000", "Dokumente", "Schema", "Lesen", "Zerlegen",
    ]) {
      expect(text).toContain(fragment);
    }
  });

  // A figure with no alt contributes nothing rather than "undefined".
  it("omits a missing alt", () => {
    expect(contentText([{ kind: "figure", src: "/a.webp" }])).not.toContain("undefined");
  });
});

describe("isEmptyContent", () => {
  it("is true for no blocks", () => {
    expect(isEmptyContent([])).toBe(true);
  });

  // The failure this guards: a step whose copy was deleted still renders a
  // panel, with a title over nothing. Whitespace counts as empty.
  it("is true for blocks that carry no words", () => {
    expect(isEmptyContent([{ kind: "paragraph", text: "   " }])).toBe(true);
    expect(isEmptyContent([{ kind: "bullets", items: [] }])).toBe(true);
  });

  it("is false for real copy", () => {
    expect(isEmptyContent([{ kind: "paragraph", text: "Text" }])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/content.test.ts`
Expected: FAIL — `Failed to resolve import "./content"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/demo/content.ts
/**
 * A tour step's copy, as data rather than markup.
 *
 * The tour's explainers are panels now — headings, lists, statistics,
 * sequences — and the obvious way to express that is JSX in the chapter list.
 * That would be a mistake: vitest runs this project with environment "node"
 * and collects only *.test.ts, so JSX in the chapter list would move every
 * line of the tour's script beyond the reach of any assertion.
 *
 * As data, the script stays testable — copy, ordering, structure, emptiness —
 * and components/demo/step-panel.tsx stays a thin mapping over it. Same
 * argument shepherd-step.ts already makes for itself: "a component that only
 * runs in a browser is a component nobody asserts on."
 */
export type ContentBlock =
  | { kind: "paragraph"; text: string }
  /** Short parallel points. Not for prose — three words to a line, not three sentences. */
  | { kind: "bullets"; items: string[] }
  /** A pulled-out claim. `quote` is someone's words; `fact` is the product's. */
  | { kind: "callout"; tone: "fact" | "quote"; text: string }
  /** One number that carries a step, e.g. 1.000 Dokumente. */
  | { kind: "stat"; value: string; label: string }
  | { kind: "figure"; src: string; alt?: string }
  /** An ordered pipeline, rendered as connected stages. */
  | { kind: "sequence"; steps: string[] };

/** Every word in a block, for assertions and search. Never renders. */
export function contentText(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "paragraph":
          return block.text;
        case "bullets":
          return block.items.join(" ");
        case "callout":
          return block.text;
        case "stat":
          return `${block.value} ${block.label}`;
        case "figure":
          return block.alt ?? "";
        case "sequence":
          return block.steps.join(" ");
      }
    })
    .join(" ");
}

/** True when a step would render a title over nothing. */
export function isEmptyContent(blocks: ContentBlock[]): boolean {
  return contentText(blocks).trim().length === 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/content.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/content.ts lib/demo/content.test.ts
git commit -m "feat(demo): step copy as ContentBlock data rather than an HTML string"
```

---

### Task 2: Split the chapter list and migrate it to ContentBlock

This is the largest mechanical task. It changes no behaviour: the same nine chapters, the same copy, the same order — expressed as blocks and split across files so the twelve-chapter rebuild has somewhere to land. `tour.ts` is 490 lines before any of the new material.

**Files:**
- Create: `lib/demo/routes.ts`, `lib/demo/chapters/index.ts`, `lib/demo/chapters/{intro,techdoc,memory,ingestion,config,evals,email,meetings,contact}.ts`, `lib/demo/chapters/index.test.ts`
- Modify: `lib/demo/tour.ts`, `lib/demo/tour.test.ts`

**Interfaces:**
- Consumes: `ContentBlock`, `isEmptyContent` from Task 1.
- Produces: `DemoStep` with `content: ContentBlock[]`, `kind?: "popover" | "stage"`, `size?: "default" | "wide"`, `advanceAfterMs?: number`; `CHAPTERS` exported from both `lib/demo/chapters` and (re-exported) `lib/demo/tour`.

- [ ] **Step 1: Extract the route constants**

```ts
// lib/demo/routes.ts
/**
 * Routes the chapter modules navigate to.
 *
 * Extracted from tour.ts to break a cycle: tour.ts imports CHAPTERS from
 * ./chapters, and the chapter modules need these constants. Type-only imports
 * are erased at compile time and safe in a cycle; runtime values are not.
 */
import { DEMO_AGENT_ID, TECHDOC_SESSION_ID } from "./fixtures/chapter-techdoc";
import { MEMORY_SESSION_ID } from "./fixtures/chapter-memory";

export const TECHDOC_CHAT = `/chat/${DEMO_AGENT_ID}/${TECHDOC_SESSION_ID}`;
export const MEMORY_CHAT = `/chat/${DEMO_AGENT_ID}/${MEMORY_SESSION_ID}`;

/**
 * The closing step's booking link — a HubSpot meetings URL.
 *
 * ==> THIS IS THE LAST THING TO SET BEFORE THE DEMO GOES LIVE. <==
 *
 * Empty until that link exists. The closing step reads the emptiness and drops
 * the invitation clause rather than rendering a dead anchor at a prospect.
 */
export const DEMO_BOOKING_URL = "";
```

- [ ] **Step 2: Change the DemoStep type in `lib/demo/tour.ts`**

Replace the `body: string` and `image?: string` fields on `DemoStep` with the below, keep every other field and its comment verbatim, and delete the now-moved route constants and `DEMO_BOOKING_URL` (re-export them from `./routes` so existing importers keep working).

```ts
import type { ContentBlock } from "./content";
export { DEMO_BOOKING_URL, MEMORY_CHAT, TECHDOC_CHAT } from "./routes";

export interface DemoStep {
  id: string;
  /** Route the shell navigates to for this step. */
  route: string;
  /** `data-demo-id` value to spotlight, or null for a full-screen step. */
  anchor: string | null;
  title: string;
  /**
   * The step's copy, as blocks. See lib/demo/content.ts for why this is data
   * and not JSX.
   */
  content: ContentBlock[];
  /**
   * "stage" renders full-bleed and bypasses Shepherd entirely — for beats
   * whose subject is the whole screen, where a popover over a dimmed app would
   * be fighting the tool. Default "popover".
   */
  kind?: "popover" | "stage";
  /** Panel width. "wide" for steps carrying a sequence or a figure. */
  size?: "default" | "wide";
  /**
   * Advance to the next step automatically after this many milliseconds.
   *
   * This is how the demo animates. types.ts requires every step to be a
   * COMPLETE world so the Tour menu can jump anywhere, so a knowledge base at
   * 0, 240 and 1.000 items is three worlds and three steps rather than one
   * world and a clock — which also keeps every intermediate state
   * deep-linkable and needs no Apollo refetch plumbing.
   *
   * Never on a chapter's last step, and never on a step with a cta; the
   * integrity test in chapters/index.test.ts enforces both.
   */
  advanceAfterMs?: number;
  cta?: { label: string; href: string };
  noDim?: boolean;
  scrollBlock?: "start" | "nearest";
  placement?: "top" | "bottom" | "left" | "right";
}
```

Then replace the `export const CHAPTERS: DemoChapter[] = [ … ]` literal with:

```ts
export { CHAPTERS } from "./chapters";
```

…and add `import { CHAPTERS } from "./chapters";` for the functions in this file that default to it.

- [ ] **Step 3: Move each chapter into its own module**

One file per chapter. Every step keeps its existing `id`, `route`, `anchor`, `placement`, `scrollBlock`, `noDim`, `cta` and title verbatim; only `body`/`image` change shape. Prose becomes `{ kind: "paragraph" }`; an `image` becomes `{ kind: "figure" }` as the FIRST block. Preserve every explanatory comment — they record real bugs.

Worked example, the intro chapter (do the same for the other eight):

```ts
// lib/demo/chapters/intro.ts
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
        { kind: "figure", src: "/demo/structure.webp", alt: "Der Aufbau der Tour" },
        {
          kind: "paragraph",
          text: "Eine laufende OPEN IMP Umgebung — echte Oberflächen, realistische Daten aus der Aufzugsbranche. Mit Weiter geht es Schritt für Schritt; über den Tour-Knopf unten rechts springen Sie frei zwischen den Kapiteln.",
        },
      ],
    },
  ],
};
```

```ts
// lib/demo/chapters/index.ts
import type { DemoChapter } from "../tour";
import { introChapter } from "./intro";
import { techdocChapter } from "./techdoc";
import { memoryChapter } from "./memory";
import { ingestionChapter } from "./ingestion";
import { configChapter } from "./config";
import { evalsChapter } from "./evals";
import { emailChapter } from "./email";
import { meetingsChapter } from "./meetings";
import { contactChapter } from "./contact";

/**
 * The tour, in order. One module per chapter because this list is about to
 * carry twelve chapters of structured content — it was already 490 lines in
 * tour.ts as nine chapters of strings.
 *
 * ORDER IS LOAD-BEARING. The memory chapter's fixture is a correction
 * exchange, and a correction needs an answer to correct: it must follow the
 * chat chapter. chapters/index.test.ts asserts that.
 */
export const CHAPTERS: DemoChapter[] = [
  introChapter,
  techdocChapter,
  memoryChapter,
  ingestionChapter,
  configChapter,
  evalsChapter,
  emailChapter,
  meetingsChapter,
  contactChapter,
];
```

- [ ] **Step 4: Write the chapter integrity test**

```ts
// lib/demo/chapters/index.test.ts
import { describe, expect, it } from "vitest";
import { isEmptyContent } from "../content";
import { isDemoSupported } from "../supported-routes";
import { CHAPTERS } from "./index";

const everyStep = CHAPTERS.flatMap((chapter) =>
  chapter.steps.map((step, index) => ({ chapter, step, index })),
);

describe("chapter integrity", () => {
  it("gives every step copy", () => {
    for (const { chapter, step } of everyStep) {
      expect(isEmptyContent(step.content), `${chapter.id}/${step.id} has no copy`).toBe(false);
    }
  });

  it("uses ids that are unique across the whole tour", () => {
    const ids = everyStep.map(({ step }) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("navigates only to routes the demo has fixtures for", () => {
    for (const { chapter, step } of everyStep) {
      const pathname = step.route.split("?")[0];
      expect(isDemoSupported(pathname), `${chapter.id}/${step.id} → ${pathname}`).toBe(true);
    }
  });

  // Auto-advance across a chapter boundary would carry a visitor out of a
  // chapter they were still reading, and there is no Back that feels like undo.
  it("never auto-advances off the end of a chapter", () => {
    for (const chapter of CHAPTERS) {
      const last = chapter.steps[chapter.steps.length - 1];
      expect(last.advanceAfterMs, `${chapter.id} ends on an auto-advancing step`).toBeUndefined();
    }
  });

  // A cta is a decision. Moving the page out from under one is hostile.
  it("never auto-advances a step that asks for a decision", () => {
    for (const { step } of everyStep) {
      if (step.cta) expect(step.advanceAfterMs).toBeUndefined();
    }
  });

  // The memory chapter replays a correction, which needs an answer to correct.
  it("keeps the memory chapter after the chat chapter", () => {
    const order = CHAPTERS.map((c) => c.id);
    expect(order.indexOf("memory")).toBeGreaterThan(order.indexOf("techdoc"));
  });

  it("points every figure at a file that exists", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const { step } of everyStep) {
      for (const block of step.content) {
        if (block.kind !== "figure") continue;
        expect(existsSync(join(process.cwd(), "public", block.src)), `missing ${block.src}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 5: Update `lib/demo/tour.test.ts`**

Its existing `FIXTURE` chapters use `body: "b"`. Replace each with `content: [{ kind: "paragraph", text: "b" }]`. The closing-step assertions that call `closing()` on a string body must read `contentText(closingStep().content)` instead — import `contentText` from `./content`.

- [ ] **Step 6: Run the full demo suite**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. Every pre-existing demo test still green; the new integrity tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/demo/routes.ts lib/demo/chapters lib/demo/tour.ts lib/demo/tour.test.ts
git commit -m "refactor(demo): one module per chapter, copy as content blocks"
```

---

### Task 3: Auto-advance

**Files:**
- Create: `lib/demo/auto-advance.ts`, `lib/demo/auto-advance.test.ts`
- Modify: `components/demo/tour-provider.tsx`

**Interfaces:**
- Consumes: `DemoStep` from Task 2.
- Produces: `function autoAdvanceDelay(step: DemoStep | null | undefined): number | null`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/auto-advance.test.ts
import { describe, expect, it } from "vitest";
import { autoAdvanceDelay } from "./auto-advance";
import type { DemoStep } from "./tour";

const step = (extra: Partial<DemoStep> = {}): DemoStep => ({
  id: "s", route: "/chat", anchor: null, title: "t",
  content: [{ kind: "paragraph", text: "b" }],
  ...extra,
});

describe("autoAdvanceDelay", () => {
  it("is null when the step does not ask to advance", () => {
    expect(autoAdvanceDelay(step())).toBeNull();
  });

  it("returns the requested delay", () => {
    expect(autoAdvanceDelay(step({ advanceAfterMs: 2400 }))).toBe(2400);
  });

  it("refuses to advance a step carrying a decision", () => {
    expect(autoAdvanceDelay(step({ advanceAfterMs: 2400, cta: { label: "x", href: "/y" } }))).toBeNull();
  });

  it("refuses a non-positive delay rather than advancing instantly", () => {
    expect(autoAdvanceDelay(step({ advanceAfterMs: 0 }))).toBeNull();
    expect(autoAdvanceDelay(step({ advanceAfterMs: -1 }))).toBeNull();
  });

  it("is null for no step", () => {
    expect(autoAdvanceDelay(null)).toBeNull();
    expect(autoAdvanceDelay(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/auto-advance.test.ts`
Expected: FAIL — cannot resolve `./auto-advance`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/demo/auto-advance.ts
import type { DemoStep } from "./tour";

/**
 * How long to wait before advancing past `step`, or null to wait for a click.
 *
 * Pure, so the policy is assertable without a timer or a DOM. The provider
 * owns the timeout; this owns the decision.
 */
export function autoAdvanceDelay(step: DemoStep | null | undefined): number | null {
  if (!step?.advanceAfterMs) return null;
  // A cta is a decision — moving the page out from under one is hostile.
  if (step.cta) return null;
  // A zero or negative delay would advance in the same tick, which reads as a
  // step that never rendered rather than as an animation.
  if (step.advanceAfterMs <= 0) return null;
  return step.advanceAfterMs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/auto-advance.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the timer into the provider**

In `components/demo/tour-provider.tsx`, add `useEffect` to the imports, import `autoAdvanceDelay` from `@/lib/demo/auto-advance`, and insert this immediately before the `return { position, step, … }` in `useTourState`:

```tsx
  // Auto-advance. The timer lives here rather than in the Shepherd component
  // because stage steps never reach Shepherd, and both kinds must animate.
  //
  // Cleanup covers every way out: clicking Next or Back changes `position`,
  // which re-runs the effect and clears the pending timer, so a manual
  // navigation can never race a scheduled one.
  useEffect(() => {
    const delay = autoAdvanceDelay(step);
    if (delay === null) return;
    const forward = nextPosition(CHAPTERS, position);
    // Belt and braces with the chapter-integrity test: never carry a visitor
    // out of a chapter they may still be reading.
    if (!forward || forward.chapter !== position.chapter) return;
    const timer = setTimeout(() => go(forward), delay);
    return () => clearTimeout(timer);
  }, [step, position, go]);
```

- [ ] **Step 6: Verify nothing regressed**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. No chapter sets `advanceAfterMs` yet, so behaviour is unchanged — this task ships the mechanism, the narrative plan uses it.

- [ ] **Step 7: Commit**

```bash
git add lib/demo/auto-advance.ts lib/demo/auto-advance.test.ts components/demo/tour-provider.tsx
git commit -m "feat(demo): auto-advancing steps, cancelled by any manual navigation"
```

---

### Task 4: React panels inside Shepherd

**Files:**
- Create: `components/demo/step-panel.tsx`, `components/demo/step-content-host.tsx`
- Modify: `lib/demo/shepherd-step.ts`, `lib/demo/shepherd-step.test.ts`, `components/demo/tour-shepherd.tsx`, `components/demo/shepherd-theme.css`

**Interfaces:**
- Consumes: `ContentBlock` (Task 1), `DemoStep` (Task 2).
- Produces: `type ContentRenderer = (step: DemoStep) => HTMLElement`; `shepherdStepFor(step, handlers, renderContent)` and `shepherdStepsFor(chapters, navigate, renderContent)` both take the renderer as their LAST parameter; `renderStepContent: ContentRenderer` and `disposeStepContent(): void` from `step-content-host.tsx`.

- [ ] **Step 1: Write the failing test**

Add to `lib/demo/shepherd-step.test.ts`:

```ts
describe("step content rendering", () => {
  const step = {
    id: "s", route: "/chat", anchor: null, title: "t",
    content: [{ kind: "paragraph" as const, text: "b" }],
  };
  const handlers = {
    onNext: () => {}, onPrev: () => {}, onRestart: () => {},
    hasPrev: false, hasNext: true,
  };

  // Shepherd's StepText accepts a function returning an HTMLElement. It must
  // be a FUNCTION, not a value: tour-shepherd.tsx calls show() for the same
  // step up to five times while settling an anchor, and a captured element
  // would leak a React root on every one of them.
  it("emits text as a thunk, not a rendered value", () => {
    const options = shepherdStepFor(step, handlers, () => ({}) as HTMLElement);
    expect(typeof options.text).toBe("function");
  });

  it("does not call the renderer until Shepherd asks", () => {
    let calls = 0;
    const options = shepherdStepFor(step, handlers, () => {
      calls++;
      return {} as HTMLElement;
    });
    expect(calls).toBe(0);
    (options.text as () => HTMLElement)();
    expect(calls).toBe(1);
  });

  it("widens the panel only when the step asks", () => {
    expect(shepherdStepFor(step, handlers, () => ({}) as HTMLElement).classes)
      .toBeUndefined();
    expect(
      shepherdStepFor({ ...step, size: "wide" }, handlers, () => ({}) as HTMLElement).classes,
    ).toBe("demo-step-wide");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/shepherd-step.test.ts`
Expected: FAIL — `shepherdStepFor` takes two arguments and `text` is a string.

- [ ] **Step 3: Change `shepherd-step.ts` to accept a renderer**

Keep every other option and comment in `shepherdStepFor` verbatim. Add above it:

```ts
/**
 * Turns a step into the DOM Shepherd shows.
 *
 * Injected rather than imported so THIS module never touches React or the
 * DOM — its node tests are the only assertions on how the tour navigates, and
 * a React import would end them.
 */
export type ContentRenderer = (step: DemoStep) => HTMLElement;
```

Change the signature to `shepherdStepFor(step, handlers, renderContent: ContentRenderer)`, and replace the `text:` property and its comment with:

```ts
    // A thunk, not a value. Shepherd's StepText allows an HTMLElement, and
    // tour-shepherd.tsx re-shows the same step up to five times while an
    // anchor settles — so a captured element would leak a React root per
    // show. The host caches one element per step id and re-renders into it.
    text: () => renderContent(step),
    ...(step.size === "wide" ? { classes: "demo-step-wide" } : {}),
```

Thread the parameter through `shepherdStepsFor(chapters, navigate, renderContent)` and pass it to each `shepherdStepFor` call.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/demo/shepherd-step.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the panel**

```tsx
// components/demo/step-panel.tsx
"use client";

import { motion } from "framer-motion";

import type { ContentBlock } from "@/lib/demo/content";
import type { DemoStep } from "@/lib/demo/tour";

/**
 * A step's content, rendered.
 *
 * Deliberately thin: every decision about WHAT a step says lives in
 * lib/demo/chapters as data, so it stays testable in node. This file decides
 * only how a block looks.
 */
function Block({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className="demo-block-paragraph">{block.text}</p>;
    case "bullets":
      return (
        <ul className="demo-block-bullets">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <blockquote className={`demo-block-callout demo-callout-${block.tone}`}>
          {block.text}
        </blockquote>
      );
    case "stat":
      return (
        <div className="demo-block-stat">
          <span className="demo-stat-value">{block.value}</span>
          <span className="demo-stat-label">{block.label}</span>
        </div>
      );
    case "figure":
      // The drawings are OPEN-brand collage on transparency; see
      // scripts/generate-demo-image.py for the house style.
      return <img className="demo-block-figure" src={block.src} alt={block.alt ?? ""} />;
    case "sequence":
      return (
        <ol className="demo-block-sequence">
          {block.steps.map((label, index) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              // Staggered so a pipeline reads left to right as a process
              // rather than appearing all at once as a list.
              transition={{ delay: index * 0.12, duration: 0.28 }}
            >
              {label}
            </motion.li>
          ))}
        </ol>
      );
  }
}

export function StepPanel({ step }: { step: DemoStep }) {
  return (
    <motion.div
      className="demo-step-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {step.content.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </motion.div>
  );
}
```

- [ ] **Step 6: Write the host**

```tsx
// components/demo/step-content-host.tsx
"use client";

import { createRoot, type Root } from "react-dom/client";

import type { DemoStep } from "@/lib/demo/tour";

import { StepPanel } from "./step-panel";

/**
 * React roots for Shepherd, one per step id.
 *
 * Shepherd takes an HTMLElement for a step's text, so the bridge is a detached
 * div with a React root in it. Caching matters: tour-shepherd.tsx calls
 * show() for the SAME step up to five times while an anchor settles, and a
 * fresh createRoot per call would leak a root — and its framer-motion
 * animation — on every one.
 */
const hosts = new Map<string, { el: HTMLElement; root: Root }>();

export function renderStepContent(step: DemoStep): HTMLElement {
  let host = hosts.get(step.id);
  if (!host) {
    const el = document.createElement("div");
    el.className = "demo-step-content";
    host = { el, root: createRoot(el) };
    hosts.set(step.id, host);
  }
  host.root.render(<StepPanel step={step} />);
  return host.el;
}

/**
 * Tears every root down. Called when the tour is destroyed.
 *
 * Deferred to a microtask because unmount() during React's own render phase
 * warns, and the caller is a cleanup running inside one.
 */
export function disposeStepContent(): void {
  const roots = [...hosts.values()];
  hosts.clear();
  queueMicrotask(() => {
    for (const { root } of roots) root.unmount();
  });
}
```

- [ ] **Step 7: Wire it into `tour-shepherd.tsx`**

Add the import, pass the renderer, and dispose on teardown:

```tsx
import { disposeStepContent, renderStepContent } from "./step-content-host";
```

Change the `addSteps` call to:

```tsx
      created.addSteps(
        shepherdStepsFor(
          CHAPTERS,
          (target) => navigate.current(target),
          renderStepContent,
        ),
      );
```

…and in that effect's cleanup, after `created?.complete();`, add:

```tsx
      disposeStepContent();
```

- [ ] **Step 8: Style the panel**

Append to `components/demo/shepherd-theme.css`:

```css
/* The explainers are panels, not tooltips. 380px was a tooltip width; these
   carry a heading, a figure and a sequence. */
.shepherd-element { max-width: 30rem; }
.shepherd-element.demo-step-wide { max-width: 44rem; }

.demo-step-panel { display: flex; flex-direction: column; gap: 0.85rem; }
.demo-block-paragraph { margin: 0; line-height: 1.55; }
.demo-block-bullets { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.3rem; }

/* Lime is OPEN's primary and already the theme's --primary, so the callout
   borrows the token rather than hardcoding #EFFE7C — a themed deployment
   restyles it for free. */
.demo-block-callout {
  margin: 0;
  padding: 0.6rem 0.85rem;
  border-left: 3px solid hsl(var(--primary));
  background: hsl(var(--muted));
  font-style: normal;
}
.demo-callout-quote { font-style: italic; }

.demo-block-stat { display: flex; align-items: baseline; gap: 0.5rem; }
.demo-stat-value { font-size: 1.9rem; font-weight: 600; line-height: 1; color: hsl(var(--primary)); }
.demo-stat-label { color: hsl(var(--muted-foreground)); }

.demo-block-sequence {
  margin: 0; padding: 0; list-style: none;
  display: grid; gap: 0.4rem;
}
.demo-block-sequence li {
  padding: 0.45rem 0.7rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.4rem;
}

.demo-block-figure { display: block; width: 100%; height: auto; border-radius: 0.5rem; }
```

Note: the existing `.shepherd-text img` dark-mode inversion rule must be REMOVED — it inverts monochrome line art, and the OPEN assets are full colour. Search for it in this file and delete it.

- [ ] **Step 9: Verify**

Run: `npx vitest run lib/demo && npx tsc --noEmit && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: tests PASS, typecheck clean, build succeeds.

- [ ] **Step 10: Commit**

```bash
git add components/demo lib/demo/shepherd-step.ts lib/demo/shepherd-step.test.ts
git commit -m "feat(demo): render step content as React panels inside Shepherd"
```

---

### Task 5: Stage steps

**Files:**
- Create: `components/demo/tour-stage.tsx`
- Modify: `components/demo/tour-overlay.tsx`, `components/demo/tour-shepherd.tsx`

**Interfaces:**
- Consumes: `StepPanel` (Task 4), `useTour` (existing), `DemoStep.kind` (Task 2).
- Produces: `<TourStage />`, mounted beside `<TourShepherd />`.

- [ ] **Step 1: Write the stage**

```tsx
// components/demo/tour-stage.tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";

import { StepPanel } from "./step-panel";
import { useTour } from "./tour-provider";

/**
 * Full-bleed steps, rendered outside Shepherd.
 *
 * A cinematic opening is not a popover over a dimmed application, and pushing
 * one through Shepherd's positioning would be fighting the tool for nothing:
 * there is no anchor to attach to, no flip to compute, no cutout to punch.
 *
 * Renders nothing at all for popover steps, which is what keeps the two
 * systems from ever being on screen together.
 */
export function TourStage() {
  const { step, next, prev, position, chapters } = useTour();
  const isStage = step?.kind === "stage";

  const hasPrev =
    position.step > 0 || chapters.findIndex((c) => c.id === position.chapter) > 0;

  return (
    <AnimatePresence>
      {isStage && step ? (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-background p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          <div className="w-full max-w-3xl">
            <h2 className="mb-4 text-3xl font-semibold">{step.title}</h2>
            <StepPanel step={step} />
          </div>
          {/* Its own footer: a stage never reaches Shepherd, so it never gets
              Shepherd's buttons. Same handlers, so Back and Weiter behave
              identically on both kinds of step. */}
          <div className="flex gap-3">
            {hasPrev ? (
              <button type="button" className="shepherd-button shepherd-button-secondary" onClick={prev}>
                Zurück
              </button>
            ) : null}
            <button type="button" className="shepherd-button" onClick={next}>
              Weiter
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Mount it**

In `components/demo/tour-overlay.tsx`, import `TourStage` and render it inside `<TourProvider>` after `<TourShepherd />`:

```tsx
      <TourProvider>
        <TourShepherd />
        <TourStage />
        <TourBubble />
      </TourProvider>
```

- [ ] **Step 3: Make Shepherd skip stage steps**

In `tour-shepherd.tsx`, in the effect that syncs the shown step, change the early return to also hide Shepherd's popover for stage steps:

```tsx
    if (!tour || !step) return;
    // A stage step is rendered by TourStage. Leaving Shepherd on its previous
    // step would put a popover behind the full-bleed scene.
    if (step.kind === "stage") {
      shown.current = step.id;
      tour.hide();
      return;
    }
    if (shown.current === step.id) return;
```

`shown.current` is set so that returning from a stage to the popover step it interrupted still re-shows correctly.

- [ ] **Step 4: Guard the two systems against overlapping**

Add to `lib/demo/chapters/index.test.ts`:

```ts
  // A stage covers the viewport, so an anchor it might point at is invisible.
  // Carrying one means the step was authored as a popover and later converted.
  it("never gives a stage step an anchor", () => {
    for (const { chapter, step } of everyStep) {
      if (step.kind === "stage") {
        expect(step.anchor, `${chapter.id}/${step.id} is a stage with an anchor`).toBeNull();
      }
    }
  });
```

- [ ] **Step 5: Verify**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. No chapter uses `kind: "stage"` yet, so behaviour is unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/demo/tour-stage.tsx components/demo/tour-overlay.tsx components/demo/tour-shepherd.tsx lib/demo/chapters/index.test.ts
git commit -m "feat(demo): full-bleed stage steps outside Shepherd"
```

---

### Task 6: OPEN brand assets

**Files:**
- Create: `public/demo/brand/{logo_light.png,logo_dark.png,favicon.png}`
- Modify: `scripts/generate-demo-image.py`
- Replace: `public/demo/*.webp` (all eight)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: the asset files that `chapters/index.test.ts`'s figure-existence check asserts.

Requires `OPENAI_API_KEY` in the environment and the brand exports at `~/Downloads/logo and signet` and `~/Downloads/open styles`. `rsvg-convert` is installed.

- [ ] **Step 1: Install the brand marks**

`DEMO_BRAND` in `lib/demo/brand.ts` already points at these three paths; the directory has never existed, so `components/logo.tsx` has been silently hiding a failed image and the demo tab has had no icon.

```bash
mkdir -p public/demo/brand
cd "/Users/daniel.claessen/Downloads/logo and signet"
# Dark UI takes the white mark, light UI the black one. The demo forces dark,
# so logo_dark is the one that actually renders today.
rsvg-convert -h 96 OPEN-Logo-White-RGB.svg -o /Users/daniel.claessen/Desktop/Projects/exulu/frontend/public/demo/brand/logo_dark.png
rsvg-convert -h 96 OPEN-Logo-Black-RGB.svg -o /Users/daniel.claessen/Desktop/Projects/exulu/frontend/public/demo/brand/logo_light.png
rsvg-convert -w 256 -h 256 OPEN-Logo-Signet-Lime-RGB.svg -o /Users/daniel.claessen/Desktop/Projects/exulu/frontend/public/demo/brand/favicon.png
```

- [ ] **Step 2: Rewrite the house style**

In `scripts/generate-demo-image.py`, replace the `STYLE` constant. Keep the surrounding comment but rewrite it — the old one argues for restraint, and that argument is now answered by a brand system rather than by monochrome.

```python
# The house style is OPEN's own, taken from the Frontify exports: editorial
# collage, not technical drawing.
#
# The previous style was a monochrome engineering schematic, chosen because the
# chapters show real German transcripts and a red failing eval cell, and
# decoration would undercut them. That argument stands — it is simply answered
# better by a brand than by restraint. OPEN's collage register is confident
# without being decorative, and it makes the tour look like the company rather
# than like a generic SaaS product.
#
# Colours are exact, from the SVGs: lime #EFFE7C, ink #1A1A1A, lavender
# #C0ACF9, sage #C9D08F, blush #FFE1DE, cream #FFFDF3.
STYLE = (
    "Bold editorial collage illustration in a flat graphic brand style. "
    "A solid lime-yellow field (#EFFE7C) as the background. Large flat "
    "geometric shapes in near-black ink (#1A1A1A) with no gradients and no "
    "shading. Secondary flat shapes in soft lavender (#C0ACF9) and muted sage "
    "(#C9D08F). Crisp white dashed diagonal lines crossing the background as a "
    "pattern. Optional halftone dot fields whose dot size varies across the "
    "field. High contrast, confident, generous negative space. "
    "No text, no labels, no lettering, no numbers anywhere in the image. "
    "Flat vector look, not photographic, not 3D, no drop shadows."
)
```

Also delete the `CROP` entry for `structure` — it was tuned for a cross-section drawing that no longer exists — and set `CROP = {}`.

- [ ] **Step 3: Settle the style on one image**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
export OPENAI_API_KEY='<the key, from the environment — never commit it>'
python3 scripts/generate-demo-image.py style-test
```

Open `public/demo/style-test.webp` and check it against `~/Downloads/open styles/240903_OPEN_Newsletter_Collage.jpg`. It must read as the same brand: lime field, flat ink shapes, dashed diagonals, no text. **If it does not, iterate on `STYLE` before generating anything else** — twelve wrong images cost twelve times as much to notice.

- [ ] **Step 4: Regenerate the set**

```bash
python3 scripts/generate-demo-image.py structure ch1-answer ch2-ingestion \
  ch3-config ch4-memory ch5-evals ch6-email ch7-meetings
rm -f public/demo/style-test.webp
```

- [ ] **Step 5: Verify**

Run: `npx vitest run lib/demo && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: PASS — in particular the figure-existence test from Task 2, which proves no chapter points at an asset the regeneration renamed or dropped.

- [ ] **Step 6: Commit**

```bash
git add public/demo scripts/generate-demo-image.py
git commit -m "feat(demo): OPEN brand assets and collage house style"
```

---

### Task 7: End-to-end verification

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Build and serve in demo mode**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 2: Confirm the entry point still works**

```bash
curl -s http://localhost:3111/ | grep -oE 'NEXT_REDIRECT[^"]*'
```

Expected: a redirect to the first chapter's route carrying `?tour=intro.0`. **Zero** occurrences of `login?destination`.

- [ ] **Step 3: Walk every chapter in a browser**

Open `http://localhost:3111/`, then click Weiter through all nine chapters. Check on each step:
- the panel renders content blocks, not raw markup or `[object Object]`;
- anchored steps attach to their target rather than sitting at the top-left corner (the 0,0 position is the signature of a stranded step);
- the OPEN illustrations appear on chapter openers and are not colour-inverted;
- the browser console shows **no** `[demo] unmapped GraphQL operation` warnings and no React root warnings.

- [ ] **Step 4: Confirm no root leak**

With DevTools open, click Weiter and Zurück across a chapter boundary ten times. The detached-node count must not climb monotonically — one cached element per step id is expected, an unbounded set is the leak Task 4's cache exists to prevent.

- [ ] **Step 5: Commit any fixes, then report**

```bash
git add -A && git commit -m "fix(demo): <what the walkthrough found>"
```

If the walkthrough is clean, there is nothing to commit — say so rather than inventing a change.

---

## Self-Review

**Spec coverage.** Presentation layer → Tasks 1, 2, 4. Motion model → Task 3. `stage` steps → Task 5. Visual system and assets → Task 6. Testing strategy → the test steps in Tasks 1–5 plus Task 7. **Deliberately deferred to the follow-on narrative plan:** the twelve-chapter arc, chapters 1–4, the reorder, `advanceAfterMs` values, and the "Neun Kapitel" intro copy — this plan ships the mechanisms they need and leaves the nine existing chapters behaving exactly as before.

**Known gap carried forward.** The spec lists Poppins/Playfair as out of scope; they remain unloaded, so the demo renders Inter/Merriweather regardless of the theme tokens.

**Type consistency.** `ContentBlock` (Task 1) is consumed by `DemoStep.content` (Task 2), `StepPanel` (Task 4). `ContentRenderer` (Task 4) is the third parameter of both `shepherdStepFor` and `shepherdStepsFor`, supplied by `renderStepContent` (Task 4). `autoAdvanceDelay` (Task 3) reads `DemoStep.advanceAfterMs` (Task 2). `kind: "stage"` (Task 2) is read by `TourStage` (Task 5) and `tour-shepherd.tsx` (Task 5).
