# Demo Narrative Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-order the demo tour to tell a data-first story and add its four new opening chapters — the mess of data, structuring it into knowledge bases, ingesting a document, and permissioning it — so a visitor meets the chat only after watching the knowledge that answers them get built.

**Architecture:** Pure content work on the engine already merged. New chapters are modules under `lib/demo/chapters/`, their fixtures are complete worlds per step under `lib/demo/fixtures/`, and motion comes from `advanceAfterMs` chaining those worlds rather than from any new machinery. Two product components gain a `data-demo-id` anchor; nothing else in the product is touched.

**Tech Stack:** Next.js 16, React 19.2, Shepherd.js 15, framer-motion 12, Apollo Client 3.14, vitest 4 (`environment: "node"`, no DOM), Python 3 + gpt-image-2 for illustrations.

**Spec:** `docs/superpowers/specs/2026-09-03-demo-narrative-rebuild-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-03-demo-presentation-engine.md` (merged to `main`, 18 commits). This plan consumes `ContentBlock`, `advanceAfterMs`, `kind: "stage"`, `size: "wide"` and the one-module-per-chapter layout it established. It adds no new mechanisms.

## Global Constraints

- **Tests run in node with no DOM.** `vitest.config.ts` sets `environment: "node"` and collects only `lib/**/*.test.ts`, `components/**/*.test.ts`, `app/**/*.test.ts`. Never write a test needing `document`; never create a `.test.tsx` — it will not be collected.
- **Demo copy is hardcoded German, never next-intl.** The demo forces `locale = "de"`; demo-only strings must not enter `messages/*.json`, which every real deployment ships.
- **Sie-form throughout.** The audience is technical directors evaluating a purchase.
- **Every step must be a COMPLETE world** (`lib/demo/types.ts`) — never a delta over the previous step. The Tour menu lets a visitor jump anywhere.
- **Auto-advance never crosses a chapter boundary**, and never sits on a step with a `cta`. `lib/demo/chapters/index.test.ts` enforces both; `autoAdvanceDelay` enforces them again at runtime.
- **A stage step must have `anchor: null`** — it covers the viewport, so an anchor would point at something invisible. Enforced by `chapters/index.test.ts`.
- **`tsconfig.json` sets `strict: true` but NOT `noImplicitReturns`** — a `switch` over `ContentBlock` needs `default: { const unhandled: never = block; return unhandled; }`.
- **Client confidentiality:** the demo data is deliberately unattributed. NEW Lift and ALGI are named ONCE, in `lib/demo/chapters/contact.ts`, next to the closing ask. `chapters/index.test.ts` asserts no other chapter's content mentions them — that test must keep passing.
- **OPEN palette:** lime `#EFFE7C`, ink `#1A1A1A`, lavender `#C0ACF9`, sage `#C9D08F`, blush `#FFE1DE`, cream `#FFFDF3`.
- **Never commit the OpenAI key.** Supplied via `OPENAI_API_KEY` in the environment only.
- **Known pre-existing failure:** `components/shell/nav-config.test.ts` fails on `main` (unrelated `models` nav entry). Not caused here; do not "fix" it.
- **Out of scope:** chapter 11 ("Was es kostet", `/analytics` + `/budgets`) belongs to project 3. This plan delivers eleven chapters and leaves that slot for it.

## File Structure

**Create:**
- `lib/demo/fixtures/chapter-structure.ts` — worlds for the knowledge-base list filling (0 → 3 → 7 contexts).
- `lib/demo/fixtures/chapter-aufnahme.ts` — worlds for ingestion (empty → in-flight → complete), including active-job rows.
- `lib/demo/fixtures/chapter-zugriff.ts` — the permissioned item world.
- `lib/demo/chapters/daten.ts` — chapter 1, full-bleed stage.
- `lib/demo/chapters/struktur.ts` — chapter 2, `/data`.
- `lib/demo/chapters/aufnahme.ts` — chapter 3, `/data/[ctx]` plus one stage beat.
- `lib/demo/chapters/zugriff.ts` — chapter 4, the item's access section.

**Modify:**
- `lib/demo/tour.ts` — `DemoChapterId` union: drop `"intro"`, add `"daten" | "struktur" | "aufnahme" | "zugriff"`.
- `lib/demo/chapters/index.ts` — new order.
- `lib/demo/fixtures/index.ts` — `getWorld` cases for the new chapters.
- `lib/demo/resolvers.ts` — resolver coverage for anything the new routes issue that is not already mapped.
- `lib/demo/current-position.ts` — `turnsFor` / `scrollbackFor` take `DemoChapterId`; the renamed ids must still compile.
- `app/(application)/data/components/context-library.tsx` — add `data-demo-id="knowledge-contexts"`.
- `app/(application)/data/[ctx]/components/item-access-section.tsx` — add `data-demo-id="item-access"`.
- `lib/demo/chapters/intro.ts` — deleted, replaced by `daten.ts`.
- `scripts/generate-demo-image.py` — prompts for the four new illustrations; `structure` prompt reconciled to the real chapter count.

**Delete:**
- `lib/demo/chapters/intro.ts` (superseded by `daten.ts`).

---

### Task 1: Fixtures for the data-first chapters

**Files:**
- Create: `lib/demo/fixtures/chapter-structure.ts`, `lib/demo/fixtures/chapter-aufnahme.ts`, `lib/demo/fixtures/chapter-zugriff.ts`
- Modify: `lib/demo/fixtures/index.ts`
- Test: `lib/demo/fixtures/index.test.ts`

**Interfaces:**
- Consumes: `DemoWorld` from `../types`; `techdocWorld(step)` from `./chapter-techdoc`; `CONTEXTS` from `./contexts`; `SOFTWARE_DOC_ITEMS`, `SOFTWARE_DOC_CONTEXT_ID`, `SOFTWARE_DOC_ITEM_ID` from `./software-docs`.
- Produces: `structureWorld(step: number): DemoWorld`, `aufnahmeWorld(step: number): DemoWorld`, `zugriffWorld(step: number): DemoWorld`.

- [ ] **Step 1: Write the failing test**

Append to `lib/demo/fixtures/index.test.ts`:

```ts
import { getWorld } from "./index";

describe("data-first chapter worlds", () => {
  // Chapter 2 animates by advancing between COMPLETE worlds, not by mutating
  // one. Each step is independently addressable from the Tour menu, so each
  // must stand on its own.
  it("fills the knowledge-base list across chapter 2's steps", () => {
    expect(getWorld({ chapter: "struktur", step: 0 }).contexts).toHaveLength(0);
    expect(getWorld({ chapter: "struktur", step: 1 }).contexts).toHaveLength(3);
    expect(getWorld({ chapter: "struktur", step: 2 }).contexts).toHaveLength(7);
  });

  it("fills the item list across chapter 3's steps", () => {
    const at = (step: number) =>
      getWorld({ chapter: "aufnahme", step }).itemsByContext?.[
        "software_documentation_context"
      ] ?? [];
    expect(at(0)).toHaveLength(0);
    expect(at(1).length).toBeGreaterThan(0);
    expect(at(1).length).toBeLessThan(at(3).length);
    expect(at(3)).toHaveLength(18);
  });

  it("gives chapter 4 the document chapter 3 just ingested", () => {
    const items =
      getWorld({ chapter: "zugriff", step: 0 }).itemsByContext?.[
        "software_documentation_context"
      ] ?? [];
    expect(items.some((i) => i.id === "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c")).toBe(true);
  });

  // The invariant every world must hold: a visitor jumping straight here from
  // the Tour bubble must land in a coherent application, not a half-built one.
  it("gives every new chapter a complete world at every step", () => {
    for (const chapter of ["struktur", "aufnahme", "zugriff"] as const) {
      for (let step = 0; step < 4; step++) {
        const world = getWorld({ chapter, step });
        expect(Array.isArray(world.agents), `${chapter}.${step} agents`).toBe(true);
        expect(world.agents.length, `${chapter}.${step} agents`).toBeGreaterThan(0);
        expect(Array.isArray(world.contexts), `${chapter}.${step} contexts`).toBe(true);
        expect(Array.isArray(world.sessions), `${chapter}.${step} sessions`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/fixtures/index.test.ts`
Expected: FAIL — `getWorld` falls through to `techdocWorld(0)` for the unknown chapters, so the length assertions fail (7 contexts at step 0, not 0).

- [ ] **Step 3: Write the structure world**

```ts
// lib/demo/fixtures/chapter-structure.ts
import type { DemoWorld } from "../types";
import { CONTEXTS } from "./contexts";
import { techdocWorld } from "./chapter-techdoc";

/**
 * Chapter 2 — the knowledge-base list filling.
 *
 * Three complete worlds rather than one world and a timer. types.ts requires
 * every step to be whole so the Tour bubble can jump anywhere, and the
 * alternative would need forced Apollo refetches on every tick because the
 * product's useQuery calls do not poll.
 *
 * The contexts are the REAL seven the deployment runs (contexts.ts) — the same
 * ids chapter 5's citations reference and chapter 7's routing table lists. The
 * partial step takes the first three in declaration order rather than a
 * curated subset: it is a moment of filling, not a claim about which three
 * matter.
 */
export function structureWorld(step: number): DemoWorld {
  const base = techdocWorld(0);
  const shown = step <= 0 ? 0 : step === 1 ? 3 : CONTEXTS.length;
  return { ...base, contexts: CONTEXTS.slice(0, shown) };
}
```

- [ ] **Step 4: Write the ingestion world**

```ts
// lib/demo/fixtures/chapter-aufnahme.ts
import type { DemoWorld } from "../types";
import { techdocWorld } from "./chapter-techdoc";
import { SOFTWARE_DOC_CONTEXT_ID, SOFTWARE_DOC_ITEMS } from "./software-docs";

/**
 * Chapter 3 — a knowledge base filling with documents.
 *
 * Four worlds: empty, two partial, complete. The counts are deliberately
 * uneven (0, 6, 13, 18) because a linear fill reads as a progress bar and an
 * uneven one reads as work arriving — which is what ingestion actually looks
 * like when a queue drains.
 *
 * The documents are the REAL eighteen from software-docs.ts, not invented
 * ones. Chapter 5 cites FST2XTchanges-customer-DE.docx by id, so a visitor who
 * later sees that citation has already watched this exact file arrive.
 */
const COUNTS = [0, 6, 13, SOFTWARE_DOC_ITEMS.length];

export function aufnahmeWorld(step: number): DemoWorld {
  const base = techdocWorld(0);
  const count = COUNTS[Math.min(Math.max(step, 0), COUNTS.length - 1)];
  return {
    ...base,
    itemsByContext: {
      ...(base.itemsByContext ?? {}),
      [SOFTWARE_DOC_CONTEXT_ID]: SOFTWARE_DOC_ITEMS.slice(0, count),
    },
  };
}
```

- [ ] **Step 5: Write the access world**

```ts
// lib/demo/fixtures/chapter-zugriff.ts
import type { DemoWorld } from "../types";
import { aufnahmeWorld } from "./chapter-aufnahme";

/**
 * Chapter 4 — who may read what.
 *
 * Deliberately the COMPLETED ingestion world: the chapter opens on the same
 * knowledge base the previous chapter just filled, so the permissions being
 * set are visibly the permissions on documents the visitor watched arrive.
 * Reusing the last step of chapter 3 rather than rebuilding it also means the
 * two chapters cannot drift apart.
 */
export function zugriffWorld(_step: number): DemoWorld {
  return aufnahmeWorld(3);
}
```

- [ ] **Step 6: Wire them into `getWorld`**

In `lib/demo/fixtures/index.ts`, add the imports and three cases to the switch, above the `default`:

```ts
import { structureWorld } from "./chapter-structure";
import { aufnahmeWorld } from "./chapter-aufnahme";
import { zugriffWorld } from "./chapter-zugriff";
```

```ts
    case "struktur":
      return at(structureWorld(pos.step));
    case "aufnahme":
      return at(aufnahmeWorld(pos.step));
    case "zugriff":
      return at(zugriffWorld(pos.step));
```

The `DemoChapterId` union does not yet contain these ids, so TypeScript will reject the cases. Add them to the union in `lib/demo/tour.ts` now (keep `"intro"` for the moment — Task 2 removes it):

```ts
export type DemoChapterId =
  | "intro"
  | "daten"
  | "struktur"
  | "aufnahme"
  | "zugriff"
  | "techdoc"
  | "ingestion"
  | "config"
  | "memory"
  | "evals"
  | "email"
  | "meetings"
  | "contact";
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. The new fixture tests green; every existing test unchanged.

- [ ] **Step 8: Commit**

```bash
git add lib/demo/fixtures lib/demo/tour.ts
git commit -m "feat(demo): fixture worlds for the data-first chapters"
```

---

### Task 2: Chapter 1 — Ihre Daten

Replaces the `intro` chapter with a full-bleed opening that states the customer's problem before showing any product.

**Files:**
- Create: `lib/demo/chapters/daten.ts`
- Delete: `lib/demo/chapters/intro.ts`
- Modify: `lib/demo/chapters/index.ts`, `lib/demo/tour.ts`
- Test: `lib/demo/chapters/index.test.ts` (existing invariants must keep passing)

**Interfaces:**
- Consumes: `DemoChapter` type from `../tour`; `TECHDOC_CHAT` from `../routes`; `ContentBlock` shapes from `../content`.
- Produces: `datenChapter: DemoChapter` with id `"daten"`, exported from `lib/demo/chapters/daten.ts`.

- [ ] **Step 1: Write the chapter**

```ts
// lib/demo/chapters/daten.ts
import type { DemoChapter } from "../tour";
import { TECHDOC_CHAT } from "../routes";

/**
 * Chapter 1 — the problem, before any product.
 *
 * A stage rather than a popover: there is nothing on screen to point at yet,
 * and a cinematic opening is not a tooltip over a dimmed application. The
 * route is the chat only so that the app behind the overlay is a coherent
 * screen if the stage animates out before the next navigation lands.
 *
 * This chapter replaces the old `intro`, which opened on a chat window and
 * asked the visitor to be impressed by a citation before they had any reason
 * to care. The tour now starts where the customer's problem starts.
 */
export const datenChapter: DemoChapter = {
  id: "daten",
  title: "Ihre Daten",
  steps: [
    {
      id: "daten-pile",
      route: TECHDOC_CHAT,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Das Wissen ist längst da",
      content: [
        {
          kind: "figure",
          src: "/demo/daten-pile.webp",
          alt: "Unstrukturierte Dokumente, E-Mails und Zeichnungen",
        },
        {
          kind: "paragraph",
          text: "Handbücher, Datenblätter, Schaltpläne, E-Mails, Support-Tickets, Besprechungsaufzeichnungen. In jedem Unternehmen liegt das Wissen bereits vor — verteilt über Laufwerke, Postfächer und Köpfe.",
        },
        {
          kind: "stat",
          value: "10.000+",
          label: "Dokumente in einem typischen Aufzugsunternehmen",
        },
      ],
      advanceAfterMs: 4200,
    },
    {
      id: "daten-problem",
      route: TECHDOC_CHAT,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Nur nicht in einer Form, mit der eine KI arbeiten kann",
      content: [
        {
          kind: "bullets",
          items: [
            "Niemand weiß, welche Fassung die gültige ist",
            "Dieselbe Frage wird jedes Jahr neu beantwortet",
            "Wer die Antwort kennt, ist gerade im Urlaub",
          ],
        },
        {
          kind: "paragraph",
          text: "Ein Sprachmodell ohne Zugriff auf diese Unterlagen erfindet plausible Antworten. Ein Sprachmodell mit ungeordnetem Zugriff findet die falsche Fassung. Beides ist schlimmer als keine Antwort.",
        },
        {
          kind: "callout",
          tone: "fact",
          text: "Die nächsten Kapitel zeigen, was dazwischen liegt — und dass es Konfiguration ist, kein Versprechen.",
        },
      ],
    },
  ],
};
```

- [ ] **Step 2: Register it and retire the intro**

Delete `lib/demo/chapters/intro.ts`. In `lib/demo/chapters/index.ts`, replace the `introChapter` import and its array entry with `datenChapter` in the same first position. In `lib/demo/tour.ts`, remove `"intro"` from the `DemoChapterId` union.

Search for any remaining reference: `grep -rn '"intro"\|introChapter' lib components app` must return nothing but this plan.

- [ ] **Step 3: Run tests to see what breaks**

Run: `npx vitest run lib/demo`
Expected: FAIL — `lib/demo/chapters/index.test.ts`'s figure-existence check fails on `/demo/daten-pile.webp`, which Task 7 generates.

- [ ] **Step 4: Unblock the figure check**

The asset does not exist yet and Task 7 owns generating it. Rather than weaken the test, create a placeholder so the invariant keeps its teeth:

```bash
cp public/demo/structure.webp public/demo/daten-pile.webp
```

Add a line to your report noting the placeholder so Task 7 knows to overwrite it. Do NOT commit a comment describing it as final art.

- [ ] **Step 5: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/demo/chapters public/demo/daten-pile.webp lib/demo/tour.ts
git commit -m "feat(demo): open the tour on the customer's problem, not the chat"
```

---

### Task 3: Chapter 2 — Struktur

**Files:**
- Create: `lib/demo/chapters/struktur.ts`
- Modify: `lib/demo/chapters/index.ts`, `app/(application)/data/components/context-library.tsx`
- Test: `lib/demo/chapters/index.test.ts`

**Interfaces:**
- Consumes: `structureWorld` (Task 1, via `getWorld`); `DemoChapter` from `../tour`.
- Produces: `strukturChapter: DemoChapter` with id `"struktur"`; a new product anchor `data-demo-id="knowledge-contexts"`.

- [ ] **Step 1: Add the product anchor**

`/data` currently carries no `data-demo-id`. In `app/(application)/data/components/context-library.tsx`, add `data-demo-id="knowledge-contexts"` to the element wrapping the context grid — the container whose children are the knowledge-base cards, NOT the page shell, so the spotlight frames the list rather than the whole screen.

Read the file first and pick the wrapper deliberately. Add nothing else; this is the only product change in this task.

- [ ] **Step 2: Write the chapter**

```ts
// lib/demo/chapters/struktur.ts
import type { DemoChapter } from "../tour";

/**
 * Chapter 2 — structure is the price of access.
 *
 * The list fills across three steps because motion here IS the argument: a
 * prospect watching seven knowledge bases appear understands "we organise your
 * data" faster than any sentence saying so. Each step is a complete world
 * (fixtures/chapter-structure.ts), so the Tour bubble can land on any of them.
 *
 * The first two steps auto-advance; the third waits. A chapter never
 * auto-advances off its own end — chapters/index.test.ts enforces that.
 */
export const strukturChapter: DemoChapter = {
  id: "struktur",
  title: "Struktur",
  steps: [
    {
      id: "struktur-empty",
      route: "/data",
      anchor: null,
      title: "Wissen braucht einen Ort",
      content: [
        {
          kind: "paragraph",
          text: "Damit ein Assistent etwas nachschlagen kann, muss es irgendwo liegen — getrennt nach Art des Wissens, nicht in einem einzigen Topf.",
        },
      ],
      advanceAfterMs: 2200,
    },
    {
      id: "struktur-filling",
      route: "/data",
      anchor: "knowledge-contexts",
      scrollBlock: "start",
      title: "Eine Wissensbasis je Wissensart",
      content: [
        {
          kind: "paragraph",
          text: "Technische Dokumentation wird anders gelesen als ein Support-Ticket. Normen anders als eine Servicedatenbank. Jede Basis bekommt eigene Regeln.",
        },
      ],
      advanceAfterMs: 2200,
    },
    {
      id: "struktur-full",
      route: "/data",
      anchor: "knowledge-contexts",
      scrollBlock: "start",
      size: "wide",
      title: "Sieben Basen, sieben Lesarten",
      content: [
        {
          kind: "figure",
          src: "/demo/struktur.webp",
          alt: "Geordnete Wissensbasen",
        },
        {
          kind: "paragraph",
          text: "Diese sieben laufen in der gezeigten Umgebung. Die Anzahl ist nicht begrenzt — und welche ein Assistent durchsuchen darf, ist eine Einstellung pro Assistent, wie Kapitel 7 zeigt.",
        },
      ],
    },
  ],
};
```

- [ ] **Step 3: Register it**

In `lib/demo/chapters/index.ts`, import `strukturChapter` and place it immediately after `datenChapter`.

- [ ] **Step 4: Placeholder asset**

```bash
cp public/demo/structure.webp public/demo/struktur.webp
```

Note it in your report for Task 7.

- [ ] **Step 5: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS — including the route-allowlist check (`/data` is already in `lib/demo/supported-routes.ts`) and the anchor's existence.

- [ ] **Step 6: Commit**

```bash
git add lib/demo/chapters "app/(application)/data/components/context-library.tsx" public/demo/struktur.webp
git commit -m "feat(demo): chapter 2 — the knowledge bases fill"
```

---

### Task 4: Chapter 3 — Aufnahme

**Files:**
- Create: `lib/demo/chapters/aufnahme.ts`
- Modify: `lib/demo/chapters/index.ts`
- Test: `lib/demo/chapters/index.test.ts`

**Interfaces:**
- Consumes: `aufnahmeWorld` (Task 1, via `getWorld`); the existing `knowledge-items` anchor in `app/(application)/data/[ctx]/components/items-table.tsx`.
- Produces: `aufnahmeChapter: DemoChapter` with id `"aufnahme"`.

- [ ] **Step 1: Write the chapter**

```ts
// lib/demo/chapters/aufnahme.ts
import type { DemoChapter } from "../tour";
import { SOFTWARE_DOC_CONTEXT_ID } from "../fixtures/software-docs";

const CTX = `/data/${SOFTWARE_DOC_CONTEXT_ID}`;

/**
 * Chapter 3 — what actually happens to a document.
 *
 * The list fills across three auto-advancing steps, then a STAGE interrupts to
 * show the part no product screen can: a PDF page being read. That beat is a
 * stage rather than a popover because its subject is not on the page behind
 * it — there is nothing to anchor to, and dimming a screen to point at nothing
 * is worse than covering it deliberately.
 *
 * The eighteen documents are real (fixtures/software-docs.ts) and chapter 5
 * cites one of them, so a visitor meets that citation having watched the file
 * arrive.
 */
export const aufnahmeChapter: DemoChapter = {
  id: "aufnahme",
  title: "Aufnahme",
  steps: [
    {
      id: "aufnahme-empty",
      route: CTX,
      anchor: "knowledge-items",
      scrollBlock: "start",
      title: "Niemand lädt das von Hand hoch",
      content: [
        {
          kind: "paragraph",
          text: "Dokumente kommen aus dem Laufwerk, aus SharePoint, über die API — oder per Upload, wenn es einmal schnell gehen muss. Die Basis beginnt leer.",
        },
      ],
      advanceAfterMs: 2000,
    },
    {
      id: "aufnahme-running",
      route: CTX,
      anchor: "knowledge-items",
      scrollBlock: "start",
      title: "Die Aufnahme läuft",
      content: [
        {
          kind: "paragraph",
          text: "Jede Datei durchläuft dieselbe Strecke. Bei tausend Dokumenten dauert das Stunden und niemand sieht dabei zu — hier ist es beschleunigt.",
        },
      ],
      advanceAfterMs: 2000,
    },
    {
      id: "aufnahme-page",
      route: CTX,
      anchor: null,
      kind: "stage",
      size: "wide",
      title: "Was mit einer Seite geschieht",
      content: [
        {
          kind: "figure",
          src: "/demo/aufnahme-page.webp",
          alt: "Eine PDF-Seite wird analysiert",
        },
        {
          kind: "sequence",
          steps: [
            "Seite als Bild analysieren — Tabellen, Zeichnungen, Beschriftungen",
            "In strukturierten Text übersetzen, Layout erhalten",
            "In Passagen zerlegen, die für sich verständlich bleiben",
            "Fachbegriffe, Typen und Fehlercodes herauslösen",
          ],
        },
        {
          kind: "paragraph",
          text: "Ein Schaltplan ist kein Fließtext. Wird er wie einer behandelt, findet die Suche ihn nie — deshalb wird jede Seite angesehen, nicht nur ausgelesen.",
        },
      ],
      advanceAfterMs: 5200,
    },
    {
      id: "aufnahme-items",
      route: CTX,
      anchor: "knowledge-items",
      scrollBlock: "start",
      title: "Achtzehn Dokumente, durchsuchbar",
      content: [
        {
          kind: "paragraph",
          text: "Aus jeder Datei sind Passagen geworden, jede mit ihrer Herkunft verknüpft. Das ist es, was die Suche in Kapitel 5 tatsächlich durchsucht — und warum jede Aussage dort eine Quelle nennen kann.",
        },
      ],
    },
  ],
};
```

- [ ] **Step 2: Register it**

Import `aufnahmeChapter` in `lib/demo/chapters/index.ts` and place it immediately after `strukturChapter`.

- [ ] **Step 3: Placeholder asset**

```bash
cp public/demo/ch2-ingestion.webp public/demo/aufnahme-page.webp
```

Note it in your report for Task 7.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. In particular `chapters/index.test.ts` must confirm `aufnahme-page` has `anchor: null` (it is a stage) and that the chapter's last step does not auto-advance.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/chapters public/demo/aufnahme-page.webp
git commit -m "feat(demo): chapter 3 — a document becomes searchable knowledge"
```

---

### Task 5: Chapter 4 — Zugriff

**Files:**
- Create: `lib/demo/chapters/zugriff.ts`
- Modify: `lib/demo/chapters/index.ts`, `app/(application)/data/[ctx]/components/item-access-section.tsx`
- Test: `lib/demo/chapters/index.test.ts`

**Interfaces:**
- Consumes: `zugriffWorld` (Task 1, via `getWorld`).
- Produces: `zugriffChapter: DemoChapter` with id `"zugriff"`; a new product anchor `data-demo-id="item-access"`.

**Why this surface:** `item-access-section.tsx` shows, on the exact document chapter 3 just ingested, who may read it. The agent editor's own access section (`agents/edit/[id]/sections/access.tsx`) shows the other half, but chapter 7 already runs on that route — putting chapter 4 there would visit the same screen twice and break the story's forward motion.

- [ ] **Step 1: Add the product anchor**

In `app/(application)/data/[ctx]/components/item-access-section.tsx`, add `data-demo-id="item-access"` to the section's outermost element (the component's root, around line 45's `ItemAccessSection`). Read it first and place the attribute so the spotlight frames the access controls, not the whole item page.

- [ ] **Step 2: Write the chapter**

```ts
// lib/demo/chapters/zugriff.ts
import type { DemoChapter } from "../tour";
import { SOFTWARE_DOC_CONTEXT_ID, SOFTWARE_DOC_ITEM_ID } from "../fixtures/software-docs";

const ITEM = `/data/${SOFTWARE_DOC_CONTEXT_ID}/items/${SOFTWARE_DOC_ITEM_ID}`;

/**
 * Chapter 4 — the same question, two different answers, on purpose.
 *
 * Runs on the ITEM the previous chapter just ingested, so the permissions on
 * screen are visibly the permissions on a document the visitor watched arrive.
 *
 * Deliberately NOT the agent editor's access section: chapter 7 already runs
 * on that route, and sending the visitor there twice costs the story its
 * forward motion. This chapter owns the knowledge side; chapter 7 owns the
 * assistant side.
 */
export const zugriffChapter: DemoChapter = {
  id: "zugriff",
  title: "Zugriff",
  steps: [
    {
      id: "zugriff-item",
      route: ITEM,
      anchor: "item-access",
      scrollBlock: "start",
      title: "Nicht jeder darf alles lesen",
      content: [
        {
          kind: "paragraph",
          text: "Interne Serviceanweisungen gehören dem Technikerteam. Produktdatenblätter dürfen an den Kunden. Beides liegt in derselben Umgebung — getrennt wird pro Eintrag, nicht pro Ordner.",
        },
      ],
    },
    {
      id: "zugriff-consequence",
      route: ITEM,
      anchor: "item-access",
      scrollBlock: "start",
      size: "wide",
      title: "Die Antwort richtet sich nach dem Fragenden",
      content: [
        {
          kind: "figure",
          src: "/demo/zugriff.webp",
          alt: "Dieselbe Frage, zwei Berechtigungen",
        },
        {
          kind: "callout",
          tone: "fact",
          text: "Ein Assistent kann nur nennen, was der Fragende lesen darf. Das ist keine Zusicherung im Systemprompt, sondern eine Prüfung bei jedem Suchlauf.",
        },
        {
          kind: "paragraph",
          text: "Derselbe Assistent beantwortet die Frage eines Technikers also anders als die eines externen Gasts — ohne dass jemand dafür einen zweiten Assistenten bauen muss.",
        },
      ],
    },
  ],
};
```

- [ ] **Step 3: Register it**

Import `zugriffChapter` in `lib/demo/chapters/index.ts` and place it immediately after `aufnahmeChapter`.

- [ ] **Step 4: Placeholder asset**

```bash
cp public/demo/ch3-config.webp public/demo/zugriff.webp
```

Note it in your report for Task 7.

- [ ] **Step 5: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. The route `/data/software_documentation_context/items/d92dd3f2-…` must satisfy `isDemoSupported` (it is a descendant of `/data`).

- [ ] **Step 6: Commit**

```bash
git add lib/demo/chapters "app/(application)/data/[ctx]/components/item-access-section.tsx" public/demo/zugriff.webp
git commit -m "feat(demo): chapter 4 — the answer follows the reader's rights"
```

---

### Task 6: The arc — reorder and reconcile the copy

**Files:**
- Modify: `lib/demo/chapters/index.ts`, `lib/demo/chapters/techdoc.ts`, `lib/demo/chapters/memory.ts`, `lib/demo/chapters/ingestion.ts`, `lib/demo/current-position.ts`
- Test: `lib/demo/chapters/index.test.ts`

**Interfaces:**
- Consumes: every chapter module from Tasks 2–5.
- Produces: the final eleven-chapter order.

- [ ] **Step 1: Write the failing test**

Add to `lib/demo/chapters/index.test.ts`:

```ts
describe("the narrative arc", () => {
  // The reorder IS the point of this plan: the visitor meets the chat only
  // after watching the knowledge that answers them get built and permissioned.
  it("tells the story data-first", () => {
    const order = CHAPTERS.map((c) => c.id);
    const before = (a: string, b: string) =>
      expect(order.indexOf(a), `${a} must precede ${b}`).toBeLessThan(order.indexOf(b));

    before("daten", "struktur");
    before("struktur", "aufnahme");
    before("aufnahme", "zugriff");
    before("zugriff", "techdoc");
    // A correction needs an answer to correct.
    before("techdoc", "memory");
    before("memory", "config");
    before("config", "contact");
  });

  it("opens on the problem, not on the product", () => {
    expect(CHAPTERS[0].id).toBe("daten");
    expect(CHAPTERS[0].steps[0].kind).toBe("stage");
  });

  // The old chapter said "Neun Kapitel" over a drawing of seven doors, a
  // mismatch the original code documented as known. Whatever the copy claims,
  // it must match the list.
  it("states the real chapter count wherever it states one", () => {
    const spelled: Record<number, string> = {
      9: "Neun", 10: "Zehn", 11: "Elf", 12: "Zwölf",
    };
    const claimed = CHAPTERS.flatMap((c) => c.steps)
      .flatMap((s) => s.content)
      .map((b) => contentText([b]))
      .filter((t) => /Kapitel/.test(t));
    for (const text of claimed) {
      for (const [count, word] of Object.entries(spelled)) {
        if (Number(count) !== CHAPTERS.length) {
          expect(text, `claims ${word} but there are ${CHAPTERS.length}`).not.toContain(
            `${word} Kapitel`,
          );
        }
      }
    }
  });
});
```

Also add `title` to the chapter-title assertions if your `CHAPTERS` import is not already present — it is, from the existing suite.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/chapters/index.test.ts`
Expected: FAIL — `techdoc` still precedes `zugriff`, since Tasks 2–5 appended the new chapters at the front but left the old order behind them intact.

- [ ] **Step 3: Set the final order**

In `lib/demo/chapters/index.ts`, the array becomes exactly:

```ts
export const CHAPTERS: DemoChapter[] = [
  datenChapter,     //  1 · the problem
  strukturChapter,  //  2 · knowledge bases
  aufnahmeChapter,  //  3 · ingestion
  zugriffChapter,   //  4 · permissions
  techdocChapter,   //  5 · the answer — now a payoff, not a claim
  memoryChapter,    //  6 · the assistant writes knowledge back
  configChapter,    //  7 · configuration
  evalsChapter,     //  8 · evidence
  emailChapter,     //  9 · unattended work
  meetingsChapter,  // 10 · meetings
  // 11 · "Was es kostet" (/analytics + /budgets) is project 3 and lands here.
  contactChapter,   // 12 · the ask
];
```

Update the file's docblock: the ORDER IS LOAD-BEARING note must now also say that the chat chapter follows the ingestion chapters deliberately, because chapter 5's citation is a conclusion the visitor can check rather than a claim they must accept.

- [ ] **Step 4: Reconcile the chapter-count copy**

The old intro's "Neun Kapitel, rund zwölf Minuten" is gone with `intro.ts`. Search for any remaining count claim:

```bash
grep -rn 'Kapitel' lib/demo/chapters/*.ts
```

Where a step names a chapter by number (chapter 2 and 4 above reference "Kapitel 5" and "Kapitel 7"), verify those numbers match the final order and correct them if not. Chapter 5 is `techdoc`, chapter 7 is `config` — confirm against the array, do not assume.

- [ ] **Step 5: Check the chapter-id consumers still compile**

`lib/demo/current-position.ts` switches on `DemoChapterId` in `turnsFor` and branches on it in `scrollbackFor`. Neither references `"intro"`, but confirm:

```bash
grep -n 'chapter ===\|case "' lib/demo/current-position.ts
```

Both should still be about `"techdoc"` and `"memory"` only. If the compiler complains about a missing case, add it returning the techdoc default — do not invent scrollback for a chapter that has no chat.

- [ ] **Step 6: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/demo
git commit -m "feat(demo): reorder the tour data-first, chat as the payoff"
```

---

### Task 7: Illustrations for the new chapters

Four placeholders from Tasks 2–5 become real art, and the `structure` prompt is reconciled with the chapter count.

**Files:**
- Modify: `scripts/generate-demo-image.py`
- Replace: `public/demo/{daten-pile,struktur,aufnahme-page,zugriff}.webp`, `public/demo/structure.webp`

Requires `OPENAI_API_KEY` in the environment. Source it from the file outside the repo that the controller names in your dispatch; never put it on a command line or in the repo.

- [ ] **Step 1: Add the four prompts**

In `scripts/generate-demo-image.py`, add to `DEMO_PROMPTS`. The shared `STYLE` constant already carries the OPEN collage register — do NOT restate colours or style here, only subject:

```python
    # Chapter 1. The problem, before any product: volume without order.
    "daten-pile": (
        "A large disordered heap of overlapping paper documents, folders, "
        "technical drawings and envelopes, tumbling and scattered, filling the "
        "lower half of the frame. No container, no shelf, no order — the pile "
        "spills past the edges of the frame."
    ),
    # Chapter 2. The same volume, resolved into order. Deliberately echoes the
    # composition of daten-pile so the two read as before and after.
    "struktur": (
        "Seven upright labelled archive boxes in a neat evenly spaced row on a "
        "single shelf, front elevation, each box closed and identical in size, "
        "with a document standing slightly proud of the leftmost box."
    ),
    # Chapter 3. The part no product screen can show.
    "aufnahme-page": (
        "A single document page shown three times in a left-to-right "
        "progression: first as a dense technical drawing, then with its regions "
        "outlined into blocks, then as a stack of small uniform rectangles. "
        "Thin connecting arrows between the three stages."
    ),
    # Chapter 4. Two readers, one document, different access.
    "zugriff": (
        "One document at the centre with two paths leading away from it to "
        "left and right. The left path is open and continues to a simple key "
        "shape; the right path is interrupted by a closed barrier. Symmetrical "
        "composition, no faces, no figures."
    ),
```

- [ ] **Step 2: Reconcile the `structure` prompt**

`structure.webp` shows seven landing doors while the tour now has a different chapter count. Change the `structure` prompt's door count to match `CHAPTERS.length` at the time you run this — read `lib/demo/chapters/index.ts` and count. Update the prompt's comment to record that the count tracks the chapter list, so the next person knows to change both together.

If the count is awkward to draw as a row (more than about nine), say so in your report rather than generating something cluttered — the controller will decide, and a generic composition is better than a miscount.

- [ ] **Step 3: Generate**

```bash
source "<the env file path from your dispatch>"
python3 scripts/generate-demo-image.py daten-pile struktur aufnahme-page zugriff structure
```

If one image fails, report which succeeded and which failed. Do NOT re-run the whole batch — each generation costs money and successful files are already on disk.

- [ ] **Step 4: Check every image before committing**

Open all five. For each confirm: **no text, lettering, numbers or pseudo-words anywhere** (this model invents labels on documents and boxes — it is the most likely failure and the most embarrassing on a prospect-facing screen); lime field with flat ink geometry; no gradients, shadows, photography or 3D; and the subject matches its prompt.

Report any image that fails. Do NOT silently regenerate one you dislike — name it and why, and the controller decides.

- [ ] **Step 5: Verify**

Run: `npx vitest run lib/demo && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: PASS — the figure-existence test proves every chapter still points at a real file.

- [ ] **Step 6: Commit**

```bash
git add public/demo scripts/generate-demo-image.py
git commit -m "feat(demo): illustrations for the data-first chapters"
```

---

### Task 8: End-to-end walkthrough

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Build and serve**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 2: Confirm the entry point**

```bash
curl -s http://localhost:3111/ | grep -oE 'NEXT_REDIRECT[^"]*'
```

Expected: a redirect carrying `?tour=daten.0` — the entry point derives from `CHAPTERS[0]`, so this is also the proof the reorder took effect. **Zero** occurrences of `login?destination`.

- [ ] **Step 3: Walk all eleven chapters in a browser**

Click Weiter from the first step to the last. On each step check:
- the panel renders content blocks — no raw markup, no `[object Object]`;
- anchored steps attach to their target rather than sitting at the viewport's top-left corner (0,0 is the signature of a stranded step);
- illustrations appear in full colour and are not inverted;
- **the two stage steps** (`daten-pile`, `daten-problem`, `aufnahme-page`) cover the screen, show their own Zurück/Weiter, and no Shepherd popover is visible behind them;
- **auto-advance chains complete**, and pressing Weiter or Zurück mid-chain cancels the pending advance rather than racing it;
- the browser console shows **no** `[demo] unmapped GraphQL operation` warnings and no React key or root warnings.

- [ ] **Step 4: Check the new surfaces specifically**

- `/data` — the context list must show 0, then 3, then 7 knowledge bases across chapter 2's steps, and the spotlight must frame the grid rather than the page.
- `/data/software_documentation_context` — the item list must fill 0 → 6 → 13 → 18 across chapter 3.
- The item page — chapter 4's spotlight must frame the access controls, not the whole page.

- [ ] **Step 5: Confirm a stage step's scroll affordance**

Resize the browser to roughly 700px tall and open `aufnahme-page` (the tallest stage — figure plus a four-item sequence plus a paragraph). Its Weiter button must remain reachable by scrolling. This is the one thing the engine's own reviewer could only reason about rather than measure.

- [ ] **Step 6: Commit any fixes, then report**

```bash
git add -A && git commit -m "fix(demo): <what the walkthrough found>"
```

If the walkthrough is clean, there is nothing to commit — say so rather than inventing a change.

---

## Self-Review

**Spec coverage.** Chapter 1 "Ihre Daten" → Task 2. Chapter 2 "Struktur" → Task 3. Chapter 3 "Aufnahme", including the page-by-page beat → Task 4. Chapter 4 "Zugriff" → Task 5. The data-first reorder and the chat-as-payoff move → Task 6. Motion via complete worlds → Task 1 fixtures plus the `advanceAfterMs` values in Tasks 2–4. OPEN visual system → Task 7. Manual verification, including the stage-height case → Task 8.

**Spec item resolved here:** the spec left chapter 4's surface open ("a question for the implementation plan, once the fixtures exist"). Task 5 settles it on the knowledge item's access section, with the reason recorded in the task and in the chapter's docblock.

**Deliberately not covered:** chapter 11 ("Was es kostet") is project 3; the array carries a comment marking its slot. Poppins/Playfair remain unloaded, so the demo still renders Inter/Merriweather — the spec lists that as out of scope.

**Placeholder scan.** The four `cp` commands in Tasks 2–5 create placeholder image files, replaced by real art in Task 7. They are deliberate and each task's report flags them; the figure-existence invariant keeps its teeth throughout rather than being weakened. No "TBD", no "similar to Task N", no step without its content.

**Type consistency.** `structureWorld` / `aufnahmeWorld` / `zugriffWorld` (Task 1) are consumed by name in `getWorld`'s switch (Task 1 Step 6) and by nothing else. `datenChapter`, `strukturChapter`, `aufnahmeChapter`, `zugriffChapter` (Tasks 2–5) are imported by `chapters/index.ts` in Task 6's final array. The chapter ids `"daten" | "struktur" | "aufnahme" | "zugriff"` are added to `DemoChapterId` in Task 1 Step 6, before any chapter uses them, and `"intro"` is removed in Task 2 once nothing references it. Anchors `knowledge-contexts` (Task 3) and `item-access` (Task 5) are each added to the product in the same task that first points a step at them.
