# Demo tour — one docked panel

**Date:** 2026-09-14
**Status:** approved, ready for an implementation plan
**Supersedes parts of:** `2026-09-03-demo-narrative-rebuild-design.md` (presentation layer, motion model)

## Why

The tour presents itself two different ways. Twenty-five steps are Shepherd
popovers floating over a dimmed page; four are full-bleed scenes that replace
the page entirely. Daniel, after walking the deployed demo with OPEN's
marketing lead on 2026-09-14:

> "I dont like that we switch the tour style all the time.. it feels like its
> stuck together and buggy (sometimes tooltips, sometimes full page)."

It is not only a matter of feel. Almost every defect that walkthrough surfaced
traces to the overlay:

- The tour menu was unclickable whenever the agent wizard was open. Radix sets
  `pointer-events: none` on `<body>` for its modals; the floating menu
  inherited it and silently swallowed every click.
- The same menu walked itself 160px up the wizard panel, because its collision
  probe found interactive elements under every corner and had nowhere to escape
  to.
- Source citations could not be clicked, because Shepherd's overlay covers
  everything the current step has not cut a hole for.
- A dim layer was left stranded on screens whose anchor had unmounted.

Each of those was fixed individually on `fix/demo-walkthrough-feedback`. All of
them exist because a floating layer and the product are competing for the same
space. Removing the competition removes the class.

## Goals

- One presentation for all 37 steps. Nothing switches mode.
- The panel is part of the layout, not on top of it. No overlay, no z-index
  contest, no pointer-events inheritance.
- Short statements by default; detail on request.
- The product stays legible and scrollable, and is never operable.

## Non-goals

- Rewriting the narrative. The twelve chapters, their order and their argument
  are unchanged.
- Changing the fixtures, resolvers or the demo's data layer.
- Reinstating auto-advance. It was removed on 2026-09-14 and stays removed.
- Making the product itself responsive to a narrower viewport beyond what it
  already does. Where a product screen reflows badly at ~1060px, that is
  recorded, not fixed here.

## The layout

`app/(application)/layout.tsx:184` currently renders:

```jsx
<main className="grow flex min-w-0 w-full">…</main>
{demoMode && <TourOverlay />}
```

`<main>` already carries `grow` and `min-w-0`, so it shrinks correctly the
moment it has a sibling competing for width. The change is to wrap both in a
flex row:

```jsx
<div className="flex grow w-full min-w-0 md:flex-row flex-col">
  <main className="grow flex min-w-0">…</main>
  {demoMode && <TourPanel />}
</div>
```

- **Desktop (`md` and up):** panel is `flex-none w-[380px]`, `w-[560px]` while
  expanded. Content takes the rest.
- **Below `md`:** the row becomes a column. Content is on top, the panel docks
  underneath at `max-h-[45vh]` with its own internal scroll.

Nothing is `position: fixed`. This was checked rather than assumed: on desktop
the only fixed full-width product elements are the mobile top bar and the
mobile sidebar drawer, both `hidden` at that breakpoint, so nothing product-side
escapes the flex row. On mobile the top bar is `inset-x-0 top-0`, which does not
contend with a bottom dock.

`TourOverlay` is mounted at exactly one place (`layout.tsx:212`). Its docblock
claims it is "mounted in BOTH layouts"; that is stale, left from when
`/demo/tour` existed, and gets corrected.

## Interaction model

**The product is not operable during the tour, but stays readable.**

A capture-phase listener on the content wrapper calls `preventDefault()` and
`stopPropagation()` for `click`, `pointerdown`, `mousedown`, `keydown` and
`submit`. It does **not** touch `wheel`, `touchmove` or `scroll`.

Deliberately not `pointer-events: none`, which would also kill scrolling and
text selection. That matters concretely: chapter 5's answer is ~1300px of prose
in a ~700px viewport, and the marketing lead's complaint at 06:03 was that she
tried to scroll it and could not. Freezing the page would make that permanent.

The content wrapper also takes `cursor: default` so nothing advertises a click
that will not happen.

**Anchoring.** Twenty-five of the 37 steps name an element (`anchor:
"knowledge-contexts"` and so on). That data is kept. Instead of dimming the page
and cutting a hole, a `TourRing` component draws an outline around the target
and scrolls it into view. The ring is `position: absolute` inside the content
area, follows the target via `ResizeObserver` plus a scroll listener, and is
itself `pointer-events: none`. When the anchor is absent it renders nothing —
the step still reads, it just does not point.

## Step model

Four fields are removed and one is added:

```ts
export type DemoStep = {
  id: string;
  route: string;
  anchor: string | null;
  title: string;
  lead?: string;             // NEW — always visible, ≤ 20 words.
                             // Optional ONLY because the German is written by
                             // its owners, not here; see "Copy" below.
  content: ContentBlock[];   // unchanged shape; now the "Mehr" body, ≤ 90 words
  cta?: { label: string; href: string };
};
```

- `kind: "stage"` — gone. Those four steps become routes (below).
- `size: "wide"` — gone. Panel width is constant; expansion is the "Mehr"
  state and nothing else.
- `noDim` — gone. Nothing dims.
- `advanceAfterMs` — already removed on 2026-09-14.
- `cta` — unchanged. One step uses it (`contact.ts:37`).

`ContentBlock` itself is untouched: `paragraph`, `bullets`, `callout`, `stat`,
`figure`, `sequence`. Current usage across the tour is 38 paragraphs, 11
figures, 3 callouts, 1 bullets, 1 sequence, 1 stat.

**The word cap changes deliberately.** Today popovers are capped at 45 words and
stages at 90. One cap of 90 now applies to every step's `content`, which is a
loosening for the 25 former popovers. That is intentional: the cap existed
because the text sat on top of the product and had to be read at a glance, and
`content` is now behind a click in a panel that is not covering anything. The
tight constraint moves to `lead`, where it belongs.

**Panel states.** Collapsed shows chapter label, title, `lead`, `Mehr`, and the
navigation. Expanded additionally renders `content`, and widens to 560px on
desktop or grows the bottom dock on mobile. The expansion is per-step and
resets on navigation — a visitor who wants detail asks for it each time rather
than opting into a verbose mode.

**The chapter menu moves into the panel.** It is currently a separate floating
bubble, and that bubble is what broke against the wizard dialog. Folding it in
retires the failure mode rather than fixing it again somewhere new.

## Scenes become routes

Four steps have no product screen behind them: `daten.0`, `daten.1`,
`aufnahme.2` (the PDF walked page by page) and `zugriff.1`. They exist because
no product screen shows "your data is an unstructured mess".

They become real pages at `/demo/szene/[id]`, rendering their figure, stat and
prose across the full content area, with the panel docked beside them exactly
as everywhere else. The route is added to `lib/demo/supported-routes.ts`.

**The app shell stays visible on these steps.** An earlier mockup hid the
sidebar for scenes; that is reversed here. Hiding it would reintroduce precisely
the mode-switch this spec exists to remove, and chapter 1 is where a visitor
first meets the product chrome in any case. Flagged as a reversal of an earlier
sketch so it is a decision rather than a drift.

## The wizard dialog

Chapter 7's four steps drive the agent editor's wizard through
`?wizard=sources`, `?wizard=routing` and so on. That wizard is a Radix dialog
portaled to `<body>`, so it escapes the flex row and covers the full viewport,
panel included. This is the one place where "identical layout on every step"
does not fall out of the structure for free.

**Primary approach:** while the tour is active, expose the panel width as a
custom property on `:root` and inset portaled dialog content by it, scoped to
demo mode so no other deployment is affected.

**Fallback if that proves fragile against Radix internals:** render the wizard
non-modally in demo mode. That is a product change and needs its own review, so
it is the fallback rather than the plan.

This is the single highest-risk item in the spec and should be built early, not
last — if the fallback is needed, everything downstream of it is affected.

## What is retired

- `shepherd.js` and its stylesheet. This also removes the ~3.5s dynamic-import
  chunk fetch measured on `/evals` over a throttled link.
- `components/demo/tour-shepherd.tsx`
- `components/demo/tour-stage.tsx`
- `components/demo/tour-bubble.tsx` (its menu moves into the panel)
- `lib/demo/shepherd-step.ts` and its tests

`components/demo/chat-question-into-view.tsx` stays — the stick-to-bottom
problem it solves is independent of how the tour presents itself.

## Copy

Each step needs one new `lead`: a single sentence that can stand alone. That is
37 lines of client-facing German, which belongs to Daniel and OPEN's marketing
lead, not to this implementation.

They are already editing `IMP-Demo-Texte.csv` (97 rows, one per text field). A
`Kurzfassung` column is added to that sheet so the leads are written in the same
pass rather than becoming a second round. **Implementation must not invent
them.** Steps ship with `lead` absent until the sheet comes back; the panel
falls back to the step title alone, and a test lists which steps are still
waiting rather than failing the build.

This follows the rule this project already operates under: signed-off German is
never changed or authored by an implementer without its owner.

## Testing

**Node (`environment: "node"`, no DOM)** — the existing pattern holds, because
content stays pure data:

- every step has a non-empty `title`; `lead` is either absent or ≤ 20 words
- `content` stays ≤ 90 words
- every `route` is in the `isDemoSupported` allowlist
- every non-null `anchor` exists as a `data-demo-id` in the codebase
- every step that used to be a stage now resolves to a scene route
- the register asserting disclosure and no-savings copy is unchanged
- a reported list of steps still missing a `lead`

**Browser (Playwright, session scratchpad, not a project dependency)** — the
walker written on 2026-09-14 already visits all 37 steps and screenshots them.
It is extended to assert, per step:

- the panel is present and has non-zero width
- the content area and the panel do not overlap (the property the whole spec is
  about, asserted directly from bounding rects)
- the ring is present exactly when the step has an anchor
- a click inside the content area changes nothing
- a wheel event inside the content area still scrolls
- no element in the document overlays the panel

That last one is what would have caught the wizard-dialog problem automatically,
and it is why it is a per-step assertion rather than a spot check.

## Risks

- **Product screens at ~1060px.** The analytics charts, the evals grid and the
  agent wizard were laid out for a full window. Some will reflow badly. The
  walker screenshots every step, so this is visible rather than discovered in a
  client demo — but it may generate its own follow-up work.
- **The wizard dialog**, above.
- **Mobile is genuinely less tested.** The demo has been walked on desktop
  throughout. A bottom dock at `45vh` leaves little room for a chat transcript.
- **The leads are a dependency on other people.** The fallback to title-only
  keeps the branch shippable meanwhile, but the demo is not finished until they
  land.

## Open

- Panel widths (380/560) are a starting point, not a measured choice. Worth one
  pass against the real screens once it exists.
- Whether the ring needs a label or a pointer for anchors that sit far from the
  panel. Deferred until it can be looked at.
