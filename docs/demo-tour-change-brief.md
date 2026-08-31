# Demo tour — change briefing

Based on a full browser walkthrough of the tour on `feat/demo-real-chat-surface`
(all 27 steps, chapter menu, skip links, deep-link replay, console). The tour's
story arc works and chapters 2–3 (live question → refusal → correction → visible
memory write) are the strongest part — nothing below changes the structure of
that. This briefing covers what must change before the tour goes in front of a
lead.

Decision taken: **the tour is German.** All visitor-facing tour text is to be
written in German, not translated word-for-word from the current English copy.

Priorities: **P0** = blocks publishing. **P1** = a sceptical prospect will
notice. **P2** = polish.

---

## 1. German tour (P0)

The product content (questions, answers, documents, transcripts) is already
German; the tour copy, chrome and chapter titles are English. Everything the
visitor reads becomes German:

- All 27 step titles and bodies.
- Chapter titles in the Tour bubble menu (9 entries).
- Tour chrome: `Next` / `Back` / `Start over`, `Skip to <chapter> →`,
  the `Tour` bubble label, `1 of 9 · 2/3` progress format.
- Register: **Sie**, not du — the audience is technical directors and service
  engineers evaluating a purchase. (The demo agent's chat answers currently use
  "du" — see open decisions, §8.)
- This is a rewrite, not a translation: keep the benefit-led, concrete,
  slightly dry tone of the English originals. The strongest headlines should
  keep their punch. Suggested renderings as a starting point:

| Current | Suggested German |
|---|---|
| Seven chapters, about twelve minutes | Neun Kapitel, rund zwölf Minuten |
| A question with a precise answer | Eine Frage mit einer präzisen Antwort |
| Retrieval, in the open | Die Suche, offen gezeigt |
| Every claim, sourced | Jede Aussage mit Quelle |
| When it doesn't know, it says so | Wenn es etwas nicht weiß, sagt es das |
| The correction becomes a memory | Aus der Korrektur wird Gedächtnis |
| Nobody uploaded these | Niemand hat diese Dateien hochgeladen |
| The whole assistant is configuration | Der ganze Assistent ist Konfiguration |
| Routing, in plain language | Routing, in ganzen Sätzen |
| Teaching it your language | Er lernt Ihre Sprache |
| The part nobody demos | Der Teil, den niemand vorführt |
| Including the ones that did not work | Auch die, die schiefgegangen sind |
| Seventeen hours nobody has time to re-listen to | Siebzehn Stunden, die niemand nachhören wird |
| See it on your own documents | Sehen Sie es mit Ihren eigenen Dokumenten |

- While rewriting, drop the remaining AI jargon: "Retrieval" as a headline term,
  "embedded separately", "fine-tuned" — describe the benefit, not the mechanism.
  Also fix the unclear image in evals.1 ("a cell below the bar turns red" →
  "fällt eine Antwort unter die Schwelle, wird die Zelle rot").

## 2. De-attribution of Newlift and ALGI (P0)

Premise rule from the original brief: generalized but realistic elevator data;
the lead is never told which companies it comes from. The current tour names
them seven times in copy and several times in fixtures.

### 2a. Copy — remove all seven mentions

| Step | Current copy | Direction |
|---|---|---|
| intro.0 | "real screens, real customer data, from Newlift and ALGI" | "echte Oberflächen, realistische Daten aus der Aufzugsbranche" — no names, and do not claim "real customer data" |
| ingestion.0 | "pulled straight from Newlift's own storage" | "direkt aus der Dateiablage eines Steuerungsherstellers" |
| ingestion.3 | "When Newlift publishes a revision" | "Erscheint eine neue Revision, …" |
| config.0 | "the same editor Newlift uses — their live production setup" | drop the claim entirely; sell "kein Feintuning, kein Code" on its own |
| evals.1 | "questions Newlift engineers asked" | "Fragen, die Servicetechniker wirklich gestellt haben" |
| email.0 | "This is ALGI, who build hydraulic elevator systems — a second deployment, not a second demo" | keep the two-deployment story without the name: "ein zweiter Einsatz beim Hersteller hydraulischer Aufzugssysteme" |
| meetings.0 | "Twenty-eight of ALGI's own meetings" | "28 echte Besprechungen eines Herstellers" |

### 2b. Fixtures — the data itself leaks attribution

- **Document preview (legal, most urgent):** the "Every claim, sourced" step
  invites the visitor to open a citation. The preview shows the raw
  `FST2XTchanges-customer-DE.docx` headed *NEW Lift Steuerungsbau GmbH*, full
  address, phone/fax, and a copyright notice forbidding reproduction without
  written permission. Replace the preview content with a redacted/generalized
  version of the document (keep the structure — version numbers, change notes —
  strip letterhead and copyright block).
- **ALGI email addresses:** `*@algi-hydraulic.de` allowed-sender chip and
  `vertrieb@algi-hydraulic…` in the run row → fictional domain, e.g.
  `*@hydraulik-aufzuege.example` or an invented company domain.
- **Transcript titles:** "Kickoff Termin KI Agenten für ALGI im IMP" and
  "Dritte Termin KI Agenten für ALGI im IMP" are the vendor's own sales-project
  meetings about this very deployment — a meta-leak. Rename to plausible
  internal meetings (Produktionsbesprechung, Serviceschulung, …).
- **"Zendesk Context" citation chips** → rename the context to
  "Support-Tickets" (removes tool branding and reads better in the story).
- The transcripts already anonymize the end customer as ‹Kunde› — that is the
  pattern to follow everywhere.
- **Case studies get their proper home instead:** per the original premise,
  Newlift and ALGI may appear as named case-study cards/statistics in a
  dedicated beat (chapter 1 or chapter 9), clearly separated from the demo data.
  See open decisions, §8.

## 3. Chapter-count copy bug (P0)

intro.0 says "Seven chapters, about twelve minutes" and shows **seven** elevator
icons; there are **nine** chapters and the bubble says "1 of 9". Fix the count
in the rewritten German copy and add two icons (or make the illustration
count-agnostic).

## 4. Show what the copy claims (P1)

A repeating failure in the back half: the step's star artifact is off-screen.

- **ingestion.2 "What retrieval actually searches":** the popover points at the
  Embeddings section header pinned to the bottom viewport edge; the 93 chunks
  are entirely below the fold and the visible screen is empty form fields.
  Scroll so at least the first chunks are visible above the popover.
- **email.2 "Including the ones that did not work":** copy describes 25 runs
  (14 finished, 8 failed…); zero runs are visible — the screen shows the
  test-payload JSON form. Scroll the Runs list into view, expanded.
- **meetings.2 "So point it at a prompt instead":** copy describes the
  hand-written work instruction; the screen still shows the raw transcript,
  unchanged from the previous step. Actually display the work instruction
  (side panel, modal, or a fixture document) — otherwise cut the step.
- **evals.2 "And it checks where the answer came from":** copy is about source
  requirements, but the screen shows the same Results grid as the previous step
  (partly covered by the popover). Open the Test cases tab or point at a case
  with a source requirement.
- **ingestion.3 "And it stays current":** highlights nothing; either point at
  something concrete (sync timestamp, pipeline tab) or fold the sentence into
  another step. Consider trimming chapter 4 to two steps overall (document
  list + chunks view) — see §8.

## 5. Overlay and positioning system fixes (P1)

One systemic pass rather than per-step patches:

- **Popover placement:** the popover regularly covers the content it narrates —
  the streamed answer's tail (techdoc.0), the memory confirmation (memory.1/2),
  three rows of the memory table (memory.3), eval grid cells (evals.2), the
  "Configure knowledge" wizard title (all config steps). Rule: the popover may
  never overlap its highlighted element or the content the copy refers to;
  prefer side placement.
- **"Skip to …" link:** rendered with no background, transparently over table
  rows and buttons — illegible collisions on /data and /transcriptions (overlaps
  an Edit button and the Close button). Give it the same opaque treatment as the
  Tour bubble.
- **Tour bubble:** overlaps interactive UI on almost every page — chat send
  button, transcript Edit buttons, wizard Continue button, routing chips.
  Either reposition per page-type or add a collision offset so it sits in
  guaranteed-empty space.

## 6. Visual polish (P1–P2)

- **P1 — red slider:** "Backup-source trigger: 95 %" in the behavior wizard
  renders as a full-width saturated red track — the only vivid red in the
  product, reads as an error state. Use the accent colour.
- **P1 — chat avatar fallback:** the missing `/demo/brand/logo_dark.png`
  renders as a broken image with alt text in the chat welcome (first screen of
  the tour). The header has a wordmark fallback; the chat surface has none. Add
  one (initials avatar) so this can never happen again, independent of the
  asset landing.
- **P2 — brand leak:** the trigger page shows `X-Exulu-Signature:
  sha256=HMAC-SHA256(body, secret)` — old product name inside the OPEN IMP
  demo. Rename or mask in demo mode.
- **P2 — console noise:** `[demo] unmapped GraphQL operation` warnings —
  `GetQueue` (fires continuously via polling), `GetEvals`,
  `GetUniquePromptTags`, `GetVariablesLite`, `GetAgentsByIds`. Map them in the
  demo fixture layer or silence the poller.

## 7. Tone guardrails for the rewrite (apply during §1)

- No self-reflection beyond the two accepted disclosures (chapter 8 work
  instruction, chapter 6 scores). Currently also present in: "These are the
  real ones" (ingestion.2), "a second deployment, not a second demo" (email.0),
  "this is a real list, not a tidy one" (meetings.0), "real screens, real
  customer data" (intro.0). After de-attribution these lines must be reworded
  anyway — the copy should stop insisting on its own realness and just be
  realistic.
- Keep the honesty beats (the refusal, the failed runs) — they are the tour's
  best credibility moments for this audience.

## 8. Open decisions (need a call, not code)

1. **Case-study beat:** add a Newlift/ALGI card step (allowed by the premise) —
   in chapter 1 as social proof up front, or in chapter 9 next to the booking
   CTA? Recommendation: chapter 9, so the demo data stays unattributed while
   the close gets the references.
2. **FST / Elevision product names** in the demo content are recognizable as
   NEW Lift's product line to industry insiders. Full generalization would mean
   renaming the controller family throughout the fixtures (expensive, hurts
   realism). Recommendation: keep them once 2a/2b are done — an insider
   guessing the source is different from being told — but it's a judgement
   call.
3. **du vs. Sie in the agent's chat answers** ("solltest du…"): the tour will
   say Sie; the agent says du. Align the fixture answers to Sie, or accept the
   mismatch as "that's how the deployed agent was configured"?
4. **Trim chapter 4** from four steps to two (see §4)? Recommendation: yes —
   it is the weakest chapter and the reading load is already high.

## Known and accepted — unchanged from the test brief

Booking link on the last step (HubSpot URL pending), OPEN logo asset,
Poppins/Playfair fonts, forced dark mode, agent-editor Save not persisting,
`nav-config.test.ts` failure on main, the pre-existing eslint error, and the
two disclosed non-product artifacts (chapter 8 work instruction, chapter 6
scores).
