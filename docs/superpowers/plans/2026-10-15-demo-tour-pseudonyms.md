# Demo Tour Pseudonyms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every real product identifier of NEW Lift and ALGI in the demo fixtures with invented identifiers of the same shape, through one reviewable mapping table, and make the originals impossible to reintroduce unnoticed.

**Architecture:** `lib/demo/fixtures/pseudonyms.ts` holds the ordered rule table (`PSEUDONYMS`), a `pseudonymise(text)` function and the `ORIGINAL_TOKENS` patterns. A one-off script applies the rules to the fixture files' string content (comment lines keep their provenance wording) and renames the chunk export; its output is committed. A test scans every fixture and copy module for the originals; the walker's deny list carries them for the on-screen check.

**Tech Stack:** Node 22 (lookbehind regexes), vitest (node), Playwright outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — section "Sub-project 7 — Abstraktion der Produktreferenzen (2026-10-15)".

**Branch:** `fix/demo-tour-pseudonyms` from `main` (36ac4ad); spec commit 5216956.

## Global Constraints

- The mapping is the spec's table; every rule has a boundary so it cannot hit a longer word (`DISABLED`, identifiers like `ALGI_AGENT`, chunk ids). Order matters: longer and composite tokens before their parts (`AZKBZ` before `AZK`, `FST-2XT` before `FST-2` before `FST`, `-SAZK-` before `AZK`).
- Article numbers are replaced by explicit pairs (the twelve in the session), never by a digit pattern — a six-digit pattern would hit chunk ids and quantities.
- Comment lines in TS fixtures (`//`, ` *`, `/**`) are not rewritten: they record provenance ("This is ALGI, not Newlift"). The scanning test strips comments before matching, so provenance stays and strings cannot hide behind it.
- Kept on purpose (industry terms, not identifiers): ADM, SHK, UCM, Nothalt COP, LSU, MIPA, CAN-to-LON, Zendesk ticket ids `TC…`, the agent name ALFREDO_2.
- The reference customers' names stay in chapter 12 (`lib/demo/scenes.ts`, `lib/demo/chapters/contact.ts`) and `lib/demo/brand.ts`; `ALGI` elsewhere in fixture strings becomes `AHT`.
- Daniel runs the production build; the executor walks. Per-task gate: `npx vitest run <files>` + `npx eslint --no-warn-ignored <files>`. Commit per task; commitlint subjects ≤ 100 chars, lowercase; never push.

## Review Focus

1. `FST` must not be rewritten inside a longer letter sequence while file names like `mia_fst2-2s` and `br_FST-2XT_2019` (underscore before the token) must be — Task 1 pins both with the lookbehind `(?<![A-Za-z])` instead of `\b`.
2. `DISABLED` (in `rest-fixtures.ts`) must survive the `DISA` rule — Task 1 requires the hyphen (`DISA-`).
3. `ALGI_AGENT`, `ALGI_SESSION` and the other identifiers must survive the `ALGI → AHT` rule — Task 1 uses `\bALGI\b` (no boundary before `_`) and Task 2's suite proves the modules still compile and pass.
4. The chunk count and every citation that names a document must still resolve after the rename — Task 2 runs the chapter tests (`chapter-memory.test.ts`, `retrieval-steps.test.ts`, `index.test.ts`) and the walker's chat steps on the build.
5. The placeholder `⟨ALGI Vertrieb⟩` becomes `⟨AHT Vertrieb⟩` and nothing else in the session changes shape — Task 2's scan test and the approval test (15 messages, the subject line) hold.

---

### Task 1: The mapping table

**Files:**
- Create: `lib/demo/fixtures/pseudonyms.ts`, `lib/demo/fixtures/pseudonyms.test.ts` (the rule tests; the scan test is added in Task 2)

**Interfaces:**
- Produces: `PSEUDONYMS: readonly { pattern: RegExp; replacement: string }[]`, `pseudonymise(text: string): string`, `ORIGINAL_TOKENS: readonly RegExp[]`, `originalIn(text: string): string | null`.

- [ ] **Step 1: Write the failing test**

`lib/demo/fixtures/pseudonyms.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { originalIn, pseudonymise } from "./pseudonyms";

describe("pseudonymise", () => {
  it("renames NEW Lift's controller family, longest token first", () => {
    expect(pseudonymise("FST-2XT, FST-2, FST-3 und die FST")).toBe("KS-2XT, KS-2, KS-3 und die KS");
    expect(pseudonymise("Nothalt COP im FST-Fehlerspeicher")).toBe("Nothalt COP im KS-Fehlerspeicher");
    expect(pseudonymise("FST-2XT-Parameter, FST3, FST2XT")).toBe("KS-2XT-Parameter, KS3, KS2XT");
  });

  it("renames file names where the token follows an underscore or a prefix", () => {
    expect(pseudonymise("mia_fst2-2s_2015-05_de.pdf")).toBe("mia_ks2-2s_2015-05_de.pdf");
    expect(pseudonymise("br_FST-2XT_2019-10_de.pdf")).toBe("br_KS-2XT_2019-10_de.pdf");
    expect(pseudonymise("hb_FST-2XT-MRL_2013-11_de.pdf")).toBe("hb_KS-2XT-MRL_2013-11_de.pdf");
    expect(pseudonymise("FST2XTchanges-customer-DE.docx")).toBe("KS2XTchanges-customer-DE.docx");
    expect(pseudonymise("FSTBugFixes.docx")).toBe("KSBugFixes.docx");
    expect(pseudonymise("FST-FSM2-changes-customer-EN.docx")).toBe("KS-SM2-changes-customer-EN.docx");
    expect(pseudonymise("MIPA_FST-3_DE.pdf")).toBe("MIPA_KS-3_DE.pdf");
    expect(pseudonymise("fst2xt-fahrkurve")).toBe("ks2xt-fahrkurve");
    expect(pseudonymise("EAZTFT-110_changes.doc, EAZ-TFT.110_Neuron_Changes.docx")).toBe("DPTFT-110_changes.doc, DP-TFT.110_Neuron_Changes.docx");
  });

  it("leaves industry terms and longer words alone", () => {
    for (const s of ["ADM, SHK, UCM", "LSU (Laufzeitüberwachung)", "MIPA", "CAN-to-LON_DE.pdf", "TC221811", "DISABLED", "Festplatte", "ALGI_AGENT_ID", "ALFREDO_2"]) {
      expect(pseudonymise(s), s).toBe(s);
    }
  });

  it("renames ALGI's cylinders, seal kits, article numbers and company", () => {
    expect(pseudonymise("AZKBZ 110, AZK-110, AZK 110, AZK 90 bis AZK 350")).toBe("HKB 110, HK-110, HK 110, HK 90 bis HK 350");
    expect(pseudonymise("DISA-T-AZK-110, DISA-SAZK-110, DISA-AZ-110-KDD, DISA-HAZ-120-KDD, DISA-AZR-50, DISA-AZM-70, DISA-AZK-110-RILLEN"))
      .toBe("DS-T-HK-110, DS-SHK-110, DS-HA-110-KDD, DS-HHA-120-KDD, DS-HR-50, DS-HM-70, DS-HK-110-RILLEN");
    expect(pseudonymise("Art.Nr. 118112, 113139 und 134466; Commission No. G47490")).toBe("Art.Nr. 418112, 413139 und 434466; Commission No. G58301");
    expect(pseudonymise("AHT Alfred Giehl GmbH & Co. KG, kurz Giehl")).toBe("AHT Hydraulik GmbH, kurz Hydraulik");
    expect(pseudonymise("Mit ALGI den Antrieb neu eingestellt; ⟨ALGI Vertrieb⟩")).toBe("Mit AHT den Antrieb neu eingestellt; ⟨AHT Vertrieb⟩");
  });

  it("is idempotent", () => {
    const once = pseudonymise("FST-2XT AZKBZ 110 DISA-SAZK-110 118112 Giehl ALGI");
    expect(pseudonymise(once)).toBe(once);
  });
});

describe("originalIn", () => {
  it("names the first original token, and none in pseudonymised text", () => {
    expect(originalIn("Seit Umbau auf neue FST-2XT")).toBe("FST-2XT");
    expect(originalIn("Art.Nr. 134466")).toBe("134466");
    expect(originalIn("DS-T-HK-110, KS-2XT, HKB 110, 434466, AHT Hydraulik GmbH")).toBeNull();
    expect(originalIn("DISABLED budget policy")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/demo/fixtures/pseudonyms.test.ts`
Expected: FAIL — `./pseudonyms` not found.

- [ ] **Step 3: The table**

`lib/demo/fixtures/pseudonyms.ts`:

```ts
/**
 * Product identifiers of the two reference customers, replaced by invented
 * ones of the same shape (spec, sub-project 7). The fixtures were real,
 * redacted exports (see scripts/build-algi-*-fixture.py); this table is the
 * second, product-level layer, applied once by scripts/pseudonymise-fixtures.mjs
 * and committed. Keep the table — it is the record of what was renamed.
 *
 * ORDER MATTERS: composite tokens before their parts. Boundaries are
 * "not adjacent to a letter" rather than \b, because file names put the
 * token after an underscore ("mia_fst2-2s") where \b never fires.
 */
const L = "(?<![A-Za-z])"; // not preceded by a letter
const R = "(?![A-Za-z])"; // not followed by a letter

const rule = (source: string, replacement: string, flags = "g") => ({ pattern: new RegExp(source, flags), replacement });

export const PSEUDONYMS: readonly { pattern: RegExp; replacement: string }[] = [
  // --- NEW Lift: the FST controller family → KS ----------------------------
  rule(`${L}FSTBugFixes`, "KSBugFixes"),
  rule(`${L}FST-2XT`, "KS-2XT"),
  rule(`${L}FST2XT`, "KS2XT"),
  rule(`${L}fst2xt`, "ks2xt"),
  rule(`${L}FST-2${R}`, "KS-2"),
  rule(`${L}fst2`, "ks2"),
  rule(`${L}FST-3${R}`, "KS-3"),
  rule(`${L}FST3${R}`, "KS3"),
  rule(`${L}FST${R}`, "KS"),
  rule(`${L}FSM2${R}`, "SM2"),
  rule(`${L}EAZ-TFT`, "DP-TFT"),
  rule(`${L}EAZTFT`, "DPTFT"),
  // --- ALGI: cylinders and seal kits -----------------------------------------
  rule(`${L}AZKBZ${R}`, "HKB"),
  rule(`-SAZK-`, "-SHK-"),
  rule(`-HAZ-`, "-HHA-"),
  rule(`-AZR-`, "-HR-"),
  rule(`-AZM-`, "-HM-"),
  rule(`-AZ-`, "-HA-"),
  rule(`${L}AZK${R}`, "HK"),
  rule(`${L}DISA-`, "DS-"),
  // --- ALGI: article numbers (the twelve in the session), the commission ----
  ...["134466", "118112", "113139", "140700", "105070", "105068", "105177", "120629", "118126", "114446", "113645", "113089"].map((n) =>
    rule(`\\b${n}\\b`, `4${n.slice(1)}`),
  ),
  rule(`\\bG47490\\b`, "G58301"),
  // --- ALGI: the company, and the customer's name in fixture text -----------
  rule(`AHT Alfred Giehl GmbH & Co\\. KG`, "AHT Hydraulik GmbH"),
  rule(`\\bAlfred Giehl\\b`, "Hydraulik"),
  rule(`\\bGiehl\\b`, "Hydraulik"),
  rule(`\\bALGI\\b`, "AHT"),
];

export function pseudonymise(text: string): string {
  return PSEUDONYMS.reduce((s, { pattern, replacement }) => s.replace(pattern, replacement), text);
}

/** The originals, for the scan test and the walker's deny list. */
export const ORIGINAL_TOKENS: readonly RegExp[] = [
  new RegExp(`${L}FST-?2XT`),
  new RegExp(`${L}FST-?[23]${R}`),
  new RegExp(`${L}FST${R}`),
  new RegExp(`${L}FSTBug`),
  new RegExp(`${L}fst2`),
  new RegExp(`${L}FSM2${R}`),
  new RegExp(`${L}EAZ-?TFT`),
  new RegExp(`${L}AZKBZ${R}`),
  new RegExp(`${L}AZK${R}`),
  /DISA-/,
  /\bGiehl\b/,
  /\bG47490\b/,
  /\b(134466|118112|113139|140700|105070|105068|105177|120629|118126|114446|113645|113089)\b/,
];

/** The first original token in `text`, or null. */
export function originalIn(text: string): string | null {
  for (const pattern of ORIGINAL_TOKENS) {
    const m = pattern.exec(text);
    if (m) return m[0];
  }
  return null;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run lib/demo/fixtures/pseudonyms.test.ts && npx eslint --no-warn-ignored lib/demo/fixtures/pseudonyms.ts lib/demo/fixtures/pseudonyms.test.ts`
Expected: PASS, eslint clean. If a rule's boundary misbehaves, fix the rule, never the expectation.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/fixtures/pseudonyms.ts lib/demo/fixtures/pseudonyms.test.ts
git commit -m "feat(demo): the product-reference pseudonym table"
```

---

### Task 2: Apply it to the fixtures; the scan test

**Files:**
- Create: `scripts/pseudonymise-fixtures.mjs`
- Modify: every file under `lib/demo/fixtures/` the script touches (expected: `agent-editor.ts`, `algi-meetings.json`, `algi-runs.json`, `algi-session.json`, `chapter-aufnahme.ts`, `chapter-email.ts`, `chapter-ingestion.ts`, `chapter-memory.ts`, `chapter-techdoc.ts`, `contexts.ts`, `evals.ts`, `memory-turns.ts`, `software-docs.ts`, `techdoc-turns.ts`), rename `chunks-fst2xt-de.json → chunks-ks2xt-de.json` with its two imports
- Modify: `lib/demo/fixtures/pseudonyms.test.ts` (the scan), any `lib/demo` test that pins an original (`date-shift.test.ts`, `meeting-tally.test.ts`, `chapter-memory.test.ts`, `retrieval-steps.test.ts`, `resolvers.approval.test.ts` if they name a document, type or number)

**Interfaces:**
- Consumes: `pseudonymise`, `originalIn`, `ORIGINAL_TOKENS` (Task 1).

- [ ] **Step 1: Write the failing scan test**

Append to `lib/demo/fixtures/pseudonyms.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

/** TS with its comments removed, so provenance notes may still say "ALGI". */
const withoutComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const listFiles = (dir: string, keep: (name: string) => boolean): string[] =>
  fs.readdirSync(dir).filter(keep).map((name) => path.join(dir, name));

describe("no original product identifier is left", () => {
  const fixtures = listFiles(path.join(__dirname), (n) => (n.endsWith(".ts") || n.endsWith(".json")) && !n.endsWith(".test.ts") && n !== "pseudonyms.ts");
  const copy = [
    ...listFiles(path.join(__dirname, "..", "chapters"), (n) => n.endsWith(".ts") && !n.endsWith(".test.ts")),
    path.join(__dirname, "..", "scenes.ts"),
    path.join(__dirname, "..", "overlays.ts"),
    path.join(__dirname, "..", "resolvers.ts"),
    path.join(__dirname, "..", "rest-fixtures.ts"),
  ];

  it.each([...fixtures, ...copy].map((f) => [path.relative(path.join(__dirname, ".."), f), f]))("%s", (_name, file) => {
    const raw = fs.readFileSync(file, "utf8");
    const text = file.endsWith(".json") ? raw : withoutComments(raw);
    expect(originalIn(text)).toBeNull();
  });

  it("keeps ALGI out of fixture strings outside the reference chapter", () => {
    for (const file of fixtures) {
      const text = file.endsWith(".json") ? fs.readFileSync(file, "utf8") : withoutComments(fs.readFileSync(file, "utf8"));
      expect(/\bALGI\b/.test(text), path.basename(file)).toBe(false);
    }
  });
});
```

Run: `npx vitest run lib/demo/fixtures/pseudonyms.test.ts`
Expected: FAIL for roughly fifteen files (algi-session.json, chunks-fst2xt-de.json, memory-turns.ts, techdoc-turns.ts, software-docs.ts, evals.ts, agent-editor.ts, chapter-memory.ts, chapter-email.ts, chapter-techdoc.ts, algi-meetings.json, contexts.ts, chapter-ingestion.ts, chapter-aufnahme.ts, algi-runs.json) and the ALGI case; `chunks-fst2xt-de.json` fails as a file name too once the scan runs over the directory listing — the rename in Step 3 handles it.

- [ ] **Step 2: The script**

`scripts/pseudonymise-fixtures.mjs`:

```js
/**
 * One-off: applies lib/demo/fixtures/pseudonyms.ts to the fixture files'
 * string content and renames the chunk export. Comment lines in TS files are
 * left alone (they record provenance). Idempotent; re-running changes nothing.
 *
 *   npx tsx scripts/pseudonymise-fixtures.mjs
 *
 * Kept in the repo as the record of the transformation, next to the three
 * build-algi-*-fixture.py scripts that produced the redacted exports.
 */
import fs from "node:fs";
import path from "node:path";

import { pseudonymise } from "../lib/demo/fixtures/pseudonyms.ts";

const DIR = path.resolve("lib/demo/fixtures");
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

let changed = 0;
for (const name of fs.readdirSync(DIR)) {
  if (name === "pseudonyms.ts" || name.endsWith(".test.ts")) continue;
  if (!name.endsWith(".ts") && !name.endsWith(".json")) continue;
  const file = path.join(DIR, name);
  const before = fs.readFileSync(file, "utf8");
  const after = name.endsWith(".json")
    ? pseudonymise(before)
    : before.split("\n").map((line) => (isComment(line) ? line : pseudonymise(line))).join("\n");
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
    console.log("rewrote", name);
  }
}
const oldChunks = path.join(DIR, "chunks-fst2xt-de.json");
if (fs.existsSync(oldChunks)) {
  fs.renameSync(oldChunks, path.join(DIR, "chunks-ks2xt-de.json"));
  console.log("renamed chunks-fst2xt-de.json → chunks-ks2xt-de.json");
}
console.log(`${changed} file(s) rewritten`);
```

Run it: `npx tsx scripts/pseudonymise-fixtures.mjs` (tsx resolves the `.ts` import). Then update the two imports: in `lib/demo/fixtures/software-docs.ts` and `lib/demo/fixtures/techdoc-turns.ts`, `./chunks-fst2xt-de.json` → `./chunks-ks2xt-de.json`; rename the binding `RAW_FST_CHUNKS` → `RAW_KS_CHUNKS` in `techdoc-turns.ts` if it is used by that name. Run the script a second time: expected output `0 file(s) rewritten` (idempotence).

- [ ] **Step 3: Tests that pinned originals**

Run: `npx vitest run lib/demo 2>&1 | grep -E "FAIL|×" | head -30` and fix each assertion to the pseudonym (the expectation text, not the fixture): candidates are `lib/demo/date-shift.test.ts` (one string), `lib/demo/fixtures/meeting-tally.test.ts` (two), `lib/demo/chapter-memory.test.ts` (the memory item name "FST-2XT Kalibrierfahrt Menüpunkt" and the menu path), `lib/demo/fixtures/retrieval-steps.test.ts` (trace lines naming documents), `lib/demo/resolvers.approval.test.ts` (the subject "Cylinder packing seal for AZKBZ 110" → "HKB 110"). The chunk-count assertions are untouched by design (counts, not names).

- [ ] **Step 4: Run the gate**

Run: `npx vitest run lib/demo && npx eslint --no-warn-ignored lib/demo/fixtures scripts/pseudonymise-fixtures.mjs`
Expected: all PASS — the scan test green for every file, the ALGI case green, every chapter/resolver test green. Then `npx vitest run` (full suite): all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A lib/demo/fixtures scripts/pseudonymise-fixtures.mjs lib/demo
git commit -m "feat(demo): pseudonymise the product references in every fixture"
```

---

### Task 3: The walker's deny list, provenance notes, verification

**Files:**
- Modify: `scripts/walk-demo.mjs` (LEAKS gains the originals), `lib/demo/fixtures/chapter-email.ts` and `lib/demo/fixtures/techdoc-turns.ts` (header comments: one sentence on the pseudonym layer), `lib/demo/fixtures/chapter-memory.ts` (same)
- Modify: this plan (Verification)

- [ ] **Step 1: The deny list**

In `scripts/walk-demo.mjs`'s `LEAKS` array add, with a comment:

```js
      // The reference customers' real product identifiers (sub-project 7,
      // lib/demo/fixtures/pseudonyms.ts): none may reach a screen.
      /(?<![A-Za-z])FST-?2XT|(?<![A-Za-z])FST-?[23](?![A-Za-z])|(?<![A-Za-z])FST(?![A-Za-z])|(?<![A-Za-z])fst2|FSM2|EAZ-?TFT/,
      /(?<![A-Za-z])AZKBZ|(?<![A-Za-z])AZK(?![A-Za-z])|DISA-|Giehl|G47490|\b(134466|118112|113139|140700|105070|105068|105177|120629|118126|114446|113645|113089)\b/,
```

`node --check scripts/walk-demo.mjs`.

- [ ] **Step 2: Provenance notes**

Add to the header comment of `lib/demo/fixtures/chapter-email.ts` (after the paragraph on redaction): "A second layer, applied 2026-10-15: product identifiers (cylinder and seal-kit types, article numbers, the company's legal name inside the session text) are pseudonymised by lib/demo/fixtures/pseudonyms.ts — the mapping is the record." Same sentence, adjusted, in `techdoc-turns.ts` ("the FST controller family reads KS here") and `chapter-memory.ts`.

Run: `npx vitest run lib/demo/fixtures/pseudonyms.test.ts && npx eslint --no-warn-ignored lib/demo/fixtures/chapter-email.ts lib/demo/fixtures/techdoc-turns.ts lib/demo/fixtures/chapter-memory.ts scripts/walk-demo.mjs`
Expected: PASS.

```bash
git add scripts/walk-demo.mjs lib/demo/fixtures/chapter-email.ts lib/demo/fixtures/techdoc-turns.ts lib/demo/fixtures/chapter-memory.ts
git commit -m "feat(demo): the walker refuses the original product identifiers; provenance notes"
```

- [ ] **Step 3: Ask Daniel to build and serve**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 4: Walk and spot-check**

`DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs` — expected **36/36**, `leaks=none`, 3 Tabs.

Spot (Playwright, scratch directory): `techdoc.0` after the stream — the answer names KS-2XT and cites `mia_ks2-2s_2015-05_de.pdf`, the trace line reads "Produktname in der Frage erkannt: KS"; `memory.0` — the question and answer name KS-2; `memory.3` — the memory rows read KS-2XT; `aufnahme.3` — the items table lists `KS2XTchanges-customer-DE.docx`, `KSBugFixes.docx`, `DPTFT-110_changes.doc`; `email.3` — the thread shows HKB 110, DS-T-HK-110, DS-SHK-110, article numbers 418112/413139/434466, "AHT Hydraulik GmbH", "⟨AHT Vertrieb⟩"; `config.3` — the vocabulary list has no FST entry left (or reads KS). Grep each screen's `main` text with the two LEAKS patterns above: no match.

- [ ] **Step 5: Record and commit**

Append `## Verification` to this plan. `git add docs/superpowers/plans/2026-10-15-demo-tour-pseudonyms.md && git commit -m "docs(demo): record the pseudonyms walk"`.
