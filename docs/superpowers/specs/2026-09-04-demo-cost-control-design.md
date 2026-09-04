# Demo cost & control chapter — design

**Date:** 2026-09-04
**Status:** approved, ready for an implementation plan
**Project 3 of 4** in the demo rebuild agreed 2026-09-03. Projects 1 (foundations) and 2 (engine + narrative) are merged to `main`.

## Why

The tour argues that a knowledge assistant can be trusted with a company's documents. A technical director evaluating that purchase asks two more questions the tour currently cannot answer: *what does it cost*, and *who controls it*. `/analytics` and `/budgets` answer both, and both currently render "nicht in der Demo verfügbar".

The spec for the narrative rebuild reserved slot 11 for this chapter and the chapter array carries a comment marking it. This design fills that slot.

## Goals

- `/analytics` and `/budgets` render convincing screens in demo mode.
- A two-step chapter, "Was es kostet", at position 11.
- The argument is **attribution and control**. Never savings, never ROI.
- The invented figures are disclosed on screen, and the disclosure is enforced by a test.

## Non-goals

- Any change to the product's `/analytics` or `/budgets` components. This is fixtures and tour copy.
- Real spend data. None was captured from the deployment; see "Honesty" below.
- A general REST fixture framework. One path gets a fixture; the mechanism stays small enough to read in one sitting.
- Project 4 (the multi-agent gallery), which follows.

## Honesty: this chapter cannot use real data

Every other chapter shows something that happened — nine real documents with real chunk counts, a real meeting recording, real evals. **There is no captured spend history**, so every number on these two screens is invented.

That is permitted here because the codebase already has a convention for it. `lib/demo/tour.test.ts` maintains a register of *"the two chapters that show something invented"*, and the evals chapter states on screen that its scores are illustrative rather than measurements. This chapter joins that register.

Two rules follow, and both are load-bearing:

1. **The disclosure lives in the visitor-facing copy**, not in a code comment. A prospect must be able to read it.
2. **A test asserts the disclosure is present.** If a future author trims the sentence for brevity, the suite fails. Enforcement by test is the difference between a convention and a hope.

Scale: roughly **€400/month** — a genuine early production deployment, a handful of teams, a few thousand assistant calls plus meeting transcription. Chosen deliberately low: high enough to be real, low enough that a reader's attention stays on *where the money goes* rather than on the total.

**The chapter never claims savings.** This mirrors the principle already established for the Value Ledger work — state the position, never assert a return. A demo that claims "cheaper than a headcount" invites an argument it cannot win and undercuts the credibility the rest of the tour spent eleven chapters building.

## Architecture

### The REST fixture layer

`/analytics` is the demo's only screen driven by REST rather than GraphQL. It calls `GET /admin/litellm/tag-activity` through the shared helper in `lib/api/client.ts`, which today short-circuits:

```ts
if (isDemoMode()) return null;
```

That returns `null` for **every** REST call in the demo. The comment above it explains why, and the reason is still valid: the other REST callers — session files, follow-up suggestions — are optional enrichments, and a thrown error would put a failure state on screen for something a visitor was never meant to notice.

So the fix must add a fixture for one path **without** disturbing the silence of the others:

```ts
if (isDemoMode()) return demoRestResponse(path, method);
```

`lib/demo/rest-fixtures.ts` exports `demoRestResponse(path: string, method: string): unknown | null`. It matches `/admin/litellm/tag-activity` and returns a `TagActivityResponse`; everything else returns `null`, exactly as before.

This deliberately mirrors the GraphQL side — `resolverFor(operationName)` in `lib/demo/resolvers.ts` — so the demo has one shape of answer per transport and a reader who understands one understands the other.

**Rejected:** wrapping `fetch` globally in demo mode. It reaches further than needed and would capture calls whose current silence is correct.

**Rejected:** making `useTagActivity` demo-aware. Feature-local, and the next REST-backed screen would repeat the whole exercise.

### The fixture must be time-relative

`/analytics` requests a date window — `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — and its default lens is a trailing window ending today.

**A fixture with hardcoded dates renders an empty chart the moment the demo is older than that window**, silently, on a prospect's screen. No test would catch it; the request succeeds and the data simply falls outside the range.

So `demoRestResponse` parses the requested range and generates its daily rows **inside** it. The series is deterministic — the same window always yields the same numbers — so screenshots and any future assertion stay stable, while the data can never go stale.

This is the same class of defect as the `structure.webp` door count that this project already retired: a value that silently stops describing reality. Worth stating in the fixture's own comment.

### Budgets

`/budgets` is pure GraphQL: six `*_WITH_BUDGETS` operations re-exported from the global query module. They drop into the existing `DEMO_RESOLVERS` table with no new mechanism.

They need a small set of entities carrying budget fields. German team names, generic functions — Technik, Service, Vertrieb. **No customer names**: `lib/demo/chapters/index.test.ts` asserts NEW Lift and ALGI appear only in `contact.ts`, and that test must keep passing.

## The chapter

Position 11, immediately before `contact`. Two steps, both popovers.

**`kosten-verbrauch`** — on `/analytics`. Spend over the trailing window, split by team. Its copy carries the disclosure that the figures are illustrative.

**`kosten-kontrolle`** — on `/budgets`. A limit per team and what happens when one is reached. The point is that the control is a setting a customer owns, not a promise the vendor makes.

Both steps are popovers, so the chapter's single figure must sit on the first step per the kind-branched figure rule. One illustration, generated in the established OPEN collage register.

## Testing

Following the demo's existing coverage, all in node:

- **The REST layer** — `demoRestResponse` returns a well-formed `TagActivityResponse` for the analytics path and `null` for anything else, including near-misses. Pure function, no DOM.
- **Time-relativity** — rows generated for a window ending today fall inside it; rows for a window a year hence also fall inside it. This is the test that would have caught the hardcoded-date defect.
- **Determinism** — the same window twice yields identical output.
- **The disclosure** — the chapter's visitor-facing copy states the figures are illustrative. This joins `tour.test.ts`'s existing invented-content register.
- **Chapter integrity** — the existing suite already covers route allowlisting, figure placement, word caps, auto-advance and confidentiality; the new chapter must satisfy all of it unchanged.
- **Cross-references** — inserting at slot 11 moves `contact` from 11 to 12. Any `Kapitel N` reference must still resolve, which the digit-boundary guard now checks properly.

Manual verification: a walkthrough of both screens in a demo-mode build, confirming the charts render with data rather than an empty axis.

## Risks

- **The date window is the sharp edge.** If the fixture and the UI's default lens disagree about the window, the chart is empty and nothing fails loudly. The time-relativity test exists for exactly this and should be written first.
- **Invented figures next to real ones.** Eleven chapters of real data followed by one of invented data is a credibility risk if the disclosure is quiet. It belongs in the copy a visitor reads, not in a caption.
- **Scope creep into the product.** The temptation will be to adjust an analytics component that renders awkwardly with fixture data. That is out of scope; if a screen looks wrong, report it rather than changing product code to flatter the demo.

## Open

- The exact team split behind the €400 is an authoring decision for the plan, not a design one.
- Whether `/analytics`'s lens controls (dimension, measure, range pickers) behave sensibly against a fixture is unknown until it renders; if one is visibly broken, the chapter should avoid pointing at it rather than the product being changed.
