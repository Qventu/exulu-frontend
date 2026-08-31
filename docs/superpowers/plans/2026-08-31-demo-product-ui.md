# Demo Tour Product-UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the product-UI findings from the demo-tour review that copy and fixture edits could not reach: show the artifacts the tour narrates, stop the tour chrome colliding with the product, and finish the German/brand surface.

**Architecture:** Every change is either (a) an inert `data-demo-id` anchor plus a tour-step retarget, (b) a small additive product affordance (URL-addressable tab, i18n keys), or (c) demo-gated behaviour behind `isDemoMode()`. Nothing removes or restructures product features; the two product-wide visual changes (slider colour, i18n keys) are deliberate and low-risk.

**Tech Stack:** Next.js 16 App Router, React 19, shepherd.js 15 (floating-ui under it), next-intl (`messages/en.json` + `messages/de.json`), vitest 4 (node env, `lib/**`, `components/**`, `app/**` globs).

**Spec:** `docs/demo-tour-change-brief.md` (§4 show-what-the-copy-claims, §5 overlay/positioning, §6 visual polish) — read it first; this plan implements its remainder after the copy/fixture commits `70328f2`, `16939de`, `d000871`.

## Global Constraints

- All visitor-facing strings **German, Sie-form** (change brief §1). New i18n keys need values in **both** `messages/en.json` and `messages/de.json`.
- Tour step bodies ≤ **45 words** — enforced by `lib/demo/tour.test.ts` ("keeps every step under a paragraph").
- Demo-only behaviour must be gated with `isDemoMode()` from `@/lib/demo/flag` — never `process.env` directly.
- Commit messages: conventional commits, **lowercase after the colon** (commitlint rejects sentence-case subjects).
- Pre-existing failures to ignore, not fix: `components/shell/nav-config.test.ts` (fails on main), eslint error in `app/(application)/data/components/entity-types.tsx`, 2 eslint warnings.
- Verify in the browser where a step's rendering changed: dev server `NEXT_PUBLIC_DEMO_MODE=true npm run dev`, and note `proxy.ts` does **not** hot-reload.
- Do not drive tour buttons with `.click()` from scripts when verifying — it skips hit-testing (this hid a real bug once). Real clicks at screenshot coordinates.

---

### Task 1: Anchor the meeting work instruction (spec §4, meetings.2)

The review sheet already renders the generated work instruction — `outputs.map(...)` at `review-sheet.tsx:849` — but it sits below the transcript inside the sheet's scroll, so the step narrating it shows only transcript. Anchor it and scroll to it. No new UI.

**Files:**
- Modify: `app/(application)/transcriptions/components/review-sheet.tsx` (~line 840–850)
- Modify: `lib/demo/tour.ts` (step id `meetings-guide`)
- Test: `lib/demo/tour-navigation.test.ts` (existing anchor-exists assertion covers the new id automatically)

**Interfaces:**
- Produces: `data-demo-id="meeting-guide"` on the element that directly wraps the outputs list; `meetings-guide` step gains `anchor: "meeting-guide"`, `scrollBlock: "start"`.

- [ ] **Step 1: Read the outputs block**

Run: `sed -n '835,870p' "app/(application)/transcriptions/components/review-sheet.tsx"`
Identify the JSX element that directly encloses `{outputs.map((output, index) => {`.

- [ ] **Step 2: Add the anchor**

Add to that enclosing element (do not create a new wrapper if one exists; add the attribute):

```tsx
// The demo tour anchors here: the step about the generated work
// instruction used to point at nothing, so the sheet showed only the
// transcript above it and the narrated document was below the fold.
data-demo-id="meeting-guide"
```

- [ ] **Step 3: Retarget the tour step**

In `lib/demo/tour.ts`, step `meetings-guide`: change `anchor: null` to:

```ts
        anchor: "meeting-guide",
        // The outputs render at the BOTTOM of the review sheet's scroll;
        // "start" brings the document itself on screen, not just its header.
        scrollBlock: "start",
```

- [ ] **Step 4: Run the anchor test**

Run: `npx vitest run lib/demo/tour-navigation.test.ts`
Expected: PASS (the "spotlights a declared data-demo-id" assertion now finds `meeting-guide` in source).

- [ ] **Step 5: Verify in the browser**

Open `http://localhost:3000/transcriptions?review=000cf053-e361-47b2-8f53-536ff29d912d&tour=meetings.2` (fresh tab, wait ~10s). Screenshot must show the work-instruction document (starts "Freigabe prüfen" content) highlighted, not the raw transcript.

- [ ] **Step 6: Commit**

```bash
git add app components lib && git commit -m "fix(demo): anchor the work instruction the meetings step narrates"
```

---

### Task 2: URL-addressable evals tab + source-requirement anchor (spec §4, evals.2)

The Test-cases tab and `expected_knowledge_sources` both exist; the tour just can't reach them. Make the tab respect `?tab=`, anchor the tab panel, and point `evals-sources` at it.

**Files:**
- Modify: `app/(application)/evals/[id]/page.tsx` (Tabs at ~line 300–330; it is `"use client"`)
- Modify: `lib/demo/tour.ts` (step id `evals-sources`)
- Test: `lib/demo/tour-navigation.test.ts` (auto-covers the new anchor)

**Interfaces:**
- Produces: `?tab=testCases` selecting the tab on load; `data-demo-id="evals-cases"` on the testCases `TabsContent`; step `evals-sources` routed to `/evals/evalset-techdoc-regression?tab=testCases` with `anchor: "evals-cases"`.

- [ ] **Step 1: Read the Tabs block**

Run: `sed -n '295,335p' "app/(application)/evals/[id]/page.tsx"` and note how `Tabs` receives its default (uncontrolled `defaultValue` vs controlled `value`).

- [ ] **Step 2: Wire the tab param**

The page already imports from `next/navigation` or add it. Above the `return`:

```tsx
  // Deep link: ?tab=testCases opens the cases tab on arrival. Read once as
  // the DEFAULT, not synced — switching tabs by hand must not fight the URL.
  const requestedTab = useSearchParams().get("tab");
  const initialTab = requestedTab === "testCases" ? "testCases" : "results";
```

Pass it: `defaultValue={initialTab}` on `<Tabs>` (replace the current hardcoded default). If the Tabs are **controlled** (`value={...}`), instead seed that state's `useState` initializer with `initialTab`.

- [ ] **Step 3: Anchor the panel**

On `<TabsContent value="testCases" ...>` (line ~324) add `data-demo-id="evals-cases"`.

- [ ] **Step 4: Retarget the tour step**

In `lib/demo/tour.ts`, step `evals-sources`:

```ts
        route: "/evals/evalset-techdoc-regression?tab=testCases",
        anchor: "evals-cases",
```

Body stays as is (German, already describes source requirements).

- [ ] **Step 5: Tests**

Run: `npx vitest run lib/demo/`
Expected: all pass. Note `tour.test.ts` "never puts two consecutive steps on the same anchor" — `evals-matrix` → `evals-cases` differ, so no conflict.

- [ ] **Step 6: Verify in the browser**

Open `.../evals/evalset-techdoc-regression?tab=testCases&tour=evals.2`, wait ~10s: the cases list must be visible and highlighted, with the case rows (not the results grid) on screen. Click a case: the modal shows "expected knowledge sources" chips — that is the payoff the step points toward.

- [ ] **Step 7: Commit**

```bash
git add app lib && git commit -m "fix(demo): open the evals cases tab the source step talks about"
```

---

### Task 3: Per-step popover placement (spec §5, overlap rule)

The popover may not cover what the step narrates. Shepherd already takes a placement per step (`attachTo.on`, flipped by floating-ui when it doesn't fit); the tour just never sets it. Add `DemoStep.placement`, default `"bottom"`, and set `"left"` on the four wizard steps where the popover covered the drawer's own title.

**Files:**
- Modify: `lib/demo/tour.ts` (DemoStep interface + 4 config steps)
- Modify: `lib/demo/shepherd-step.ts` (~line 135)
- Test: `lib/demo/shepherd-step.test.ts`

**Interfaces:**
- Produces: `placement?: "top" | "bottom" | "left" | "right"` on `DemoStep`; `shepherdStepFor` maps it to `attachTo.on`.

- [ ] **Step 1: Write the failing test**

In `lib/demo/shepherd-step.test.ts`, inside the "anchored steps" describe:

```ts
  it("honours a step's placement, defaulting to bottom", () => {
    // The popover was covering the content some steps narrate — the wizard
    // steps hid the drawer's own title. floating-ui still flips when the
    // preferred side does not fit, so this is a preference, not a promise.
    const anchored = allSteps.find((s) => s.anchor && !s.placement)!;
    expect(shepherdStepFor(anchored, handlers).attachTo?.on).toBe("bottom");

    const placed = allSteps.find((s) => s.placement === "left");
    expect(placed, "no left-placed step — config wizard steps should be").toBeTruthy();
    expect(shepherdStepFor(placed!, handlers).attachTo?.on).toBe("left");
  });
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run lib/demo/shepherd-step.test.ts`
Expected: FAIL — `placement` does not exist / no left-placed step.

- [ ] **Step 3: Implement**

`lib/demo/tour.ts` — add to `DemoStep`:

```ts
  /**
   * Which side of the anchor the popover prefers. floating-ui flips it when
   * that side does not fit, so this is a preference, not a promise. Default
   * "bottom". "left" for the wizard steps: bottom placement sat the popover
   * across the drawer's own heading.
   */
  placement?: "top" | "bottom" | "left" | "right";
```

Add `placement: "left",` to the four steps `config-sources`, `config-routing`, `config-vocabulary`, `config-behavior`.

`lib/demo/shepherd-step.ts` (~line 137) — replace the hardcoded side:

```ts
            on: (step.placement ?? "bottom") as PopperPlacement,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/demo/`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

`.../agents/edit/demo-agent-newton?wizard=sources&tour=config.1`: the popover must sit to the LEFT of the drawer, over the dimmed page, with the drawer heading "Wissensbasen konfigurieren" fully readable. Click Weiter through all four wizard steps at real coordinates (the drawer must stay open — regression check for the pointer-events fix).

- [ ] **Step 6: Commit**

```bash
git add lib && git commit -m "feat(demo): per-step popover placement, left of the wizard drawer"
```

---

### Task 4: Tour bubble collision nudge (spec §5)

The bubble sits over the send button, transcript Edit buttons and wizard Continue on various routes. Detect what is under it after each step change and nudge it upward until it covers nothing interactive.

**Files:**
- Modify: `components/demo/tour-bubble.tsx`

**Interfaces:**
- Consumes: `useTour().position` (re-runs the probe on step change).
- Produces: none (visual only).

- [ ] **Step 1: Implement the nudge**

In `tour-bubble.tsx`, after the existing derived values:

```tsx
  // Nudge the bubble up when it covers something interactive.
  //
  // Fixed bottom-right is over the send button on chat, Edit buttons on the
  // transcript list, and the wizard's Continue on the editor. Rather than a
  // hand-tuned offset per route (which rots as pages change), probe what is
  // actually under the four corners after each step lands and step upward in
  // 80px increments until the corners are clear or three nudges are spent.
  const rootRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    setLift(0);
    let cancelled = false;
    const INTERACTIVE = "button, a, input, textarea, select, [role='button']";
    const probe = (attempt: number) => {
      if (cancelled || attempt > 3) return;
      requestAnimationFrame(() => {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const corners: Array<[number, number]> = [
          [r.left + 4, r.top + 4], [r.right - 4, r.top + 4],
          [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4],
        ];
        const hit = corners.some(([x, y]) =>
          document.elementsFromPoint(x, y).some(
            (n) => n instanceof Element && !el.contains(n) &&
              (n.matches(INTERACTIVE) || n.closest?.(INTERACTIVE) !== null &&
               !el.contains(n.closest(INTERACTIVE)!)),
          ),
        );
        if (hit) {
          setLift((v) => v + 80);
          probe(attempt + 1);
        }
      });
    };
    // Give the page a beat to lay out after the route/step change.
    const t = setTimeout(() => probe(1), 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [position.chapter, position.step]);
```

Attach to the root: `<div ref={rootRef} style={{ transform: lift ? \`translateY(-${lift}px)\` : undefined }} className="fixed bottom-6 right-6 …">` (keep the existing classes). Add `useRef`/`useEffect` to the react import.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — expected clean. (No node test possible: pure DOM. This is why the browser step below is mandatory, not optional.)

- [ ] **Step 3: Verify in the browser**

Chat route (`?tour=techdoc.0`): bubble must not cover the lime send button. Transcript list (`?tour=meetings.0`): must not cover a row's controls. If it visibly jumps twice, lower the initial delay to 300ms and re-check.

- [ ] **Step 4: Commit**

```bash
git add components && git commit -m "fix(demo): nudge the tour bubble off interactive controls"
```

---

### Task 5: Slider uses the accent, not alarm red (spec §6 P1)

`components/ui/slider.tsx` hardcodes `bg-red-500` on Range and Thumb. Its only consumer is the wizard's behaviour step, where a 95% setting renders as a full-width red bar — the only saturated red in the product, reading as an error. This is a product-wide change and deliberately so: red-as-default is wrong everywhere.

**Files:**
- Modify: `components/ui/slider.tsx:21,23`

- [ ] **Step 1: Recolour**

Line 21: `bg-red-500` → `bg-primary` (Range).
Line 23 (Thumb): `bg-red-500` → `bg-background` (keeps its existing `border-primary`).

- [ ] **Step 2: Confirm the blast radius**

Run: `grep -rln "components/ui/slider" app components`
Expected: only `behavior-step.tsx`. If more consumers appear, STOP and list them in the commit body instead of proceeding blind.

- [ ] **Step 3: Verify in the browser**

`?wizard=behavior&tour=config.4`: track renders lime-on-dark, thumb outlined, no red anywhere on the panel.

- [ ] **Step 4: Commit**

```bash
git add components && git commit -m "fix(ui): slider track uses the accent colour, not alarm red"
```

---

### Task 6: Mask the legacy product name in the demo (spec §6 P2)

`email-tab.tsx` shows `X-Exulu-Signature: …` twice (lines ~672 and ~692) — the old product name inside the OPEN IMP demo. Mask in demo mode only; real deployments genuinely send that header and must keep documenting it.

**Files:**
- Modify: `app/(application)/workflows/[id]/sections/triggers/email-tab.tsx`

- [ ] **Step 1: Implement**

Top of the component (it is `"use client"`), add import `isDemoMode` from `@/lib/demo/flag` and:

```tsx
  // The wire header is X-Exulu-Signature and real deployments must document
  // it truthfully. The demo is OPEN-branded, so it shows the name the demo
  // claims — a visitor cannot call this endpoint anyway.
  const signatureScheme = `${isDemoMode() ? "X-OPEN" : "X-Exulu"}-Signature: sha256=HMAC-SHA256(body, secret)`;
```

Replace both `value="X-Exulu-Signature: sha256=HMAC-SHA256(body, secret)"` with `value={signatureScheme}`.

- [ ] **Step 2: Typecheck + verify**

`npx tsc --noEmit` clean; browser at `/workflows/<id>?tour=email.1` shows `X-OPEN-Signature…` in the trigger panel.

- [ ] **Step 3: Commit**

```bash
git add app && git commit -m "fix(demo): show the demo's own name in the signature scheme"
```

---

### Task 7: Retrieval card and streaming labels through i18n (spec §6 / German surface)

The last English on the demo's screens is hardcoded in `components/message-renderer.tsx`: the streaming status rotation (lines ~587–589), the reasoning-steps toggles (~1576, ~1597), the retrieval-card header ("Context search results …", ~1670), its count words, and the "Search Parameters / User Query / Important Keyword / Relevant Keywords" labels (~1704+). Route them through next-intl; the file currently does **not** import `useTranslations`.

**Files:**
- Modify: `components/message-renderer.tsx`
- Modify: `messages/en.json`, `messages/de.json` (under the existing `chat` namespace)

**Interfaces:**
- Produces: keys `chat.streaming.thinking|researching|planning`, `chat.reasoning.showAll|showDetails`, `chat.retrieval.header|contexts|items|chunks|searchParams|userQuery|importantKeyword|relevantKeywords`.

- [ ] **Step 1: Add the keys**

`messages/en.json`, inside `"chat"`:

```json
    "streaming": { "thinking": "Thinking...", "researching": "Researching...", "planning": "Planning..." },
    "reasoning": {
      "showAll": "{count} more reasoning {count, plural, one {step} other {steps}} - show all",
      "showDetails": "{count} reasoning {count, plural, one {step} other {steps}} - show details"
    },
    "retrieval": {
      "header": "Context search results {contexts}",
      "contexts": "{count} {count, plural, one {context} other {contexts}}",
      "items": "{count} {count, plural, one {item} other {items}}",
      "chunks": "{count} {count, plural, one {chunk} other {chunks}}",
      "searchParams": "Search parameters",
      "userQuery": "User query:",
      "importantKeyword": "Important keyword:",
      "relevantKeywords": "Relevant keywords:"
    }
```

`messages/de.json`, same shape:

```json
    "streaming": { "thinking": "Denke nach ...", "researching": "Recherchiere ...", "planning": "Plane ..." },
    "reasoning": {
      "showAll": "{count} weitere {count, plural, one {Schritt} other {Schritte}} – alle anzeigen",
      "showDetails": "{count} {count, plural, one {Denkschritt} other {Denkschritte}} – Details anzeigen"
    },
    "retrieval": {
      "header": "Suchergebnisse: {contexts}",
      "contexts": "{count} {count, plural, one {Wissensbasis} other {Wissensbasen}}",
      "items": "{count} {count, plural, one {Dokument} other {Dokumente}}",
      "chunks": "{count} {count, plural, one {Passage} other {Passagen}}",
      "searchParams": "Suchparameter",
      "userQuery": "Anfrage:",
      "importantKeyword": "Wichtigstes Stichwort:",
      "relevantKeywords": "Relevante Stichwörter:"
    }
```

- [ ] **Step 2: Wire the component**

Add `import { useTranslations } from "next-intl";` to `message-renderer.tsx`. The literals live in more than one inner component — add `const t = useTranslations("chat");` inside **each** component that renders one (find them with `grep -n "reasoning steps\|Search Parameters\|Context search results\|Thinking\.\.\." components/message-renderer.tsx`). Replace:

- the module-scope `["Thinking...", "Researching...", "Planning..."]` array with key names `["thinking", "researching", "planning"] as const`, rendered as `t(\`streaming.${key}\`)` at the use site;
- line ~1576 with `t("reasoning.showAll", { count: reasoning.length - 5 })`;
- line ~1597 with `t("reasoning.showDetails", { count: reasoning.length })`;
- line ~1670 with `t("retrieval.header", { contexts: contextNames })`;
- the three count spans with `t("retrieval.contexts", { count: uniqueContexts.size })` etc. (this REPLACES the hand-rolled `=== 1 ? 'chunk' : 'chunks'` ternaries — delete them);
- the four label literals with their keys.

- [ ] **Step 3: Tests + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean / the usual single `nav-config` failure. next-intl throws at render for a missing key, so the browser step is the real gate.

- [ ] **Step 4: Verify in the browser**

`?tour=techdoc.0` from a fresh load, watch the full stream: status shows "Recherchiere ...", the card header "Suchergebnisse: software documentation context", counts "1 Wissensbasis · 1 Dokument · 1 Passage", labels "Suchparameter / Anfrage:". Then check one **non-demo-critical** English surface still works by loading any chat with locale cookie `en` in a normal window (keys must resolve in both).

- [ ] **Step 5: Commit**

```bash
git add components messages && git commit -m "feat(chat): retrieval card and streaming labels through i18n"
```

---

### Task 8: Regenerate the intro illustration with nine elevators (spec §3) — needs the user

`public/demo/structure.webp` shows seven elevator doors; the copy says "Neun Kapitel". The generation script exists but needs the user's OpenAI key.

**Files:**
- Modify: `public/demo/structure.webp` (regenerated)
- Reference: `scripts/generate-demo-image.py`

- [ ] **Step 1: Ask the user to run the generation**

Ask the user to run (their key, not stored):

```bash
OPENAI_API_KEY=<their key> python3 scripts/generate-demo-image.py \
  --out public/demo/structure.webp \
  --prompt "Nine elevator doors in a row, minimal technical line drawing, dark thin lines on transparent background, consistent with plain schematic style, no text, no shading"
```

(Check the script's actual flags first with `python3 scripts/generate-demo-image.py --help`; it validates truncated keys.)

- [ ] **Step 2: Verify the asset**

Run: `npx vitest run lib/demo/tour.test.ts` — the "points every schematic at a file that exists" test still passes. Open `?tour=intro.0` and count the doors: nine. Confirm the dark-mode `filter: invert()` still reads correctly (lines visible on dark).

- [ ] **Step 3: Commit**

```bash
git add public/demo/structure.webp && git commit -m "chore(demo): intro illustration counts nine chapters like the copy"
```

---

## Out of scope (named so nobody hunts for them here)

- **Booking URL** (`DEMO_BOOKING_URL`) — waiting on HubSpot, one-constant change.
- **OPEN logo/favicon assets** — waiting on the marks; `lib/demo/brand.ts` documents the drop-in paths, the monogram covers the gap.
- **Poppins/Playfair** — requires font files in `lib/fonts.ts`; the theme's font tokens are inert until then (documented in `lib/demo/theme.ts`).
- **Light mode** — deliberately unreachable until a foreground-safe `--primary` exists (~`67 43% 32%`).
- **A general never-overlap guarantee for the popover.** Spec §5 words it as a rule; Tasks 2–3 fix every concrete offender the review listed, but a guarantee needs floating-ui `size`/`shift` middleware plumbed through Shepherd and a max-height on the popover. The known residual: on the two streaming steps the popover (flipped above the composer) can sit over the tail of a long answer — accepted for now because the stream scrolls beneath it and the step's subject is the motion, not the last line. If a later review still flags it, that is the middleware task.
