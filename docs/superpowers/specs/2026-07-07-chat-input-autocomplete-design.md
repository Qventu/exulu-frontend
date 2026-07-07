# Chat composer inline autocomplete (`/` tools & skills, `@` session files)

**Date:** 2026-07-07
**Status:** Approved (design), pending implementation plan
**Route:** `app/(application)/chat/[agent]/[session]`

## Summary

Power-user autocomplete in the chat composer. Typing `/` at a word start opens a
suggestion menu of the tools and skills available to the agent in this session;
typing `@` does the same for files in the session's file sandbox (only when
`agent.sandbox_enabled`). Selecting a suggestion inserts the exact machine name
into the message text. Recognized tokens render with a subtle inline highlight
(purple pill behind the text) via a mirror overlay — the input remains the
existing plain `TextareaAutosize`.

## Decisions (user-confirmed)

1. **Semantics: text reference only.** Selecting inserts `/name` or `@file.ext`
   as plain text. No side effects (no tool re-enabling, no structured metadata,
   no backend changes). The backend agent interprets intent from the text.
2. **Trigger rule: word start, anywhere.** `/` and `@` open the menu when typed
   at the start of the message or after whitespace. `3/4`, `email@domain.com`,
   and URLs never trigger.
3. **Disabled tools: shown greyed, still selectable.** Tools present in
   `controller.disabledTools` render with reduced opacity and a small "off"
   badge, but can be inserted.
4. **Badge rendering: highlight overlay.** No editor library. A mirror layer
   behind the transparent-background textarea paints `bg-primary/10` rounded
   pills under recognized tokens. Tokens are *highlights*, not atomic chips:
   editing is char-by-char and a token that stops matching simply loses its
   highlight.

## Architecture

All new code is route-local in
`app/(application)/chat/components/composer-autocomplete/`, wired only into
`composer.tsx`. The composer keeps its deliberate state discipline (input
string + overlay flags local; everything else on the controller). No second
`useChatSession` — the single-instance rule holds; all data comes via the
existing `controller` prop.

### Units

| Unit | Responsibility |
|---|---|
| `token-matching.ts` | Pure functions: given the input string and known names, return highlight ranges. Longest-match at word boundaries (supports file names containing spaces). No React. |
| `use-inline-trigger.ts` | Hook watching input value + caret (`selectionStart`): returns active trigger `{ kind: '/' \| '@', query, start }` or `null`. |
| `autocomplete-menu.tsx` | Suggestion listbox, absolutely positioned above the textarea inside the composer's existing `relative` form card, full card width. Custom lightweight listbox (manual `selectedIndex`), styled with the cmdk visual language (`bg-popover border rounded-md shadow-md`; active row `bg-accent text-accent-foreground`). Not cmdk itself: cmdk's focus model assumes its own input owns focus, and focus must stay in the textarea. |
| `highlight-overlay.tsx` | Mirror div behind the textarea: identical font/padding/line-height/wrapping metrics, all text `color: transparent`, matched tokens wrapped in `bg-primary/10 rounded px-0.5 -mx-0.5` spans. Textarea gets `bg-transparent`. Syncs `scrollTop` on the textarea's scroll event (matters once autosize hits its cap). |

### Composer integration (`composer.tsx`)

- Mount `HighlightOverlay` behind the `TextareaAutosize`
  (composer.tsx:502-521) inside the same relative container.
- Mount `AutocompleteMenu` inside the form card
  (`relative rounded-lg border bg-card p-2`, composer.tsx:484-487).
- Extend `handleKeyDown` (composer.tsx:275-286): when the menu is open,
  delegate ArrowUp/ArrowDown/Enter/Tab/Escape to it **before** the existing
  Enter-submits and Escape-clears logic; `stopPropagation` on Escape so the
  document-level overlay chain (composer.tsx:236-250) does not fire.

## Data sources

### `/` — tools & skills

- Source: `controller.agent.tools` and `controller.agent.skills`
  (already loaded server-side; threaded via the `controller` prop).
- Normalize legacy shape: `agent.tools` may be `string[]` of ids on old agents
  (`typeof t === "string" ? { id: t, name: t } : t`, same tolerance as
  `agent-detail-panel.tsx`).
- Grouping: "Tools" and "Skills" group headers.
- Display name prettified (`name.replace(/_/g, " ")`, as in
  `capability-sheet.tsx`); **insertion uses the exact machine name**.
- Disabled state from `controller.disabledTools` (greyed + "off" badge,
  selectable).
- Descriptions: the agent object strips descriptions at save time, so lazily
  fetch the catalogs on first `/` open — `tools` resolver (id, name,
  description) and `skillsPagination` (id, name, description) — join by id,
  cache for the component lifetime. The menu is functional immediately with
  names; descriptions hydrate in when loaded. Catalog fetch failure is
  non-fatal (names-only menu).
- Agent with no tools and no skills: `/` is inert (plain text, no menu).

### `@` — session files

- Gate: trigger only when `controller.agent.sandbox_enabled` is true;
  otherwise `@` is plain text.
- Source: `sessionFilesApi.list(sessionId)` (REST), fetched on each menu open
  (flat, unpaginated list; the files panel already polls it every 5 s).
- `sessionId` from `controller.session?.id`. No session yet (`/new` with
  nothing uploaded): show the "No files in this session yet" empty state —
  do **not** call `ensureSession` just to render an empty menu.
- Insert the file **name** (not the S3 key). List fetch failure shows a quiet
  error row in the menu, never a toast.

### On send

Nothing new. The message is plain text containing the tokens. The POST body
keeps its existing `disabledTools` / `approvedTools` shape untouched
(hooks.ts transport is documented as untouchable).

## Interaction

- **Open:** trigger char typed at word start. Menu filters live as the query
  grows (case-insensitive substring on name + description; prefix matches
  ranked first; no fuzzy library).
- **Query span:** from trigger char to caret. `@` queries may contain spaces.
  Close conditions: caret moves out of the trigger region, trigger char
  deleted, Escape, selection made, blur/click-outside, or the query ends in
  whitespace with zero matches.
- **Keyboard while open:** `↑`/`↓` move active row, `Enter`/`Tab` insert,
  `Escape` closes only the menu. All intercepted ahead of the composer's own
  handlers.
- **Insert:** replace `trigger+query` with the token plus a trailing space;
  restore focus and place the caret after the space. Skip the insert if it
  would exceed `maxInputLength`.
- **Mouse:** click a row to insert (mousedown-guarded so blur doesn't close
  the menu first).
- **IME:** no trigger detection or key handling while `isComposing`.
- **ARIA:** textarea gets `aria-autocomplete="list"`, `aria-expanded`,
  `aria-controls`, `aria-activedescendant`; menu is `role="listbox"` with
  `role="option"` rows.

## Token highlighting rules

- A token highlights only while it exactly matches a known name at a word
  boundary (longest match wins — needed for file names with spaces).
- Editing a token drops the highlight the moment it stops matching; deleting
  a file or detaching a tool later silently un-highlights stale references.
- Highlight style: `bg-primary/10 rounded` pill behind the text — the house
  purple token pattern (message-renderer.tsx:543). Amber stays reserved for
  knowledge-context chips.

## Edge cases

- `3/4 cups`, `user@example.com`, `https://a/b` — never trigger (word-start
  rule).
- Read-only sessions render no composer, so the feature is naturally absent.
- Streaming/submitted status: menu can stay open while typing is allowed;
  Enter-to-insert works because it's intercepted before the send guard.
- Native undo: insertion via `setInput` resets the textarea's undo stack —
  accepted trade-off, identical to the existing `insertPromptIntoChat`
  behavior.
- Overlay metric drift is the main visual risk: the overlay copies the
  textarea's exact typography classes (`white-space: pre-wrap`,
  `word-break: break-word`, same padding/line-height) and must be verified in
  both themes, at wrapped multi-line lengths, and at the autosize scroll cap.

## i18n

New strings in `messages/en.json` and `messages/de.json` under the chat
namespace: group headers ("Tools", "Skills", "Session files"), "off" badge,
empty states ("No matching tools or skills", "No files in this session yet"),
and the file-list error row.

## Testing

- **Unit (primary):** `token-matching.ts` and the trigger-detection logic —
  word-boundary rules, longest-match with spaces, caret math, close
  conditions, maxInputLength guard.
- **Component:** insert/replace behavior if the existing setup supports it
  cheaply.
- **Manual UAT before merge:** both themes, mobile viewport, IME input,
  wrapped lines, disabled-tool rendering, sandbox-off agent, `/new` session.

## Out of scope

- Atomic chip behavior (delete-as-unit) and editor libraries.
- Backend changes of any kind.
- Caret-anchored popover positioning (menu is card-anchored).
- Referencing knowledge-context items via `@` (pinned context already covers
  this via the items modal).
