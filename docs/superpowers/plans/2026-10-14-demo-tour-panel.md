# Demo Tour Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the docked tour panel carry the story: every step's copy visible without a click, a chapter rail and goal line for orientation, a short reveal on each step, and a panel the keyboard reaches first.

**Architecture:** `components/demo/tour-panel.tsx` is rewritten around one width (420 px) with no expanded state; the chapter menu stays as a toggle, and a twelve-segment rail (pure helper `lib/demo/panel-rail.ts`) sits in the header with the chapter's one-line `goal` (new field on `DemoChapter`, twelve German drafts for sign-off). The step body is a framer-motion block keyed on the position. The panel moves before `<main>` in DOM order with `order-last` for its visual position, so Tab reaches Weiter in three presses. The walker asserts that each step's first paragraph is visible in the panel and that no "Mehr" button exists.

**Tech Stack:** Next.js 16 app router, React 19, framer-motion 12.23 (`useReducedMotion`), Tailwind, vitest (node), Playwright walker outside the repo.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — sub-project 2, decision D1.

**Branch:** `fix/demo-tour-panel` from `main` (41fcfbd or later).

**Spec amendments carried by this plan** (Task 4 writes them into the spec):
1. Keyboard reach is achieved by DOM order (panel before `<main>`, `order-last` for layout), not by `inert` on `<main>`. An inert subtree is excluded from hit-testing, so the chat's inner scroller would stop responding to the wheel — the exact regression the docked-panel spec exists to avoid.
2. `DemoChapter.goal` is required, not optional: all twelve ship in Task 1 and the test demands them.

## Global Constraints

- Node 22.18.0 for anything that builds; the implementer does not run `next build` — Daniel builds and serves (`NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`, then `npx next start -p 3111`).
- vitest runs in `environment: "node"`, collects `**/*.test.ts` only; React components are verified by the walker, pure helpers by node tests.
- New German strings are drafted here and listed in Task 6 for sign-off by Daniel and Doro (decision 2026-10-14). Existing step copy is not edited.
- Client names only in `lib/demo/chapters/contact.ts` — test-enforced.
- Per-task gate: vitest for the task plus `npx eslint` on every touched file, hard-failing the chain on a lint error (`if npx eslint … ; then … ; else exit 1; fi`). Perl edits use `#` delimiters, never `|`.
- Commit after every task; never push.

## Review Focus

1. A step with empty `content` (the four scene steps) must render title only, without an empty content box or a stray gap — Task 3's `StepPanel` render is conditional; checked in the walker (Task 5) by the `contentVisible` rule skipping scene steps.
2. `prefers-reduced-motion: reduce` must suppress the step reveal — Task 3 passes `initial={false}` under `useReducedMotion()`; verified once in the browser in Task 6.
3. The chapter menu must close when a chapter is chosen and stay operable while a Radix dialog is open (the chapter-7 wizard) — Task 3 closes it in the click handler; the walker's `coveringPanel` assertion still guards the dialog case.
4. Below `md` the panel must still dock at the bottom after the DOM reorder — Task 4 keeps `order-last` on both breakpoints; Task 6 checks one mobile viewport.
5. Portalled dialogs must stay clear of the new 420 px width — Task 3 updates `--tour-panel-w` in the same commit as the class; the walker's `coveringPanel` assertion on `config.1`–`config.4` is the gate.

---

### Task 1: Every chapter gets a one-line goal

**Files:**
- Modify: `lib/demo/tour.ts:63-67` (`DemoChapter`)
- Modify: `lib/demo/chapters/{daten,struktur,aufnahme,zugriff,techdoc,memory,config,evals,email,meetings,kosten,contact}.ts` (one line each, after `title:`)
- Modify: `lib/demo/chapters/index.test.ts`

**Interfaces:**
- Produces: `DemoChapter.goal: string`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b fix/demo-tour-panel main
```

- [ ] **Step 2: Write the failing test**

Append inside `describe("chapter integrity", …)` in `lib/demo/chapters/index.test.ts` (before its closing `});`):

```ts
  // The docked panel shows the chapter's goal under its title on every step
  // (sub-project 2). One line, Sie-form, a full sentence: it is read 37 times.
  it("gives every chapter a one-line goal", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.goal, `${chapter.id} has no goal`).toBeTruthy();
      const words = chapter.goal.trim().split(/\s+/).length;
      expect(words, `${chapter.id} goal is ${words} words`).toBeLessThanOrEqual(14);
      expect(chapter.goal.trim().endsWith("."), `${chapter.id} goal is not a sentence`).toBe(true);
    }
  });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/demo/chapters/index.test.ts`
Expected: FAIL — `daten has no goal` (TypeScript also reports `goal` missing on the type; vitest still runs).

- [ ] **Step 4: Add the field**

In `lib/demo/tour.ts` replace the `DemoChapter` interface with:

```ts
export interface DemoChapter {
  id: DemoChapterId;
  title: string;
  /**
   * The chapter's aim in one sentence, shown under the chapter title in the
   * docked panel on every step of the chapter. Visitor-facing German —
   * drafted by the implementer, signed off by the copy owners.
   */
  goal: string;
  steps: DemoStep[];
}
```

- [ ] **Step 5: Add the twelve goals**

In each chapter module, insert the `goal:` line directly after the `title:` line:

| File | Insert after | Line to insert |
|---|---|---|
| `daten.ts` | `  title: "Ihre Daten",` | `  goal: "Wo Ihr Wissen heute liegt, und warum eine KI damit nichts anfangen kann.",` |
| `struktur.ts` | `  title: "Struktur",` | `  goal: "Wissen bekommt einen Ort: eine Basis je Wissensart.",` |
| `aufnahme.ts` | `  title: "Aufnahme",` | `  goal: "Aus Dateien werden durchsuchbare Passagen, jede mit ihrer Herkunft.",` |
| `zugriff.ts` | `  title: "Zugriff",` | `  goal: "Wer lesen darf, bestimmt auch, was die Antwort enthält.",` |
| `techdoc.ts` | `  title: "Eine schwierige Frage",` | `  goal: "Eine Technikerfrage, live beantwortet und mit Quellen belegt.",` |
| `memory.ts` | `  title: "Korrigieren",` | `  goal: "Eine Korrektur im Chat wird zu Wissen für alle Kollegen.",` |
| `config.ts` | `  title: "Anpassen ohne Code",` | `  goal: "Der Assistent ist Konfiguration, die Ihr eigenes Team bedient.",` |
| `evals.ts` | `  title: "Belegen statt behaupten",` | `  goal: "Antwortqualität wird gemessen, nicht behauptet.",` |
| `email.ts` | `  title: "Arbeitet, während Sie schlafen",` | `  goal: "Dasselbe Produkt bearbeitet Ersatzteilanfragen, ohne dass jemand fragt.",` |
| `meetings.ts` | `  title: "Festhalten, was besprochen wurde",` | `  goal: "Aus Besprechungen werden Dokumente, die jemand liest.",` |
| `kosten.ts` | `  title: "Was es kostet",` | `  goal: "Verbrauch sichtbar, Limits im Betrieb, keine Einsparung versprochen.",` |
| `contact.ts` | `  title: "Sprechen Sie mit uns",` | `  goal: "Wer damit arbeitet, und wie es bei Ihnen weitergeht.",` |

A one-shot way to do all twelve (run from the repo root; `#` delimiters):

```bash
g() { perl -0pi -e "s#(  title: \"$2\",\n)#\$1  goal: \"$3\",\n#" "lib/demo/chapters/$1.ts"; }
g daten "Ihre Daten" "Wo Ihr Wissen heute liegt, und warum eine KI damit nichts anfangen kann."
g struktur "Struktur" "Wissen bekommt einen Ort: eine Basis je Wissensart."
g aufnahme "Aufnahme" "Aus Dateien werden durchsuchbare Passagen, jede mit ihrer Herkunft."
g zugriff "Zugriff" "Wer lesen darf, bestimmt auch, was die Antwort enthält."
g techdoc "Eine schwierige Frage" "Eine Technikerfrage, live beantwortet und mit Quellen belegt."
g memory "Korrigieren" "Eine Korrektur im Chat wird zu Wissen für alle Kollegen."
g config "Anpassen ohne Code" "Der Assistent ist Konfiguration, die Ihr eigenes Team bedient."
g evals "Belegen statt behaupten" "Antwortqualität wird gemessen, nicht behauptet."
g email "Arbeitet, während Sie schlafen" "Dasselbe Produkt bearbeitet Ersatzteilanfragen, ohne dass jemand fragt."
g meetings "Festhalten, was besprochen wurde" "Aus Besprechungen werden Dokumente, die jemand liest."
g kosten "Was es kostet" "Verbrauch sichtbar, Limits im Betrieb, keine Einsparung versprochen."
g contact "Sprechen Sie mit uns" "Wer damit arbeitet, und wie es bei Ihnen weitergeht."
grep -c "goal:" lib/demo/chapters/*.ts
```

Expected: each file reports `1`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run lib/demo/chapters/index.test.ts lib/demo/tour.test.ts lib/demo/supported-routes.test.ts`
Expected: PASS. (`names the reference customers only next to the ask` still passes: no client name appears in a goal.)

- [ ] **Step 7: Lint and commit**

```bash
if npx eslint lib/demo/tour.ts lib/demo/chapters/*.ts; then echo ok; else exit 1; fi
git add lib/demo/tour.ts lib/demo/chapters/*.ts
git commit -m "feat(demo): give every chapter a one-line goal for the panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The chapter rail as a pure helper

**Files:**
- Create: `lib/demo/panel-rail.ts`
- Create: `lib/demo/panel-rail.test.ts`

**Interfaces:**
- Produces: `type RailState = "past" | "current" | "upcoming"`; `interface RailSegment { id: DemoChapterId; index: number; title: string; state: RailState }`; `railSegments(chapters: DemoChapter[], position: TourPosition): RailSegment[]`.
- Consumes: `DemoChapter`, `DemoChapterId`, `TourPosition` from `lib/demo/tour.ts`; `CHAPTERS` for the test.

- [ ] **Step 1: Write the failing test**

`lib/demo/panel-rail.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { railSegments } from "./panel-rail";
import { CHAPTERS } from "./tour";

describe("railSegments", () => {
  it("marks the chapters before the current one as past, after it as upcoming", () => {
    const segments = railSegments(CHAPTERS, { chapter: "memory", step: 2 });
    const states = segments.map((s) => s.state);
    expect(states.filter((s) => s === "past")).toHaveLength(5);
    expect(states.filter((s) => s === "current")).toHaveLength(1);
    expect(states.filter((s) => s === "upcoming")).toHaveLength(6);
    expect(segments[5]).toMatchObject({ id: "memory", index: 5, title: "Korrigieren", state: "current" });
  });

  it("has nothing past on the first chapter", () => {
    const segments = railSegments(CHAPTERS, { chapter: "daten", step: 0 });
    expect(segments[0].state).toBe("current");
    expect(segments.every((s, i) => i === 0 || s.state === "upcoming")).toBe(true);
  });

  it("keeps one segment per chapter, in tour order", () => {
    const segments = railSegments(CHAPTERS, { chapter: "contact", step: 1 });
    expect(segments.map((s) => s.id)).toEqual(CHAPTERS.map((c) => c.id));
    expect(segments[segments.length - 1].state).toBe("current");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/panel-rail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`lib/demo/panel-rail.ts`:

```ts
import type { DemoChapter, DemoChapterId, TourPosition } from "./tour";

export type RailState = "past" | "current" | "upcoming";

export interface RailSegment {
  id: DemoChapterId;
  index: number;
  title: string;
  state: RailState;
}

/**
 * One segment per chapter for the panel's progress rail: where the visitor
 * is, what they have seen, what is left. Pure so the panel stays a thin
 * render over tested data.
 */
export function railSegments(chapters: DemoChapter[], position: TourPosition): RailSegment[] {
  const current = chapters.findIndex((c) => c.id === position.chapter);
  return chapters.map((c, index) => ({
    id: c.id,
    index,
    title: c.title,
    state: index < current ? "past" : index === current ? "current" : "upcoming",
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/panel-rail.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint and commit**

```bash
if npx eslint lib/demo/panel-rail.ts lib/demo/panel-rail.test.ts; then echo ok; else exit 1; fi
git add lib/demo/panel-rail.ts lib/demo/panel-rail.test.ts
git commit -m "feat(demo): chapter rail segments for the panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The panel shows the story by default

**Files:**
- Rewrite: `components/demo/tour-panel.tsx`
- Modify: `app/globals.css` (the `--tour-panel-w` block, ~lines 477-510; the `.demo-block-figure` rule, ~line 475, and its comment)

**Interfaces:**
- Consumes: `railSegments` (Task 2), `chapter.goal` (Task 1), `footerControls`, `nextPosition`, `StepPanel`, `useTour`.

- [ ] **Step 1: Rewrite the panel**

Replace the whole of `components/demo/tour-panel.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { footerControls } from "@/lib/demo/panel-controls";
import { railSegments } from "@/lib/demo/panel-rail";
import { nextPosition } from "@/lib/demo/tour";

import { StepPanel } from "./step-panel";
import { useTour } from "./tour-provider";

/**
 * The tour, as a docked panel.
 *
 * Deliberately NOT positioned. It is a flex sibling of <main>, so the content
 * area narrows to make room instead of being covered. Everything the old
 * presentation fought over — z-index against Radix, pointer-events inherited
 * from a modal <body>, a collision probe walking a floating bubble up the
 * screen — stops being possible rather than being fixed again.
 *
 * ONE width, and the step's copy always on screen. The first docked version
 * hid every explanation behind a "Mehr" toggle and showed a headline over
 * 700px of nothing on 33 of 37 steps; a visitor who only pressed Weiter —
 * the visitor the tour is built for — read 37 titles and nothing else.
 *
 * The chapter menu lives in here for the same reason as the panel itself:
 * as a separate floating element it was the thing that broke against the
 * agent wizard's dialog. The rail above it is the visible version of the
 * same information — where you are, what is left — and each segment jumps.
 *
 * DOM order: the panel is rendered BEFORE <main> (app/(application)/
 * layout.tsx) and placed last by `order-last`, so Tab reaches Zurück and
 * Weiter in a few presses instead of walking the inert sidebar and product
 * first. The rail segments are tabIndex -1 for the same reason — the text
 * menu is the keyboard route to a chapter.
 */
export function TourPanel() {
  const { position, step, chapters, next, prev, jumpTo } = useTour();
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  if (!step) return null;

  const index = chapters.findIndex((c) => c.id === position.chapter);
  const chapter = chapters[index];
  const segments = railSegments(chapters, position);
  const controls = footerControls({
    hasCta: !!step.cta,
    isLast: nextPosition(chapters, position) === null,
  });
  const positionKey = `${position.chapter}.${position.step}`;

  return (
    <aside
      data-demo-id="tour-panel"
      // KEEP IN SYNC with app/globals.css's --tour-panel-w rule (420px) —
      // Tailwind arbitrary values cannot read a shared constant.
      //
      // Sticky, in both directions, because the panel is a flex sibling of
      // <main> in normal flow: nothing pins it. The row's height is
      // content-driven, so a tall page scrolls the DOCUMENT and would take
      // the panel with it. md and up: `top-12` clears the fixed h-12 TopBar,
      // and the explicit height plus self-start is what makes sticky bite.
      // Below md the row is a column and `order-last` puts the panel after
      // the content; `bottom-0` docks it to the bottom edge.
      //
      // z-40: above the spotlight ring (z-30), below Radix's z-50 portals,
      // which app/globals.css insets by --tour-panel-w instead.
      className="order-last sticky bottom-0 z-40 flex max-h-[45vh] w-full shrink-0 flex-col overflow-y-auto border-t bg-card md:bottom-auto md:top-12 md:h-[calc(100svh-3rem)] md:max-h-none md:w-[420px] md:self-start md:border-l md:border-t-0"
    >
      <div className="border-b px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            OPEN IMP · Geführte Tour
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            Kapitel {index + 1} von {chapters.length} · Schritt {position.step + 1}/{chapter.steps.length}
          </span>
        </div>

        <ol className="mt-3 flex gap-1" aria-label="Kapitel">
          {segments.map((s) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                tabIndex={-1}
                title={`${s.index + 1}. ${s.title}`}
                aria-label={`${s.index + 1}. ${s.title}`}
                aria-current={s.state === "current" ? "step" : undefined}
                onClick={() => jumpTo(s.id)}
                className={`block h-1.5 w-full rounded-sm transition-colors ${
                  s.state === "current"
                    ? "bg-primary"
                    : s.state === "past"
                      ? "bg-muted-foreground/60"
                      : "bg-muted"
                }`}
              />
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="mt-3 flex w-full items-baseline justify-between gap-2 text-left"
        >
          <span className="text-sm font-medium">{chapter.title}</span>
          <span className="text-xs text-muted-foreground">{menuOpen ? "Schließen" : "Alle Kapitel"}</span>
        </button>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{chapter.goal}</p>
      </div>

      {menuOpen && (
        <ul className="border-b">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  jumpTo(c.id);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent ${i === index ? "font-medium" : ""}`}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Keyed on the position so each step enters fresh: a 250ms rise-and-
          fade is what turns a hard cut into a sequence. `initial={false}`
          under reduced motion renders the resting state immediately. */}
      <motion.div
        key={positionKey}
        className="flex grow flex-col gap-4 p-4"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <h2 className="text-lg font-semibold leading-snug">{step.title}</h2>
        {step.lead && <p className="text-sm text-muted-foreground">{step.lead}</p>}
        {step.content.length > 0 && <StepPanel content={step.content} />}
      </motion.div>

      <div className="flex items-center justify-end gap-2 border-t p-4">
        {controls.includes("back") && (
          <button type="button" onClick={prev} className="demo-button demo-button-secondary">Zurück</button>
        )}
        {controls.includes("cta") && step.cta && (
          <a href={step.cta.href} className="demo-button">{step.cta.label}</a>
        )}
        {controls.includes("next") && (
          <button type="button" onClick={next} className="demo-button">Weiter</button>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: One width in the stylesheet**

In `app/globals.css`, replace the block that begins with the comment `/* --tour-panel-w: how much of the right edge is currently occupied by the` and ends with the closing `}` of the `@media (min-width: 768px)` rule (the two `body[data-demo-tour="active"]` rules) with:

```css
/* --tour-panel-w: how much of the right edge the docked tour panel
 * (components/demo/tour-panel.tsx) occupies, so portalled dialogs below can
 * stay clear of it. Defined here with a media query — not inline from the
 * layout — because below md the row becomes a column and the panel docks at
 * the bottom, occupying none of the right edge.
 *
 * KEEP IN SYNC: 420 must match tour-panel.tsx's md:w-[420px], and 768px
 * must match Tailwind's `md` breakpoint (tailwind.config.js only overrides
 * `2xl`). Tailwind arbitrary values cannot read a shared constant.
 */
body[data-demo-tour="active"] {
  --tour-panel-w: 0px;
}
@media (min-width: 768px) {
  body[data-demo-tour="active"] {
    --tour-panel-w: 420px; /* must match tour-panel.tsx's md:w-[420px] */
  }
}
```

Then replace the `.demo-block-figure` rule and the comment block above it (from `/* Capped on purpose, and NOT redundant with` to the rule's line) with:

```css
/* Capped on purpose. Every generated asset is 800x534
   (scripts/generate-demo-image.py); in the 420px panel 16rem lets the figure
   fill the column at its natural height (~259px) while still bounding the
   768px scene column, whose figures sub-project 4 enlarges separately.
   object-fit: contain letterboxes rather than distorts. */
.demo-block-figure { display: block; width: 100%; height: auto; max-height: 16rem; object-fit: contain; border-radius: 0.5rem; }
```

- [ ] **Step 3: Verify nothing else reads the removed attribute**

Run: `grep -rn "data-demo-panel-expanded\|md:w-\[380px\]\|md:w-\[560px\]" app components lib scripts --include='*.ts' --include='*.tsx' --include='*.css' --include='*.mjs' || echo "no references left"`
Expected: `no references left` (the walker's expanded check goes in Task 5).

- [ ] **Step 4: Tests, lint, commit**

Run: `npx vitest run lib/demo/tour.test.ts lib/demo/chapters/index.test.ts lib/demo/panel-controls.test.ts lib/demo/panel-rail.test.ts`
Expected: PASS.

```bash
if npx eslint components/demo/tour-panel.tsx; then echo ok; else exit 1; fi
git add components/demo/tour-panel.tsx app/globals.css
git commit -m "feat(demo): the panel shows each step's copy, a chapter rail and the chapter's goal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The keyboard reaches the panel first

**Files:**
- Modify: `app/(application)/layout.tsx` (the flex row, ~lines 191-222)
- Modify: `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` (sub-project 2, "Keyboard" paragraph)

**Interfaces:**
- Consumes: the `order-last` class already on the aside (Task 3).

- [ ] **Step 1: Move the overlay before `<main>`**

In `app/(application)/layout.tsx`, cut the block

```tsx
                                {/* Chapters 3 and 4 end on product routes, which
                                    live in this group rather than under /demo.
                                    Without the panel here the tour sends the
                                    visitor here and strands them with no way on. */}
                                {demoMode && <TourOverlay />}
```

and paste it directly after `<div className="flex min-h-0 grow w-full flex-col md:flex-row">`, i.e. before the `{/* The ONE <main> landmark …` comment, changing its comment to:

```tsx
                                {/* Before <main> in DOM order, last in layout
                                    (tour-panel.tsx's `order-last`): Tab reaches
                                    Zurück and Weiter in three presses instead of
                                    walking the inert sidebar and product first.
                                    Chapters end on product routes in this group,
                                    so the panel has to live here. */}
                                {demoMode && <TourOverlay />}
```

- [ ] **Step 2: Amend the spec**

In `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md`, replace the paragraph

```
**Keyboard.** In demo mode `app/(application)/layout.tsx` sets `inert` on `<main>` and the sidebar root so Tab reaches the panel first; `ContentInert` stays.
```

with

```
**Keyboard.** The tour overlay is rendered before `<main>` in `app/(application)/layout.tsx` and placed last by `order-last` on the panel, so Tab reaches the panel first; `ContentInert` stays. (Amended 2026-10-14 from `inert` on `<main>`: an inert subtree is excluded from hit-testing, which would stop the chat's inner scroller from responding to the wheel.)
```

and, in the same section, `**Chapter rail.** … from a new `DemoChapter.goal?: string`` becomes `… from a new `DemoChapter.goal: string` (required; all twelve ship with the panel)`.

- [ ] **Step 3: Lint and commit**

```bash
if npx eslint "app/(application)/layout.tsx"; then echo ok; else exit 1; fi
git add "app/(application)/layout.tsx" docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md
git commit -m "feat(demo): render the tour panel before main so the keyboard reaches it first

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The walker asserts the copy is visible and the keyboard reaches Weiter

**Files:**
- Modify: `scripts/dump-demo-steps.ts` (emit `firstParagraph`)
- Modify: `scripts/walk-demo.mjs` (replace the expanded-panel check; add `contentVisible`, `noMehr`, a one-off `tabsToWeiter`)

**Interfaces:**
- Consumes: `step.firstParagraph` from the dump (null for scene steps, whose copy renders in the content area, not the panel).

- [ ] **Step 1: Emit the first paragraph**

In `scripts/dump-demo-steps.ts`, add after `title: step.title,`:

```ts
    // The first paragraph of the PANEL's copy (step.content, not contentOf:
    // a scene step's words render in the content area). The walker asserts
    // it is visible in the panel without a click.
    firstParagraph:
      step.content.find((block) => block.kind === "paragraph")?.text ?? null,
```

and update the docblock's field list to include `firstParagraph`.

Run: `npx tsx scripts/dump-demo-steps.ts | node -e "const s=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('with paragraph:', s.filter(x=>x.firstParagraph).length, 'scenes:', s.filter(x=>!x.firstParagraph).length)"`
Expected: `with paragraph: 33 scenes: 4`.

- [ ] **Step 2: Replace the expanded-panel check**

Use an exact-snippet patcher (a node script with `s.split(from).length - 1 === 1` guards, as the Rails branch did) to make these replacements in `scripts/walk-demo.mjs`:

(a) Replace the whole block from the comment line `    // One-off bonus check (not part of the per-step 5, see task-8-report.md):` through the closing `    }` of `if (!expandedCheckDone) { … }` with:

```js
    // The panel shows each step's copy without a click (sub-project 2).
    // For a step with panel copy, its first paragraph must be in the panel's
    // text; and no "Mehr" toggle may exist anywhere in the panel.
    const panelText = await page.evaluate(() =>
      (document.querySelector('[data-demo-id="tour-panel"]')?.innerText ?? "").replace(/\s+/g, " "),
    );
    row.contentVisible = step.firstParagraph
      ? panelText.includes(step.firstParagraph.slice(0, 40))
      : null;
    row.noMehr = !(await page.evaluate(() =>
      [...document.querySelectorAll('[data-demo-id="tour-panel"] button')].some((b) => b.textContent.trim() === "Mehr"),
    ));

    // One-off: on the first step, count Tab presses until Weiter has focus.
    // The panel is rendered before <main>, so this must be small; it used to
    // take 38 presses through the inert sidebar and product.
    if (tabsToWeiter === null) {
      await page.evaluate(() => { (document.activeElement instanceof HTMLElement) && document.activeElement.blur(); });
      let presses = 0;
      let reached = false;
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        presses++;
        reached = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Weiter");
        if (reached) break;
      }
      tabsToWeiter = reached ? presses : Infinity;
      await page.evaluate(() => { (document.activeElement instanceof HTMLElement) && document.activeElement.blur(); });
    }
```

(b) Replace `  let expandedCheckDone = false;\n  let expandedCheckResult = null;\n` with `  let tabsToWeiter = null;\n`.

(c) In the `row.allPass =` expression, add after `row.transitionOk !== false &&`:

```js
      row.contentVisible !== false &&
      row.noMehr === true &&
```

(d) Replace `fs.writeFileSync(resultsPath, JSON.stringify({ results, expandedCheckResult }, null, 2));` with `fs.writeFileSync(resultsPath, JSON.stringify({ results, tabsToWeiter }, null, 2));`.

(e) Replace the block

```js
  if (expandedCheckResult) {
    console.log(
      `Expanded-panel spot check (${expandedCheckResult.pos}, 560px): overlapsContent=${expandedCheckResult.overlapsContent} coveringPanel=${expandedCheckResult.coveringPanel}`,
    );
  }
```

with

```js
  const keyboardOk = tabsToWeiter !== null && tabsToWeiter <= 4;
  console.log(`Keyboard: ${tabsToWeiter === Infinity ? "Weiter not reached in 12 Tabs" : `${tabsToWeiter} Tab(s) to Weiter`} — ${keyboardOk ? "ok" : "FAIL (must be ≤ 4)"}`);
  if (!keyboardOk) process.exitCode = 1;
```

(f) In the per-step `console.log` line, append `` content=${row.contentVisible ?? "n/a"} mehr=${row.noMehr ? "none" : "PRESENT"}`` before the closing backtick.

- [ ] **Step 3: Syntax-check and commit**

Run: `node --check scripts/walk-demo.mjs && echo "walker syntax ok"`
Expected: `walker syntax ok`.

```bash
git add scripts/dump-demo-steps.ts scripts/walk-demo.mjs
git commit -m "test(demo): assert the panel shows each step's copy and the keyboard reaches Weiter

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Verify on a production demo build and list the copy for sign-off

**Files:** `docs/superpowers/plans/2026-10-14-demo-tour-panel.md` (Verification section).

- [ ] **Step 1: Unit filter**

Run: `npx vitest run lib/demo "app/(application)/transcriptions" "app/(application)/evals" "app/(application)/data" "app/(application)/agents"`
Expected: all PASS (41 files or more).

- [ ] **Step 2: Build and serve (Daniel)**

Ask Daniel to run, from the frontend directory on this branch:

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

Expected: build exits 0 (its TypeScript pass is the type gate for this branch); `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3111/demo/szene/daten-pile?tour=daten.0"` prints `200`.

- [ ] **Step 3: Walk it**

From the Playwright directory:

```bash
DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs
```

Expected: `37/37 steps passed all assertions.` and `Keyboard: 3 Tab(s) to Weiter — ok` (chapter-menu button, Zurück, Weiter; the rail segments are tabIndex -1). Every row prints `mehr=none`; every non-scene row prints `content=true`; `config.1`–`config.4` keep `covering=false` at the new width.

- [ ] **Step 4: Spot-check by eye**

With Playwright or a browser at 1440 × 900: `/data?tour=struktur.1` shows the title and the paragraph "Technische Dokumentation wird anders gelesen…" with no click; the rail's second segment is lime; the goal line reads "Wissen bekommt einen Ort: eine Basis je Wissensart."; clicking a rail segment jumps chapters. At 390 × 844 the panel docks at the bottom with the content above it. With `prefers-reduced-motion: reduce` emulated, a step change shows no rise-and-fade.

- [ ] **Step 5: Record and list the copy**

Append to this plan:

```markdown
## Verification

- <date> — build <commit> by Daniel, walker in Weiter mode: <N>/37, keyboard <K> Tabs. Spot checks: <one line>.

## Copy for sign-off (Daniel + Doro)

New visitor-facing German introduced by this plan, all in the panel chrome:
- Twelve chapter goals (Task 1, table).
- "OPEN IMP · Geführte Tour" (eyebrow), "Schritt" (counter), "Alle Kapitel" / "Schließen" (menu toggle), "Kapitel" (rail aria-label).
```

```bash
git add docs/superpowers/plans/2026-10-14-demo-tour-panel.md
git commit -m "docs(demo): record the panel walk result and the copy for sign-off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

## Verification

2026-10-14 — Daniel's production demo build of d1c4e2a (BUILD_ID J97shs3WC3eGImwwpI7sM), `next start -p 3111`. Walker in Weiter mode: **37/37 steps passed**, 36/36 transitions, `contentVisible` true on all 33 steps with panel copy (n/a on the 4 scene steps), no "Mehr" on any step, **3 Tabs to Weiter**. Spot checks (Playwright, 1440×900 / 1024×768 / 390×844): panel 420 px with `--tour-panel-w: 420px`; 12 rail segments, `aria-current="step"` on the current one, all `tabIndex -1`; scene step renders title only (no `.demo-step-panel`); `prefers-reduced-motion: reduce` keeps opacity at 1 and transform `none` through the step change, while the default reveal animates opacity 0→1 and a 6 px rise; chapter menu opens over chapter 7's wizard (12 items) and closes on choice (`aria-expanded`); wizard dialog clear of the panel at 1440 and 1024; below md the panel docks at the bottom with Weiter visible; the longest-copy step (contact.0, with figure at 256 px) fits without internal scroll. Unit filter 40 files / 411 tests; walker-only fixes after the first walk: `allPass` computed after the panel assertions (e8f77d2), keyboard check moved before the click probe (76178f2). Pre-existing, deferred: any click in the panel dismisses the wizard Sheet (no Radix outside-click guard; the next step's `?wizard=` reopens it).

## Copy for sign-off

New visitor-facing German introduced by this plan (implementer drafts, Daniel + Doro sign off per the 2026-10-14 decision). Chapter goals, `goal` in `lib/demo/chapters/*.ts`:

| Chapter | Goal |
|---|---|
| Ihre Daten | Wo Ihr Wissen heute liegt, und warum eine KI damit nichts anfangen kann. |
| Struktur | Wissen bekommt einen Ort: eine Basis je Wissensart. |
| Aufnahme | Aus Dateien werden durchsuchbare Passagen, jede mit ihrer Herkunft. |
| Zugriff | Wer lesen darf, bestimmt auch, was die Antwort enthält. |
| Eine schwierige Frage | Eine Technikerfrage, live beantwortet und mit Quellen belegt. |
| Korrigieren | Eine Korrektur im Chat wird zu Wissen für alle Kollegen. |
| Anpassen ohne Code | Der Assistent ist Konfiguration, die Ihr eigenes Team bedient. |
| Belegen statt behaupten | Antwortqualität wird gemessen, nicht behauptet. |
| Arbeitet, während Sie schlafen | Dasselbe Produkt bearbeitet Ersatzteilanfragen, ohne dass jemand fragt. |
| Festhalten, was besprochen wurde | Aus Besprechungen werden Dokumente, die jemand liest. |
| Was es kostet | Verbrauch sichtbar, Limits im Betrieb, keine Einsparung versprochen. |
| Sprechen Sie mit uns | Wer damit arbeitet, und wie es bei Ihnen weitergeht. |

Panel chrome, `components/demo/tour-panel.tsx`: "OPEN IMP · Geführte Tour" (eyebrow), "Kapitel {n} von 12 · Schritt {n}/{m}" (counter), "Alle Kapitel" / "Schließen" (menu toggle, also its accessible name), "Kapitel" (rail `aria-label`), "{n}. {Kapiteltitel}" (rail segment title and `aria-label`).
