# Demo tour fix — design

**Date:** 2026-10-14
**Status:** approved in chat, ready for implementation plans
**Supersedes parts of:** `2026-09-14-demo-docked-panel-design.md` (panel states, copy cap), `2026-09-03-demo-narrative-rebuild-design.md` (chapter 4 surface, chapter 9 steps)
**Review this implements:** artifact "IMP Demo Tour Review", 2026-10-14 (walk of main @ 596186d, production demo build)

## Why

The tour's story and data are sound, but on the only path a prospect takes — clicking Weiter — it fails in eight of 37 steps and, at step 30, resets to chapter 1 over an empty page. On the remaining steps the docked panel shows one headline over ~700 px of nothing, the product screens underneath speak to developers in English, and nothing on screen moves except the two chat steps. Daniel, 2026-10-13: "its not really easy to understand, feels like it doesn't capture everything the platform can do and overall feels like its unfinished."

Five sub-projects, built in order. Each ships on its own and is gated by the walker.

## Goals

- A visitor who only clicks Weiter sees all 37 steps, each with the screen its copy describes.
- The full explanation of every step is visible without a second click.
- Every claim in the copy is backed by what is on screen beneath it.
- Product screens the tour visits read as German, Sie-form, OPEN-branded sales surfaces.
- The tour shows the platform areas the whitepaper promises: access control, the human approval gate, memory, models.
- The walker catches a product refactor that breaks a step before a prospect does.

## Non-goals

- Changing product behaviour for non-demo deployments beyond three small fixes that are correct everywhere (redirect keeps the query string, tab follows the URL, incomplete citation markers hidden while streaming).
- Light mode, Poppins/Playfair, the booking URL itself (Daniel supplies it; the code already renders the CTA when it is set).
- Page-level citations, an AI firewall, a Wartungsbericht chapter — not in the product.
- Rewriting signed-off chapter copy. New German strings are drafted by the implementer and signed off by Daniel and Doro before launch (decision 2026-10-14); existing copy is edited only where this spec names the sentence.

## Decisions

| # | Decision | Alternatives rejected |
|---|---|---|
| D1 | The panel shows `content` by default; the "Mehr" toggle is removed. `lead` stays optional and, when present, renders between title and content. | Writing 37 leads first (blocks on copy); auto-extracting the first sentence (reads as a cut). |
| D2 | Same-route steps refetch by calling `client.reFetchObservableQueries()` whenever `?tour=` changes, from a component mounted inside the demo `ApolloProvider`. | Remounting the page by position (skeleton flash, scroll loss); threading the position into every query's variables. |
| D3 | The search beat is a transport delay (hold after the tool-input chunk) plus a demo-only "searching" state in the Context_Search renderer, which today renders nothing until the turn finishes. | Faking reasoning with text chunks. |
| D4 | The demo sidebar lists only the routes the tour visits, filtered in `groupsFor`. The command palette is filtered the same way. | Dimming inert entries; hiding the sidebar (a mode switch, the thing the docked panel exists to avoid). |
| D5 | The approval gate is shown where it exists: the run's chat session with a tool-approval card. The product has no approve/reject UI for routine runs (`waiting_approval` is a display state). | Inventing a run-detail page. |
| D6 | New German product strings for the demo live in `lib/demo/overlays.ts`, read through `isDemoMode()` at the few product call sites named below. | Adding demo strings to the shared message catalogue (every deployment would carry them). |
| D7 | Spend renders as EUR with `de-DE` in demo mode through one `spendCurrency()` helper; fixture values are unchanged (they are declared example values on screen). | Converting fixture numbers. |
| D8 | Relative dates stay consistent by shifting every ISO timestamp the demo link returns by `now − DEMO_EPOCH` (`2026-08-27T09:00:00Z`, the fixture capture day). | Freezing `Date.now` (misses date-fns call sites); a `now` prop on `RelativeTime` (five formatters, two of them date-fns). |

## Sub-project 1 — Rails

The tour must survive its own navigation.

**Chapter 10 route.** `lib/demo/chapters/meetings.ts` steps `meetings.1` and `meetings.2` route to `/transcriptions/review/${ALGI_MEETING_ID}` (already admitted by `supported-routes.ts` as a descendant of `/transcriptions`). The fixture row for `ALGI_MEETING_ID` in `lib/demo/fixtures/algi-meetings.json` gets `status: "awaiting_review"`, because `review/[jobId]/page.tsx:112` returns `null` for `saved` jobs and `:119` rejects anything but `awaiting_review`/`reviewed`. `transcriptPublishState` then resolves `draft`, which is what the review page expects. `GetProjects` (issued by `TranscriptDocument` via `useProjectOptions`) gets a resolver returning an empty `projectsPagination`.

**Legacy redirect keeps params.** `app/(application)/transcriptions/page.tsx:136-140` replaces to `/transcriptions/review/<id>` carrying every other search param. Correct for all deployments: a bookmarked `?review=…&something` should not lose `something`.

**Refetch on step change.** New `components/demo/step-refetch.tsx` (`DemoStepRefetch`): `useApolloClient()` + `useSearchParams().get("tour")`; on change after mount, `void client.reFetchObservableQueries()`. Mounted in `app/(application)/authenticated.tsx` inside `<ApolloProvider>` when `demoMode`, wrapped in `<Suspense fallback={null}>` (useSearchParams rule). The link already answers from `getWorld(getCurrentPosition())`, and `TourProvider` writes the position synchronously during render, so by the time effects run the refetch sees the new world.

**Tabs follow the URL.** `app/(application)/evals/[id]/page.tsx`: an effect sets `activeTab` from `?tab=` whenever the param changes. Manual tab switching is untouched because the effect only runs on param change. Pure helper `tabFromParam(raw) → "results" | "testCases"` in `app/(application)/evals/[id]/tab-param.ts`.

**Anchor lands.** `config.0` gets `scrollBlock: "start"`. `components/demo/tour-ring.tsx` re-scrolls the anchor once when a settle-window measurement finds its rect entirely outside the viewport (the editor's sections above it grow after first paint and push it down). Pure helper `isOutsideViewport(rect, viewportHeight)` in `lib/demo/ring-geometry.ts`.

**Last step.** `components/demo/tour-panel.tsx` computes `isLast = nextPosition(chapters, position) === null` and renders no Weiter on it. With `DEMO_BOOKING_URL` set the CTA renders as today; without it only Zurück. Pure helper `footerControls({ hasCta, isLast })` in `lib/demo/panel-controls.ts`.

**Walker.** `scripts/walk-demo.mjs` gains a Weiter-driven mode (default) that, after each click, waits until the panel `<h2>` equals the next step's title (20 s) and fails the run otherwise; when the step declares an anchor, it asserts the ring is at least 16 × 16 px and intersects the viewport. `scripts/dump-demo-steps.ts` emits `title`. The direct-load mode stays behind `WALK_MODE=direct`.

**Acceptance.** Walker passes all 37 steps in Weiter mode on a production demo build at 1440 × 900. `struktur.2` shows seven bases; `aufnahme.1` shows four documents; `evals.2` shows the Testfälle tab; `config.0`'s ring is in view; `meetings.1` shows the review page with the transcript; `contact.1` has no Weiter.

## Sub-project 2 — Panel

**Content by default (D1).** `tour-panel.tsx` renders, in order: chapter header, chapter rail, title, optional lead, `StepPanel` content, footer. `expanded`/`menuOpen` state for content goes; the chapter menu keeps a toggle. Panel width 420 px collapsed; the 380/560 triplication in `tour-panel.tsx`, `globals.css` `--tour-panel-w` and the `data-demo-panel-expanded` attribute collapses to one width.

**Chapter rail.** Twelve segments under the header, the current one in `--primary`, past ones in `--muted-foreground`, each a button that jumps to that chapter (replacing the hidden menu as the primary affordance; the text menu stays for titles). Below the rail, the chapter's goal in one line from a new `DemoChapter.goal: string` (required; all twelve ship with the panel; German, drafted by implementer, signed off).

**Reveal.** The title-and-content block is a `motion.div` keyed on `position`, `initial {opacity 0, y 6}`, `animate {opacity 1, y 0}`, 250 ms, disabled under `prefers-reduced-motion`.

**Keyboard.** The tour overlay is rendered before `<main>` in `app/(application)/layout.tsx` and placed last by `order-last` on the panel, so Tab reaches the panel first; `ContentInert` stays. (Amended 2026-10-14 from `inert` on `<main>`: an inert subtree is excluded from hit-testing, which would stop the chat's inner scroller from responding to the wheel.)

**Register.** The panel's header carries the OPEN wordmark line; callouts and the active rail segment use `--primary`; a step's figure renders at the top of the content column at full panel width.

**Acceptance.** On `struktur.1` the panel shows title and paragraph with no click; 37 steps have no "Mehr"; Tab reaches Weiter in ≤ 4 presses; the walker's "panel title after Weiter" assertion still passes.

## Sub-project 3 — Demo overlays

**`lib/demo/overlays.ts`.** Exports `CONTEXT_DISPLAY_NAMES` (id → German name, from `fixtures/contexts.ts`), `TOOL_LABELS` (`Context_Search` → "Wissenssuche", `Create_Newton_Memory_Item` → "Gedächtnis-Eintrag gespeichert"), and `EMPTY_STATES` for the four empty states the tour visits (knowledge list, knowledge items, evals list, routine runs), each `{ title, description, action?: null }`. All strings German, Sie-form, drafted here and marked for sign-off in the plan.

**Call sites.** `app/(application)/data/...` list and items empty states, the `/data` page subtitle; `components/ai-elements/response.tsx:431` chip label and `components/message-renderer.tsx` retrieval card title use `CONTEXT_DISPLAY_NAMES[context] ?? humanised id`; the tool-card title uses `TOOL_LABELS[name] ?? name`. Each site is a one-line `isDemoMode()` branch beside the existing one in `response.tsx:580`.

**Fixtures.** Eval set, run and case names in `fixtures/evals.ts` become German. `fixtures/algi-meetings.json` loses the ten test, untitled and vendor-training rows; `meetings.0`'s title and body read the counts from `ALGI_MEETINGS.length` and `ALGI_MEETING_HOURS` (the sentence changes from "28 Besprechungen … Drei abgebrochen, eine fehlgeschlagen" to the computed truth, signed off). `agent-editor.ts` summary reflects seven knowledge bases. The routine row's "Noch nie ausgeführt" is answered by `lastRun` in `RoutinesPagination`.

**Currency (D7).** `lib/spend-currency.ts` exports `spendCurrency(): { currency: "USD" | "EUR"; locale: string }`, `EUR`/`de-DE` when `isDemoMode()`. Used by `lib/budget.ts:110` and the four analytics components (`kpi-strip.tsx:35`, `trend-chart-card.tsx:45`, `donut-view.tsx:43`, `ranked-list.tsx:48`).

**Wizard.** `globals.css`: under `body[data-demo-tour="active"]`, `[data-demo-id^="agent-wizard-"] + div` (the footer) and `[role="dialog"] > button:last-child` (the close) get `display: none`.

**Dates (D8).** `createDemoLink` post-processes resolver output through `shiftDemoDates(data, offsetMs)` (`lib/demo/date-shift.ts`), which walks the object and adds the offset to strings matching ISO-8601 timestamps. `fetchGraphQLServerSide` applies the same. `DEMO_EPOCH = "2026-08-27T09:00:00.000Z"`.

**Streaming markers.** `components/ai-elements/response.tsx` `parseIncompleteMarkdown` strips a trailing `{item_name:` fragment without a closing brace.

**Acceptance.** No English string on any of the 37 screens except product names and file names; `€` on `/analytics` and `/budgets`; the wizard shows one Zurück/Weiter pair; `/transcriptions` lists 18 recordings and the copy matches; relative dates on `/data` read "vor N Tagen" with N < 60.

## Sub-project 4 — Motion

**Search beat (D3).** `lib/demo/chat-transport.ts` takes `holdAfterToolInputMs` (1800) and `holdAfterToolOutputMs` (600). `components/message-renderer.tsx` `ContextSearchResults`: in demo mode, when `state` is `input-available` and there is no output, render a card with the search icon, "Durchsucht sieben Wissensbasen …" and the shimmer; the existing `!streaming` gate is relaxed in demo mode so the card appears when output arrives rather than when the turn ends. `fixtures/techdoc-turns.ts` `RETRIEVAL_STEPS` become `{ text: German, source: original }` with the renderer reading `text`.

**List fills.** `app/(application)/data` list and items table rows get a demo-only staggered entrance (`motion.tr`, 60 ms per row, 240 ms each) keyed on row id, so a refetch that grows the list animates the new rows.

**Scenes.** `globals.css` `.demo-scene .demo-block-figure { max-height: 520px }`, `.demo-scene .demo-stat-value { font-size: 3.5rem }`, `.demo-scene .demo-block-callout { font-size: 1.1rem }`. `daten-pile` becomes the opening frame: figure, stat, one line. A new scene `contact-close` carries the references and the three-number pilot offer with the CTA inline; `contact.1` routes to it.

**Acceptance.** `techdoc.0` shows a searching state for ≥ 1.5 s before the first answer text; trace lines are German; `struktur.2`'s rows enter staggered; the opening scene figure is ≥ 480 px tall at 1440 × 900.

## Sub-project 5 — Chapters

**Access.** `sections/access.tsx` gets `data-demo-id="agent-access"`; `fixtures/chapter-techdoc.ts` AGENT becomes `rights_mode: "teams"` with the Technik team; `zugriff.0` routes to `/agents/edit/demo-agent-newton#access` with that anchor; its body (existing paragraph) stays.

**Approval (D5).** `fixtures/chapter-email.ts` exports `ALGI_SESSION` (an `AgentSession` for `ALGI_SESSION_ID`, agent `ALGI_AGENT_ID`); `resolvers.ts` `scrollbackRows` serves `ALGI_SESSION_MESSAGES` for that id and `GetAgentById`/`GetAgentSessionById` resolve `ALGI_AGENT`; the last assistant part is a tool call in approval-requested state so `ToolCallApproval` renders. `email.1` routes to `/chat/${ALGI_AGENT_ID}/${ALGI_SESSION_ID}` with anchor `chat-tool-approval` (added to `tool-call-approval.tsx`). The exact part shape is confirmed from a stored message before the fixture is written.

**Memory.** `/memory` joins `DEMO_SUPPORTED_ROUTES`; `MemoryBases` returns the memory context with usage from `chapter-memory.ts`; `memory-overview.tsx` gets `data-demo-id="memory-bases"`; `memory.3` routes there.

**Models.** `/models` joins the allowlist; `GetLiteLLMCatalog` returns four rows (two Gemini, one Mistral, one Claude via Vertex EU) with `region: "europe-west3"` and per-million prices; `litellm-catalog-view.tsx` gets `data-demo-id="models-catalog"`; chapter 11 gains `kosten.1` "Welches Modell, wo gehostet" between the analytics and budgets steps.

**Chapter 10.** `meetings.1` (raw transcript) is removed; chapter 10 is list → document.

**Acceptance.** Walker passes 38 steps; each new screen renders its data; the sidebar filter (D4) lists exactly the routes the chapters visit.

## Testing

Node (`vitest`, no DOM): every pure helper above has a test; `supported-routes.test.ts` asserts no step route carries the legacy `review` param; `demo-meetings.test.ts` asserts the chapter's meeting passes the review page's guards; `apollo-link.operations.test.ts` gains `GetProjects`, `MemoryBases`, `GetLiteLLMCatalog`; `chapters/index.test.ts` asserts the German-only rule for fixture names it already scans.

Browser (`scripts/walk-demo.mjs`, Playwright outside the repo): Weiter mode is the gate for every sub-project; run against `next build` + `next start`, never a cold dev server.

## Risks

- `reFetchObservableQueries` refetches every active query on every step; on the agent editor that is six queries. Acceptable (fixtures answer synchronously).
- The approval-card part shape is the one unverified assumption; its task starts with a read of a stored message.
- Date shifting changes absolute dates on the evals matrix headers and the routine trigger ("Zuletzt empfangen"); they stay internally consistent.
- Copy sign-off is a dependency on people; every new German string is listed in the plan's final task for one review pass.

## Clarifications 2026-10-14 (sub-project 3)

- D4 (sidebar and palette allowlist) was implemented in sub-project 3, not 5. The allowlist is a static set in `lib/demo/nav-routes.ts`, tested against `CHAPTERS` in both directions, so the shell never imports the chapter modules; sub-project 5 extends it when `/memory` and `/models` get chapters.
- `EMPTY_STATES` covers the two empty states that render on the Weiter path (knowledge library on `struktur.0`, knowledge items on `aufnahme.0`). The evals list and routine runs are populated by fixtures since sub-project 1.
- The agent editor's "0 Wissensdatenbanken" was already "7 Wissensdatenbanken" on the current build (October's `EditorContexts` resolver); no change was needed.
- Tool-card status labels are hardcoded English in `components/ai-elements/tool.tsx` with no i18n key; the demo shows a German table (`TOOL_STATUS_LABELS`). Translating them product-wide is a follow-up outside this programme.
- "Schulung Alfredo" and "KI Agent - Schulung Alfredo" stay in the meeting list: ALFREDO is ALGI's own spare-parts agent (chapter 9). Eight rows were removed (test, untitled, catch-up), not ten; chapter 10's title and count sentence are computed from the fixture (`meetingTally`).
- German retrieval trace lines belong to sub-project 4 with the search beat.
- Also fixed here, beyond the section's list: the routine row's last run (`GetJobResults` answers the routines list's label filter from the real runs) and an outside-click guard so the wizard sheet survives a click into the tour panel.
