# Demo rebrand to OPEN + theme application

Decisions taken after the demo review, with the implementation work they imply and the
risks found while checking the supplied theme against the codebase.

Companions:
- [demo-tour-review-findings.md](./demo-tour-review-findings.md) — the demo on its own terms
- [demo-tour-vs-campaign-collateral.md](./demo-tour-vs-campaign-collateral.md) — demo vs. the two whitepapers

---

## Decisions recorded

| # | Decision | Supersedes |
|---|---|---|
| D1 | The demo is branded **OPEN** / **OPEN IMP** — matching the whitepapers | Collateral review §1.1 ("four product names") |
| D2 | Adopt the supplied token set as the demo theme (OPEN lime accent, Poppins, tight radius, hard shadows) | `CLAUDE.md` design context (purple / Inter / Merriweather) |
| D3 | **Guardrails / AI-Firewall is not built yet.** Keep it out of the demo for now; add a chapter once it ships | Collateral review §1.3 (which asked for backend confirmation — now answered) |

D3 has a consequence beyond the demo, covered in §4.

---

## 1. Open question to settle first

**Is the OPEN theme global, or scoped to the demo?**

`app/globals.css` defines the tokens once, in `:root` and `.dark`. Applying the supplied
set there rebrands **the entire product**, not just `/demo/tour` — every customer
deployment, the whole application.

Three options:

| Option | Effect | When it's right |
|---|---|---|
| **A. Global swap** — edit `:root` / `.dark` | Everything becomes OPEN lime | OPEN is the product brand everywhere |
| **B. Demo-scoped** *(recommended)* — a `.theme-open` class on the demo shell overriding the same tokens | Only the tour rebrands; other deployments keep their look | OPEN is the go-to-market brand for the elevator vertical, Exulu remains the product |
| **C. Tenant theming** — drive tokens from `ConfigContext` per deployment | Any customer can be branded | Worth doing eventually; too much for this campaign |

**Recommendation: B.** The whitepapers are published by *OPEN Digitalgruppe* as vertical
campaign collateral. Nothing indicates every Exulu deployment should turn lime. B is also
reversible and does not touch other customers. `ConfigContext` (already carrying
`backend`) is the natural place to hang it if you later want C.

Everything below assumes B; the token work is identical either way, only the selector changes.

---

## 2. Branding work (D1)

| What | Where | Change |
|---|---|---|
| Tour opening sentence | `lib/demo/tour.ts` — `intro.0` body | "a working **Exulu** deployment" → "a working **OPEN IMP** deployment" |
| App header | Shell brand component (`components/shell/brand.tsx`) | "AI Studio" → "OPEN IMP" |
| Logo asset | `components/logo.tsx:43,51` | Currently `${backend}/logo_light.png` → resolves to `http://localhost:9001/…` and **404s in the demo**. Ship the OPEN mark and serve it locally |
| Page title / favicon | root layout + `app/favicon.ico` | Currently generic |
| Agent display name | Demo fixtures — "Technical Documentation Assistant" / "Newton" | Fine as-is; just confirm "Newton" is intended to be visible to leads |

The broken logo was filed as a cosmetic issue (**P10** — alt text flashes before `onError`
hides it). Under D1 it is a **branding blocker**: the lead arrives from an OPEN-branded PDF
to a page with no logo at all. Fixing D1 fixes P10.

**Also worth a decision:** the demo currently shows "Newton's memory" as a knowledge base
name and "ALFREDO_2 – Der clevere Ersatzteilspezialist" as the routine's agent. These are
real customer naming and read as authentic — but check with Newlift/ALGI that they are
cleared for a lead-facing asset.

---

## 3. Theme work (D2)

### 3.1 Mechanical

- Apply the two token blocks to `app/globals.css` (or the `.theme-open` scope per §1).
- **Fonts are not loaded.** The theme asks for **Poppins** (sans) and **Playfair Display**
  (serif); the app currently loads Inter and Merriweather via `next/font`. Both new
  families need adding, or the tokens silently fall back to `ui-sans-serif` / `ui-serif`.
  JetBrains Mono is unchanged.
- **`CLAUDE.md` contradicts D2** and will pull future work back to purple. It currently
  states Primary Purple `hsl(257.9, 100%, 60%)`, Inter/Merriweather, and a spacing scale.
  Update it in the same change, or the next person reverts this by following instructions.

### 3.2 Tokens the supplied theme does not cover

Seventeen tokens exist in `globals.css` but not in the supplied set. Left alone they keep
their **current purple-family values** and will clash:

```
--success  --success-foreground
--warning  --warning-foreground
--info     --info-foreground
--chart-6  --chart-7  --chart-8  --chart-9  --chart-10
--code-surface  --code-surface-foreground
--md-editor-background  --md-editor-border
--md-editor-toolbar-background  --md-editor-toolbar-color
```

`--success` / `--warning` / `--info` matter most: they are the semantic status colours,
and the demo's two most colour-dependent screens (the evals matrix and the routine run
list) live on exactly that axis. Decide values for these before shipping.

Also note the supplied light block defines `--spacing` and `--tracking-normal`, which the
dark block omits. Harmless if they are theme-invariant — just make it deliberate.

---

## 4. Consequence of D3 — the collateral still sells guardrails

Keeping the AI-Firewall out of the demo is the right call. But it is currently **sold twice
in the PDFs going to leads**:

- `OPEN_Whitepaper-IMP.pdf` p3 — "**AI-Firewall & Freigaben** — Fünf Scanner vor jeder
  Interaktion. Kein Schreibzugriff auf Ihre Systeme ohne menschliche Bestätigung."
- `OPEN_Whitepaper-KI-Use-Cases.pdf` p3 (UC2) — "Die **AI-Firewall** prüft jede eingehende
  Mail zuerst – auf Prompt-Injection und personenbezogene Daten", plus a mock status line
  reading `AI-Firewall: unauffällig`

A lead reads a countable claim ("fünf Scanner"), walks a demo that shows none of it, and
asks the obvious question on the call. **Pull the AI-Firewall from both PDFs until it
ships**, then add it back alongside the demo chapter.

Two nuances worth separating:

- The **"kein Schreibzugriff ohne menschliche Bestätigung"** half of that card is a
  different claim from the five scanners, and is the one buyers care most about for the ERP
  use case. If human-in-the-loop approval *does* exist, keep it and drop only the scanner
  language — but the demo shows no approval gate either (collateral review §2.2), so it
  needs evidence before it stays in the PDF.
- The backend note in `app/(application)/agents/queries.ts:43-50`
  (`AGENT_FIREWALL_SUPPORTED = false`, `Agent.firewall` absent as of 2026-06-12) is now
  explained by D3. Leave the flag as-is; it is behaving correctly by rendering an honest
  empty state.

---

## 5. Risks found while checking the theme

These are real problems with the supplied tokens, not objections to the direction.

### R1 — Light-mode primary fails contrast as a foreground colour

`--primary: 67.24deg 43.2% 50.37%` is `#aab74a` (olive-lime).

| Use | Contrast | Verdict |
|---|---|---|
| Button fill, with `--primary-foreground` `#292929` | **6.64 : 1** | ✓ fine |
| **As text/icon/border on white** | **2.19 : 1** | ✗ fails even the 3:1 non-text minimum |

The codebase uses primary as a foreground in **135 places**:

```
91  text-primary
42  border-primary
 2  ring-primary
```

Active nav items, links, focus rings and selected states will be close to illegible in
light mode. Dark mode is fine (`#effe7c` on `#785d11` = 5.67:1).

**Fix:** introduce a darker `--primary-strong` for foreground use in light mode (roughly
`67 43% 32%`), or darken `--primary` itself and lighten `--primary-foreground`. Do not
ship the light theme without this.

### R2 — Brand lime collides with "pass" green on the evals matrix

The new primary is lime (hue 67°). The evals matrix marks passing scores green
(hue ~142°) and warnings amber (hue ~38°). Lime sits between them.

The evals grid is the demo's proof screen, and its whole point is that a visitor can read
pass/warn/fail at a glance. Putting the brand colour in the same hue neighbourhood as
"pass" weakens exactly the screen that most needs to be unambiguous. Consider keeping
status colours clearly separated in hue, or desaturating brand lime wherever it appears
near the matrix.

### R3 — Status colours will not re-theme, and are still below AA

Status colours are **hardcoded Tailwind utilities**, not semantic tokens:

```tsx
text-amber-600 dark:text-amber-500      // evals, workflows, transcripts
border-amber-500/30 bg-amber-500/10
```

Two consequences:

1. They are unaffected by the theme swap, so they will keep the old palette's look while
   everything around them changes — the screens will read as half-rebranded.
2. The contrast finding from the demo review (**P11** — eval scores at 3.13–3.79:1 in light
   mode, below the 4.5:1 AA bar `CLAUDE.md` requires) is **not fixed** by this change and
   still needs addressing.

Migrating these to `--success` / `--warning` / `--destructive` would solve §3.2, R2 and
P11 together.

### R4 — Chart colours are all blue while the brand is lime

`--chart-1` … `--chart-5` are five shades of blue (211°–226°). Nothing in the OPEN palette
is blue, and `--chart-6` … `--chart-10` are undefined in the supplied set. Any analytics
surface will look like a different product. Low urgency — the tour never visits `/analytics`
— but worth fixing before that chapter is ever added.

### R5 — The active sidebar item is branded in light mode only

| | `--sidebar-accent` | Result |
|---|---|---|
| Light | `66.9 98.5% 74.1%` — bright lime | Active nav item is **brand lime** |
| Dark | `0 0% 14.9%` — dark grey | Active nav item is **grey** |

The demo's default is dark mode, so the brand colour never appears in the sidebar for most
visitors. Probably unintended; pick one behaviour.

### R6 — `--sidebar-primary` introduces a third accent

Near-black (`0 0% 9%`) in light, **blue** (`225° 84% 49%`) in dark — while `--primary` is
lime in both. Three different accent colours across two themes. Likely a leftover from the
theme generator; reconcile.

### R7 — Unit inconsistency in one token

`--primary: "67.24deg 43.2% 50.37%"` carries a `deg` unit; every other token in the set is
unitless. `hsl()` accepts it in modern browsers, so it works — but it will break any code
doing string interpolation on the channels. Normalise to `67.24 43.2% 50.37%`.

### R8 — The visual shift is larger than a palette change

- `--radius` **0.4rem → 0.225rem** — noticeably sharper corners throughout
- Shadows change from soft and centred (`0px 2px 3px`) to **hard and offset**
  (`3px 3px 3px`) — a deliberate, quite different aesthetic

This is fine, but it interacts with a judgement in the demo review: I argued the plain line
illustrations work *because* they sit correctly against plain screens. Hard offset shadows
and tight corners change that context. **Re-look at the illustrations after the theme
lands** — the conclusion may not survive.

### R9 — Existing screenshots go stale

The light-mode evidence in the review docs was captured on the purple theme. After this
lands, re-capture before using any of it externally.

---

## 6. Suggested order

1. **Settle §1** (global vs. demo-scoped). Everything else depends on it.
2. **Pull the AI-Firewall from both PDFs** (§4) — independent of all code work, and the
   only item here that is currently misleading leads.
3. **Fix R1** (light-mode primary contrast) — the theme is not shippable in light mode
   without it.
4. Apply tokens + load Poppins/Playfair + update `CLAUDE.md` (§3.1).
5. Decide the 17 uncovered tokens (§3.2), ideally by migrating status colours off hardcoded
   Tailwind (R3) — this closes R2, R3 and P11 at once.
6. Rebrand strings, logo, favicon (§2) — fixes P10.
7. Re-check illustrations and re-screenshot (R8, R9).
8. Reconcile R5/R6, normalise R7. R4 whenever analytics is first shown.

Note this is **theme and branding work only** — it does not touch the five launch blockers
(B1–B5) in the demo review, which remain the gate on showing the tour to a prospect.
