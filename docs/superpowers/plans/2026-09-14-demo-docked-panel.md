# Demo Docked Tour Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tour's two presentation modes — Shepherd popovers over a dimmed page, and full-bleed stages — with one panel docked as a flex sibling of the app content.

**Architecture:** `app/(application)/layout.tsx` wraps `<main>` and a new `<TourPanel>` in a flex row, so the content area genuinely narrows rather than being covered. The four full-bleed steps become real pages at `/demo/szene/[id]`. A capture-phase listener makes the content area non-operable while leaving it scrollable, and a `<TourRing>` outlines the step's anchor instead of dimming everything around it. Shepherd is deleted.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 3.4, framer-motion 12, vitest 4 (`environment: "node"`), Playwright (session scratchpad only, never a project dependency).

**Spec:** `docs/superpowers/specs/2026-09-14-demo-docked-panel-design.md`

## Global Constraints

- Tests run in **node with no DOM**: `vitest.config.ts` sets `environment: "node"` and collects only `lib/**/*.test.ts`, `components/**/*.test.ts`, `app/**/*.test.ts`. No component can be unit-tested; browser behaviour is verified with the Playwright walker in Task 8.
- **Demo copy is hardcoded German, never next-intl**, Sie-form, and **client-facing and signed off by Daniel and OPEN's marketing lead**. An implementer never writes, rewords, trims or retitles it.
- **`lead` must not be invented.** It is authored by the copy owners. Steps ship without it; the panel falls back to the title alone.
- **The chapter narrative is unchanged** — twelve chapters, same order, same argument. No fixture, resolver or world changes.
- **Never stage `messages/de.json` or `messages/en.json`** — they carry another session's uncommitted work. Check `git status` before every commit.
- **`LICENSE` is also modified by someone else.** Never stage it.
- **Client confidentiality:** "NEW Lift" and "ALGI" may appear only in `lib/demo/chapters/contact.ts`.
- **Known pre-existing failure:** `components/shell/nav-config.test.ts` fails on this branch already, for an unrelated `models` nav entry. Not yours; do not fix.
- Branch: `fix/demo-walkthrough-feedback` already holds three fixes and this spec. Work continues on it unless the controller says otherwise.
- Verify with `npx vitest run lib/demo`, `npx tsc --noEmit`, and `NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`.

---

## File Structure

**Create**
- `lib/demo/scenes.ts` — scene id → `{ title, content }`, the data behind the four former stage steps. Pure data, node-testable.
- `app/(application)/demo/szene/[id]/page.tsx` — renders one scene full-width in the content area.
- `components/demo/tour-panel.tsx` — the docked panel: chapter label, title, lead, Mehr toggle, navigation, chapter menu.
- `components/demo/tour-ring.tsx` — outlines the step's anchor.
- `components/demo/content-inert.tsx` — makes the content area non-operable but scrollable.

**Modify**
- `lib/demo/tour.ts` — `DemoStep`: remove `kind`, `size`, `noDim`, `placement`; add `lead?`.
- `lib/demo/chapters/{daten,aufnahme,zugriff}.ts` — the four stage steps point at scene routes.
- `lib/demo/chapters/{struktur,techdoc,memory,config,evals,email,meetings,kosten,contact}.ts` — drop `size`, `noDim`, `placement`.
- `lib/demo/supported-routes.ts` — allow `/demo/szene`.
- `app/(application)/layout.tsx:184-212` — the flex row.
- `components/demo/tour-overlay.tsx` — compose the new pieces; fix the stale "BOTH layouts" docblock.
- `lib/demo/tour.test.ts`, `lib/demo/chapters/index.test.ts` — caps and invariants.
- `app/globals.css` — the portalled-dialog inset.
- `scripts/` — the copy-sheet export gains a `Kurzfassung` column.

**Delete**
- `components/demo/tour-shepherd.tsx`, `components/demo/tour-stage.tsx`, `components/demo/tour-bubble.tsx`
- `lib/demo/shepherd-step.ts` and `lib/demo/shepherd-step.test.ts`
- `shepherd.js` from `package.json`

**Unchanged:** `components/demo/chat-question-into-view.tsx`, `components/demo/step-panel.tsx` (its `Block` renderer is reused by the panel), all fixtures and resolvers.

---

### Task 1: Scenes as data and as a route

**Files:**
- Create: `lib/demo/scenes.ts`
- Create: `lib/demo/scenes.test.ts`
- Create: `app/(application)/demo/szene/[id]/page.tsx`
- Modify: `lib/demo/supported-routes.ts`

**Interfaces:**
- Produces: `DEMO_SCENES: Record<string, { title: string; content: ContentBlock[] }>` and `sceneRoute(id: string): string` returning `/demo/szene/${id}`. Task 2 consumes both.

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/scenes.test.ts
import { describe, expect, it } from "vitest";
import { contentText } from "./content";
import { DEMO_SCENES, sceneRoute } from "./scenes";

describe("demo scenes", () => {
  // The four steps that used to render full-bleed. Their ids are the step ids
  // they replace, so a reader can trace a scene back to the beat it serves.
  it.each(["daten-pile", "daten-question", "aufnahme-page", "zugriff-barrier"])(
    "has a scene for %s",
    (id) => {
      expect(DEMO_SCENES[id], id).toBeDefined();
      expect(DEMO_SCENES[id].title.length).toBeGreaterThan(0);
      expect(DEMO_SCENES[id].content.length).toBeGreaterThan(0);
    },
  );

  it("carries real copy, not placeholders", () => {
    for (const [id, scene] of Object.entries(DEMO_SCENES)) {
      expect(contentText(scene.content).length, id).toBeGreaterThan(40);
      expect(contentText(scene.content), id).not.toMatch(/lorem|TODO|TBD/i);
    }
  });

  it("builds a route under the demo scene path", () => {
    expect(sceneRoute("daten-pile")).toBe("/demo/szene/daten-pile");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/demo/scenes`
Expected: FAIL — `Cannot find module './scenes'`.

- [ ] **Step 3: Create the scenes module**

Move the existing `content` arrays off the four stage steps verbatim. **Copy them exactly — do not reword.** Read the current values from `lib/demo/chapters/daten.ts` (steps `daten-pile`, `daten-question`), `lib/demo/chapters/aufnahme.ts` (step `aufnahme-page`) and `lib/demo/chapters/zugriff.ts` (step `zugriff-barrier`).

```ts
// lib/demo/scenes.ts
import type { ContentBlock } from "./content";

/**
 * The four beats with no product screen behind them.
 *
 * They used to render full-bleed over the app, which is half of why the tour
 * felt "stuck together" — the presentation changed mid-story. They are pages
 * now, so the layout is the same on all 37 steps: content area plus the docked
 * panel. The app shell stays visible here deliberately; hiding it would
 * reintroduce exactly the mode-switch this change exists to remove.
 *
 * Keyed by the step id they serve, so a scene traces back to its beat.
 */
export const DEMO_SCENES: Record<string, { title: string; content: ContentBlock[] }> = {
  // ... copy title + content verbatim from the four steps ...
};

export function sceneRoute(id: string): string {
  return `/demo/szene/${id}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/scenes`
Expected: PASS (3 cases + 4 parameterised).

- [ ] **Step 5: Add the route to the allowlist**

In `lib/demo/supported-routes.ts`, add `"/demo/szene"` to the allowlist array with a comment saying the four former stage steps live under it. `isDemoSupported` already matches by prefix for dynamic segments — confirm that by reading the function before assuming it; if it matches exactly, add the prefix handling the other dynamic routes already use.

- [ ] **Step 6: Create the page**

```tsx
// app/(application)/demo/szene/[id]/page.tsx
import { notFound } from "next/navigation";

import { StepPanel } from "@/components/demo/step-panel";
import { DEMO_SCENES } from "@/lib/demo/scenes";
import { isDemoMode } from "@/lib/demo/flag";

export default async function ScenePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDemoMode()) notFound();
  const { id } = await params;
  const scene = DEMO_SCENES[id];
  if (!scene) notFound();

  return (
    <div className="flex min-h-0 grow items-center justify-center overflow-y-auto p-8">
      <div className="demo-scene w-full max-w-3xl">
        <h1 className="mb-6 text-3xl font-semibold">{scene.title}</h1>
        <StepPanel step={{ id, route: "", anchor: null, title: scene.title, content: scene.content }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify the build**

Run: `npx tsc --noEmit && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: both clean; the build output lists `/demo/szene/[id]`.

- [ ] **Step 8: Commit**

```bash
git add lib/demo/scenes.ts lib/demo/scenes.test.ts "app/(application)/demo/szene/[id]/page.tsx" lib/demo/supported-routes.ts
git commit -m "feat(demo): scenes become real pages instead of full-bleed overlays"
```

---

### Task 2: The step model

**Files:**
- Modify: `lib/demo/tour.ts` (the `DemoStep` interface)
- Modify: `lib/demo/chapters/daten.ts`, `aufnahme.ts`, `zugriff.ts` (scene routes)
- Modify: every file in `lib/demo/chapters/` carrying `size`, `noDim` or `placement`
- Modify: `lib/demo/chapters/index.test.ts`, `lib/demo/tour.test.ts`

**Interfaces:**
- Consumes: `sceneRoute` from Task 1.
- Produces: `DemoStep` with `lead?: string`, without `kind`/`size`/`noDim`/`placement`. Tasks 3–6 consume it.

- [ ] **Step 1: Write the failing test**

Add to `lib/demo/chapters/index.test.ts`:

```ts
  // The presentation is one panel now. A step that still carries a Shepherd-era
  // field is a step that was migrated halfway.
  it("carries no presentation fields from the popover era", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const legacy = step as unknown as Record<string, unknown>;
        for (const field of ["kind", "size", "noDim", "placement", "advanceAfterMs"]) {
          expect(legacy[field], `${step.id}.${field}`).toBeUndefined();
        }
      }
    }
  });

  // lead is optional ONLY because its German belongs to the copy owners. This
  // reports what is still missing rather than failing, so the branch stays
  // shippable while the sheet comes back.
  it("reports which steps are still waiting for a Kurzfassung", () => {
    const missing = CHAPTERS.flatMap((c) => c.steps.filter((s) => !s.lead).map((s) => s.id));
    if (missing.length) console.log(`steps without a lead (${missing.length}): ${missing.join(", ")}`);
    expect(Array.isArray(missing)).toBe(true);
  });

  it("caps any lead that HAS been written at 20 words", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        if (!step.lead) continue;
        const words = step.lead.trim().split(/\s+/).length;
        expect(words, `${step.id} lead is ${words} words`).toBeLessThanOrEqual(20);
      }
    }
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/demo/chapters`
Expected: FAIL — `daten-pile.kind` is `"stage"`, and several steps carry `size`.

- [ ] **Step 3: Update the type**

In `lib/demo/tour.ts`, delete the `kind`, `size`, `noDim` and `placement` members and their doc comments. **Keep `scrollBlock`** — the ring still scrolls its anchor into view, so "nearest" vs "start" still decides whether a list header lands at the bottom edge with the list below the fold. Add:

```ts
  /**
   * The one sentence always visible in the panel; `content` sits behind "Mehr".
   *
   * Optional ONLY because this German is written by Daniel and OPEN's
   * marketing lead, never here. A step without one renders its title alone.
   * chapters/index.test.ts reports which are still missing.
   */
  lead?: string;
```

- [ ] **Step 4: Point the four stage steps at their scenes**

In `daten.ts`, `aufnahme.ts` and `zugriff.ts`: for each of `daten-pile`, `daten-question`, `aufnahme-page`, `zugriff-barrier`, delete `kind: "stage"`, replace `route` with `sceneRoute("<step id>")`, and **delete the `content` array** — it now lives in `lib/demo/scenes.ts`. Leave `title` in place; the panel still shows it. Add `content: []`.

- [ ] **Step 5: Strip the remaining presentation fields**

Run `grep -rn "size:\|noDim\|placement:" lib/demo/chapters/` and delete every match along with its doc comment. Do not touch `scrollBlock`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. The lead-report test logs all 37 step ids, since none has a lead yet.

- [ ] **Step 7: Add the Kurzfassung column to the copy sheet export**

The export script lives in the session scratchpad, not the repo. Commit it to `scripts/export-demo-copy.ts` so it stops being throwaway, with a `Kurzfassung` column between `Feld` and `Text (aktuell)`, and one row per step whose `Feld` is `Kurzfassung` and whose current text is empty.

- [ ] **Step 8: Commit**

```bash
git add lib/demo/tour.ts lib/demo/chapters scripts/export-demo-copy.ts
git commit -m "feat(demo): one step shape for one presentation"
```

---

### Task 3: The docked panel

**Files:**
- Create: `components/demo/tour-panel.tsx`
- Modify: `app/globals.css` (panel styles alongside the existing `demo-block-*` rules)

**Interfaces:**
- Consumes: `useTour()` → `{ position, step, chapters, next, prev, jumpTo }`; `StepPanel` from `components/demo/step-panel.tsx`; `DEMO_SCENES` for scene titles.
- Produces: `<TourPanel />`, default export-free named export. Task 4 mounts it.

Not unit-testable — vitest has no DOM. Task 8 asserts it in the browser.

- [ ] **Step 1: Build the panel**

```tsx
// components/demo/tour-panel.tsx
"use client";

import { useEffect, useState } from "react";

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
 * The chapter menu lives in here for the same reason: as a separate floating
 * element it was the thing that broke against the agent wizard's dialog.
 */
export function TourPanel() {
  const { position, step, chapters, next, prev, jumpTo } = useTour();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Detail is asked for per step, not switched on once. Collapsing on
  // navigation keeps the default state short, which is the point of the split.
  useEffect(() => {
    setExpanded(false);
    setMenuOpen(false);
  }, [position.chapter, position.step]);

  if (!step) return null;

  const index = chapters.findIndex((c) => c.id === position.chapter);
  const chapter = chapters[index];
  const hasDetail = step.content.length > 0;

  return (
    <aside
      data-demo-id="tour-panel"
      className={`flex shrink-0 flex-col border-t bg-card md:border-l md:border-t-0 ${
        expanded ? "md:w-[560px]" : "md:w-[380px]"
      } max-h-[45vh] w-full overflow-y-auto md:max-h-none md:w-auto`}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button type="button" onClick={() => setMenuOpen((v) => !v)} className="text-xs font-medium text-muted-foreground">
          Kapitel {index + 1} von {chapters.length} · {chapter?.title}
        </button>
        <span className="text-xs text-muted-foreground">
          {position.step + 1}/{chapter?.steps.length}
        </span>
      </div>

      {menuOpen && (
        <ul className="border-b">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => jumpTo({ chapter: c.id, step: 0 })}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent ${i === index ? "font-medium" : ""}`}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex grow flex-col gap-4 p-4">
        <h2 className="text-lg font-semibold">{step.title}</h2>
        {step.lead && <p className="text-sm text-muted-foreground">{step.lead}</p>}
        {expanded && hasDetail && <StepPanel step={step} />}
        {hasDetail && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start text-sm underline">
            {expanded ? "Weniger" : "Mehr"}
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t p-4">
        <button type="button" onClick={prev} className="shepherd-button shepherd-button-secondary">Zurück</button>
        {step.cta ? (
          <a href={step.cta.href} className="shepherd-button">{step.cta.label}</a>
        ) : (
          <button type="button" onClick={next} className="shepherd-button">Weiter</button>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean. The panel is not mounted yet, so nothing renders it.

- [ ] **Step 3: Commit**

```bash
git add components/demo/tour-panel.tsx app/globals.css
git commit -m "feat(demo): the docked tour panel"
```

---

### Task 4: Dock it in the layout

**Files:**
- Modify: `app/(application)/layout.tsx:183-213`
- Modify: `components/demo/tour-overlay.tsx`

**Interfaces:**
- Consumes: `<TourPanel />` from Task 3.
- Produces: the flex row; `TourOverlay` no longer renders Shepherd or the stage.

- [ ] **Step 1: Wrap main and the panel in a row**

Replace the `<main>` block and the `{demoMode && <TourOverlay />}` line with:

```jsx
<div className="flex min-h-0 grow w-full flex-col md:flex-row">
  {/* The ONE <main> landmark (a11y fix M11) — every inner content
      wrapper below this is a div. */}
  <main className="grow flex min-w-0 w-full">
    <div className="grow flex flex-col min-w-0 w-full">
      <Authenticated sidebarDefaultOpen={defaultOpen} user={user} demoMode={demoMode}>
        {demoMode && !isDemoSupported(pathname) ? <DemoUnavailable /> : children}
      </Authenticated>
    </div>
  </main>
  {demoMode && <TourOverlay />}
</div>
```

Note `demoMode={demoMode}` — if `fix/demo-flag-client-server-split` has already merged, this prop exists; if it has not, leave the prop off and tell the controller rather than adding it here.

- [ ] **Step 2: Rewrite the overlay as a composition**

```tsx
// components/demo/tour-overlay.tsx
"use client";

import { Suspense } from "react";

import { ChatQuestionIntoView } from "./chat-question-into-view";
import { TourPanel } from "./tour-panel";
import { TourProvider } from "./tour-provider";

/**
 * The tour's chrome. Mounted once, in app/(application)/layout.tsx.
 *
 * An earlier docblock here claimed it was mounted in BOTH layouts; that was
 * left from when /demo/tour existed and was false by the time anyone read it.
 */
export function TourOverlay() {
  return (
    <Suspense fallback={null}>
      <TourProvider>
        <TourPanel />
        <ChatQuestionIntoView />
      </TourProvider>
    </Suspense>
  );
}
```

- [ ] **Step 3: Build and look at it**

Run: `NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111`

Open `http://localhost:3111/data?tour=struktur.0`. The panel must sit beside the content, not over it, and the content must be visibly narrower than without it.

- [ ] **Step 4: Commit**

```bash
git add "app/(application)/layout.tsx" components/demo/tour-overlay.tsx
git commit -m "feat(demo): dock the tour panel beside the app content"
```

---

### Task 5: The wizard dialog inset

**Files:**
- Modify: `app/globals.css`
- Modify: `app/(application)/layout.tsx` (set the width custom property)

**This is the highest-risk task in the plan and is deliberately early.** If the CSS approach fails, the fallback is rendering the wizard non-modally in demo mode, which is a product change needing its own review — and everything after this depends on knowing which it is. **Report to the controller before attempting the fallback.**

- [ ] **Step 1: Reproduce the problem**

With the server from Task 4, open `http://localhost:3111/agents/edit/demo-agent-newton?wizard=sources&tour=config.1`. The wizard is a Radix dialog portalled to `<body>`; it escapes the flex row and covers the panel. Confirm that before changing anything, and record what you saw.

- [ ] **Step 2: Publish the panel width as a custom property**

On the flex-row div added in Task 4, add `style={{ ["--tour-panel-w" as string]: demoMode ? "380px" : "0px" }}`. Set it on `<body>` instead if the portal root needs it — portalled content is a child of `<body>`, not of the row, so a property set on the row will not reach it. **Check which before writing the CSS.**

- [ ] **Step 3: Inset portalled overlays in demo mode only**

```css
/* app/globals.css */
/* Radix portals its dialogs to <body>, so they escape the tour's flex row and
   would cover the docked panel. Scoped to demo mode: no other deployment has
   a tour, and no other deployment should inherit this. */
body[data-demo-tour="active"] [data-radix-popper-content-wrapper],
body[data-demo-tour="active"] [role="dialog"] {
  max-width: calc(100vw - var(--tour-panel-w, 0px));
  margin-right: var(--tour-panel-w, 0px);
}
```

Set `data-demo-tour="active"` on `<body>` from the layout when `demoMode` is true.

- [ ] **Step 4: Verify with a measurement, not a glance**

```js
// scratchpad Playwright check
const r = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]').getBoundingClientRect();
  const panel = document.querySelector('[data-demo-id="tour-panel"]').getBoundingClientRect();
  return { overlap: dlg.right > panel.left, dlgRight: dlg.right, panelLeft: panel.left };
});
```
Expected: `overlap === false`.

- [ ] **Step 5: Commit, or stop and report**

If `overlap` is false:
```bash
git add app/globals.css "app/(application)/layout.tsx"
git commit -m "fix(demo): keep portalled dialogs clear of the docked panel"
```
If it is still true after one honest attempt, **stop and report to the controller.** Do not start the non-modal product change on your own authority.

---

### Task 6: Non-operable content and the anchor ring

**Files:**
- Create: `components/demo/content-inert.tsx`
- Create: `components/demo/tour-ring.tsx`
- Modify: `components/demo/tour-overlay.tsx`

- [ ] **Step 1: Build the blocker**

```tsx
// components/demo/content-inert.tsx
"use client";

import { useEffect } from "react";

/**
 * Makes the product non-operable during the tour, and no more than that.
 *
 * NOT pointer-events: none. That would also kill scrolling and text selection,
 * and chapter 5's answer is ~1300px of prose in a ~700px viewport — OPEN's
 * marketing lead specifically complained she could not scroll it. Blocking
 * wheel and touchmove would make that permanent.
 *
 * Blocks in the CAPTURE phase so a handler deeper in the product never runs.
 * The panel is outside <main>, so its own clicks are unaffected.
 */
export function ContentInert() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const swallow = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const types = ["click", "pointerdown", "mousedown", "keydown", "submit"] as const;
    for (const t of types) main.addEventListener(t, swallow, true);
    main.style.cursor = "default";
    return () => {
      for (const t of types) main.removeEventListener(t, swallow, true);
      main.style.cursor = "";
    };
  }, []);
  return null;
}
```

- [ ] **Step 2: Build the ring**

```tsx
// components/demo/tour-ring.tsx
"use client";

import { useEffect, useState } from "react";

import { useTour } from "./tour-provider";

/**
 * Outlines the step's anchor instead of dimming everything else.
 *
 * The dimming overlay is what made citations unclickable and stranded a dark
 * layer on screens whose anchor unmounted. An outline points just as well and
 * covers nothing, so it cannot swallow anything.
 */
export function TourRing() {
  const { step } = useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const anchor = step?.anchor ?? null;

  useEffect(() => {
    if (!anchor) { setRect(null); return; }
    let raf = 0;
    const el = document.querySelector(`[data-demo-id="${anchor}"]`);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: step?.scrollBlock ?? "nearest", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [anchor, step?.scrollBlock]);

  if (!rect) return null;
  return (
    <div
      data-demo-id="tour-ring"
      aria-hidden
      className="pointer-events-none fixed z-40 rounded-md ring-2 ring-primary transition-all duration-200"
      style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
    />
  );
}
```

- [ ] **Step 3: Mount both**

Add `<ContentInert />` and `<TourRing />` inside `<TourProvider>` in `tour-overlay.tsx`.

- [ ] **Step 4: Verify in the browser**

Rebuild, then on `http://localhost:3111/data?tour=struktur.1`: the knowledge list carries a ring; clicking a row does nothing; the mouse wheel still scrolls the page.

- [ ] **Step 5: Commit**

```bash
git add components/demo/content-inert.tsx components/demo/tour-ring.tsx components/demo/tour-overlay.tsx
git commit -m "feat(demo): outline the anchor, freeze the product, keep it scrollable"
```

---

### Task 7: Delete Shepherd

**Files:**
- Delete: `components/demo/tour-shepherd.tsx`, `components/demo/tour-stage.tsx`, `components/demo/tour-bubble.tsx`, `lib/demo/shepherd-step.ts`, `lib/demo/shepherd-step.test.ts`
- Modify: `package.json`, `app/globals.css`

- [ ] **Step 1: Delete the files and the dependency**

```bash
git rm components/demo/tour-shepherd.tsx components/demo/tour-stage.tsx components/demo/tour-bubble.tsx lib/demo/shepherd-step.ts lib/demo/shepherd-step.test.ts
npm uninstall shepherd.js
```

- [ ] **Step 2: Remove the stylesheet import and dead rules**

`grep -rn "shepherd" app components lib --include='*.ts' --include='*.tsx' --include='*.css'`. The panel in Task 3 reuses `.shepherd-button` for its buttons; either keep those rules and say so in a comment, or rename to `demo-button` and update the panel. **Pick one and be consistent** — a class named after a deleted library is a comment that lies.

- [ ] **Step 3: Verify**

Run: `npx vitest run lib/demo && npx tsc --noEmit && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: all clean, and no `shepherd` in the build output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(demo): remove Shepherd"
```

---

### Task 8: Walk all 37 steps and assert the property

**Files:**
- Create: `scripts/walk-demo.mjs` (committed — it stops being scratchpad throwaway)

Playwright is installed in the session scratchpad and **must not** be added to `package.json`. The script takes the browser from there.

- [ ] **Step 1: Write the walker**

For every step, navigate to its href and assert:

```js
const checks = await page.evaluate(() => {
  const panel = document.querySelector('[data-demo-id="tour-panel"]');
  const main = document.querySelector("main");
  const p = panel.getBoundingClientRect(), m = main.getBoundingClientRect();
  return {
    panelVisible: p.width > 0 && p.height > 0,
    // THE property this whole change exists for.
    overlapsContent: p.left < m.right && p.right > m.left && p.top < m.bottom && p.bottom > m.top,
    ringPresent: !!document.querySelector('[data-demo-id="tour-ring"]'),
    coveringPanel: [...document.querySelectorAll("body *")].some((e) => {
      if (e === panel || panel.contains(e) || e.contains(panel)) return false;
      const cs = getComputedStyle(e);
      if (cs.position !== "fixed" || cs.visibility === "hidden" || cs.display === "none") return false;
      const r = e.getBoundingClientRect();
      return r.width > 100 && r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top;
    }),
  };
});
```

Assert per step: `panelVisible === true`, `overlapsContent === false`, `coveringPanel === false`, and `ringPresent === (step.anchor !== null)`.

Then assert non-operability and scrollability:

```js
const before = page.url();
await page.locator("main a, main button").first().click({ force: true, timeout: 2000 }).catch(() => {});
await page.waitForTimeout(500);
const urlUnchanged = page.url() === before;
const scrolled = await page.evaluate(() => {
  const s = [...document.querySelectorAll("main *")].find((e) => e.scrollHeight > e.clientHeight + 40);
  if (!s) return "n/a";
  const t0 = s.scrollTop; s.scrollBy(0, 120); return s.scrollTop !== t0;
});
```

- [ ] **Step 2: Run it against all 37 steps**

Run: `node scripts/walk-demo.mjs`
Expected: every step passes all five assertions. Screenshots land in the scratchpad for eyeballing.

- [ ] **Step 3: Record what reflows badly**

The spec predicts some product screens will not enjoy ~1060px — the analytics charts, the evals grid, the agent wizard. Review the screenshots and write what you find into the report. **Do not fix product layout in this task**; it is out of scope by the spec's non-goals.

- [ ] **Step 4: Commit**

```bash
git add scripts/walk-demo.mjs
git commit -m "test(demo): walk every step and assert the panel never overlaps"
```

---

## Self-Review

**Spec coverage.** Layout → Task 4. Interaction model → Task 6. Step model → Task 2. Scenes as routes → Task 1. Wizard dialog → Task 5. What is retired → Task 7. Copy → Task 2 Step 7 plus the `lead?` handling in Tasks 2 and 3. Testing → the node tests in Tasks 1–2 and the walker in Task 8. Risks → Task 8 Step 3 records the reflow risk; the mobile risk is covered only by the `md:` breakpoints in Tasks 3–4 and is **not** separately verified, because there is no mobile device in this loop. That gap is real and named rather than papered over.

**Placeholder scan.** One deliberate ellipsis, in Task 1 Step 3, where the scene content must be copied verbatim from four existing files rather than retyped from this plan — retyping signed-off German is exactly what the global constraints forbid. Every other step carries its real content.

**Type consistency.** `DEMO_SCENES` and `sceneRoute` are defined in Task 1 and consumed in Tasks 1 and 2. `lead?: string` is added in Task 2 and read in Task 3. `data-demo-id="tour-panel"` is set in Task 3 and queried in Tasks 5 and 8. `data-demo-id="tour-ring"` is set in Task 6 and queried in Task 8. `scrollBlock` survives Task 2 and is consumed in Task 6.
