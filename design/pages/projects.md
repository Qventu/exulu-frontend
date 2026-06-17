# Projects — Review & Design Concept
**Routes:** `/projects`, `/projects/[project]`  **Primary persona:** P1 (End User)  **Secondary:** P2 (Power User)  **Current state:** Functionally complete but structurally confused — a double-sidebar admin layout with a magic `mt-20` offset, hardcoded English, hover-only affordances, an unconfirmed destructive action, and a layout that is unusable below ~600px.

---

## 1. Current state

Projects are ChatGPT-style workspaces: a named container that groups chat sessions, carries
shared custom instructions, and pins knowledge items as shared context for every session
inside it. The area is reachable for **every authenticated user** — the nav entry has no RBAC
gate (`components/custom/main-nav.tsx:139-143`), unlike Workflows/Evals/Feedback right below
it.

**Code surface:**
- `app/(application)/projects/layout.tsx` — wraps both routes with `ProjectNav` sidebar
- `app/(application)/projects/page.tsx` — index placeholder ("Select a Project")
- `app/(application)/projects/[project]/page.tsx` — loads project by id, renders `ProjectDetails`
- `components/project-nav.tsx` — project list sidebar (search, favorites, create)
- `components/project-details.tsx` — detail view (5 internal views) + `ProjectItem`/`SessionItemBadge` (shared with chat)
- `components/create-project-dialog.tsx` — create flow
- Supporting: `components/items-selection-modal.tsx`, `components/agent-selection-dialog.tsx`, `components/rbac.tsx`, `lib/check-chat-session-write-access.ts`, queries in `queries/queries.ts:1976-2081`

### Functionality inventory

This list is the contract. Every numbered item must appear in the disclosure ladder (§3).

**Project list sidebar (`components/project-nav.tsx`)**
1. **List all projects** the user can see — `GET_PROJECTS`, page 1, limit 200, sorted `updatedAt DESC` (`project-nav.tsx:48-62`, `queries/queries.ts:2000-2025`). Shows image-or-initial avatar + truncated name per row; rows link to `/projects/[id]` (`project-nav.tsx:205-217`).
2. **Server-side search** by name (`contains` filter) via the search input (`project-nav.tsx:31, 53-60, 126-135`). While searching, the Favorites section is hidden (`:150`).
3. **Favorites section**: projects in `user.favourite_projects` are fetched via `GET_PROJECTS_BY_IDS` and pinned in a "Favorites" group above "All projects" (`project-nav.tsx:38-45, 150-191`). Favorited projects also still appear in the All list (the "excluding favourites" comment at `:47` is not implemented).
4. **Toggle favorite** per row: star button persists via `UPDATE_USER_FAVOURITE_PROJECTS` (mutates `user.favourite_projects` JSON) with optimistic local user state (`project-nav.tsx:88-114, 177-185, 218-225`). Filled yellow star = favorited (`:183, :224`).
5. **Active project highlight**: row uses `secondary` variant when `pathname.includes(project.id)` (`project-nav.tsx:168, 209`).
6. **Create project** button (Plus icon, `title="Create new project"`) opens `CreateProjectDialog` (`project-nav.tsx:136-144, 231-235`).
7. **Project avatar fallback**: `project.image` thumbnail or green→blue gradient circle with first letter (`project-nav.tsx:70-86`).
8. **Loading skeletons** for both favorites and all-projects lists (`project-nav.tsx:155-160, 197-203`); `previousData` is used to avoid flicker on refetch (`:120-121`).
9. **Refetch on route change** (`project-nav.tsx:64-66`).

**Index page (`app/(application)/projects/page.tsx`)**
10. **Empty/placeholder state** "Select a Project" with instruction to pick from sidebar or create (`page.tsx:5-13`).

**Create dialog (`components/create-project-dialog.tsx`)**
11. **Create form**: Name (required, validated with destructive toast `:49-56`), Description (optional textarea), Custom Instructions (optional textarea) (`create-project-dialog.tsx:127-162`).
12. **Create mutation** `CREATE_PROJECT` with `rights_mode: "private"` default; refetches `GET_PROJECTS` (`:39-44, 61-70`).
13. **Post-create flow**: success toast, form reset, dialog close, navigate to `/projects/[newId]`, refetch list (`:76-95`); error toast on failure (`:96-102`).
14. **Cancel** resets the form and closes (`:108-115`); submit button shows spinner + "Creating…" while pending (`:173-182`).

**Detail page shell (`app/(application)/projects/[project]/page.tsx` + `project-details.tsx:205-264`)**
15. **Load project by id** (`GET_PROJECT_BY_ID`) with full-area skeleton while loading, destructive Alert on query error, and a distinct "Project not found" Alert when the id resolves to nothing (`[project]/page.tsx:16-45`).
16. **Project summary card**: name + description ("No description provided." fallback) (`project-details.tsx:210-219`).
17. **Internal section navigation** — 5 views switched by local state (not URL): Project information / Project files / Project sessions / Access control / Project settings (`project-details.tsx:43, 222-263`).

**Project information view (`project-details.tsx:268-349`)**
18. **Read mode** showing Name, Description, Custom Instructions with "No … provided/set" fallbacks (`:288, :302, :316`).
19. **Edit mode toggle** (pencil "Edit" button) switching the three fields to Input/Textarea (`:281-318, 339-343`).
20. **Save** via `UPDATE_PROJECT` with name-required validation toast, success/error toasts, exits edit mode (`:92-128`); spinner while saving (`:329-336`).
21. **Cancel** restores values from the loaded project and exits edit mode (`:130-139`).

**Project files view (`project-details.tsx:351-415`, `ProjectItem` `:695-801`)**
22. **Add knowledge items** via `ItemsSelectionModal` (trigger button "Select items from knowledge sources to add to the chat.") — selected items are appended to `project_items` as `"<contextId>/<itemId>"` gids and persisted via `UPDATE_PROJECT` (`:363-378`). The modal itself provides:
    a. browse contexts ("folders") in a tree (`items-selection-modal.tsx:243-277`),
    b. per-context item list with search, archived-excluded, sorted `updatedAt DESC`, limit 50 (`:553-705`),
    c. multi-select with running "Selected Items" panel and per-item remove (`:319-363`),
    d. **create a new item inline** ("New Item" dialog with full `ItemFormFields`, incl. processor-aware loading state) that is auto-added to the selection (`:707-843`),
    e. a **Presets tab** (search, preview, validation of stale items) (`:367-525`) — *note: non-functional in this page's usage, see UX review*,
    f. a **"Select all" full-context add** that appends the bare context gid (the button only renders when `onSelectContext` is provided, `items-selection-modal.tsx:198-203, 294`) — *also non-functional here: this page never passes the callback, though chat does (`chat.tsx:1257`); see UX review*.
23. **Stated 15-item limit** in copy: "max 15 items" (`project-details.tsx:357`) — not enforced anywhere in code.
24. **Item cards grid** (2-col): each card shows item name, description (clamped), context name, formatted `updatedAt`, char count (`textlength`) and chunk count when present (`:760-800`); per-item GraphQL fetch by gid (`:700-703`).
25. **Full-context entries**: a gid without an item id renders a "Full context" card with the context name (`:725-742`).
26. **Remove item from project** via hover-revealed X button on each card; persists immediately through `UPDATE_PROJECT` (`:714-723, 394-405`).
27. **Files empty state**: icon + "No items added to the project context yet." (`:385-390`).
28. **Loading skeleton card** while an item resolves; cards for deleted/inaccessible items render `null` (`:744-758`).

**Project sessions view (`project-details.tsx:417-518`)**
29. **List sessions belonging to the project** — `GET_AGENT_SESSIONS` filtered `project eq id`, limit 50, sorted `updatedAt DESC` (`:68-77`); each row links to `/chat/[agent]/[session]` (`:441-443`).
30. **Start new session**: full-width button opens the agent-selection dialog (`:428-431, 671-690`); `AgentSelectionModalContent` lists up to 100 agents with search, avatar (Lottie), model badge, description (`agent-selection-dialog.tsx:37-160`); selecting an agent creates a session via `CREATE_AGENT_SESSION` with `project: <id>` and `rights_mode: "private"`, then navigates into the chat (`:50-88`, `project-details.tsx:680-683`). The dialog's description carries a trust disclosure that must survive the redesign: *"Sessions started in a project are accessible for viewing by project members."* (`project-details.tsx:676`).
31. **Remove session from project** (PackageMinus button + tooltip): sets `session.project = null` via `UPDATE_AGENT_SESSION_PROJECT`, keeping the session (`:447-469`).
32. **Delete session permanently** (Trash button + tooltip) via `REMOVE_AGENT_SESSION_BY_ID` (`:471-493`) — *no confirmation dialog*.
33. **Per-session RBAC write gate**: both session buttons are disabled unless `checkChatSessionWriteAccess(session, user)` passes — creator of private session, public session, explicit `write` rights via users/roles RBAC, or `super_admin` override (`project-details.tsx:435, 450, 474`; `lib/check-chat-session-write-access.ts:4-30`).
34. **Sessions empty state** and a **loading state** (`:501-513`).

**Access control view (`project-details.tsx:520-568`)**
35. **Visibility mode selector** restricted to `private | users | roles` for projects (`allowedModes`, `:531`); modes `teams`/`public` exist in `RBACControl` but are excluded here (`rbac.tsx:39-48`).
36. **Share with users**: search users by email (server-side, first 5 results), add with per-user `read`/`write` rights, remove; ">5 selected" overflow opens a manage-all dialog (`rbac.tsx:234-357, 541-616`).
37. **Share with roles**: checkbox list of roles (non-API), per-role `read`/`write` rights, remove (`rbac.tsx:360-448`).
38. **Save access rights** button persists `rights_mode` + `RBAC.users/roles` via `UPDATE_PROJECT` (`project-details.tsx:546-565`).

**Project settings view — danger zone (`project-details.tsx:570-665`)**
39. **Danger-zone framing**: warning panel explaining permanence (`:573-589`).
40. **Delete project dialog** with two opt-in cascades: "Also delete all context items (N items)" and "Also delete all sessions (N sessions)", with a contextual amber warning summarizing the chosen blast radius (`:591-643`).
41. **Cascade execution** (`handleDeleteProject`, `:145-203`): optionally deletes each `project_item` via dynamic `DELETE_ITEM(context)` plus S3 file cleanup (`files.delete(s3key)`, `util/api`); sessions are either deleted (`REMOVE_AGENT_SESSION_BY_ID`) or detached (`project: null`); finally `DELETE_PROJECT`, success/error toast, redirect to `/projects`. Delete button shows spinner while running (`:648-657`).

**Shared exports consumed elsewhere (must survive any refactor)**
42. `SessionItemBadge` (`project-details.tsx:806-834`) is imported by chat (`app/(application)/chat/[agent]/[session]/chat.tsx:91`) to render session context items — it is the **only** export of this file with an external consumer. `ProjectItem` (`:695-801`) is used solely within `project-details.tsx`, and its `SessionItem` alias (`:803`) has zero consumers anywhere, so the alias may be dropped during the refactor. Chat also loads the parent project of a session for its instructions/items (`chat.tsx:297-301`).

**Feature count: 42.**

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **High** | **Unconfirmed permanent destruction**: "Delete session completely" fires immediately on click, no ConfirmDialog. Violates philosophy rule "anything destructive lives at L3+ with confirmation". Sits 16px from the benign "remove from project" button with near-identical ghost styling. | `project-details.tsx:471-493` |
| 2 | **High** | **Broken layout offset**: detail view hard-codes `mt-20` (80px top margin), a magic constant compensating for the shell instead of using a PageShell. Content starts visually adrift; combined with `p-6` the vertical rhythm matches no other page. | `project-details.tsx:206` |
| 3 | **High** | **Dead Presets tab**: `ItemsSelectionModal` shows a "Presets" tab, but `ProjectDetails` doesn't pass `onApplyPreset`, so `handleApplyPreset` returns early — selecting a preset and clicking "Add Items" silently does nothing. A visible dead-end. (Same for "Select all": `onSelectContext` not passed, so full-context adding is unreachable here even though full-context cards are rendered, item 25.) | `project-details.tsx:363-378`; `items-selection-modal.tsx:159-160, 198-203, 787` |
| 4 | **High** | **Orphaned gids are unremovable**: if a knowledge item referenced in `project_items` is deleted elsewhere, `ProjectItem` returns `null` — the entry is invisible but stays in the array forever (counts against the "15 item" promise, inflates the delete-cascade count, and `DELETE_ITEM` calls on it during cascade can throw). | `project-details.tsx:756-758, 148-166, 615` |
| 5 | **High** | **Not internationalized**: every string in project-nav, project-details, create-project-dialog is hardcoded English ("All projects:", "Danger Zone", …) in an en/de app; only the nav label uses `t('navigation.projects')`. | `project-nav.tsx:193`, `project-details.tsx` throughout; contrast `agent-selection-dialog.tsx:36` |
| 6 | Med | **Double sidebar / everything-page**: global nav + 250px project list + 320px in-page section nav = three navigation columns before content. The 5-view switcher is local state, so sections aren't linkable/refreshable and the browser back button exits the project instead of the section. | `projects/layout.tsx:8-10`, `project-nav.tsx:124`, `project-details.tsx:43, 209-263` |
| 7 | Med | **Misleading copy**: files-view trigger button reads "Select items from knowledge sources to add to **the chat**" on the project page; "(max 15 items)" promises an unenforced limit; "Project settings" section contains only deletion. | `project-details.tsx:364, 357, 570-577` |
| 8 | Med | **Accent misuse**: active section button uses `variant="default"` (filled purple) for a nav state — up to 1 of 5 always-filled purple buttons competing with real primary actions ("Purple confetti" anti-pattern; active nav should be `secondary`). | `project-details.tsx:224-262` |
| 9 | Med | **Stale-data races**: sessions `refetchSessions()` is called synchronously after firing (not awaiting) the mutation, so removed/deleted sessions often still show until a second refresh. Favorite toggling updates only local state, so other tabs/sessions diverge. Save access rights gives no success/error feedback (no toast); its button spinner *does* correctly reflect the in-flight request — `isSaving` is the loading flag of the single shared `UPDATE_PROJECT` mutation hook (`project-details.tsx:65`) that the access save itself fires (`:548`) — but because that flag is shared, an in-flight overview save also animates the access button and vice versa. | `project-details.tsx:65, 453-462, 477-485, 546-565`; `project-nav.tsx:103-110` |
| 10 | Med | **Hover-only remove affordance** on item cards (`opacity-0 group-hover:opacity-100`) — invisible to keyboard users until focused, nonexistent on touch. Icon-only with no aria-label/tooltip (mystery meat). | `project-details.tsx:714-723` |
| 11 | Med | **Pagination ceiling**: list silently caps at 200 projects (`:51`), sessions at 50 (`:71`) — no pagination UI, no "N more" hint; the delete cascade only detaches/deletes the 50 loaded sessions, stranding the rest pointing at a deleted project id. | `project-nav.tsx:51`, `project-details.tsx:71, 169-179` |
| 12 | Low | **Crude truncation**: `TruncatedText` hard-slices names at 10 chars (favorites) / 14 chars (all) instead of CSS `truncate`, wasting space and breaking mid-word. | `project-nav.tsx:173, 214`; `truncated-text.tsx:1-7` |
| 13 | Low | **A11y details**: create button is icon-only with `title` but no `aria-label` and a mismatched 12px icon in a 40px hit target; star buttons have no accessible name or pressed state; gradient avatar (green→blue) is decorative noise per "semantic colors only". | `project-nav.tsx:136-144, 177-185, 81-85` |
| 14 | Low | **Dead/wrong code**: unused Pages-Router import `useRouter from "next/router"` in an App-Router client component; `console.log` left in item-add path and create flow; skeleton on detail load is a `div` without dimensions so it renders ~0-height. | `project-nav.tsx:14`; `project-details.tsx:368`; `create-project-dialog.tsx:72`; `[project]/page.tsx:21-25` |
| 15 | Low | **Inconsistent empty/loading states**: three different ad-hoc empty states (index page prose, files icon+text, sessions icon+small) and a mix of Skeleton/`Loading`/spinner-text patterns — none using a shared EmptyState. | `projects/page.tsx:6-12`, `project-details.tsx:385-390, 501-513` |

### Mobile audit

**Verdict: broken at 390px.** The only responsive variants in the three project components
are dialog-chrome width/footer classes (`sm:max-w-md` at `project-details.tsx:598`,
`sm:justify-start` at `:644`, `sm:max-w-4xl` at `:672`, `sm:max-w-[500px]` at
`create-project-dialog.tsx:119`) plus one no-op (`grid-cols-2 sm:grid-cols-2` at
`project-details.tsx:392`, same value twice). The page layout itself — sidebars, fixed
widths, flex rows — has no responsive handling at all.

- `project-nav.tsx:124`: sidebar is `w-[250px] flex-shrink-0` with no collapse — it permanently consumes 64% of a 390px viewport. `projects/layout.tsx:8-13` renders it unconditionally beside `children`.
- `project-details.tsx:208-209`: detail content is `flex gap-6` (never stacks) with a fixed `w-80` (320px) section nav. 250 + 320 + gaps > 390 ⇒ the actual content column has **negative width**; the page horizontally overflows and the section nav is mostly off-screen (anti-pattern 9).
- `project-details.tsx:206`: `p-6 mt-20` burns 80px of vertical space on a phone before anything renders.
- `project-details.tsx:714-723`: card remove buttons are hover-revealed — **functionality unreachable on touch** (item 26 cannot be performed on a phone at all).
- `items-selection-modal.tsx:224`: the add-items dialog is `sm:max-w-[1200px] h-[700px]` with a three-pane desktop layout — fixed 700px height taller than most phone viewports, panes with fixed `basis-64`/`basis-80` that cannot fit; effectively unusable.
- `project-details.tsx:672`: agent-selection dialog (`sm:max-w-4xl`) degrades to a 1-col grid (`grid-cols-1 md:grid-cols-2`) and is the only acceptable surface on mobile.
- `project-details.tsx:392`: 2-col item-card grid at 390px gives ~160px cards with clamped 3-line content — cramped but readable; should be 1-col.
- Session rows (`:437-495`) keep title + two icon buttons on one line; long titles get `max-w-[80%] truncate` but the two 32px targets crowd the right edge.

---

## 2. Jobs to be done

**PRIMARY: P1 (End User).** *Their #1 job: open one of their projects and continue working in it — i.e. jump into an existing session or start a new one with the project's context already attached.*

**P1 — End User** (jobs ranked by frequency)
1. Open a project and resume/start a chat session in it (daily; maps to personas.md P1 job 4 "organize ongoing work" feeding job 1/2).
2. Find the right project fast (search, favorites).
3. Create a new project for a new stream of work (name it, go).
4. Curate the project's shared files/context items (weekly).
5. Adjust description/custom instructions (rare).
6. Tidy up: remove a stray session, eventually delete a finished project (rare).

**P2 — Power User**
1. Everything P1 does, more often and across more projects.
2. Set up *shared* projects for a team: configure access (users/roles, read vs write), seed context items and custom instructions so end users get a pre-configured workspace (this is the real consumer of items 35-38).
3. Curate knowledge inside the flow — create new knowledge items while attaching them (item 22d), reuse context presets (item 22e, currently broken here).
4. Clean up / decommission projects incl. cascade decisions (items 40-41).

**P3 — Admin**: no distinct jobs on this page today (project RBAC is self-service, super_admin override comes via session write checks; project analytics live in `/analytics`). **P4 — Developer**: none (no IDs/copy/API affordances exposed here — acceptable; the project id is in the URL).

**Ownership matrix check:** personas.md (`/projects` → P1 primary, P2 secondary) is **correct**. The current implementation, however, is built upside-down: L1 is dominated by configuration chrome (section nav, info form, danger zone all one click from arrival) while the actual P1 job — the sessions — is hidden behind the third button of an in-page nav. The redesign's main move is inverting this.

---

## 3. Design concept

**Concept headline: "A project is a place you work, not a record you administer."** The detail
page becomes a workspace whose L1 is the session list plus a prominent "New session" action;
all configuration (info, files, access, deletion) moves into tabs and dialogs behind it. The
project list collapses from a permanent second sidebar into the standard ListDetail pattern.

### Default view (L1)

**`/projects` (index):**
- **PageHeader**: title "Projects" (`text-2xl`), one-liner "Workspaces that group your conversations and shared context.", primary action **"New project"** (default/purple button, the only purple element on screen) — replaces the cryptic icon-plus (inventory 6, fixes UX 13).
- **Toolbar** directly beneath: search input (server-side name search, inventory 2) — no filters needed at this scale; left-aligned, identical placement to other list pages.
- **Project list** (ListDetail's list pane, full width on the index): rows with avatar (image or neutral `bg-muted` initial — replacing the gradient, UX 13), name (CSS `truncate`, fixes UX 12), muted `text-xs` "Updated {relative}" from `updatedAt`, and a star toggle (inventory 3-4). Favorited projects sort into a "Favorites" group above the rest, shown once (fixes the duplicate-listing inconsistency, UX item in inventory 3). Row click → `/projects/[id]`.
- **EmptyState** (shared primitive, replaces inventory 10's prose): FolderOpen icon, "Projects keep related conversations and files together.", primary action "New project".
- If >200 projects: "Load more" affordance on the paginated query (fixes UX 11).

**`/projects/[project]` (detail) — the heart of the redesign:**
- **PageHeader**: avatar + project name as title; description as the one-line purpose (muted, truncated, full text in the Settings tab); primary action **"New session"** (purple). A quiet `ghost` star toggle sits beside the name. Beside it, a **visibility badge** (`outline` Badge, `text-xs`): "Private" when `rights_mode = private`, "Shared" otherwise (tooltip names the mode and user/role count; click jumps to Settings → Access). This lives at L1 deliberately — the page's primary action creates sessions whose visibility to other members depends on this state, and philosophy §8 forbids hiding trust-relevant scope below L2. Right side also holds an overflow "⋯" menu (L3 shortcuts: Edit details, Delete project).
- **Tab bar** (URL-backed, `?tab=` or subroutes — fixes UX 6 linkability): **Sessions** (default) · **Files** · **Settings**. Three tabs, not five: "Project information" + "Access control" + danger zone consolidate into Settings; the summary card disappears into the header.
- **Sessions tab (the L1 surface)**: a clean list of session rows — title (links to chat), agent name, muted relative "Updated …" timestamp — newest first. Top of list: nothing else; the New session action lives in the header. EmptyState: MessageSquare icon, "No sessions yet — start the first conversation in this project.", "New session" button.
- Custom instructions, if set, surface as a single quiet line under the toolbar area ("Instructions active · View") so users *trust* what context their chats inherit (philosophy §8) — click opens the Settings tab.

What the P1 user sees on arrival: project name, what it's for, its conversations, one purple
button. Calm.

### Disclosure ladder

Every inventory item (1-42) mapped. "Index" = `/projects`, "Detail" = `/projects/[project]`.

| # | Capability | Level | Physical location |
|---|------------|-------|-------------------|
| 1 | List all projects | L1 | Index list (ListDetail list pane) |
| 2 | Search projects by name | L1 | Index Toolbar search input |
| 3 | Favorites group pinned on top | L1 | Index list, "Favorites" group header; hidden while searching |
| 4 | Toggle favorite | L2 | Star button on index rows + ghost star in detail PageHeader |
| 5 | Active project highlight | L0/L1 | Index row `bg-secondary` when current; breadcrumb in detail header |
| 6 | Create project entry point | L1 | "New project" button in index PageHeader (also in EmptyState) |
| 7 | Avatar / initial fallback | L1 | Index rows + detail PageHeader (neutral initial, no gradient) |
| 8 | Loading skeletons (list) | L1 | Skeleton rows mirroring the list layout |
| 9 | List freshness on navigation | L1 | Apollo `cache-and-network` on index mount (replaces pathname-refetch hack) |
| 10 | Index empty/placeholder state | L1 | Shared EmptyState on index when zero projects |
| 11 | Create form (name/description/instructions) | L3 | Create dialog: Name + Description visible; Custom instructions inside a collapsed "Advanced" section (P2 ~3-decision rule) |
| 12 | Create mutation w/ private default | L3 | Same dialog; "Private — only you" hint text under footer |
| 13 | Post-create navigate to project | L3→L1 | Automatic redirect to new detail page |
| 14 | Cancel/reset + pending spinner | L3 | Dialog footer |
| 15 | Load by id, error, not-found states | L1 | Detail page: skeleton mirroring header+list; ErrorState with "Back to projects" action |
| 16 | Name + description display | L1 | Detail PageHeader (full description in Settings tab) |
| 17 | Section navigation | L1 | Tab bar (Sessions / Files / Settings), URL-backed |
| 18 | Read project info fields | L2 | Settings tab → "Details" section (read mode) |
| 19 | Edit mode toggle | L3 | Settings tab "Edit" button (also via header ⋯ menu) |
| 20 | Save project info | L3 | Settings tab form footer, toasts preserved |
| 21 | Cancel edit / restore values | L3 | Settings tab form footer |
| 22 | Add knowledge items (modal: 22a browse, 22b search, 22c multi-select, 22d create new item, 22e presets, 22f select-all full context) | L2 trigger, L3 modal | Files tab Toolbar → "Add files" button opens ItemsSelectionModal; 22d/22e/22f live *inside* that modal. **Both dead halves of UX 3 get wired:** pass `onApplyPreset` (appends a preset's validated gids) **and** pass `onSelectContext` (re-enables the per-context "Select all" button, `items-selection-modal.tsx:198-203, 294`, appending the bare context gid) — exactly as chat already wires both (`chat.tsx:1257`). This restores the only add path for full-context entries (row 25). Cap interaction: row 23 |
| 23 | 15-item limit | L2 | Enforced: counter "12 / 15" in Files tab toolbar; "Add files" disabled at limit with tooltip (copy now true). Preset application (22e) is **atomic against the cap**: if the preset's validated gids would push `project_items` past 15, nothing is applied and a toast states how many slots remain; "Select all" (22f) appends one gid and follows the same rule |
| 24 | Item cards (name/desc/context/date/chars/chunks) | L2 | Files tab grid — L1 card shows name + context; metadata (date/chars/chunks) on the card's second row, `text-xs` muted |
| 25 | Full-context entries | L2 | Files tab — distinct card with Database icon + "Entire context" badge; **addable on this page** via the modal's "Select all" (22f, now wired) or a preset containing context-only gids — no longer view/remove-only |
| 26 | Remove item from project | L2 action, L3 confirm-free | Always-visible (not hover-gated) X icon button with tooltip + aria-label on every card; non-destructive to the item itself, so no confirm |
| 27 | Files empty state | L2 | Shared EmptyState in Files tab with "Add files" action |
| 28 | Per-item loading / orphan handling | L2 | Skeleton card while resolving; orphans render a muted "Item no longer exists" card *with a remove button* (fixes UX 4) instead of `null` |
| 29 | Session list (title, link, sort) | L1 | Sessions tab rows; row = title + agent + relative time; paginated "Load more" past 50 (fixes UX 11) |
| 30 | Start new session (agent picker) | L1 trigger, L3 dialog | "New session" in PageHeader → agent-selection dialog (search, avatars, model badge); the DialogDescription **preserves the trust disclosure** "Sessions started in a project are accessible for viewing by project members." (`project-details.tsx:676`, localized) — complementing the L1 visibility badge in the header |
| 31 | Remove session from project | L2 | Row ⋯ DropdownMenu → "Remove from project" (immediate, toast w/ undo) |
| 32 | Delete session permanently | L3 | Row ⋯ DropdownMenu → "Delete session…" (destructive item) → shared **ConfirmDialog** (fixes UX 1) |
| 33 | Session write-access gating | L2 | ⋯ menu items disabled with explanatory tooltip ("You don't have write access to this session") when `checkChatSessionWriteAccess` fails |
| 34 | Sessions empty + loading states | L1 | Shared EmptyState; skeleton rows |
| 35 | Visibility mode (private/users/roles) | L1 indicator, L3 config | Settings tab → "Access" section (RBACControl, same allowedModes); current state always visible as the PageHeader visibility badge ("Private"/"Shared"), which links here |
| 36 | Share with users (search/add/rights/manage-all) | L3 (manage-all dialog L3, not stacked deeper) | Settings → Access; RBACControl unchanged |
| 37 | Share with roles | L3 | Settings → Access; RBACControl unchanged |
| 38 | Save access rights | L3 | Settings → Access footer button, **with success/error toast added** (fixes UX 9) |
| 39 | Danger-zone framing | L3 | Settings tab → "Danger zone" section at bottom, destructive-bordered |
| 40 | Delete project dialog + cascade checkboxes + blast-radius warning | L3 | ConfirmDialog (extended variant) from Danger zone / header ⋯ menu; checkbox copy uses live counts incl. total session count from `pageInfo.itemCount`, not just loaded rows |
| 41 | Cascade execution + redirect | L3 | Same dialog; progress state on confirm button; cascade iterates *all* sessions via pagination (fixes UX 11 stranding) |
| 42 | `SessionItemBadge` export for chat (+ internal `ProjectItem`) | — (code-level) | Extracted to `components/projects/project-item.tsx`; `SessionItemBadge` re-exported so chat's import (`chat.tsx:91`) survives; `ProjectItem` becomes the basis of ItemCard (internal only); the consumer-less `SessionItem` alias is dropped — no UI change here |

Nothing requires descending more than one level mid-flow: the deepest paths are
tab → dialog (one overlay). The ItemsSelectionModal's internal "New Item" dialog (22d) is an
existing modal-on-modal; that is that component's own redesign scope (knowledge page doc) —
flagged here as inherited debt, not reintroduced by this design.

### Layout & components

**Index (`/projects`):**
```
<PageShell variant="content">            // max-w-4xl mx-auto, p-6 md:p-8, space-y-6
  <PageHeader title desc primaryAction/> // text-2xl title; Button default "New project"
  <Toolbar><Input search (pl-8, Search icon)/></Toolbar>
  <section>                              // space-y-1
    GroupLabel "Favorites" (text-xs font-medium text-muted-foreground px-2)
    ProjectRow*  // li > Link: flex items-center gap-4 rounded-md p-3 hover:bg-muted/50
                 // Avatar (size-8 rounded-full) · name (text-sm font-medium truncate)
                 // · "Updated 2d ago" (text-xs text-muted-foreground ml-auto)
                 // · Star ghost icon button (aria-pressed, tooltip)
    GroupLabel "All projects"
    ProjectRow*
  </section>
  <EmptyState/> | <Skeleton rows/>
</PageShell>
<CreateProjectDialog/>                   // shadcn Dialog, sm:max-w-[500px]
```
No Card around the list (whitespace > dividers > boxes). The two-pane sidebar layout and
`app/(application)/projects/layout.tsx` are **deleted**; project switching happens via the
index or the command palette, like every other collection.

**Detail (`/projects/[project]`):**
```
<PageShell variant="content">
  <PageHeader breadcrumb="Projects /" title={name} avatar
              desc={description truncated}
              primaryAction=<Button>New session</Button>
              secondary=[VisibilityBadge outline ("Private"|"Shared" from rights_mode),
                         StarToggle ghost, DropdownMenu "⋯"]/>
  <Tabs value={tab from URL}>            // shadcn Tabs, gap-6 below header
    <TabsList>Sessions · Files (badge "12/15") · Settings</TabsList>
    <TabsContent "sessions">  SessionRow* | EmptyState | Skeletons; "Load more" ghost button
    <TabsContent "files">     mini-Toolbar [counter, "Add files" outline Button] +
                              grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 of ItemCards
    <TabsContent "settings">  space-y-8 sections: Details (form) · Access (RBACControl + Save)
                              · Danger zone (destructive-bordered region + Delete button)
  </Tabs>
</PageShell>
<AgentSelectionDialog/>  <ConfirmDialog/> (session delete & project delete variants)
```
- **SessionRow**: `flex items-center gap-3 p-3 rounded-md border` (single border level, no Card) — MessageSquare icon (muted), title `text-sm font-medium truncate` as Link, agent name `text-xs text-muted-foreground`, time `text-xs` right-aligned, `DropdownMenu` trigger (ghost, `aria-label="Session actions"`). *Data note:* `GET_AGENT_SESSIONS` returns only the agent **id** (`queries/queries.ts:217-261`), not its name — resolve names via a client-side join against `GET_AGENTS` (the same query the agent-selection dialog already runs; one cached fetch per page, no schema change). Fall back to showing nothing (not the raw id) while resolving or if the agent was deleted.
- **ItemCard**: shadcn Card, `p-4`, no nesting; X remove button always visible (`text-muted-foreground hover:text-foreground`), Tooltip + aria-label.
- shadcn inventory: `Tabs`, `DropdownMenu`, `Dialog`, `Tooltip`, `Badge` (counter, "Entire context"), `Skeleton`, `Input`, `Textarea`, `Label`, `Button` (default = New session/Save; outline = Add files/Cancel/Edit; ghost = stars, row menus; destructive = deletes), `Checkbox` (cascade options), `Alert` (error states).
- Shared primitives from philosophy §5 used: **PageShell, PageHeader, Toolbar, ListDetail (index list pane pattern), EmptyState, ConfirmDialog**. ConfirmDialog needs a **`children` slot variant** for the project-delete cascade checkboxes (see §4).
- Spacing per CLAUDE.md: sections `space-y-6`/`gap-6`, in-card `p-4`, page `p-6`→`md:p-8`; type: page title `text-2xl`, tab/section titles `text-lg`, body `text-sm`, metadata `text-xs`.
- All strings through `next-intl` (`projects.*` namespace, en + de) — fixes UX 5.
- Both themes: the only non-token colors currently used (amber warning box `project-details.tsx:631`, yellow star, green/blue gradient) are replaced with semantic tokens (`border-warning/`amber kept but with dark-mode classes as in `SessionItemBadge:821`; star uses `text-yellow-400 dark:text-yellow-500` fill only when active; gradient avatar dropped).

### Mobile behavior

P1's mobile job (personas.md): full chat experience — projects on mobile are a *router into
chat*, so list → open → tap session must be flawless; curation may degrade gracefully.

- **< 640px (sm):**
  - Index: identical single-column list (already mobile-shaped); PageHeader primary action collapses to full-width button under the title; toolbar search full-width. No sidebar exists anymore, so nothing overflows (fixes the 250px+320px catastrophe).
  - Detail: header stacks (avatar+name row, then description, then full-width "New session"); ⋯ menu stays top-right. Tabs render as the standard scrollable underline TabsList (3 short labels fit 390px).
  - Sessions tab: rows lose the agent column into a second `text-xs` line; ⋯ target enlarged to `size-10`. Tapping a row goes straight into chat — the core mobile path is two taps from the index.
  - Files tab: `grid-cols-1`; ItemsSelectionModal becomes a **full-screen Sheet** (`h-dvh inset-0`) with the three panes restructured as sequential steps (context picker → item list → selection summary as a bottom bar with count + confirm); remove buttons always visible (already fixed) so curation works on touch.
  - Settings tab: forms are single-column already; Save buttons full-width; RBACControl's manage-all dialog becomes a Sheet.
  - Session-delete and project-delete ConfirmDialogs use the standard bottom-sheet presentation.
- **640-1024px (md):** Files grid `sm:grid-cols-2`; detail header inline (title left, actions right); ItemsSelectionModal as dialog `max-w-2xl` with collapsible context pane.
- **≥1024px (lg):** layout as specified above; Files `lg:grid-cols-3`; ItemsSelectionModal full three-pane `max-w-5xl`, height `max-h-[85dvh]` instead of fixed 700px.

### Motion

Per CLAUDE.md timings, `ease-in-out`, all gated by `prefers-reduced-motion`:
1. **Tab content crossfade** — 150ms opacity (+4px y on enter) when switching Sessions/Files/Settings; explains "same place, different facet". No slide (tabs aren't spatial).
2. **Row hover** — 150ms `background-color` on project/session rows; star fill toggles with a 200ms scale 0.9→1 spring-less ease (confirms the tap registered, replaces the silent mutation).
3. **List entrance** — skeleton→content swap with 200ms fade per row, stagger 20ms capped at 8 rows (perceived speed, mirrors real layout).
4. **Destructive confirm** — ConfirmDialog uses the shared dialog scale/fade (~200ms); on confirmed delete, the affected session row collapses height+fade 300ms before the list reflows (causality: *that* row left).
5. **"Add files" result** — newly added ItemCards fade/scale-in 200ms so the grid change is attributable to the just-closed modal.

Nothing else animates.

---

## 4. Implementation notes

**Files to change/create**
- `app/(application)/projects/layout.tsx` — **delete** (or reduce to a pass-through); the persistent ProjectNav sidebar goes away.
- `app/(application)/projects/page.tsx` — rebuild as the index list page (PageShell/PageHeader/Toolbar/EmptyState + paginated `GET_PROJECTS`, favorites grouping, star toggle).
- `app/(application)/projects/[project]/page.tsx` — rebuild with PageHeader + URL-backed Tabs; proper skeleton (header + rows) and ErrorState with "Back to projects".
- `components/project-nav.tsx` — **delete** after extracting favorites logic into a small `useFavoriteProjects()` hook (mutation + optimistic update; also fix the dead `next/router` import by deletion).
- `components/project-details.tsx` — split into `components/projects/`: `sessions-tab.tsx`, `files-tab.tsx`, `settings-tab.tsx`, `project-item-card.tsx`. Chat's only import from this file is `SessionItemBadge` (`app/(application)/chat/[agent]/[session]/chat.tsx:91`) — keep it re-exported from `components/project-details.tsx` or update that one import; `ProjectItem` moves with the card (no external consumers); the `SessionItem` alias (`:803`, zero consumers) is dropped.
- `components/create-project-dialog.tsx` — keep; move Custom Instructions behind an "Advanced" collapsible; i18n; remove `console.log`.
- `components/items-selection-modal.tsx` — wire **both** `onApplyPreset` and `onSelectContext` from the Files tab (the two dead halves of UX 3; mirror chat's wiring at `chat.tsx:1257`); responsive Sheet variant; replace fixed `h-[700px]` with `max-h-[85dvh]` (this component is shared with chat/knowledge — coordinate with those page docs).
- Wiring fixes inside the tabs: await mutations before `refetchSessions()`; enforce 15-item cap (incl. the atomic reject of over-cap preset application, ladder row 23); orphaned-gid card with remove; cascade over full session count via pagination loop; success toast on access save; ConfirmDialog on session delete; agent-name resolution for SessionRow via `GET_AGENTS` join (see §3 SessionRow).
- i18n: add `projects.*` keys to `messages/en.json` and `messages/de.json`.

**Shared components needed**
- From philosophy §5 (must exist app-wide): **PageShell, PageHeader, Toolbar, ListDetail, EmptyState, ConfirmDialog** — this page consumes all six; it is a good second adopter after whichever page builds them.
- **NEW primitive flagged for philosophy §5:** `ConfirmDialog` needs a **slot/children extension** (checkbox options + dynamic warning, used by project delete; evals and contexts will want the same for cascade deletes). Propose `ConfirmDialog({ options?: {id,label,count}[], warning? })` rather than a separate component.
- **NEW (proposed, small):** `RelativeTime` (consistent "2d ago" with locale support) and `FavoriteToggle` (star with aria-pressed + animation) — both trivially reusable (chat history, prompts).

**Scope: M.** Two routes, one deleted layout, a component split, no new data model or backend
work; all mutations/queries already exist — with one known gap: `GET_AGENT_SESSIONS`
(`queries/queries.ts:217-261`) returns only the agent id, so SessionRow's agent name comes
from the client-side `GET_AGENTS` join specified in §3 (no schema change required). The modal
responsiveness work on
`items-selection-modal.tsx` is the largest single chunk and is shared with other pages
(can ship as fast-follow if the Sheet variant lands with the knowledge redesign).

**Dependencies**
- Shell/nav redesign (`design/navigation.md`): Projects sits in the **Workspace** group for all personas; removing the in-area sidebar assumes the global nav + command palette handle project switching. If the shell ships later, keep a temporary "Projects" breadcrumb link in the detail PageHeader (already specified).
- Shared primitives must exist (or be built here and promoted).
- Chat page doc: chat imports `SessionItemBadge` (its only import from this file, `chat.tsx:91`) and also reads `project.custom_instructions`/`project_items` (`chat.tsx:297-301`) — field semantics must not change.
- Knowledge page doc: ItemsSelectionModal internals (incl. its modal-on-modal "New Item" flow) are co-owned.

**RBAC summary (unchanged semantics, surfaced better)**
- Nav entry and both routes: all authenticated users (`main-nav.tsx:139-143`).
- Project visibility/edit: backend-enforced via `rights_mode` ∈ {private, users, roles} + `RBAC.users/roles` rights; UI exposes editing at Settings → Access (P2's job; P1 typically leaves projects private).
- Session row actions: gated client-side by `checkChatSessionWriteAccess` (creator / public / explicit write / `super_admin`) — keep, but add disabled-state tooltips.
- Project create: ungated (any user), default `rights_mode: "private"`.

**Risks**
1. **Hidden consumers of removed chrome**: deleting `projects/layout.tsx`/`project-nav.tsx` changes deep-link behavior (`/projects/[id]` no longer shows sibling projects). Mitigated by breadcrumb + command palette; verify no e2e tests target the sidebar.
2. **Cascade correctness**: paginating the delete cascade beyond 50 sessions touches data-loss paths — needs careful testing (and ideally a backend bulk mutation later; the doc keeps the client-side loop for now).
3. **Shared modal regressions**: `items-selection-modal.tsx` changes affect chat and knowledge flows; gate the Sheet variant behind viewport width only, keep desktop DOM identical.
4. **Orphaned-gid cleanup** changes `project_items` contents on user action; confirm backend tolerates removing gids whose items are already gone.
5. **URL-backed tabs** introduce `?tab=` params — confirm the analytics/router middleware doesn't treat them as distinct pages.
