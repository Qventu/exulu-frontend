# Chat Composer Inline Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typing `/` in the chat composer autocompletes the agent's tools & skills, `@` autocompletes session-sandbox files; recognized tokens get a subtle inline purple highlight via a mirror overlay behind the existing textarea.

**Architecture:** All new code is route-local in `app/(application)/chat/components/composer-autocomplete/`. Pure logic (trigger detection, token matching, filtering, insertion) lives in `matching.ts` with node-environment vitest coverage. One coordinating hook (`use-composer-autocomplete.ts`) owns caret/trigger state, data sources, and keyboard handling. Two presentational components (`autocomplete-menu.tsx`, `highlight-overlay.tsx`) render the listbox and the highlight mirror. `composer.tsx` integration is minimal and additive.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Tailwind 3.4, Apollo Client (`useLazyQuery`), existing REST client `sessionFilesApi`, vitest (node env), next-intl.

**Spec:** `docs/superpowers/specs/2026-07-07-chat-input-autocomplete-design.md`. (The spec's `token-matching.ts` + `use-inline-trigger.ts` are realized as `matching.ts` + `use-composer-autocomplete.ts` — same responsibilities, one pure module + one hook.)

**Branch:** `feature/chat-input-autocomplete` (already created; spec committed).

## Global Constraints

- **Single-instance rule:** never call `useChatSession` outside `session-screen.tsx`; all chat state comes via the `controller: ChatSessionController` prop.
- **Text reference only:** selection inserts `/name` / `@filename` as plain text into the message. No POST-body changes, no backend changes, no tool re-enabling.
- **Trigger rule:** `/` and `@` only at word start (index 0 or after whitespace). `@` only when `controller.agent.sandbox_enabled`; `/` only when the agent has ≥1 tool or skill.
- **Disabled tools:** shown greyed with an "off" chip, still selectable (`controller.disabledTools`).
- **Insertion:** exact machine name + trailing space; skip insert if result would exceed `maxInputLength`.
- **Highlight style:** `bg-primary/10` rounded pill behind the text (purple house token style; amber is reserved for knowledge chips).
- **Do not touch** the transport invariants in `hooks.ts` (`prepareSendMessagesRequest`, localStorage keys) or the document-level Esc chain semantics in `composer.tsx:239-253` (the menu intercepts Escape *before* it via `stopPropagation`).
- **i18n:** every new string in BOTH `messages/en.json` and `messages/de.json`, under `chat.composer.autocomplete.*`. Verify with `npm run check-messages`.
- **Known-failing baseline (pre-existing on main, do NOT fix, do NOT add to):** nav-config vitest test, 31 `de` `variables.*` message keys, one `tsc` svg error, entity-types lint. Only NEW failures block.
- Lucide icons, `stroke-width` default per repo (icons get `className="size-4"` etc., no custom stroke props).
- Commit after each task on `feature/chat-input-autocomplete`.

---

### Task 1: Pure matching module (`matching.ts`) — TDD

**Files:**
- Create: `app/(application)/chat/components/composer-autocomplete/matching.ts`
- Test: `app/(application)/chat/components/composer-autocomplete/matching.test.ts`

**Interfaces:**
- Consumes: nothing (pure, zero imports).
- Produces (used by Tasks 3–5):
  - `interface ActiveTrigger { kind: "/" | "@"; start: number; query: string }`
  - `interface TokenRange { start: number; end: number; kind: "/" | "@" }`
  - `interface Suggestion { id: string; kind: "tool" | "skill" | "file"; name: string; displayName: string; description?: string; disabled?: boolean }`
  - `detectTrigger(text: string, caret: number, enabled: { slash: boolean; at: boolean }): ActiveTrigger | null`
  - `findTokenRanges(text: string, names: { slash: string[]; at: string[] }): TokenRange[]`
  - `filterSuggestions(items: Suggestion[], query: string): Suggestion[]`
  - `insertToken(text: string, trigger: ActiveTrigger, caret: number, name: string): { text: string; caret: number }`
  - `isAutoHidden(query: string, matchCount: number): boolean`

- [ ] **Step 1: Write the failing tests**

Create `app/(application)/chat/components/composer-autocomplete/matching.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  detectTrigger,
  filterSuggestions,
  findTokenRanges,
  insertToken,
  isAutoHidden,
  type Suggestion,
} from "./matching";

const BOTH = { slash: true, at: true };

describe("detectTrigger", () => {
  it("triggers on '/' as the first character", () => {
    expect(detectTrigger("/", 1, BOTH)).toEqual({ kind: "/", start: 0, query: "" });
  });

  it("triggers on '/' after whitespace with the query up to the caret", () => {
    expect(detectTrigger("hello /we", 9, BOTH)).toEqual({ kind: "/", start: 6, query: "we" });
  });

  it("uses the caret, not the end of text, for the query", () => {
    // caret placed right after "web" in "hello /web tail"
    expect(detectTrigger("hello /web tail", 10, BOTH)).toEqual({ kind: "/", start: 6, query: "web" });
  });

  it("does not trigger mid-word (fractions, emails, urls)", () => {
    expect(detectTrigger("3/4", 3, BOTH)).toBeNull();
    expect(detectTrigger("a@b.com", 7, BOTH)).toBeNull();
    expect(detectTrigger("https://x", 9, BOTH)).toBeNull();
  });

  it("allows spaces inside an '@' query (file names)", () => {
    expect(detectTrigger("@my rep", 7, BOTH)).toEqual({ kind: "@", start: 0, query: "my rep" });
  });

  it("treats a newline as a word start but never spans newlines", () => {
    expect(detectTrigger("line1\n/x", 8, BOTH)).toEqual({ kind: "/", start: 6, query: "x" });
    expect(detectTrigger("/a\nb", 4, BOTH)).toBeNull();
  });

  it("returns the nearest trigger before the caret", () => {
    expect(detectTrigger("@a /b", 5, BOTH)).toEqual({ kind: "/", start: 3, query: "b" });
  });

  it("skips disabled kinds", () => {
    expect(detectTrigger("@x", 2, { slash: true, at: false })).toBeNull();
    expect(detectTrigger("/x", 2, { slash: false, at: true })).toBeNull();
    // disabled '@' is skipped, but an earlier enabled '/' still wins
    expect(detectTrigger("/y @x", 5, { slash: true, at: false })).toEqual({
      kind: "/",
      start: 0,
      query: "y @x",
    });
  });

  it("returns null when the caret is before or at the trigger", () => {
    expect(detectTrigger("/web", 0, BOTH)).toBeNull();
  });
});

describe("findTokenRanges", () => {
  it("finds a known slash token at a word boundary", () => {
    expect(findTokenRanges("use /web_search now", { slash: ["web_search"], at: [] })).toEqual([
      { start: 4, end: 15, kind: "/" },
    ]);
  });

  it("prefers the longest matching name", () => {
    expect(findTokenRanges("/web_search", { slash: ["web", "web_search"], at: [] })).toEqual([
      { start: 0, end: 11, kind: "/" },
    ]);
  });

  it("matches file names containing spaces", () => {
    expect(findTokenRanges("@my report.pdf ok", { slash: [], at: ["my report.pdf"] })).toEqual([
      { start: 0, end: 14, kind: "@" },
    ]);
  });

  it("requires a word start before the trigger", () => {
    expect(findTokenRanges("3/4", { slash: ["4"], at: [] })).toEqual([]);
  });

  it("requires a boundary after the token", () => {
    expect(findTokenRanges("/web_searchx", { slash: ["web_search"], at: [] })).toEqual([]);
    // trailing punctuation is a valid boundary
    expect(findTokenRanges("/web_search.", { slash: ["web_search"], at: [] })).toEqual([
      { start: 0, end: 11, kind: "/" },
    ]);
  });

  it("is exact-case (machine names are inserted verbatim)", () => {
    expect(findTokenRanges("/Web_Search", { slash: ["web_search"], at: [] })).toEqual([]);
  });

  it("finds multiple tokens of mixed kinds", () => {
    expect(findTokenRanges("use /a and @f.txt", { slash: ["a"], at: ["f.txt"] })).toEqual([
      { start: 4, end: 6, kind: "/" },
      { start: 11, end: 17, kind: "@" },
    ]);
  });

  it("returns nothing for unknown names or empty name lists", () => {
    expect(findTokenRanges("/nope", { slash: ["web_search"], at: [] })).toEqual([]);
    expect(findTokenRanges("/web_search", { slash: [], at: [] })).toEqual([]);
  });
});

const sug = (name: string, extra?: Partial<Suggestion>): Suggestion => ({
  id: `tool:${name}`,
  kind: "tool",
  name,
  displayName: name.replace(/_/g, " "),
  ...extra,
});

describe("filterSuggestions", () => {
  const items = [sug("run_code"), sug("search_docs"), sug("web_search")];

  it("returns all items for an empty or whitespace-only query", () => {
    expect(filterSuggestions(items, "")).toEqual(items);
    expect(filterSuggestions(items, "  ")).toEqual(items);
  });

  it("matches case-insensitive substrings of the machine name", () => {
    expect(filterSuggestions(items, "SEARCH").map((s) => s.name)).toEqual([
      "search_docs",
      "web_search",
    ]);
  });

  it("matches the prettified display name (spaces instead of underscores)", () => {
    expect(filterSuggestions(items, "web se").map((s) => s.name)).toEqual(["web_search"]);
  });

  it("ranks prefix matches before substring matches, keeping order stable", () => {
    expect(filterSuggestions(items, "se").map((s) => s.name)).toEqual([
      "search_docs",
      "web_search",
    ]);
  });

  it("matches descriptions when present", () => {
    const withDesc = [sug("aaa", { description: "queries the vector index" })];
    expect(filterSuggestions(withDesc, "vector")).toHaveLength(1);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterSuggestions(items, "zzz")).toEqual([]);
  });
});

describe("insertToken", () => {
  const trigger = { kind: "/" as const, start: 3, query: "we" };

  it("replaces trigger+query with the token and a trailing space", () => {
    expect(insertToken("hi /we", trigger, 6, "web_search")).toEqual({
      text: "hi /web_search ",
      caret: 15,
    });
  });

  it("does not double a space that already follows the caret", () => {
    expect(insertToken("hi /we tail", trigger, 6, "web_search")).toEqual({
      text: "hi /web_search tail",
      caret: 15,
    });
  });

  it("keeps text after the caret for '@' tokens with spaces in the name", () => {
    const at = { kind: "@" as const, start: 0, query: "my" };
    expect(insertToken("@my!", at, 3, "my report.pdf")).toEqual({
      text: "@my report.pdf !",
      caret: 15,
    });
  });
});

describe("isAutoHidden", () => {
  it("hides the menu when a whitespace-containing query has zero matches", () => {
    expect(isAutoHidden("web_search more words", 0)).toBe(true);
    expect(isAutoHidden("web_search ", 0)).toBe(true);
  });

  it("keeps the menu visible when there are matches or no whitespace yet", () => {
    expect(isAutoHidden("my rep", 3)).toBe(false); // matches exist
    expect(isAutoHidden("webx", 0)).toBe(false); // zero matches but single word: show "No matches"
    expect(isAutoHidden("", 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(application)/chat/components/composer-autocomplete/matching.test.ts"`
Expected: FAIL — `Cannot find module './matching'` (or equivalent resolve error) for every suite.

- [ ] **Step 3: Implement `matching.ts`**

Create `app/(application)/chat/components/composer-autocomplete/matching.ts`:

```ts
/**
 * Pure logic for the composer's inline "/" (tools & skills) and "@" (session
 * files) autocomplete. Zero imports, node-testable. UI/state wiring lives in
 * use-composer-autocomplete.ts; rendering in autocomplete-menu.tsx and
 * highlight-overlay.tsx.
 *
 * Spec: docs/superpowers/specs/2026-07-07-chat-input-autocomplete-design.md
 */

export interface ActiveTrigger {
  kind: "/" | "@";
  start: number; // index of the trigger character in the text
  query: string; // text between the trigger char and the caret
}

export interface TokenRange {
  start: number; // index of the trigger character
  end: number; // exclusive index after the last token character
  kind: "/" | "@";
}

export interface Suggestion {
  id: string; // unique row id, e.g. "tool:web_search" / "file:<s3key>"
  kind: "tool" | "skill" | "file";
  name: string; // exact machine name inserted after the trigger char
  displayName: string; // prettified for display
  description?: string;
  disabled?: boolean; // tool toggled off this session (greyed, still selectable)
}

const isWhitespace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

/** Word start = start of text or preceded by whitespace (incl. newline). */
const isWordStart = (text: string, i: number) => i === 0 || isWhitespace(text[i - 1]);

/**
 * Scan backwards from the caret for the nearest enabled trigger character at
 * a word start, without crossing a newline. Queries may contain spaces (file
 * names) — over-broad matches are handled by isAutoHidden, not here.
 */
export function detectTrigger(
  text: string,
  caret: number,
  enabled: { slash: boolean; at: boolean },
): ActiveTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "\n") return null;
    if ((ch === "/" && enabled.slash) || (ch === "@" && enabled.at)) {
      if (isWordStart(text, i)) {
        return { kind: ch, start: i, query: text.slice(i + 1, caret) };
      }
    }
  }
  return null;
}

/** Boundary after a token: end of text or a char that can't continue a name. */
const isEndBoundary = (ch: string | undefined) => ch === undefined || !/[\w-]/.test(ch);

/**
 * Exact-case, longest-match token scan. A token is a trigger char at a word
 * start followed by a known name and an end boundary. Ranges never overlap.
 */
export function findTokenRanges(
  text: string,
  names: { slash: string[]; at: string[] },
): TokenRange[] {
  const byLength = (list: string[]) => [...list].sort((a, b) => b.length - a.length);
  const sorted: Record<"/" | "@", string[]> = {
    "/": byLength(names.slash),
    "@": byLength(names.at),
  };
  const ranges: TokenRange[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if ((ch === "/" || ch === "@") && isWordStart(text, i)) {
      const match = sorted[ch].find(
        (name) =>
          name.length > 0 &&
          text.startsWith(name, i + 1) &&
          isEndBoundary(text[i + 1 + name.length]),
      );
      if (match) {
        ranges.push({ start: i, end: i + 1 + match.length, kind: ch });
        i += 1 + match.length;
        continue;
      }
    }
    i++;
  }
  return ranges;
}

/**
 * Case-insensitive substring filter over name, display name, and description.
 * Prefix matches (on name or display name) rank first; order is otherwise
 * stable. An empty/whitespace-only query returns everything.
 */
export function filterSuggestions(items: Suggestion[], query: string): Suggestion[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;
  const matches = items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.displayName.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false),
  );
  const isPrefix = (item: Suggestion) =>
    item.name.toLowerCase().startsWith(q) || item.displayName.toLowerCase().startsWith(q);
  return [...matches.filter(isPrefix), ...matches.filter((m) => !isPrefix(m))];
}

/**
 * Replace trigger+query with the full token plus a terminating space and
 * return the new text and caret. Reuses an existing space right after the
 * caret instead of doubling it. Length limits are the caller's concern.
 */
export function insertToken(
  text: string,
  trigger: ActiveTrigger,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const before = text.slice(0, trigger.start);
  const after = text.slice(caret);
  const space = after.startsWith(" ") ? "" : " ";
  const next = `${before}${trigger.kind}${name}${space}${after}`;
  return { text: next, caret: trigger.start + 1 + name.length + 1 };
}

/**
 * Derived visibility rule: once the query contains whitespace and nothing
 * matches, the user is writing prose past a token — hide the menu instead of
 * pinning a "No matches" row under a whole sentence. Single-word zero-match
 * queries keep the menu open as typo feedback.
 */
export function isAutoHidden(query: string, matchCount: number): boolean {
  return matchCount === 0 && /\s/.test(query);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(application)/chat/components/composer-autocomplete/matching.test.ts"`
Expected: PASS, all suites green.

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/chat/components/composer-autocomplete/matching.ts" "app/(application)/chat/components/composer-autocomplete/matching.test.ts"
git commit -m "feat(chat): pure matching logic for composer inline autocomplete"
```

---

### Task 2: Catalog queries + i18n strings

**Files:**
- Modify: `app/(application)/chat/queries.ts` (append at end of file)
- Modify: `messages/en.json` (inside `chat.composer`)
- Modify: `messages/de.json` (inside `chat.composer`)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 3): `GET_CHAT_TOOL_CATALOG` (query `ChatToolCatalog`, vars `$limit: Int, $page: Int` → `tools.items[{id,name,description}]`), `GET_CHAT_SKILL_CATALOG` (query `ChatSkillCatalog`, vars `$page: Int!, $limit: Int!` → `skillsPagination.items[{id,name,description}]`); i18n keys `chat.composer.autocomplete.{toolsGroup,skillsGroup,filesGroup,off,noMatches,noFilesYet,filesError,listLabel}`.

- [ ] **Step 1: Add the two catalog queries**

Append to `app/(application)/chat/queries.ts`:

```ts
// ---------------------------------------------------------------------------
// Composer inline autocomplete (spec 2026-07-07): description enrichment for
// the "/" menu. NEW operation names (not monolith copies) — these are
// read-only catalogs, never refetch targets, so the verbatim-copy contract
// above does not apply.
// ---------------------------------------------------------------------------

export const GET_CHAT_TOOL_CATALOG = gql`
  query ChatToolCatalog($limit: Int, $page: Int) {
    tools(limit: $limit, page: $page) {
      items {
        id
        name
        description
      }
    }
  }
`;

export const GET_CHAT_SKILL_CATALOG = gql`
  query ChatSkillCatalog($page: Int!, $limit: Int!) {
    skillsPagination(page: $page, limit: $limit) {
      items {
        id
        name
        description
      }
    }
  }
`;
```

- [ ] **Step 2: Add the English strings**

In `messages/en.json`, inside the existing `chat` → `composer` object, add an `autocomplete` sub-object (alphabetical position within `composer` is not enforced; add after `"attachmentsLabel"`):

```json
"autocomplete": {
  "filesError": "Couldn't load session files",
  "filesGroup": "Session files",
  "listLabel": "Autocomplete suggestions",
  "noFilesYet": "No files in this session yet",
  "noMatches": "No matches",
  "off": "off",
  "skillsGroup": "Skills",
  "toolsGroup": "Tools"
},
```

- [ ] **Step 3: Add the German strings**

In `messages/de.json`, inside `chat` → `composer`, add at the mirrored position:

```json
"autocomplete": {
  "filesError": "Sitzungsdateien konnten nicht geladen werden",
  "filesGroup": "Sitzungsdateien",
  "listLabel": "Vorschläge zur Autovervollständigung",
  "noFilesYet": "Noch keine Dateien in dieser Sitzung",
  "noMatches": "Keine Treffer",
  "off": "aus",
  "skillsGroup": "Skills",
  "toolsGroup": "Tools"
},
```

- [ ] **Step 4: Verify messages and lint**

Run: `npm run check-messages`
Expected: the pre-existing 31 `de` `variables.*` failures only — NO new missing/extra keys. (If the script exits non-zero listing only `variables.*` keys, that matches the known baseline.)

Run: `npx eslint "app/(application)/chat/queries.ts"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/chat/queries.ts" messages/en.json messages/de.json
git commit -m "feat(chat): catalog queries and i18n strings for composer autocomplete"
```

---

### Task 3: Coordinating hook `use-composer-autocomplete.ts`

**Files:**
- Create: `app/(application)/chat/components/composer-autocomplete/use-composer-autocomplete.ts`

**Interfaces:**
- Consumes: everything from `matching.ts` (Task 1), `GET_CHAT_TOOL_CATALOG` / `GET_CHAT_SKILL_CATALOG` (Task 2), `sessionFilesApi.list` from `@/lib/api/session-files`, `ChatSessionController` from `../../hooks`, `AgentTool` from `@/types/models/agent`.
- Produces (used by Tasks 4–5):

```ts
export interface ComposerAutocomplete {
  menuOpen: boolean;
  kind: "/" | "@" | null;
  items: Suggestion[];         // flat, group-ordered (tools then skills / files)
  activeIndex: number;         // clamped index into items
  setActiveIndex: (i: number) => void;
  applySuggestion: (item: Suggestion) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean; // true = handled
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;    // caret sync
  onBlur: () => void;
  tokenRanges: TokenRange[];
  filesStatus: "ready" | "loading" | "error";
  hasAnyFiles: boolean;        // false => "no files yet" empty state for "@"
  listboxId: string;
  activeOptionId: string | null;
}
```

- [ ] **Step 1: Implement the hook**

Create `app/(application)/chat/components/composer-autocomplete/use-composer-autocomplete.ts`:

```ts
"use client";

/**
 * State/coordination for the composer's inline "/" and "@" autocomplete
 * (spec 2026-07-07). Owns caret + trigger state, suggestion sources, and the
 * keyboard contract; all matching logic is pure in ./matching.ts. Consumes
 * the controller PROP — never useChatSession (single-instance rule).
 */

import * as React from "react";
import { useLazyQuery } from "@apollo/client";

import { sessionFilesApi, type SessionFile } from "@/lib/api/session-files";
import type { AgentTool } from "@/types/models/agent";

import { GET_CHAT_TOOL_CATALOG, GET_CHAT_SKILL_CATALOG } from "../../queries";
import type { ChatSessionController } from "../../hooks";
import {
  detectTrigger,
  filterSuggestions,
  findTokenRanges,
  insertToken,
  isAutoHidden,
  type Suggestion,
  type TokenRange,
} from "./matching";

const LISTBOX_ID = "composer-autocomplete-listbox";
export const optionId = (index: number) => `composer-autocomplete-option-${index}`;

const prettify = (name: string) => name.replace(/_/g, " ");
const triggerKey = (t: { kind: string; start: number }) => `${t.kind}:${t.start}`;

interface ToolCatalogData {
  tools?: { items?: Array<{ id: string; name: string; description?: string | null }> };
}
interface SkillCatalogData {
  skillsPagination?: {
    items?: Array<{ id: string; name: string; description?: string | null }>;
  };
}

export interface UseComposerAutocompleteArgs {
  controller: ChatSessionController;
  input: string;
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export interface ComposerAutocomplete {
  menuOpen: boolean;
  kind: "/" | "@" | null;
  items: Suggestion[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  applySuggestion: (item: Suggestion) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
  tokenRanges: TokenRange[];
  filesStatus: "ready" | "loading" | "error";
  hasAnyFiles: boolean;
  listboxId: string;
  activeOptionId: string | null;
}

export function useComposerAutocomplete({
  controller,
  input,
  setInput,
  inputRef,
}: UseComposerAutocompleteArgs): ComposerAutocomplete {
  const { agent, maxInputLength } = controller;

  // ── Caret tracking ───────────────────────────────────────────────────────
  const [caret, setCaret] = React.useState(0);
  const syncCaret = React.useCallback(() => {
    const el = inputRef.current;
    if (el) setCaret(el.selectionStart ?? 0);
  }, [inputRef]);
  const onSelect = React.useCallback(
    (_e: React.SyntheticEvent<HTMLTextAreaElement>) => syncCaret(),
    [syncCaret],
  );

  // ── Trigger detection ────────────────────────────────────────────────────
  // Legacy agents may store tools as string[] ids (agent-detail-panel.tsx
  // applies the same tolerance).
  const tools = React.useMemo(
    () =>
      ((agent.tools ?? []) as Array<AgentTool | string>).map((t) =>
        typeof t === "string" ? { id: t, name: t } : { id: t.id, name: t.name },
      ),
    [agent.tools],
  );
  const skills = React.useMemo(() => agent.skills ?? [], [agent.skills]);
  const slashEnabled = tools.length > 0 || skills.length > 0;
  const atEnabled = Boolean(agent.sandbox_enabled);

  const trigger = React.useMemo(
    () => detectTrigger(input, caret, { slash: slashEnabled, at: atEnabled }),
    [input, caret, slashEnabled, atEnabled],
  );

  // Escape dismissal is sticky per trigger instance (kind + start index);
  // a new trigger elsewhere gets a fresh key. Stale keys are harmless.
  const [escapedKey, setEscapedKey] = React.useState<string | null>(null);

  // ── "/" source: agent capabilities + lazy description enrichment ─────────
  const [loadToolCatalog, { data: toolCatalog }] =
    useLazyQuery<ToolCatalogData>(GET_CHAT_TOOL_CATALOG, {
      variables: { limit: 200, page: 1 },
    });
  const [loadSkillCatalog, { data: skillCatalog }] =
    useLazyQuery<SkillCatalogData>(GET_CHAT_SKILL_CATALOG, {
      variables: { page: 1, limit: 100 },
    });
  React.useEffect(() => {
    if (trigger?.kind !== "/") return;
    // Enrichment only — catalog failure (or entries beyond the page cap)
    // just means names without descriptions.
    void loadToolCatalog().catch(() => {});
    void loadSkillCatalog().catch(() => {});
  }, [trigger?.kind, loadToolCatalog, loadSkillCatalog]);

  const descriptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of toolCatalog?.tools?.items ?? []) {
      if (t.description) map.set(t.id, t.description);
    }
    for (const s of skillCatalog?.skillsPagination?.items ?? []) {
      if (s.description) map.set(s.id, s.description);
    }
    return map;
  }, [toolCatalog, skillCatalog]);

  const toolItems = React.useMemo<Suggestion[]>(
    () =>
      tools.map((t) => ({
        id: `tool:${t.id}`,
        kind: "tool",
        name: t.name,
        displayName: prettify(t.name),
        description: descriptions.get(t.id),
        disabled: controller.disabledTools.includes(t.id),
      })),
    [tools, descriptions, controller.disabledTools],
  );
  const skillItems = React.useMemo<Suggestion[]>(
    () =>
      skills.map((s) => ({
        id: `skill:${s.id}`,
        kind: "skill",
        name: s.name,
        displayName: prettify(s.name),
        description: descriptions.get(s.id),
      })),
    [skills, descriptions],
  );

  // ── "@" source: session files, re-fetched per menu open ─────────────────
  const [sessionFiles, setSessionFiles] = React.useState<SessionFile[] | null>(null);
  const [filesStatus, setFilesStatus] = React.useState<"ready" | "loading" | "error">(
    "ready",
  );
  const sessionId = controller.session?.id ?? null;
  const atOpenKey = trigger?.kind === "@" ? trigger.start : null;
  React.useEffect(() => {
    if (atOpenKey === null) return;
    if (!sessionId) {
      // /new with nothing uploaded: empty state; never ensureSession here.
      setSessionFiles([]);
      setFilesStatus("ready");
      return;
    }
    let cancelled = false;
    setFilesStatus("loading");
    sessionFilesApi
      .list(sessionId)
      .then((res) => {
        if (cancelled) return;
        setSessionFiles(res.files);
        setFilesStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFilesStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [atOpenKey, sessionId]);

  const fileItems = React.useMemo<Suggestion[]>(
    () =>
      (sessionFiles ?? []).map((f) => ({
        id: `file:${f.key}`,
        kind: "file",
        name: f.name,
        displayName: f.name,
      })),
    [sessionFiles],
  );

  // ── Filtering (flat, group-ordered: tools then skills / files) ──────────
  const items = React.useMemo<Suggestion[]>(() => {
    if (!trigger) return [];
    if (trigger.kind === "/") {
      return [
        ...filterSuggestions(toolItems, trigger.query),
        ...filterSuggestions(skillItems, trigger.query),
      ];
    }
    return filterSuggestions(fileItems, trigger.query);
  }, [trigger, toolItems, skillItems, fileItems]);

  const menuOpen =
    !!trigger &&
    escapedKey !== triggerKey(trigger) &&
    !isAutoHidden(trigger.query, items.length);

  // ── Active row ───────────────────────────────────────────────────────────
  const [activeIndexRaw, setActiveIndex] = React.useState(0);
  const activeIndex = Math.min(activeIndexRaw, Math.max(items.length - 1, 0));
  React.useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.start, trigger?.kind, trigger?.query]);

  // ── Insertion ────────────────────────────────────────────────────────────
  const applySuggestion = React.useCallback(
    (item: Suggestion) => {
      if (!trigger) return;
      const result = insertToken(input, trigger, caret, item.name);
      if (result.text.length > maxInputLength) {
        // Would overflow the input cap: skip the insert, dismiss the menu.
        setEscapedKey(triggerKey(trigger));
        return;
      }
      setInput(result.text);
      const el = inputRef.current;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(result.caret, result.caret);
        setCaret(result.caret);
      });
    },
    [trigger, input, caret, maxInputLength, setInput, inputRef],
  );

  // ── Keyboard contract (returns true when the event was consumed) ────────
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!menuOpen || e.nativeEvent.isComposing) return false;
      if (e.key === "ArrowDown" && items.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (e.key === "ArrowUp" && items.length > 0) {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if ((e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) && items.length > 0) {
        e.preventDefault();
        applySuggestion(items[activeIndex]);
        return true;
      }
      if (e.key === "Escape") {
        // Close ONLY the menu: stopPropagation keeps the document-level
        // overlay Esc chain (composer.tsx) out of it; preventDefault plus
        // `return true` keeps the composer's own Esc-clears-input off.
        e.preventDefault();
        e.stopPropagation();
        if (trigger) setEscapedKey(triggerKey(trigger));
        return true;
      }
      return false;
    },
    [menuOpen, items, activeIndex, applySuggestion, trigger],
  );

  const onBlur = React.useCallback(() => {
    if (trigger) setEscapedKey(triggerKey(trigger));
  }, [trigger]);

  // ── Highlight ranges ─────────────────────────────────────────────────────
  const slashNames = React.useMemo(
    () => [...tools.map((t) => t.name), ...skills.map((s) => s.name)],
    [tools, skills],
  );
  const atNames = React.useMemo(
    () => (sessionFiles ?? []).map((f) => f.name),
    [sessionFiles],
  );
  const tokenRanges = React.useMemo(
    () => findTokenRanges(input, { slash: slashNames, at: atNames }),
    [input, slashNames, atNames],
  );

  return {
    menuOpen,
    kind: trigger?.kind ?? null,
    items,
    activeIndex,
    setActiveIndex,
    applySuggestion,
    onKeyDown,
    onSelect,
    onBlur,
    tokenRanges,
    filesStatus,
    hasAnyFiles: (sessionFiles ?? []).length > 0,
    listboxId: LISTBOX_ID,
    activeOptionId: menuOpen && items.length > 0 ? optionId(activeIndex) : null,
  };
}
```

- [ ] **Step 2: Typecheck and lint the new file**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.svg" | grep "composer-autocomplete" ; npx eslint "app/(application)/chat/components/composer-autocomplete/"`
Expected: no output from the tsc grep (the pre-existing svg error is baseline), eslint clean.

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/chat/components/composer-autocomplete/use-composer-autocomplete.ts"
git commit -m "feat(chat): composer autocomplete coordination hook"
```

---

### Task 4: Presentational components — menu + highlight overlay

**Files:**
- Create: `app/(application)/chat/components/composer-autocomplete/autocomplete-menu.tsx`
- Create: `app/(application)/chat/components/composer-autocomplete/highlight-overlay.tsx`

**Interfaces:**
- Consumes: `Suggestion`, `TokenRange` from `./matching`; `ComposerAutocomplete` + `optionId` from `./use-composer-autocomplete` (Task 3); i18n keys from Task 2.
- Produces (used by Task 5):
  - `AutocompleteMenu({ autocomplete }: { autocomplete: ComposerAutocomplete })` — renders `null` when closed; absolutely positioned; must sit inside a `relative` ancestor (the composer form card).
  - `HighlightOverlay` — `React.forwardRef<HTMLDivElement, { value: string; ranges: TokenRange[] }>`; must sit inside a `relative` wrapper directly around the textarea.

- [ ] **Step 1: Implement `autocomplete-menu.tsx`**

```tsx
"use client";

/**
 * Suggestion listbox for the composer's inline autocomplete. Dumb renderer:
 * all state lives in useComposerAutocomplete. Positioned above the composer
 * card (absolute, bottom-full) — mount inside the `relative` form card.
 * Visual language matches cmdk rows (bg-popover card, bg-accent active row);
 * cmdk itself isn't used because focus stays in the textarea.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { File, Sparkles, Wrench, type LucideIcon } from "lucide-react";

import { Loading } from "@/components/primitives/loading";
import { cn } from "@/lib/utils";

import type { Suggestion } from "./matching";
import { optionId, type ComposerAutocomplete } from "./use-composer-autocomplete";

const KIND_ICON: Record<Suggestion["kind"], LucideIcon> = {
  tool: Wrench,
  skill: Sparkles,
  file: File,
};

export function AutocompleteMenu({
  autocomplete,
}: {
  autocomplete: ComposerAutocomplete;
}) {
  const t = useTranslations("chat");
  const {
    menuOpen,
    kind,
    items,
    activeIndex,
    setActiveIndex,
    applySuggestion,
    filesStatus,
    hasAnyFiles,
    listboxId,
  } = autocomplete;

  const activeRef = React.useRef<HTMLLIElement | null>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, menuOpen]);

  if (!menuOpen) return null;

  const groupLabel: Record<Suggestion["kind"], string> = {
    tool: t("composer.autocomplete.toolsGroup"),
    skill: t("composer.autocomplete.skillsGroup"),
    file: t("composer.autocomplete.filesGroup"),
  };

  const showFilesLoading = kind === "@" && filesStatus === "loading";
  const showFilesError = kind === "@" && filesStatus === "error";
  const emptyLabel =
    kind === "@" && !hasAnyFiles && filesStatus === "ready"
      ? t("composer.autocomplete.noFilesYet")
      : t("composer.autocomplete.noMatches");

  return (
    <div className="absolute inset-x-0 bottom-full z-50 mb-2">
      <ul
        id={listboxId}
        role="listbox"
        aria-label={t("composer.autocomplete.listLabel")}
        className="max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        // Keep focus in the textarea: a click must not blur-close the menu
        // before the row's onClick fires.
        onMouseDown={(e) => e.preventDefault()}
      >
        {showFilesLoading && (
          <li className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <Loading className="size-4" />
            {t("composer.autocomplete.filesGroup")}
          </li>
        )}
        {showFilesError && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">
            {t("composer.autocomplete.filesError")}
          </li>
        )}
        {!showFilesLoading && !showFilesError && items.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-muted-foreground">{emptyLabel}</li>
        )}
        {items.map((item, index) => {
          const Icon = KIND_ICON[item.kind];
          const active = index === activeIndex;
          const showHeader = index === 0 || items[index - 1].kind !== item.kind;
          return (
            <React.Fragment key={item.id}>
              {showHeader && (
                <li
                  role="presentation"
                  className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {groupLabel[item.kind]}
                </li>
              )}
              <li
                ref={active ? activeRef : undefined}
                id={optionId(index)}
                role="option"
                aria-selected={active}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => applySuggestion(item)}
                className={cn(
                  "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  active && "bg-accent text-accent-foreground",
                  item.disabled && "opacity-60",
                )}
              >
                <Icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className={cn(item.kind !== "file" && "capitalize")}>
                    {item.displayName}
                  </span>
                  {item.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
                {item.disabled && (
                  <span className="shrink-0 rounded-full border px-1.5 text-[10px] text-muted-foreground">
                    {t("composer.autocomplete.off")}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Implement `highlight-overlay.tsx`**

```tsx
"use client";

/**
 * Mirror layer painting subtle purple pills behind recognized /tool and
 * @file tokens (spec 2026-07-07). Renders the SAME text as the textarea with
 * identical typography metrics but transparent color; only the token spans'
 * backgrounds are visible. Mount absolutely inside a `relative` wrapper
 * directly around the textarea; the textarea (already bg-transparent) paints
 * the real glyphs on top. Metric contract: every typography-affecting class
 * here must match the textarea's (px-2 py-2.5 text-base md:text-sm max-h-40).
 * Scroll is synced by the composer via the textarea's onScroll.
 */

import * as React from "react";

import type { TokenRange } from "./matching";

export const HighlightOverlay = React.forwardRef<
  HTMLDivElement,
  { value: string; ranges: TokenRange[] }
>(function HighlightOverlay({ value, ranges }, ref) {
  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push(value.slice(cursor, range.start));
    }
    segments.push(
      // px + negative mx cancel out, so glyph positions are untouched while
      // the pill bleeds 2px past the token on each side.
      <span key={range.start} className="-mx-0.5 rounded bg-primary/10 px-0.5">
        {value.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < value.length) segments.push(value.slice(cursor));

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 max-h-40 overflow-hidden whitespace-pre-wrap break-words px-2 py-2.5 text-base text-transparent md:text-sm"
    >
      {segments}
    </div>
  );
});
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.svg" | grep "composer-autocomplete" ; npx eslint "app/(application)/chat/components/composer-autocomplete/"`
Expected: no tsc output for these files; eslint clean.

- [ ] **Step 4: Commit**

```bash
git add "app/(application)/chat/components/composer-autocomplete/autocomplete-menu.tsx" "app/(application)/chat/components/composer-autocomplete/highlight-overlay.tsx"
git commit -m "feat(chat): autocomplete menu and token highlight overlay components"
```

---

### Task 5: Composer integration

**Files:**
- Modify: `app/(application)/chat/components/composer.tsx`

**Interfaces:**
- Consumes: `useComposerAutocomplete` (Task 3), `AutocompleteMenu`, `HighlightOverlay` (Task 4).
- Produces: the user-facing feature. No new exports.

- [ ] **Step 1: Add imports**

In `composer.tsx`, after the existing local imports (line 67, after `import { SavePresetModal } from "./save-preset-modal";`):

```ts
import { AutocompleteMenu } from "./composer-autocomplete/autocomplete-menu";
import { HighlightOverlay } from "./composer-autocomplete/highlight-overlay";
import { useComposerAutocomplete } from "./composer-autocomplete/use-composer-autocomplete";
```

- [ ] **Step 2: Instantiate the hook and the overlay ref**

Directly after the input state declarations (`composer.tsx:97-98`, after `const inputRef = useRef<HTMLTextAreaElement>(null);`):

```ts
const overlayRef = useRef<HTMLDivElement>(null);
// Inline "/" (tools & skills) and "@" (session files) autocomplete
// (spec 2026-07-07). Pure logic in composer-autocomplete/matching.ts.
const autocomplete = useComposerAutocomplete({
  controller,
  input,
  setInput,
  inputRef,
});
```

- [ ] **Step 3: Route keydown through the autocomplete first**

Replace the existing `handleKeyDown` (`composer.tsx:284-295`):

```ts
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // Open suggestion menu owns arrows/Enter/Tab/Escape (spec 2026-07-07).
  if (autocomplete.onKeyDown(e)) return;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (status !== "submitted" && status !== "streaming" && input?.trim()) {
      void submit();
    }
  }
  if (e.key === "Escape" && input) {
    setInput("");
    e.preventDefault();
  }
};
```

- [ ] **Step 4: Wrap the textarea with the overlay and wire ARIA + events**

Replace the `TextareaAutosize` element (`composer.tsx:514-535`) with a relative wrapper holding overlay + textarea. The textarea keeps every existing prop; changed bits: `flex-1` moves to the wrapper (textarea becomes `w-full relative`), and `onSelect`/`onBlur`/`onScroll` + ARIA combobox attributes are added:

```tsx
<div className="relative min-w-0 flex-1">
  <HighlightOverlay
    ref={overlayRef}
    value={input}
    ranges={autocomplete.tokenRanges}
  />
  <TextareaAutosize
    autoComplete="off"
    autoFocus={true}
    minRows={1}
    maxLength={maxInputLength}
    value={input}
    ref={inputRef}
    onKeyDown={handleKeyDown}
    onChange={(e) => setInput(e.target.value)}
    onSelect={autocomplete.onSelect}
    onBlur={autocomplete.onBlur}
    onScroll={(e) => {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = e.currentTarget.scrollTop;
      }
    }}
    name="message"
    disabled={budgetExceeded || contextBlocked}
    placeholder={
      contextBlocked
        ? t("context.placeholderBlocked")
        : budgetExceeded
          ? t("composer.placeholderBudgetReached")
          : t("composer.placeholder")
    }
    className="relative max-h-40 w-full resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
    aria-label={t("composer.inputAriaLabel")}
    aria-describedby={showCounter ? "composer-length-warning" : undefined}
    aria-autocomplete="list"
    aria-expanded={autocomplete.menuOpen}
    aria-controls={autocomplete.menuOpen ? autocomplete.listboxId : undefined}
    aria-activedescendant={autocomplete.activeOptionId ?? undefined}
  />
</div>
```

(The metric contract: the overlay's `px-2 py-2.5 text-base md:text-sm max-h-40` mirrors this className — if you touch one, touch both.)

- [ ] **Step 5: Mount the menu inside the form card**

Directly after the form's opening tag (`composer.tsx:496-499`, right after `<form onSubmit={submit} className="relative rounded-lg border bg-card p-2">`):

```tsx
<AutocompleteMenu autocomplete={autocomplete} />
```

(The form card is the `relative` positioning context; the menu renders `absolute bottom-full`, i.e. above the card, full card width.)

- [ ] **Step 6: Typecheck, lint, run all tests**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.svg"` — Expected: no NEW errors (baseline svg error filtered out).
Run: `npx eslint "app/(application)/chat/"` — Expected: clean.
Run: `npm test` — Expected: all suites pass except the pre-existing nav-config failure.

- [ ] **Step 7: Commit**

```bash
git add "app/(application)/chat/components/composer.tsx"
git commit -m "feat(chat): wire inline / and @ autocomplete into the composer"
```

---

### Task 6: Verification pass (build + manual UAT)

**Files:** none created; fixes (if any) land in the files above.

- [ ] **Step 1: Full check suite**

```bash
npm test            # expect: only the known nav-config failure
npm run lint        # expect: only the known entity-types failure
npm run check-messages  # expect: only the known 31 de variables.* keys
npx tsc --noEmit    # expect: only the known svg error
npm run build       # expect: success
```

- [ ] **Step 2: Manual UAT in the running app** (`npm run dev`, open a chat session with an agent that has tools/skills and `sandbox_enabled`)

Checklist — verify each, in light AND dark theme:
1. Typing `/` at message start opens the menu with Tools/Skills groups; typing filters; `↑`/`↓` move; Enter inserts `/machine_name ` with a purple pill behind it; caret lands after the space.
2. Typing `/` mid-message after a space triggers; `3/4` and `email@domain.com` do not.
3. A tool toggled off in the capability sheet shows greyed with an "off" chip and still inserts.
4. Escape closes only the menu (input text intact; no other overlay reacts); Escape again clears the input (existing behavior).
5. Enter with the menu closed still sends; Shift+Enter still inserts a newline.
6. `@` opens the file list (upload a file via the ＋ menu first); selecting inserts `@name ` highlighted; file names with spaces highlight fully.
7. `@` on a brand-new `/new` session shows "No files in this session yet" and does NOT create a session (URL stays `/new`, no session appears in history).
8. Agent without `sandbox_enabled`: `@` types plainly, no menu. Agent with no tools/skills: `/` types plainly.
9. Editing inside a highlighted token drops the pill immediately; retyping the full name restores it.
10. Long multi-line input: pills sit exactly under their text at wrapped lines; when the textarea hits max height and scrolls, pills scroll in sync.
11. Mobile viewport (devtools): tapping a row inserts; menu is usable.
12. Writing prose after a completed token (`/web_search please check…`) — menu disappears once the text stops matching, and does not flicker back.

- [ ] **Step 3: Fix anything found, re-run Step 1, commit fixes**

```bash
git add -A && git commit -m "fix(chat): composer autocomplete UAT fixes"
```

(Skip the commit if UAT was clean.)

---

## Self-Review (completed)

- **Spec coverage:** decisions 1–4 → Global Constraints + Tasks 1/3/4; trigger rules → Task 1 `detectTrigger` tests; disabled tools → Task 3 `toolItems` + Task 4 "off" chip; descriptions lazy-join → Tasks 2/3; files gate + `/new` empty state → Task 3 effect + UAT 7/8; keyboard contract incl. Esc-chain isolation → Task 3 `onKeyDown` + Task 5 Step 3; highlight rules → Task 1 `findTokenRanges` + Task 4 overlay; maxInputLength guard → Task 3 `applySuggestion`; i18n → Task 2; testing section → Tasks 1/6. `de.json` + `en.json` both covered.
- **Placeholder scan:** none — every step has full code or exact commands with expected output.
- **Type consistency:** `Suggestion`/`TokenRange`/`ActiveTrigger` defined once in Task 1 and imported everywhere; `ComposerAutocomplete` defined in Task 3 and consumed as a whole in Tasks 4–5; `optionId` exported from the hook module and reused by the menu.
