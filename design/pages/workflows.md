# Workflows & n8n — Review & Design Concept
**Routes:** `/workflows`, `/n8n`  **Primary persona:** P2 — The Power User  **Secondary:** P4 — The Developer (raw payloads, queue tuning, debugging)  **Current state:** Functionally deep but structurally inverted — the entire page is literally invisible on mobile (`hidden md:flex`), four stacked dialogs do the work a detail panel should, three names (Routines / Workflows / Templates) fight over one concept, and per-row polling fires up to four queries per table row.

---

## 1. Current state

The area is two surfaces: a routines list (`/workflows`) whose every secondary capability lives in a dialog, and a bare full-page n8n iframe (`/n8n`). Routines are created exclusively from chat ("Save as Routine" in a session); `/workflows` is where they are run, scheduled, inspected, edited, shared, and deleted.

Source files:

| File | Role |
|---|---|
| `app/(application)/workflows/page.tsx` | Page shell, run dialog, queue-management dialog host |
| `app/(application)/workflows/components/data-table.tsx` | Server-paginated table, search, (unreachable) bulk delete, pagination |
| `app/(application)/workflows/components/columns.tsx` | Columns + LastRunCell, run-history dialog, ScheduleManagementDialog, QueueAndScheduleCell, VisibilityIndicator, WorkflowActionsCell, delete confirm |
| `app/(application)/workflows/components/data-table-view-options.tsx` | Column-visibility dropdown |
| `app/(application)/n8n/page.tsx` | n8n iframe embed |
| `components/save-workflow-modal.tsx` | Create/edit/view routine (steps, variables, RBAC) — shared with chat |
| `app/(application)/evals/[id]/runs/components/queue-management.tsx` | Shared queue admin component, hosted here in a dialog |
| `components/rbac.tsx` | RBACControl visibility/sharing widget used by the save modal |
| `components/runs-table.tsx` | Generic static runs table — **imported nowhere (dead code)** |

**RBAC model:** the sidebar "Routines" item renders only for `user.super_admin || role.workflows === "write"` (`components/custom/main-nav.tsx:145-151`). The "Automation" (n8n) item additionally requires `config.n8n?.enabled` (`main-nav.tsx:176-185`), which derives from the `N8N_URL` env var (`app/(application)/layout.tsx:57-60`). **Neither page has its own permission gate** — `/workflows/page.tsx` renders for anyone who knows the URL (contrast `evals/page.tsx`, which gates). Per-workflow write access is derived client-side in `columns.tsx:829-841` (owner; `users` mode write entry; `roles` mode write entry; `public` → owner only; `teams` → never grants write — gap). `role.workflows === "read"` grants *no* navigation entry at all.

### Functionality inventory

*The contract: every numbered item below appears in the disclosure ladder in section 3. Nothing may be dropped.*

**A. `/workflows` — page shell & list**

1. **Sidebar nav entry "Routines"** — gated to super_admin / `role.workflows === "write"` (`main-nav.tsx:145-151`); i18n labels `navigation.routines` en "Routines" / de "Routinen" (`messages/en.json:13`, `messages/de.json:13`).
2. **Page header** — "Routines" title + "Manage your routines and monitor running jobs." (`workflows/page.tsx:92-97`).
3. **Permanent blue info alert** — "How to create a new conversation routine": save a chat conversation, run on demand or schedule via CRON if a queue + workers are configured (`workflows/page.tsx:101-109`).
4. **Routines table** — `GET_WORKFLOW_TEMPLATES`, server-paginated (page size 10), 30 s `pollInterval`, `previousData` fallback to avoid flicker, skeleton rows on first load (`data-table.tsx:91-123, 279-288`).
5. **Search by name** — "Search workflows…" input, server-side `contains` filter, refetch on every keystroke (no debounce) (`data-table.tsx:150-164, 172-179`).
6. **Reset-filter button** — appears when any filter is set, clears the name filter (`data-table.tsx:222-238`).
7. **Bulk delete of selected rows** — `enableRowSelection` + a "Delete" button over `getSelectedRowModel()`, **without any confirmation** — currently *unreachable*: no checkbox column exists in `createColumns`, so nothing can ever be selected (`data-table.tsx:135, 181-220`; `columns.tsx:998-1164`).
8. **Column-visibility "View" dropdown** — toggles accessor columns (name, agent, updatedAt only); hidden below `lg` (`data-table-view-options.tsx:23-58`).
9. **Name column** — name (medium weight) + description on a second line (`line-clamp-1`); sortable header (`columns.tsx:1008-1034`).
10. **Agent column** — resolves the agent per row via `GET_AGENT_BY_ID` (cache-first), renders a link to `/agents/edit/[id]`; "No Agent" / "Loading…" fallbacks; sortable header (`columns.tsx:1036-1074`).
11. **Status & Last Run column** — per-row `GET_JOB_RESULTS` (limit 1, label-contains-workflowId, 5 s poll): status icon with tooltip (completed ✓ green, failed/stuck ✗ red, active/waiting/delayed/paused ! blue, never-run –) + relative timestamp; click opens the run-history dialog (`columns.tsx:76-101, 103-150, 152-231`). The header has a sort toggle, but the column has no accessor — sorting is a no-op (`columns.tsx:1076-1090`).
12. **Queue & Schedule column** — per-row `GET_AGENT_BY_ID` + `GET_WORKFLOW_SCHEDULE` (30 s poll): clickable queue name (opens queue management), "Scheduled" badge + cron `code` + gear button when a schedule exists, otherwise "Add Schedule" outline button; "No queue configured." / "No Agent" / "Loading…" fallbacks (`columns.tsx:709-811`).
13. **Updated column** — relative `formatDistanceToNow`, sortable (`columns.tsx:1113-1135`). Sorting is client-side over the current 10-row page despite `manualPagination` (`data-table.tsx:143, 146`).
14. **Actions column** — primary "Run" button + overflow dropdown: Edit (write) / View (read), Delete (write only, red) (`columns.tsx:876-928, 1136-1163`). **Conditional branch:** when the routine has no agent, the *entire* cell renders the text "No Agent" before `WorkflowActionsCell` is ever mounted (`columns.tsx:1147-1148`) — no Run, no Edit/View, no Delete. Combined with bulk delete being unreachable (item 7), a routine whose agent was removed can never be deleted from the UI today. The new design must resolve this branch explicitly (see ladder item 14).
15. **Pagination footer** — "x of y row(s) selected", "Page X of Y", first/prev/next/last buttons (first/last hidden below `lg`), disabled from `pageInfo` (`data-table.tsx:302-366`).
16. **Empty state** — "No workflows found." table row (`data-table.tsx:289-297`).

**B. Run flow**

17. **Run dialog ("Start Template Run")** — opened from Run button (and from queue-job retry); execution-mode alert: blue "Scheduled Execution" naming the queue when the agent has `workflows.queue.name`, green "Immediate Execution" otherwise (`workflows/page.tsx:115-158`; queue name resolved in `columns.tsx:1141-1161`).
18. **Input variables form** — one required text input per template variable (variables are extracted server-side from `{variable_name}` syntax in steps; `GET_WORKFLOW_TEMPLATES` returns `variables`), labels prettified (`replaceAll("_"," ")`, capitalized), red asterisks, count display, scrollable list; "No input variables required" placeholder box otherwise; all-filled validation on submit via toast (`workflows/page.tsx:160-200, 217-228`).
19. **Submit** — `RUN_WORKFLOW` mutation (`id` + `variables` JSON; returns `result/job/metadata`, `queries/queries.ts:2406-2414`); button reads "Schedule Routine" (clock) or "Run Routine" (zap); spinner while loading; success toast "Template run completed" / error toast (`workflows/page.tsx:54-67, 203-264`).

**C. Run history (per routine)**

20. **Run-history dialog** — `max-w-[90vw] h-[85vh]` master-detail: left sidebar lists last 50 runs (`GET_JOB_RESULTS_LIGHT`: id/state/createdAt) with status icon, colored state text, absolute (`PPp`) + relative time, selected highlight, auto-select of newest; right pane fetches `GET_JOB_RESULT_BY_ID` for the selection (`columns.tsx:157-196, 233-296`).
21. **Run detail** — state badge (green/red/blue tinted) + full timestamp; **Result** as JSON `CodePreview`; **Error** as JSON `CodePreview` under a red heading; **Metadata** as a key/value table with `TextPreview`; "No additional details" and "Select a run" placeholder states (`columns.tsx:306-396`).

**D. Scheduling**

22. **Schedule management dialog** — per routine; shows current schedule (cron in `code`, "Next run" timestamp from `workflowSchedule.next`) with a destructive "Delete Schedule" button (`columns.tsx:416-437, 481, 541-568`).
23. **Preset tab** — 7 cron presets (daily midnight, hourly, weekdays 9:00, every 15 min, every 30 min, weekly Sunday, monthly 1st 9:00) in a Select with label + description, plus a preview of the selected expression (`columns.tsx:406-414, 576-599`).
24. **Custom CRON tab** — free-text input with live `cron-validator` validation, inline error, and a format cheat-sheet (minute/hour/day/month/weekday ranges) (`columns.tsx:483-495, 601-626`).
25. **Save / delete schedule** — `UPSERT_WORKFLOW_SCHEDULE` / `DELETE_WORKFLOW_SCHEDULE` with validation, toasts, refetch (`columns.tsx:439-532`; `queries/queries.ts:531-557`).

**E. Queue management (shared `QueueManagement` component, hosted in a `max-w-6xl` dialog)**

26. **Entry + context wiring** — clicking the queue name opens the dialog; job names render as "Routine Run: {workflow}"; `retryJob` re-opens the run dialog *for the job's workflow*, passing `job.data.inputs` as `variables` (`workflows/page.tsx:42-45, 268-289`). "Prefilled" would overstate it: the dialog's effect resets every variable value to an empty string (`page.tsx:77-86`), and `job.data.inputs` is typed `any` (`types/models/bullmq.ts`) — a values payload, not the `string[]` of variable *names* the dialog maps over — so prior inputs are never restored. And because this host's retry is an interactive dialog, **bulk** retry (item 33) loops `retryJob` per job (`queue-management.tsx:716-720`), each call overwriting `dialogOpen` — only the last job's run dialog survives. (Contrast the evals host, whose `retryJob` fires a mutation directly, `eval-runs.tsx:190-205`.)
27. **Queue stats strip** — `GET_QUEUE` (5 s poll): status badge (Paused grey / Maxed red / Active green), max queue concurrency, max worker concurrency, job timeout (s), max rate limit (jobs/sec) (`queue-management.tsx:69-72, 331-373`).
28. **Job-status tabs with live counts** — active / waiting / failed / stuck / completed, each with a count badge; retention footnote "Only last 5.000 succesfull and failed jobs are kept." (`queue-management.tsx:375-410`).
29. **Pause / Resume queue** — outline button toggling on `queue.isPaused`, each behind its own confirm AlertDialog (`queue-management.tsx:306-315, 765-801`).
30. **Drain queue** — removes waiting/delayed jobs, destructive confirm dialog (`queue-management.tsx:317-325, 803-824`).
31. **Jobs table** — `GET_JOBS` (5 s poll, status-filtered, paginated): checkbox selection (active jobs excluded), select-all, name (truncated), job ID with click-to-copy + tooltip, attempts, created/processed/finished timestamps, inputs preview (`TextPreview` of JSON, 50 chars), outputs preview or red `failedReason`, per-job delete (non-active), per-job retry (failed) (`queue-management.tsx:481-602`).
32. **Page-size select + pagination** — 20/50/100/200 per page; first/prev/next buttons (`queue-management.tsx:423-442, 605-652`).
33. **Bulk retry / bulk delete** — buttons appear when jobs are selected; delete behind confirm; retry behind confirm with a "Delete the original job(s) after retrying" checkbox (`queue-management.tsx:444-465, 658-763`).
34. **Auto-refresh badge** — permanent "Auto Refresh" badge with spinner (`queue-management.tsx:466-468`).

**F. Creating / editing routines (`SaveWorkflowModal`)**

35. **Create entry point (chat)** — "Save as Routine" button in a chat session, enabled when the conversation has ≥1 user and ≥1 assistant message; passes messages, `agentId`, session title (`chat/[agent]/[session]/chat.tsx:507-511, 1020-1028, 1449-1455`). Esc closes it (`chat.tsx:329-337`).
36. **Edit / View entry point (table)** — actions dropdown opens the same modal; read-only mode ("View Routine") when no write access (`columns.tsx:901-913, 930-944`). **Note:** this call site passes no `agentId`, so `UPDATE_WORKFLOW_TEMPLATE` is sent `agent: undefined` (`save-workflow-modal.tsx:114-127`) — risk of detaching the routine's agent on edit.
37. **Setup tab** — Template Name (required, inline ⚠️ warning when empty) + Description textarea (`save-workflow-modal.tsx:240-271`).
38. **Sharing & Permissions** — "Show Advanced" toggle reveals `RBACControl`: rights mode private/users/roles/teams/public, per-user (searchable picker over `GET_USERS`), per-role, per-team read/write assignment (`save-workflow-modal.tsx:273-313`; `components/rbac.tsx:38-46, 48-118`). Collapsed state claims "Using default permissions (private to you)" even when editing a shared routine. **Bug:** the per-team assignments collected into `rbac.teams` are silently dropped on save — both mutations send `RBAC: { users, roles }` with `teams` omitted (see item 42).
39. **Steps tab — conversation builder** — steps rendered via `Conversation`/`MessageRenderer` with per-message edit/remove (`showEdit`, `showRemove`, `onUpdate`), assistant *placeholder* messages auto-inserted after each user message ("💬 Placeholder, generated agent response will be added here…"), `{variable_name}` pro-tip box, empty state with sparkles icon (`save-workflow-modal.tsx:62-103, 317-366`).
40. **Add user message** — textarea (Enter adds, Shift+Enter newline), "Add Message" button, deliberate 1 s `setTimeout` before insert (id-collision workaround) (`save-workflow-modal.tsx:172-202, 368-414`).
41. **File attachments on steps** — `UppyDashboard` picker (limit 10; whitelist png/jpg/jpeg/gif/webp, pdf/docx/xlsx/xls/csv/pptx/ppt, mp3/wav/m4a/mp4/mpeg), `FileItem` preview grid with remove, amber "agent must support these file types" warning (`save-workflow-modal.tsx:386-437`). **Bug:** `currentFileParts` is never populated from the picker (`onConfirm` only sets `currentFiles`, `save-workflow-modal.tsx:396-399, 81-82`), so selected files are previewed but never attached to the saved message.
42. **Save / update** — `CREATE_WORKFLOW_TEMPLATE` (name, description, owner, rights_mode, agent, RBAC, steps_json) / `UPDATE_WORKFLOW_TEMPLATE`, success/error toasts, spinner ("Saving…"/"Updating…"), buttons "Save Template"/"Update Template"; read-only mode shows Close only (`save-workflow-modal.tsx:106-170, 451-478`). **Bug (persistence):** both mutations send `RBAC: { users: rbac.users, roles: rbac.roles }` — `teams` is omitted from the payload even though `rbac.teams` state is collected from `RBACControl` (`save-workflow-modal.tsx:121-125, 143-148`), so team assignments are silently dropped on every save and update. **Bug (fetch):** `GET_WORKFLOW_TEMPLATES`' RBAC selection requests only `users { id rights }` and `roles { id rights }` — no `teams` (`queries/queries.ts:1646-1660`) — so even team entries persisted by other means would be absent from the list payload (and `GET_WORKFLOW_TEMPLATE_BY_ID` selects no RBAC at all, `queries/queries.ts:1667-1681`). The teams pipeline is therefore broken end-to-end: write (dropped) → read (not fetched) → derive/display (items 43, 48).
43. **Write-access derivation** — owner → write; `users` mode write entry (compares `u.id === user.id.toString()` — number-vs-string, likely always false); `roles` mode write entry; `public` → owner only; `teams` mode unhandled → read-only (`columns.tsx:829-841`). Even if `teams` were handled here, the derivation could never see team entries: they are dropped at save and absent from the fetch (item 42).
44. **Delete routine** — type-the-exact-name AlertDialog; clicking the bolded name copies it to the clipboard (with toast); Delete disabled until exact match; `REMOVE_WORKFLOW_TEMPLATE_BY_ID` + refetch + toasts (`columns.tsx:843-874, 946-993`).

**G. `/n8n` — n8n integration**

45. **Sidebar nav entry "Automation"** — gated to (super_admin / `role.workflows === "write"`) AND `config.n8n.enabled` (`main-nav.tsx:176-185`); enablement = `N8N_URL` env var set (`layout.tsx:57-60`); i18n `navigation.automation` en "Automation" / de "Automatisierung".
46. **Full-page iframe** — embeds `N8N_URL`, `h-screen`, border-0, `allow="clipboard-read; clipboard-write"` (`n8n/page.tsx:11-20`).
47. **Unconfigured fallback** — bare unstyled `<div>N8n is not configured</div>` (`n8n/page.tsx:7-9`).

**H. Latent / dead code (preserve intent, retire or revive consciously)**

48. **`VisibilityIndicator`** — private/public/users(n)/roles(n) chip with icon, tint, and tooltip; its table column is commented out, so sharing state is currently invisible in the list (`columns.tsx:643-707`, commented column `columns.tsx:1106-1112`). No `teams` case.
49. **`components/runs-table.tsx`** — generic static `RunsTable` (Title/Status/Duration/Created/Output-view) imported nowhere.
50. **`usePagination` hook** — exported from `data-table.tsx:60-73`; duplicates the separate `page` state actually used for fetching (`data-table.tsx:88`).

51. **Queue jobs "State" column + `getStatusBadge`** — a per-job state Badge helper with hardcoded light-only tints (`queue-management.tsx:264-279`); its only call sites — the State `TableHead` and `TableCell` — are commented out (`queue-management.tsx:496, 538`), so the helper is dead code and the jobs table shows no per-row state today. (UX issue #14 cites these tints; note they currently never render.)

### UX review

| # | Severity | Issue | Evidence |
|---|---|---|---|
| 1 | **High** | The whole page is `hidden … md:flex` — below 768 px the route renders literally nothing (no message, no fallback). | `workflows/page.tsx:90` |
| 2 | **High** | Three names for one concept: nav says "Routines", search says "Search workflows…", the run dialog says "Start Template Run", the save modal mixes "Save as Routine" with "Save Template", toasts say "Workflow created!". Cognitive tax on every interaction. | `page.tsx:93,123`; `data-table.tsx:173`; `save-workflow-modal.tsx:213,471,131,153` |
| 3 | **High** | Query storm: each row mounts up to 4 `useQuery`s — `GET_AGENT_BY_ID` ×3 (agent cell, queue cell, actions cell), `GET_JOB_RESULTS` @5 s poll, `GET_WORKFLOW_SCHEDULE` @30 s poll — hooks living inside `cell` renderers. 10 rows ≈ 20+ polling queries. | `columns.tsx:77-90, 722-732, 1050-1054, 1141-1145` |
| 4 | **High** | No page-level RBAC gate — nav is hidden but the URL renders for anyone (evals gates, this doesn't); and `role.workflows === "read"` users get *neither* nav nor page, despite a read mode existing in role-form. | `workflows/page.tsx:23-291` (no check); `main-nav.tsx:145`; `components/role-form.tsx:34-38` |
| 5 | **High** | Unreachable bulk delete with **no confirmation** — if a select column is ever added back this silently mass-deletes; meanwhile single delete demands typing the name. Two confirmation philosophies in one file. | `data-table.tsx:181-220` vs `columns.tsx:946-993` |
| 6 | **High** | Save-modal file attachments silently never attach (`currentFileParts` never set from picker output). | `save-workflow-modal.tsx:81-82, 396-399, 184-187` |
| 7 | **Med** | Modal-on-modal: queue-management dialog → "Retry" opens the run dialog on top of it; the queue dialog itself hosts a full `Card` (box in box in overlay). | `workflows/page.tsx:268-289`; `queue-management.tsx:297` |
| 8 | **Med** | Editing a routine from the table can detach its agent (`agentId` not passed → `agent: undefined` in the update mutation). | `columns.tsx:930-944`; `save-workflow-modal.tsx:117-127` |
| 9 | **Med** | "Status & Last Run" sort button is a no-op (no accessor); other sorts only reorder the visible 10 rows of a server-paginated set — looks like it works, lies about the data. | `columns.tsx:1076-1090`; `data-table.tsx:143` |
| 10 | **High** | `teams` rights mode is broken across the whole pipeline, though the save modal lets you configure it: assignments are silently dropped from the CREATE/UPDATE mutation payloads (`RBAC: { users, roles }`, no `teams`); `GET_WORKFLOW_TEMPLATES` never fetches `RBAC.teams`; write-access derivation ignores `teams`; `VisibilityIndicator` has no `teams` case. Also: `users`-mode write check compares number to string. | `save-workflow-modal.tsx:121-125, 143-148`; `queries/queries.ts:1646-1660`; `columns.tsx:829-841, 643-688` |
| 11 | **Med** | Search refetches the server on every keystroke (no debounce). | `data-table.tsx:150-164` |
| 12 | **Med** | Success toast "Template run completed — The template has been run successfully." fires when the mutation returns, including for *queued* runs that haven't executed. | `workflows/page.tsx:56-59` |
| 13 | **Med** | Schedule dialog doesn't prefill the existing cron into preset/custom fields — "editing" a schedule means retyping it. | `columns.tsx:428-431, 481` |
| 14 | **Med** | Hardcoded light-only tints (`bg-green-100 text-green-800`, etc.) on state badges break dark mode (CLAUDE.md: both themes first-class). The `queue-management.tsx:264-279` instance (`getStatusBadge`) is currently *dead code* — its only call sites are commented out (lines 496, 538; inventory #51) — but must not be revived as-is. | `columns.tsx:313-319, 772`; `queue-management.tsx:264-279` |
| 15 | **Med** | Keyboard/a11y: run-history opens from an `onClick` div, queue management from a clickable div; `TooltipTrigger` wraps icon-only content with no aria-label. | `columns.tsx:217-221, 759-765, 106-115` |
| 16 | **Low** | Permanent blue onboarding alert occupies prime real estate forever (anti-pattern: nothing shouts). | `workflows/page.tsx:101-109` |
| 17 | **Low** | Emoji in product copy (💬 placeholder, 💡 pro tip, ⚠️ validation) clashes with the professional voice. | `save-workflow-modal.tsx:71, 325, 252-253` |
| 18 | **Low** | Dev artifacts: `console.log` in handlers, 1 s artificial delay on Add Message, typo "succesfull". | `page.tsx:34, 43, 56`; `columns.tsx:885`; `save-workflow-modal.tsx:196`; `queue-management.tsx:409` |
| 19 | **Low** | n8n: `h-screen` inside the app shell (double scroll), unstyled "N8n is not configured" string, no iframe loading state, no open-in-new-tab escape hatch. | `n8n/page.tsx:7-9, 12` |

### Mobile audit

- **Fatal:** `hidden h-full flex-1 flex-col space-y-8 p-8 md:flex` (`workflows/page.tsx:90`) — at 390 px the page body simply does not render. The route is a blank screen. **Severity: broken.**
- Even if unhidden, nothing survives 390 px: a 6-column table with multi-line composite cells (`columns.tsx:998-1164`); dialogs sized `max-w-2xl` / `max-w-4xl` / `max-w-6xl` / `max-w-[90vw] h-[85vh]` with no `sm:` fallbacks (`page.tsx:121, 273`; `save-workflow-modal.tsx:210`; `columns.tsx:234`); the run-history dialog hard-codes a `w-80` sidebar next to a flexible pane (`columns.tsx:241`); the queue jobs table has 10 columns with fixed `max-w-[120px]/[200px]` truncations (`queue-management.tsx:481-602`).
- Hover-only affordances: row-action discoverability relies on tooltips, and click-targets are text spans (queue name, run timestamp) — no touch affordance (`columns.tsx:217-221, 759-765`).
- `/n8n`: the iframe gets `h-screen` under the app chrome (`n8n/page.tsx:12`), causing overflow; the embedded n8n editor is itself desktop-oriented — at 390 px the embed is unusable with no alternative offered.

---

## 2. Jobs to be done

**P2 — Power User (primary owner).** *#1 job in one sentence: "Run a saved routine (or confirm its schedule ran) and see at a glance that it succeeded."* Ranked by frequency:
1. Check that routines ran and succeeded — status, last run, read a result (daily).
2. Run a routine on demand, filling its variables (daily/weekly).
3. Triage a failed run — read the error, retry it (weekly).
4. Create a routine from a chat conversation; tweak its steps/variables (weekly).
5. Manage schedules — add, change, remove a cron (occasionally).
6. Share a routine (RBAC) with users/roles/teams (occasionally).
7. Build heavier automations in n8n where enabled (occasionally).

**P4 — Developer (secondary).**
1. Debug failed jobs: raw result/error JSON, job IDs, inputs/outputs payloads (when paged).
2. Operate the queue: pause/resume/drain, concurrency/rate-limit visibility, bulk retry/delete (rarely, high stakes).
3. Build/maintain n8n flows that call Exulu APIs.

**P3 — Admin.** Only tangentially: n8n *enablement* is an `N8N_URL` deployment env var (`layout.tsx:57-60`) with **no admin surface on these pages** — there is nothing for P3 to do here in the UI.

**Ownership matrix correction:** `personas.md` lists `/n8n` as "Primary P2, Secondary **P3 (enablement)**". The enablement job does not exist on this page (it's deploy-time config; at most it belongs on `/configuration`). The correct entry is **`/n8n` — Primary P2, Secondary P4**. `/workflows` (P2 primary, P4 secondary) is confirmed correct — with the note that the current nav gate (`write` only) contradicts the matrix until read-mode access is honored.

---

## 3. Design concept

**Naming decision (resolves UX issue #2):** the concept is called **Routine** everywhere — nav, header, empty state, dialogs, toasts, search placeholder. "Workflow" survives only in code identifiers and the n8n context; "Template" disappears from UI copy. The n8n nav item stays "Automation" to keep the two surfaces distinct.

### Default view (L1)

`/workflows` becomes a calm list-detail page owned by P2's #1 job (status at a glance, run on demand):

- **PageHeader** — "Routines" (`text-2xl`), purpose line "Saved conversations that run on demand or on a schedule." (`text-sm text-muted-foreground`), and on the right the page's single purple action: **"New routine"**. Since routines are born in chat, this button opens a small L3 popover: one sentence ("Routines are saved from conversations — start a chat, then choose *Save as Routine*."), one primary button "Open chat" → `/chat`. This replaces the permanent blue alert (inventory #3), whose content also moves into the EmptyState.
- **Toolbar** — directly under the header: debounced search ("Search routines…"), a quiet status filter (All / Failing / Scheduled), and the column-visibility menu folded into a single overflow "⋯ View" item. **Backend-gated:** the status filter requires server-side filtering on last-run state and schedule existence, which `FilterWorkflow_template` does not support today (`WorkflowFilters` = name/visibility/createdAt/updatedAt only, `data-table.tsx:49-54`; `GET_WORKFLOW_TEMPLATES` filters, `queries/queries.ts:1620-1630`) — see Backend/API dependencies. Filtering client-side over one server-paginated page would lie about the data (same sin as UX issue #9), so the filter ships *only* once the backend filter exists; until then the toolbar is search + View.
- **Routine list (table on desktop)** — four calm columns, one row per routine:
  1. **Name** — name + one-line description (as today), plus a *quiet* visibility chip (revives inventory #48, now incl. `teams`) shown only when not private.
  2. **Last run** — `StatusDot` (muted dot for success, red for failed, pulsing blue for active, hollow for never-run) + relative time. Healthy is quiet; failure earns color (philosophy §4).
  3. **Schedule** — `code`-styled cron chip with next-run tooltip, or em-dash. (Queue plumbing moves to L2 — it's infrastructure, not a per-glance fact.) **Backend-gated:** the only source for this today is the per-row `GET_WORKFLOW_SCHEDULE` 30 s poll (`columns.tsx:728-732`) — part of the query storm this design eliminates (UX issue #3). The chip is fed by batched schedule data (see Backend/API dependencies); interim fallback is one combined per-page query, never per-row polls.
  4. **Run** — outline button with Play icon, always visible (no hover-only). Purple stays reserved for the header action; the row's Run is the *frequent* action, not the page's accent.
- **Row click** opens the **detail panel** (L2) — the new home for everything that is currently four stacked dialogs.
- **EmptyState** — Workflow icon, "No routines yet. Save any chat conversation as a routine to run it again — on demand or on a schedule.", primary action "Open chat".

`/n8n` keeps the full-bleed iframe (it *is* the job) but gains a slim PageHeader bar (title "Automation", "Open in new tab" ghost button) above a correctly-sized iframe (`h-[calc(100vh-theme-header)]`, no `h-screen`), an EmptyState when unconfigured ("n8n is not configured. Set `N8N_URL` on the deployment to enable the embedded editor."), and a skeleton while the iframe loads.

### Disclosure ladder

Every inventory item, mapped. (Levels per `design/philosophy.md` §2.)

| # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | Nav entry "Routines" (RBAC-gated) | L0 | Sidebar, Build group; now also rendered for `role.workflows === "read"` (read-only page) |
| 2 | Page title + description | L1 | PageHeader |
| 3 | How-to-create explainer | L3 | "New routine" popover + EmptyState copy (alert removed) |
| 4 | Paginated, polled routine list | L1 | List region (poll 30 s retained, single batched query) |
| 5 | Search by name | L1 | Toolbar (debounced 300 ms) |
| 6 | Reset filter | L1 | Clear "×" inside the search input + filter-chip clear |
| 7 | Bulk delete | L3 | Toolbar "Select" mode adds checkboxes; bulk Delete goes through shared ConfirmDialog (count-stated) — reachable *and* confirmed |
| 8 | Column visibility toggle | L3 | Toolbar overflow "View" menu (desktop only, as today) |
| 9 | Name + description cell | L1 | Column 1 |
| 10 | Agent name + link | L2 | Detail panel header ("Runs with **{agent}** →" link to `/agents/edit/[id]`) |
| 11 | Last-run status + relative time | L1 | Column 2 (`StatusDot` + time); click = open panel on Runs tab |
| 12 | Queue name / schedule presence per row | L1/L2 | Schedule chip at L1 (col 3) — fed by the batched schedule data named in Backend/API dependencies, *not* by reviving the per-row `GET_WORKFLOW_SCHEDULE` poll (`columns.tsx:728-732`); queue name moves to panel → Queue section (L2) |
| 13 | Updated timestamp + sort | L1/L3 | Default sort = updatedAt DESC (server-side); column hidden by default, restorable via View menu; sorting becomes server-side (`sort` var exists in `GET_WORKFLOW_TEMPLATES`) |
| 14 | Run button + Edit/View/Delete menu | L1/L2 | Run = column 4; Edit/View/Delete live in the detail panel header overflow menu (and stay in a row overflow menu for keyboard/parity) |
| 15 | Pagination | L1 | Footer under list, unchanged pattern |
| 16 | Empty state | L1 | Shared EmptyState primitive |
| 17 | Execution-mode notice (queued vs immediate) | L3 | Run dialog: one quiet line under the title — "Runs immediately" / "Queued on **{queue}**" (icon + sentence, no alert box) |
| 18 | Variable inputs form | L3 | Run dialog body; proper `react-hook-form` validation with inline field errors (no toast-only validation) |
| 19 | Run/Schedule submit + feedback | L3 | Run dialog footer; toast copy fixed: "Routine queued" vs "Routine run started" |
| 20 | Run history master-detail | L2 | Detail panel → **Runs** tab: list of last 50 runs (status, time); selecting a run swaps the panel body to run detail with back affordance (panel navigation, not nested dialog) |
| 21 | Run result / error / metadata | L2/L4 | Runs tab detail: error summary + metadata table at L2; full Result/Error JSON behind a "Raw" `CodePreview` toggle at L4 with copy button |
| 22 | Current schedule + next run + delete | L2/L3 | Detail panel → **Schedule** section: cron + "Next run …" at L2; Remove schedule behind shared ConfirmDialog (L3) |
| 23 | Cron presets | L3 | Schedule section edit mode, Presets tab (prefilled with current value) |
| 24 | Custom cron + validation + cheat sheet | L3/L4 | Custom tab with live validation; cheat sheet collapses behind "Format help" disclosure (L4) |
| 25 | Save/delete schedule mutations | L3 | Same section, inline save; toasts retained |
| 26 | Queue mgmt entry + retry wiring | L2 | Detail panel → **Queue** section header ("Manage queue →" opens the queue Sheet). Retry is split: **default retry is non-interactive** — re-runs via `RUN_WORKFLOW` with the job's original `data.inputs` as `variables` (mirroring the evals host's direct-mutation retry, `eval-runs.tsx:190-205`; guard + error toast when `data.workflow`/`data.inputs` are missing). A per-job "Retry with edits…" menu item closes the Sheet and opens the run dialog *actually* seeded from `data.inputs` — new behavior; today the form resets every field to "" (`page.tsx:77-86`). One overlay at a time either way |
| 27 | Queue stats (status/concurrency/timeout/rate) | L3 | Queue Sheet header strip (read-mostly facts, monospace numbers) |
| 28 | Job-status tabs + counts + retention note | L3 | Queue Sheet tabs; retention note as footnote (typo fixed) |
| 29 | Pause / Resume queue + confirm | L3 | Queue Sheet header buttons → shared ConfirmDialog |
| 30 | Drain queue + destructive confirm | L3 | Queue Sheet header overflow → ConfirmDialog (destructive styling) |
| 31 | Jobs table (selection, copy ID, payload previews, per-job retry/delete) | L3/L4 | Queue Sheet body; inputs/outputs previews truncate at L3, full payloads via row "Raw" expander (L4, `CodePreview`) |
| 32 | Page-size + pagination | L3 | Queue Sheet footer |
| 33 | Bulk retry / delete + delete-original checkbox | L3 | Queue Sheet selection bar → ConfirmDialogs (checkbox preserved). Bulk retry uses the **non-interactive** re-run path from item 26 for every selected job — it must never route through the run dialog: today's loop of interactive `retryJob` calls (`queue-management.tsx:716-720`) overwrites `dialogOpen` per iteration so only the last job's dialog survives. ConfirmDialog states the count; per-job failures surface in one summary toast |
| 34 | Auto-refresh indicator | L3 | Tiny pulse dot + "Live" label in Sheet header (calmer than badge+spinner) |
| 35 | "Save as Routine" from chat | L1 (chat) | Unchanged entry point in the chat session header; modal renamed consistently |
| 36 | Edit / View routine from list | L2→L3 | Detail panel header "Edit" (or "View" badge when read-only) opens the routine editor dialog; **fix:** pass `agentId` from the loaded template |
| 37 | Name + description fields | L3 | Editor dialog, Setup tab |
| 38 | RBAC sharing control | L3 | Editor dialog, Setup tab "Sharing" section — collapsed summary states the *actual* current mode ("Shared with 3 roles"), expands to full RBACControl; `teams` honored end-to-end: **persisted** (`teams: rbac.teams` added to the `RBAC` payload of both `CREATE_WORKFLOW_TEMPLATE` and `UPDATE_WORKFLOW_TEMPLATE` — today dropped, `save-workflow-modal.tsx:121-125, 143-148`), **fetched** (`teams { id rights }` added to the `GET_WORKFLOW_TEMPLATES` RBAC selection — today missing, `queries/queries.ts:1646-1660`), and honored in write-access logic and chips. Without the payload + selection fixes the chips and access logic have nothing to show |
| 39 | Step builder (MessageRenderer, placeholders, var pro-tip, empty state) | L3 | Editor dialog, Steps tab (pro-tip becomes a quiet `text-xs` helper line; emoji removed) |
| 40 | Add user message (Enter/Shift+Enter) | L3 | Steps tab composer (1 s delay removed; proper unique ids) |
| 41 | File attachments + type warning | L3 | Steps tab composer (bug fixed: selections converted to `FileUIPart`s and attached); amber warning kept |
| 42 | Create/update mutations + read-only mode | L3 | Editor dialog footer ("Save routine" / "Update routine") |
| 43 | Write-access derivation | — (logic) | Centralized in `lib/workflow-access.ts`; fixes string/number compare; adds `teams` — which requires the item-38 data fixes (teams in the mutation payloads *and* in the `GET_WORKFLOW_TEMPLATES` selection), otherwise the helper receives no team entries to evaluate; drives panel buttons, row menu, and read-only editor |
| 44 | Type-name delete confirm + copy-name affordance | L3 | Shared ConfirmDialog variant with "type to confirm" slot (panel overflow → Delete); copy-name affordance kept |
| 45 | n8n nav gating | L0 | Sidebar "Automation", same RBAC + config gate |
| 46 | n8n iframe embed | L1 (`/n8n`) | Full-bleed work surface under slim PageHeader; clipboard allows retained |
| 47 | n8n unconfigured fallback | L1 (`/n8n`) | Shared EmptyState with actionable copy (env var named) |
| 48 | Visibility indicator | L1/L2 | Quiet chip on Name cell when shared (revived); full sharing detail in panel Overview |
| 49 | `runs-table.tsx` dead component | — | Delete the file; its job is covered by the Runs tab (record here = the conscious retirement) |
| 50 | `usePagination` dead hook | — | Remove; single pagination state in the list container |
| 51 | Commented State column + `getStatusBadge` | — | **Retired consciously** in the QueueManager promotion: the Sheet's status tabs already scope every visible row to a single state, so a per-row State column is redundant on desktop; delete `getStatusBadge` and the commented column rather than reviving the light-only tints. The state *intent* survives where context is lost — mobile job cards show state via the shared `StatusDot` |

### Layout & components

**Page composition (`/workflows`):**

```
PageShell (list-page type: max-w-screen-2xl, px-8 py-8, space-y-6)
├─ PageHeader        title="Routines" · description · primary "New routine" (Button default + Popover)
├─ Toolbar           Input(search, w-64, debounced) · status filter (Select, ghost) · overflow View menu
├─ ListDetail
│   ├─ list: Table (shadcn) — 4 columns; rows h-14; row hover bg-muted/50 (150ms)
│   └─ detail: side panel (right, w-[420px], border-l) — RoutinePanel
│       ├─ header: name (text-lg) · agent link · visibility chip · Run (Button default — the panel's one purple) · overflow menu (Edit/View · Delete)
│       ├─ Tabs (shadcn Tabs, underline style): Overview · Runs · Schedule · Queue
│       │   Overview: description, variables list (Badge secondary per variable), sharing detail, created/updated (text-xs)
│       │   Runs: run list (StatusDot + time, button rows) → run detail (state Badge, timestamps, error, metadata Table, Raw toggle → CodePreview)
│       │   Schedule: current cron (font-mono) + next run · edit (Tabs preset/custom) · Remove (ConfirmDialog)
│       │   Queue: queue name + live counts (StatCard-mini row) · "Manage queue" → Sheet
│       └─ EmptyState inside tabs where applicable ("Never run yet — press Run to try it.")
├─ Pagination footer (existing pattern)
└─ Sheet (right, w-[720px] max-w-full): QueueManagement (restyled, card chrome removed — Sheet supplies the frame)
```

**shadcn components:** Table, Tabs, Sheet, Dialog (run dialog + routine editor only), AlertDialog via shared ConfirmDialog, DropdownMenu, Popover, Select, Badge, Button, Input, Textarea, Tooltip, Skeleton, Checkbox.

**Shared primitives from philosophy §5:** PageShell, PageHeader, Toolbar, ListDetail, EmptyState, ConfirmDialog. StatCard appears only as the mini count strip in the Queue tab.

**NEW shared primitives this page needs (flagged for philosophy §5):**
- **StatusDot** — semantic run/job state dot (success muted, failed red, active pulsing blue, never-run hollow) + accessible label; needed identically by evals runs, dashboard, and queue jobs.
- **RunInspector** — run list + run detail (state, timestamps, error, metadata, L4 raw JSON) as one component; shared between the routine panel and eval job results.
- **QueueManager** — the existing `queue-management.tsx` promoted to `components/shared/`, Sheet-friendly (no Card wrapper), theme-safe badges; consumed by both `/workflows` and `/evals/[id]`. The promotion resolves inventory #51: the commented State column and its dead `getStatusBadge` helper are retired (status tabs already scope rows by state); mobile job cards carry state via `StatusDot`.
- **ScheduleEditor** — cron preset/custom editor with validation + prefill; reusable wherever cron scheduling appears.

**Type & spacing per CLAUDE.md:** page title `text-2xl`, panel title `text-lg`, body `text-sm` in tables, metadata `text-xs`, cron/IDs/JSON `font-mono`; section spacing `gap-6`, intra-component `gap-2`/`gap-4`; all state tints via semantic tokens with dark-mode pairs (e.g. `bg-green-500/10 text-green-600 dark:text-green-400`) replacing the hardcoded `bg-green-100 text-green-800` family.

**RBAC in the new design:** page gate added (`super_admin || role.workflows in {read, write}`) mirroring `evals/page.tsx`; nav shows for read+write; `read` renders the list + panel read-only (no Run? — Run requires write since it mutates: Run, schedule, queue ops, edit, delete all gated to write; read sees status, history, schedule, queue stats). Per-routine write access via the centralized helper (item 43).

### Mobile behavior

Designed for P2's mobile job (personas.md): *monitor and triage — check status, read a failed run, retry.*

- **< md (390 px target):** remove `hidden md:flex` entirely. The table becomes a card list (shared tables→cards behavior): each card = name, StatusDot + relative time, schedule chip; tap opens the detail panel as a **full-screen Sheet** (side="bottom" or full overlay). Run stays available inside the sheet header. Toolbar collapses to search + filter icon-button. Pagination becomes prev/next only.
- **Detail sheet on mobile:** tabs become a horizontal scrollable tab bar; Runs tab is the star — run list and run detail stack vertically with a back chevron; raw JSON viewers scroll within `overflow-x-auto` blocks, never the page.
- **Run dialog:** full-screen sheet below `sm`; variable inputs stack, sticky footer with Run button (one-handed reach).
- **Queue Sheet:** at < md it is read-mostly — stats strip wraps into a 2-col grid, jobs render as compact cards (name, state, time, retry/delete buttons ≥44 px); bulk selection desktop-only. Pause/Resume kept (triage action); Drain demoted to overflow.
- **Routine editor:** desktop-optimized authoring per philosophy §7 — on mobile it opens read-only-by-default with an "Edit anyway" escape; never overflows (steps area `max-h` + internal scroll; composer stacks).
- **`/n8n` on mobile:** the iframe is replaced below `md` by an EmptyState-style notice ("The n8n editor needs a larger screen") with an "Open n8n in browser" button (new tab) — degradation, not a broken embed.
- **md–lg:** detail panel narrows to `w-[360px]`; below `lg` it becomes an overlay Sheet instead of a docked panel; first/last pagination buttons hide (as today).

### Motion

Per CLAUDE.md timings, all gated by `prefers-reduced-motion`:

1. **Detail panel slide-in** — 300 ms `ease-in-out` translate-x from right (explains origin: the row you clicked). Sheet variants use the same curve.
2. **Active-run pulse** — StatusDot for `active/waiting` states pulses opacity 1→0.5 at ~1.5 s; the only persistent motion on the page (it *is* information).
3. **Run feedback** — Run button: pressed scale 0.98 (150 ms) → spinner → on success the row's StatusDot crossfades to the new state (200 ms) instead of a layout jump.
4. **Row hover** — background transition 150 ms; tab underline slides 200 ms.
5. **Raw/format-help disclosures** — height auto-animate 200 ms (tailwindcss-animate accordion tokens).

No entrance animations on the list; skeleton rows mirror the 4-column layout and swap in place.

---

## 4. Implementation notes

**Files to change:**
- `app/(application)/workflows/page.tsx` — rebuild on PageShell/PageHeader/Toolbar/ListDetail; add RBAC page gate; remove `hidden md:flex`, blue alert, console.logs; host run dialog + queue Sheet at page level (one overlay at a time); rewire the `retryJob` callback to the non-interactive `RUN_WORKFLOW` re-run with original `data.inputs` (ladder items 26/33), keeping the dialog flow only for single-job "Retry with edits…" with true value seeding (replacing the reset-to-empty effect, `page.tsx:77-86`).
- `app/(application)/workflows/components/columns.tsx` — dissolve: cells become thin presenters; LastRunCell/run-history → `RunInspector`; ScheduleManagementDialog → `ScheduleEditor` (with prefill); QueueAndScheduleCell splits: queue plumbing → panel Queue section (L2), schedule *presence* stays at L1 as the cron chip in column 3 — fed by the batched schedule data (see backend deps), with its per-row `GET_WORKFLOW_SCHEDULE` poll (`columns.tsx:728-732`) deleted along with the other per-row queries; VisibilityIndicator revived (+`teams`) as the Name-cell chip; access logic → `lib/workflow-access.ts` (fix string/number compare, add teams).
- `app/(application)/workflows/components/data-table.tsx` — debounce search; server-side sorting via existing `sort` variable; remove unreachable bulk-delete or reintroduce select-mode through ConfirmDialog; delete `usePagination`; cards-on-mobile variant.
- `components/save-workflow-modal.tsx` — rename copy to "Routine"; fix file-attachment bug (convert picker output to `FileUIPart`s, reuse the working pattern from `evals/cases/components/test-case-modal.tsx:118-150`); fix `agentId` on edit (load from template); **fix the teams-RBAC persistence bug**: add `teams: rbac.teams` to the `RBAC` payload of both `CREATE_WORKFLOW_TEMPLATE` and `UPDATE_WORKFLOW_TEMPLATE` (currently `{ users, roles }` only, `save-workflow-modal.tsx:121-125, 143-148` — silently drops team assignments); truthful collapsed-RBAC summary; remove 1 s delay + emoji.
- `queries/queries.ts` — add `teams { id rights }` to the `RBAC` selection of `GET_WORKFLOW_TEMPLATES` (`queries/queries.ts:1646-1660`; mirror in the `CREATE_WORKFLOW_TEMPLATE` response selection) so fetched routines carry team entries for the chip, the sharing summary, and `lib/workflow-access.ts`; without this the item-38/43 teams fixes are inert.
- `app/(application)/n8n/page.tsx` — slim header + open-in-new-tab; height fix; EmptyState fallback; `<md` notice variant; iframe skeleton.
- `app/(application)/evals/[id]/runs/components/queue-management.tsx` → promote to `components/shared/queue-manager.tsx` (Sheet-friendly, theme-safe badges, mobile cards); update the evals import. Resolve inventory #51 during the move: delete the dead `getStatusBadge` (`queue-management.tsx:264-279`) and the commented State column markup (lines 496, 538) — retired, not revived (rationale in ladder item 51); bulk retry switches to the non-interactive per-job re-run (ladder item 33).
- `components/runs-table.tsx` — delete (dead, item 49).
- `components/custom/main-nav.tsx:145` — include `role.workflows === "read"` in the Routines gate.

**Files to create:** `components/shared/status-dot.tsx`, `components/shared/run-inspector.tsx`, `components/shared/schedule-editor.tsx`, `lib/workflow-access.ts`, plus the page-level `routine-panel.tsx` under `app/(application)/workflows/components/`.

**Backend/API dependencies (risks):**
- **Batched last-run data** is the big one: killing the per-row `GET_JOB_RESULTS` poll needs either `lastRun {state createdAt}` embedded in `workflow_templatesPagination` or a batch query keyed by workflow ids. Without it, cap polling to the visible page with a single combined query. Same for agent names (`GET_AGENT_BY_ID` ×3/row) — a `GET_AGENTS_BY_IDS` lookup or embedding `agentName` in the template payload.
- **Batched schedule data** — the L1 Schedule chip (cron + next-run tooltip, column 3) has no implementable source today except the per-row `GET_WORKFLOW_SCHEDULE` 30 s poll (`columns.tsx:728-732`), which is part of the query storm this design removes. Needs either `schedule { schedule next }` embedded in `workflow_templatesPagination` items or a batch schedule query keyed by workflow ids. Interim fallback: a single combined query for the visible page's ids (same capping rule as last-run data); the chip must never ship on per-row polls.
- **Status filter (All / Failing / Scheduled)** — requires server-side filtering on last-run state and on schedule existence. `FilterWorkflow_template` supports neither (`WorkflowFilters` = name/visibility/createdAt/updatedAt, `data-table.tsx:49-54`; `GET_WORKFLOW_TEMPLATES` filters, `queries/queries.ts:1620-1630`). There is no honest client-side fallback on a server-paginated list, so this toolbar control is *deferred until the backend filter exists* — the v1 toolbar ships search + View only.
- **`teams` in the RBAC schema** — the frontend teams fixes (mutation payload + query selection, items 38/42/43) assume the backend `RBACInput` and `RBAC` type accept and return `teams { id rights }` for workflow templates. Verify before building; if the schema lacks it, that's a backend prerequisite for teams sharing, not just a frontend patch.
- Server-side sorting for name/updatedAt already exists (`sort` var, `queries/queries.ts:1620-1626`); last-run sorting needs backend support or the column ships unsorted (honest > fake).
- Page-level RBAC gate needs `role.workflows` exposed on the user context (already present — `user.role.workflows`, see `main-nav.tsx:145`).

**Dependencies on other pages/shell:** nav label/grouping changes belong to `design/navigation.md` (Build group); `QueueManager` restyle must be co-reviewed with the evals page doc (it's embedded at `evals/[id]/runs`); chat's "Save as Routine" button copy is touched but its placement is chat's doc.

**Scope: L.** The list/panel rebuild, four-dialog dissolution, shared-primitive extraction, mobile from zero (the page currently renders nothing < md), and three real bug fixes (file parts, agent detach, teams-RBAC payload/selection). A first cut ships without new backend features *with two stated exceptions*: the toolbar status filter is deferred entirely until `FilterWorkflow_template` grows last-run/schedule filtering, and the L1 schedule chip runs on the capped per-page combined query until the batched schedule data lands (last-run polling tamed the same way).

**Risks:** (1) `QueueManager` is shared with evals — regression surface; ship behind a co-ordinated refactor (its retry contract also changes: non-interactive bulk path, ladder items 26/33). (2) The batched last-run *and* schedule queries need backend work; interim per-page polling must be carefully capped or the query storm survives — and the status filter has no interim at all (deferred, see backend deps). (3) `steps_json` placeholder semantics (placeholder assistant messages) are load-bearing for the runner — the step builder refactor must not alter the saved shape. (4) Renaming to "Routine" touches i18n keys in `messages/en.json`/`de.json` — sweep both locales. (5) Type-to-confirm delete keeps its copy-name affordance, which weakens the friction — kept deliberately for parity, but worth a product decision. (6) Teams sharing depends on backend `RBACInput`/`RBAC` schema support for `teams` on workflow templates (unverified) — confirm before promising it in release notes.
