# Demo narrative rebuild — design

**Date:** 2026-09-03
**Status:** approved, ready for an implementation plan
**Supersedes parts of:** `2026-08-27-demo-shell-design.md` (chapter order, step presentation)

## Why

The guided demo is technically correct and walks a visitor through a real story, but the product UI it points at is not self-explanatory, and the tour treats its own explanations as tooltips. Daniel, 2026-09-03:

> "Its technically correct, and guides the user through the story, but the UI itself is not really that easily understood so we need to leverage the tour modals / explainers more, including making them bigger, including animations and more structured text, rather than just treating them as simple tooltips."

Two things follow. The explainers have to carry real weight — structure, motion, brand. And the story has to start where the customer's problem starts: a mess of documents, not a chat box.

This is project 2 of four. Project 1 (foundations) is committed. Projects 3 (analytics + budgets) and 4 (multi-agent gallery) are authored *in the format this spec establishes* and are out of scope here.

## Goals

- The tour explains the product to someone who has never seen it, without narration from a salesperson.
- Explainers become panels: structured content, motion, OPEN brand — not `title` + `body` strings.
- The story runs data-first: mess → structure → ingestion → access → the AI uses it → the AI writes back.
- One visual house style across every asset.

## Non-goals

- Replacing Shepherd. Its anchoring, overlay cutout, `waitForElement`, flip and scroll behaviour are hard-won and stay.
- A per-frame animation clock over fixture data. See "Motion model".
- Analytics, budgets, the agent gallery, or the Home dashboard. Home is deliberately excluded from the demo; `/` is a doorway that redirects into the tour (shipped in project 1).
- Loading Poppins/Playfair. The theme tokens ask for them and `lib/fonts.ts` does not declare them, so the demo renders Inter/Merriweather. Real work, tracked separately.

## The narrative arc

Twelve chapters. The reorder is the substance of this spec, not a side effect of it.

| # | Chapter | Route | Provenance |
|---|---|---|---|
| 1 | **Ihre Daten** — the mess | `stage` (full-bleed) | new |
| 2 | **Struktur** — knowledge bases, click into one | `/data` | new |
| 3 | **Aufnahme** — 1.000 documents, PDF page by page, entities | `/data/[ctx]` | rebuilt from `ingestion` |
| 4 | **Zugriff** — right agent, right user, right knowledge | RBAC surface | new |
| 5 | **Die Antwort** — a hard question, answered with sources | techdoc chat | moved later |
| 6 | **Gedächtnis** — the AI writes knowledge back | memory chat + `/data/newton_memory_context` | existing |
| 7 | Anpassen ohne Code | `/agents/edit/[id]` | existing (+ gallery, project 4) |
| 8 | Belegen statt behaupten | `/evals` | existing |
| 9 | Arbeitet, während Sie schlafen | `/workflows` | existing |
| 10 | Festhalten, was besprochen wurde | `/transcriptions` | existing |
| 11 | Was es kostet | `/analytics`, `/budgets` | project 3 |
| 12 | Sprechen Sie mit uns | techdoc chat | existing |

**Why the chat moves to position 5.** Today chapter 2 opens on a chat window and asserts that every claim carries a source. A visitor has no reason to find that remarkable yet. After chapters 2–4 they have watched those exact documents get ingested, chunked and permissioned — so the citation is a conclusion they can check rather than a claim they must accept. The reorder costs nothing and converts the tour's strongest moment from assertion to proof.

**Why memory cannot move earlier.** Chapter 6 is a chat interaction: the fixture is a correction exchange whose scrollback only makes sense after an answer exists to correct (`scrollbackFor` in `lib/demo/current-position.ts` encodes this). It has to follow the chat chapter. This also matches the brief's own ordering — new knowledge is created *by using* the AI.

**Runtime.** ~16–17 minutes, up from ~12. Chapters 1–4 are short (2–3 steps) and largely auto-advancing, so the added time is less than four chapters implies. If it must come down, drop chapter 9 or 10 rather than compressing the new opening — the opening is what the rebuild is for.

### Chapter beats

Chapters 5–12 keep their existing steps except where a route or anchor moves. The new material:

**1 · Ihre Daten** (`stage`, no route change, full-bleed)
A dot-field of unstructured documents, emails, drawings and recordings. Copy: you already have the knowledge; it is not in a form anything can use. Ends on the question the rest of the tour answers.

**2 · Struktur** (`/data`)
The knowledge-base list populates — seven bases with icons, each named for a real ALGI domain. One is opened. Copy: AI needs access to data, and access needs structure.

**3 · Aufnahme** (`/data/[ctx]`)
Three worlds in sequence: an empty base, ingestion in flight (active jobs, partial counts), then 1.000 items. Between them, a `stage` beat walks one complex PDF page by page — visual analysis, conversion to structured markdown, entity extraction. Copy: manual upload or API, and what actually happens to a page.

**4 · Zugriff**
Who may read what. The same knowledge base, with rights shown per item and per agent. Copy: the answer a technician gets and the answer a customer gets are not the same answer, and that is a configuration, not a promise.

## Presentation layer

### Content as data, rendering as a thin shell

`DemoStep.body: string` becomes `DemoStep.content: ContentBlock[]` — a discriminated union (`paragraph`, `bullets`, `callout`, `stat`, `figure`, `sequence`). The renderer maps blocks to React.

This is not decoration. `vitest.config.ts` runs `environment: "node"` and includes only `**/*.test.ts` — there is no DOM and no React renderer in the test setup. Keeping content as pure data means every chapter's copy, structure and ordering stays assertable in node, exactly as `lib/demo/shepherd-step.ts` already argues for itself:

> "Kept as pure functions in lib/ rather than inline in the overlay so the translation is testable in node… a component that only runs in a browser is a component nobody asserts on."

The alternative — JSX in the chapter list — would move the entire tour script out of test reach. Rejected.

### React inside Shepherd

Shepherd's own type is `StepText = string | ReadonlyArray<string> | HTMLElement | (() => …)`. So `shepherdStepFor` returns a **function** producing a detached `HTMLElement` into which a React root is rendered. A function, not a value, because Shepherd calls it per show and the root must be created and torn down with the step — a captured element leaks a React root per navigation.

Panel size comes from Shepherd's per-step `classes`, driven by a new `DemoStep.size?: "default" | "wide"`.

Everything in `shepherd-step.ts` that governs anchoring is untouched: `waitForElement: ANCHOR_WAIT_MS`, `scrollTo: { block: "nearest" }`, `canClickTarget: true`, placement-as-preference.

### `stage` steps

A step may set `kind: "stage"`. Those bypass Shepherd entirely and render a full-bleed scene over the app, with their own footer wired to the same `StepHandlers`. Chapter 1 and the PDF walkthrough in chapter 3 are stages; everything else stays a Shepherd popover.

The reason for the escape hatch: a full-bleed cinematic opening is not a popover over a dimmed application, and forcing it through Shepherd's positioning would be fighting the tool for no gain.

## Motion model

**Motion comes from more steps, not from a clock inside a step.**

`lib/demo/types.ts` states the invariant the whole fixture layer rests on:

> "Every field is fully specified at every step — never a delta over the previous step. The Tour bubble lets a visitor jump straight to chapter 6, and accumulated state would land them in an incoherent application."

A sub-step clock (`getWorld(position, tick)`) would fight that, and would additionally need forced Apollo refetches on every tick because the product's `useQuery` calls do not poll. Instead: the knowledge base at 0 items, at 240, and at 1.000 is **three complete worlds and three steps**, with a new `DemoStep.advanceAfterMs?: number` moving between them.

This buys deep-linking and the Tour menu for free — every intermediate state is addressable — and needs no new plumbing in the link or the resolvers.

Rules:
- Auto-advance never crosses a chapter boundary; a chapter always ends on a step that waits.
- Any manual navigation (Next, Back, Tour menu) cancels the pending timer.
- The timer is cleared on unmount and on every position change.

Within a step, `framer-motion` (already a dependency, v12) animates the panel's own content.

## Visual system

OPEN brand, from the Frontify exports Daniel provided. Frontify itself is not fetchable — every guidelines URL returns an ~8 KB SPA shell with the content behind auth.

| Token | Hex | Use |
|---|---|---|
| lime | `#EFFE7C` | background fields, accents — identical to `--primary` in `lib/demo/theme.ts` |
| ink | `#1A1A1A` | flat shapes, outlines |
| lavender | `#C0ACF9` | secondary fields |
| sage | `#C9D08F` | tertiary shapes |
| blush / cream | `#FFE1DE` / `#FFFDF3` | soft ground |

Register: **photographic collage** — black-and-white cut-outs over a lime field, flat ink geometry, white dashed diagonals, bold arrows and speech bubbles. The `Muster` set (radial dot-fields with size gradients, triangles, circles) supplies the pattern language; the `kreis` dot-field in particular reads as chaos resolving into ordered rings, which is chapter 1's subject.

Lavender is used deliberately, against the standing no-violet preference, because it is brand-specified rather than chosen — confirmed 2026-09-03.

### Assets

All illustrations are regenerated in the new register — the eight existing monochrome schematics included. Mixing two visual languages reads as inconsistency, and the prompts already live in `scripts/generate-demo-image.py`, so regeneration costs API calls rather than authoring.

The script's `STYLE` constant is rewritten from "technical schematic line illustration… monochrome… restrained and clinical" to the OPEN collage register. Its docstring records why the old style existed (the chapters show real transcripts and a red failing eval cell, and decoration would undercut them) — that argument is now answered by the brand system rather than by restraint, and the rewrite should say so.

`public/demo/brand/` is created with the real logo, signet and favicon from the export. `DEMO_BRAND` already points at those three paths and `components/logo.tsx` hides an image that fails to load, so the header has been silently degrading to a wordmark.

## Testing

Following the demo's existing coverage, all in node:

- **Chapter integrity** — every step's route is in the `isDemoSupported` allowlist; every anchor is a `data-demo-id` that exists in the codebase; every chapter ends on a non-auto-advancing step; no `advanceAfterMs` on a step with a `cta`.
- **Content blocks** — every step has non-empty content; no placeholder text; German copy present where asserted today.
- **Ordering** — the arc is asserted as data, so a reorder that breaks the memory-after-chat constraint fails a test rather than a demo.
- **Shepherd translation** — `shepherdStepFor` continues to be asserted without a DOM; the `text` thunk is checked for identity and laziness, not for rendered output.
- **Resolver coverage** — new chapters' operations answered from the real product query documents, as `apollo-link.operations.test.ts` already does.

React panel rendering is not unit-tested; the test environment has no DOM. It is covered by the manual click-through below. Adding jsdom for this alone is not worth the setup, given content structure is already assertable as data.

**Manual verification:** a full click-through in a demo-mode build, every chapter, checking anchors attach, auto-advance chains complete and cancel correctly, and no unmapped-operation warnings in the console.

## Risks

- **Runtime creep.** Twelve chapters risks a demo nobody finishes. Mitigation: chapters 1–4 stay at 2–3 steps; measure the real click-through before adding anything.
- **Auto-advance feels like loss of control.** Mitigation: never across chapters, always cancellable, never on a step carrying a decision.
- **Generated assets miss the brand.** The register is specific and gpt-image-2 will not hit it first try. Mitigation: settle the style on one test image before generating twelve, exactly as the script's `style-test` entry already provides for.
- **Regenerating all assets is one-way.** The current eight are committed and recoverable from git, so this is reversible in practice.

## Open

- Chapter 4's exact surface. Item-level RBAC on `/data/[ctx]` and the agent editor's sources step both show part of the picture; which one carries the chapter is a question for the implementation plan, once the fixtures exist.
- Poppins and Playfair remain unloaded. Out of scope, but the demo will keep looking less like OPEN than it should until `lib/fonts.ts` declares them.
