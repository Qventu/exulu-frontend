# Demo Tour Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product screens the tour visits read as German, Sie-form, OPEN-branded sales surfaces: no developer copy or English leaks, EUR on the cost screens, one Zurück/Weiter pair in the wizard, dates that stay recent, a curated meeting list whose numbers the copy matches, and a sidebar that promises only what the tour shows.

**Architecture:** One demo-scoped string table (`lib/demo/overlays.ts`) read through `isDemoMode()` at six product call sites; three pure helpers with node tests (currency choice, date shifting, citation-fragment stripping) wired into the demo Apollo link, the server fetcher and the markdown parser; fixture curation with the chapter-10 copy computed from the fixture it describes; a nav allowlist tested against the chapters; CSS and an outside-click guard for the wizard; and a walker deny-list for known English leaks.

**Tech Stack:** Next.js 16 app router, React 19, Apollo Client 3.14, next-intl, vitest (node environment, `**/*.test.ts` only), Playwright outside the repo for `scripts/walk-demo.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` — sub-project 3, decisions D4, D6, D7, D8.

**Branch:** `fix/demo-tour-overlays` from `main` (b45c652).

**Spec clarifications carried by this plan** (write them into the spec in Task 10):
- D4 (sidebar and palette allowlist) is implemented here, not in sub-project 5; sub-project 5 extends the allowlist when it adds `/memory` and `/models`. The allowlist is a static set in `lib/demo/nav-routes.ts`, tested against `CHAPTERS`, so the shell never imports the chapter modules.
- `EMPTY_STATES` covers the two empty states that actually render on the Weiter path (knowledge library on `struktur.0`, knowledge items on `aufnahme.0`). The evals list and routine runs are populated by fixtures since sub-project 1 and need no empty-state copy.
- The agent editor's "0 Wissensdatenbanken" is already "7 Wissensdatenbanken" on the current build (October's `EditorContexts` resolver fixed it); no task, verified in Task 10.
- Tool-card STATUS labels ("Completed", "Running"…) are hardcoded English in `components/ai-elements/tool.tsx` with no i18n key; they get a demo-mode German table next to `TOOL_LABELS`. A product-wide translation is a follow-up outside this plan.
- "Schulung Alfredo" / "KI Agent - Schulung Alfredo" STAY in the meeting list: ALFREDO is ALGI's own spare-parts agent (chapter 9), so they are a believable callback, not vendor onboarding. Eight rows go (test, untitled, catch-up), not ten.
- German retrieval trace lines are sub-project 4 (they belong with the search beat), not here.

## Global Constraints

- Node 22.18.0 for anything that builds; `npx vitest run`/`npx eslint` run on any Node.
- Daniel runs the production build and server (`NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`, then `… npx next start -p 3111`); the executor never runs `next build`. Only product-file changes need a rebuild; walker-only changes do not.
- Demo flag `NEXT_PUBLIC_DEMO_MODE=true`, inlined at build time; every product change in this plan is behind `isDemoMode()` from `@/lib/demo/flag` except the three the spec names as correct everywhere (here: the citation-fragment stripper).
- New German is Sie-form, drafted here, listed in the plan's "Copy for sign-off" section for Daniel + Doro. Existing chapter copy is edited only where this plan names the sentence (chapter 10's count sentence and title, both now computed).
- Client names (NEW Lift, ALGI) only in `lib/demo/chapters/contact.ts` — test-enforced; "ALGI_" identifiers in fixtures are fine.
- Resolver keys are the operation names in the product's gql documents.
- `components/shell/nav-config.test.ts` is a pre-existing failure (memory note); do not use it as a gate.
- Commit after every task; never push.

## Review Focus

1. A legit brace in streamed prose (a JSON code block `{"a":`, a `{x}` in a sentence) must not be stripped by the citation-fragment rule — Task 2 tests `{"a":` and `{foo` and a complete `{x: 1}`.
2. A resolver that emits a wall-clock timestamp (`chapter-memory.ts:116` `new Date().toISOString()` for the correction memory) must not be shifted into the future — Task 7 tests the 48-hour cutoff.
3. Relative ordering of shifted dates must be preserved and a non-date string that looks numeric ("FST-2XT", "2026-09", an id) must be untouched — Task 7 tests both.
4. A non-demo deployment must see USD and `en-US` exactly as before — Task 5 tests `spendCurrency(false)`.
5. The nav allowlist and the chapters must not drift apart: every route a step visits is allowed and every allowed route is visited — Task 8's test asserts both directions.

---

### Task 1: The overlay table

**Files:**
- Create: `lib/demo/overlays.ts`
- Create: `lib/demo/overlays.test.ts`

**Interfaces:**
- Produces: `contextDisplayName(id: string): string`; `TOOL_LABELS: Record<string, string>`; `toolLabel(name: string): string`; `TOOL_STATUS_LABELS: Record<ToolState, string>` where `ToolState = "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied"`; `EMPTY_STATES.knowledgeLibrary` / `EMPTY_STATES.knowledgeItems`: `{ title: string; description: string }`; `KNOWLEDGE_LIBRARY: { description: string; hint: string }`.
- Consumes: `CONTEXTS` from `lib/demo/fixtures/contexts.ts` (seven contexts with German `name`).

- [ ] **Step 1: Write the failing test**

`lib/demo/overlays.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { CONTEXTS } from "./fixtures/contexts";
import {
  contextDisplayName,
  EMPTY_STATES,
  KNOWLEDGE_LIBRARY,
  TOOL_STATUS_LABELS,
  toolLabel,
} from "./overlays";

describe("contextDisplayName", () => {
  it("returns the fixture's German name for every demo context", () => {
    for (const c of CONTEXTS) expect(contextDisplayName(c.id)).toBe(c.name);
    expect(contextDisplayName("software_documentation_context")).toBe("Software-Dokumentation");
  });

  it("humanises an id it does not know instead of leaking underscores", () => {
    expect(contextDisplayName("some_other_context")).toBe("Some other context");
  });
});

describe("toolLabel", () => {
  it("names the two tools the tour shows", () => {
    expect(toolLabel("Context_Search")).toBe("Wissenssuche");
    expect(toolLabel("Create_Newton_Memory_Item")).toBe("Gedächtnis-Eintrag gespeichert");
  });

  it("humanises an unknown tool name", () => {
    expect(toolLabel("Send_Email")).toBe("Send Email");
  });
});

describe("the German tables", () => {
  const sie = (s: string) => !/\b(du|dein|deine|deinem|deinen|deiner)\b/i.test(s);

  it("cover every tool state", () => {
    expect(Object.keys(TOOL_STATUS_LABELS).sort()).toEqual([
      "approval-requested", "approval-responded", "input-available", "input-streaming",
      "output-available", "output-denied", "output-error",
    ]);
  });

  it("are Sie-form, non-empty, and end empty-state descriptions with a sentence", () => {
    for (const s of Object.values(TOOL_STATUS_LABELS)) { expect(s).toBeTruthy(); expect(sie(s)).toBe(true); }
    for (const e of Object.values(EMPTY_STATES)) {
      expect(e.title).toBeTruthy();
      expect(e.description.trim().endsWith(".")).toBe(true);
      expect(sie(e.title) && sie(e.description)).toBe(true);
    }
    expect(sie(KNOWLEDGE_LIBRARY.description) && sie(KNOWLEDGE_LIBRARY.hint)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/overlays.test.ts`
Expected: FAIL — cannot find module `./overlays`.

- [ ] **Step 3: Write the table**

`lib/demo/overlays.ts`:

```ts
import { CONTEXTS } from "./fixtures/contexts";

/**
 * Demo-only German for product surfaces the tour visits.
 *
 * The product renders backend identifiers and developer copy in a few
 * places a prospect sees: context ids as citation labels, tool names as
 * card titles, English status badges, and du-form empty states addressed
 * to the developer who defines contexts in code. None of that belongs in
 * the shared message catalogues (every deployment would carry it), so it
 * lives here and is read through `isDemoMode()` at the call site.
 *
 * Every string is Sie-form and drafted for sign-off (plan 2026-10-14
 * demo-tour-overlays, "Copy for sign-off").
 */

const CONTEXT_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  CONTEXTS.map((c) => [c.id, c.name]),
);

/** "software_documentation_context" → "Software-Dokumentation"; unknown ids are humanised. */
export function contextDisplayName(id: string): string {
  return CONTEXT_DISPLAY_NAMES[id] ?? humanise(id);
}

export const TOOL_LABELS: Record<string, string> = {
  Context_Search: "Wissenssuche",
  Create_Newton_Memory_Item: "Gedächtnis-Eintrag gespeichert",
};

/** The tool card's title: a known label, or the name with underscores spaced. */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

/** components/ai-elements/tool.tsx hardcodes these in English; the demo shows German. */
export const TOOL_STATUS_LABELS: Record<ToolState, string> = {
  "input-streaming": "Wartet",
  "input-available": "Läuft",
  "approval-requested": "Freigabe erforderlich",
  "approval-responded": "Beantwortet",
  "output-available": "Abgeschlossen",
  "output-error": "Fehler",
  "output-denied": "Abgelehnt",
};

/** The two empty states a Weiter-only visitor meets: struktur.0 and aufnahme.0. */
export const EMPTY_STATES = {
  knowledgeLibrary: {
    title: "Noch keine Wissensbasis angelegt",
    description:
      "Jede Wissensart bekommt ihre eigene Basis mit eigenen Regeln. Im nächsten Schritt werden die ersten angelegt.",
  },
  knowledgeItems: {
    title: "Noch keine Dokumente in dieser Wissensbasis",
    description:
      "Dokumente kommen aus Ihren Ablagen — per Freigabe, Laufwerk oder Anbindung. Im nächsten Schritt läuft die Aufnahme.",
  },
} as const;

/** /data's page header: the product addresses a developer; the tour addresses a buyer. */
export const KNOWLEDGE_LIBRARY = {
  description: "Die Wissensbasen, aus denen Ihre Assistenten antworten.",
  hint: "Jede Basis hat eigene Regeln für Aufnahme, Suche und Zugriff.",
} as const;

function humanise(id: string): string {
  const words = id.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/overlays.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint and commit**

```bash
npx eslint lib/demo/overlays.ts lib/demo/overlays.test.ts
git add lib/demo/overlays.ts lib/demo/overlays.test.ts
git commit -m "feat(demo): the German overlay table for product surfaces the tour visits

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Chat surfaces read the overlays; a half-streamed citation never shows

**Files:**
- Create: `lib/chat/strip-incomplete-citation.ts`
- Create: `lib/chat/strip-incomplete-citation.test.ts`
- Modify: `components/ai-elements/response.tsx:34-38` (parseIncompleteMarkdown guard) and `:431` (chip label)
- Modify: `components/message-renderer-tool-data.ts:116-123`
- Modify: `app/(application)/chat/components/message-column.tsx:121-125` and `:178-184`
- Modify: `components/ai-elements/tool.tsx:39-47`

**Interfaces:**
- Produces: `stripIncompleteCitation(text: string): string`.
- Consumes: `contextDisplayName`, `toolLabel`, `TOOL_STATUS_LABELS` from Task 1; `isDemoMode` from `@/lib/demo/flag` (already imported in response.tsx, add elsewhere).

- [ ] **Step 1: Write the failing test**

`lib/chat/strip-incomplete-citation.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { stripIncompleteCitation } from "./strip-incomplete-citation";

describe("stripIncompleteCitation", () => {
  it("drops an unterminated knowledge-source marker at the end of a stream", () => {
    expect(stripIncompleteCitation("Die Meldung bezieht sich auf {item_name: FST Meldung, item_id: 3")).toBe(
      "Die Meldung bezieht sich auf ",
    );
  });

  it("drops the first characters of one, including a lone brace", () => {
    expect(stripIncompleteCitation("Fahrkorbtableau) {")).toBe("Fahrkorbtableau) ");
    expect(stripIncompleteCitation("Fahrkorbtableau) { item_na")).toBe("Fahrkorbtableau) ");
  });

  it("leaves a completed marker for the renderer", () => {
    const s = "text {item_name: A, item_id: 1, context: c, chunk_id: x, chunk_index: 0} more";
    expect(stripIncompleteCitation(s)).toBe(s);
  });

  it("leaves braces that are not a citation", () => {
    expect(stripIncompleteCitation('```json\n{"a":')).toBe('```json\n{"a":');
    expect(stripIncompleteCitation("set {foo")).toBe("set {foo");
    expect(stripIncompleteCitation("no braces here")).toBe("no braces here");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/chat/strip-incomplete-citation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`lib/chat/strip-incomplete-citation.ts`:

```ts
/**
 * Removes a knowledge-source citation marker that has started but not yet
 * closed at the end of streamed text.
 *
 * The renderer turns `{item_name: …, item_id: …}` into a chip only once the
 * closing brace has arrived (components/message-renderer.tsx, the
 * flexibleCitationRegex). Until then the raw marker rendered as prose — a
 * visitor watching chapter 5 saw `{item_name: FST Meldung, item_id: …` for a
 * few hundred milliseconds before it snapped into a chip.
 *
 * Conservative on purpose: only an unterminated brace whose body is a prefix
 * of `item_name` (or empty) is cut. A JSON block, `{x}` in a sentence or a
 * completed marker is left alone.
 */
export function stripIncompleteCitation(text: string): string {
  const open = text.lastIndexOf("{");
  if (open === -1) return text;
  const tail = text.slice(open + 1);
  if (tail.includes("}")) return text;
  const body = tail.trimStart();
  const probe = body.slice(0, "item_name".length);
  if (body === "" || "item_name".startsWith(probe)) return text.slice(0, open);
  return text;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/chat/strip-incomplete-citation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the parser**

In `components/ai-elements/response.tsx` add the import:

```ts
import { stripIncompleteCitation } from "@/lib/chat/strip-incomplete-citation";
```

and change the start of `parseIncompleteMarkdown` (lines 34-38) from

```ts
function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;
```

to

```ts
function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Before the markdown rules: a citation marker is not markdown, and half
  // of one must not reach the screen (see lib/chat/strip-incomplete-citation).
  let result = stripIncompleteCitation(text);
```

- [ ] **Step 6: The chip label**

In `components/ai-elements/response.tsx`, add `import { contextDisplayName } from "@/lib/demo/overlays";` and change line 431 from

```ts
  const contextLabel = context.replaceAll('_', ' ');
```

to

```ts
  // The demo names the knowledge base as the Wissen page does; the product
  // shows the id with underscores spaced (and Title Case via the class).
  const contextLabel = isDemoMode() ? contextDisplayName(context) : context.replaceAll('_', ' ');
```

- [ ] **Step 7: The retrieval card's context names**

In `components/message-renderer-tool-data.ts`, add the imports:

```ts
import { isDemoMode } from "@/lib/demo/flag";
import { contextDisplayName } from "@/lib/demo/overlays";
```

and change lines 116-123 from

```ts
  const uniqueContexts = new Set(
    chunks?.map((chunk) =>
      chunk.context?.name ? chunk.context.name.replaceAll("_", " ") : "",
    ),
  );
  const contextNames = Array.from(uniqueContexts).join(", ");
```

to

```ts
  const labelFor = (name: string) =>
    isDemoMode() ? contextDisplayName(name) : name.replaceAll("_", " ");
  const uniqueContexts = new Set(
    chunks?.map((chunk) => (chunk.context?.name ? labelFor(chunk.context.name) : "")),
  );
  const contextNames = Array.from(uniqueContexts).join(", ");
```

- [ ] **Step 8: The tool card's title and status**

In `app/(application)/chat/components/message-column.tsx`, add:

```ts
import { isDemoMode } from "@/lib/demo/flag";
import { toolLabel } from "@/lib/demo/overlays";
```

After the four `styleToolName` lines (121-125) add:

```ts
    // The demo names the tool in German ("Wissenssuche", "Gedächtnis-Eintrag
    // gespeichert"); the product shows the raw name with underscores spaced.
    const rawToolName = (untypedToolPart.type ?? "").replace(/^tool-/, "");
    const toolTitle = isDemoMode() ? toolLabel(rawToolName) : styleToolName;
```

and in the `<ToolHeader … />` at lines 178-184 change `title={styleToolName}` to `title={toolTitle}`.

In `components/ai-elements/tool.tsx`, add:

```ts
import { isDemoMode } from "@/lib/demo/flag";
import { TOOL_STATUS_LABELS } from "@/lib/demo/overlays";
```

and change `getStatusBadge` (lines 39-47) so the English table is the fallback:

```ts
const getStatusBadge = (status: ToolUIPart["state"]) => {
  const english: Record<ToolUIPart["state"], string> = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "approval-requested": "Awaiting Approval",
    "approval-responded": "Responded",
    "output-available": "Completed",
    "output-error": "Error",
    "output-denied": "Denied",
  };
  // No i18n key exists for these; the demo shows German, the product is unchanged.
  const labels = isDemoMode() ? TOOL_STATUS_LABELS : english;
```

(the `icons` table and the `return` that reads `labels[status]` stay exactly as they are).

- [ ] **Step 9: Lint, run the chat tests, commit**

Run: `npx eslint components/ai-elements/response.tsx components/message-renderer-tool-data.ts "app/(application)/chat/components/message-column.tsx" components/ai-elements/tool.tsx lib/chat/strip-incomplete-citation.ts && npx vitest run lib/chat lib/demo/chat-transport.test.ts lib/demo/script.test.ts`
Expected: eslint clean (pre-existing warnings only); tests PASS.

```bash
git add lib/chat/strip-incomplete-citation.ts lib/chat/strip-incomplete-citation.test.ts components/ai-elements/response.tsx components/message-renderer-tool-data.ts "app/(application)/chat/components/message-column.tsx" components/ai-elements/tool.tsx
git commit -m "feat(demo): German knowledge-base, tool and status labels in the chat; hide half-streamed citations

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The knowledge pages speak to the buyer

**Files:**
- Modify: `app/(application)/data/components/context-library.tsx:86-95`
- Modify: `app/(application)/data/components/library-empty.tsx:27-40`
- Modify: `app/(application)/data/[ctx]/components/items-empty.tsx:44-61`

**Interfaces:**
- Consumes: `EMPTY_STATES`, `KNOWLEDGE_LIBRARY` from Task 1; `isDemoMode`.

- [ ] **Step 1: The page header**

In `context-library.tsx` add the imports:

```ts
import { isDemoMode } from "@/lib/demo/flag";
import { KNOWLEDGE_LIBRARY } from "@/lib/demo/overlays";
```

and change lines 86-95 to:

```tsx
      <PageHeader
        title={t("library.title")}
        // The product addresses the developer who defines contexts in code
        // (du-form, "Backend"); the tour addresses a buyer.
        description={isDemoMode() ? KNOWLEDGE_LIBRARY.description : t("library.description")}
        meta={
          <span className="inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>{isDemoMode() ? KNOWLEDGE_LIBRARY.hint : t("library.backendHint")}</span>
          </span>
        }
      />
```

- [ ] **Step 2: The library empty state**

Replace the body of `LibraryEmpty` in `library-empty.tsx` (lines 27-40) with:

```tsx
export function LibraryEmpty({ docsHref = "/explorer" }: LibraryEmptyProps) {
  const t = useTranslations("knowledge");
  // struktur.0 opens on this screen under "Wissen braucht einen Ort". The
  // product's copy ("Kontexte werden im Code … definiert", "Doku ansehen")
  // is for a developer; the demo tells the visitor what happens next and
  // offers no link out of the tour.
  const copy = isDemoMode()
    ? { ...EMPTY_STATES.knowledgeLibrary, action: undefined }
    : {
        title: t("library.empty.title"),
        description: t("library.empty.description"),
        action: { label: t("library.empty.viewDocs"), href: docsHref },
      };
  return (
    <EmptyState icon={Database} title={copy.title} description={copy.description} action={copy.action} />
  );
}
```

with the imports `import { isDemoMode } from "@/lib/demo/flag";` and `import { EMPTY_STATES } from "@/lib/demo/overlays";`. If `EmptyState`'s `action` prop is not optional-undefined-friendly, spread conditionally: `{...(copy.action ? { action: copy.action } : {})}`.

- [ ] **Step 3: The items empty state**

In `items-empty.tsx` add `import { isDemoMode } from "@/lib/demo/flag";` and `import { EMPTY_STATES } from "@/lib/demo/overlays";`, then replace the no-filter return (lines 44-61) with:

```tsx
  // aufnahme.0 opens on this screen under "Niemand lädt das von Hand hoch".
  // The product invites the visitor to add or import a document; in the
  // tour both buttons are inert and the next step fills the list, so the
  // demo says what is about to happen and offers nothing to click.
  const demo = isDemoMode();
  const copy = demo
    ? EMPTY_STATES.knowledgeItems
    : { title: t("workspace.items.noItemsTitle"), description: t("workspace.items.noItemsDescription") };
  return (
    <div className="flex flex-col items-center">
      <EmptyState
        icon={Database}
        title={copy.title}
        description={copy.description}
        action={
          !demo && onCreate
            ? { label: t("workspace.items.addFirst"), onClick: onCreate }
            : undefined
        }
      />
      {!demo && onImport && (
        <Button type="button" variant="outline" onClick={onImport} className="-mt-6 mb-6">
          <Upload aria-hidden="true" className="mr-2 size-4" />
          {t("workspace.import.trigger")}
        </Button>
      )}
    </div>
  );
```

- [ ] **Step 4: Lint, run the data tests, commit**

Run: `npx eslint "app/(application)/data/components/context-library.tsx" "app/(application)/data/components/library-empty.tsx" "app/(application)/data/[ctx]/components/items-empty.tsx" && npx vitest run "app/(application)/data"`
Expected: clean; PASS.

```bash
git add "app/(application)/data/components/context-library.tsx" "app/(application)/data/components/library-empty.tsx" "app/(application)/data/[ctx]/components/items-empty.tsx"
git commit -m "feat(demo): buyer-facing copy on the knowledge pages' header and empty states

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Fixtures the copy can stand on

**Files:**
- Modify: `lib/demo/fixtures/evals.ts:19-29, 61, 68, 75, 144, 163`
- Modify: `lib/demo/fixtures/algi-meetings.json` (delete eight rows)
- Create: `lib/demo/fixtures/meeting-tally.ts`
- Create: `lib/demo/fixtures/meeting-tally.test.ts`
- Modify: `lib/demo/fixtures/chapter-meetings.ts:7-8` (comment) and export `ALGI_MEETING_TALLY`
- Modify: `lib/demo/chapters/meetings.ts:23, 28`
- Modify: `lib/demo/resolvers.ts:171-172` (comment), `:597-603` (GetJobResults)
- Modify: `lib/demo/resolvers.budgets.test.ts` or `app/(application)/workflows/*.test.ts`: add the last-run test (see Step 6)

**Interfaces:**
- Produces: `meetingTally(meetings: { status: string; duration_seconds: number | null }[]): { count: number; hours: number; cancelled: number; failed: number; queued: number }`; `germanCount(n: number, feminine?: boolean): string` ("eine", "zwei", … up to zwölf, digits above); `ALGI_MEETING_TALLY`.
- Consumes: `ALGI_RUNS`, `ALGI_ROUTINE` from `fixtures/chapter-email.ts`; `page()` helper in resolvers.ts; `GET_JOB_RESULTS` from `app/(application)/workflows/queries.ts`.

- [ ] **Step 1: Write the failing tests**

`lib/demo/fixtures/meeting-tally.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ALGI_MEETINGS } from "./chapter-meetings";
import { germanCount, meetingTally } from "./meeting-tally";

describe("meetingTally", () => {
  it("counts recordings, hours and the untidy states", () => {
    const t = meetingTally([
      { status: "saved", duration_seconds: 3600 },
      { status: "saved", duration_seconds: 5400 },
      { status: "cancelled", duration_seconds: null },
      { status: "failed", duration_seconds: null },
      { status: "queued", duration_seconds: null },
    ]);
    expect(t).toEqual({ count: 5, hours: 3, cancelled: 1, failed: 1, queued: 1 });
  });

  it("describes the curated ALGI list: no test or untitled rows, the agent trainings kept", () => {
    const titles = ALGI_MEETINGS.map((m) => m.title.trim());
    for (const junk of ["Test", "Test Bild", "Untitled transcript", "Unbenanntes Transkript", "Alfredo - Catch up Meeting"]) {
      expect(titles, `${junk} should be gone`).not.toContain(junk);
    }
    expect(titles).toContain("Schulung Alfredo");
    const t = meetingTally(ALGI_MEETINGS);
    expect(t.count).toBe(20);
    expect(t.hours).toBe(13);
    expect(t.cancelled).toBe(1);
    expect(t.failed).toBe(1);
    expect(t.queued).toBe(2);
  });
});

describe("germanCount", () => {
  it("spells small counts out and leaves big ones as digits", () => {
    expect(germanCount(1, true)).toBe("eine");
    expect(germanCount(1)).toBe("ein");
    expect(germanCount(2)).toBe("zwei");
    expect(germanCount(13)).toBe("dreizehn");
    expect(germanCount(20)).toBe("zwanzig");
    expect(germanCount(21)).toBe("21");
    expect(germanCount(0)).toBe("keine");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run lib/demo/fixtures/meeting-tally.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper and curate the fixture**

`lib/demo/fixtures/meeting-tally.ts`:

```ts
/**
 * What chapter 10 says about the meeting list, computed from the list.
 *
 * The chapter used to say "28 Besprechungen … siebzehn Stunden … drei
 * abgebrochen" as literals. Curating the fixture (test and untitled rows
 * out) broke every one of them, which is the problem with literals: the
 * sentence and the screen drift apart silently. Both now read from here.
 */
export function meetingTally(
  meetings: { status: string; duration_seconds: number | null }[],
) {
  const seconds = meetings.reduce((sum, m) => sum + (m.duration_seconds ?? 0), 0);
  const count = (status: string) => meetings.filter((m) => m.status === status).length;
  return {
    count: meetings.length,
    hours: Math.round(seconds / 3600),
    cancelled: count("cancelled"),
    failed: count("failed"),
    queued: count("queued"),
  };
}

const WORDS = [
  "keine", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn",
  "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig",
];

/** "eine" / "zwei" / "dreizehn"; digits above twenty. `feminine` turns "ein" into "eine". */
export function germanCount(n: number, feminine = false): string {
  if (n === 1 && feminine) return "eine";
  return WORDS[n] ?? String(n);
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
```

In `lib/demo/fixtures/algi-meetings.json` delete the eight objects whose `id` starts with `6ab73637`, `379c76b7`, `1b2ebebe`, `3c019a14`, `1bb7ca01`, `1223bc1d`, `0cb019f2`, `df0ec67f` (titles: Untitled transcript ×2, Alfredo - Catch up Meeting, Test, Test Bild ×3, Unbenanntes Transkript). Use a node one-liner so the JSON stays valid:

```bash
node -e '
const fs=require("fs"); const f="lib/demo/fixtures/algi-meetings.json";
const drop=new Set(["6ab73637","379c76b7","1b2ebebe","3c019a14","1bb7ca01","1223bc1d","0cb019f2","df0ec67f"]);
const rows=JSON.parse(fs.readFileSync(f,"utf8")); const kept=rows.filter(r=>!drop.has(r.id.slice(0,8)));
if (kept.length!==20) throw new Error("expected 20 rows, got "+kept.length);
fs.writeFileSync(f, JSON.stringify(kept,null,2)+"\n");'
```

In `lib/demo/fixtures/chapter-meetings.ts` change the comment at lines 7-8 ("Twenty-eight of them, seventeen hours") to "Twenty of them, about thirteen hours (eight test, untitled and catch-up rows were removed on 2026-10-14; the two agent-training sessions stay — ALFREDO is ALGI's own agent, chapter 9)", and add:

```ts
import { meetingTally } from "./meeting-tally";
export const ALGI_MEETING_TALLY = meetingTally(ALGI_MEETINGS);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/demo/fixtures/meeting-tally.test.ts "app/(application)/transcriptions/demo-meetings.test.ts"`
Expected: PASS (the existing state assertions still hold: one cancelled row `20260731_VT - IT - Besprechung` and one failed row remain).

- [ ] **Step 5: Chapter 10 reads the tally**

In `lib/demo/chapters/meetings.ts` add:

```ts
import { ALGI_MEETING_TALLY as T } from "../fixtures/chapter-meetings";
import { capitalise, germanCount } from "../fixtures/meeting-tally";
```

Change the step title at line 23 from `"Siebzehn Stunden, die niemand nachhören wird"` to

```ts
    title: `${capitalise(germanCount(T.hours))} Stunden, die niemand nachhören wird`,
```

and the paragraph at line 28 from `"28 Besprechungen, aufgezeichnet von einem Bot, der einfach mitkommt — Produktionsplanung, Service, Schulung. Drei abgebrochen, eine fehlgeschlagen."` to

```ts
        text: `${T.count} Besprechungen, aufgezeichnet von einem Bot, der einfach mitkommt — Produktionsplanung, Service, Schulung. ${capitalise(germanCount(T.cancelled, true))} abgebrochen, ${germanCount(T.failed, true)} fehlgeschlagen.`,
```

(Keep the block's other fields. Both sentences are listed for sign-off.)

- [ ] **Step 6: The routine's last run**

Write the failing test first, in `lib/demo/resolvers.budgets.test.ts`'s sibling style — create `lib/demo/resolvers.routines.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { GET_JOB_RESULTS } from "@/app/(application)/workflows/queries";
import { ALGI_ROUTINE, ALGI_RUNS } from "./fixtures/chapter-email";
import { runDemoOperation } from "./test-support";

describe("the routine row's last run", () => {
  // useLastRunForPage asks job_results for the newest row whose label
  // contains the routine id. The row read "Noch nie ausgeführt" above 25
  // runs because the resolver only knew the evals' labels.
  it("is the newest ALGI run", async () => {
    const data = await runDemoOperation(
      GET_JOB_RESULTS,
      { page: 1, limit: 1, filters: [{ label: { contains: ALGI_ROUTINE.id } }], sort: { field: "createdAt", direction: "DESC" } },
      { chapter: "email", step: 0 },
    );
    const items = (data.job_resultsPagination as { items: { state: string; createdAt: string }[] }).items;
    const newest = [...ALGI_RUNS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    expect(items).toHaveLength(1);
    expect(items[0].state).toBe(newest.state);
    expect(items[0].createdAt).toBe(newest.createdAt);
  });
});
```

Run: `npx vitest run lib/demo/resolvers.routines.test.ts` → FAIL (items empty).

Then in `lib/demo/resolvers.ts` change `GetJobResults` (lines 597-603) to:

```ts
  GetJobResults: (_world, variables) => {
    const needle = filterValue(variables, "label");
    // The routines list asks for the newest job whose label carries the
    // routine id (useLastRunForPage). Answer it from the real runs; the
    // row read "Noch nie ausgeführt" above twenty-five of them.
    if (needle === ALGI_ROUTINE.id) {
      const newest = [...ALGI_RUNS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return {
        job_resultsPagination: {
          pageInfo: page(1),
          items: [
            {
              id: `lastrun-${newest.id}`,
              job_id: newest.id,
              state: newest.state,
              error: null,
              label: `routine:${ALGI_ROUTINE.id}`,
              result: null,
              metadata: null,
              createdAt: newest.createdAt,
              updatedAt: newest.createdAt,
            },
          ],
        },
      };
    }
    const items = needle
      ? EVAL_JOB_RESULTS.filter((row) => row.label.includes(needle))
      : EVAL_JOB_RESULTS;
    return { job_resultsPagination: { pageInfo: page(items.length), items } };
  },
```

Supply every field the document selects (`app/(application)/workflows/queries.ts:315-340`: `id job_id state error label result metadata createdAt updatedAt`; add any further selected field as `null`). Update the comment at resolvers.ts:171-172 ("twenty-eight on first paint") to "twenty".

Run: `npx vitest run lib/demo/resolvers.routines.test.ts` → PASS.

- [ ] **Step 7: Evals in German**

In `lib/demo/fixtures/evals.ts` replace the strings:

| Line | From | To |
|---|---|---|
| 19 | `"Technical documentation regression"` | `"Regression Technische Dokumentation"` |
| 20-21 | `"Fault codes, parameters and terminal assignments an engineer must get right first time."` | `"Fehlercodes, Parameter und Klemmenbelegungen, die ein Techniker auf Anhieb richtig bekommen muss."` |
| 27 | `"Standards & regulations"` | `"Normen & Vorschriften"` |
| 28-29 | `"Questions answerable only from EN/DIN/VDI sources, to catch answers drifting to product docs."` | `"Fragen, die nur aus EN-, DIN- und VDI-Quellen beantwortet werden dürfen — fängt Antworten ab, die in Produktdokumente abdriften."` |
| 61 | `"Nothalt COP in the FST fault memory"` | `"Nothalt COP im FST-Fehlerspeicher"` |
| 68 | `"LSU start-up fault on automatic reset"` | `"LSU-Anlauffehler bei automatischem Reset"` |
| 75 | `"FST-2XT parameters affecting the travel curve"` | `"FST-2XT-Parameter mit Einfluss auf die Fahrkurve"` |
| 144 | `"Nightly — gemini-3.1-pro"` | `"Nachtlauf — gemini-3.1-pro"` |
| 163 | `"Baseline — before vocabulary tuning"` | `"Basislinie — vor der Fachvokabular-Pflege"` |

No test asserts these literals (verified); `app/(application)/evals/demo-resolvers.test.ts` checks shapes only.

- [ ] **Step 8: Run the demo filter, lint, commit**

Run: `npx vitest run lib/demo "app/(application)/transcriptions" "app/(application)/evals" && npx eslint lib/demo/fixtures/meeting-tally.ts lib/demo/fixtures/chapter-meetings.ts lib/demo/chapters/meetings.ts lib/demo/resolvers.ts lib/demo/fixtures/evals.ts`
Expected: PASS; clean.

```bash
git add lib/demo/fixtures/evals.ts lib/demo/fixtures/algi-meetings.json lib/demo/fixtures/meeting-tally.ts lib/demo/fixtures/meeting-tally.test.ts lib/demo/fixtures/chapter-meetings.ts lib/demo/chapters/meetings.ts lib/demo/resolvers.ts lib/demo/resolvers.routines.test.ts
git commit -m "feat(demo): German eval names, a curated meeting list the copy is computed from, a real last run

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Euro in the demo (D7)

**Files:**
- Create: `lib/spend-currency.ts`
- Create: `lib/spend-currency.test.ts`
- Modify: `lib/budget.ts:110-118`
- Modify: `app/(application)/analytics/components/kpi-strip.tsx:35`, `trend-chart-card.tsx:45`, `donut-view.tsx:43`, `ranked-list.tsx:48`
- Modify: `lib/demo/chapters/kosten.ts:56-59` (comment)

**Interfaces:**
- Produces: `spendCurrency(demo?: boolean): { currency: "USD" | "EUR"; locale: string }`.

- [ ] **Step 1: Write the failing test**

`lib/spend-currency.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { spendCurrency } from "./spend-currency";

describe("spendCurrency", () => {
  it("keeps the product on USD and en-US", () => {
    expect(spendCurrency(false)).toEqual({ currency: "USD", locale: "en-US" });
  });

  it("shows the German demo its own currency", () => {
    expect(spendCurrency(true)).toEqual({ currency: "EUR", locale: "de-DE" });
  });

  it("formats a demo amount the German way", () => {
    const { currency, locale } = spendCurrency(true);
    expect(new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(213.19))
      .toBe("213,19 €");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/spend-currency.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

`lib/spend-currency.ts`:

```ts
import { isDemoMode } from "@/lib/demo/flag";

/**
 * Which currency and locale spend is displayed in.
 *
 * LiteLLM reports spend in USD and the product shows it that way. The demo
 * is a German sales surface, and a dollar sign on the cost screens read as
 * foreign to the buyers it was shown to; its FIXTURE values are declared
 * example figures on screen, so the display currency is a presentation
 * choice, not a conversion. `demo` is a parameter for the tests only.
 */
export function spendCurrency(demo: boolean = isDemoMode()): { currency: "USD" | "EUR"; locale: string } {
  return demo ? { currency: "EUR", locale: "de-DE" } : { currency: "USD", locale: "en-US" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/spend-currency.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it**

`lib/budget.ts:110-118` becomes:

```ts
/** Format a spend amount compactly (e.g. $19.50, $1,200 — or 19,50 € in the demo, see lib/spend-currency). */
export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const { currency, locale } = spendCurrency();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
```

with `import { spendCurrency } from "@/lib/spend-currency";`. (The name `formatUsd` stays; renaming its eleven call sites is not this plan's job.)

In each of the four analytics components replace the constant line:

```ts
const SPEND_CURRENCY = "USD";
```

(with its comment, where present) by

```ts
import { spendCurrency } from "@/lib/spend-currency";
// LiteLLM reports spend in USD; the demo displays EUR (lib/spend-currency).
const SPEND_CURRENCY = spendCurrency().currency;
```

(import at the top of the file, constant where it was). The locale in those components already comes from `useLocale()`, which is `de` in the demo.

In `lib/demo/chapters/kosten.ts:56-59` change the "Don't 'fix' the fixtures to EUR later" note to say: the fixtures stay USD-valued example figures; the DISPLAY is EUR in demo mode through lib/spend-currency.ts (2026-10-14).

- [ ] **Step 6: Lint, test, commit**

Run: `npx eslint lib/spend-currency.ts lib/budget.ts "app/(application)/analytics/components/kpi-strip.tsx" "app/(application)/analytics/components/trend-chart-card.tsx" "app/(application)/analytics/components/donut-view.tsx" "app/(application)/analytics/components/ranked-list.tsx" && npx vitest run lib/spend-currency.test.ts lib/budget.test.ts "app/(application)/budgets" "app/(application)/analytics"`
Expected: clean; PASS (if `lib/budget.test.ts` asserts `$` literals, they still pass: tests run without the demo flag).

```bash
git add lib/spend-currency.ts lib/spend-currency.test.ts lib/budget.ts "app/(application)/analytics/components/kpi-strip.tsx" "app/(application)/analytics/components/trend-chart-card.tsx" "app/(application)/analytics/components/donut-view.tsx" "app/(application)/analytics/components/ranked-list.tsx" lib/demo/chapters/kosten.ts
git commit -m "feat(demo): spend displays in EUR with de-DE formatting in demo mode

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: One Zurück/Weiter pair, and the wizard stays open when the panel is clicked

**Files:**
- Modify: `app/globals.css` (after the `[role="dialog"]` margin-right rule, ~line 560)
- Modify: `app/(application)/agents/edit/[id]/components/knowledge-search/wizard.tsx:88`

- [ ] **Step 1: Hide the wizard's own footer and close button in the tour**

Append to the demo block of `app/globals.css` (right after the `margin-right: var(--tour-panel-w, 0px)` rule):

```css
/* The agent-editor wizard (knowledge-search/wizard.tsx) has its own
 * "← Zurück / Weiter →" footer and a close button. In the tour both are
 * inert, and two Zurück/Weiter pairs on one screen was the most confusing
 * frame of the walkthrough. The footer is the step body's next sibling
 * (the body carries data-demo-id="agent-wizard-<step>"); the close is the
 * Sheet primitive's last child button. Scoped to the tour, so no
 * deployment loses a control. */
body[data-demo-tour="active"] [data-demo-id^="agent-wizard-"] + div,
body[data-demo-tour="active"] [role="dialog"] > button:last-child {
  display: none;
}
```

- [ ] **Step 2: Keep the Sheet open when the visitor clicks the panel**

In `wizard.tsx` add `import { isDemoMode } from "@/lib/demo/flag";` and change line 88 from

```tsx
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-2xl">
```

to

```tsx
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-2xl"
        // Radix dismisses on any pointerdown outside the layer, and the
        // docked tour panel is outside it: pressing Weiter closed the sheet
        // and the next step's ?wizard= reopened it, a slide-out and -in on
        // every step of chapter 7. The panel is not "outside" for the tour.
        onInteractOutside={(event) => {
          const target = event.detail.originalEvent.target;
          if (isDemoMode() && target instanceof Element && target.closest('[data-demo-id="tour-panel"]')) {
            event.preventDefault();
          }
        }}
      >
```

(`SheetContent` spreads its props onto `SheetPrimitive.Content` — `components/ui/sheet.tsx:57-67`.)

- [ ] **Step 3: Lint, commit**

Run: `npx eslint "app/(application)/agents/edit/[id]/components/knowledge-search/wizard.tsx"`
Expected: clean.

```bash
git add app/globals.css "app/(application)/agents/edit/[id]/components/knowledge-search/wizard.tsx"
git commit -m "feat(demo): one Zurück/Weiter pair on the wizard steps, and the panel does not dismiss the sheet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Dates that stay recent (D8)

**Files:**
- Create: `lib/demo/date-shift.ts`
- Create: `lib/demo/date-shift.test.ts`
- Modify: `lib/demo/apollo-link.ts:29-31`
- Modify: `lib/graphql/server.ts:43`

**Interfaces:**
- Produces: `DEMO_EPOCH = "2026-08-27T09:00:00.000Z"`; `demoDateOffsetMs(now?: number): number`; `shiftTimestamp(value: string, offsetMs: number): string`; `shiftDemoDates<T>(value: T, offsetMs: number): T`.

- [ ] **Step 1: Write the failing test**

`lib/demo/date-shift.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { DEMO_EPOCH, demoDateOffsetMs, shiftDemoDates, shiftTimestamp } from "./date-shift";

const DAY = 86_400_000;
const offset = 30 * DAY;

describe("shiftTimestamp", () => {
  it("shifts the three formats the fixtures use", () => {
    expect(shiftTimestamp("2026-05-12T22:35:14.453Z", offset)).toBe("2026-06-11T22:35:14.453Z");
    expect(shiftTimestamp("2026-01-06T08:26:08.91686+00:00", offset)).toBe("2026-02-05T08:26:08.916Z");
    expect(shiftTimestamp("2026-07-17 09:07:59.013+00", offset)).toBe("2026-08-16T09:07:59.013Z");
  });

  it("leaves the epoch sentinel and wall-clock timestamps alone", () => {
    expect(shiftTimestamp("1970-01-01T00:00:00.000Z", offset)).toBe("1970-01-01T00:00:00.000Z");
    // chapter-memory.ts writes the correction with new Date(): already "now".
    const recent = new Date(Date.parse(DEMO_EPOCH) + 3 * DAY).toISOString();
    expect(shiftTimestamp(recent, offset)).toBe(recent);
  });

  it("leaves strings that merely look like dates", () => {
    for (const s of ["2026-09", "FST-2XT", "2026-08-14", "d92dd3f2-2803-41e4-8136-a1a0ccb99e6c", ""]) {
      expect(shiftTimestamp(s, offset)).toBe(s);
    }
  });

  it("preserves order", () => {
    const a = shiftTimestamp("2026-08-14 09:22:37.236705+00", offset);
    const b = shiftTimestamp("2026-08-26T09:31:24.579Z", offset);
    expect(Date.parse(a)).toBeLessThan(Date.parse(b));
  });
});

describe("shiftDemoDates", () => {
  it("walks arrays and objects and returns the same shape", () => {
    const input = { items: [{ createdAt: "2026-07-17 09:07:59.013+00", title: "x", n: 3, nested: { at: "2026-05-12T22:35:14.453Z" } }], nothing: null };
    const out = shiftDemoDates(input, offset);
    expect(out.items[0].createdAt).toBe("2026-08-16T09:07:59.013Z");
    expect(out.items[0].nested.at).toBe("2026-06-11T22:35:14.453Z");
    expect(out.items[0].title).toBe("x");
    expect(out.items[0].n).toBe(3);
    expect(out.nothing).toBeNull();
  });
});

describe("demoDateOffsetMs", () => {
  it("is the distance from the fixture capture day to now", () => {
    expect(demoDateOffsetMs(Date.parse(DEMO_EPOCH) + 10 * DAY)).toBe(10 * DAY);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/date-shift.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the shifter**

`lib/demo/date-shift.ts`:

```ts
/**
 * Keeps the demo's timestamps recent.
 *
 * The fixtures were captured around 2026-08-27 and every relative date on
 * screen ("vor 7 Monaten", "letzten Monat", "jetzt") drifts as the demo
 * outlives them. The demo link shifts every timestamp it returns by the
 * distance between that capture day and now, so the story stays internally
 * consistent: documents a few days old, a chat from last week, a memory
 * written just now.
 *
 * Handles the three formats the fixtures use: ISO with Z, ISO with a numeric
 * offset and six-digit fraction, and Postgres "YYYY-MM-DD HH:MM:SS.ffffff+00".
 * Output is always ISO with Z. Two things are deliberately NOT shifted: the
 * epoch sentinel (resolvers.ts uses new Date(0) for "unknown"), and anything
 * already within two days of the capture day or later — a resolver that
 * stamps `new Date()` (chapter-memory.ts, the correction) is already "now"
 * and would otherwise land weeks in the future.
 */
export const DEMO_EPOCH = "2026-08-27T09:00:00.000Z";

const EPOCH_MS = Date.parse(DEMO_EPOCH);
const CUTOFF_MS = EPOCH_MS + 2 * 86_400_000;

const STAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,6})?(Z|[+-]\d{2}(?::?\d{2})?)$/;

export function demoDateOffsetMs(now: number = Date.now()): number {
  return now - EPOCH_MS;
}

export function shiftTimestamp(value: string, offsetMs: number): string {
  const m = STAMP.exec(value);
  if (!m) return value;
  const [, day, time, fraction = "", zone] = m;
  const ms = fraction ? fraction.slice(1, 4).padEnd(3, "0") : "000";
  const normalisedZone = zone === "Z" ? "Z" : zone.length === 3 ? `${zone}:00` : zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const parsed = Date.parse(`${day}T${time}.${ms}${normalisedZone}`);
  if (Number.isNaN(parsed) || parsed === 0 || parsed >= CUTOFF_MS) return value;
  return new Date(parsed + offsetMs).toISOString();
}

export function shiftDemoDates<T>(value: T, offsetMs: number): T {
  if (typeof value === "string") return shiftTimestamp(value, offsetMs) as T;
  if (Array.isArray(value)) return value.map((v) => shiftDemoDates(v, offsetMs)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = shiftDemoDates(v, offsetMs);
    return out as T;
  }
  return value;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/date-shift.test.ts`
Expected: PASS (6 tests). If the `+00:00` case's expected millisecond string differs (`.916` vs `.917`), keep truncation (`slice(1, 4)`) and fix the expectation to `.916Z`.

- [ ] **Step 5: Apply at both seams**

`lib/demo/apollo-link.ts`: add `import { demoDateOffsetMs, shiftDemoDates } from "./date-shift";` and change

```ts
      observer.next({
        data: resolver(getWorldForNow(), operation.variables ?? {}),
      });
```

to

```ts
      observer.next({
        data: shiftDemoDates(resolver(getWorldForNow(), operation.variables ?? {}), demoDateOffsetMs()),
      });
```

`lib/graphql/server.ts:43`: add the same import (`@/lib/demo/date-shift`) and change `return resolver(getWorld(position), variables ?? {});` to `return shiftDemoDates(resolver(getWorld(position), variables ?? {}), demoDateOffsetMs());`.

- [ ] **Step 6: Run the demo filter, lint, commit**

Run: `npx vitest run lib/demo "app/(application)/transcriptions" "app/(application)/evals" "app/(application)/data" "app/(application)/agents" && npx eslint lib/demo/date-shift.ts lib/demo/apollo-link.ts lib/graphql/server.ts`
Expected: PASS (tests go through `runDemoOperation`, which builds its own link via `test-support.ts` — if that helper uses `createDemoLink`, shifted dates reach the tests; any test asserting a literal fixture timestamp must compare against `shiftTimestamp(literal, demoDateOffsetMs())` instead — fix those tests, not the shifter); clean.

```bash
git add lib/demo/date-shift.ts lib/demo/date-shift.test.ts lib/demo/apollo-link.ts lib/graphql/server.ts
git commit -m "feat(demo): shift every fixture timestamp so the demo's dates stay recent

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The sidebar promises only what the tour shows (D4)

**Files:**
- Create: `lib/demo/nav-routes.ts`
- Create: `lib/demo/nav-routes.test.ts`
- Modify: `components/shell/nav-config.ts:414-422` (`visibleEntries`)

**Interfaces:**
- Produces: `DEMO_NAV_ROUTES: ReadonlySet<string>`; `visibleEntries(user, config, allow?: ReadonlySet<string>)` — third parameter new, defaulting to `isDemoMode() ? DEMO_NAV_ROUTES : undefined`.
- Consumes: `CHAPTERS` from `lib/demo/tour.ts` (test only); `getDemoUser()` from `lib/demo/user.ts` (test only; `super_admin: true`); `NAV_ENTRIES` is exported from nav-config.

- [ ] **Step 1: Write the failing test**

`lib/demo/nav-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { NAV_ENTRIES, visibleEntries } from "@/components/shell/nav-config";
import { DEMO_NAV_ROUTES } from "./nav-routes";
import { CHAPTERS } from "./tour";
import { getDemoUser } from "./user";

const topLevel = (route: string) => "/" + (route.split("?")[0].split("/")[1] ?? "");

describe("DEMO_NAV_ROUTES", () => {
  it("allows every route a step visits (scenes excepted — they are not in the nav)", () => {
    for (const chapter of CHAPTERS) {
      for (const step of chapter.steps) {
        const top = topLevel(step.route);
        if (top === "/demo") continue;
        expect(DEMO_NAV_ROUTES.has(top), `${chapter.id}.${step.id} visits ${top}`).toBe(true);
      }
    }
  });

  it("allows nothing the tour never visits", () => {
    const visited = new Set(CHAPTERS.flatMap((c) => c.steps.map((s) => topLevel(s.route))));
    visited.add("/");
    for (const route of DEMO_NAV_ROUTES) expect(visited.has(route), `${route} is allowed but never visited`).toBe(true);
  });

  it("filters the shell's entries down to the allowlist", () => {
    const user = getDemoUser();
    const entries = visibleEntries(user, {}, DEMO_NAV_ROUTES);
    expect(entries.map((e) => e.route).sort()).toEqual([...DEMO_NAV_ROUTES].sort());
    // and without the allowlist the super-admin sees the whole product
    expect(visibleEntries(user, {}, undefined).length).toBeGreaterThan(entries.length);
    expect(NAV_ENTRIES.length).toBeGreaterThan(entries.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/demo/nav-routes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the allowlist and the filter**

`lib/demo/nav-routes.ts`:

```ts
/**
 * The product areas the guided tour visits, by top-level route.
 *
 * The demo user is a super-admin, so the sidebar would offer all 23 areas —
 * fourteen of them with nothing behind them but the "nicht Teil der Demo"
 * notice. A prospect reads that as a half-finished product. The shell
 * filters its entries to this set in demo mode (D4); the command palette
 * goes through the same function.
 *
 * Static on purpose, and tested against the chapters in both directions
 * (lib/demo/nav-routes.test.ts): the shell must never import the chapter
 * modules, and the list must never drift from the tour. Sub-project 5
 * adds /memory and /models here when its chapters land.
 */
export const DEMO_NAV_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/chat",
  "/data",
  "/agents",
  "/evals",
  "/workflows",
  "/transcriptions",
  "/analytics",
  "/budgets",
]);
```

`components/shell/nav-config.ts`: add

```ts
import { isDemoMode } from "@/lib/demo/flag";
import { DEMO_NAV_ROUTES } from "@/lib/demo/nav-routes";
```

and change `visibleEntries` (lines 414-422) to:

```ts
export function visibleEntries(
  user: RightsUser,
  config: NavConfig,
  // Demo mode: only the areas the tour visits (lib/demo/nav-routes.ts).
  // A parameter so tests can exercise it without the build-time flag.
  allow: ReadonlySet<string> | undefined = isDemoMode() ? DEMO_NAV_ROUTES : undefined,
): NavEntry[] {
  return NAV_ENTRIES.filter(
    (entry) =>
      can(user, entry.requires) &&
      flagEnabled(config, entry.configFlag) &&
      (!allow || allow.has(entry.route)),
  );
}
```

`groupsFor` and the command palette both call `visibleEntries(user, config)` and need no change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/demo/nav-routes.test.ts lib/demo/supported-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, commit**

Run: `npx eslint components/shell/nav-config.ts lib/demo/nav-routes.ts lib/demo/nav-routes.test.ts`
Expected: clean.

```bash
git add lib/demo/nav-routes.ts lib/demo/nav-routes.test.ts components/shell/nav-config.ts
git commit -m "feat(demo): the sidebar and palette list only the areas the tour visits

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The walker spots the known leaks

**Files:**
- Modify: `scripts/walk-demo.mjs` (per-step probe, next to `row.contentVisible`; the `allPass` expression; the console line)

- [ ] **Step 1: Add the deny-list probe**

Next to the `row.contentVisible` block add:

```js
    // Known English and developer leaks the overlays exist to remove. A
    // guard against regression, not a proof of German: any match fails the
    // step and names the snippet.
    const LEAKS = [
      /\b(Completed|Running|Pending|Awaiting Approval|Responded|Denied)\b/,
      /\b(deinem|deinen|deiner|deine|dein)\b/,
      /Doku ansehen/,
      /Create Newton Memory Item/,
      /software documentation context|support tickets context|tech doc context/i,
      /Technical documentation regression|Standards & regulations|Nightly —|Baseline —/,
      /Untitled transcript|Unbenanntes Transkript|Test Bild/,
      /\$\s?\d/,
      /Noch nie ausgeführt/,
    ];
    row.leaks = await page.evaluate((patterns) => {
      const text = (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ");
      return patterns
        .map((p) => new RegExp(p.source, p.flags).exec(text)?.[0] ?? null)
        .filter(Boolean);
    }, LEAKS.map((r) => ({ source: r.source, flags: r.flags })));
```

(The `LEAKS` list ships regex sources into the page because functions do not serialise.) Add `row.leaks.length === 0 &&` to the `allPass` expression, and ` leaks=${row.leaks.length ? JSON.stringify(row.leaks) : "none"}` to the console line.

- [ ] **Step 2: Syntax-check, commit**

Run: `node --check scripts/walk-demo.mjs`
Expected: ok.

```bash
git add scripts/walk-demo.mjs
git commit -m "test(demo): fail a step that shows a known English or developer leak

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Verify on Daniel's build; spec note; copy for sign-off

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md` (append a "Clarifications 2026-10-14 (sub-project 3)" paragraph with the six items from this plan's header)
- Modify: `docs/superpowers/plans/2026-10-14-demo-tour-overlays.md` (Verification and Copy-for-sign-off sections)

- [ ] **Step 1: Unit filter and the full suite**

Run: `npx vitest run`
Expected: all PASS except the pre-existing `components/shell/nav-config.test.ts` failure (compare against `main`: it fails there too). Any other failure blocks.

- [ ] **Step 2: Ask Daniel to build and serve**

The product changed in Tasks 2-8. Hand over:

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

Confirm the server serves this branch: `curl -s "http://localhost:3111/data?tour=struktur.0" | grep -c "Noch keine Wissensbasis angelegt"` prints `1`.

- [ ] **Step 3: Walk it**

From the Playwright scratch directory: `DEMO_BASE_URL=http://localhost:3111 node /Users/daniel.claessen/Desktop/Projects/exulu/frontend/scripts/walk-demo.mjs`
Expected: 37/37, `leaks=none` on every step, 3 Tabs to Weiter.

- [ ] **Step 4: Spot checks (Playwright script in the scratch directory)**

- `/analytics?dimension=teams&tour=kosten.0` and `/budgets?type=team&tour=kosten.1`: amounts contain `€`, none contain `$`.
- `/agents/edit/demo-agent-newton?wizard=sources&tour=config.1`: exactly one `Weiter` and one `Zurück` button visible in the viewport; the dialog's close button is hidden; clicking the panel's chapter-menu toggle leaves `[role="dialog"]` in the DOM.
- `/agents/edit/demo-agent-newton?tour=config.0`: the summary reads "7 Wissensdatenbanken"; the Langzeitgedächtnis picker shows "Assistenten-Gedächtnis".
- `/transcriptions?tour=meetings.0`: 20 rows across the groups; the panel's title reads "Dreizehn Stunden, die niemand nachhören wird" and the paragraph "20 Besprechungen … Eine abgebrochen, eine fehlgeschlagen."
- `/data?tour=struktur.2` and `/data/software_documentation_context?tour=aufnahme.3`: every relative date reads "vor N Tagen/Wochen" with the oldest under 60 days (compute from `innerText`, or parse the `<time datetime>` attributes if present).
- `/workflows?tour=email.0`: the routine row shows a last-run state and a relative time, not "Noch nie ausgeführt".
- `/chat/demo-agent-newton/session-demo-techdoc-1?tour=techdoc.2`: citation chips read "Software-Dokumentation - …" and "Support-Tickets - …"; the retrieval card title reads "Suchergebnisse: Software-Dokumentation"; sample the answer text every 100 ms during the stream and assert `{item_name` never appears.
- `/chat/demo-agent-newton/session-demo-memory-1?tour=memory.2` (or the route `memory.2` dumps): the tool card reads "Gedächtnis-Eintrag gespeichert" and "Abgeschlossen".
- Sidebar on any step: exactly nine entries (Start, Chat, Wissen, Agenten, Evaluationen, Routinen, Transkripte, Analytik, Budgets) and no Administration group beyond Budgets/Analytik; ⌘K lists the same.

- [ ] **Step 5: Record and commit**

Append `## Verification` (build id, walker result, each spot check) and `## Copy for sign-off` (every string from Task 1's tables, the nine German eval strings from Task 4, the two computed chapter-10 sentences with their current rendering) to this plan; append the clarifications paragraph to the spec.

```bash
git add docs/superpowers/plans/2026-10-14-demo-tour-overlays.md docs/superpowers/specs/2026-10-14-demo-tour-fix-design.md
git commit -m "docs(demo): record the overlays walk and list the copy for sign-off

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

## Verification

2026-10-14 — Daniel's production demo builds (final: 6026bcf, BUILD_ID zKRVqmGyzFo9IvcgAazO5), `next start -p 3111`, walked and probed with Playwright at 1440×900.

- Walker in Weiter mode: **37/37**, 36/36 transitions, `leaks=none` on every step, copy visible on all 33 non-scene steps, **3 Tabs to Weiter**. Earlier builds on this branch found and fixed: the evals click probe's English set name (harness), "Gedächtnis-Eintrag Gespeichert" (the product's `capitalize` class), fixtures dated months before the capture day (re-dated), English month names on the analytics axis (date-fns locale), the fourteen saved recordings missing from `/transcriptions` (`TranscriptItems` resolver), and shifted timestamps landing in the future ("in 23 Std.", clamp).
- `/analytics` and `/budgets`: amounts read `213,19 €`, `208 € / 250 €`; no `$` anywhere; axis `1. Okt. … 14. Okt.`.
- Wizard (`config.1`): one Weiter and one Zurück visible, the Sheet's close hidden, `[role="dialog"]` still present after a click in the panel.
- Editor (`config.0`): "7 Wissensdatenbanken · 5 Routing-Regeln · Gedächtnis aktiv", Langzeitgedächtnis shows "Assistenten-Gedächtnis".
- `/transcriptions`: 16 rows in "Diese Woche"/"Früher" (14 saved + 2 awaiting review) plus the "2 in Bearbeitung" strip and "Fehlgeschlagen 1"; the cancelled twentieth is counted in the copy ("Eine abgebrochen") and, as in the product, not listed. Panel: "Dreizehn Stunden, die niemand nachhören wird" / "20 Besprechungen … Eine abgebrochen, eine fehlgeschlagen." No test, untitled or catch-up rows.
- Relative dates: `/data/[ctx]` items "gestern" / "letzte Woche"; transcripts "vorgestern" … "letzten Monat"; routine "Fehler vor 23 Std."; no row anywhere reads "in …".
- Chat (`techdoc.0-2`): retrieval card "Suchergebnisse: Software-Dokumentation"; chips "Software-Dokumentation - …", "Support-Tickets - …"; the answer text sampled every 100 ms during the stream never contained `{item_name`; no English status badge. `memory.2`: "Gedächtnis-Eintrag gespeichert · Abgeschlossen".
- Knowledge pages: `/data` header "Die Wissensbasen, aus denen Ihre Assistenten antworten." / "Jede Basis hat eigene Regeln …"; `struktur.0` "Noch keine Wissensbasis angelegt"; no "Doku ansehen", no du-form.
- Sidebar: Start, Chat, Transkripte, Agenten, Wissen, Routinen, Evaluationen, and under Administration only Budgets and Analytik. The ⌘K palette could not be opened headlessly; it filters through the same `visibleEntries()` and is covered by `lib/demo/nav-routes.test.ts`.
- Unit: full suite 123 files / 1,251 tests at the eight-task point; demo filter re-run green after every later fix.

## Copy for sign-off

New visitor-facing German introduced by this plan (implementer drafts; Daniel + Doro sign off per the 2026-10-14 decision).

`lib/demo/overlays.ts`:

| Where | Text |
|---|---|
| Tool card title (`Context_Search`) | Wissenssuche |
| Tool card title (`Create_Newton_Memory_Item`) | Gedächtnis-Eintrag gespeichert |
| Tool status badges | Wartet · Läuft · Freigabe erforderlich · Beantwortet · Abgeschlossen · Fehler · Abgelehnt |
| `/data` header description | Die Wissensbasen, aus denen Ihre Assistenten antworten. |
| `/data` header hint | Jede Basis hat eigene Regeln für Aufnahme, Suche und Zugriff. |
| `/data` empty state (struktur.0) | **Noch keine Wissensbasis angelegt** — Jede Wissensart bekommt ihre eigene Basis mit eigenen Regeln. Im nächsten Schritt werden die ersten angelegt. |
| `/data/[ctx]` empty state (aufnahme.0) | **Noch keine Dokumente in dieser Wissensbasis** — Dokumente kommen aus Ihren Ablagen — per Freigabe, Laufwerk oder Anbindung. Im nächsten Schritt läuft die Aufnahme. |

`lib/demo/fixtures/evals.ts`: "Regression Technische Dokumentation" — "Fehlercodes, Parameter und Klemmenbelegungen, die ein Techniker auf Anhieb richtig bekommen muss."; "Normen & Vorschriften" — "Fragen, die nur aus EN-, DIN- und VDI-Quellen beantwortet werden dürfen — fängt Antworten ab, die in Produktdokumente abdriften."; cases "Nothalt COP im FST-Fehlerspeicher", "LSU-Anlauffehler bei automatischem Reset", "FST-2XT-Parameter mit Einfluss auf die Fahrkurve"; runs "Nachtlauf — gemini-3.1-pro", "Basislinie — vor der Fachvokabular-Pflege".

`lib/demo/chapters/meetings.ts` (computed from the fixture; current rendering): title "Dreizehn Stunden, die niemand nachhören wird"; paragraph "20 Besprechungen, aufgezeichnet von einem Bot, der einfach mitkommt — Produktionsplanung, Service, Schulung. Eine abgebrochen, eine fehlgeschlagen."

**Post-review build** (f40fb45, BUILD_ID ydTReO4g4Seubs9a4g6nC): walker **33/37** — the four chat steps (techdoc.0-2, contact.1) failed the NEW deny-list rule for English absolute dates: the retrieval card's document date read "Aug 27, 2026" (components/message-renderer.tsx formats it with en-US). Everything else held: zero other leaks, 3 Tabs to Weiter; with the epoch at 2026-08-28T12:00Z the capture-day recordings read "vor 3 Std." / "vor 6 Std." and nothing anywhere reads "vor 1 Minute" or "in …"; the evals matrix headers read "6. Okt. 2026 · 11:04" and "13. Okt. 2026 · 11:04"; knowledge items "vorgestern" / "letzte Woche"; routine "vorgestern"; chat session "gestern". Full suite 124 files / 1,257 tests. The chat date is fixed in the next commit and walked again below.

**Final build** (3a83522, BUILD_ID 2GDmNqm8ShD6Nyg3sTC47): walker **37/37**, zero deny-list leaks with the English-absolute-date rule in force, 3 Tabs to Weiter; the retrieval card's document date reads "27. Aug. 2026". Full suite 124 files / 1,257 tests at 3a83522.
