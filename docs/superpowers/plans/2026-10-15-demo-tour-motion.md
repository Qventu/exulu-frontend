# Demo Tour Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the tour's three narrated motions a real on-screen moment: the assistant visibly searches before it answers (with German trace lines), the knowledge lists fill row by row, and the four scene pages use their column, with a redesigned opening and a closing scene that carries the ask.

**Architecture:** The search beat is two holds in the demo transport plus a demo-only "searching" state in the existing retrieval card; trace lines become German in the fixture. List fills are framer-motion entrances on the two row components, gated by `isDemoMode()` and reduced-motion. Scenes get their own stylesheet scope, the opening scene is reordered, a `cta` block kind is added, and a `contact-close` scene replaces the chat background on the last step. Every product change is behind `isDemoMode()` or a demo-only class; the walker's exchange wait grows to cover the hold.

**Tech Stack:** Next.js 16, React 19, AI SDK v5 UIMessage chunks, framer-motion 12, vitest (node), Playwright outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — sub-project 4, decision D3.

**Branch:** `fix/demo-tour-motion` from `main` (988deb7).

**Spec clarifications carried by this plan** (write them into the spec in Task 7):
- The retrieval card today renders only after the whole turn has finished streaming (`!streaming` gate) and `computeContextSearchData` never reads the part's `state`; "searching" therefore needs its own branch in `ContextSearchResults`, keyed on `state !== "output-available"`, not a tweak of the gate alone.
- The "CTA inline" on the closing scene is a new `ContentBlock` kind `cta`; it renders only when `DEMO_BOOKING_URL` is set (still `""` — Daniel supplies it), so the scene ships without a button until then and the panel footer keeps its CTA logic unchanged.
- `kosten.webp` remains a byte-copy of `ch5-evals.webp`; generating it needs the OpenAI key (`scripts/generate-demo-image.py kosten`) and is outside this plan.
- Chapter 6's chat replays no search (only the memory write), so the search beat is a chapter-5 feature.

## Global Constraints

- Daniel runs the production build and server (`NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`, then `… npx next start -p 3111`); the executor never runs `next build`. Product-file changes need a rebuild; walker-only changes do not.
- Every product change is behind `isDemoMode()` from `@/lib/demo/flag` (build-time inlined) or a class only the demo renders (`.demo-scene`); the one shared component touched (`components/ui/table.tsx`) is not edited.
- `components/demo/step-panel.tsx` and `Block` must stay free of Apollo hooks and `useTour()` (two mounts with different providers).
- New German is Sie-form, drafted here, listed in "Copy for sign-off". Existing chapter copy is moved, not reworded (the contact.1 paragraph moves into the scene verbatim).
- Client names (NEW Lift, ALGI) only in content the `contact` chapter reaches — `lib/demo/chapters/index.test.ts` skips that chapter by id, so a scene reached only from `contact.1` may carry them.
- Per-task gate: `npx vitest run <files>` + `npx eslint --no-warn-ignored <files>`; neither type-checks — watch nullable fields; Daniel's build is the type gate.
- Commit after every task; subjects lowercase after the type, ≤ 100 chars (commitlint); never push.

## Review Focus

1. The transport's abort check must still stop the stream during a hold — Task 1 tests an abort fired by the hold's sleep.
2. A non-demo chat must render exactly as before: no searching card, the `!streaming` gate intact — Task 2 keeps the original expression on the non-demo path; the reviewer reads it.
3. `prefers-reduced-motion: reduce` must suppress the row entrances — Task 4 passes `initial={false}` under `useReducedMotion()`.
4. A scene reached from a non-contact chapter must never carry client names — Task 5's new scene is reachable only from `contact.1`; the existing name test enforces it.
5. The walker must not advance mid-search: its stability window must exceed `holdAfterToolInputMs` — Task 6 sets 2,500 ms against an 1,800 ms hold and asserts the relationship in a comment.

---

### Task 1: The transport pauses around the tool call

**Files:**
- Modify: `lib/demo/chat-transport.ts` (options, the stream loop at ~73-82)
- Modify: `lib/demo/chat-transport.test.ts`

**Interfaces:**
- Produces: `DemoChatTransportOptions.holdAfterToolInputMs?: number` (default 1800), `holdAfterToolOutputMs?: number` (default 600).
- Consumes: chunk `type` strings from `lib/demo/script.ts` `buildChunks`: `tool-input-available`, `tool-output-available`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/demo/chat-transport.test.ts` (inside the existing `describe`):

```ts
  const TOOL_TURN: ScriptedTurn[] = [
    {
      id: "m3",
      toolCalls: [{ toolCallId: "tc1", toolName: "Context_Search", input: { q: "x" }, output: { result: "[]" } }],
      text: "Answer.",
      sources: [],
    },
  ];

  it("holds after the tool call goes out, and again once its result is in", async () => {
    const calls: number[] = [];
    const sleep = vi.fn((ms: number) => { calls.push(ms); return Promise.resolve(); });
    const t = new DemoChatTransport({ turns: TOOL_TURN, delayMs: 5, sleep });
    const chunks = await drain(await t.sendMessages({} as any));
    const types = chunks.map((c) => c.type);
    // The hold follows the chunk it belongs to: input → 1800, output → 600.
    const inputIdx = types.indexOf("tool-input-available");
    const outputIdx = types.indexOf("tool-output-available");
    expect(inputIdx).toBeGreaterThanOrEqual(0);
    expect(outputIdx).toBeGreaterThan(inputIdx);
    expect(calls.slice(inputIdx * 1, inputIdx * 1 + 2)).toEqual([5, 1800]);
    expect(calls).toContain(600);
    expect(calls.filter((ms) => ms === 1800)).toHaveLength(1);
  });

  it("lets the holds be configured", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const t = new DemoChatTransport({ turns: TOOL_TURN, delayMs: 5, sleep, holdAfterToolInputMs: 10, holdAfterToolOutputMs: 20 });
    await drain(await t.sendMessages({} as any));
    expect(sleep).toHaveBeenCalledWith(10);
    expect(sleep).toHaveBeenCalledWith(20);
    expect(sleep).not.toHaveBeenCalledWith(1800);
  });

  it("stops during a hold when aborted", async () => {
    const controller = new AbortController();
    let n = 0;
    const t = new DemoChatTransport({
      turns: TOOL_TURN,
      delayMs: 5,
      holdAfterToolInputMs: 1800,
      sleep: (ms) => { if (ms === 1800) controller.abort(); n++; return Promise.resolve(); },
    });
    const chunks = await drain(await t.sendMessages({ abortSignal: controller.signal } as any));
    expect(chunks.map((c) => c.type)).toEqual(["tool-input-available"]);
  });
```

(The exact `ScriptedToolCall` field names are in `lib/demo/script.ts:3-22`; adjust the `TOOL_TURN` literal to them if they differ from `toolCallId/toolName/input/output`.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/demo/chat-transport.test.ts`
Expected: FAIL — `calls` holds only 5s; `holdAfterToolInputMs` is not an option.

- [ ] **Step 3: Add the holds**

In `lib/demo/chat-transport.ts` extend the options and the loop:

```ts
interface DemoChatTransportOptions {
  turns: ScriptedTurn[] | (() => ScriptedTurn[]);
  /** Pause between chunks, in ms. Tuned for realism, not speed. */
  delayMs?: number;
  /**
   * The search beat. Tool chunks are built back to back, so without these
   * the assistant "searched" for 36 ms — the retrieval card appeared after
   * the answer, and the step that says "watch it search" had nothing to
   * watch. The first hold is the search itself (the card shows a searching
   * state meanwhile, components/message-renderer.tsx); the second lets the
   * trace lines land before the first sentence.
   */
  holdAfterToolInputMs?: number;
  holdAfterToolOutputMs?: number;
  /** Injected so tests run instantly and deterministically. */
  sleep?: (ms: number) => Promise<void>;
}
```

Store them in the constructor (`holdAfterToolInputMs = 1800`, `holdAfterToolOutputMs = 600`) and change the stream loop to:

```ts
        for (const chunk of chunks) {
          if (signal?.aborted) break;
          controller.enqueue(chunk);
          await sleep(delayMs);
          const hold =
            chunk.type === "tool-input-available" ? holdAfterToolInputMs
            : chunk.type === "tool-output-available" ? holdAfterToolOutputMs
            : 0;
          if (hold > 0 && !signal?.aborted) await sleep(hold);
        }
```

(capture `holdAfterToolInputMs`/`holdAfterToolOutputMs` from `this` next to `sleep, delayMs`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/demo/chat-transport.test.ts`
Expected: PASS (10 tests). If the first hold test's `calls.slice` index arithmetic does not line up with the chunk order, assert instead that `calls` contains the subsequence `[5, 1800]` immediately after the input chunk's pacing sleep — the invariant is "1800 follows the input chunk, 600 follows the output chunk, neither occurs elsewhere".

- [ ] **Step 5: Lint and commit**

```bash
npx eslint --no-warn-ignored lib/demo/chat-transport.ts lib/demo/chat-transport.test.ts
git add lib/demo/chat-transport.ts lib/demo/chat-transport.test.ts
git commit -m "feat(demo): hold the stream around the tool call so the search is visible

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The retrieval card searches before it reports

**Files:**
- Modify: `lib/demo/overlays.ts` (add `SEARCHING_LABEL`), `lib/demo/overlays.test.ts`
- Modify: `components/message-renderer.tsx` `ContextSearchResults` (~1718-1856)

**Interfaces:**
- Produces: `SEARCHING_LABEL = "Durchsucht sieben Wissensbasen …"`.
- Consumes: `Shimmer` from `components/ai-elements/shimmer.tsx` (`children: string`, `as`, `className`), `Search` icon already imported, `isDemoMode`.

- [ ] **Step 1: Write the failing test**

Append to `lib/demo/overlays.test.ts`:

```ts
import { SEARCHING_LABEL } from "./overlays";

describe("SEARCHING_LABEL", () => {
  it("is a German, Sie-form phrase ending in an ellipsis", () => {
    expect(SEARCHING_LABEL).toMatch(/^Durchsucht .* …$/);
    expect(SEARCHING_LABEL).not.toMatch(/\b(du|dein)\b/i);
  });
});
```

(Merge the import into the existing import line.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/overlays.test.ts`
Expected: FAIL — `SEARCHING_LABEL` is not exported.

- [ ] **Step 3: Add the label**

In `lib/demo/overlays.ts` after `TOOL_STATUS_LABELS`:

```ts
/** The retrieval card while the demo transport holds the tool call (chat-transport.ts). */
export const SEARCHING_LABEL = "Durchsucht sieben Wissensbasen …";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/overlays.test.ts`
Expected: PASS.

- [ ] **Step 5: The searching state and the relaxed gate**

In `components/message-renderer.tsx`, add `import { SEARCHING_LABEL } from "@/lib/demo/overlays";` (the file already imports `isDemoMode` and `Shimmer`). In `ContextSearchResults`, before the `return`, add:

```tsx
  // The demo transport holds the stream after the tool call goes out
  // (lib/demo/chat-transport.ts). The product renders nothing until the
  // turn ends; the tour says "watch it search", so the demo shows the card
  // in a searching state during the hold, and shows the result as soon as
  // it lands rather than when the stream closes.
  const demo = isDemoMode();
  const searching = demo && state !== "output-available" && state !== "output-error";
  const showResults = demo
    ? state === "output-available" && items?.length > 0
    : state === "output-available" && items?.length > 0 && !streaming;
```

Replace the gate `state === "output-available" && items?.length > 0 && !streaming && (` with `showResults && (`, and insert the searching card as the first child of the fragment, before the gated block:

```tsx
      {searching && (
        <div className="my-3 border rounded-lg overflow-hidden bg-card" data-demo-id="chat-retrieval-searching">
          <div className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-md bg-primary/10">
              <Search className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <Shimmer as="span" className="text-sm font-medium">{SEARCHING_LABEL}</Shimmer>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Lint, run the chat suites, commit**

Run: `npx eslint --no-warn-ignored components/message-renderer.tsx lib/demo/overlays.ts lib/demo/overlays.test.ts && npx vitest run lib/demo lib/chat`
Expected: eslint no errors (pre-existing warnings); tests PASS.

```bash
git add components/message-renderer.tsx lib/demo/overlays.ts lib/demo/overlays.test.ts
git commit -m "feat(demo): the retrieval card shows a searching state during the hold

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: German trace lines

**Files:**
- Modify: `lib/demo/fixtures/techdoc-turns.ts:24-32` and the `reasoning:` mapping (~93)
- Create: `lib/demo/fixtures/retrieval-steps.test.ts`

**Interfaces:**
- Produces: `RETRIEVAL_STEPS: { text: string; source: string }[]` (exported for the test).

- [ ] **Step 1: Write the failing test**

`lib/demo/fixtures/retrieval-steps.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { RETRIEVAL_STEPS, TECHDOC_TURNS } from "./techdoc-turns";

describe("the retrieval trace", () => {
  it("speaks German to the visitor and keeps the original line for the record", () => {
    expect(RETRIEVAL_STEPS).toHaveLength(7);
    for (const step of RETRIEVAL_STEPS) {
      expect(step.text).not.toMatch(/Classified|Detected|Reranking|Rerank_score|Using fallback|pinning|Main contexts/);
      expect(step.text).not.toMatch(/_context\b/);
      expect(step.source).toBeTruthy();
    }
  });

  it("is what the tool output carries", () => {
    const result = JSON.parse(TECHDOC_TURNS[0].toolCalls[0].output.result as string);
    expect(result.reasoning.map((r: { text: string }) => r.text)).toEqual(RETRIEVAL_STEPS.map((s) => s.text));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/fixtures/retrieval-steps.test.ts`
Expected: FAIL — `RETRIEVAL_STEPS` is not exported / entries are strings.

- [ ] **Step 3: Translate the trace**

Replace `RETRIEVAL_STEPS` in `lib/demo/fixtures/techdoc-turns.ts` with (export it):

```ts
/**
 * The retrieval trace the visitor reads step by step while the answer
 * streams. `text` is what renders (ReasoningVisualisation shows it
 * verbatim); `source` is the production log line it was translated from,
 * kept so the fixture stays checkable against the real pipeline.
 */
export const RETRIEVAL_STEPS: { text: string; source: string }[] = [
  {
    text: "Frage als technische Frage erkannt: ein konkreter Fehlercode (Nothalt COP) in einem bestimmten System (FST-Fehlerspeicher).",
    source: "Classified the request as: technical because: The user is asking for the meaning of a specific error code (Nothalt COP) in a technical system (FST error log).",
  },
  {
    text: "Zuerst in der Technischen Dokumentation suchen; Ausweichquellen: Servicedatenbank, Support-Tickets, Eigene Dokumente, Software-Dokumentation.",
    source: "Main contexts: tech_doc_context, Fallback contexts: new_servicedb_context, support_tickets_context, custom_documents_context, software_documentation_context",
  },
  { text: "Produktname in der Frage erkannt: FST", source: "Detected Product names in the question: FST" },
  { text: "321 Passagen nach Relevanz neu bewertet", source: "Reranking 321 chunks" },
  { text: "Relevanz der Treffer zwischen 0,60 und 0,87", source: "Rerank_score min: 0.5979366, Rerank_score max: 0.8704211" },
  {
    text: "Ausweichsuche in Servicedatenbank, Support-Tickets, Eigenen Dokumenten und Software-Dokumentation",
    source: "Using fallback search in new_servicedb_context, support_tickets_context, custom_documents_context, software_documentation_context",
  },
  {
    text: "Das Gedächtnis bevorzugt zwei Dokumente und nimmt sie in die Suche auf: FST2XTchanges-customer-DE.docx, MIPA_FST-3_DE.pdf",
    source: "Memory prioritizes specific document(s); pinning 2 file(s) into the search: FST2XTchanges-customer-DE.docx, MIPA_FST-3_DE.pdf",
  },
];
```

and change the mapping at ~93 from `reasoning: RETRIEVAL_STEPS.map((text) => ({ text, tools: [] })),` to `reasoning: RETRIEVAL_STEPS.map(({ text }) => ({ text, tools: [] })),`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/demo/fixtures/retrieval-steps.test.ts lib/demo/chapter-memory.test.ts lib/demo/fixture-dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, commit**

```bash
npx eslint --no-warn-ignored lib/demo/fixtures/techdoc-turns.ts lib/demo/fixtures/retrieval-steps.test.ts
git add lib/demo/fixtures/techdoc-turns.ts lib/demo/fixtures/retrieval-steps.test.ts
git commit -m "feat(demo): the retrieval trace reads in German

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The lists fill row by row

**Files:**
- Modify: `app/(application)/data/components/library-row.tsx:57, 114`
- Modify: `app/(application)/data/components/context-library.tsx:165-172`
- Modify: `app/(application)/data/[ctx]/components/items-table.tsx` (module scope, the `items.map` at 356-371, the mobile list at 376-396, `ItemRow` at ~483-488)

**Interfaces:**
- Produces: `LibraryRow` and `ItemRow` take `index: number`.
- Consumes: `motion`, `useReducedMotion` from `framer-motion`; `TableRow` from `@/components/ui/table` (a `forwardRef` `<tr>`, so `motion.create(TableRow)` works).

- [ ] **Step 1: The knowledge-base rows**

In `library-row.tsx` add:

```ts
import { motion, useReducedMotion } from "framer-motion";

import { isDemoMode } from "@/lib/demo/flag";
```

add `index: number` to `LibraryRow`'s props, and change the outer element (line 114) from `<li className="group relative transition-colors hover:bg-accent/50">` to:

```tsx
    <motion.li
      className="group relative transition-colors hover:bg-accent/50"
      // Demo only: chapter 2's list grows 0 → 3 → 7 across three steps and
      // the step says the bases are being created; rows that pop in all at
      // once read as a reload. Keyed by id, so a refetch that grows the list
      // animates only the new rows. Off outside the demo and under
      // reduced motion (initial={false} renders the resting state).
      initial={demoEntrance ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.06, ease: "easeOut" }}
    >
```

with, at the top of the component body:

```ts
  const reduceMotion = useReducedMotion();
  const demoEntrance = isDemoMode() && !reduceMotion;
```

and the closing tag `</motion.li>`. In `context-library.tsx` change `{rows.map((row) => (` to `{rows.map((row, index) => (` and pass `index={index}` to `<LibraryRow>`.

- [ ] **Step 2: The document rows**

In `items-table.tsx` add the same two imports plus `const MotionTableRow = motion.create(TableRow);` at module scope (after the imports). Give `ItemRow` an `index: number` prop, compute `demoEntrance` as above inside it, and change its outer `<TableRow data-state=… className=…>` to `<MotionTableRow … initial={demoEntrance ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: index * 0.06, ease: "easeOut" }}>` (closing `</MotionTableRow>`). In the desktop `items.map((item) => {` pass `index` (`items.map((item, index) => {` … `index={index}`). For the mobile list (376-396) change `<li key={id}>` to a `motion.li` with the same props (compute `demoEntrance` once in the table component; `useReducedMotion` there too).

- [ ] **Step 3: Lint, run the data tests, commit**

Run: `npx eslint --no-warn-ignored "app/(application)/data/components/library-row.tsx" "app/(application)/data/components/context-library.tsx" "app/(application)/data/[ctx]/components/items-table.tsx" && npx vitest run "app/(application)/data"`
Expected: no errors; PASS. (If the React Compiler lint flags `motion.create` at module scope, move it into a `useMemo`-free module constant file `app/(application)/data/[ctx]/components/motion-table-row.ts` exporting it.)

```bash
git add "app/(application)/data/components/library-row.tsx" "app/(application)/data/components/context-library.tsx" "app/(application)/data/[ctx]/components/items-table.tsx"
git commit -m "feat(demo): knowledge rows enter staggered in the tour

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Scenes at full size, an opening frame, a closing scene

**Files:**
- Modify: `lib/demo/content.ts` (`ContentBlock` union + `contentText`), `lib/demo/content.test.ts`
- Modify: `components/demo/step-panel.tsx` (`Block`: `cta` case)
- Modify: `app/globals.css` (`.demo-scene` rules, after `.demo-block-figure`)
- Modify: `lib/demo/scenes.ts` (`daten-pile` order; new `contact-close`)
- Modify: `lib/demo/chapters/contact.ts` (step `contact-close` routes to the scene, content `[]`)

**Interfaces:**
- Produces: `ContentBlock` gains `{ kind: "cta"; label: string; href: string }`; `DEMO_SCENES["contact-close"]`.
- Consumes: `sceneRoute` from `lib/demo/scenes.ts`; `DEMO_BOOKING_URL` from `lib/demo/routes.ts`.

- [ ] **Step 1: Write the failing test**

In `lib/demo/content.test.ts` add `{ kind: "cta", label: "Termin buchen", href: "https://example.invalid" },` to the `blocks` array of "flattens every block kind into searchable text" and an assertion `expect(text).toContain("Termin buchen");` next to the others. Add a new test:

```ts
  it("counts a call to action as copy by its label only", () => {
    expect(contentText([{ kind: "cta", label: "Termin buchen", href: "https://example.invalid" }])).toBe("Termin buchen");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/content.test.ts`
Expected: FAIL — type error / `unhandled` branch.

- [ ] **Step 3: The block kind**

`lib/demo/content.ts`: add `| { kind: "cta"; label: string; href: string }` to the union with the comment `/** A button inside a scene — the closing ask. Rendered only where a scene asks for it; the panel footer's CTA is a separate step field. */` and `case "cta": return block.label;` in `contentText`.

`components/demo/step-panel.tsx` `Block`: add

```tsx
    case "cta":
      return (
        <a className="demo-button self-start" href={block.href}>
          {block.label}
        </a>
      );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/content.test.ts`
Expected: PASS.

- [ ] **Step 5: The scene stylesheet**

Append to `app/globals.css` right after the `.demo-block-figure` rule:

```css
/* A scene page (app/(application)/demo/szene/[id]/page.tsx) renders a step's
 * blocks into a 768px column instead of the 420px panel. The shared block
 * rules above are sized for the panel; here the figure may stand at its
 * natural height (800x534 → ~512px at 768px wide), the stat is the frame's
 * headline, and the copy gets reading-size type and room between blocks.
 * .demo-scene exists only on that page. */
.demo-scene .demo-step-panel { gap: 1.5rem; }
.demo-scene .demo-block-figure { max-height: 520px; }
.demo-scene .demo-stat-value { font-size: 3.5rem; }
.demo-scene .demo-stat-label { font-size: 1.1rem; }
.demo-scene .demo-block-paragraph,
.demo-scene .demo-block-bullets,
.demo-scene .demo-block-callout { font-size: 1.1rem; line-height: 1.6; }
.demo-scene .demo-block-sequence li { font-size: 1.05rem; padding: 0.6rem 0.9rem; }
```

- [ ] **Step 6: The opening frame and the closing scene**

In `lib/demo/scenes.ts` reorder `daten-pile`'s content to figure, stat, paragraph (same three blocks, same text). Add:

```ts
  // Reached only from contact.1 — the one chapter allowed to name the
  // reference customers (lib/demo/chapters/index.test.ts skips it by id).
  "contact-close": {
    content: [
      { kind: "figure", src: "/demo/structure.webp", alt: "Anlagen unserer Referenzkunden" },
      {
        kind: "paragraph",
        text: "NEW Lift Steuerungsbau (technische Dokumentation und Service) und ALGI Hydraulic (Angebots- und Ersatzteilprozesse) arbeiten produktiv mit OPEN IMP. Alles, was Sie eben gesehen haben, ist daraus abgeleitet — verallgemeinert, aber realistisch.",
      },
      { kind: "stat", value: "10", label: "Ihrer Handbücher" },
      { kind: "stat", value: "2 Wochen", label: "echte Fragen Ihres Serviceteams" },
      { kind: "stat", value: "30 Minuten", label: "reichen für die Planung" },
      {
        kind: "paragraph",
        text: "Zehn Ihrer Handbücher, zwei Wochen, echte Fragen Ihres Serviceteams — auf genau dem, was Sie eben gesehen haben. Dreißig Minuten reichen für die Planung.",
      },
      ...(DEMO_BOOKING_URL ? [{ kind: "cta" as const, label: "30-Minuten-Termin buchen", href: DEMO_BOOKING_URL }] : []),
    ],
  },
```

with `import { DEMO_BOOKING_URL } from "./routes";` (check for an import cycle: `routes.ts` imports fixture ids only; `scenes.ts` is imported by `step-content.ts` and the scene page — fine).

In `lib/demo/chapters/contact.ts` change the `contact-close` step's `route: TECHDOC_CHAT` to `route: sceneRoute("contact-close")`, its `content` to `[]` (the paragraph now lives in the scene), keep `anchor: null`, keep the `cta` spread (the panel footer's button when the URL is set). Import `sceneRoute` from `../scenes`.

- [ ] **Step 7: Run the chapter and tour tests, lint, commit**

Run: `npx vitest run lib/demo/chapters/index.test.ts lib/demo/tour.test.ts lib/demo/scenes.test.ts lib/demo/supported-routes.test.ts lib/demo/content.test.ts lib/demo/nav-routes.test.ts && npx eslint --no-warn-ignored lib/demo/content.ts lib/demo/scenes.ts lib/demo/chapters/contact.ts components/demo/step-panel.tsx`
Expected: PASS (the 90-word cap: the closing scene is ~75 words; the name test skips `contact`; the figure test finds `structure.webp`; the nav test: `/demo` is excluded); eslint clean.

```bash
git add lib/demo/content.ts lib/demo/content.test.ts components/demo/step-panel.tsx app/globals.css lib/demo/scenes.ts lib/demo/chapters/contact.ts
git commit -m "feat(demo): scenes at full size, an opening frame, a closing scene with the ask

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The walker waits out the search

**Files:**
- Modify: `scripts/walk-demo.mjs` `waitForScriptedExchange` (the `1500` stability window)

- [ ] **Step 1: Widen the window**

Change `if (phase === "sent" && Date.now() - stableSince > 1500) return true;` to:

```js
    // Must exceed the transport's search hold (lib/demo/chat-transport.ts,
    // holdAfterToolInputMs 1800): during it the conversation text is still,
    // and a 1.5s window declared the exchange over mid-search.
    if (phase === "sent" && Date.now() - stableSince > 2500) return true;
```

and raise the function's `timeoutMs` default from 25000 to 30000.

- [ ] **Step 2: Syntax-check, commit**

```bash
node --check scripts/walk-demo.mjs
git add scripts/walk-demo.mjs
git commit -m "test(demo): the walker waits out the search hold

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Verify on Daniel's build; spec note; copy for sign-off

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` (append "Clarifications 2026-10-15 (sub-project 4)" with the four items from this plan's header)
- Modify: this plan (Verification, Copy for sign-off)

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all PASS (`components/shell/nav-config.test.ts` is a pre-existing failure if it appears; compare with `main`).

- [ ] **Step 2: Ask Daniel to build and serve**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 3: Walk it**

`DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs` — expected 37/37, `leaks=none`, 3 Tabs.

- [ ] **Step 4: Spot checks (Playwright, scratch directory)**

- `techdoc.0`: sample every 100 ms from the send; `[data-demo-id="chat-retrieval-searching"]` is visible for ≥ 1,500 ms before the first answer text; the trace lines contain "321 Passagen" and no `_context`; the retrieval card appears before the stream ends.
- `struktur.1` → Weiter → `struktur.2`: within 100 ms of the title change, at least two of the four new rows have opacity < 1; after 600 ms all rows have opacity 1. Same for `aufnahme.0` → `aufnahme.1` on the items table.
- `daten.0`: the figure's rendered height ≥ 480 px at 1440 × 900; the stat value's font-size is 56 px.
- `contact.1`: the route is `/demo/szene/contact-close`; the scene shows the figure, both paragraphs and three stat blocks; no `cta` block (URL unset); the panel footer shows Zurück only.
- Reduced motion (`reducedMotion: "reduce"` context): rows on `struktur.2` have opacity 1 at first paint.
- Non-demo sanity is by code review only (no non-demo build).

- [ ] **Step 5: Record and commit**

Append `## Verification` and `## Copy for sign-off` (the searching label, the seven trace lines, the three stat values and labels, and note the two moved paragraphs) to this plan; append the clarifications to the spec.

```bash
git add docs/superpowers/plans/2026-10-15-demo-tour-motion.md docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md
git commit -m "docs(demo): record the motion walk and list the copy for sign-off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
