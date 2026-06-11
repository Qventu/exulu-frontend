# Knowledge Contexts (data browser) — Review & Design Concept
**Routes:** `/data/[[...query]]` → `/data` (dashboard), `/data/[ctx]` (items), `/data/[ctx]/[item]`, `/data/[ctx]/archived`, `/data/[ctx]/archived/[item]`, `/data/[ctx]/sources`, `/data/[ctx]/processors`, `/data/[ctx]/embeddings`
**Primary persona:** P2 (Power User — "I build the agents")  **Secondary:** P3 (usage/queue oversight, super-admin dashboard), P4 (ingestion debugging, IDs, chunks)
**Current state:** Functionally the deepest area of the app — items, RAG pipeline, queues, files, RBAC — but presented as a fixed-width three-pane desktop layout with five sibling nav entries per context, an item detail that dumps everything in one column, and zero responsive behavior: powerful, fragmented, and broken on mobile.

---

## 1. Current state

The area is a catch-all route. `app/(application)/data/[[...query]]/layout.tsx:26-49` composes a persistent three-pane shell: context rail (`contexts.tsx`), item list (`data-list.tsx`, hidden on sources/processors/embeddings views, layout.tsx:37), and content (`page.tsx` switching between dashboard, item detail, and the three pipeline views). Contexts themselves are **code/backend-defined** — there is no create-context mutation anywhere in the frontend (only `CREATE_CONTEXT_PRESET`, queries.ts:2857); the UI manages the *content* and *pipeline* of contexts, not their schema.

### Functionality inventory

> The contract: every numbered capability below must exist in the redesign. Section 3's ladder maps each one.

**A. Route structure & shell**
1. Catch-all route resolution: no segment → contexts dashboard; `[ctx]` → active items; `[ctx]/[item]` → item detail; `[ctx]/archived` (+ `/[item]`) → archived items/detail; `[ctx]/sources`, `[ctx]/processors`, `[ctx]/embeddings` → pipeline views (page.tsx:20-77, layout.tsx:12-24).
2. Persistent three-pane layout; item-list pane suppressed on the three pipeline views (layout.tsx:36-44).
3. Server-side context fetch with "Context not found" state + back-to-dashboard button (page.tsx:55-69) and a catch-all error alert (page.tsx:78-86).

**B. Context rail** (`[[...query]]/contexts.tsx`)
4. Lists all contexts (first 20 — hooks/contexts.tsx:6-11) as folder links to `/data/[id]`, names truncated at 170px (contexts.tsx:45).
5. Loading placeholder entry while contexts load (contexts.tsx:98-102).
6. Expanded sub-nav under the active context: **Active data / Archived data / Sources / Processors / Embeddings**, each with active-state highlight (contexts.tsx:111-148).
7. "Back to dashboard" link when inside a context; "Select a context:" hint otherwise (contexts.tsx:85-95).

**C. Contexts dashboard (`/data`)** (`components/contexts-dashboard.tsx`)
8. **Super-admin variant**: "Contexts Dashboard" header with `DateRangeSelector` (max 30 days) (contexts-dashboard.tsx:38-51, 77-98).
9. Time-series chart of `CONTEXT_RETRIEVE` / `CONTEXT_UPSERT` statistics with data-type switcher, unit = count (contexts-dashboard.tsx:101-120).
10. Donut chart of the same statistic grouped by label (contexts-dashboard.tsx:121-130).
11. **Non-admin variant** "Recent Items": one card per context showing its 5 most recently updated items; click navigates to the item (contexts-dashboard.tsx:137-225, 229-356). Note: the per-context query is skipped entirely when the context has no slug (`skip: !context.slug`, contexts-dashboard.tsx:244) — slug-less contexts silently render neither skeleton nor rows.
12. Recent-item rows: name/external_id fallback, 2-line description clamp, relative updated time, chunks-count badge (contexts-dashboard.tsx:314-351).
13. Empty state when no contexts exist (instructional card) (contexts-dashboard.tsx:359-415).
14. Empty state when contexts exist but no items (instructional card + "Go to Knowledge Sources" CTA) (contexts-dashboard.tsx:418-497).
15. Loading skeletons for dashboard and per-context cards (contexts-dashboard.tsx:182-199, 270-288).

**D. Item list** (`components/data-list.tsx`, `components/columns.tsx`)
16. Paginated item list (limit 11, sorted `updatedAt DESC`), scoped to active **or** archived by route (data-list.tsx:105-141).
17. Row = checkbox + name (fallback: text snippet / "Untitled") + created date (columns.tsx:38-58); active row highlighted; click navigates to detail with archived-aware URL (data-list.tsx:233-239, 415-442).
18. Select-all-page checkbox and per-row selection (data-list.tsx:252-260, columns.tsx:8-31).
19. Bulk **archive** selected (active view) with toast (data-list.tsx:360-392).
20. Bulk **unarchive** selected (archived view) with toast (data-list.tsx:295-326).
21. Bulk **delete** selected (archived view; permanent) with toast (data-list.tsx:327-357).
22. "Add new": immediately creates an item named "New item" (`source: "manual"`) and navigates to it; disabled on archived view (data-list.tsx:197-213, 271-289).
23. "Filter items" button with active-filter count → Advanced Search sheet; applied filters persist (`savedFilterState`) and reset page to 1 (data-list.tsx:261-270, 524-564).
24. URL-driven state: `?page=` and `?search=` (name contains) feed the query (data-list.tsx:79-80, 127-137, 215-231).
25. Pagination: first / previous / next + "x of y row(s) selected (total n items)" footer (data-list.tsx:459-520).
26. Error alert, loading skeletons, previous page data shown while loading (data-list.tsx:241-247, 395-405, 173).
    26a. "No results." table row when the current search/filters match nothing (data-list.tsx:444-453) — a *no-matches* state, distinct from #14's context-has-no-items empty state.

**E. Advanced filters — `ItemsFilter`** (`components/items-filter.tsx`; reused by list filtering, bulk processing, bulk generate/delete embeddings)
27. Name contains filter (items-filter.tsx:156-164).
28. External-ID contains filter (items-filter.tsx:166-174).
29. Created-date from/to (datetime-local) (items-filter.tsx:176-192).
30. Updated-date from/to (items-filter.tsx:194-210).
31. Embeddings-updated-date from/to (items-filter.tsx:212-228).
32. Last-processed-date from/to (items-filter.tsx:230-246).
33. Chunks-count min/max (items-filter.tsx:248-264).
34. Batch limit 1–500 bounding how many items a bulk operation touches (items-filter.tsx:268-286).
35. Clear filters (+ `onClear` callback) (items-filter.tsx:288-301).
36. Live preview: first 3 matches + total count badge; click-to-copy name/main-ID/external-ID; open item in new tab; per-card created/updated/embeddings-updated/last-processed/chunks metadata (items-filter.tsx:103-135, 305-401).
37. Confirm CTA + cancel (items-filter.tsx:405-422). Caveat: the CTA echoes the **configured batch limit, not the matched count** — it renders `({limit || totalCount} items)` (items-filter.tsx:420), so with the default limit 10 and 5,000 matches it reads "(10 items)"; the matched total appears only in the preview badge (#36).

**F. Item detail** (`components/data-display.tsx`)
38. View/edit lifecycle: Edit / Save / Cancel toolbar; auto-enters edit mode for a freshly created "New item" (data-display.tsx:316-326, 470-550).
39. Archive (active items) or Unarchive + permanent Delete (archived items) as tooltip'd icon buttons; navigates back to the list after (data-display.tsx:369-469).
40. Core fields: Name (input), Tags (enter-to-add badge chips with remove), Description (textarea, zod 2–10,000 chars), External ID (data-display.tsx:269-314, 607-863).
41. Click-to-copy of any field value in view mode (name, description, external id, custom text/number/boolean fields) with toast (data-display.tsx:617-627, 736-744, 894-905, 931-956).
42. Custom context-defined fields rendered per type — view: `code`/`json` → CodePreview, text family/`markdown` → TextPreview, `number`/`boolean` plain, `enum` badge, `file` → FileDataCard; edit: textarea (rows by type), MarkdownEditor, number input, boolean switch, enum select, file picker (data-display.tsx:867-1232).
43. Expand-to-dialog full-size editors for description, long-text, and markdown fields (MarkdownEditor "live" preview at 500px) (data-display.tsx:763-804, 989-1029, 1068-1109).
44. Calculated fields: collapsible read-only table, including "Last processed at" when the context has a processor (data-display.tsx:1241-1361).
45. **Process** action (visible when `context.processor` exists): runs the processor for this item; tooltip exposes processor name, description, and queue (data-display.tsx:244-267, 563-592).
46. Access Control collapsible — `RBACControl`: `rights_mode` private/users/roles/teams/public with per-user and per-role read/write rights, persisted on Save (data-display.tsx:116-122, 506-511, 1363-1402; components/rbac.tsx:39-67).
47. Embeddings section: full chunks table (index, content with chunk metadata, created/updated timestamps) (data-display.tsx:1405-1462).
48. Generate embeddings for the item: kebab → confirm AlertDialog → `GENERATE_CHUNKS`; job-aware toasts (data-display.tsx:202-220, 1416-1418, 1483-1515).
49. Delete embeddings for the item: kebab → destructive confirm → `DELETE_CHUNKS`; job-aware toasts (data-display.tsx:223-242, 1419-1421, 1517-1551).
50. Full-panel mutation overlay (`LoadingStates` variants: save / process / delete / generate-chunks / delete-chunks) (data-display.tsx:352-358, 1552-1558).
51. States: loading skeletons, error alert, "Item not found.", "No item selected." (data-display.tsx:328-350, 1467-1480).

**G. Sources view (`/data/[ctx]/sources`)** (`components/sources.tsx`)
52. Context header card (name, description) (sources.tsx:196-210).
53. Sources table: name, description, queue badge with tooltip detailing queue, cron schedule, retries, backoff type + delay (sources.tsx:212-324).
54. Manual trigger per source: dialog explains queued vs immediate execution; parameter inputs pre-filled with defaults; execute with loading state and job-count toasts (sources.tsx:83-137, 391-476).
55. Queues collapsible: one `QueueManagement` panel per distinct source queue (sources.tsx:164-173, 326-383).
56. `QueueManagement` (shared with evals): queue health badges, Pause / Resume / Drain with confirm dialogs, jobs tabbed by state, multi-select, bulk retry/delete, per-job retry/delete, pagination (evals/[id]/runs/components/queue-management.tsx:56-247). The retry confirm includes an optional **"Delete the original job(s) after retrying"** checkbox (`deleteOriginalJob`, queue-management.tsx:63, 702-723). Full component spec owned by `design/pages/evals.md`; both capabilities must survive the QueuePanel promotion.
57. Retrying a source job re-opens the trigger dialog bound to that source's params (sources.tsx:345-374).
58. Back icon button (currently routes to nonexistent `/context` — sources.tsx:181-190).
59. Empty states for "No sources found." / "No queues found." (sources.tsx:318-322, 378).

**H. Processors view (`/data/[ctx]/processors`)** (`components/processors.tsx`)
60. Context header card with embedder badge (name + id) (processors.tsx:161-177).
61. Processor table: name, description, queue badge + tooltip (queue, trigger, timeoutInSeconds, generateEmbeddings flag) (processors.tsx:179-280).
62. "Process items" bulk action: kebab → dialog with `ItemsFilter` + preview → `PROCESS_ITEMS` with filters/limit/sort; job-aware toasts (processors.tsx:80-102, 260-267, 371-410).
63. `RecentProcessings` card: 5 items processed in the last 21 days, polled every 10s, linking to item detail (processors.tsx:282; components/custom/recent-processings.tsx:26-172).
64. Queues collapsible: processor metadata grid (trigger, generate-embeddings explanation) + `QueueManagement`; job retry → `PROCESS_ITEM` for the job's item (processors.tsx:284-363).

**I. Embeddings view (`/data/[ctx]/embeddings`)** (`components/embeddings.tsx`)
65. Embedder configuration: for each config key the embedder declares, bind a platform Variable via `VariableSelectionElement`; creates/updates `embedder_settings` with toasts (embeddings.tsx:76-148, 225-275).
66. Embedders table: embedder name, trigger (`configuration.calculateVectors` badge), queue badge (embeddings.tsx:276-355).
67. Bulk generate embeddings: kebab → dialog (`ItemsFilter` + preview + limit) → `GENERATE_CHUNKS`; job-aware toasts (embeddings.tsx:150-170, 330-334, 445-478).
68. Bulk delete embeddings: kebab → dialog (`ItemsFilter` + preview + limit) → `DELETE_CHUNKS`; job-aware toasts (embeddings.tsx:172-192, 335-340, 418-443).
69. `RecentEmbeddings` card: 5 items with embeddings updated in the last 21 days, polled every 10s, linking to items (embeddings.tsx:356; components/custom/recent-embeddings.tsx:24-128).
70. Queues collapsible: `QueueManagement` on the embedder queue; job retry re-triggers `GENERATE_CHUNKS` for the job's item (embeddings.tsx:357-410).

**J. Files: upload & gallery** (`components/uppy-dashboard.tsx`, `hooks/use-uppy.tsx`)
71. "File Gallery" dialog from any file-type field: two panes — previously uploaded files + Uppy upload area (uppy-dashboard.tsx:119-160, 312-429).
72. Gallery search + S3 continuation-token pagination (first/prev/next) (uppy-dashboard.tsx:205-207, 319-324, 366-411).
73. File tiles: extension-based icons/colors, secure image thumbnails via presigned URLs (60s client cache), selection respecting `selectionLimit`, files with disallowed extensions disabled (uppy-dashboard.tsx:212-225, 353-363, 431-535, 537-586).
74. Tile hover actions: download/view via presigned URL, delete file, optional add-to-context (uppy-dashboard.tsx:488-532). ⚠️ Delete is **permanent and unconfirmed** today: the hover icon fires `deleteFile.mutate` and removes the S3 object instantly (uppy-dashboard.tsx:518-531 trigger → 355-360 call → 227-233 mutation) — see UX review.
75. Upload: Uppy Dashboard → S3 presigned upload with auth + session headers and optional Global flag; allowed-file-type restrictions; max 10 files; auto-select on success; failed uploads removed; percent-decoded S3 keys (uppy-dashboard.tsx:250-290, 414-418; use-uppy.tsx:32-52, 54-109).
76. `FileDataCard`: parsed file name (`_EXULU_` key convention), content type, bucket, size in MB, last-modified, View/download button; "No file selected" empty state (uppy-dashboard.tsx:27-117).
77. Confirm returns selected S3 keys to the calling field (uppy-dashboard.tsx:420-428).

**K. Cross-page consumers — public contract, must survive the redesign** (`components/items-selection-modal.tsx`, `components/item-form-fields.tsx`; used by `app/(application)/chat/[agent]/[session]/chat.tsx` and `components/project-details.tsx`)
78. `ItemsSelectionModal` Browse tab: context folder rail, per-context item list (CommandInput search, 50 newest non-archived items), multi-select with check states, selected-items tray with per-item remove (items-selection-modal.tsx:240-364, 553-705).
79. "Select all" hands the entire context to the consumer (`onSelectContext`) (items-selection-modal.tsx:198-203, 786-791).
80. Inline "New Item" dialog using shared `ItemFormFields` (hides `editable === false` fields for new items; processor-aware loading state); created item auto-selected (items-selection-modal.tsx:707-845; item-form-fields.tsx:246-251).
81. Presets tab: searchable saved context presets (name/description/tags), cards with context/item counts and usage count, validation of preset items against live data (valid/invalid breakdown + warning alert), apply preset incrementing `usage_count` (items-selection-modal.tsx:88-186, 367-525).
82. `ItemFormFields`: shared editor for name / tags / description / external-id + custom fields (textarea family, number, boolean switch, file picker with FileDataCard), expand-to-dialog editors (item-form-fields.tsx:37-381).

**L. Access control & gating**
83. The "Knowledge" nav entry is visible to **every** authenticated user — no role gate (components/custom/main-nav.tsx:121-125).
84. The `/data` dashboard variant switches on `user.super_admin` (contexts-dashboard.tsx:35-54). No context-level permission exists in `UserRole` (types/models/user-role.ts:1-13); item visibility is enforced server-side via `rights_mode`/RBAC, with `configuration.defaultRightsMode` per context (types/models/context.ts:20-23).

### UX review

| Sev | Issue | Evidence |
|---|---|---|
| **High** | Fixed-width three-pane layout with zero responsive variants: 250px rail + 300px list before any content; horizontal overflow below ~900px. | contexts.tsx:83 (`w-[250px] shrink-0`), data-list.tsx:250 (`w-[300px]`), layout.tsx:28 (`flex flex-row`, no `sm:`/`md:`) |
| **High** | "Add new" silently persists a junk "New item" record before the user types anything; abandoning it leaves garbage in the context. Meanwhile a proper creation dialog (`NewItemDialog` + `ItemFormFields`) already exists — two competing creation flows (anti-pattern #4). | data-list.tsx:271-289 vs items-selection-modal.tsx:707-845 |
| **High** | Item detail is an undifferentiated column: fields table, calculated fields, RBAC, and a **full, unpaginated chunks table** all stacked; large items create enormous DOM and endless scroll. No L2/L3 layering. | data-display.tsx:556-1462, chunks at 1425-1461 |
| **High** | Pipeline machinery (Sources / Processors / Embeddings) gets equal L1 nav billing with content, splitting one job ("is my ingestion healthy?") across three near-identical screens with duplicated Settings cards, Queues collapsibles, and kebab patterns. | contexts.tsx:111-148; sources.tsx / processors.tsx / embeddings.tsx structure |
| **High** | Broken/stale paths and copy: sources back button routes to nonexistent `/context`; empty state instructs "Click the '+' button to set up a new knowledge source" though no such button exists (contexts are code-defined, no CREATE_CONTEXT mutation). | sources.tsx:184, contexts-dashboard.tsx:396-408 |
| **High** | The everything-page leak: "Knowledge" nav is shown to pure end users (P1) with no RBAC trim, violating "One screen, one owner" — P1 lands on an admin-flavored dashboard they can't act on. | main-nav.tsx:121-125 |
| **High** | File-gallery delete is permanent and **unconfirmed**: a hover-revealed "X" on a tile immediately deletes the S3 object (`deleteFile.mutate` — no AlertDialog, no undo). A gallery file may be referenced by other items, agents, or chat sessions, so the blast radius exceeds the gallery. Violates the ladder rule "anything destructive lives at L3 or deeper with confirmation." | uppy-dashboard.tsx:518-531 (trigger), 355-360 (mutate call), 227-233 (mutation) |
| **Med** | Two toast systems in one area (`useToast` vs `sonner`), inconsistent feedback styling. | data-list.tsx:43, embeddings.tsx:16 vs data-display.tsx:84, sources.tsx:53, processors.tsx:50 |
| **Med** | Zod schema for the item form is defined but never enforced — Save reads raw `data` state directly, bypassing validation entirely. | data-display.tsx:269-290 vs 491-520 |
| **Med** | Typography off-scale and sloppy: dashboard title `text-4xl font-bold` (page titles should be `text-2xl` per PageHeader); duplicated `text-lg` class on the "Fields" heading. | contexts-dashboard.tsx:82, 172; data-display.tsx:559 |
| **Med** | Hard-coded palette colors break theming in live code: queue status/health badges use raw Tailwind palette classes (`bg-blue-100 text-blue-800`, `bg-red-100 text-red-800`, …) — unreadable in dark mode, off design tokens. | queue-management.tsx:264-279, 339-349 |
| **Med** | Non-admin dashboard fires an N+1 query per context and infers "no items" via a 1-second `setTimeout` heuristic — flaky empty state, wasted requests. | contexts-dashboard.tsx:142-165, 238-259 |
| **Med** | Dynamic Tailwind class `grid-cols-${props.showPreview ? '2' : '1'}` cannot be JIT-compiled — the two-column filter+preview layout only works if accidentally safelisted. | items-filter.tsx:151 |
| **Med** | Dead/duplicated scaffolding: unused `usePagination` (pageSize 5 vs query limit 11), unused edit-pencil affordance, unused `nav.tsx`/`search-bar.tsx`/`chart.tsx` (the latter's hard-coded `#2563eb`/`#10b981` gradients, chart.tsx:51-57, are moot once the dead file is deleted per §4), unused chunk mutations in recent-processings, operator-precedence bug in the rail's `key` concat. | data-list.tsx:52-65 vs 122; contexts.tsx:53-56, 82; data/components/{nav,search-bar,chart}.tsx; recent-processings.tsx:60-98 |
| **Med** | Accessibility: click-to-copy lives on plain `div`/`p` elements — no keyboard access, no role, only `cursor-copy`; copy icon appears only on hover. | data-display.tsx:617-627, 894-905; items-filter.tsx:335-341 |
| **Med** | Console noise in production paths (incl. one inside the GraphQL query factory firing on every call). | contexts-dashboard.tsx:145, 247-248, 294; data-display.tsx:127-128; columns.tsx:43; queries.ts:281 |
| **Low** | `ScrollArea` with `h-screen` inside a constrained pane breaks scroll containment; filter sheet fixed `w-[500px]` overflows small viewports; tooltips at `delayDuration={0}` fire instantly everywhere. | data-list.tsx:396, 526; layout.tsx:27 |
| **Low** | Dates hard-coded to `en-US` despite en/de i18n; almost no strings in this area are translated. | items-filter.tsx:51, uppy-dashboard.tsx:87 |
| **Low** | `useContexts` caps at 20 contexts with no pagination or search in the rail. | hooks/contexts.tsx:6-11 |

### Mobile audit (390px)

**Verdict: broken.**

- layout.tsx:28 lays the three panes out `flex flex-row` with no breakpoint variants. The rail is `w-[250px] shrink-0` (contexts.tsx:83) and the list `w-[300px]` (data-list.tsx:250) → 550px consumed before content renders; the whole page horizontally scrolls and the detail pane is effectively unreachable.
- The advanced-search sheet is `w-[500px]` fixed (data-list.tsx:526) — wider than the viewport.
- Bulk-op dialogs are `max-w-6xl max-h-[90vh]` (embeddings.tsx:421, 448; processors.tsx:374) with an interior `grid grid-cols-2` filter+preview (items-filter.tsx:151) that never stacks; the preview column also has a hard `h-[500px]` (items-filter.tsx:318).
- `ItemsSelectionModal` is `sm:max-w-[1200px] h-[700px]` with a 3-column flex (256px rail + list + 320px tray) and no stacking (items-selection-modal.tsx:224, 240-364) — unusable on a phone, which hurts P1/P2 chat flows too.
- Sources/processors/embedders tables have 4 columns with no overflow wrapper (sources.tsx:223-315); queue tables in `QueueManagement` are wider still.
- Hover-only affordances are invisible on touch: file tile actions (`opacity-0 group-hover:opacity-100`, uppy-dashboard.tsx:488-531), selected-item remove (items-selection-modal.tsx:350-357), copy icons (`hidden group-hover:block`, items-filter.tsx:341), rail edit pencil (contexts.tsx:55).
- Critical info inside tooltips only (cron schedule, retries, backoff, processor timeout — sources.tsx:246-291, processors.tsx:205-249) is unreachable without hover.
- The only part that adapts is the admin chart grid (`md:grid-cols-3`, contexts-dashboard.tsx:101) and the uppy gallery grid (`sm:grid-cols-3`, uppy-dashboard.tsx:343).

---

## 2. Jobs to be done

**Primary: P2.** *#1 job in one sentence: open a context and verify/fix its content — find an item, check that it's embedded and correct, edit or add what's missing.*

**P2 (owner)** — ranked by frequency:
1. Browse/search a context's items; confirm embedding/processing status (daily, while iterating on agents).
2. Add or fix content: create an item, edit fields, upload a file, tag, archive bad items (daily/weekly).
3. Run and monitor ingestion: trigger a source, process items, generate embeddings, retry failed jobs (weekly, spikes during setup).
4. Curate access: set `rights_mode` and user/role rights on items (occasional).
5. Configure pipeline plumbing: embedder variable bindings, inspect queue config (rare; setup-time).

**P3 (secondary)** — watch aggregate usage (upserts/retrievals — the super-admin dashboard variant), intervene on stuck queues (pause/drain). Infrequent, audit-flavored.

**P4 (secondary)** — debug programmatic ingestion: copy item/external IDs, inspect chunks and chunk metadata, check job payloads/failures, verify the field schema their integration writes into. Wants copyable IDs and raw views.

**P1** — none. End users consume knowledge through chat citations; they should not see this page.

**Ownership-matrix correction:** `personas.md` lists `/data` as *P2 primary, secondary "—"*. P2 primary is confirmed, but secondary is **not empty**: P3 (super-admin usage dashboard + queue control, contexts-dashboard.tsx:35-54) and P4 (IDs, chunks, job debugging) are real secondary users and the design below serves them at L2+. Additionally, the current implementation contradicts the matrix's RBAC intent: the Knowledge nav item is rendered for every user including P1 (main-nav.tsx:121-125) — the redesign requires it to be RBAC-trimmed out of P1's navigation.

---

## 3. Design concept

Two-level information architecture replacing the three-pane + five-sibling-subnav maze:

- **`/data` — Context library (L1):** pick a context. The dashboard charts stop being the landing page.
- **`/data/[ctx]` — Context workspace (L1 within a context):** two tabs — **Items** (default; the #1 job) and **Pipeline** (sources → processor → embedder, consolidated). Archived is a view switch inside Items, not a nav destination. Item detail is a side panel (ListDetail), not a third pane that always reserves space.

Old URLs keep working as redirects: `/data/[ctx]/sources|processors|embeddings` → `/data/[ctx]?tab=pipeline#<stage>`; `/data/[ctx]/archived[/item]` → `/data/[ctx]?view=archived[&item=…]`; `/data/[ctx]/[item]` → `/data/[ctx]?item=…`.

### Default view (L1)

**`/data` (context library).** PageShell (centered content page) + PageHeader: title "Knowledge" (`text-2xl`), one-liner "Contexts your agents retrieve from." No global primary action (contexts are code-defined — the header instead shows a quiet "Contexts are defined in your backend" hint linking to docs, killing the misleading "+" copy of inventory #13). Below, a Toolbar with a single search input (filters context list client-side). Then one bordered list (not nested cards): each context row shows **name, one-line description, item count, last-ingested relative time, and a single status dot** (muted when healthy, orange/red with a count when its queues have failed jobs). Click → workspace. Super-admins additionally see a slim row of 3 StatCards above the list (Upserts 7d, Retrievals 7d, Items total) — charts live one level deeper (ladder below). EmptyState (shared primitive) when no contexts exist.

**`/data/[ctx]` (workspace, Items tab).** PageHeader: context name, description line, right side = **primary action "New item"** (the only purple button) opening the creation dialog (shared `ItemFormFields` — replacing junk-item creation, inventory #22 → #80's flow). Under it the Toolbar: search input (URL-backed `?search=`), "Filters" button with active-count badge (opens filter panel), an **Active | Archived** segmented control, and the tab switch **Items | Pipeline**. The body is a full-width item table (name, tags, updated, embeddings status as a quiet "n chunks / Not embedded" cell, processed time) with row checkboxes. Selecting rows reveals a contextual action bar (Archive — or Unarchive/Delete in archived view). Clicking a row opens the **item detail side panel** (right, ~480px, ListDetail pattern). Calm: one table, one accent button, status muted until it isn't.

### Disclosure ladder

| # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | Route resolution (all 8 shapes) | L0 | `/data` + `/data/[ctx]` with `?tab/?view/?item` params; old paths 301-redirect |
| 2 | Three-pane shell | L1 | Replaced: library page → workspace page with ListDetail side panel |
| 3 | Context not-found / error states | L1 | Same routes; shared EmptyState + Alert |
| 4 | Context list (all contexts) | L1 | `/data` context rows (no more 20-cap rail; paginated/searchable list) |
| 5 | Contexts loading state | L1 | Skeleton rows mirroring the list |
| 6 | Active/Archived/Sources/Processors/Embeddings nav | L1–L2 | Active/Archived → segmented control in Items toolbar (L1); Sources/Processors/Embeddings → Pipeline tab stages (L2) |
| 7 | Back to dashboard / select hint | L1 | Breadcrumb "Knowledge / {context}" in PageHeader |
| 8 | Super-admin usage header + date range | L2 | "Usage" panel on `/data`: StatCards visible at L1 (admin only), date range inside the expanded Usage view |
| 9 | Time-series upsert/retrieve chart | L2 | Usage panel (ChartCard) on `/data`, admin-only, behind "View usage" on the StatCard row |
| 10 | Donut by label | L2 | Same Usage panel, second ChartCard |
| 11 | Recent items across contexts | L2 | "Recent activity" link per context row → opens workspace Items tab pre-sorted by updated (its default); cross-context recent list folded into each row's "last ingested" meta at L1 |
| 12 | Recent-item metadata (chunks badge etc.) | L1 | Item table columns in workspace (updated, chunks) |
| 13 | Empty state: no contexts | L1 | Shared EmptyState with honest copy ("Contexts are defined in code — see docs"), no phantom "+" |
| 14 | Empty state: no items | L1 | Workspace Items tab EmptyState: icon + "Add your first item" → New item dialog |
| 15 | Dashboard loading skeletons | L1 | Skeletons mirroring StatCards + list rows |
| 16 | Paginated item query (active/archived) | L1 | Items table, server pagination footer |
| 17 | Item row content + navigation | L1 | Table row → opens side panel (`?item=`) |
| 18 | Row selection / select-all | L1 | Table checkboxes (first column) |
| 19 | Bulk archive | L2 | Contextual action bar appearing on selection |
| 20 | Bulk unarchive | L2 | Same bar in Archived view |
| 21 | Bulk delete (permanent) | L3 | Same bar, but routed through shared ConfirmDialog (destructive) |
| 22 | Create item | L1→L2 | "New item" primary button → dialog with `ItemFormFields` (no junk record until Save) |
| 23 | Filter items entry point | L1 | Toolbar "Filters" button with count badge |
| 24 | URL-driven search/page | L1 | Toolbar search bound to `?search=`; pagination to `?page=` |
| 25 | Pagination controls | L1 | Table footer (prev/next/first + counts) |
| 26 | List loading/error/stale-data | L1 | Skeleton rows; inline Alert; keep-previous-data |
| 26a | No-matches state (search/filters active) | L1 | Inline table empty row: "No items match your search/filters" + **Clear filters** action — distinct from #14; never shows "Add your first item" while a search or filter is active |
| 27–33 | Filter fields (name, ext-ID, 4 date ranges, chunks count) | L2 | FilterPanel (right Sheet on desktop, full-screen Sheet on mobile) |
| 34 | Batch limit (1–500) | L3 | Only shown when FilterPanel is invoked from a bulk operation ("Affects at most N items") |
| 35 | Clear filters | L2 | FilterPanel footer + "×" on the toolbar filter badge |
| 36 | Filter live preview + copy IDs | L2/L3 | Preview column in FilterPanel (bulk-op mode); copy buttons always visible, keyboard-focusable |
| 37 | Filter confirm with count | L2 | FilterPanel footer CTA ("Apply · 124 items") — always the number of items the operation will actually touch, i.e. min(limit, matched count), fixing today's limit-vs-count ambiguity (#37 caveat) |
| 38 | Edit/Save/Cancel lifecycle | L2 | Side panel header: "Edit" secondary button → inline edit state with Save (primary)/Cancel; new items open directly in edit |
| 39 | Archive / Unarchive / Delete item | L2/L3 | Panel overflow menu (labeled entries); Delete → ConfirmDialog (L3) |
| 40 | Core fields (name/tags/description/external-id) | L2 | "Fields" section, open by default in panel |
| 41 | Click-to-copy values | L2 | Explicit copy icon-button per row (visible, `aria-label`, keyboard-accessible) — replaces invisible div-click |
| 42 | Custom typed fields (view+edit) | L2 | Same Fields section, type-aware renderers unchanged |
| 43 | Calculated fields | L3 | Collapsed DetailSection "Calculated" with count badge |
| 44 | Expand-to-dialog editors | L3 | Kept: expand icon on long-text/markdown editors opens one full-size Dialog (never dialog-on-dialog: panel is a panel, not a modal) |
| 45 | Process this item | L2 | Panel header overflow menu → "Process item" (visible only when processor exists); queue named in the toast |
| 46 | Item access control (RBAC) | L3 | Collapsed DetailSection "Access" with current mode badge (e.g. "Private") visible at L2 |
| 47 | Chunks table | L2/L3 | Collapsed DetailSection "Embeddings · n chunks" — count + last-updated visible collapsed (L2 trust info); expanded table paginated (10/page) |
| 48 | Generate item embeddings | L3 | Embeddings section header menu → ConfirmDialog |
| 49 | Delete item embeddings | L3 | Same menu → destructive ConfirmDialog |
| 50 | Mutation overlays | L2 | Scoped to panel; LoadingStates variants kept |
| 51 | Detail loading/error/not-found | L2 | Panel skeletons mirroring sections; inline states |
| 52 | Context settings header (sources view) | L1 | Workspace PageHeader (name/description shown once, not per pipeline page) |
| 53 | Sources table + queue config details | L2 | Pipeline tab → "Sources" stage card: per-source row with name, schedule, queue; config details (retries/backoff) in an expandable row, not a tooltip |
| 54 | Manual source trigger + params | L2→L3 | "Run" button per source row → Dialog with param inputs (L3) |
| 55 | Queues per source queue | L3 | "Jobs" expander on the stage card → QueuePanel |
| 56 | Queue management (pause/resume/drain, job tabs, bulk retry/delete) | L3/L4 | QueuePanel (shared primitive); drain/pause behind ConfirmDialog; retry confirm keeps its "delete original after retrying" checkbox; raw job payload view at L4 |
| 57 | Retry source job re-opens trigger | L3 | Same behavior inside QueuePanel |
| 58 | Back navigation | L1 | Breadcrumb (fixes `/context` dead link) |
| 59 | Pipeline empty states | L2 | Stage cards render shared EmptyState ("No sources configured") |
| 60 | Processor context header + embedder badge | L1/L2 | Workspace header (L1) + Embedder stage card meta (L2) |
| 61 | Processor config details | L2 | Pipeline tab → "Processor" stage card; trigger/timeout/generate-embeddings as visible meta rows, not tooltip |
| 62 | Bulk process items | L3 | Processor stage card "Run" → Dialog with FilterPanel (preview + limit) |
| 63 | Recently processed list | L2 | "Activity" list under the Pipeline stages (merged with #69, filterable by stage), 10s polling kept |
| 64 | Processor queue + retry | L3 | "Jobs" expander on Processor stage → QueuePanel; retry wired to PROCESS_ITEM |
| 65 | Embedder variable bindings | L3 | Embedder stage card → "Configuration" expander with VariableSelectionElement rows |
| 66 | Embedder identity/trigger/queue | L2 | Embedder stage card meta rows |
| 67 | Bulk generate embeddings | L3 | Embedder stage "Run" → Dialog with FilterPanel (preview + limit) |
| 68 | Bulk delete embeddings | L3 | Embedder stage overflow menu → destructive Dialog with FilterPanel |
| 69 | Recent embeddings list | L2 | Merged Activity list (see #63) |
| 70 | Embedder queue + retry | L3 | "Jobs" expander → QueuePanel; retry wired to GENERATE_CHUNKS |
| 71 | File gallery dialog | L3 | Unchanged entry point: file fields in item edit / ItemFormFields → FilePicker dialog |
| 72 | Gallery search + pagination | L3 | Inside FilePicker |
| 73 | File tiles (thumbs, selection, type-disable) | L3 | Inside FilePicker |
| 74 | Tile actions (view/delete/add) | L3 | Always-visible compact icon row on touch; hover-reveal kept on pointer devices. **Delete routes through the shared ConfirmDialog** (destructive styling, names the file, warns it may be referenced by other items/agents) — never the current bare-icon instant delete (ladder rule: destructive ⇒ L3+ with confirmation) |
| 75 | Uppy upload to S3 | L3 | FilePicker "Upload" pane (tab on mobile) |
| 76 | FileDataCard metadata + download | L2 | Rendered inline for file fields in the panel |
| 77 | Confirm selection returns keys | L3 | FilePicker footer |
| 78 | ItemsSelectionModal browse/select | L2 (of chat/projects) | Kept as shared component; internally rebuilt on the same Toolbar/EmptyState primitives; 3-pane → responsive |
| 79 | Select-all context | L2 | Kept (button beside New Item in modal) |
| 80 | Inline new-item dialog | L3 | Kept; same dialog as workspace "New item" |
| 81 | Presets tab (search/validate/apply) | L2/L3 | Kept; validation summary unchanged |
| 82 | ItemFormFields shared editor | L2/L3 | Becomes the single creation/edit form used by workspace dialog + modal |
| 83 | Nav visibility | L0 | "Knowledge" lives in the **Build** nav group; RBAC-trimmed away from P1 (depends on shell redesign + a contexts/knowledge role permission — see §4 risks) |
| 84 | super_admin dashboard gate; item RBAC; defaultRightsMode | L1/L3 | Usage StatCards/charts render only for super_admin; item Access section at L3; defaultRightsMode applied silently on create with the mode badge visible |

Every inventory item (1–84, plus 26a) appears above; nothing is removed, only re-leveled.

### Layout & components

**`/data` — context library**
- `PageShell` (centered, `max-w-5xl`, `p-8`) → `PageHeader` (title `text-2xl font-semibold`, description `text-sm text-muted-foreground`) → optional admin StatCard row (`grid gap-4 md:grid-cols-3`) → `Toolbar` (search `Input` with `Search` icon) → context list.
- Context list: single bordered `rounded-lg border divide-y` container; rows are `<Link>` blocks `p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors` — name (`text-base font-medium`), description (`text-sm text-muted-foreground truncate`), right meta (`text-xs text-muted-foreground`: "1,240 items · ingested 2h ago") and status dot (`size-2 rounded-full bg-muted-foreground/40`, or `bg-destructive` + failed count badge). No Card-in-Card.
- Usage panel (admin): `ChartCard` ×2 (`TimeSeriesChart`, `DonutChart`) with the `DateRangeSelector`, revealed by "View usage" ghost button on the StatCard row (Collapsible).

**`/data/[ctx]` — workspace**
- `PageShell` (full-bleed work surface) → `PageHeader` with breadcrumb ("Knowledge / {name}"), description, primary `Button` "New item" (+ `Plus` icon). `Tabs` (shadcn) for **Items | Pipeline**, persisted to `?tab=`.
- **Items tab:** `Toolbar` = `Input` (search), `Button variant="outline"` "Filters" + `Badge` count, segmented `Tabs` Active/Archived (`?view=`). shadcn `Table` with `TableHeader` (Name, Tags, Updated, Embeddings, Processed); `Checkbox` column; selection bar = sticky `flex gap-2 p-2 border rounded-md bg-muted/50` with `Button variant="secondary"` Archive/Unarchive and `Button variant="destructive"` Delete (archived only, via `ConfirmDialog`). Footer pagination identical to today's controls (icon buttons with `sr-only` labels).
- **Item panel (`ListDetail` detail slot):** `aside` 480px, `border-l`, own scroll. Header `p-4`: name (`text-lg font-semibold truncate`), `Badge variant="outline"` Archived when applicable, `Button variant="outline" size="sm"` Edit / `Button` Save + ghost Cancel in edit mode, `DropdownMenu` (MoreVertical, `aria-label="Item actions"`): Process item, Generate embeddings, Delete embeddings, Archive/Unarchive, Delete. Body: stacked **DetailSection** primitives (`Collapsible` with `p-4` header, `text-sm font-medium` title + meta badge): Fields (open), Embeddings (`n chunks · updated 2h ago`), Access (mode badge), Calculated. Field rows are a definition-list grid (`grid grid-cols-[140px_1fr] gap-2 text-sm`) — lighter than today's `Table`. Copy actions: `Button variant="ghost" size="icon"` with `Copy` icon + tooltip, per value.
- **Pipeline tab:** vertical stage list (`flex flex-col gap-6`): three flat `Card`s — **Sources**, **Processor**, **Embedder** — connected by a muted vertical line (visual flow). Each: `CardHeader` (stage name `text-base font-medium`, queue `Badge variant="outline"` mono), meta rows (`text-sm`, schedule/cron in `font-mono text-xs`), right-aligned `Button variant="outline" size="sm"` "Run" + overflow menu, and two `Collapsible` expanders: "Configuration" (sources config / embedder variable bindings) and `Jobs (n failed)` → **QueuePanel**. Below the stages: **Activity** list (merged recent processings + embeddings, `divide-y` rows: item link, stage `Badge variant="secondary"`, relative time).
- Dialogs: trigger-source params, bulk process/generate/delete all use one `Dialog max-w-3xl` shell hosting **FilterPanel** (filters left, preview right at `md:grid-cols-2`, stacking below); destructive bulk delete uses destructive CTA styling. One overlay at a time — FilterPanel previews replace nested dialogs.
- Spacing/type strictly per CLAUDE.md: section gaps `gap-6`, in-card `p-4`, page `p-8`; labels `text-sm`, meta `text-xs`, code/IDs `font-mono`. Semantic colors only on status (failed = red, queued = blue via tokens, never raw palette classes — fixes queue-management/chart hexes).

**Shared primitives used:** PageShell, PageHeader, Toolbar, ListDetail, EmptyState, StatCard, ChartCard, ConfirmDialog.
**New shared primitives needed (not yet in philosophy §5):** **FilterPanel** (declarative field-filter + preview + limit; generalizes `ItemsFilter`), **QueuePanel** (promoted `QueueManagement`, already shared with evals), **FilePicker** (promoted `UppyDashboard` gallery+upload), **DetailSection** (collapsible titled section with meta badge — the one collapsible pattern for detail panels everywhere).

### Mobile behavior

P2's mobile job (personas.md): *monitor and triage* — check ingestion health, find an item, read it, small fixes. Designed top-down for that:

- **< md (≤768px):**
  - `/data`: context rows stack naturally (they're a list, not a grid); meta wraps to a second line; StatCards become a horizontal snap-scroll row.
  - Workspace: PageHeader compresses (breadcrumb collapses to a back chevron + context name); "New item" becomes an icon+label button; Toolbar wraps — search full-width, Filters + Active/Archived on a second row.
  - Items table → **card list** (standard tables→cards behavior from `design/responsive.md`): each card = name, updated, chunks badge; checkbox via long-press/edit-mode toggle; selection bar sticks to the bottom (thumb reach).
  - Item panel → **full-screen `Sheet`** (`side="bottom"`, full height) instead of a side panel; back gesture/X closes, URL `?item=` preserved so links work.
  - Pipeline stages stack full-width; "Run" buttons full-width inside cards; QueuePanel job rows become two-line cards; queue Pause/Resume/Drain stay behind their ConfirmDialogs (one-handed safe).
  - FilterPanel → full-screen Sheet, preview collapses to a count line ("124 items match") with a "Preview" expander; limit field keeps its 1–500 bounds.
  - FilePicker → full-screen Dialog with **Tabs: Gallery | Upload** (the two desktop panes); tile actions rendered as a visible icon row (no hover dependency); grid `grid-cols-2`. Because the delete icon is now always visible on touch, it must **only open the ConfirmDialog** (#74) — an accidental tap can never destroy a file.
  - ItemsSelectionModal → full-screen, stepped flow: contexts list → items list (back header) → selected tray as a bottom bar with count + "Add" CTA.
  - All config formerly in tooltips (cron, retries, backoff, timeout) lives in the Configuration expanders — reachable by tap.
- **md–lg:** item panel overlays as a right `Sheet` (not inline) to keep the table readable; Pipeline keeps single column.
- **≥ lg:** full layout as described; panel inline (ListDetail).
- Nothing horizontally scrolls except intentionally (StatCard snap row); heavy authoring (markdown expand editor) remains desktop-optimized but functional (full-screen dialog) on mobile — degradation, never breakage.

### Motion

Per CLAUDE.md timings, all `ease-in-out`, all behind `prefers-reduced-motion`:

- **Item panel open/close:** slide-in from right with subtle fade, 300ms (explains origin: the row you clicked). Mobile sheet slides from bottom, 300ms.
- **Selection action bar:** fade+rise 150ms when first row is checked (causality: selection → actions).
- **DetailSection / stage expanders:** height auto-animate 200ms (existing accordion pattern).
- **Status dot on failed jobs:** one-time 200ms scale-in when count appears — no looping pulse (calm surfaces).
- **Hover/focus:** 150ms background/border transitions on rows and tiles; focus ring with offset, instant.
- **Loading:** skeletons mirror the real layout (list rows, panel sections, stage cards); shimmer only for streaming-like polling updates in the Activity list; spinners only inside buttons during short mutations.
- Tooltip delay restored to a sane default (~300ms), not 0.

---

## 4. Implementation notes

**Files to change**
- `app/(application)/data/[[...query]]/layout.tsx`, `page.tsx`, `contexts.tsx` — replace with `/data/page.tsx` (library) + `/data/[ctx]/page.tsx` (workspace, tab/view/item via searchParams); keep `[[...query]]` only as a redirect shim for old URLs (or middleware redirects).
- `app/(application)/data/components/contexts-dashboard.tsx` — split into `ContextLibrary` (rows + meta) and `UsagePanel` (admin StatCards + ChartCards); delete the 1s-timeout empty-state heuristic; replace N+1 recent-items queries with per-row meta (needs an item-count/last-ingested field on `GET_CONTEXTS` or one aggregate query — backend coordination).
- `app/(application)/data/components/data-list.tsx`, `columns.tsx` — rebuild as `ItemsTable` on Toolbar + shadcn Table; move creation to the `ItemFormFields` dialog (delete instant-create mutation flow #22's junk-record behavior, keep `CREATE_ITEM` usage); unify on sonner toasts.
- `app/(application)/data/components/data-display.tsx` — rebuild as `ItemPanel` with DetailSection layering; paginate chunks; enforce the zod schema on save; replace div-click copy with copy buttons.
- `app/(application)/data/components/sources.tsx`, `processors.tsx`, `embeddings.tsx` — merge into `PipelineTab` with `StageCard` (sources/processor/embedder variants) + merged `ActivityList` (absorbs `components/custom/recent-embeddings.tsx` + `recent-processings.tsx`; delete dead chunk mutations in the latter); fix the `/context` dead link.
- `app/(application)/data/components/items-filter.tsx` — promote to `components/shared/filter-panel.tsx` (fix dynamic `grid-cols-*`, responsive stacking, visible copy buttons).
- `app/(application)/evals/[id]/runs/components/queue-management.tsx` — promote to `components/shared/queue-panel.tsx`; replace palette badge colors with semantic tokens (evals page consumes the same component — coordinate with `design/pages/evals.md`).
- `components/uppy-dashboard.tsx` (+ `hooks/use-uppy.tsx` untouched) — promote to `components/shared/file-picker.tsx` with mobile tabs, always-visible touch actions, and **tile delete routed through the shared ConfirmDialog** (replacing the unconfirmed instant `deleteFile.mutate`, uppy-dashboard.tsx:518-531/227-233). All five public exports (`UppyDashboard` default, `FileGalleryAndUpload`, `FileItem`, `FileDataCard`, `getPresignedUrl`) must remain API-stable — **the full consumer set below is the acceptance contract for this promotion** (verify each compiles and behaves unchanged):
  - `app/(application)/data/components/data-display.tsx` — `UppyDashboard`, `FileDataCard` (this page)
  - `components/item-form-fields.tsx` — `UppyDashboard`, `FileDataCard` (this page + ItemsSelectionModal)
  - `app/(application)/agents/edit/[id]/form.tsx` — `UppyDashboard`, `FileDataCard` (agent/theme uploads)
  - `app/(application)/evals/cases/components/test-case-modal.tsx` — `UppyDashboard`, `FileItem`, `getPresignedUrl`
  - `app/(application)/transcriptions/page.tsx` — `UppyDashboard`, `getPresignedUrl`
  - `app/(application)/chat/[agent]/[session]/chat.tsx` — `FileItem`, `getPresignedUrl`
  - `components/save-workflow-modal.tsx` — `UppyDashboard`, `FileItem`, `getPresignedUrl`
  - `components/image-generation/image-generation-widget.tsx` — `UppyDashboard`
  - `components/message-renderer.tsx` — `FileItem`
  - `components/lottie.tsx` — `getPresignedUrl`
  - `components/ai-elements/response.tsx` — `getPresignedUrl`
- `components/items-selection-modal.tsx` — keep its public API (`onConfirm/onSelectContext/onApplyPreset`) intact for chat + projects; rebuild internals responsive on the shared primitives.
- `components/custom/main-nav.tsx` — gate "Knowledge" by role (Build group), per the shell redesign.
- Delete dead files: `data/components/nav.tsx`, `search-bar.tsx`, `chart.tsx`.
- `hooks/contexts.tsx` — remove the hard 20 limit (paginate or raise + search).

**New shared components (flag for philosophy §5):** `FilterPanel`, `QueuePanel`, `FilePicker`, `DetailSection`. Also consumes the planned `PageShell`, `PageHeader`, `Toolbar`, `ListDetail`, `EmptyState`, `StatCard`, `ChartCard`, `ConfirmDialog`.

**Scope: XL.** Five screens collapse into two routes + a panel; four components get promoted to shared primitives; external consumers depend on preserved contracts (chat + projects for ItemsSelectionModal; eleven files for FilePicker/Uppy — see the acceptance contract above); mobile is a ground-up build (current state: broken).

**Dependencies**
- Shell/nav redesign (`design/navigation.md`): Build-group placement and RBAC trimming of the nav item (#83).
- RBAC model: `UserRole` has no contexts/knowledge permission (types/models/user-role.ts) — trimming P1 cleanly needs either a new role field (backend) or an interim convention (e.g. hide unless `agents` ≥ read).
- Backend/GraphQL: context-row meta (item count, last-ingested, failed-job count) needs an aggregate query to avoid the current N+1; chunk pagination on `GET_ITEM_BY_ID` (`chunks` currently unpaginated, queries.ts:330-339).
- Evals page shares QueuePanel; the FilePicker/Uppy promotion touches **eleven consumer files across six areas** (knowledge, agents, evals, transcriptions, chat, workflows/image-gen/shared renderers — full list above) — sequence the promotions with `design/pages/evals.md`, `design/pages/agents.md`, `design/pages/transcriptions.md`, and `design/pages/chat.md`, and gate the rename behind the consumer acceptance contract.

**Risks**
- The dynamic per-context GraphQL schema (`GET_ITEMS(context, fields)` string-built queries, queries.ts:280-300) makes typed table columns per context tricky — keep column set generic (name/tags/updated/status) and render custom fields only in the panel.
- Redirect shim must cover all 8 legacy URL shapes (deep links exist in toasts/notifications elsewhere, e.g. recent-embeddings links).
- `ItemsSelectionModal` regression risk in chat/projects — snapshot its props and behaviors (#78–82) as the acceptance contract.
- Removing instant-create changes the "new item auto-edit" behavior (#38) — the dialog must support file/custom fields on create exactly as `ItemFormFields` does today (it does; verify processor-aware loading state, items-selection-modal.tsx:800-808).
- Queue polling + 10s Activity polling could thrash on the consolidated Pipeline tab — poll only the visible tab.
