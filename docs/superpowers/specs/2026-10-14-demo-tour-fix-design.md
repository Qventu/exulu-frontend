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

**Acceptance.** No English string on any of the 37 screens except product names and file names; `€` on `/analytics` and `/budgets`; the wizard shows one Zurück/Weiter pair; `/transcriptions` lists the 20 recordings the copy counts (16 rows plus the in-progress and failed strips; the cancelled one is counted, not listed); relative dates on `/data` read "vor N Tagen" with N < 60.

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

## Clarifications 2026-10-15 (sub-project 4)

- The retrieval card renders only after the whole turn has finished streaming (`!streaming` gate) and `computeContextSearchData` never reads the part's `state`; "searching" is therefore its own branch in `ContextSearchResults`, keyed on `state !== "output-available"`, and the demo also shows the result as soon as it lands rather than when the stream closes. The non-demo expression is unchanged.
- The "CTA inline" on the closing scene is a new `ContentBlock` kind `cta`, rendered only when `DEMO_BOOKING_URL` is set (still empty — Daniel supplies it); the panel footer's CTA logic is unchanged.
- The closing scene carries no figure: the tour allows one illustration per chapter and chapter 12's sits on its opening step; the three pilot numbers are the close's visual.
- `kosten.webp` remains a byte-copy of `ch5-evals.webp`; generating it needs the OpenAI key and is outside this programme's plans.
- Chapter 6's chat replays no search (only the memory write), so the search beat is a chapter-5 feature.
- The scene page's side padding is 16 px (was 32 px): beside the 420 px panel the content column is 764 px wide, and the opening figure cleared 480 px only with the narrower gutter.

## Clarifications 2026-10-15 (sub-project 5)

1. **Roles, not teams.** `AGENT_RBAC_TEAMS_SUPPORTED` is `false` because the backend's `RBACData` has no `teams` field; a teams-shared agent would show a capability the product does not have. The assistant is shared with the role "Techniker" (`lib/demo/fixtures/roles.ts`); the section's summary reads "Mit 1 Rolle(n) geteilt."
2. **The approval step is `email.3`**, appended after the runs step, not swapped in at `email.1`: "einer wartet auf einen Menschen" is the setup and the card is its payoff. 37 − `meetings.1` + `kosten.1` + `email.3` = 38, the acceptance count.
3. **Which run waits.** The export's waiting run (0ffccf21, "WG: DEMANDE DE DEVIS") and the scripted session's run (f74bb00b, completed) swap *state* in the fixture mapping, so "Sitzung öffnen" on the one waiting run lands on the one session with a pending approval. Every other field stays as exported; the 14/8/2/1 distribution is unchanged.
4. **The part shape**, confirmed from the AI SDK's `DynamicToolUIPart` union and the session's stored message 9: the pending part (`tool-Send_Email_Reply`, `state: "approval-requested"`, `input`, `approval: { id }`, no `output`) is added to the session's last assistant message — the assistant that just took the third correction asks to send the corrected quote.
5. **`region: "eu"`**, not `"europe-west3"`: `ProviderLogo` renders its EU pill only for the literal `"eu"`. The Google Cloud region is each row's tag.
6. **The models cost cell** now uses the existing `models.cost.perMillion` message with the amount from `spendCurrency()`: identical output for the product (`$1.25/M`), `2,00 €/Mio.` in the demo. A product fix, tested for the non-demo string.
7. **Copy follows the screen.** `zugriff.0` and `memory.3` are reworded because an agent's access section is not an item's and a base row is not an item row; `memory.3`'s count is computed from the fixture.
8. **No `#access` hash** in the route: `hrefFor` appends `?tour=` to the route string. The anchor plus `scrollBlock: "start"` scrolls, as `config.0` does.
9. **Off-rails limit, not fixed:** the approval card's buttons send through the demo transport, which replays the techdoc script for a chapter without one. The tour is on rails; ALFREDO has no script.

## Sub-project 6 — Du-Form und Marketing-Feedback (2026-10-15)

**Decision (Daniel, 2026-10-15):** the tour addresses the visitor as *du*. Marketing's review of the 6 October texts (`OPEN-IMP-Demo-Texte.docx`, 37 steps, 135 fields) is adopted as the baseline wording; the earlier rule "German, Sie-form" (Goals, SP3 overlays) is superseded by this section for every string the demo owns. Product UI strings in `messages/de.json` are a product matter and stay as they are (mixed; mostly Sie).

**Register.**
- The visitor as a person: *du / dein / dir / dich*, lowercase. Imperatives in du-form: "Sieh zu", "Öffne", "Schau".
- The visitor's company and what belongs to it: *euer / eure* ("euer Posteingang", "eure Mitarbeiter", "eure Handbücher", "euer Serviceteam", "eure Zahlen"). *dein* only for what the visitor does or sees in the tour ("deine Korrektur", "dein Team" when the visitor is addressed as the one who configures).
- Never *Sie / Ihnen / Ihr(e)* in a tour string. Real product data (chat answers, transcripts, run rows) is untouched, as the review document's own rules say.

**Which texts change.**
- Every field with a "Neuer Text" in marketing's document is applied, adjusted to the register above. Five are corrected where they contradict the screen, each with the reason recorded in the plan: 5.1 (the replay is paced — "ein echter Austausch, so wie er stattfand", not "Real-Geschwindigkeit"); 6.2 (the stored answer is an honest miss, so "unvollständig", not "falsch"); 7.5 (a setting, not learning); 9.3 ("Läufe", shown, not "Routinen gespeichert"); 4.2 ("ohne dass" without the comma).
- Every field marketing left empty keeps its wording but switches register where it contains Sie-form.
- Steps rewritten since 6 October (4.1 access section, 6.4 memory base, 9.4 approval card, 10.1 computed counts, 11.2 models, 12.2 closing scene) get du-form versions of their current copy.
- The 12 chapter goals (SP2), the five scenes (`lib/demo/scenes.ts`), the three overlay strings with Sie-form (`KNOWLEDGE_LIBRARY.description`, `EMPTY_STATES.knowledgeItems.description`, and the "nicht Teil der Demo" notice in `components/demo/demo-unavailable.tsx`) switch register. `MEMORY_OVERVIEW` (SP5's Sie overlay of a du-form product string) is removed with its test.
- Decided with the register: 1.1 says "technischen Unternehmen"; 12.2 reads "zwei Wochen Setup-Zeit" (stat label "Setup-Zeit", not "echte Fragen eures Serviceteams"); 7.1 and 7.2 drop the counts as marketing wrote them; 10.1 keeps its computed counts and the failed recordings (the chapter's credibility device) under marketing's softer title.
- Cross-references ("Kapitel 5/6/7") are re-checked against the order; numbers that fixtures determine stay computed (`germanCount`, `meetingTally`, `MEMORY_COUNT_AFTER_CORRECTION`).

**Automated rules.** The walker's du-form deny rule is removed; a Sie-form check over the panel's and the scenes' text replaces it (`Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres|Ihrerseits`, sentence-initial included — the check is strict, tour copy phrases around it). `lib/demo/chapters/index.test.ts` gains the same check over every title, goal, content block and scene block; `overlays.test.ts` asserts du-form instead of Sie-form. The honesty register in `tour.test.ts` keeps Beispielwerte, the claim-phrase prohibition (now `SAVINGS_CLAIM` in `lib/demo/register.ts`, in every register) and the client-name rule; the "keine Einsparung" presence test goes with the step (second batch below).

**Sign-off.** The copy export (`scripts/export-demo-copy.ts`) after the change is the sign-off sheet for Daniel, Doro and marketing; the plan lists only the deviations from marketing's wording.

**Acceptance.** Walker 38/38 on Daniel's build with the new Sie-check and zero leaks; suite green; no tour string contains Sie-form; every "Neuer Text" from the document is either applied or listed as a deviation with its reason.

**Second batch of notes (Daniel, 2026-10-15), decided for this sub-project:** the model catalogue shows the platform's breadth (sixteen rows across Google, Anthropic, Mistral, OpenAI over Vertex AI, AWS Bedrock and Azure; a self-hosted open-weight model; an auto-router; embedding, OCR and rerank utilities — the agent editor's selector sees chat rows only); chapter 11 ends on control ("Ihr behaltet die Kontrolle über die Kosten") and loses the "Keine Einsparung wird hier behauptet" step — the rule that no text may *claim* a saving stays as a prohibition; chapter 12 is one closing scene carrying the references as logo cards (wordmarks until the logo files exist), the three numbers and the ask; every scene step gets a one-sentence lead so the panel beside a scene is never bare; scene bullet lists render as statement cards. The tour is 36 steps. **Abstracting product references** (FST, 2XT, article numbers, the AHT/Giehl wording in the ALGI session) is sub-project 7 with its own section.

## Sub-project 7 — Abstraktion der Produktreferenzen (2026-10-15)

**Why.** NEW Lift and ALGI consented to their deployments being shown, generalised. The fixtures still carry their product identifiers verbatim — NEW Lift's controller family (FST, FST-2, FST-2XT, FST-3, the FSM2 module, the EAZ-TFT display) in document names, ticket titles, chat answers, memory items, eval cases and the chunk export; ALGI's cylinder sizes (AZK 90…350, AZKBZ 110), seal-kit types (DISA-…), twelve article numbers, a commission number and, inside the stored session text, "AHT Alfred Giehl GmbH & Co. KG". A prospect who reads closely, or a customer who sees the demo, must not find their catalogue in it. Scheme (Daniel, 2026-10-15): invented identifiers of the same shape, so the screens stay believable.

**Mapping.** One ordered table in `lib/demo/fixtures/pseudonyms.ts` (exported, reviewable, the way the redaction scripts' rules are):
- NEW Lift: `FST-2XT → KS-2XT`, `FST-2 → KS-2`, `FST-3 → KS-3`, bare `FST → KS`, the lowercase/joined forms in file names (`fst2xt → ks2xt`, `fst2 → ks2`, `FST2XT → KS2XT`, `FST3 → KS3`, `FSTBugFixes → KSBugFixes`), `FSM2 → SM2`, `EAZ-TFT`/`EAZTFT → DP-TFT`/`DPTFT`. Kept as industry terms: ADM, SHK, UCM, Nothalt COP, LSU (Laufzeitüberwachung), MIPA, CAN-to-LON, Zendesk ticket ids (TC…).
- ALGI: `AZKBZ → HKB`, `AZK → HK` (every size), `DISA → DS` with the type infixes `SAZK → SHK`, `HAZ → HHA`, `AZR → HR`, `AZM → HM`, `AZ → HA`; six-digit article numbers `1xxxxx → 4xxxxx` (prefix swap, consistent across the session); commission `G47490 → G58301`; `AHT Alfred Giehl GmbH & Co. KG → AHT Hydraulik GmbH`, bare `Giehl → Hydraulik`. The assistant's name "ALFREDO_2 - Der clevere Ersatzteilspezialist" stays (an internal name, not a product).
- `ALGI` inside fixture text outside chapter 12 (a ticket title in chapter 5 reads "Mit ALGI den Antrieb neu eingestellt") becomes `AHT`, the pseudonym chapter 9 already uses. The reference customers' names stay where the spec allows them: the chapter-12 scene and `lib/demo/brand.ts`.
- The chunk export `chunks-fst2xt-de.json` is renamed `chunks-ks2xt-de.json` (two imports).

**Mechanism.** A one-off script, `scripts/pseudonymise-fixtures.mjs`, applies the table to every `.ts` and `.json` under `lib/demo/fixtures/` (string content; comments keep their provenance wording) and renames the chunk file; its output is committed and the script stays in the repo as provenance, next to the three `build-algi-*-fixture.py` scripts. No runtime substitution: the originals must not ship in the bundle at all.

**Guard rails.** `lib/demo/fixtures/pseudonyms.test.ts` reads every fixture file (JSON whole; TS with comments stripped) and the chapter, scene and overlay modules, and asserts none of the ORIGINAL_TOKENS patterns (the left-hand sides above, plus `Giehl`, `AZKBZ`, the twelve article numbers, `G47490`) matches — the only files exempt are `pseudonyms.ts` and the scripts. The walker's deny list gains the same originals over `main` text. The chunk-count and citation tests that pin document names (`software-docs`, `techdoc-turns`, `memory-turns`, `evals`) are updated to the new names, not loosened.

**Not changed.** Real numbers that are not identifiers (chunk counts, durations, dates, run states), the redacted staff placeholders (⟨Kundenkontakt⟩, ⟨ALGI Vertrieb⟩ → becomes ⟨AHT Vertrieb⟩ by the ALGI rule), the illustrations (generated, no product text), and the agent names.

**Acceptance.** Pseudonyms test green on every fixture and copy file; walker 36/36 with the originals in the deny list; on Daniel's build the chat answer in chapter 5 cites `mia_ks2-2s_2015-05_de.pdf` and names KS-2XT, chapter 6's memory items read KS-2XT, chapter 9's session shows HK-110, DS-T-HK-110, 4xxxxx article numbers and "AHT Hydraulik GmbH"; no original token is on any of the 36 screens.

## Sub-project 8 — Wachstum, Inhalt, Plattform, Abschluss (2026-10-15)

Five notes from Daniel after walking the 36-step tour, decided as follows.

**1. Chapter 6 gains the memory map (`memory.4`).** Route `/memory/newton_memory_context` (already allowlisted as a descendant of `/memory`), the base shell's default "Overview" tab, which renders `ContextMapCard` with `timeline`. Anchor `data-demo-id="memory-map"` on the card root (`components/widgets/context-map/context-map-card.tsx`, beside its `data-testid`). Data: the four real memories stay; **about sixty example memories** (German, the product's register: menu paths, fault patterns, standards, customer processes) spread over eight weeks in four topic regions are added for this base only, marked as such — the step's copy says the map shows example entries, the way chapters 8 and 11 mark their numbers (`tour.test.ts`'s register gains the sentence). Positions are fixture data: `ContextMapTopics` returns four centres, `ContextMapPoints` returns one point per memory with deterministic coordinates clustered around its topic (seeded, no runtime randomness), `createdAtMs` from the memory's `createdAt`, `group` = the memory's type; `ContextProjectionStatus` returns `fitted: true` with matching counts. The base page's other operations (`MemoryBaseById`, `MemoryBaseContributors`, `MemoryConflicts`, `MemorySourceSession`, `MemorySourceMessages`, `${context}MemoriesPagination`, `ContextMapEdges`, `ContextMapItem`) are answered so the page logs nothing. **Autoplay:** `ContextMapCard` gets a product-neutral prop `timelineAutoplayMs?: number`; when set and the data is in, the window's `to` thumb sweeps from the first day to the last over that many milliseconds once, then the window clears (honouring `prefers-reduced-motion`: no sweep). The base shell passes it in demo mode only (`isDemoMode() ? 6000 : undefined`). The walker waits out the sweep on that step. Chapter 6 keeps `MEMORY_WRITTEN_AT_STEP` intact (the new step is last).

**2. Chapter 9 shows what a run is about.** `email.2` keeps the runs list but with the waiting run's row **expanded**: `RoutineRunsList` reads a `?run=<id>` search param to seed `expandedId` (a small product deep link; the route page already carries the param through), and the step's route is `/workflows/${ALGI_ROUTINE_ID}?run=${APPROVAL_RUN_ID}` with the anchor on the expanded row (`data-demo-id="routine-run-open"` on the expanded panel). Copy: the volume, not the failures ("25 Anfragen in zwei Wochen, von selbst bearbeitet; eine davon ist geöffnet"). A new `email.3` opens the same session as the approval step but at the **top** — anchor `chat-messages`, `scrollBlock: "start"` — with copy on the inbound request and the first draft ("Worum es geht"); the approval card becomes `email.4`. Chapter 9 has five steps.

**3. Chapter 10 states the platform.** `meetings.0` (the list) loses the hours in the title and says what the product does with meetings: transcripts from Teams, Google Meet and Zoom, audio recordings of on-site meetings with speaker attribution, and rights that show a transcript only to the right people. `meetings.1` (the document) adds that a transcript can be handed to one of the company's assistants automatically — summaries, follow-up mails, tickets and more — and keeps "entstand von Hand" for the document on screen. The computed counts stay available (`ALGI_MEETING_TALLY`) but are no longer in the title.

**4. Chapter 11 makes usage visible.** `kosten.0` is retitled "Mach die KI-Nutzung sichtbar": which team, project or user uses AI most, which models work best, how that develops over time. The "Beispielwerte" callout stays.

**5. The closing scene carries the offer; the call to action is on every step.** No customer names on the last step for now (the `logos` block is removed from the scene; `lib/demo/brand.ts` and the chapter-12 rule stay for later). Two paths, worded as Daniel gave them: **Weg 1 — 3 Monate unverbindlich testen**, 600 € im Monat (−50 %), Setup zwei Tage nach Beauftragung, beliebig viele Dokumente, Transkripte und Besprechungsaufnahmen, keine Systemanbindung, variable Kosten mit 20 % Aufschlag abgerechnet; **Weg 2 — in drei Schritten zum vollwertigen IMP**: Planungsgespräch, Anbindung an eure Systeme und Import eurer Daten, produktive Instanz innerhalb von zwei Arbeitstagen. Layout: variant A (side by side, one shared button) or B (stacked, test first, two buttons) — Daniel's pick in the visual companion. A new `ContentBlock` kind `paths` renders the two cards (title, optional price line, bullet or numbered list). The panel footer shows a persistent text link "Planungsgespräch buchen" on **every** step when `DEMO_BOOKING_URL` is set (the panel already reserves the CTA slot for the last step); the walker's keyboard count allows it. Without the URL neither the link nor the button renders — the URL is the one external input. *Decided 2026-10-15: layout A with variant B's texts; URL set (HubSpot "kostenlose Erstberatung"); one button and the panel link both read "Kostenlose Erstberatung buchen"; no path highlighted.* *Amended 2026-10-16: HubSpot's scheduling pages read tracking parameters but do not prefill form questions from the URL, so every booking link carries `utm_source=open-imp-demo`, `utm_medium=kapitel-NN-<step id>` and a `utm_campaign` (`lib/demo/booking.ts`). Each path has its own button to the same page — "Testphase anfragen" sends `probe-3-monate`, "Planungsgespräch buchen" sends `vollwertig` — and the panel link and the closing step's button send `tour`. The scene's shared button is gone. HubSpot writes the values to the contact's Quelle / Medium / Kampagne der letzten Buchung im Meetings-Tool; the two labels await sign-off.*

**Honesty.** Example memories are declared on screen; the offer's numbers are Daniel's; no savings claim enters chapter 11 (the `SAVINGS_CLAIM` test); client names stay out of the closing scene for now.

**Acceptance.** Walker 36 + 2 = **38 steps** (memory.4, email.3), zero leaks, keyboard reach unchanged; the memory map renders with ≥ 60 points in four regions and the slider sweeps once on entry; the expanded run row and the session's top are on screen on their steps; the closing scene shows the two paths and, once the URL exists, the button and the panel link on every step; suite green; copy exported for sign-off.
