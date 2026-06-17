# Prompt Library — Review & Design Concept
**Routes:** `/prompts`, `/prompts/[id]`  **Primary persona:** P2 Power user (curates the library)  **Secondary:** P1 End user (finds & uses prompts), P3 Admin (governance of shared prompts, via RBAC metadata)  **Current state:** functionally rich (versioning, diff/restore, RBAC sharing, variables, agent assignment) but visually loud and off-system (mega-hero, fake browser chrome, color confetti), with broken pagination beyond 50 items, a favorite-toggle data bug, hover-only destructive actions, a half-dead `/prompts/[id]` route, and zero i18n.

The Prompt Library is one entity (`prompt_library`) surfaced in **four** places that must stay
in sync: this page pair, the chat composer's prompt selector
(`app/(application)/chat/[agent]/[session]/components/prompt-selector-modal.tsx`), the
agent edit form's embedded prompt cards (`app/(application)/agents/edit/[id]/form.tsx:981`),
and the agent edit page's **`PromptBrowserSheet`**
(`app/(application)/agents/edit/[id]/components/prompt-browser-sheet.tsx`), which embeds the
prompt editor modal itself. This doc redesigns the page pair; the three integrations are
listed in the inventory (items 64–66, 70) because the redesign must not break their contracts
(shared hooks, `lib/prompts/*` utilities, `PromptVariableForm`, and `PromptEditorModal`'s
embedding API).

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File paths relative to repo root.

**Navigation & data layer**

1. Sidebar nav item "Prompts" (ClipboardType icon, translated label) visible to **all roles** — no RBAC gate (`components/custom/main-nav.tsx:127-131`). Matches "P1 uses, P2 curates".
2. `/prompts` is a client page with `export const dynamic = "force-dynamic"` (`app/(application)/prompts/page.tsx:18`); `/prompts/[id]` is an async **server** component fetching via `fetchGraphQLServerSide` (`app/(application)/prompts/[id]/page.tsx:7-14`).
3. Server-side pagination, filtering and sorting through `GET_PROMPTS` (`hooks/use-prompts.tsx:48-62`; invoked with `page`, `limit: 50`, `filters`, `sort` at `prompts/page.tsx:97-102`). Read access is enforced by the backend — the query only returns prompts the user may read.
4. Pagination *state* exists (`page`, `limit`, `pageInfo` — `page.tsx:27-28,105`) but **no pagination controls are rendered**; `ChevronLeft`/`ChevronRight` are imported and unused (`page.tsx:7`). Prompts beyond the first 50 are unreachable.

**List page `/prompts` — header, toolbar, filters**

5. Hero header: "Prompt / Library" at `text-4xl sm:text-5xl lg:text-6xl font-black`, purple accent on "Library", tagline paragraph (`page.tsx:131-141`).
6. Primary CTA "New Prompt" (oversized `h-12 sm:h-14`, purple shadow effects) opens the create modal (`page.tsx:143-152`).
7. Keyboard shortcut **Cmd/Ctrl+K** opens the create modal (`page.tsx:42-46`).
8. Keyboard shortcut **Cmd/Ctrl+/** focuses search — implemented by `document.querySelector('input[placeholder="Search prompts..."]')` (`page.tsx:47-52`).
9. Dev-mode console easter egg printing the shortcuts (`page.tsx:60-71`).
10. Search input filtering server-side on `{ name: { contains } }` only (`page.tsx:79-82,157-165`).
11. Sort dropdown with 5 options: Recently Updated (default), Recently Created, Most Favorited, Most Used, Alphabetical — radio group in a DropdownMenu (`prompts/components/prompt-filters.tsx:41-83`).
12. Agent filter: multi-select checkbox dropdown over up to 100 agents (`GET_AGENTS`), trigger shows count badge (`prompt-filters.tsx:85-121`); selected agents are AND-combined server filters `{ assigned_agents: { contains } }` (`page.tsx:89-94`).
13. Removable chips for each selected agent filter, with `aria-label` on the X (`prompt-filters.tsx:123-144`).
14. Tag quick-filter chips row labeled "Folders": all unique tags from `GET_UNIQUE_PROMPT_TAGS` rendered as toggleable badges; selected tags are AND-combined server filters `{ tags: { contains } }` (`page.tsx:84-88,177-210`; `hooks/use-prompts.tsx:189-191`).
15. Any filter/search/sort change resets to page 1 (`page.tsx:73-76`).
16. List panel header showing the visible count: "n prompt(s)" (`page.tsx:230-234`).
17. Auto-select first prompt when the list loads; selected prompt re-synced from fresh data after edits/refetch (`page.tsx:111-126`).
18. Loading state: spinner + "Loading..." inside the list panel (`page.tsx:236-242`).
19. Empty states: "No prompts yet" + "New Prompt" button, vs. "No matches found" + "Try a different search term" when searching (`page.tsx:243-264`).
20. Error state: destructive icon, message, "Try Again" refetch button (`page.tsx:213-223`).

**List rows (`prompt-list-item.tsx`)**

21. Row content: name (truncated), amber thumbs-up indicator when favorited, color-coded rights-mode icon+label (private = red Lock, public = green Globe, users = blue Users, roles = purple Shield, **fallback = "Public"/Globe** — `prompt-list-item.tsx:63-77`), favorite count, usage count, variable count ("n vars", violet), first tag + "+n" overflow (`prompt-list-item.tsx:82-181`).
22. Hover-only **Share** icon button per row: copies `${origin}/prompts/${id}` to clipboard with toast (`prompt-list-item.tsx:51-60,111-119`).
23. Hover-only **Delete** icon button per row (only with write access): native `confirm()` dialog, mutation, toast, clears the selection if the deleted prompt was selected (`prompt-list-item.tsx:27-49,121-135`; `page.tsx:273-279`).

**Detail preview (`prompt-preview.tsx`, used by both routes)**

23a. No-selection placeholder for the desktop detail region: FileText icon, "Select a prompt to preview", "Choose a prompt from the list to view its details" (`page.tsx:295-309`). Reachable despite auto-select (item 17): deleting the selected prompt clears the selection (item 23; `page.tsx:273-279`), and an empty or fully-filtered list selects nothing.
24. Decorative fake browser chrome: red/yellow/green traffic-light dots + a mono "URL bar" showing `prompt-library/<slugified-name>` (`prompt-preview.tsx:183-194`).
25. Share-link icon button in the chrome bar (same deep-link copy as item 22) (`prompt-preview.tsx:155-163,198-206`).
26. Favorite toggle icon button: calls `toggleFavorite` which creates/deletes a `prompt_favorites` row and increments/decrements the global `favorite_count`; double-click guard; amber filled state (`prompt-preview.tsx:92-121,209-228`; `hooks/use-prompts.tsx:151-184`).
27. Overflow menu (write access only): **Edit**, **Copy Content**, **Delete** (native `confirm()`) (`prompt-preview.tsx:73-90,230-257`).
28. Title (`text-2xl font-bold`) + optional description (`prompt-preview.tsx:264-271`).
29. Metadata row: creator name (resolved per prompt via `GET_USER_BY_ID`, `prompt-preview.tsx:66-71`) and relative "updated x ago" (`prompt-preview.tsx:273-286`).
30. Stats row: favorite count (amber when favorited) and usage count (emerald) (`prompt-preview.tsx:288-302`).
31. Variable-count badge (violet outline) when content contains `{{vars}}` (`prompt-preview.tsx:304-308`).
32. Tag badges (secondary) (`prompt-preview.tsx:310-314`).
33. "Assigned Agents" section: names resolved via `GET_AGENTS_BY_IDS`, shown as purple Bot badges (`prompt-preview.tsx:56-63,317-334`).
34. Content block: mono, pre-wrap, with `{{variables}}` "highlighted" by regex string replacement injected via `dangerouslySetInnerHTML` (`prompt-preview.tsx:165-178,336-344`).
35. Click anywhere on the content block copies the raw content to clipboard (`prompt-preview.tsx:340`, handler `:123-129`) — no visual affordance.
36. **"Use This Prompt"** primary action: content without variables → copy to clipboard; with variables → opens `PromptVariableForm`, fills via `fillPromptVariables`, copies the filled result (`prompt-preview.tsx:131-153,348-354,386-395`). Note: this path does **not** increment `usage_count` (only the chat path does, item 65).
37. Bottom **Edit** button (write access) → editor modal (`prompt-preview.tsx:355-369`; modal wired at `page.tsx:325-336`).
38. `PromptVariableForm` (shared with chat): one labeled Input per variable, names Title-Cased via `formatVariableName`, submit disabled until all fields filled, configurable submit label (`app/(application)/chat/[agent]/[session]/components/prompt-variable-form.tsx`).

**Version history (inside the preview)**

39. `VersionHistoryPanel`: header with derived current-version badge (`max(history)+1`), version count; empty state ("Changes will be tracked automatically when you edit") (`prompts/components/version-history-panel.tsx:43-77,80-113`).
40. Collapsed view shows the **first 3 entries of the history array** (`history.slice(0, 3)`, `version-history-panel.tsx:45`) with a "Show All (n more)" / "Show Less" expander (`:93-112`). Because history is appended chronologically oldest→newest (`prompt-editor-modal.tsx:215-218`: `[...existingHistory, newVersionEntry]`; restore appends too, `version-restore-modal.tsx:80`), this actually shows the 3 **oldest** versions, and `isLatest={index === 0}` (`version-history-panel.tsx:121`) tags the oldest entry as latest — see M12.
41. Per version row: actor name (per-row `GET_USER_BY_ID`), relative timestamp, **Compare** button, **Restore** button (write access only) (`version-history-panel.tsx:163-228`). The stored `change_message` is **not rendered anywhere** in the panel.
42. `VersionDiffModal`: "Compare from"/"Compare to" Selects including a synthetic "Current" version; metadata-change summary (name/description/tags as strikethrough → new); word-level side-by-side `react-diff-viewer-continued` themed for light/dark; "No content changes" notice (`prompts/components/version-diff-modal.tsx:41-262`).
43. `VersionRestoreModal`: amber warning that the current state is preserved as a new version; preview of what will change (content snippet + char count, name/description/tags arrows); editable restoration note defaulting to "Restored from vN"; restore disabled when versions are identical; appends current state to history (50-entry cap) before applying the old version (`prompts/components/version-restore-modal.tsx:38-113,115-256`).
44. Edit-time versioning logic (client-side): a history entry is added only when content/name/description/tags actually changed; entries by the same user within 5 minutes are **squashed**; history capped at 50; optional change message attached (`prompts/components/prompt-editor-modal.tsx:179-233`).

**Editor modal (create + edit, `prompt-editor-modal.tsx`)**

45. Name (required) and description (optional) inputs (`prompt-editor-modal.tsx:264-285`).
46. Content (required) with dual editing modes: plain mono `Textarea` (12 rows) ↔ `MarkdownEditor` with live preview (400 px), toggled by a "Rich Text"/"Plain Text" button (`prompt-editor-modal.tsx:90,289-323`).
47. Variable affordances: syntax hint (`{{variable_name}}`), live detected-variables badges under the content (`prompt-editor-modal.tsx:99-101,325-351`).
48. Invalid-variable validation: names outside `[a-zA-Z0-9_]` produce an inline error and block submission (`prompt-editor-modal.tsx:101,144-159,353-358,516`; `lib/prompts/validate-variable-name.ts`).
49. Tags via shared `TagSelector` ("Folders"): search existing tags, create new, case-insensitive dedupe, removable chips (`prompt-editor-modal.tsx:361-372`; `components/tag-selector.tsx`). The spec's max-5-tags rule is not enforced in the UI.
50. "Assign to Agents": searchable Command-popover multi-select + removable chips; helper text "show it as recommended in chat" (`prompt-editor-modal.tsx:374-451`).
51. Access control: Collapsible section embedding shared `RBACControl` — rights modes `private | users | roles | teams | public`, per-entry read/write rights; collapsed trigger summarizes mode/counts (private/public/users/roles only — no teams case, `prompt-editor-modal.tsx:454-484,458-465`). **Teams selections are silently dropped on save** (the `onChange` ignores the 4th `teams` argument and the mutation input contains only users/roles — `prompt-editor-modal.tsx:168-175,475-480`; `components/rbac.tsx:67`).
52. "What changed?" optional change-message textarea, shown only when editing (`prompt-editor-modal.tsx:486-507`).
53. Footer: Cancel; submit disabled while saving or when name/content empty or variables invalid; success/error toasts; create defaults to `private`; create refetches `GET_PROMPTS` + `GET_UNIQUE_PROMPT_TAGS` (`prompt-editor-modal.tsx:510-520`; `hooks/use-prompts.tsx:77-87`).
54. Embedding props `defaultTags` and `defaultAssignedAgents` for reuse from other pages — passed in practice **only** by the agents edit page's `PromptBrowserSheet` (item 70; `prompt-browser-sheet.tsx:354-361`); the agents `form.tsx` itself never passes them (`prompt-editor-modal.tsx:49-53,117-126`).

**Detail route `/prompts/[id]`**

55. Server-side fetch by id with `GET_PROMPT_BY_ID`; a stray `console.log(data)` ships to server logs (`[id]/page.tsx:10-12`).
56. Not-found / no-permission state: "Prompt not found" + explanation + "Back to Prompts" button (`[id]/page.tsx:16-33`).
57. Renders the full-width `PromptPreview` **without** `onEdit`/`onUpdate` (`[id]/page.tsx:54-56`) — the Edit buttons render for writers but do nothing, and after Delete the page keeps showing the deleted prompt; "Back to Prompts" is a full-reload `<a href>` (`[id]/page.tsx:45`).

**Access rules (`lib/prompts/check-prompt-access.ts`)**

58. `checkPromptWriteAccess`: creator always; `super_admin` override; `private` → creator/admin only; **`public` → everyone has write access** (`check-prompt-access.ts:33-36`); `users`/`roles` → explicit `rights === "write"` entry; no `teams` branch (teams-mode prompts are writable only by creator/admin).
59. `checkPromptReadAccess`: creator/admin always; private → no; public → yes; users/roles → any entry. Currently unused by these pages (backend filters reads), but part of the lib contract (`check-prompt-access.ts:66-117`).

**Shared utilities (contract used by chat + agents too, `lib/prompts/`)**

60. `extractVariables`: unique, sorted `{{var}}` names (`extract-variables.ts`).
61. `fillPromptVariables` (regex-escaped replacement) + `hasUnfilledVariables` (`fill-prompt-variables.ts`).
62. `formatVariableName`: `customer_name` → "Customer Name" (`format-variable-name.ts`).
63. `validateVariableName` / `validatePromptVariables` (`validate-variable-name.ts`).

**Cross-page integrations (must keep working unchanged)**

64. Chat composer "insert prompt" button opens `PromptSelectorModal`: or-search across name/description/content, tag-derived category tabs, inline variable filling with live colored preview, copy, insert into the chat input (`chat.tsx:1236,1458-1462`; `prompt-selector-modal.tsx:85-120`).
65. `usage_count` is incremented **only** on chat insertion (`chat.tsx:513-521`; `useIncrementPromptUsage`, `hooks/use-prompts.tsx:113-117`).
66. Agents edit form embeds the legacy `PromptCard` grid card (favorite toggle, Details/Edit dropdown, "Remove from folder", delete, stats, creator) (`agents/edit/[id]/form.tsx:89,981`; `prompts/components/prompt-card.tsx`).
67. Orphaned/dead code in this area: `PromptsGroupedView` folder-cards view that routes to `/prompts/<tag>` — **colliding with `/prompts/[id]`** (`prompts/components/prompts-grouped-view.tsx:46-52`, imported nowhere); dead `showOnboarding` state (`page.tsx:31-37`); unused imports `PromptCard`, `ChevronLeft/Right`, `MessageSquare` (`page.tsx:7,9`).
68. Favorites data model: `prompt_favorites` junction (`useUserPromptFavorites`, `useCreatePromptFavorite`, `useDeletePromptFavorite`) + denormalized `favorite_count` + per-user computed `is_favorited` (`hooks/use-prompts.tsx:122-184`; `types/models/prompt-library.ts:33-42`).
69. `GET_UNIQUE_PROMPT_TAGS` feeds both the filter chips (item 14) and the `TagSelector` (item 49) (`hooks/use-prompts.tsx:189-191`).
70. **Agents edit page `PromptBrowserSheet`** (`agents/edit/[id]/components/prompt-browser-sheet.tsx`, mounted at `agents/edit/[id]/form.tsx:86,1537`) — the fourth consumer of the prompt stack. It (a) consumes `usePrompts`, `useUniquePromptTags`, and `useUpdatePrompt` (`prompt-browser-sheet.tsx:4`); (b) owns a folder-browse flow (tags as folders + "untagged", name search, assigned-prompts-first sorting — `:43-119`) plus a "Create Prompt" entry point (`:180-190`); (c) embeds `PromptEditorModal` with **both** `defaultTags` and `defaultAssignedAgents` (`:22,354-361`) — the only caller that passes them (item 54); and (d) owns an **alternate assign/unassign write path** that mutates `assigned_agents` directly via a per-prompt Add/Remove toggle (`:121-153`). Any change to the editor modal renders *inside the agents page* through this sheet (see Dependencies).

### UX review

**High**

- **H1 — Pagination is broken.** State and `pageInfo` exist but no controls render; with `limit: 50` everything past the 50th prompt is invisible and unsearchable-by-scroll (`page.tsx:27-28,104-105`, unused chevrons `:7`). Silent data invisibility.
- **H2 — Favorite toggle corrupts data.** Both the preview and the legacy card call `toggleFavorite(..., isFavorited, count, undefined)`; since `favoriteId` is always `undefined`, the unfavorite branch (`if (isFavorited && favoriteId)`) never runs — toggling an already-favorited prompt **creates a duplicate favorite row and increments the count again** (`prompt-preview.tsx:97-103`; `prompt-card.tsx:94-100`; `hooks/use-prompts.tsx:163-180`). Engagement stats are untrustworthy.
- **H3 — Unsafe and broken content rendering.** Prompt content goes through `dangerouslySetInnerHTML` (stored-XSS surface for shared/public prompts), and the highlight regex matches single braces `\{var\}` while content uses `{{var}}`, producing mangled output like `{<span>{var}</span>}` (`prompt-preview.tsx:165-178,342`).
- **H4 — Teams sharing silently loses data and lies in the UI.** Editor drops `teams` selections on save (`prompt-editor-modal.tsx:475-480`) and never re-hydrates them (`:104-128` reads only users/roles); the list row's rights map has no `teams` case so team-shared prompts fall through to the fallback and display as "Public" with a Globe icon — rendered in `text-muted-foreground`, not the green of true public prompts (`prompt-list-item.tsx:74-76` vs `:69`; item 21) — so the label and icon lie even though the color does not. Same bug class already flagged on Models.
- **H5 — Destructive delete via native `confirm()` in two different places** (row hover button and preview overflow), inconsistent with the shared ConfirmDialog pattern and unstylable (`prompt-list-item.tsx:30`; `prompt-preview.tsx:74`; `prompt-card.tsx:75`).
- **H6 — `/prompts/[id]` is half dead.** Edit buttons render but no-op (`onEdit` undefined), Delete leaves the user staring at a deleted prompt (`onUpdate` undefined), back-link is a full page reload (`[id]/page.tsx:45,54-56`).
- **H7 — Header violates the design system.** `text-6xl font-black` hero with animated entrance vs. the `PageHeader` standard (`text-2xl`, one-line purpose, action right) (`page.tsx:131-153`; philosophy §5, CLAUDE.md type scale).
- **H8 — `public` rights mode grants write access to everyone** (`check-prompt-access.ts:33-36`), contradicting the spec ("Public: everyone can read/use, write access controlled" — `PROMPT_LIBRARY_SPEC.md:88`) and the admin's "no foot-guns" goal. Anyone can edit or delete a public prompt.

**Medium**

- **M1 — Color confetti.** Cyan clock, emerald activity, amber thumbs-up, violet variables, red/green/blue/purple rights icons, six rotating folder colors — semantic colors used decoratively, purple diluted (`prompt-preview.tsx:281,299,305`; `prompt-list-item.tsx:67-76`; `prompts-grouped-view.tsx:111-118`). Violates philosophy §4.
- **M2 — Hover-only row actions.** Share/Delete are `opacity-0 group-hover:opacity-100` — invisible to keyboard and touch users (`prompt-list-item.tsx:114,127`). They are duplicated in the preview, but the row buttons are still inaccessible affordances.
- **M3 — Fake browser chrome** (traffic lights, fake URL bar) is decorative noise that costs ~44 px and a row of mystery dots (`prompt-preview.tsx:183-194`); long names overflow the un-truncated slug.
- **M4 — Primary CTA label never shows.** `hidden xs:inline` / `xs:hidden` rely on an `xs` breakpoint that is not defined (`tailwind.config.js` defines no `xs` screen) — the button always reads just "New" at every width (`page.tsx:149-150`).
- **M5 — Zero i18n.** Every string in the prompts area is hardcoded English while the nav label itself is translated (`main-nav.tsx:128`); app supports en/de via next-intl.
- **M6 — Brittle/conflicting shortcuts.** Cmd/Ctrl+K is the de-facto command-palette chord, hijacked here for "create"; Cmd+/ focuses search via a placeholder-text DOM query that breaks the moment the placeholder is translated (`page.tsx:42-52`).
- **M7 — Search scope inconsistency.** List page searches name only (`page.tsx:80-82`); the chat selector or-searches name/description/content (`prompt-selector-modal.tsx:88-96`); the spec wants all three (`PROMPT_LIBRARY_SPEC.md:99`).
- **M8 — Usage counting is inconsistent.** "Use This Prompt" (copy path) never increments `usage_count` (item 36) while chat insertion does (item 65) — "Most Used" sorting is skewed.
- **M9 — Version metadata wasted.** `change_message` is collected (items 43, 52) but never displayed (`version-history-panel.tsx:163-228`); restore mis-attributes `changed_by` to the prompt's creator instead of the acting user (`version-restore-modal.tsx:76`).
- **M10 — N+1 queries.** One `GET_USER_BY_ID` per version row and per preview, one `GET_AGENTS_BY_IDS` per preview/card (`version-history-panel.tsx:172-175`; `prompt-preview.tsx:57-71`).
- **M11 — ThumbsUp icon for "favorite"** fights convention (spec says star), and two different yellows are used for the same state (`yellow-500` in `prompt-card.tsx:168`, amber in `prompt-preview.tsx:215`).
- **M12 — Version history shows the oldest versions and mislabels "latest".** The collapsed panel slices the first 3 entries of an array that is appended chronologically oldest→newest (`version-history-panel.tsx:45`; append at `prompt-editor-modal.tsx:215-218`, restore appends too, `version-restore-modal.tsx:80`), so the "recent versions" view surfaces the 3 **oldest** entries, and `isLatest={index === 0}` (`version-history-panel.tsx:121`) marks the oldest one as latest. Any redesign that carries the "Show 3 / Show all" behavior forward must explicitly sort newest-first or it reproduces the bug (see ladder item 40).

**Low**

- **L1 —** Stray `console.log(data)` on a server route logs prompt content (`[id]/page.tsx:12`); dev console easter egg (`page.tsx:60-71`).
- **L2 —** Dead code & orphans (item 67); local `cn()` re-implementation without tailwind-merge (`prompt-preview.tsx:401-403`).
- **L3 —** Spec's max-5-tags not enforced (`prompt-editor-modal.tsx:361-372`).
- **L4 —** Emoji toasts (👍 📋 🔗 ✅) against the professional voice (`prompt-preview.tsx:107,127,140,160`).
- **L5 —** Mixed button variants in the toolbar (Sort = `secondary`, Agents = `outline`) (`prompt-filters.tsx:66,88`).
- **L6 —** "Folders" vs "tags" naming drift between editor, chips row, spec, and data model.

### Mobile audit (390 px)

- **Stacked double-scroll.** Below `lg` the master-detail stacks: list panel capped at `max-h-[50vh]` with its own inner scroll, preview below at `min-h-[400px]` (`page.tsx:227-229,287`). The auto-selected preview sits below the fold; users scroll inside the list, then scroll the page, then scroll the preview. Disorienting but functional.
- **Header tax.** Hero (`text-4xl` two-line + subtitle + spacing) consumes ~220 px before any content (`page.tsx:131-153`); full-width CTA reads just "New" (M4).
- **Hover-only row actions are unreachable on touch** (`prompt-list-item.tsx:114,127`) — share/delete only work via the preview's buttons, two scrolls away.
- **Diff modal is unusable.** `max-w-6xl` dialog with `splitView={true}` two-column diff at 390 px — columns collapse to slivers / horizontal overflow (`version-diff-modal.tsx:72,213`).
- **Editor modal works but is cramped:** `max-w-3xl max-h-[90vh]` scroll with a fixed-400 px markdown editor (`prompt-editor-modal.tsx:253,312`); popovers (agents, tags) cover most of the viewport.
- **Unbounded tag chip rows** wrap into many lines with large tag sets (`page.tsx:184-208`).
- **No horizontal page scroll** otherwise; variable form (`max-w-md`) and restore modal degrade acceptably.

Verdict: **minor** — core jobs survive on mobile, but the layout fights the user and the diff view breaks.

---

## 2. Jobs to be done

**Primary: P2 Power user.** *#1 job in one sentence: find the team's prompt template, read or tweak it, and trust that the change is tracked.* Ranked by frequency:

1. Find a prompt (search, tags, agent filter) and read its full content — daily.
2. Edit a prompt's content/variables; leave a change note — weekly.
3. Create a new prompt (name + content is the 80% case) — weekly.
4. Organize: tags, assign to agents so it surfaces in chat — weekly.
5. Share: set visibility/RBAC for users/roles/teams — monthly.
6. Audit & recover: view history, compare versions, restore — rare but high-stakes.

**Secondary: P1 End user.** Finds a prompt and uses it: "Use" → fill variables → copy (their heavier path is the chat selector, item 64, which is not this page). Favorites the good ones — and needs to *re-find* those favorites later, which requires a favorites-only filter (spec-mandated; added in §3, "Spec deltas"). Frequency: weekly, read-only. Their L1 needs: search, read, Use, favorite — nothing else.

**P3 Admin.** Occasional governance pass: "who can see/edit this prompt?" Needs visibility metadata legible at L2 and trustworthy (fix H4/H8). Not a primary owner.

**P4 Developer.** Marginal: copy a prompt's deep link or content. Served by the copy affordances.

**Ownership matrix check:** `personas.md` lists `/prompts` as **P2 primary, P1 secondary (use)** — confirmed correct by the code: curation features (versioning, RBAC, agent assignment) dominate, and the nav item is visible to everyone for the P1 "use" path. No correction needed.

**Mobile job (P2, per personas.md):** monitor/triage — look up a prompt, read it, make a *small* edit, copy it. Full authoring and diffing may stay desktop-optimized but must not break.

---

## 3. Design concept

### Default view (L1)

A calm ListDetail library. On arrival, P2 sees:

- **PageHeader** (shared primitive): title "Prompts" (`text-2xl font-semibold`), purpose line "Reusable prompt templates with variables — shared with your team and surfaced in chat." (`text-sm text-muted-foreground`), and the page's primary action on the right: **"New prompt"** (Button `default`, the only standalone purple element in the header region). No hero, no entrance animation.
- **Toolbar** (shared primitive) directly under the header: search input (`max-w-sm`, placeholder "Search prompts…", or-searches name/description/content server-side — fixes M7), a Sort `Select` (5 existing options, item 11), and a single **"Filters"** outline button with an active-count badge opening a popover containing the tag multi-select, the agent multi-select, and a **"Favorites only" switch** (items 12, 14; the switch is new — see "Spec deltas" below). Active filters render as removable chips in a row under the toolbar (items 13, 14) — only when filters are active, so the default surface stays clean.
- **ListDetail** (shared primitive) fills the remaining height:
  - **List (left, `w-80 xl:w-96`):** one row per prompt — line 1: name (`text-sm font-medium`, truncated) with a small filled star on the right when favorited (muted amber — quiet status); line 2 (`text-xs text-muted-foreground`): relative updated time · visibility icon+word in **muted foreground** with tooltip (no rainbow; fixes M1, and a correct `teams` label fixes half of H4) · "n vars" when applicable · first tag. Counts (favorites/usage) move to the detail (they are curation signals, not scanning signals). Selected row: `bg-muted` + 2 px purple left border — the accent marks the active state, per philosophy §4. No per-row hover buttons (fixes M2/M5-adjacent); row actions live in the detail panel.
  - **List footer:** "x–y of n" + Prev/Next icon buttons wired to `pageInfo` — **restores pagination (fixes H1)**.
  - **Detail (right):** a document, not a dashboard. Top row: prompt name (`text-xl font-semibold`) + description (`text-sm text-muted-foreground`); on the right the detail's primary action **"Use prompt"** (Button `default`; copy or variable-fill flow, item 36 — now also incrementing `usage_count`, fixing M8), an **Edit** outline button (write access), a ghost **star** toggle (favorite, item 26 — fixed semantics, star icon, fixes H2/M11), and a ghost **"⋯"** menu (Copy content, Copy link, Delete). Below: a quiet metadata line (`text-xs text-muted-foreground`): creator · updated x ago · visibility · used n× · n favorites. Then the **content block**: `rounded-lg border bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap`, variables rendered as inline `Badge variant="secondary"` chips via safe React splitting (no innerHTML — fixes H3), with a small ghost **copy** icon button pinned top-right of the block (replaces the invisible click-anywhere, item 35). Then tags (secondary badges) and assigned agents (outline badges with Bot icon, muted). Finally a collapsed **"History — v7 · 6 versions"** section (item 39).

Visible purple at L1: the New-prompt button, the Use-prompt button, the selected-row indicator. Everything else is neutral.

**EmptyState** (shared primitive): ClipboardType icon, "Create your first reusable prompt — use `{{variables}}` for the parts that change.", primary "New prompt" button (items 19). Search/filter empty state keeps "No matches" + a "Clear filters" ghost action.

**Detail null state (item 23a):** when no prompt is selected — after deleting the selected one (item 23 clears the selection) or when the list is empty/filtered to zero — the desktop detail panel renders a quiet EmptyState variant: muted ClipboardType icon, "Select a prompt to preview" (`text-sm text-muted-foreground`), no action button, `bg-muted/20` panel. Auto-select (item 17) makes this rare, but it is reachable and must not be left for the builder to invent. Mobile never shows it: the list-first layout opens detail only on tap.

**Spec deltas (Discovery & Search, `PROMPT_LIBRARY_SPEC.md`):** the spec's filter panel also mandates a **"Show only favorites" toggle** and a **Creator dropdown**, neither of which exists in the current code. The favorites toggle is **added** in this redesign (Filters popover, L2): it directly serves P1's "favorites the good ones" job — without it there is no way to re-find one's own favorites, since "Most Favorited" sorts by the *global* count, not personal favorites. It filters against the user's own `prompt_favorites` rows (`useUserPromptFavorites`), which the favorite-toggle fix (H2) already loads on this page. The **Creator filter is deliberately deferred**: creator is legible at L2 in the detail metadata line, the widened search now covers description/content, and a creator dropdown needs a user-listing query this page otherwise doesn't make; if usage evidence demands it later, it slots into the same Filters popover without layout change.

### Disclosure ladder

Every inventory item, mapped. "Detail" = the right panel on `/prompts` and the page body on `/prompts/[id]`.

| # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | Nav item, all roles | L0 | Sidebar "Build" group (per navigation.md) |
| 2 | Route pair (client list / server detail) | L0 | Unchanged routes |
| 3 | Server pagination/filter/sort | L1 | Powers list; invisible machinery |
| 4 | Pagination controls | L1 | List footer Prev/Next + "x–y of n" (restored) |
| 5 | Page title + purpose | L1 | PageHeader (standard, replaces hero) |
| 6 | Create prompt | L1 | PageHeader primary action → editor dialog |
| 7 | Create shortcut | L1 | Re-bound to **N** (single-key, list focused); Cmd+K reserved for command palette |
| 8 | Focus-search shortcut | L1 | **/** focuses search via React ref (no DOM query) |
| 9 | Dev console easter egg | L4 | Kept, dev builds only, lists the new shortcuts |
| 10 | Search | L1 | Toolbar input, scope widened to name/description/content |
| 11 | Sort (5 options) | L1 | Toolbar Select |
| 12 | Agent filter | L2 | Toolbar "Filters" popover, agent multi-select |
| 13 | Selected-agent chips | L2 | Active-filter chip row under Toolbar (appears only when filtering) |
| 14 | Tag filter chips | L2 | Toolbar "Filters" popover, tag multi-select; active tags as chips in the same row |
| 15 | Filter change → page 1 | L1 | Unchanged behavior |
| 16 | Visible count | L1 | List footer ("x–y of n") |
| 17 | Auto-select first + selection sync | L1 | Kept on ≥lg; on mobile nothing auto-opens (list-first) |
| 18 | Loading state | L1 | Skeleton rows mirroring list layout (replaces spinner, philosophy §6) |
| 19 | Empty states | L1 | Shared EmptyState (no-prompts vs no-matches + Clear filters) |
| 20 | Error + retry | L1 | Inline error block in list region, "Try again" outline button |
| 21 | Row metadata | L1 | Slimmed row (name, star, time, visibility, vars, first tag); counts move to detail (L2) |
| 22 | Copy deep link | L2 | Detail "⋯" menu → "Copy link" |
| 23 | Delete from list | L3 | Detail "⋯" menu → "Delete" → shared ConfirmDialog (replaces row hover button + confirm()) |
| 23a | Detail no-selection placeholder | L1 | Quiet EmptyState variant in the detail panel whenever selection is null (post-delete, empty/zero-match list) — see "Detail null state" above; not shown on mobile (list-first Sheet) |
| 24 | Browser chrome bar | — (removed as decoration) | Its one datum — the shareable identity — survives as "Copy link" (22); no capability lost |
| 25 | Share-link button | L2 | Detail "⋯" menu → "Copy link" (one pattern, not three) |
| 26 | Favorite toggle | L1 | Ghost star button in detail action row (bug-fixed via favoriteId lookup) |
| 27 | Edit / Copy content / Delete menu | L2/L3 | Edit = outline button (L2); Copy content = "⋯" menu + content-block copy icon (L2); Delete = "⋯" → ConfirmDialog (L3) |
| 28 | Title + description | L1 | Detail header |
| 29 | Creator + updated time | L2 | Detail metadata line |
| 30 | Favorite/usage counts | L2 | Detail metadata line ("used n× · n favorites"), muted |
| 31 | Variable-count badge | L1 | Row ("n vars") + variables visible as chips in content |
| 32 | Tag badges | L2 | Detail, below content |
| 33 | Assigned agents | L2 | Detail, below content (outline badges, muted) |
| 34 | Content with highlighted variables | L1 | Detail content block, safe React rendering |
| 35 | Copy content | L2 | Explicit copy icon button on the content block + "⋯" menu |
| 36 | "Use prompt" (copy / variable fill) | L1 | Detail primary action; now increments usage_count |
| 37 | Edit button | L2 | Detail action row (write access) → editor dialog |
| 38 | Variable fill form | L2 | Dialog from "Use prompt" (unchanged shared component) |
| 39 | Version history panel | L2 | Collapsed "History" section at detail bottom; expands in place |
| 40 | Show 3 / Show all versions | L2 | Inside expanded History; rows sorted **newest-first** (descending `version`) so the collapsed view shows the 3 most *recent* versions and "latest" derives from the max version number — fixes M12 rather than reproducing it |
| 41 | Version rows (actor, time, Compare, Restore) | L2/L3 | History rows; now also render `change_message` as the row's title line |
| 42 | Diff modal | L3 | Dialog from "Compare" (split ≥md, unified <md) |
| 43 | Restore modal | L3 | Dialog from "Restore" (destructive-adjacent: keeps explicit confirm step); `changed_by` fixed to acting user |
| 44 | Versioning/squash/cap logic | L4 (machinery) | Unchanged logic, extracted to `lib/prompts/build-version-history.ts` |
| 45 | Name + description fields | L3 | Editor dialog, "Essentials" section |
| 46 | Plain ↔ Markdown content editing | L3 | Editor dialog content field with mode toggle |
| 47 | Variable hint + detected badges | L3 | Editor dialog, under content |
| 48 | Invalid-variable validation | L3 | Editor dialog inline error, submit guard |
| 49 | Tags (TagSelector) | L3 | Editor dialog, "Organize" section |
| 50 | Agent assignment | L3 | Editor dialog, "Organize" section |
| 51 | RBAC / visibility | L3 | Editor dialog, "Sharing" collapsible (teams wired correctly, summary covers all 5 modes) |
| 52 | Change message (edit) | L3 | Editor dialog footer area, edit mode only |
| 53 | Submit/cancel/validation/toasts | L3 | Editor dialog footer |
| 54 | defaultTags / defaultAssignedAgents props | L4 (API) | Preserved on the editor component — sole caller today is `PromptBrowserSheet` (item 70) |
| 55 | Server fetch by id | L1 (`/prompts/[id]`) | Unchanged; `console.log` removed |
| 56 | Not-found state | L1 (`/prompts/[id]`) | Kept; uses EmptyState styling + Next `Link` back |
| 57 | Detail-route actions | L1/L2 | Client wrapper provides working Edit + post-delete `router.push("/prompts")` |
| 58 | Write-access rules | L4 (machinery) | `checkPromptWriteAccess` kept; public-write tightened (see risks) |
| 59 | Read-access rules | L4 (machinery) | Unchanged export |
| 60–63 | Variable utilities | L4 (machinery) | Unchanged exports from `lib/prompts` |
| 64 | Chat prompt selector | — (other page) | Untouched; keeps consuming `usePrompts`, `lib/prompts`, `PromptVariableForm` |
| 65 | Usage increment on chat insert | L4 (machinery) | Unchanged; "Use prompt" path added (M8) |
| 66 | Agents-form embedded PromptCard | — (other page) | Untouched until the Agents page doc replaces it; component stays exported |
| 67 | Orphans (grouped view, dead state) | — | `PromptsGroupedView` + dead state/imports deleted as *code*, not capability: the view is unreachable today and its folder-browsing job is served by tag filters (14) |
| 68 | Favorites data model | L4 (machinery) | Kept; toggle fixed to resolve `favoriteId` via `useUserPromptFavorites` before delete |
| 69 | Unique-tags query | L4 (machinery) | Kept; feeds filter popover + TagSelector |
| 70 | Agents-page PromptBrowserSheet | — (other page) | Untouched as a surface; keeps consuming `usePrompts`/`useUniquePromptTags`/`useUpdatePrompt` and embedding `PromptEditorModal` with `defaultTags`/`defaultAssignedAgents`. The reworked editor dialog renders inside it — its create-prompt and Add/Remove assignment flows are in this page's QA scope (see Dependencies) |

No item is dropped; items 24 and 67 relocate their *jobs* (deep-link identity → Copy link; folder browsing → tag filter) rather than their pixels.

### Layout & components

Composition for `/prompts` (desktop ≥lg):

```
PageShell (full-bleed work surface, p-6 lg:p-8)
├─ PageHeader  title="Prompts"  action=<Button>New prompt</Button>
├─ Toolbar
│   ├─ Input (search, max-w-sm, ref-focused via "/")
│   ├─ Select (sort, w-44)
│   └─ Popover "Filters" (outline Button + Badge count)
│        ├─ Command multi-select: Tags (from GET_UNIQUE_PROMPT_TAGS)
│        └─ Command multi-select: Agents (GET_AGENTS)
│   └─ [chip row: active tag/agent filters, Badge secondary + X]   ← only when active
└─ ListDetail (h-[calc(100vh-<shell offset>)], gap-6)
    ├─ List panel (w-80 xl:w-96, border rounded-lg bg-card)
    │   ├─ rows (button, px-3 py-2.5, border-l-2 selected:border-l-primary bg-muted)
    │   └─ footer (border-t, text-xs muted: "1–50 of 134" + ghost icon Prev/Next)
    └─ Detail panel (flex-1 min-w-0, border rounded-lg bg-card, p-6, overflow-auto)
        ├─ header row: name (text-xl font-semibold) + actions
        │   [Use prompt (default)] [Edit (outline)] [☆ (ghost)] [⋯ (ghost → DropdownMenu)]
        ├─ description (text-sm muted) + meta line (text-xs muted)
        ├─ content block (border rounded-lg bg-muted/30 p-4 font-mono text-sm,
        │   variable chips = Badge secondary, CopyButton ghost top-right)
        ├─ tags + assigned agents (Badge secondary / outline, gap-2)
        └─ Collapsible "History · vN · n versions"
            ├─ version rows (change_message title, actor · time, Compare / Restore ghost sm)
            ├─ VersionDiffModal (Dialog max-w-5xl)
            └─ VersionRestoreModal (Dialog max-w-2xl)
```

- **shadcn:** Button (default/outline/ghost per CLAUDE.md decision table), Input, Select, Popover+Command (filters, agent assignment), Badge (secondary = tags/variables, outline = agents/neutral), DropdownMenu (overflow), Dialog (editor, variable form, diff, restore), Collapsible (history, RBAC section), Tooltip (visibility icon, copy buttons), Skeleton (list loading), `sonner` toasts (no emojis).
- **Shared primitives from philosophy §5:** PageShell, PageHeader, Toolbar, ListDetail, EmptyState, ConfirmDialog (delete). **NEW shared primitive proposed: `CopyButton`** — ghost icon button with check-feedback (200 ms) and tooltip, needed here for content/link copy and demanded by P4 patterns across Keys/Token/Explorer pages; not yet in philosophy §5.
- **Spacing/type per CLAUDE.md:** `gap-2` within rows, `p-4` content block, `gap-6` between panels, `p-6` detail padding; `text-2xl` page title, `text-xl` detail title, `text-sm` body, `text-xs` metadata; mono only for prompt content and version numbers.
- **Editor dialog (L3)** keeps `max-w-3xl` but is sectioned for progressive disclosure: *Essentials* (name, content+variables, description) always visible; *Organize* (tags, agents) below; *Sharing* (RBACControl incl. teams) in a Collapsible defaulting closed; change-note only in edit mode. Creating a prompt requires exactly two decisions (name, content) — matching personas.md's "~3 decisions" bias.
- **`/prompts/[id]`** becomes a centered content page (PageShell centered variant, `max-w-3xl`): breadcrumb-style back `Link` ("← Prompts"), then the same detail document with full, *working* actions via a small client wrapper that owns the editor dialog and post-delete redirect.

### Mobile behavior

Per `design/responsive.md` standards, designed for P2's mobile job (look up, read, small edit):

- **< lg (incl. 390 px):** ListDetail collapses to **list-only**; no auto-selection. Tapping a row opens the detail as a **full-screen Sheet** (same detail component; back via sheet close or swipe). Deep links `/prompts/[id]` render the full-page detail as on desktop. All actions are real buttons in the detail — nothing is hover-gated.
- **Toolbar:** search stays full-width on its own line; Sort + Filters collapse into one "Filter & sort" outline button opening a bottom **Sheet** containing sort radio + tag/agent multi-selects; active-filter chips scroll horizontally in a single line (`overflow-x-auto`, no wrap tax).
- **PageHeader:** title + "New prompt" button share one row (button keeps its full label — the `xs:` bug dies with the hero).
- **Detail document:** action row wraps to two lines max ("Use prompt" full-width first, secondary actions in a row beneath); metadata line wraps; content block scrolls vertically only.
- **Diff modal (< md):** `splitView={false}` (unified inline diff) inside a full-screen Dialog; version selects stack vertically. ≥ md keeps the split view.
- **Editor (< md):** full-screen Dialog; markdown editor height `min(400px, 50dvh)`; sections unchanged.
- **Pagination:** same Prev/Next footer, 44 px touch targets.

### Motion

Few and purposeful, per CLAUDE.md timings, all behind `prefers-reduced-motion`:

- Row hover/selection background + left-border: 150 ms `ease-in-out`.
- Detail panel content crossfade on selection change: 200 ms fade (explains "this panel reflects that row"); no slide-in theatrics.
- History / Sharing Collapsible expand: 300 ms height + opacity (origin clarity).
- Favorite star: 200 ms scale pop on toggle (1 → 1.2 → 1) — the page's single delight beat.
- CopyButton icon swap (copy → check): 150 ms; reverts after 2 s.
- Mobile detail Sheet: standard sheet slide, ≤300 ms.
- Removed: hero entrance animations, card `-translate-y` hover lifts, folder icon rotations, pulse effects.

---

## 4. Implementation notes

**Files to change**

- `app/(application)/prompts/page.tsx` — rebuild on PageShell/PageHeader/Toolbar/ListDetail; restore pagination; widen search filter to or(name/description/content); add the "Favorites only" filter (intersecting the user's `useUserPromptFavorites` ids, already loaded for the H2 fix); render the detail null-state placeholder as a quiet EmptyState variant (item 23a); remove hero, dead state, easter egg, unused imports; re-bind shortcuts (N, /) with refs; i18n all strings.
- `app/(application)/prompts/components/prompt-list-item.tsx` — slim row per L1 spec; remove hover buttons; add `teams` rights case; muted visibility rendering.
- `app/(application)/prompts/components/prompt-preview.tsx` → rename `prompt-detail.tsx` — remove browser chrome; safe variable rendering (split on `/(\{\{[a-zA-Z0-9_]+\}\})/`, render Badge — pattern already exists in `prompt-selector-modal.tsx:46-71`, extract to `components/prompt-content.tsx`); new action row; star icon; ConfirmDialog for delete; CopyButton; fix favorite toggle by resolving `favoriteId` from `useUserPromptFavorites`; increment usage on "Use prompt"; drop local `cn()`.
- `app/(application)/prompts/components/prompt-editor-modal.tsx` — section layout; wire `teams` (4th onChange arg, `initialTeams`, include in mutation input, summary case); enforce max-5 tags; extract version-building to `lib/prompts/build-version-history.ts` (keeps squash/cap logic testable, item 44). **Keep the embedding props API intact** (`open`, `onOpenChange`, `defaultTags`, `defaultAssignedAgents`, `onSuccess`, `user`) — `PromptBrowserSheet` (item 70) depends on it — and verify the reworked dialog rendered inside that sheet, since every one of these changes ships into the agents page through it.
- `app/(application)/prompts/components/version-history-panel.tsx` — sort rows newest-first (descending `version`) and derive "latest" from the max version number, fixing the oldest-first `slice(0, 3)` / `isLatest={index === 0}` bug (M12); render `change_message`; batch actor names (single users query) to kill N+1.
- `app/(application)/prompts/components/version-diff-modal.tsx` — responsive `splitView` switch at `md`.
- `app/(application)/prompts/components/version-restore-modal.tsx` — `changed_by` = acting user (needs `user` prop or context).
- `app/(application)/prompts/[id]/page.tsx` — remove `console.log`; add client wrapper (`[id]/detail-client.tsx`) providing working Edit + post-delete redirect; Next `Link` back.
- Delete: `prompts/components/prompts-grouped-view.tsx` (unreachable orphan; folder job served by tag filters). Keep `prompt-card.tsx` exported untouched (agents form depends on it, item 66) until the Agents page doc retires it.
- i18n: new `prompts.*` namespace in `messages/en.json` / `messages/de.json`.

**Shared components needed**

- From philosophy §5 (build once, consume here): **PageShell, PageHeader, Toolbar, ListDetail, EmptyState, ConfirmDialog**.
- **NEW (flagged for philosophy §5): `CopyButton`** — copy-with-check-feedback icon button (also wanted by Keys, Token, Explorer, Models).
- Extracted page-local → shared candidate: `PromptContent` (safe variable-chip renderer) reused by detail, chat selector preview, and future eval views.

**Scope: M.** No schema or query changes required (all fixes are client-side against existing GraphQL ops); one page pair + five components reworked; the editor dialog and version modals are restyled, not rebuilt. The favorites fix and teams wiring are contained bug fixes.

**Dependencies**

- Shared primitives must exist first (shell/nav workstream, `design/navigation.md`); ListDetail's mobile Sheet behavior comes from `design/responsive.md`.
- Keyboard shortcut **N** must not collide with the global command palette's scheme — coordinate with the shell spec (Cmd+K is hereby returned to the palette).
- Chat selector and agents form import `usePrompts`, `lib/prompts/*`, `PromptVariableForm`, `PromptCard` — keep these exports and signatures stable.
- **`PromptBrowserSheet`** (agents edit page, item 70) additionally imports `useUniquePromptTags`, `useUpdatePrompt`, and **`PromptEditorModal` itself**, passing `defaultTags` + `defaultAssignedAgents` — the editor's props API is part of the stability contract. All editor changes in this doc (sectioning, teams RBAC wiring, max-5-tags enforcement, version-history extraction) render inside the agents page through this embed: include the sheet's create-prompt flow and its direct `assigned_agents` Add/Remove write path (`prompt-browser-sheet.tsx:121-153`) in this page's review/QA scope. That write path correctly produces no version-history entry — item 44 versions only content/name/description/tags changes — and must keep working unchanged.

**Risks**

- **Public-write tightening (H8) is a behavior change**, not a pure fix: if any team relies on "everyone edits public prompts", restricting public to read+use will surprise them. Recommend: public → read/use for all, write for creator/admin (matches spec), with a release note; needs product sign-off.
- **Favorite-toggle fix** requires fetching the user's favorite rows (`useUserPromptFavorites`) on the list page; existing duplicate `prompt_favorites` rows from the bug may need a one-off cleanup, else counts stay inflated.
- **Teams RBAC fix** makes previously-dropped selections persist — backend must already honor `RBAC.teams` for prompts (it does for agents); verify before exposing the teams summary.
- Client-side version squashing (item 44) has an inherent lost-update race under concurrent edits; out of scope here, but don't advertise history as tamper-proof until it moves server-side.
- Widening search to or(name/description/content) increases backend load on large libraries; debounce the input (300 ms) as part of the Toolbar primitive.
- **"Favorites only" filtering is client-side** against the user's `prompt_favorites` ids, intersected with server-paginated pages — large libraries can yield sparse pages. The spec's GraphQL sketch already defines a `favorites_only: Boolean` filter input; move the filter server-side if/when the backend exposes it (no schema work is in this doc's scope).
