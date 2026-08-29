# Demo tour — independent review findings

Review of the nine-chapter guided tour (`?tour=<chapter>.<step>`), walked end to end
in Chrome as a prospect would: all 29 steps, via the **Next** button, plus fresh
direct loads of individual steps to separate transition bugs from step bugs.

- **Branch:** `feat/demo-real-chat-surface`
- **Date:** 2026-08-29
- **Environment:** `NEXT_PUBLIC_DEMO_MODE=true`, dev server on `:3000`, Chrome, dark
  theme (default) and light theme, viewport 1800×941
- **Brief:** [demo-tour-review-brief.md](./demo-tour-review-brief.md)

---

## Verdict

**Not ready to show a prospect.** Not because the content is weak — the content is the
strongest thing about it — but because on the exact path the tour tells people to take
(clicking **Next**), it visibly breaks in at least seven places, and the single most
credibility-critical interaction in it fails with a raw error.

The story lands. The delivery is unfinished. Most findings below are presentation
failures sitting on top of good material, which is the cheap kind of problem to have.

### Launch blockers

| # | Finding | Where |
|---|---------|-------|
| B1 | Citation drill-down fails with an error; destructive action exposed | `techdoc.2` |
| B2 | Popover renders off-screen / absent — tour looks dead | `config.0`, `email.1`, `email.2`, `memory.1`, `techdoc.0` |
| B3 | Wrong drawer panel on 3 of 5 steps when walking with Next | `config.2`, `config.3`, `config.4` |
| B4 | Invented eval scores presented as measured, with no visitor-facing disclosure | `evals.*` |
| B5 | Closing step is a dead end — only a "Back" button | `contact.0` |

Everything else is polish and can follow.

---

## B1 — "Open one to check it" returns an error

**Severity: blocker. This is the worst finding in the review.**

`techdoc.2` reads:

> **Every claim, sourced** — The answer cites the documents it came from. **Open one to check it.**

Clicking the `Software Documentation Context - … #1` citation opens a modal containing:

```
FST2XTchanges-customer-DE.docx
Chunk 02d50a8f-e703-4461-9c0c-5ab6c695cdfd not found in context software_documentation_context.

Key           Value
Item name     FST2XTchanges-customer-DE.docx
Item ID       d92dd3f2-2803-41e4-8136-a1a0ccb99e6c
Chunk ID      02d50a8f-e703-4461-9c0c-5ab6c695cdfd
Chunk index   0
Context       software_documentation_context

⚠ Deactivating archives this item globally — it will no longer appear in any
  user's chat or search results.
[ Deactivate this source ]
```

Three separate problems in one modal:

1. **The lookup fails.** No document text is shown — only an error and a GUID.
2. **The whole premise is being tested at exactly this moment.** The tour's thesis is
   "it's real, verify it." You explicitly invite verification, and verification errors out.
   This is worse than having no citations at all.
3. **A destructive global admin action is offered to an anonymous visitor.**
   "Deactivate this source" archives the item for every user. It should not be reachable
   in demo mode. (I did not click it.)

**Root cause:** `lib/demo/resolvers.ts` has no resolver backing the chunk lookup, so the
component falls into its not-found branch at
`components/ai-elements/response.tsx:530`.

**Fix:** back the chunk lookup with a fixture (the chunk text exists — see F3), and hide
`Deactivate this source` in demo mode. If neither is feasible before launch, delete the
words "Open one to check it."

---

## B2 — The tour does not scroll its anchor into view

**Severity: blocker.**

Steps whose anchor sits below the fold render their popover below the fold too. The tour
never scrolls the anchor into view, so the visitor lands on a page with **no popover
anywhere** and reasonably concludes the tour is broken.

Measured at `email.2` on a **fresh load** (not a transition):

```
anchor  [data-demo-id="routine-runs"]  top: 2524
popover                                top: 2303
viewport height                        941
window.scrollY                         10.5
Back / Next                            inViewport: false
```

The popover is a screen and a half below the fold. The visitor sees the routine's
*Basics* form and nothing else.

Confirmed by screenshot at:

| Step | Symptom |
|------|---------|
| `config.0` | Next off-screen for **15.4s**, never settled (`maxUnusableMs: 15448`, `settledAfterMs: null`) |
| `email.1` | No popover visible at all |
| `email.2` | No popover visible at all (fresh load, measured above) |
| `memory.1` | No popover visible at all on transition |
| `techdoc.0` | Popover clipped below viewport; Next 62px under the fold |

Scrolling manually recovers it, so the popover is not lost — it is simply never brought
into view.

### B2b — Non-deterministic top-left pinning

A separate placement failure on the `/demo/tour` chat route: the popover pins to the
**top-left corner of the viewport, straddling the left sidebar** and covering nav items,
instead of anchoring to its target.

Observed at `memory.0`, `memory.1`, `memory.2` (three consecutive steps — chapter 5 is
effectively broken visually) and intermittently at `techdoc.0`. Placement is **not
deterministic**: I saw `techdoc.0` render correctly anchored to the composer once, and
pinned top-left twice, with no change in inputs.

At `memory.0` and `memory.1` the probe reported `target: null` even though
`[data-demo-id="chat-composer"]` was present in the DOM at `top: 845, h: 65, inView: true`
— the anchor exists but Shepherd did not attach to it.

**Note:** `[data-demo-id="chat-tool-trace"]` (the anchor for `memory.2`) is **absent from
the DOM** until the tool call renders. `lib/demo/shepherd-step.ts:66-70` already carries a
comment noting "this branch has already shipped two anchors that pointed at nothing" —
this is a recurrence of a known class.

---

## B3 — Chapter 4 shows the wrong panel on 3 of 5 steps

**Severity: blocker.**

Walking with **Next**, the agent-editor wizard does not switch tabs. The deep link only
takes effect on a full page reload.

| Step | URL says | Drawer shows | Copy describes |
|------|----------|--------------|----------------|
| `config.2` | `?wizard=routing` | **Sources** | five routing rules |
| `config.3` | `?wizard=vocabulary` | **Sources**/Routing | 55 glossary terms |
| `config.4` | `?wizard=behavior` | **Sources**/Routing | passes, reranker, give-up threshold |

The visitor walking with Next sees the same knowledge-base checkbox list three times with
changing captions, while the popover floats over the dimmed dead space on the left,
anchored to nothing.

**Consequence:** the 55 glossary terms, the routing rules and the behaviour settings are
never seen on the intended path. This also moots the open question of whether showing all
55 terms is boring — currently nobody reaches them.

On a fresh reload all three panels render correctly and the content is excellent (see
"What is genuinely good").

---

## B4 — Invented eval scores are not disclosed to the visitor

**Severity: blocker. Highest-consequence integrity issue.**

The brief states both knowingly-not-real things are disclosed in the copy. **The evals
one is not.** The disclosure exists only as a source comment:

```ts
// lib/demo/tour.ts:259-263
// The questions and the suite structure are real; the SCORES are not, and
// cannot be — scoring a case means executing a run against a live model.
// See the note in fixtures/evals.ts. The narration below is written to
// demonstrate the mechanism and deliberately claims no measured result.
```

I walked all four evals steps. No visitor-facing copy indicates the scores are
illustrative.

The claim that the narration "deliberately claims no measured result" **does not hold**.
`evals.2` states:

> The earlier run **misses the terminology question badly** and **drags the suite average
> below its pass threshold**.

That is a claim about a measured outcome. It sits beside concrete numbers (58.0, 73.7,
90.0), real timestamps ("Aug 20, 2026 · 11:00"), a named model ("gemini-3.1-pro") and an
agent id — every signal on screen says these are real measurements.

Contrast with the meetings disclosure, which is exemplary and should be the template:

> Every other screen in this tour came out of a live system; this one document we drafted
> by hand, because ALGI has not run this step yet.

**Fix:** give evals an equivalent one-line disclosure. Also note the pass threshold
referenced in the copy is not shown anywhere on screen.

---

## B5 — The closing step is a dead end

**Severity: blocker.**

`contact.0` renders with a **single "Back" button**. No finish, no dismiss, no CTA.

> **See it on your own documents** — Want a demo running on your own example documents?
> Or to talk through which agents would actually earn their place in your business?

The empty `DEMO_BOOKING_URL` is known and accepted. The absence of *any* forward control
is not covered by that: after twelve minutes the prospect is asked a direct question and
given nothing to click. This is the conversion moment of a lead-generation asset.

It is also the only chapter opener with no illustration (`img: null`), which reads as
unfinished.

---

## Misleading content

Grouped separately because the brief flags this as the most serious class.

### M1 — Numbers that contradict the screen

| Step | Copy says | Screen shows |
|------|-----------|--------------|
| `meetings.1` | "**Six people**, interrupting each other" | **4** speakers — Arbeitsvorbereitung, Geschäftsführung, Konstruktion, Fertigung (verified in both the transcript body and the speaker-chip inputs) |
| `evals.0` | "what happens to the other **ten thousand**" | **3** test cases, one click later |
| `ingestion.1` | "real timestamps: **read at 22:35:01**, searchable seventeen seconds later" | "3mo ago" — the string `22:35` appears nowhere on the page |

The `ingestion.1` timestamp is genuinely backed by the fixture
(`lib/demo/fixtures/item.ts:55-56`, processed 22:35:01 → embedded 22:35:18 = 17s), but
the UI relativises it, so the precise claim cannot be checked by the visitor. That is a
poor fit for a chapter whose thesis is "nothing here is a black box you have to trust."

`meetings.1`'s "six people" is simply wrong and a sceptic can count.

### M2 — Claims whose evidence is present but never shown

A recurring pattern: the tour asserts something verifiable and points at a collapsed or
absent artifact.

- **`ingestion.2`** — "The manual is split into 93 passages… **These are the real ones.**"
  points at a **collapsed** accordion (`expandedChunkRows: 0`) reading
  "Embeddings · 93 chunks · 3mo ago". Expanding it manually reveals excellent real German
  source text (`**FST2XT Software Änderungs Historie**`, `### 1) Totmann-Türzu im
  Normalmodus`). **Auto-expanding this accordion is the highest value-per-line fix in the
  review.** The `?section=embeddings` deep link does not expand it.
- **`techdoc.1`** — "The assistant decides which knowledge bases to search, and **shows
  its work**" points at a collapsed "Context search results… 1 context · 1 item · 1
  chunks" panel. Nothing is shown. The "7 reasoning steps – show details" trace is also
  collapsed and never opened.
- **`email.3`** — "**Inside one of those runs**, a salesperson corrects the draft three
  times…" The run is never displayed; the screen shows the routine's Basics form.
- **`meetings.2`** — describes a generated work instruction ("check the release, do not
  infer ventilation from whether the cabin has a door…") that is **not rendered**; the
  screen still shows the raw transcript.

### M3 — "Live production setup" contradicted on the same screen

`config.0` asserts:

> This is the same editor Newlift uses — and everything on the next few screens is their
> **live production setup**.

The screen behind it shows **Model: "Select a model"** and **Category: "Select a
category"** — both empty placeholders. A production agent with no model selected is not
credible. `email.1` has the same problem with an empty routine Description.

### M4 — `memory.3` contradicts `memory.2`

`memory.2` shows the memory item being written ("Create Newton Memory Item — Completed").
`memory.3` then lists that item — "FST-2XT Kalibrierfahrt Menüpunkt" — as
**"Updated 7mo ago"**. The two consecutive steps contradict each other.

---

## Copy

### C1 — Verbs promise motion that does not happen

This is the honest cost of the (correct) decision to open chapters mid-conversation.

- `techdoc.0` — "**Watch** how the assistant finds it." The answer is already fully
  rendered. Nothing streams.
- `memory.1` — "**Send** the correction." The composer is empty; there is nothing to send
  and no way to send it.

Keep the design decision; change the verbs. "Watch how the assistant finds it" →
"Here is what it found, and where it came from." Zero cost, removes the false promise.

### C2 — Three competing chapter numberings

A visitor sees all three:

1. `intro.0` — "**Seven** things, about twelve minutes" (content chapters, excluding intro
   and contact)
2. Tour badge — "**1 of 9**" (all chapters)
3. Cross-references — a third scheme again:
   - `email.3` — "**Chapter 4** argued corrections should be first-class." Corrections are
     `memory`, which the badge calls **5**.
   - `ingestion.1` — "the document that answered **chapter 1**" means `techdoc`, which the
     badge calls **2**.

Pick one scheme and use it everywhere.

### C3 — Sentence length

Mostly excellent, plain, engineering-toned prose. Two sentences run long enough to lose a
reader:

- `intro.0` — the ~60-word middle sentence ("You will see an assistant answer a hard
  question and show its sources, where that knowledge came from, how it is configured and
  corrected, how it is tested, and two jobs it does with nobody watching.")
- `email.2` — the four-clause run ("Twenty-five real runs. Fourteen finished, eight
  failed, one is waiting for a human — and two were refused outright, because a hosting
  provider's setup notice is not from their domain.")

No jokes that misfire; no marketing register. Tone is right for the audience.

---

## Layout, polish and correctness

| ID | Finding | Where |
|----|---------|-------|
| P1 | Popovers cover the element they describe — panel headings in the config drawer; the entire "Test case" name column at `evals.3` | `config.1-4`, `evals.3` |
| P2 | `evals.1` and `evals.2` are the same screen with the same anchor and near-identical framing — reads as a stall | `evals.1`, `evals.2` |
| P3 | Highlighted element is not the interesting one — `techdoc.0` spotlights the empty composer while the cited answer sits above it | `techdoc.0` |
| P4 | Glossary definitions truncated by drawer width ("Aufzugswärterschaltschrankmodul (Zusatzmodul im Schaltsc…") | `config.3` |
| P5 | Popover flush to viewport top edge (`top: 0`), covering the page header | `meetings.0` |
| P6 | Quota widget renders "**17h 16m 6s of 0s used (0%)**" — the element `meetings.0`'s "Seventeen hours" headline draws from | `/transcriptions` |
| P7 | Pluralisation bug: "1 context · 1 item · **1 chunks**" | `techdoc.0/1` |
| P8 | App header brands itself "**AI Studio**" while `intro.0` says "a working **Exulu** deployment" | global |
| P9 | Stale `.shepherd-element` nodes accumulate in the DOM (observed up to 4) instead of being torn down | global |
| P10 | Cold-load popover appears after **17–31s**; during the wait the assistant avatar shows broken-image alt text before `onError` hides it | `intro.0` |
| P11 | Eval score contrast 3.13–3.79:1 in light mode — below the 4.5:1 AA bar `CLAUDE.md` requires | `evals.*`, light |
| P12 | Console not clean: `[demo] unmapped GraphQL operation: GetPrompts` every load, plus Apollo `addTypename` / `onCompleted` / `useLazyQuery` deprecation warnings | global |

### On the avatar (P10)

`components/logo.tsx` points at `${configContext.backend}/logo_*.png`, which resolves to
`http://localhost:9001/logo_light.png` — not served. The `onError` handler hides it
correctly, so this self-heals; but on a cold load the alt text
("Technical Documentation Assistant") renders as a grey block for several seconds first.
The comment at `components/logo.tsx:32-35` anticipates exactly this case; the handler just
fires later than first paint.

---

## Response to the arguments in the brief

The brief asked for disagreement on five decisions. Verdicts:

**1. Chapters 1 and 5 opening mid-conversation — right call, incomplete execution.**
Every step working for a click-only visitor is correct for a HubSpot-sourced lead; losing
the live stream is an acceptable trade. But the copy never followed the decision (C1).
Keep the design, fix the verbs.

**2. All 55 glossary terms — keep them; the length genuinely is the point.**
The alphabetical wall of `ABS/Absinkschutz`, `ADM/Außenrufmodul`, `AKM`, `ASM`, `ASV`,
`AUX`, `AWE`, `AWM`, `CBM/CBM2`, `CMM`, `DMS`, `DMT`… is domain data nobody would
fabricate. It was the most convincing evidence in the tour that the deployment is real.
Two caveats: definitions are truncated (P4), and per B3 nobody currently reaches them.

**3. The illustrations do not look cheap — I disagree with the worry.**
They read as technical line drawings and sit correctly below the real screens in visual
weight. They are the least of the tour's problems. One inconsistency: `contact.0` has none
while every other chapter opener does.

**4. Showing failures works — it is the strongest credibility move in the tour.**
Eight failed runs among 25, with real ALGI addresses (`ersatzteile@`, `technik@`,
`service@`, `vertrieb@`, `info@algi-hydraulic.de`) and German subjects
("WG: Anfrage", "WG: Angebotsanfrag…", "Ersatzteil anfrage"), read as operational reality
rather than a fixture. Arithmetic verified: 14 + 8 + 1 + 2 = 25 ✓, and the DOM confirms
8 `Failed` / 14 `Completed`. Keep all of it. The only problem is B2 — the popover is
off-screen, so the visitor reaches the failures by accident if at all.

**5. The intro as a tour step rather than a landing page — I would change this.**
Not for the expected reason. The first impression currently depends on hydration timing
(P10): 17–31 seconds of a chat screen with a broken avatar before the popover appears. A
static opening frame would fix that and would also give you somewhere to put the evals
disclosure (B4).

---

## What is genuinely good

Worth stating plainly, because most findings above are presentation failures over strong
material:

- **`memory.0` is the best moment in the tour.** An explicit "the documents do not contain
  this" with citations, in German, refusing to invent an answer. For a sceptical service
  engineer this does more than any feature claim. It deserves better placement than a
  popover jammed into the top-left corner.
- **Claims that check out.** I verified each of these against the screen:
  - 9 ingested documents (`ingestion.0`) ✓
  - 93 chunks for `FST2XTchanges-customer-DE.docx`, consistent between the item list and
    the detail page ✓
  - 7 knowledge bases across 3 distinct read modes — Documents & manuals, Conversations &
    tickets, Structured records — with "Newton's memory" as the seventh ✓
  - 5 routing rules, written as plain sentences ("The question is related to a specific
    product, system or part, asks for things like dimensions, error codes,
    specifications") ✓
  - 25 runs = 14 + 8 + 1 + 2 ✓
  - 28 saved meetings, 3 cancelled ✓
  - "A regression is a red cell" — 58.0 renders `rgb(248,113,113)`, genuinely red ✓
- **The ALGI meeting transcript** with speaker labels, timestamps and `⟨Kunde⟩` redaction
  is convincing, and the redaction is a good unforced signal about handling customer data.
- **The meetings disclosure** is a model of how to be honest without undercutting yourself.
- **Light mode is properly theme-aware** — colours swap to darker variants
  (`amber-600`, `green-600`) rather than reusing dark-mode values.

---

## Coverage and caveats

All 29 steps walked in Chrome, console monitored throughout, light mode re-checked.
Two honest limitations:

- **Narrow viewport remains untested.** The browser window resized (`outerWidth` changed)
  but the page viewport stayed pinned at 1800×941, so the layout never reflowed. I
  approximated by constraining document width, under which the 320px popover covers a
  large share of an ~820px layout and does not reposition — but that is a signal, not a
  verified result. **This still needs checking on a real narrow window.**
- **Two claims I made and then corrected during the review**, recorded so they are not
  re-litigated:
  - I first reported no red cell in the eval matrix. Wrong — 58.0 is
    `rgb(248,113,113)`. I had misjudged a compressed screenshot.
  - I first reported that "three were cancelled" was unsupported. Wrong — the DOM contains
    three `Cancelled` statuses; the visible labels had cycled through "Queued…".

A methodological note for anyone re-running this: measuring popover position with
`document.elementFromPoint` is unreliable here, because the Claude-in-Chrome extension
injects a full-height overlay (`.redeviation-bs-fullHeight`) that intercepts hit-testing.
Use `getBoundingClientRect` against the viewport instead, and select the live popover by
computed `display`/`hidden` rather than by DOM order — stale popovers persist (P9) and
`querySelector('.shepherd-element')` returns a hidden one.

---

## Suggested order of work

1. **B1** — back the chunk lookup with a fixture; hide `Deactivate this source` in demo
   mode. (Or, as a stopgap, delete "Open one to check it.")
2. **B2** — scroll the anchor into view before showing the popover; make placement
   deterministic and centre the popover when the anchor is missing rather than pinning
   top-left.
3. **B3** — make the wizard deep link respond to in-page navigation, not only reload.
4. **B4** — add a one-line disclosure to the evals chapter, matching the meetings wording.
5. **B5** — add a forward control to `contact.0` (and the illustration).
6. **M2** — auto-expand the embeddings accordion at `ingestion.2` and the retrieval panel
   at `techdoc.1`. Cheapest credibility win available.
7. **M1 / C1 / C2** — fix "six people" → "four", reconcile chapter numbering, change
   "Watch"/"Send" to match what actually happens.
8. Everything in the polish table.
