# Manual `/compact` Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users two new ways to manually trigger conversation compaction — a `/compact` slash command in the composer and a "Compact conversation" entry in the AttachMenu `+` popover — reusing the existing `controller.compactConversation` and backend `/compact` route.

**Architecture:** Extend the composer's existing `/` autocomplete with a new `kind: "command"` suggestion type and one entry (`compact`). Executor path is symmetric between menu-selection and submit-time regex interception, both driven by a small `parseCompactInput` helper in `matching.ts`. The AttachMenu entry doesn't run compaction directly — it opens `ContextBanner` in a new *manual mode* (neutral copy, steer input pre-opened) so users can add focus before firing. Frontend-only; no backend, hooks, or i18n locale-file structure changes.

**Tech Stack:** React (Next.js 14 App Router), TypeScript, next-intl (i18n), vitest (unit tests), Tailwind, lucide-react icons, sonner (toasts). Test runner: `npm test` (`vitest run`).

## Global Constraints

- Frontend-only. No backend, no `app/(application)/chat/hooks.ts` changes.
- Copy rule: no violet/purple; the manual-mode banner is neutral (border-border + bg-muted/30).
- Icon for both surfaces: `Archive` from `lucide-react`.
- Locales: only `messages/en.json` and `messages/de.json` exist — update both, keep keys identical.
- Guest mode (`Composer.guestMode === true`): no `/compact` command surfacing and no AttachMenu entry — the compact endpoint is not accessible for guests. `AttachMenu` is already gated out of `guestMode` in `Composer`, so nothing extra needed there.
- Slash-command reuse rules from the existing autocomplete: pure logic stays in `matching.ts` (node-testable), UI/state stays in `use-composer-autocomplete.ts`, dumb rendering stays in `autocomplete-menu.tsx`.
- No confirmation dialog before compacting — user's explicit action is signal enough.
- Existing gating rules for `compactConversation`: no-op when `session.id === "new"`, `status === "streaming" || "submitted"`, or `compacting === true`. Do NOT re-implement — call and check the returned boolean.

---

## File Map

**Modify:**
- `app/(application)/chat/components/composer-autocomplete/matching.ts` — add `"command"` to `Suggestion.kind`, new `parseCompactInput` helper, command-prefix rule in `filterSuggestions`.
- `app/(application)/chat/components/composer-autocomplete/matching.test.ts` — tests for new helper and filter rule.
- `app/(application)/chat/components/composer-autocomplete/autocomplete-menu.tsx` — extend `KIND_ICON` and `groupLabel` for `"command"`.
- `app/(application)/chat/components/composer-autocomplete/use-composer-autocomplete.ts` — inject static COMMANDS list; `applySuggestion` branch for `kind: "command"`; new `onExecuteCommand` arg + arg type on `UseComposerAutocompleteArgs`.
- `app/(application)/chat/components/composer.tsx` — `manualCompactOpen` state, `executeCompactCommand` helper, submit-time interception, wire `AttachMenu.onCompactRequest`, pass `manualOpen`/`onCloseManual` to `ContextBanner`.
- `app/(application)/chat/components/attach-menu.tsx` — new `onCompactRequest` prop + "Compact conversation" `MenuEntry` with disabled logic.
- `app/(application)/chat/components/context-banner.tsx` — new `manualOpen` + `onCloseManual` props; manual-mode branch.
- `messages/en.json` — new keys (schema below).
- `messages/de.json` — mirror keys.

---

### Task 1: `matching.ts` extensions (types, parser, filter tweak)

**Files:**
- Modify: `app/(application)/chat/components/composer-autocomplete/matching.ts`
- Test: `app/(application)/chat/components/composer-autocomplete/matching.test.ts`

**Interfaces:**
- Consumes: nothing new — pure module.
- Produces:
  - `Suggestion.kind` now `"tool" | "skill" | "file" | "command"`.
  - `filterSuggestions(items, query)` — unchanged signature; new rule: entries with `kind === "command"` whose `name` is a case-insensitive prefix of the trimmed query followed by whitespace or end-of-string are always included and ranked first.
  - `parseCompactInput(input: string): { isCompact: true; steer?: string } | { isCompact: false }` — pure. Matches trimmed input against `^\/compact(?:\s+([\s\S]*))?$`. On match, `steer` is the captured group trimmed, or `undefined` if empty/whitespace.

- [ ] **Step 1: Write the failing tests**

Open `app/(application)/chat/components/composer-autocomplete/matching.test.ts`. Add these blocks at the end of the file (after the existing `describe("isAutoHidden", …)`):

```ts
const cmd = (name: string, extra?: Partial<Suggestion>): Suggestion => ({
  id: `cmd:${name}`,
  kind: "command",
  name,
  displayName: name,
  ...extra,
});

describe("filterSuggestions (command prefix rule)", () => {
  const compact = cmd("compact", { description: "Summarize earlier messages" });
  const tools = [sug("run_code"), sug("search_docs")];

  it("keeps a command visible when the query is exactly the command name", () => {
    expect(filterSuggestions([compact, ...tools], "compact").map((s) => s.name)).toEqual([
      "compact",
    ]);
  });

  it("keeps a command visible when the query is command name + space + args", () => {
    expect(
      filterSuggestions([compact, ...tools], "compact focus on the deploy").map((s) => s.name),
    ).toEqual(["compact"]);
  });

  it("ranks commands before matching tools", () => {
    const co = sug("count_rows");
    expect(filterSuggestions([co, compact], "co").map((s) => s.name)).toEqual([
      "compact",
      "count_rows",
    ]);
  });

  it("is case-insensitive on the command name", () => {
    expect(filterSuggestions([compact], "COMPACT foo").map((s) => s.name)).toEqual(["compact"]);
  });

  it("does not match commands mid-word (e.g. /compactx)", () => {
    expect(filterSuggestions([compact], "compactx").map((s) => s.name)).toEqual([]);
  });

  it("still returns commands via normal substring matching (partial name)", () => {
    // "comp" is a substring of "compact" — normal substring rule catches it too
    expect(filterSuggestions([compact], "comp").map((s) => s.name)).toEqual(["compact"]);
  });
});

describe("parseCompactInput", () => {
  it("matches '/compact' with no args", () => {
    expect(parseCompactInput("/compact")).toEqual({ isCompact: true, steer: undefined });
  });

  it("matches '/compact ' (trailing space) with no args", () => {
    expect(parseCompactInput("/compact ")).toEqual({ isCompact: true, steer: undefined });
  });

  it("captures trailing text as steer", () => {
    expect(parseCompactInput("/compact focus on the deploy")).toEqual({
      isCompact: true,
      steer: "focus on the deploy",
    });
  });

  it("trims the captured steer", () => {
    expect(parseCompactInput("/compact   keep the numbers   ")).toEqual({
      isCompact: true,
      steer: "keep the numbers",
    });
  });

  it("trims outer whitespace on the input", () => {
    expect(parseCompactInput("  /compact  ")).toEqual({ isCompact: true, steer: undefined });
  });

  it("rejects inputs that only contain '/compact' mid-text", () => {
    expect(parseCompactInput("hey /compact")).toEqual({ isCompact: false });
    expect(parseCompactInput("/compact\nsecond line")).toEqual({
      isCompact: true,
      steer: "second line",
    });
  });

  it("rejects '/compactx'", () => {
    expect(parseCompactInput("/compactx")).toEqual({ isCompact: false });
  });

  it("rejects the empty string", () => {
    expect(parseCompactInput("")).toEqual({ isCompact: false });
  });
});
```

Also update the imports at the top of the test file — add `parseCompactInput` to the `from "./matching"` import list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm test -- matching.test`

Expected: FAIL — `parseCompactInput is not a function`, and the new command-related suites fail because `kind: "command"` isn't a valid Suggestion type yet.

- [ ] **Step 3: Extend `Suggestion` and add `parseCompactInput`**

Edit `app/(application)/chat/components/composer-autocomplete/matching.ts`:

Change:
```ts
export interface Suggestion {
  id: string; // unique row id, e.g. "tool:web_search" / "file:<s3key>"
  kind: "tool" | "skill" | "file";
  ...
}
```

To:
```ts
export interface Suggestion {
  id: string; // unique row id, e.g. "tool:web_search" / "file:<s3key>" / "cmd:<name>"
  kind: "tool" | "skill" | "file" | "command";
  ...
}
```

Append these two exports at the bottom of the file:

```ts
/**
 * Regex-based parser for the `/compact` submit-time interception path.
 * Pure — mirrors the module's node-testable contract. Returns `steer`
 * trimmed to `undefined` when only whitespace, so callers can spread it
 * straight into the compact executor without a second guard.
 *
 * Not called by the menu-selection path, which has the trigger.query in
 * hand and doesn't need to re-scan the full input.
 */
export function parseCompactInput(
  input: string,
): { isCompact: true; steer?: string } | { isCompact: false } {
  const match = input.trim().match(/^\/compact(?:\s+([\s\S]*))?$/);
  if (!match) return { isCompact: false };
  const steer = match[1]?.trim();
  return { isCompact: true, steer: steer && steer.length > 0 ? steer : undefined };
}
```

- [ ] **Step 4: Add the command-prefix rule to `filterSuggestions`**

Locate the existing `filterSuggestions` in `matching.ts`. Replace the whole function body with:

```ts
export function filterSuggestions(items: Suggestion[], query: string): Suggestion[] {
  const q = query.toLowerCase().trim();
  if (!q) return items;

  // Command-name prefix rule: a command whose name is a case-insensitive
  // prefix of the query followed by whitespace or end-of-string stays
  // visible even when the query includes args (e.g. "compact focus on X").
  // Args are ignored for suggestion display; the executor reads them from
  // the trigger's query. Commands surfaced by this rule always rank first.
  const commandNameMatches = (item: Suggestion) => {
    if (item.kind !== "command") return false;
    const name = item.name.toLowerCase();
    if (!q.startsWith(name)) return false;
    const nextChar = q.charAt(name.length);
    return nextChar === "" || /\s/.test(nextChar);
  };

  const commandHits = items.filter(commandNameMatches);
  const commandHitIds = new Set(commandHits.map((c) => c.id));

  const substringMatches = items.filter(
    (item) =>
      !commandHitIds.has(item.id) &&
      (item.name.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false)),
  );
  const isPrefix = (item: Suggestion) =>
    item.name.toLowerCase().startsWith(q) || item.displayName.toLowerCase().startsWith(q);
  return [
    ...commandHits,
    ...substringMatches.filter(isPrefix),
    ...substringMatches.filter((m) => !isPrefix(m)),
  ];
}
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm test -- matching.test`

Expected: PASS — all existing tests plus the two new `describe` blocks.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add app/\(application\)/chat/components/composer-autocomplete/matching.ts app/\(application\)/chat/components/composer-autocomplete/matching.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): add command-kind suggestions + /compact parser to matching

Extends the composer autocomplete's pure logic module: Suggestion.kind now
includes "command", filterSuggestions keeps command rows visible when args
follow, and new parseCompactInput drives the submit-time interception path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: i18n keys (en + de)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

**Interfaces:**
- Consumes: nothing.
- Produces: new keys under `chat.attach.*`, `chat.commands.compact.*`, `chat.context.manual*`, and `chat.composer.autocomplete.commandsGroup`. Full list at the end of this task.

- [ ] **Step 1: Add keys to `messages/en.json`**

Locate the `"attach": { … }` block (around line 1118). Add these keys alphabetically inside the existing block (they slot between `addKnowledgeManagedNote` and `disabledCount`):

```json
"compact": "Compact conversation",
"compactDescription": "Summarize earlier messages to free context",
"compactDisabledNew": "Send at least one message before compacting.",
"compactDisabledStreaming": "Wait for the current response to finish.",
"compactDisabledRunning": "Compaction is already running.",
```

Locate the `"context": { … }` block (around line 1144). Add these keys alphabetically inside the existing block:

```json
"manualTitle": "Compact conversation",
"manualBody": "Summarize earlier messages into a checkpoint to free context. Older messages stay in your history; the model will only see the summary.",
"manualClose": "Close",
```

Locate the `"composer": { "autocomplete": { … } }` sub-block (around line 1161). Add this key inside the `autocomplete` block:

```json
"commandsGroup": "Commands",
```

At the end of the `"chat": { … }` block, add a new sibling to `attach`, `capabilities`, `context`, `composer`, etc. Insert `commands` in alphabetical order (between `capabilities` and `context`):

```json
"commands": {
  "compact": {
    "label": "compact",
    "description": "Summarize earlier messages to free context",
    "successToast": "Conversation compacted"
  }
},
```

- [ ] **Step 2: Mirror keys in `messages/de.json`**

Locate the corresponding blocks in `messages/de.json` and add the same keys with German copy:

Under `chat.attach`:
```json
"compact": "Konversation komprimieren",
"compactDescription": "Frühere Nachrichten zusammenfassen, um Kontext freizugeben",
"compactDisabledNew": "Sende zuerst eine Nachricht, bevor du komprimierst.",
"compactDisabledStreaming": "Warte, bis die aktuelle Antwort fertig ist.",
"compactDisabledRunning": "Komprimierung läuft bereits.",
```

Under `chat.context`:
```json
"manualTitle": "Konversation komprimieren",
"manualBody": "Fasse frühere Nachrichten in einem Checkpoint zusammen, um Kontext freizugeben. Ältere Nachrichten bleiben im Verlauf; das Modell sieht nur die Zusammenfassung.",
"manualClose": "Schließen",
```

Under `chat.composer.autocomplete`:
```json
"commandsGroup": "Befehle",
```

New `chat.commands` block:
```json
"commands": {
  "compact": {
    "label": "compact",
    "description": "Frühere Nachrichten zusammenfassen, um Kontext freizugeben",
    "successToast": "Konversation komprimiert"
  }
},
```

- [ ] **Step 3: Verify JSON is valid**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/de.json','utf8')); console.log('ok')"`

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add messages/en.json messages/de.json
git commit -m "$(cat <<'EOF'
feat(i18n): add copy for manual compact trigger

New keys: chat.attach.compact*, chat.commands.compact.*, chat.context.manual*,
chat.composer.autocomplete.commandsGroup. Both en and de.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `autocomplete-menu.tsx` — render command rows

**Files:**
- Modify: `app/(application)/chat/components/composer-autocomplete/autocomplete-menu.tsx`

**Interfaces:**
- Consumes: `Suggestion.kind === "command"` from Task 1; `commandsGroup` i18n key from Task 2.
- Produces: nothing new — dumb renderer; visual output only.

- [ ] **Step 1: Add `Archive` icon import**

Change the lucide-react import line:

```tsx
import { File, Sparkles, Wrench, type LucideIcon } from "lucide-react";
```

To:

```tsx
import { Archive, File, Sparkles, Wrench, type LucideIcon } from "lucide-react";
```

- [ ] **Step 2: Add `command` to `KIND_ICON`**

Change:

```tsx
const KIND_ICON: Record<Suggestion["kind"], LucideIcon> = {
  tool: Wrench,
  skill: Sparkles,
  file: File,
};
```

To:

```tsx
const KIND_ICON: Record<Suggestion["kind"], LucideIcon> = {
  command: Archive,
  tool: Wrench,
  skill: Sparkles,
  file: File,
};
```

- [ ] **Step 3: Add `command` to `groupLabel`**

Change:

```tsx
const groupLabel: Record<Suggestion["kind"], string> = {
  tool: t("composer.autocomplete.toolsGroup"),
  skill: t("composer.autocomplete.skillsGroup"),
  file: t("composer.autocomplete.filesGroup"),
};
```

To:

```tsx
const groupLabel: Record<Suggestion["kind"], string> = {
  command: t("composer.autocomplete.commandsGroup"),
  tool: t("composer.autocomplete.toolsGroup"),
  skill: t("composer.autocomplete.skillsGroup"),
  file: t("composer.autocomplete.filesGroup"),
};
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit --project . 2>&1 | grep -E "autocomplete-menu\.tsx|matching\.ts" | head -20`

Expected: no errors from the two files.

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add app/\(application\)/chat/components/composer-autocomplete/autocomplete-menu.tsx
git commit -m "$(cat <<'EOF'
feat(chat): render command-kind suggestions with Archive icon

Extends KIND_ICON and groupLabel maps so command rows render alongside
tools, skills, and files. Group header uses the new commandsGroup i18n key.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `use-composer-autocomplete.ts` — inject commands + execute branch

**Files:**
- Modify: `app/(application)/chat/components/composer-autocomplete/use-composer-autocomplete.ts`

**Interfaces:**
- Consumes: `Suggestion` type with `"command"` kind from Task 1; `chat.commands.compact.description` i18n key from Task 2.
- Produces:
  - New required arg on `UseComposerAutocompleteArgs`: `onExecuteCommand: (id: string, args: string) => void`.
  - `slashEnabled` becomes truthy whenever commands exist (currently: only when tools or skills exist).
  - `applySuggestion` now branches on `item.kind === "command"` → calls `onExecuteCommand(item.id, args)` and closes the menu without inserting text. `args` is `trigger.query` with the command name stripped off the front (case-insensitive) and trimmed.

- [ ] **Step 1: Import Translations and add commands list**

At the top of the file, add to the existing next-intl-style import section — wait, this file doesn't currently use `useTranslations`. Add:

```ts
import { useTranslations } from "next-intl";
```

Immediately after the existing imports (below the `type Suggestion, type TokenRange` import). Then inside the hook body, right after `const { agent, maxInputLength } = controller;`, add:

```ts
const t = useTranslations("chat");

// Static command registry (v1: one entry). Kept inline; promote to its own
// module when a second command lands. Args typed as string (never undefined)
// so onExecuteCommand branches on kind, not arg presence.
const COMMANDS = React.useMemo<Suggestion[]>(
  () => [
    {
      id: "cmd:compact",
      kind: "command",
      name: "compact",
      displayName: "compact",
      description: t("commands.compact.description"),
    },
  ],
  [t],
);
```

- [ ] **Step 2: Extend the args interface**

Change:

```ts
export interface UseComposerAutocompleteArgs {
  controller: ChatSessionController;
  input: string;
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}
```

To:

```ts
export interface UseComposerAutocompleteArgs {
  controller: ChatSessionController;
  input: string;
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Called when the user Enter/Tab/clicks on a command row. Args is
   *  the trigger query with the command name stripped, trimmed. Empty
   *  string means "no args" — the caller decides how to interpret. */
  onExecuteCommand: (id: string, args: string) => void;
}
```

Update the hook signature to destructure `onExecuteCommand`:

```ts
export function useComposerAutocomplete({
  controller,
  input,
  setInput,
  inputRef,
  onExecuteCommand,
}: UseComposerAutocompleteArgs): ComposerAutocomplete {
```

- [ ] **Step 3: Update `slashEnabled`**

Change:

```ts
const slashEnabled = tools.length > 0 || skills.length > 0;
```

To:

```ts
const slashEnabled = tools.length > 0 || skills.length > 0 || COMMANDS.length > 0;
```

- [ ] **Step 4: Add COMMANDS to the `/` items merge**

Locate the `items` `useMemo` (around line 206):

```ts
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
```

Replace with:

```ts
const items = React.useMemo<Suggestion[]>(() => {
  if (!trigger) return [];
  if (trigger.kind === "/") {
    // Commands rank first (rule enforced by filterSuggestions when the
    // query starts with a command name; otherwise substring matches).
    return [
      ...filterSuggestions(COMMANDS, trigger.query),
      ...filterSuggestions(toolItems, trigger.query),
      ...filterSuggestions(skillItems, trigger.query),
    ];
  }
  return filterSuggestions(fileItems, trigger.query);
}, [trigger, COMMANDS, toolItems, skillItems, fileItems]);
```

- [ ] **Step 5: Branch `applySuggestion` on command kind**

Locate `applySuggestion` (around line 230). Replace the whole callback with:

```ts
const applySuggestion = React.useCallback(
  (item: Suggestion) => {
    if (!trigger) return;

    // Commands execute instead of inserting text. Args = trigger.query
    // with the command name stripped from the front (case-insensitive)
    // and trimmed. The submit-time interception path (composer.tsx)
    // uses a regex on the full input instead.
    if (item.kind === "command") {
      const q = trigger.query;
      const lowerQ = q.toLowerCase();
      const lowerName = item.name.toLowerCase();
      const rest = lowerQ.startsWith(lowerName) ? q.slice(item.name.length) : q;
      setEscapedKey(triggerKey(trigger));
      onExecuteCommand(item.id, rest.trim());
      // Clear the whole textarea so the command doesn't linger as text.
      setInput("");
      inputRef.current?.focus();
      return;
    }

    const result = insertToken(input, trigger, caret, item.name);
    if (result.text.length > maxInputLength) {
      // Would overflow the input cap: skip the insert, dismiss the menu.
      setEscapedKey(triggerKey(trigger));
      return;
    }
    // Close the menu: the insert leaves the caret inside the same trigger
    // region (same kind:start key) and the inserted name still matches, so
    // without this the menu stays open and swallows Enter-to-send. Reuses
    // the sticky escape key — spec close condition "selection made".
    setEscapedKey(triggerKey(trigger));
    setInput(result.text);
    const el = inputRef.current;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.caret, result.caret);
      setCaret(result.caret);
    });
  },
  [trigger, input, caret, maxInputLength, setInput, inputRef, onExecuteCommand],
);
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit --project . 2>&1 | grep -E "use-composer-autocomplete|composer\.tsx" | head -20`

Expected: errors ONLY from `composer.tsx` complaining that `useComposerAutocomplete` is missing `onExecuteCommand`. That's expected and will be fixed in Task 7. No errors from `use-composer-autocomplete.ts` itself.

- [ ] **Step 7: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add app/\(application\)/chat/components/composer-autocomplete/use-composer-autocomplete.ts
git commit -m "$(cat <<'EOF'
feat(chat): inject /compact command into composer autocomplete

Static COMMANDS registry with one entry; slashEnabled now stays true even
on agents with zero tools/skills. applySuggestion branches on command kind
and calls the new onExecuteCommand callback instead of inserting text.

Breaks the hook signature (adds required onExecuteCommand); composer.tsx
wire-up follows.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `context-banner.tsx` — manual mode

**Files:**
- Modify: `app/(application)/chat/components/context-banner.tsx`

**Interfaces:**
- Consumes: `chat.context.manualTitle`, `chat.context.manualBody`, `chat.context.manualClose` i18n keys from Task 2.
- Produces:
  - Two new optional props: `manualOpen?: boolean` (default `false`) and `onCloseManual?: () => void`.
  - New render trigger: banner shows when `contextState !== "ok" || manualOpen` (still gated on a real session, existing rule).
  - Manual copy variant when `manualOpen && contextState === "ok"`: neutral tones, `Archive` icon, close button.

- [ ] **Step 1: Extend imports and props signature**

Add `Archive` to the lucide-react import:

```tsx
import { Archive, Loader2, TriangleAlert, X } from "lucide-react";
```

Change the component signature:

```tsx
export function ContextBanner({ controller }: { controller: ChatSessionController }) {
```

To:

```tsx
export function ContextBanner({
  controller,
  manualOpen = false,
  onCloseManual,
}: {
  controller: ChatSessionController;
  manualOpen?: boolean;
  onCloseManual?: () => void;
}) {
```

- [ ] **Step 2: Adjust render gate and derive manual-mode flag**

Locate:

```tsx
if (contextState === "ok" || !session || session.id === "new") return null;
const blocked = contextState === "blocked";
```

Replace with:

```tsx
if (!session || session.id === "new") return null;
if (contextState === "ok" && !manualOpen) return null;
const blocked = contextState === "blocked";
// Manual mode wins only when there is no warn/blocked state to show — a
// real context alert takes visual priority and its own copy stays. The X
// still clears manualOpen (the close handler runs regardless of copy).
const manualMode = manualOpen && contextState === "ok";
```

- [ ] **Step 3: Auto-open the steer input in manual mode**

Locate the existing `const [steerOpen, setSteerOpen] = React.useState(false);` line. Immediately AFTER the existing steer-related useState lines (the block that also declares `steer` and `dismissedAtPct`), add:

```tsx
// Manual mode is entered by the AttachMenu '+' entry — the steer input
// IS the reason the user opened it, so pre-open it as soon as manualMode
// flips true. Runs once per open-transition; if the user closes the
// steer input manually while manualMode is still true, we don't reopen.
React.useEffect(() => {
  if (manualMode) setSteerOpen(true);
}, [manualMode]);
```

- [ ] **Step 4: Extend `onCompact` to clear manual state on success**

Locate:

```tsx
const onCompact = async () => {
  const ok = await controller.compactConversation(steer);
  if (ok) {
    setSteer("");
    setSteerOpen(false);
    setDismissedAtPct(null);
  }
};
```

Replace with:

```tsx
const onCompact = async () => {
  const ok = await controller.compactConversation(steer);
  if (ok) {
    setSteer("");
    setSteerOpen(false);
    setDismissedAtPct(null);
    onCloseManual?.();
  }
};
```

- [ ] **Step 5: Branch container styling on `manualMode`**

Locate the outer `<div role="status" …>` and its className. Change:

```tsx
<div
  role="status"
  aria-live="polite"
  className={cn(
    "mb-2 rounded-md border px-3 py-2 text-xs",
    "border-warning/50 bg-warning/10",
    blocked ? "text-foreground" : "text-muted-foreground",
  )}
>
```

To:

```tsx
<div
  role="status"
  aria-live="polite"
  className={cn(
    "mb-2 rounded-md border px-3 py-2 text-xs",
    manualMode
      ? "border-border bg-muted/30 text-foreground"
      : "border-warning/50 bg-warning/10",
    !manualMode && (blocked ? "text-foreground" : "text-muted-foreground"),
  )}
>
```

- [ ] **Step 6: Branch icon + title/body copy**

Locate:

```tsx
<TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
```

Replace with:

```tsx
{manualMode ? (
  <Archive className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
) : (
  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
)}
```

Locate the title + body block:

```tsx
<span className="font-medium text-foreground">
  {blocked ? t("context.blockedTitle") : t("context.warnTitle")}
</span>{" "}
— {blocked ? t("context.blockedBody") : t("context.warnBody", { percent })}
```

Replace with:

```tsx
<span className="font-medium text-foreground">
  {manualMode
    ? t("context.manualTitle")
    : blocked
      ? t("context.blockedTitle")
      : t("context.warnTitle")}
</span>{" "}
— {manualMode
  ? t("context.manualBody")
  : blocked
    ? t("context.blockedBody")
    : t("context.warnBody", { percent })}
```

- [ ] **Step 7: Show close button in manual mode too**

Locate:

```tsx
{!blocked && (
  <button
    type="button"
    onClick={() => setDismissedAtPct(percent)}
    aria-label={t("context.dismiss")}
    className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent"
  >
    <X className="size-3.5" aria-hidden="true" />
  </button>
)}
```

Replace with:

```tsx
{manualMode ? (
  <button
    type="button"
    onClick={() => {
      setSteerOpen(false);
      setSteer("");
      onCloseManual?.();
    }}
    aria-label={t("context.manualClose")}
    className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent"
  >
    <X className="size-3.5" aria-hidden="true" />
  </button>
) : !blocked ? (
  <button
    type="button"
    onClick={() => setDismissedAtPct(percent)}
    aria-label={t("context.dismiss")}
    className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent"
  >
    <X className="size-3.5" aria-hidden="true" />
  </button>
) : null}
```

- [ ] **Step 8: Verify build**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit --project . 2>&1 | grep -E "context-banner\.tsx" | head -10`

Expected: no errors from `context-banner.tsx`.

- [ ] **Step 9: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add app/\(application\)/chat/components/context-banner.tsx
git commit -m "$(cat <<'EOF'
feat(chat): add manual mode to ContextBanner

New optional manualOpen / onCloseManual props: when true and no warn/blocked
state is active, the banner renders in neutral tones with the Archive icon,
manual copy, and the steer input pre-opened. Warn/blocked copy still wins
when both conditions apply.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `attach-menu.tsx` — new "Compact conversation" entry

**Files:**
- Modify: `app/(application)/chat/components/attach-menu.tsx`

**Interfaces:**
- Consumes: i18n keys from Task 2 (`chat.attach.compact`, `.compactDescription`, `.compactDisabledNew`, `.compactDisabledStreaming`, `.compactDisabledRunning`).
- Produces: new required prop on `AttachMenuProps`: `onCompactRequest: () => void`.

- [ ] **Step 1: Add `Archive` to imports**

Change the lucide-react import to include `Archive`:

```tsx
import {
  Archive,
  Brain,
  FileText,
  FolderOpen,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
```

- [ ] **Step 2: Extend the props interface**

Change:

```tsx
export interface AttachMenuProps {
  controller: ChatSessionController;
  onOpenPrompts: () => void;
  onOpenContext: () => void;
  onOpenCapabilities: () => void;
}
```

To:

```tsx
export interface AttachMenuProps {
  controller: ChatSessionController;
  onOpenPrompts: () => void;
  onOpenContext: () => void;
  onOpenCapabilities: () => void;
  onCompactRequest: () => void;
}
```

Update the component signature to destructure `onCompactRequest`:

```tsx
export function AttachMenu({
  controller,
  onOpenPrompts,
  onOpenContext,
  onOpenCapabilities,
  onCompactRequest,
}: AttachMenuProps) {
```

- [ ] **Step 3: Derive compact-disabled state**

Immediately after the existing `const disabledCount = ...` computation (before `const select = ...`), add:

```tsx
const session = controller.session;
const isNewSession = !session || session.id === "new";
const isBusy =
  controller.status === "streaming" || controller.status === "submitted";
const compactDisabled = isNewSession || isBusy || controller.compacting;
const compactDisabledDescription = isNewSession
  ? t("attach.compactDisabledNew")
  : isBusy
    ? t("attach.compactDisabledStreaming")
    : controller.compacting
      ? t("attach.compactDisabledRunning")
      : t("attach.compactDescription");
```

- [ ] **Step 4: Add the new MenuEntry at the bottom of the PopoverContent**

Locate the closing `</PopoverContent>` (after the conditional `{hasCapabilities && ( <MenuEntry ... /> )}` block). Insert immediately before `</PopoverContent>`:

```tsx
<MenuEntry
  icon={Archive}
  label={t("attach.compact")}
  description={compactDisabledDescription}
  disabled={compactDisabled}
  onSelect={() => select(onCompactRequest)}
/>
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit --project . 2>&1 | grep -E "attach-menu\.tsx|composer\.tsx" | head -20`

Expected: errors from `composer.tsx` reporting `AttachMenu` needs `onCompactRequest`. That's expected — fixed in Task 7. No errors from `attach-menu.tsx` itself.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add app/\(application\)/chat/components/attach-menu.tsx
git commit -m "$(cat <<'EOF'
feat(chat): add "Compact conversation" entry to AttachMenu

Fifth MenuEntry with Archive icon; disabled with descriptive subtitle when
session is new / streaming / already compacting. Fires onCompactRequest;
composer.tsx wires it to the ContextBanner manual mode.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `composer.tsx` — wire everything

**Files:**
- Modify: `app/(application)/chat/components/composer.tsx`

**Interfaces:**
- Consumes:
  - `parseCompactInput` from `./composer-autocomplete/matching` (Task 1).
  - `AttachMenu.onCompactRequest` (Task 6).
  - `ContextBanner`'s `manualOpen` + `onCloseManual` props (Task 5).
  - `useComposerAutocomplete`'s `onExecuteCommand` arg (Task 4).
  - i18n keys under `chat.commands.compact.*` (Task 2).
- Produces: fully wired feature. No exports change.

- [ ] **Step 1: Add `parseCompactInput` import**

Locate the imports section. Add:

```tsx
import { parseCompactInput } from "./composer-autocomplete/matching";
```

Group it with the other `./composer-autocomplete/*` imports.

- [ ] **Step 2: Add `manualCompactOpen` state**

Locate the block of `useState` declarations near the top of the component (around the `savePresetOpen`/`editingPreset` block). Add:

```tsx
// Composer-local: AttachMenu → ContextBanner (manual mode) handshake.
// Cleared by ContextBanner on close/success via onCloseManual.
const [manualCompactOpen, setManualCompactOpen] = useState(false);
```

- [ ] **Step 3: Add the shared `executeCompactCommand` helper**

Immediately after the existing `submit` function (around line 273 in the current file), add:

```tsx
const executeCompactCommand = useCallback(
  async (steer?: string) => {
    const cleaned = steer?.trim();
    const ok = await controller.compactConversation(
      cleaned && cleaned.length > 0 ? cleaned : undefined,
    );
    if (ok) toast.success(t("commands.compact.successToast"));
    // On failure controller.compactConversation already calls setError with
    // the right key (context.insufficientError or the raw server message);
    // no extra toast here to avoid double-surfacing.
  },
  [controller, t],
);
```

- [ ] **Step 4: Intercept `/compact` in `submit`**

Locate the existing `submit` function:

```tsx
const submit = async (e?: React.FormEvent) => {
  e?.preventDefault();

  if (contextBlocked) {
    toast.error(t("context.blockedToastTitle"), {
      description: t("context.blockedToastDescription"),
    });
    return;
  }
  if (budgetExceeded) {
    ...
```

Change the very top of the function (after `e?.preventDefault()`) to:

```tsx
const submit = async (e?: React.FormEvent) => {
  e?.preventDefault();

  // Slash-command interception: users can type "/compact [focus...]" and
  // hit Enter without opening the menu. Runs even when contextBlocked,
  // since compaction is the way OUT of the blocked state.
  const compactParse = parseCompactInput(input);
  if (compactParse.isCompact) {
    setInput("");
    await executeCompactCommand(compactParse.steer);
    return;
  }

  if (contextBlocked) {
    ...
```

- [ ] **Step 5: Wire `onExecuteCommand` into the autocomplete hook**

Locate the `useComposerAutocomplete` call:

```tsx
const autocomplete = useComposerAutocomplete({
  controller,
  input,
  setInput,
  inputRef,
});
```

Change to:

```tsx
const autocomplete = useComposerAutocomplete({
  controller,
  input,
  setInput,
  inputRef,
  onExecuteCommand: (id, args) => {
    // Only one command exists today. Branch on id to keep the surface
    // extensible if a second one lands (v1: cmd:compact).
    if (id === "cmd:compact") {
      void executeCompactCommand(args);
    }
  },
});
```

Note: this callback needs to see `executeCompactCommand`, which was defined further down. Move the `executeCompactCommand` declaration ABOVE `useComposerAutocomplete` if the linter complains about hook order — but check first: `useCallback` hooks can appear in any order as long as they run on every render. In this case, the callback closure captures `executeCompactCommand` by reference, so as long as both are defined before render return, order doesn't matter for correctness. If TypeScript complains about use-before-declaration for a `const`, hoist `executeCompactCommand` above the `useComposerAutocomplete` call (both are `useCallback` — safe to reorder).

- [ ] **Step 6: Pass new props to `AttachMenu` and `ContextBanner`**

Locate the `<AttachMenu>` JSX:

```tsx
<AttachMenu
  controller={controller}
  onOpenPrompts={() => setPromptSelectorOpen(true)}
  onOpenContext={() => setContextModalOpen(true)}
  onOpenCapabilities={() => setCapabilitiesOpen(true)}
/>
```

Change to:

```tsx
<AttachMenu
  controller={controller}
  onOpenPrompts={() => setPromptSelectorOpen(true)}
  onOpenContext={() => setContextModalOpen(true)}
  onOpenCapabilities={() => setCapabilitiesOpen(true)}
  onCompactRequest={() => setManualCompactOpen(true)}
/>
```

Locate the `<ContextBanner>` JSX (around line 491):

```tsx
<ContextBanner controller={controller} />
```

Change to:

```tsx
<ContextBanner
  controller={controller}
  manualOpen={manualCompactOpen}
  onCloseManual={() => setManualCompactOpen(false)}
/>
```

- [ ] **Step 7: Verify build**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit --project . 2>&1 | grep -E "\.tsx:|\.ts:" | head -20`

Expected: no errors from any of the files touched in Tasks 1–7.

- [ ] **Step 8: Run the full vitest suite**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm test`

Expected: all tests pass, including the new `matching.test.ts` cases.

- [ ] **Step 9: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add app/\(application\)/chat/components/composer.tsx
git commit -m "$(cat <<'EOF'
feat(chat): wire /compact command and AttachMenu compact entry

Adds manualCompactOpen state, executeCompactCommand helper, submit-time
regex interception for /compact [steer], and onExecuteCommand bridge into
useComposerAutocomplete. AttachMenu's new entry opens ContextBanner in
manual mode.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Manual smoke test

**Files:** none (test-only task).

**Interfaces:** none.

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm run dev`

Open the chat page in a browser at whatever URL the dev server prints. Use an agent that has ≥1 tool AND is not in guest mode.

- [ ] **Step 2: Smoke — slash menu discovery**

- Send at least one message so `session.id !== "new"`.
- Type `/` in the composer. Confirm the autocomplete menu shows a "Commands" group at the top with a single row: `compact` (Archive icon, description "Summarize earlier messages to free context"), followed by "Tools" and "Skills" groups below.

- [ ] **Step 3: Smoke — `/compact` submit path (no steer)**

- Clear the composer, type `/compact`, hit Enter.
- Expected: input clears, a success toast "Conversation compacted" appears, a "Conversation compacted — older messages summarized" divider renders in the message list, and the context meter drops.

- [ ] **Step 4: Smoke — `/compact` submit path (with steer)**

- Send a couple more messages so there's fresh material.
- Type `/compact focus on the deploy issue`, hit Enter.
- Expected: same success surfaces as Step 3; expand the summary divider (if the divider allows expansion) and confirm the summary reflects the focus hint.

- [ ] **Step 5: Smoke — menu-selection execute (no args)**

- Type `/` and use arrow keys or the mouse to select the `compact` row. Press Enter or click.
- Expected: input clears, success toast, divider, meter drop — same as Step 3.

- [ ] **Step 6: Smoke — AttachMenu entry**

- Click `+` in the composer.
- Confirm the last entry is "Compact conversation" with the Archive icon and description "Summarize earlier messages to free context."
- Click it.
- Expected: menu closes, `ContextBanner` appears in manual mode (neutral border/background, Archive icon, title "Compact conversation", body about summarizing, steer input already visible, X close button in the top-right).
- Type a steer, click "Compact conversation" in the banner.
- Expected: banner closes, success toast, divider, meter drop.

- [ ] **Step 7: Smoke — close manual banner without running**

- Click `+` → "Compact conversation" → banner opens → click the X.
- Expected: banner closes without running compaction.

- [ ] **Step 8: Smoke — disabled AttachMenu entry**

- Reload the page (or start a new chat via the history rail — session.id === "new").
- Click `+`.
- Expected: "Compact conversation" entry is greyed out with the subtitle "Send at least one message before compacting."
- Send a message. While the response is streaming, click `+`.
- Expected: entry is greyed with the subtitle "Wait for the current response to finish."

- [ ] **Step 9: Smoke — guest mode has no compact surfacing**

- Navigate to a `/public/agents/[id]` route (in a private window if needed).
- Expected: no `+` button in the composer, and typing `/` shows no autocomplete menu (or only the file autocomplete if `@` triggers exist; there should be no "Commands" group).

- [ ] **Step 10: Report smoke results**

If everything above passes, mark the task complete. If anything fails, note the failure and stop — do not attempt to fix in this plan; open a follow-up.

- [ ] **Step 11: No commit needed for smoke tests; final wrap-up**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git status
git log --oneline -8
```

Expected: 7 new commits (Tasks 1–7), working tree clean (except for pre-existing untracked/modified files).

---

## Self-Review Notes (author-only, not for the implementer)

- Spec coverage: every File Map row in the spec has a task; the manual smoke test covers each smoke item listed in the spec's Testing section.
- Placeholders: none. Every code block is full and copy-paste-ready.
- Type consistency: `onExecuteCommand: (id: string, args: string) => void` is declared in Task 4's `UseComposerAutocompleteArgs` and referenced with the same signature in Task 7. `onCompactRequest: () => void` is declared in Task 6 and passed in Task 7. `manualOpen`/`onCloseManual` optional props declared in Task 5 and passed in Task 7. `parseCompactInput` return type matches usage in Task 7.
