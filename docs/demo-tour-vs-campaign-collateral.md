# Demo tour vs. campaign collateral

Review of the guided demo tour against the two PDFs sent to LinkedIn leads before
they reach it:

- `OPEN_Whitepaper-IMP.pdf` — "OPEN IMP. KI für die Aufzugsbranche" (4pp)
- `OPEN_Whitepaper-KI-Use-Cases.pdf` — "3 Use Cases. KI für die Aufzugsbranche" (4pp)

Companion to [demo-tour-review-findings.md](./demo-tour-review-findings.md), which
covers the tour on its own terms. This document only covers **fit between the
collateral and the demo**. Cross-references like *(B1)* point at findings there.

---

## Headline

The collateral sells **three use cases**. The demo delivers **one of them well, one
partially, and one not at all** — and the single proof point both PDFs lead with
(page-precise citation) is the one thing the demo cannot currently demonstrate.

| Use case (PDF 2) | Demo chapters | Coverage |
|---|---|---|
| **01 Technisches Wissen & Service** | `techdoc`, `ingestion`, `config`, `memory` | **Strong** — but the citation promise fails |
| **02 Vertrieb & Ersatzteile → Angebot ins ERP** | `email` | **Partial** — stops before the payoff |
| **03 Wartung & Dokumentation → Wartungsbericht** | — | **None** |

Two demo chapters (`evals`, `meetings`) have no use-case counterpart at all.

The lead arrives having been promised a specific journey. Roughly half of it isn't there.

---

## 1. Contradictions — fix before the next send

### 1.1 Four product names between the PDF and the demo

> **RESOLVED.** The demo will be branded **OPEN / OPEN IMP**, matching the whitepapers.
> Implementation in [demo-open-rebrand-and-theme.md](./demo-open-rebrand-and-theme.md) §2.
> Retained below for the record.

| Surface | Name used |
|---|---|
| Both whitepapers | **OPEN IMP**, published by **OPEN Digitalgruppe**, `open.de` |
| Tour intro copy (`intro.0`) | "a working **Exulu** deployment" |
| App header throughout the demo | **AI Studio** |
| Company selling it | **Qventu** |

A lead reads a whitepaper branded *OPEN IMP*, clicks through, and lands on something
calling itself *Exulu* inside an app called *AI Studio*. Nothing on screen bridges
the three. For a sales-assisted, high-value-per-lead motion this is the most damaging
inconsistency in the campaign, and it is also the cheapest to fix.

Decide the canonical name, then make the tour's first sentence and the app header agree
with the PDF the lead just read.

### 1.2 Page-precise citation — the central promise, and the demo cannot show it

This is the most serious finding in this review.

Both PDFs make page-level citation *the* proof point:

- IMP p2 — hero stat **"Seite 214 — Zitat bis auf Seite & Tabelle"**; body: "jede Antwort
  mit der Quelle belegt: **bis auf die Seite im Handbuch**"
- UC1 headline — **"Jede Antwort mit Seitenzitat – aus 400 Seiten Handbuch"**
- UC1 step 04 — "Jede Aussage zitiert **Dokument und Seite**"
- UC1 benefit — "Zitate bis auf Seite und Tabelle. Bei sicherheitsrelevanten Anlagen
  **keine Verhandlungssache**."
- Both mocks show a green chip: `Handbuch FST-2XT | S. 214`

What the demo actually renders (citation chip text, read from the DOM):

```
tech doc context - mia_fst2-2s_2015-05_de.pdf#5
tech doc context - br_FST-2XT_2019-10_de.pdf#4
new servicedb context - TC160283 - Seit Umbau auf neue FST-2XT läßt sich keine
  Kalibrierfahrt durchführen.#1
```

That is **document + chunk index**, not document + page. There is no `S. 214`
equivalent anywhere in the citation UI.

Page numbers *do* appear — but only inside the model's prose ("Dort ist unter **Punkt
6.4 auf Seite 41** beschrieben", "unter Punkt 3.3"). That is an unverifiable model
assertion, not a citation. And when the visitor tries to verify it by clicking the
chip, the modal errors out with `Chunk … not found in context …` (**B1**).

So the claim the whitepaper calls *"keine Verhandlungssache"* for safety-critical
equipment is precisely the claim the demo (a) does not implement in the citation chip
and (b) actively fails on when tested. A technical director who reads the PDF and then
clicks one citation will find the gap in under a minute.

**Either** surface the page number in the citation chip and fix the drill-down, **or**
soften the PDFs to what the product does — "Zitat bis auf den Absatz" is still a strong
claim and is what the demo genuinely delivers (`ingestion.2`'s chunk list is excellent
once expanded).

### 1.3 AI-Firewall — sold twice, shown nowhere, and possibly not implemented

> **ANSWERED.** Guardrails are **not built yet**. They stay out of the demo until they
> ship, then get a chapter. The open question below is therefore settled — but the claim
> is still live in both PDFs and must be pulled. See
> [demo-open-rebrand-and-theme.md](./demo-open-rebrand-and-theme.md) §4.

The collateral makes this a named security feature:

- IMP p3 — **"AI-Firewall & Freigaben — Fünf Scanner vor jeder Interaktion.** Kein
  Schreibzugriff auf Ihre Systeme ohne menschliche Bestätigung."
- UC2 step 01 — "Die **AI-Firewall** prüft jede eingehende Mail zuerst – auf
  Prompt-Injection und personenbezogene Daten"
- UC2 mock — a status line reading `AI-Firewall: unauffällig`

The demo shows none of it. More concerning, the frontend records the backing field as
absent:

```ts
// app/(application)/agents/queries.ts:43-50
// Backend introspection 2026-06-12: Agent has no `firewall` field —
// selecting it crashed the detail panel and editor loader with
// "Cannot query field 'firewall' on type 'Agent'." Flag flipped to false
export const AGENT_FIREWALL_SUPPORTED = false;
```

**Caveat, stated plainly:** this proves the *per-agent firewall configuration surface*
is unbacked. It does not prove there is no firewall anywhere — a gateway-level scanner
could exist outside the Agent schema. **Someone who knows the backend needs to confirm
this before the next send.** But "fünf Scanner vor jeder Interaktion" is a specific,
countable claim aimed at exactly the sceptical technical audience this campaign targets,
and right now nothing in the product demonstrates it.

### 1.4 "Unter 15 Sekunden" is never demonstrated — and structurally cannot be

Both PDFs lead with it: IMP p2 hero stat **"<15s — Antwortzeit, auch bei komplexen
Fragen"**; UC1 benefit "Auch komplexe Fragen in **unter 15 Sekunden** beantwortet".
The mocks reinforce it with `Werkzeug: Wissenbasis durchsuchen | 0,8s`.

The demo opens every chat **mid-conversation with answers already rendered**, so no
latency is ever visible. Its equivalent panel reads `1 context · 1 item · 1 chunks` —
no timing at all.

This is a direct consequence of the (otherwise correct) decision to make every step work
for a click-only visitor. Two cheap fixes, either of which closes the gap:

- Surface tool duration in the retrieval panel, matching the PDF's `| 0,8s` treatment.
- Add the elapsed time to the tour copy at `techdoc.1` where the retrieval panel is
  already the anchor.

Ironically, the tour's cold-load takes 17–31 seconds before the first popover appears
(**P10**) — the first number a lead experiences contradicts the headline stat.

---

## 2. Gaps — promised in the collateral, absent from the demo

### 2.1 Use Case 03 (Wartungsbericht) — no coverage whatsoever

PDF 2 devotes a full page to it: merge service cases, test protocols and ticket
histories → cite every statement (Ticketnummer, Prüfdatum, Handbuchseite, Norm) →
generate a branded PDF → human approval before it goes to the operator.

The demo has nothing. The nearest thing is `meetings.2`'s generated work instruction —
and that is the one artifact the tour openly admits was **written by hand** because ALGI
has not run the step. So the use case with the most concrete deliverable in the
collateral is represented, at best, by the least-real thing in the demo.

If the report generator exists, it deserves a chapter. If it doesn't, UC3 should not be
in a PDF sent ahead of a demo.

### 2.2 Use Case 02 stops exactly before the payoff

| PDF 2 promises (UC2) | Demo shows |
|---|---|
| AI-Firewall screens the incoming mail | — |
| Part recognised from text **and attachments** (photo of the Typenschild) | — |
| Customer-specific pricing, discounts, availability from ERP (read-only) | — |
| Draft written to ERP **after human approval** — "Freigegeben durch M. Weber – Beleg 20-4471 angelegt" | — |
| | A list of 25 email runs with status badges |

The demo's `email` chapter is a *run log*. It is good material (see §4) but it
demonstrates that the routine ran, not what it produced. `email.3` even describes the
draft — "a salesperson corrects the draft three times — always offer the piston ring
with that seal kit, always quote our commission number" — while **never showing the
draft** (M2).

The emotional core of UC2 is control: *"IMP schreibt nie ungefragt ins ERP. Jede
Buchung braucht ein menschliches Ja."* The demo shows **no approval gate anywhere**.
For a buyer whose main objection is "what stops it doing something stupid in my ERP",
that is the missing screen.

Showing one opened run — request in, part identified, draft with prices, approval
button — would close most of this gap and reuse content that already exists.

### 2.3 Platform features named on IMP p3 but never visited

| Feature card | In the demo? | Note |
|---|---|---|
| **Agentic Retrieval** | ✅ | `config.0` shows the toggle plus "7 knowledge bases · 5 routing rules · memory on · reranker: cohere/rerank-v4.0-pro" — good evidence |
| **Wissenbasen** (PDF, Scans, Excel, Fotos, Schaltpläne, OCR, table structure) | ⚠️ Partial | Demo shows only `.pdf` / `.docx` / `.doc`. No scans, Excel, photos or Schaltpläne — the harder formats the claim rests on |
| **Meeting-Agent** | ✅ | `meetings` chapter; transcription with speaker labels is convincing |
| **Projekte & Teams** (Arbeitsbereiche, Rollen bis aufs Einzelobjekt) | ❌ | `/projects` exists in nav; tour never visits |
| **Budgets & Kosten** (per user/team/project/agent, auto-block at 100%) | ❌ | `/budgets` route exists (`nav-config.ts:286-292`); tour never visits |
| **AI-Firewall & Freigaben** | ❌ | See §1.3 |

Budgets and Projects both exist as routes. Two short chapters — or even one combined
"governance" step — would convert three unevidenced PDF claims into demonstrated ones
at low cost.

### 2.4 Enterprise/trust claims (IMP p4) — entirely absent

"100 % EU", "Kein Training auf Ihren Daten", "Modellaufrufe sind reine Inferenz über
ein EU-gepinntes Gateway", "Anbindung … nur lesend", "RBAC bis aufs Einzelobjekt",
"API-Keys mit Agent-Scope".

Reasonable to leave to the sales conversation — but note the agent editor already has
**Access** and **Guest access** sections that the tour scrolls past. Pausing on one of
them would evidence the RBAC claim for free.

---

## 3. Continuity and clarity

### 3.1 The worked example changes between the PDF and the demo

Both PDFs build UC1 around one scenario, repeated four times across the two documents:

> **Fehlercode 0x4F** bei einer **FST-2XT** → Schließkantenfehler der Türsteuerung →
> `Handbuch FST-2XT | S. 214` + `Ticket #4471 | gelöst`

The demo opens with a different one entirely: *"was bedeutet 'Nothalt COP' im FST
Fehlerspeicher?"*, in a chat titled **"Fault E47 on CTRL-3000"**.

Nothing is wrong with the demo's example — it is arguably better, because the answer is
richer. But a lead who read the PDF twice and arrives looking for `0x4F` will not find
it, and `CTRL-3000` appears in neither whitepaper (which use FST-2, FST-2XT, FSM2,
EAZ-TFT). The PDF and the demo read as two different products.

**Recommendation:** make the demo's opening question `0x4F` on the FST-2XT, cite
`S. 214`, and reference `Ticket #4471`. The collateral then becomes a trailer for the
demo instead of a separate artifact, and the lead gets the small satisfaction of
recognising the case. This is one fixture change.

### 3.2 "7 Quellen" means something different in each place

IMP p3 stat: **"7 Quellen — Helpdesk, Alt-Datenbank, Normen & mehr – vereint"**, framed
as seven *external* sources.

The demo's `config.1` shows exactly seven knowledge bases — Technical documentation,
Standards & regulations, Software documentation, Custom documents, Support tickets,
Service database, **Newton's memory**. The seventh is the agent's own memory, not an
external source.

The number matching is a genuinely good coincidence and worth keeping. Just be aware a
careful reader counts six external sources plus memory.

### 3.3 The demo's pilot ask and the PDF's pilot offer don't quite line up

- IMP p4 offers a concrete pilot: **"Zehn Ihrer Handbücher, zwei Wochen, echte Fragen
  Ihres Serviceteams"**, then a 30-minute session, with a QR code.
- The demo's closing step asks the softer, vaguer: *"Want a demo running on your own
  example documents? Or to talk through which agents would actually earn their place in
  your business?"* — and offers **only a "Back" button** (**B5**).

The PDF's offer is better: specific, bounded, low-commitment. The tour's close should
restate it in those terms ("ten of your manuals, two weeks") rather than inventing a
weaker ask — and must have something to click.

---

## 4. What the demo evidences well — tell sales to lean on these

Each verified on screen during the walkthrough:

| Collateral claim | Demo evidence |
|---|---|
| "Generische KI reicht nicht — ein Chatbot, der **Steuerungsgenerationen verwechselt**, ist ein Sicherheitsrisiko" | The `memory` chapter distinguishes **FST-2** from **FST-2XT** across consecutive turns, answering each separately. Direct, on-screen rebuttal of the objection |
| "Und wenn nichts belegt ist, **sagt IMP das ehrlich**" (IMP p3) / "Findet IMP nichts Belegtes, sagt es das" (UC1 step 04) | `memory.0` is a textbook demonstration — an explicit "the documents do not contain this menu path", with citations, refusing to invent. The strongest screen in the tour |
| "Kuratiertes Wissen — von Ihren besten Leuten korrigierbar, IMP lernt kontinuierlich mit" / "Mitarbeiter-Korrekturen fließen zurück" | `memory.1→3`: engineer corrects → visible `Create Newton Memory Item` tool call → the item appears in a knowledge base you own |
| "DE + EN — Gefragt und geantwortet in beiden Sprachen" | `ingestion.0` shows DE/EN pairs of the same manual side by side; answers are in German |
| "Suche über alle Quellen parallel … Normen (DIN, VDI, EMV)" | `config.1` shows a "Standards & regulations" base scoped to "DIN, EN, ISO, VDI, EU directives" |
| "Die Suche unterscheidet Baureihen und Softwarestände" | `config.2`'s five routing rules, written as plain German-domain sentences |
| "Im Produktiveinsatz erprobt" | The failed runs, cancelled recordings and real ALGI addresses do more for this than any badge |

**And one thing the demo has that the collateral doesn't:** the `evals` chapter.
"Every question, every run, one grid — a change that helps one question and quietly
breaks another has nowhere to hide" is a strong, specific answer to *"generische KI
reicht nicht"* and to the safety-criticality theme both PDFs push. It appears in
**neither** whitepaper. Consider adding it to IMP p3's platform grid — subject to
fixing the undisclosed invented scores first (**B4**).

---

## 5. Defects in the PDFs themselves

These go to leads, so worth fixing regardless of the demo:

- **IMP p4, pilot step 01 — corrupted sentence.** Reads:
  *"Kein Integrationsprojekt, keine Vorleistung Ihrer IT – OPEN richtet alles
  **einautomatischer Sperre bei 100 %.**"*
  A fragment of the Budgets card ("automatischer Sperre bei 100 %") has been spliced
  into the pilot step mid-word. Should end "…OPEN richtet alles ein." This is on the
  page carrying the call to action.
- **IMP p3 — missing space:** "Budgets pro Nutzer, Team, **Projektund** Agent".
- **Both PDFs — "Wissenbasen" / "Wissenbasis"** should be *Wissensbasen* /
  *Wissensbasis*. Appears in the IMP platform grid and in both chat mocks
  (`Werkzeug: Wissenbasis durchsuchen`), so it is visible four times.
- **IMP p2 — "Seite 214" sits in a row of KPIs** ("<15s", "100 % EU", "∞ Nutzer") but is
  an example, not a metric. Reads oddly as a statistic. Consider "bis auf die Seite".
- **`4471` is reused** as ticket number (UC1, UC3) and inside a document number
  ("Beleg 20-4471", UC2). Probably deliberate continuity; just flagging that it can read
  as recycled placeholder data.

---

## 6. Recommended sequence

**Before the next LinkedIn send:**

1. ~~Settle the product name~~ — **decided: OPEN / OPEN IMP.** Now an implementation task
   (§1.1, rebrand doc §2).
2. **Remove the AI-Firewall claim from both PDFs** — confirmed not built (§1.3, rebrand
   doc §4). This is the only remaining item that actively misleads leads.
3. Either implement page-level citation chips or soften the page-precision language in
   both PDFs (§1.2). Fix the citation drill-down regardless (**B1**).
4. Fix the corrupted sentence on IMP p4 (§5).

**Before the demo goes to leads:**

5. All launch blockers in [demo-tour-review-findings.md](./demo-tour-review-findings.md)
   (B1–B5).
6. Re-point the opening question at `0x4F` / `S. 214` / `Ticket #4471` so the collateral
   and the demo tell one story (§3.1).
7. Open one email run to show the quote draft and an approval step (§2.2) — the largest
   coverage gain per unit of work.
8. Restate the PDF's concrete pilot offer in the closing step (§3.3).

**Next iteration:**

9. Short chapters for Budgets and Projects/Access (§2.3, §2.4) — three unevidenced
   claims become demonstrated ones.
10. Decide UC3: build a Wartungsbericht chapter, or drop the use case from the PDF
    (§2.1).
11. Add evals to the IMP whitepaper (§4).
