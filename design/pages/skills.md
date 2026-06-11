# Skills — Review & Design Concept
**Routes:** `/skills`, `/skills/[skillId]`  **Primary persona:** P2 Power user  **Secondary:** P4 Developer (script-heavy skills, diffs, IDs)  **Current state:** functionally rich (list + preview + full file editor + versioning + diff), but off-system visually (hero headline, ad-hoc patterns), pagination dead-end at 50 skills, native `confirm()`/`prompt()` for destructive ops, hover-only actions, an RBAC "teams" save path that silently drops data, a create dialog that mislabels users-mode as "All Users" (creating skills shared with nobody), zero i18n, and an editor route that is unusable at 390 px.

Skills are reusable packages (a `SKILL.md` plus arbitrary files/scripts under a versioned S3
folder) that agents load as capabilities. The area has two surfaces:

- **`/skills`** — list + preview panel + create dialog (`app/(application)/skills/page.tsx`,
  `app/(application)/skills/components/skill-list-item.tsx`).
- **`/skills/[skillId]`** — a mini-IDE: file tree, markdown/plain-text editor, version
  snapshots, version history sheet, and a two-version diff viewer
  (`app/(application)/skills/[skillId]/page.tsx` + 4 components).

Data layer: GraphQL CRUD via `hooks/use-skills.tsx` (`GET_SKILLS`, `GET_SKILL_BY_ID`,
`CREATE_SKILL`, `UPDATE_SKILL`, `DELETE_SKILL` — `queries/queries.ts:2937-3059`) plus a REST
surface `skillsApi` for file operations (`util/api.ts:281-385`): init, files, sign,
upload-sign, init-from-upload, file read, delete (key/prefix), saveVersion, rename, diff,
uploadContent.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. References relative to repo root.

**Navigation & data layer**

1. Sidebar nav item "Skills" (Sparkles icon), i18n label `navigation.skills` — shown to **all
   users unconditionally**; unlike Workflows (`role.workflows === "write"`) or Evals there is
   no role gate, and no `skills` permission exists on roles at all
   (`components/custom/main-nav.tsx:133-137`; compare the workflows gate at 145-151 and the
   evals gate at 153-159).
2. `/skills` is a client component with `export const dynamic = "force-dynamic"`
   (`skills/page.tsx:59`).
3. Server-paginated skills query: `page`, `limit` (default 50), `filters`, sort
   `updatedAt DESC` (`hooks/use-skills.tsx:28-42`). The page pins `page=1, limit=50` with no
   pager UI (`skills/page.tsx:65,82`).
4. Live search filtering by `name contains` (debounce-free, refires query)
   (`skills/page.tsx:79-80`).
5. Skill count readout "N skill(s)" above the list (`skills/page.tsx:260-264`).
6. Auto-select of the first skill when the list loads (`skills/page.tsx:88-92`).
7. Selected skill kept in sync with refetched data (`skills/page.tsx:95-100`).
8. Keyboard shortcut Cmd/Ctrl+K opens the Create dialog (`skills/page.tsx:103-112`).
9. Query error state with "Try Again" refetch button (`skills/page.tsx:248-255`).
10. List loading state (spinner + "Loading...") (`skills/page.tsx:266-272`).
11. Empty states: "No skills yet" + New Skill CTA when unfiltered; "No matches found" when a
    search is active (`skills/page.tsx:273-285`).

**List rows (`skills/components/skill-list-item.tsx`)**

12. Click row → select skill into preview panel (`:64-71`).
13. Selected styling: `bg-primary/10` + left border accent (`:68-70`).
14. Name + current-version badge `vN` (mono) (`:77-90`).
15. Rights-mode indicator with icon + color + label: private (red Lock), public (green
    Globe), users (blue Users), roles (purple Shield); unknown modes silently fall back to
    "Public" (`:21-34,119-123`).
16. Version count ("N versions" = history length + 1) (`:127-130`).
17. First tag + "+N" overflow indicator (`:132-140`).
18. Relative "updated X ago" timestamp (`date-fns formatDistanceToNow`) (`:142-144`).
19. Hover-revealed icon button "Open editor" → `/skills/[id]` (`:93-102`).
20. Hover-revealed Delete icon button → native `confirm()` → `DELETE_SKILL` mutation →
    toast → refetch, clearing selection if the deleted skill was selected (`:43-56`;
    `skills/page.tsx:293-296`). Rendered for every user regardless of write access.

**Preview panel (`skills/page.tsx:541-861`, `SkillPreviewPanel`)**

21. Panel header: skill name, `vN` badge, description (line-clamp-2) (`:634-645`).
22. "Open Editor" button → `/skills/[id]` (`:646-649`).
23. SKILL.md preview: fetches `skills/<id>/v<current>/SKILL.md` via `skillsApi.file`, renders
    first 15 lines in mono, expandable "Show N more lines"/"Show less" (`:539,575-594,621-706`).
24. SKILL.md-missing warning (yellow alert: "Open the editor to create SKILL.md…")
    (`:669-678`).
25. SKILL.md loading indicator (`:664-668`).
26. Tags section as outline badges (section hidden when no tags) (`:712-731`).
27. Inline version history: prior versions (label + relative date) plus highlighted current
    version with "current" badge (`:733-770`).
28. Access-control display: rights-mode icon + colored label (`:825-829`; config `:532-537`).
29. Access-control inline editing: "Edit" button gated on `hasWriteAccess`
    (`user.super_admin || skill.created_by === user.id`) (`:568-570,783-793`); renders shared
    `RBACControl` in `modalMode` (visibility select + user search/role pickers,
    `components/rbac.tsx:50+`); Save/Cancel; persists `rights_mode` + `RBAC.users/roles` via
    `UPDATE_SKILL` (`:596-619,830-842`).
30. Stats row: version count and `usage_count` "Uses" (`:845-856`). (`favorite_count` is
    fetched (`queries/queries.ts:2944`) but never displayed anywhere.)

**Create dialog (`skills/page.tsx:333-527`)**

31. Two creation modes via segmented toggle: "Create blank" / "Create from upload"
    (`:354-377`).
32. Upload dropzone: drag-and-drop + click-to-pick; accepts only `.zip` (full skill folder)
    or single `.md`, with validation toast for other types; shows picked file name + size in
    KB; "Choose a different file" reset (`:195-206,380-451`).
33. Name field — required, autofocus, Enter submits (`:453-463`).
34. Description textarea ("What does this skill do? When should an agent use it?")
    (`:465-474`).
35. Tags input, comma-separated, split/trimmed on submit (`:136-139,476-484`).
36. Access select at creation: Private / "All Users" / Public (`:486-498`). "All Users" is
    the label on rights_mode value `users` (`:494`) — the mode that everywhere else means
    *shared with an explicit user list* (`components/rbac.tsx:41` "Shared with Users — Share
    with specific users"; `RIGHTS_MODE_CONFIG`, `skills/page.tsx:535`). The dialog has no
    user/role picker and `handleCreate` never passes `$RBAC` (`:141-148`, though
    `CREATE_SKILL` accepts one — `queries/queries.ts:3005`). No Roles option here either,
    although the data model and preview editor support it. See H9.
37. Blank-create flow: `skillsCreateOne` → `skillsApi.init` seeds a templated SKILL.md →
    toast → navigate to the editor (`:141-156,182-187`; `util/api.ts:283-284`).
38. Upload-create flow: `uploadSign` presigned PUT to staging → S3 upload → `initFromUpload`
    extracts into `v1`; documented failure mode: the empty skill row survives a failed
    extract so the user can retry from the editor (`:159-180`; `util/api.ts:308-324`).
39. Validation + busy states: submit disabled without name (or without file in upload mode);
    "Creating…"/"Uploading…" spinner labels (`:124-132,505-524`).
40. Cancel + full form reset whenever the dialog closes (`:114-122,336-339,502-504`).

**Editor route (`skills/[skillId]/page.tsx`)**

41. Skill fetch by id with loading spinner and a "Skill not found" + Back fallback
    (`:214-232`).
42. Top bar: file-sidebar collapse/expand toggle (PanelLeftClose/Open + tooltip), placement
    mirroring the app shell's SidebarTrigger (`:241-255`).
43. Back button → `/skills` (tooltip) (`:259-271`).
44. Identity: Sparkles icon + skill name + `vN` badge (`:275-281`).
45. Refresh-files icon button with spinning state while loading (`:284-297`).
46. "History" button → version-history Sheet (`:299-307,420-433`).
47. "Save Version": native `window.prompt("Version label (optional):")` → cancel aborts →
    `skillsApi.saveVersion` snapshots current → next slot → refetch skill + files, clears
    open file (`:97-114,309-319`).
48. File sidebar header with root-level "New File" and "New Folder" icon buttons (tooltips)
    (`:333-364`).
49. File tree (`[skillId]/components/file-tree.tsx`): recursive folders (root expanded by
    default), expand/collapse chevrons, folder icons (yellow, open/closed variants), file
    icons (`.md` blue, others muted), selection highlight, 12 px-per-level indentation
    (`:44-143`).
50. Context menus — folder: New File / New Folder / Rename / Delete (rename/delete hidden
    for root); file: Rename / Delete; empty tree area: New File / New Folder
    (`file-tree.tsx:80-105,145-158,163-185`).
51. Empty-tree states: sidebar "No files yet" + New File button; in-tree "No files yet.
    Right-click to create." (`[skillId]/page.tsx:383-395`; `file-tree.tsx:168-172`).
52. Sidebar footer: file count + version badge from the files response (`:399-406`).
53. Create file: shared name dialog (`create-item-modal.tsx`) → presigned `sign` + empty
    `uploadContent`, content-type inferred from extension (md/json/plain)
    (`[skillId]/page.tsx:193-201`; `create-item-modal.tsx`).
54. Create folder: writes `<folder>/.gitkeep` (`:202-205`).
55. Rename file: same dialog in `rename` mode → `skillsApi.rename(sourceKey, destPath)`
    (`:124-133,163-169`).
56. Rename folder: client-side recursive flatten → rename of every contained file →
    best-effort old-prefix delete → selection cleared if inside (`:170-190`).
57. Delete file/folder: native `confirm()` ("Delete file X / folder X and all its
    contents?") → key- or prefix-based `deleteFile`, selection cleared (`:135-157`).
58. Editor empty state: "Select a file from the tree to edit"
    (`[skillId]/components/skill-editor.tsx:88-95`).
59. File-content load via presigned read with inline content (`skill-editor.tsx:39-56`).
60. Dirty tracking vs. original content with "Unsaved" badge in the file header
    (`skill-editor.tsx:84,100-110`).
61. Save button (disabled when clean or saving) → presigned `sign` + `uploadContent`, with
    content-type by extension; success toast + `onSaved` tree refresh
    (`skill-editor.tsx:58-82,111-123`).
62. `.md` files open in the shared `MarkdownEditor` (`@uiw/react-md-editor`, theme-aware,
    `preview="edit"`, ResizeObserver-driven height) (`skill-editor.tsx:28-36,131-139`;
    `components/ui/markdown-editor.tsx`).
63. Non-md files open in a plain monospace textarea (`skill-editor.tsx:140-148`).
64. File path shown in mono in the editor header (`skill-editor.tsx:101-104`).
65. Version-history Sheet (`[skillId]/components/version-history-panel.tsx`): current version
    pinned on top (badge + "CURRENT"), older versions with labels + relative timestamps,
    empty state ("Click 'Save Version' to create a snapshot"), and a "Compare" button
    disabled while `current_version < 2` that opens the diff modal (`:22-77`).
66. Diff modal (`[skillId]/components/skill-diff-modal.tsx`): From/To version selects with
    labels (`vN (current)`, `vN — label`); auto-loads `skillsApi.diff`; changed/unchanged
    counts; file list with per-status icons (added green / removed red / modified yellow /
    unchanged muted); auto-selects first changed file; `ReactDiffViewer` — split view +
    word-level diff for modified, unified view for added/removed, theme-aware custom colors;
    explicit states for same-version selection, loading, no files, unchanged file, and no
    file selected (`:48-285,289-320`).
67. Frontend RBAC gates as-built: only the preview panel's access edit is gated
    (`hasWriteAccess`, item 29). Create, delete, file edit, rename, and version operations
    are rendered for everyone and rely on backend enforcement; failures surface as raw error
    toasts (`skills/page.tsx`, `[skillId]/page.tsx` throughout).

**Inventory addendum (second pass — surfaces missed above; same contract applies)**

68. Page-header primary CTA "New Skill" (Plus icon, `size="lg"`, glow-shadow styling) →
    opens the Create dialog (`skills/page.tsx:222-231`). The page's primary action; same
    action as the empty-state CTA (item 11) and the Cmd/Ctrl+K shortcut (item 8).
69. Detail-pane no-selection state at `lg:`+: bordered muted container, Sparkles icon,
    "Select a skill to preview" / "Choose a skill from the list to view its details"
    (`skills/page.tsx:304-329`). Reached whenever `selectedSkill` is null despite
    auto-select (item 6): empty library, zero search matches, or selection cleared by a
    delete (item 20) until refetch lands.
70. Editor file-sidebar loading state: centered spinner in the tree area while
    `filesLoading` (`[skillId]/page.tsx:367-371`) — distinct from the refresh button's
    spinning icon (item 45) and from file-content loading (item 59).

### UX review

**High**

- **H1 — Pagination dead-end.** `page` is a `useState(1)` with no setter ever called and no
  pager UI; with >50 skills, the rest are unreachable except via name search
  (`skills/page.tsx:65,82`; `hooks/use-skills.tsx:28-42` exposes `pageInfo` that the UI
  ignores).
- **H2 — Invalid nested interactive elements.** Each list row is a `<button>` containing two
  shadcn `<Button>`s (`skill-list-item.tsx:64,94,103`) — invalid HTML, broken keyboard
  semantics (Enter/Space ambiguity), screen-reader confusion.
- **H3 — Hover-only actions.** Open/Delete are `opacity-0 group-hover:opacity-100`
  (`skill-list-item.tsx:97,107`) — invisible to touch and keyboard users; the Delete button
  also has no aria-label (mystery-meat + destructive). Anti-patterns 2 and 9.
- **H4 — Native `confirm()`/`prompt()` for destructive and primary flows.** Skill delete
  (`skill-list-item.tsx:45`), file/folder delete (`[skillId]/page.tsx:139`), and the
  *primary* Save Version flow (`window.prompt`, `[skillId]/page.tsx:99`) bypass the design
  system entirely: unthemed, un-i18n-able, and inconsistent with the shared ConfirmDialog
  contract (philosophy §5).
- **H5 — Off-scale hero header.** "Skills␣Library" at `text-4xl sm:text-5xl lg:text-6xl
  font-black` with a purple-accented second line and animated slide-ins
  (`skills/page.tsx:211-231`) violates the typography scale (Display caps at `text-4xl`,
  CLAUDE.md), the PageHeader contract (`text-2xl`, philosophy §5), and "calm surfaces" —
  plus a shadow-heavy oversized CTA (`h-14`, glow shadows) that is pure purple confetti.
- **H6 — Zero i18n.** No `useTranslations` anywhere under `app/(application)/skills/`
  (verified by grep); every label, toast, dialog, and empty state is hardcoded English while
  the platform ships en/de.
- **H7 — RBAC "teams" silently misrepresents access.** The preview's access editor renders
  `RBACControl` without `allowedModes` (`skills/page.tsx:832-841`), so users can pick
  "Teams". The teams data is then dropped on the frontend, not in the mutation:
  `UPDATE_SKILL` forwards a whole `RBACInput` (`$RBAC`, `queries/queries.ts:3030`), but the
  page's `onChange` captures only 3 of `RBACControl`'s 4 callback args (`skills/page.tsx:837-839`;
  signature `components/rbac.tsx:67`) and `handleSaveAccess` builds `RBAC: { users, roles }`
  only (`skills/page.tsx:603-608`) — teams never reach the mutation. Both rights-mode
  renderers then fall back to **"Public"** for unknown modes (`skill-list-item.tsx:31-33`,
  `skills/page.tsx:626-628`). Net effect: a skill saved as "teams" shows as Public with no
  team list — a trust violation (philosophy §8) and potential exposure misread.
- **H8 — Cmd/Ctrl+K hijack.** The globally conventional command-palette chord is bound to
  page-local actions in exactly two places app-wide: here it opens the create dialog
  (`skills/page.tsx:105`), and `/prompts` binds it to *its* quick-create dialog
  (`prompts/page.tsx:43`; prompts' search chord is the separate Cmd/Ctrl+/, line 48). The
  two bindings are at least consistent with each other ("create"), but both squat the chord
  a global command palette needs, and neither is discoverable.
- **H9 — Create dialog's "All Users" label misrepresents sharing (same trust class as H7).**
  The Access select labels rights_mode value `users` as "All Users" (`skills/page.tsx:494`),
  but `users` everywhere else means *shared with an explicit user list* ("Shared with Users —
  Share with specific users", `components/rbac.tsx:41`; `RIGHTS_MODE_CONFIG`,
  `skills/page.tsx:535`). The dialog has no user picker and `handleCreate` never passes
  `$RBAC` (`skills/page.tsx:141-148`, though `CREATE_SKILL` accepts one —
  `queries/queries.ts:3005`), so choosing "All Users" creates a users-mode skill with an
  **empty** `RBAC.users` list — shared with nobody — while the creator is told everyone has
  it. Philosophy §8 violation; resolved at ladder row 36 together with M5.

**Medium**

- **M1 — Editor route has no responsive handling at all.** Fixed `w-60` sidebar, 7 top-bar
  controls in one row, no `sm:`/`md:` variants anywhere (`[skillId]/page.tsx:236-417`). See
  mobile audit.
- **M2 — Brittle layout math.** `h-[calc(100vh-280px)]` hardcodes the header height
  (`skills/page.tsx:257`); any header change silently breaks scrolling.
- **M3 — Non-atomic folder rename.** Folder rename flattens the tree client-side and issues
  N sequential-ish rename calls + a best-effort prefix delete (`[skillId]/page.tsx:170-190`)
  with no progress UI; a mid-flight failure leaves the folder half-renamed.
- **M4 — Search covers name only.** Tags and description are not searchable
  (`skills/page.tsx:79-80`) even though tags are a first-class creation field.
- **M5 — Create-time access options diverge from edit-time.** Creation offers
  private/users/public (`skills/page.tsx:492-496`); editing offers all five RBACControl
  modes. Sharing with Roles requires create → select → edit access.
- **M6 — Spinner walls instead of skeletons.** List load is a spinner row
  (`skills/page.tsx:266-272`), contra "skeletons mirror the real layout" (philosophy §6,
  CLAUDE.md loading patterns).
- **M7 — No write-affordance trimming in the editor.** Read-only users get the full editing
  chrome (Save, rename, delete, Save Version) and only discover the truth via backend error
  toasts (item 67).
- **M8 — Decorative semantic color.** Yellow folder icons and blue `.md` file icons
  (`file-tree.tsx:73-75,129-133`) plus red/green/blue/purple rights icons everywhere
  (`skill-list-item.tsx:21-34`) spend semantic colors on taxonomy, against philosophy §4.
- **M9 — `usage_count` shown without provenance.** "Uses" stat (item 30) has no tooltip or
  link explaining what counts as a use; `favorite_count` is fetched but dead.

**Low**

- **L1 — Sub-scale typography.** Recurrent `text-[10px]` (badges, metadata —
  `skill-list-item.tsx:87,119`; `[skillId]/page.tsx:278,400`) below the documented `text-xs`
  floor.
- **L2 — Duplicate version-history renderings** with different styling: preview panel
  (`skills/page.tsx:733-770`) vs. editor sheet (`version-history-panel.tsx`).
- **L3 — Arbitrary auto-select.** First-skill auto-select (item 6) means the preview shows a
  random-feeling skill before any user intent.
- **L4 — Ambiguous "Save Version" wording.** It snapshots the current state into a new
  version slot, but reads like "save the file".
- **L5 — Title-attr-only tooltip** on the row "Open editor" button (`skill-list-item.tsx:99`)
  instead of the Radix Tooltip used elsewhere.

### Mobile audit (390 px)

**`/skills` — degraded but mostly operable:**
- The hero header stacks (`flex-col sm:flex-row`) but still burns ~200 px of vertical space
  on a `text-4xl` two-line headline (`skills/page.tsx:211-218`).
- List/preview stack via `flex-col lg:flex-row`; list capped at `max-h-[50vh]`
  (`skills/page.tsx:257-259`) — workable, but the `h-[calc(100vh-280px)]` only applies at
  `lg:` so the stacked page just grows; preview is below the fold.
- **Row actions are unreachable**: hover-revealed Open/Delete (H3) never appear on touch;
  the only path to the editor is selecting a row, scrolling down to the preview, and
  tapping "Open Editor".
- Create dialog is `sm:max-w-md` and scrolls fine; the dropzone works with tap.

**`/skills/[skillId]` — broken:**
- Top bar packs 4 icon buttons + title + 2 text buttons with `flex-shrink-0` on the action
  group (`[skillId]/page.tsx:283-320`); at 390 px the title truncates to nothing and
  "History" + "Save Version" overflow or crush the bar. No responsive variants exist.
- File sidebar is a fixed inline `w-60` (240 px) (`:329`), leaving ~150 px for the editor —
  both halves unusable; the only escape is knowing the collapse toggle.
- The `@uiw/react-md-editor` toolbar wraps/overflows at ~150-330 px widths; the plain
  textarea is salvageable but cramped.
- File operations depend on right-click context menus (`file-tree.tsx`) — long-press works
  in Radix ContextMenu but is undiscoverable; root-level "+" buttons exist (item 48) but
  rename/delete have **no touch path at all** besides long-press.
- Diff modal: `max-w-6xl` with an inline `w-56` file sidebar and **split-view** diff
  (`skill-diff-modal.tsx:116,196-223,264-274`) — at 390 px the two diff columns are ~60 px
  each; unreadable.
- Version history Sheet (`sm:max-w-sm`) is full-width on phones — fine as-is.

Verdict: **broken** (editor route unusable; list route actions unreachable on touch).

---

## 2. Jobs to be done

**P2 — Power user (PRIMARY).** *#1 job in one sentence: open a skill and iterate on its
SKILL.md and supporting files until agents behave, snapshotting a version when it works.*
Ranked by frequency:
1. Edit an existing skill's content/files (daily while iterating) — editor route.
2. Find a skill and check what it currently says/does (SKILL.md preview, version, access).
3. Create a new skill (blank or from an exported bundle) and wire it into an agent
   (cross-page: `agents/edit/[id]` toggles skills per agent,
   `agents/edit/[id]/form.tsx:246-247,1498-1505`).
4. Snapshot a version with a label; occasionally compare versions to see what changed.
5. Control who can use a skill (rights mode, users/roles).
6. Glance at adoption (`usage_count`) to decide curation effort.

**P4 — Developer (secondary).**
1. Author script-heavy skills (non-md files, folder structures) — the textarea editor and
   file tree are theirs.
2. Inspect diffs between versions when debugging agent regressions.
3. Grab the skill `id` for programmatic reference (currently **no copy-ID affordance
   anywhere** — the id only appears in the URL; the redesign adds one, which is additive).

**P3 — Admin (incidental).** Reviews/corrects access on shared skills (item 29) — rare,
served at L2/L3.

**P1 — End user: should not be here.** Skills are a Build-area surface.

**Ownership matrix check:** the provisional matrix (`design/personas.md` — `/skills`:
primary P2, secondary P4) is **correct**; no correction needed. However, the *current
implementation* contradicts the matrix's intent: the nav item is visible to every user with
no role gate (item 1), while personas.md says P1 "should never see" Build-area tooling. The
redesign should gate the nav item with the same write-ish heuristic used for siblings (e.g.
`user.super_admin || role.agents === "write"` until a dedicated `skills` permission exists) —
that is an RBAC-visibility fix, not a feature removal: backend access rules are unchanged.

---

## 3. Design concept

### Default view (L1)

`/skills` becomes a standard ListDetail page on the shared bones. On arrival P2 sees:

- **PageHeader** (one per page, philosophy §5): title "Skills" (`text-2xl`, not a hero),
  one-line purpose ("Reusable skill packages your agents can load."), and the page's single
  purple element — the **New Skill** button (item 68; default variant, `size="default"`) on
  the right.
- **Toolbar** directly under the header: a search input (now matching name *or* tags,
  resolving M4) on the left; result count (`text-sm text-muted-foreground`) and a pager
  (Previous/Next + "Page x of y", driven by the already-fetched `pageInfo`, resolving H1) on
  the right. The pager renders only when `pageCount > 1` — zero chrome for small libraries.
- **ListDetail**: list pane (left, `w-80 xl:w-96`) + detail panel (right, fills).
  - **List rows** (calm, two lines): name (`text-sm font-medium`) + `vN` mono badge; second
    line `text-xs text-muted-foreground`: access label (neutral icon + text — color reserved
    for `private` only, which earns a muted lock; public/users/roles render monochrome,
    resolving M8) · version count · relative updated time. Tags move to the detail panel
    (decluttering the row). A **kebab menu** (DropdownMenu, visible always at `h-8 w-8`
    ghost) replaces the hover-only icons: "Open editor", and — only when the viewer has
    write access — "Delete…" (resolving H2/H3; the row itself becomes a single `<div
    role="option">` list element with the kebab as the only nested interactive).
  - **Detail panel** = today's preview panel, kept, normalized (see ladder).
- First skill remains auto-selected (item 6), so whenever the list is non-empty the panel
  has content; the list pane is the visual anchor. When the list is empty, `selectedSkill`
  is null and the detail pane renders its own no-selection state (item 69), specified for
  ≥1024 px as follows:
  - **Empty library:** list pane shows the EmptyState below (which carries the New Skill
    CTA); the detail pane shows a *quiet* placeholder — Sparkles icon (`strokeWidth={1}`,
    muted) + "Select a skill to preview" (`text-sm text-muted-foreground`) in a plain
    `border rounded-lg` container, **no CTA** (the list EmptyState already holds the page's
    one purple action; duplicating it is anti-pattern 5).
  - **Zero search matches:** list pane shows the "No matches" EmptyState variant with its
    "Clear search" action; detail pane shows the same quiet placeholder.
  - Below `lg` the detail panel is a selection-triggered Sheet (see Mobile behavior), so no
    blank pane can render there.
- **EmptyState** (shared primitive): Sparkles icon, "Package knowledge and scripts your
  agents can reuse.", primary "New Skill" — replacing the bespoke empty markup (item 11).
- Loading renders a **skeleton** of 6 list rows + a panel skeleton mirroring the real layout
  (resolving M6).

The editor route `/skills/[skillId]` stays a **full-bleed work surface** (PageShell
full-bleed variant): slim top bar, file tree, editor. It is the L2 destination of the
primary job and keeps its current information architecture — the redesign normalizes its
dialogs, gates write affordances, and makes it survive 390 px.

### Disclosure ladder

Every inventory item mapped. "Keep" = same surface, restyled to system.

| # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | Sidebar nav item | L0 | Build group in sidebar; gated `super_admin \|\| role.agents === "write"` (visibility fix; backend unchanged) |
| 2 | force-dynamic client route | — | Unchanged (infrastructure) |
| 3 | Paginated query (50/page) | L1 | Toolbar pager (Prev/Next + page count), shown only when >1 page |
| 4 | Search by name | L1 | Toolbar search; extended to name-or-tags (`_or` filter) |
| 5 | Skill count | L1 | Toolbar right side, `text-sm text-muted-foreground` |
| 6 | Auto-select first skill | L1 | Keep |
| 7 | Selection sync after refetch | L1 | Keep (behavior) |
| 8 | Keyboard shortcut → create | L1 | Rebound to `N` (no modifier, Linear convention) + registered in the global command palette when available; shown in the New Skill tooltip. Cmd/Ctrl+K is released to the app-wide palette (resolves H8; capability relocated, not removed) |
| 9 | Error + retry | L1 | Keep; inline alert above list using shared error pattern |
| 10 | List loading | L1 | Row + panel skeletons mirroring layout |
| 11 | Empty / no-match states | L1 | Shared EmptyState; "No matches" variant keeps a "Clear search" action |
| 12 | Row click selects | L1 | Keep |
| 13 | Selected styling | L1 | Keep (`bg-primary/10`, left accent — the page's active-state purple) |
| 14 | Name + vN badge | L1 | Keep |
| 15 | Rights-mode indicator | L1 | Row second line, monochrome icon+label (private gets muted emphasis); full color/badge detail at L2 in panel |
| 16 | Version count | L1 | Row second line |
| 17 | Tags on row | L2 | Moved to detail panel Tags section (26); row decluttered; tags still searchable from L1 (4) |
| 18 | Updated-ago timestamp | L1 | Row second line |
| 19 | Open editor from row | L2 | Row kebab menu item + double-click row; panel "Open editor" button remains the primary path |
| 20 | Delete skill | L3 | Row kebab "Delete…" → shared **ConfirmDialog** (types skill name in body, destructive button); rendered only with write access |
| 21 | Panel header (name, vN, description) | L2 | Keep |
| 22 | "Open Editor" button | L2 | Keep — panel header right, `outline` variant (purple stays on New Skill) |
| 23 | SKILL.md 15-line preview + expand | L2 | Keep (expand/collapse stays in-panel) |
| 24 | SKILL.md-missing warning | L2 | Keep (warning alert, orange semantic) |
| 25 | SKILL.md loading | L2 | Skeleton block instead of spinner |
| 26 | Tags section | L2 | Keep; absorbs row tags (17) |
| 27 | Panel version history | L2 | Compact: current + last 3 with "View all & compare →" linking into editor History sheet (resolves L2-dup by making the editor sheet canonical) |
| 28 | Access display | L2 | Keep; icon + label + (when users/roles) count summary "3 users · 2 roles" |
| 29 | Access editing (RBACControl) | L3 | Keep in-panel behind "Edit"; `allowedModes={["private","users","roles","public"]}` passed to RBACControl (fixes H7) until backend supports teams for skills |
| 30 | Stats (versions, uses) | L2 | Panel footer line; "Uses" gets an info tooltip defining the metric; `favorite_count` surfaced alongside once backend semantics confirmed (currently fetched-dead) |
| 31 | Blank vs upload create modes | L3 | Keep — segmented control in Create dialog |
| 32 | Upload dropzone (.zip/.md) | L3 | Keep, unchanged behavior |
| 33 | Name field | L3 | Keep (required, autofocus, Enter submits) |
| 34 | Description field | L3 | Keep |
| 35 | Tags field | L3 | Keep |
| 36 | Access at creation | L3 | Plain Select replaced by the shared **RBACControl** (`modalMode`, `allowedModes={["private","users","roles","public"]}` — same config as item 29), so users/roles modes expose their user/role pickers at create time; `rights_mode` + `RBAC.users/roles` flow into `CREATE_SKILL`'s existing `$RBAC` variable (`queries/queries.ts:3005`). Real parity with edit (fixes M5) and retires the "All Users" mislabel (fixes H9). Default Private |
| 37 | Blank-create flow (init SKILL.md) | L3 | Keep |
| 38 | Upload-create flow (stage→extract; retry-safe) | L3 | Keep, incl. documented failure mode |
| 39 | Validation + busy states | L3 | Keep |
| 40 | Cancel/reset on close | L3 | Keep |
| 41 | Skill fetch / not-found fallback | L2 | Keep (editor route) |
| 42 | File-sidebar toggle | L2 | Keep on desktop; on mobile becomes the trigger for the file-tree Sheet |
| 43 | Back to Skills | L2 | Keep (top bar, first position) |
| 44 | Name + version identity | L2 | Keep (top bar center, truncating) |
| 45 | Refresh files | L3 | Desktop: icon button; mobile: overflow menu item |
| 46 | History button → sheet | L2 | Keep; desktop text button, mobile icon-in-overflow |
| 47 | Save Version + label | L2/L3 | Top-bar primary button (the editor's one purple); label prompt becomes shared **InputDialog** ("Save version", optional label field, explains "Snapshots v{n} so you can keep editing as v{n+1}", resolving H4 + L4) |
| 48 | Root New File / New Folder buttons | L2 | Keep in sidebar header (also in mobile Sheet header) |
| 49 | File tree (expand, icons, selection) | L2 | Keep; icons monochrome (folders muted, files muted; selected = primary), resolves M8 |
| 50 | Context-menu file ops | L2/L3 | Keep context menus; **add** a per-node kebab on hover/focus *and* always-visible on touch, opening the same menu (touch path for rename/delete) |
| 51 | Empty-tree states | L2 | Keep, copy mentions both the + buttons and right-click |
| 52 | Sidebar footer (count + version) | L2 | Keep |
| 53 | Create file | L3 | Shared InputDialog (was CreateItemModal) → same presigned flow |
| 54 | Create folder (.gitkeep) | L3 | Keep |
| 55 | Rename file | L3 | InputDialog rename mode |
| 56 | Rename folder (fan-out) | L3 | Keep behavior; busy state on confirm button while N renames run (M3 mitigation) |
| 57 | Delete file/folder | L3 | Shared ConfirmDialog (folder variant warns "and all its contents") |
| 58 | Editor empty state | L2 | Keep |
| 59 | File content load | L2 | Keep; skeleton lines while loading |
| 60 | Dirty tracking + Unsaved badge | L2 | Keep; also warns via ConfirmDialog when switching files/leaving with unsaved changes (additive guard) |
| 61 | Save file | L2 | Keep (+ Cmd/Ctrl+S binding, additive); disabled-when-clean unchanged |
| 62 | Markdown editor for .md | L2 | Keep |
| 63 | Textarea for other files | L2 | Keep |
| 64 | File path in header | L2 | Keep (mono, truncates from the left on small widths) |
| 65 | Version-history sheet | L2 | Keep (canonical history surface); current pinned, labels, timestamps, empty state, Compare gate `current_version < 2` |
| 66 | Diff modal (selectors, statuses, viewer, all states) | L3 | Keep; mobile/<`md` forces unified view + file list as horizontal chip strip (see Mobile) |
| 67 | RBAC gating | all | Write-derived UI trimming: without write access the editor renders read-only (no Save/rename/delete/Save Version; tree menus show "Open" only), list rows hide Delete, panel hides access Edit (existing). Backend enforcement unchanged; read-only degradation per philosophy §7 |
| 68 | New Skill (header CTA) | L1 | PageHeader primary action — the page's single purple element (`Button` default variant, `size="default"`, no glow/translate styling per H5); duplicated by the EmptyState CTA (11) and the `N` shortcut (8) |
| 69 | Detail-pane no-selection state | L1 | Keep at `lg:`+ as a quiet, CTA-free placeholder covering empty-library and zero-match cases (spec in Default view); `<lg` it ceases to exist because the detail panel becomes a selection-triggered Sheet |
| 70 | File-tree loading | L2 | Skeleton of ~6 indented tree rows replacing the centered spinner (consistent with M6); refresh button keeps its spinning icon (45) |
| — | Skill id copyability (P4, additive) | L2 | Panel header overflow: "Copy skill ID"; editor top bar overflow: same |

### Layout & components

**`/skills`**

- `PageShell` (work-surface variant: `p-4 sm:p-6 lg:p-8`, full width).
- `PageHeader`: `text-2xl font-semibold` title, `text-sm text-muted-foreground` purpose
  line, `Button` (default) "New Skill" right-aligned. No animations on entry beyond the
  page-level fade (kills the current slide-in-from-left/right pair).
- `Toolbar`: `Input` with leading Search icon (`h-9`, standard — not the current `h-11
  border-2`); right cluster: count + `Button variant="ghost" size="icon"` pager chevrons.
  Gap `gap-2`, margin `mb-4`.
- `ListDetail`: CSS grid `lg:grid-cols-[20rem_1fr] xl:grid-cols-[24rem_1fr] gap-6`; height
  `flex-1 min-h-0` inside a flex column page (no `calc()` magic — fixes M2). List pane:
  `Card`-free bordered container (`border rounded-lg bg-card`), header strip with count,
  `ScrollArea` body. Rows: `px-3 py-2.5`, `border-l-2` selection accent, `DropdownMenu`
  kebab (`MoreHorizontal` icon, `aria-label="Skill actions"`).
- Detail panel: bordered container; sections separated by `Separator` with `space-y-6
  px-5 py-4`; section headings `text-xs font-semibold uppercase tracking-wide
  text-muted-foreground` (existing pattern, kept). SKILL.md preview block: `rounded-md
  border bg-muted/30`, `pre` at `text-xs font-mono`.
- Create dialog: `Dialog sm:max-w-md` exactly as today, with the segmented mode toggle
  rebuilt on `Tabs` (`TabsList` grid-cols-2) for keyboard/ARIA correctness; fields use
  `Label` + `Input`/`Textarea` per shadcn conventions; the Access field embeds the shared
  `RBACControl` (`modalMode`, same `allowedModes` as item 29) in place of today's mislabeled
  plain Select (ladder row 36, fixing H9/M5) — its pickers are Popover-based with
  `modal` set, so no modal-on-modal; footer `outline` Cancel + default "Create & Open".
- Destructive ops: shared `ConfirmDialog` (philosophy §5) everywhere `confirm()` lives today.
- Badges per CLAUDE.md: version = `secondary` mono; access uses plain icon+text (not badge)
  to keep rows quiet; `destructive` reserved for failures.
- All strings via `useTranslations("skills")`; new `skills.*` namespace in
  `messages/en.json` / `messages/de.json` (~70 keys).

**`/skills/[skillId]`**

- Full-bleed PageShell variant (no padding; own top bar) — same as today structurally.
- Top bar (`h-12 px-3 border-b`): sidebar toggle · back · name + `vN` · spacer · desktop:
  Refresh (ghost icon), History (`outline sm`), Save Version (default `sm`, the page's
  purple) · overflow `DropdownMenu` (Copy skill ID; on mobile also Refresh + History).
- File sidebar: desktop inline `w-60` collapsible (kept); `<md:` replaced by a `Sheet`
  (left side) containing the identical tree + header buttons + footer.
- File tree: keep `ContextMenu`; add per-node trailing kebab (`h-6 w-6`, `opacity-0
  group-hover:opacity-100 focus-visible:opacity-100`, and `opacity-100` under
  `(pointer: coarse)` via a `touch:` style or `md:opacity-0` inversion) opening the same
  `DropdownMenu` items.
- Editor: unchanged composition (`MarkdownEditor` / textarea), header `bg-muted/30` strip
  with mono path + Unsaved `outline` badge + Save button.
- InputDialog (new shared primitive): `Dialog sm:max-w-md`, one `Label` + `Input`, optional
  helper text, Cancel/Confirm — replaces `CreateItemModal` and `window.prompt`, reusable by
  prompts/agents pages.
- Diff modal: `DialogContent` `max-w-6xl` desktop; `<md:` `h-dvh w-screen max-w-none
  rounded-none` (full-screen takeover), From/To selects stacked, file list as a horizontal
  scrolling chip strip above the viewer, `splitView={false}` forced.
- Version sheet: unchanged (`Sheet sm:max-w-sm`).

**Spacing/type compliance:** sections `gap-6`, in-component `gap-2`, page padding `p-4
sm:p-6 lg:p-8`; smallest text `text-xs` (purge `text-[10px]` — fixes L1); mono for paths,
versions, SKILL.md.

### Mobile behavior

P2's mobile job (personas.md): *monitor and triage — check a skill, make a small edit.*

- **< 640 px (`base`):**
  - `/skills`: PageHeader stacks (title + full-width New Skill); Toolbar = search full-width,
    count+pager beneath; ListDetail becomes **list-only** — tapping a row opens the detail
    panel as a bottom `Sheet` (`side="bottom"`, `h-[85dvh]`) with the identical panel
    content; kebab actions always visible. No hover dependencies anywhere.
  - `/skills/[skillId]`: top bar = sidebar-Sheet trigger · back · truncating name ·
    Save Version (icon, `aria-label`) · overflow menu (Refresh, History, Copy ID). File tree
    in a left `Sheet`; selecting a file closes it. Editor full-width; `.md` defaults to
    `preview="edit"` (already) and the MarkdownEditor toolbar is allowed to wrap. Save stays
    in the file header, sticky.
  - Diff modal: full-screen, unified view, chip-strip file picker (above).
  - Version history: full-width Sheet (already works).
- **640–1024 px (`sm`–`lg`):** `/skills` keeps stacked list→panel (panel inline below list,
  as today, but with the fixed-height calc removed); editor shows inline sidebar but
  defaults it to collapsed below `md`.
- **≥ 1024 px (`lg`):** full two-pane ListDetail; editor inline sidebar open by default.
- Read-only degradation (philosophy §7): without write access, mobile editor renders the
  tree + viewer with no mutating controls — clean monitoring surface, nothing broken.

### Motion

Per CLAUDE.md budgets, `ease-in-out`, all behind `prefers-reduced-motion`:

- List-row hover/selection background + border accent: **150 ms**.
- Detail panel content swap on selection: **200 ms** fade (no slide).
- SKILL.md preview expand/collapse: height auto-animate **300 ms**.
- File-sidebar collapse (desktop): **200 ms** width (existing `duration-200` kept).
- Sheets (file tree, history, mobile detail): Radix slide-in **300 ms**.
- Save Version success: version badge in the top bar ticks `v3 → v4` with a single **300 ms**
  crossfade — the one signature moment, explaining causality (snapshot happened).
- Deleted: header slide-in-from-left/right entrance pair, button hover translate/shadow glow
  (`skills/page.tsx:212,222,226`) — decorative, off-budget.

---

## 4. Implementation notes

**Files to change**

- `app/(application)/skills/page.tsx` — rebuild on PageShell/PageHeader/Toolbar/ListDetail;
  pager; name-or-tags filter; keyboard rebind; mobile detail Sheet; skeletons; quiet
  detail-pane no-selection placeholder (item 69); i18n; `allowedModes` on RBACControl in
  *both* the access editor and the create dialog (which swaps its plain Select for
  RBACControl and passes `$RBAC` to `CREATE_SKILL` — row 36); ConfirmDialog for delete;
  copy-ID action.
- `app/(application)/skills/components/skill-list-item.tsx` — un-nest interactives (row =
  single control + kebab DropdownMenu), monochrome access label, write-gated delete, i18n.
- `app/(application)/skills/[skillId]/page.tsx` — responsive top bar + overflow menu, file
  sidebar Sheet `<md`, file-tree loading skeleton (item 70), InputDialog for Save Version +
  create/rename, ConfirmDialog for deletes, write-derived read-only mode, i18n.
- `app/(application)/skills/[skillId]/components/file-tree.tsx` — per-node kebab (touch
  path), monochrome icons, i18n.
- `app/(application)/skills/[skillId]/components/skill-editor.tsx` — Cmd/Ctrl+S, unsaved
  guard on file switch, read-only mode, skeleton load, i18n.
- `app/(application)/skills/[skillId]/components/version-history-panel.tsx` — i18n, minor
  restyle to system tokens.
- `app/(application)/skills/[skillId]/components/skill-diff-modal.tsx` — full-screen +
  unified mode `<md`, chip-strip file list, i18n.
- `app/(application)/skills/[skillId]/components/create-item-modal.tsx` — **superseded** by
  shared InputDialog (delete after migration).
- `components/custom/main-nav.tsx:133-137` — gate Skills nav item
  (`user.super_admin || role.agents === "write"`); pure visibility change.
- `messages/en.json`, `messages/de.json` — new `skills.*` namespace.
- `hooks/use-skills.tsx` — no schema change; list page starts consuming `pageInfo` and a
  `_or` name/tags filter (verify backend `FilterSkill` supports `_or`/`tags contains`; if
  not, a small backend filter addition is a dependency).

**Shared components needed**

- From philosophy §5 (existing contract): **PageShell**, **PageHeader**, **Toolbar**,
  **ListDetail**, **EmptyState**, **ConfirmDialog**.
- **NEW shared primitives to propose for philosophy §5:**
  - **InputDialog** — single-field named-input dialog (create/rename/label flows). Skills
    needs it 4×; prompts/agents/data have identical `window.prompt`/bespoke-modal patterns.
  - **AccessBadge / RightsModeLabel** — one canonical rights_mode renderer (icon + label +
    optional user/role counts). Currently re-implemented divergently in
    `skill-list-item.tsx:21-34`, `skills/page.tsx:532-537`, and the models/prompts/agents
    areas; this is also where the unknown-mode fallback gets fixed once ("unknown" renders
    as "Restricted", never "Public").
  - *(Optional, M-scope)* **FileTreePanel** — if the data/contexts area also grows file
    trees, extract; otherwise keep local.

**Scope: L.** Two routes, seven components, one new shared primitive consumed four ways,
full i18n pass, RBAC trimming, and a real mobile retrofit of an IDE-like surface. No
backend/API changes required except (a) optional `_or` tags filter and (b) eventual
teams-RBAC support for skills if product wants mode parity (explicitly out of scope here —
we *remove the foot-gun* via `allowedModes`, we don't build teams).

**Dependencies**

- Shared primitives (PageShell/PageHeader/Toolbar/ListDetail/EmptyState/ConfirmDialog) must
  exist from the shell/navigation workstream before this page migrates; InputDialog and
  AccessBadge can be born here.
- Nav gating + Build-group placement depends on `design/navigation.md` decisions.
- Cmd/Ctrl+K release assumes the global command palette claims it app-wide; the `N`
  shortcut and palette "New skill" entry should land together (coordinate with `/prompts`,
  which also squats Cmd+K today — `prompts/page.tsx:43`).
- Agent edit page (`agents/edit/[id]/form.tsx:1498-1505`) consumes `GET_SKILLS` for its
  skill toggles — query shape unchanged, but verify after any filter additions.

**Risks**

- **Folder rename fan-out (M3)** stays client-side N-rename; large folders are slow and
  non-atomic. Mitigate with a busy state + post-op tree refresh; a backend bulk-rename is
  the real fix (flagged, not in scope).
- **`@uiw/react-md-editor` on mobile** — toolbar wrapping and focus handling at <400 px need
  device testing; fallback is forcing the plain textarea below `sm` (read/write preserved).
- **Radix ContextMenu long-press vs. the new node kebab** — ensure the two triggers don't
  fight on touch (kebab uses DropdownMenu, separate trigger).
- **RBAC trimming correctness** — `hasWriteAccess` is owner/super_admin only; users granted
  `write` via RBAC.users/roles won't see edit affordances. Frontend should also honor
  `skill.RBAC.users[].rights === "write"` for the current user (and role membership if
  resolvable client-side) — verify what the backend authorizes so UI and server agree.
- **Diff viewer theming** already handles dark mode via custom variables
  (`skill-diff-modal.tsx:289-320`); keep when restyling, it's correct.
