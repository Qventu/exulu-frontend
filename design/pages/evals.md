# Evals — Review & Design Concept
**Routes:** `/evals`, `/evals/[id]`, `/evals/cases`  **Primary persona:** P4 — The Developer  **Secondary:** P2 — The Power User  **Current state:** Feature-rich but structurally chaotic — the list pages are invisible on mobile, the detail page hides its own content behind collapsed-by-default cards, and the run matrix buries the #1 job (compare scores) under repeated icon-button clutter and RBAC leaks.

---

## 1. Current state

The area consists of three surfaces: an eval-set list (`/evals`), a global test-case library (`/evals/cases`), and an eval-set editor (`/evals/[id]`) that inlines three concerns on one page — set metadata, test-case membership, and a run matrix with embedded queue management.

Source files:

| File | Role |
|---|---|
| `app/(application)/evals/page.tsx` | Eval sets list page |
| `app/(application)/evals/components/{data-table,columns,data-table-row-actions,data-table-column-header,data-table-view-options,create-eval-set-modal}.tsx` | List table + create dialog |
| `app/(application)/evals/cases/page.tsx` | Test case library page |
| `app/(application)/evals/cases/components/{data-table,columns,data-table-row-actions,data-table-column-header,data-table-view-options,test-case-modal}.tsx` | Case table + create/edit modal |
| `app/(application)/evals/[id]/page.tsx` | Eval set editor |
| `app/(application)/evals/[id]/components/test-case-selection-modal.tsx` | "Add existing case" picker |
| `app/(application)/evals/[id]/runs/eval-runs.tsx` | Runs section wrapper |
| `app/(application)/evals/[id]/runs/components/{eval-runs-table,eval-run-column,create-eval-run-modal,queue-management}.tsx` | Run matrix, run config dialog, queue admin |

**RBAC model (intended — not uniformly enforced):** page access requires `user.super_admin || user.role?.evals === "read" || user.role?.evals === "write"`; mutating actions are *supposed* to require `super_admin || role.evals === "write"`. The sidebar nav item is gated the same way (`components/custom/main-nav.tsx:153-159`). Enforcement leaks in two places: the run matrix receives `canWrite` but discards it (`eval-runs-table.tsx:47`), and `queue-management.tsx` contains **no RBAC checks at all** (grep for `canWrite`/`super_admin`/`role` returns nothing) — both detailed in the UX review and fixed in the design (ladder #26).

### Functionality inventory

*The contract: every item below must appear in the disclosure ladder in section 3. Nothing may be dropped.*

**A. `/evals` — Eval sets list**

1. **RBAC page gate** — no access → destructive Alert "You don't have permission… Contact your administrator" (`evals/page.tsx:17-30`).
2. **Workers-disabled warning** — destructive Alert when `config.workers.enabled` is false or `redisHost` missing: sets viewable, runs not executable (`evals/page.tsx:43-51`).
3. **Page header** — "Eval Sets" title + one-line description (`evals/page.tsx:36-39`).
4. **Eval sets table** — columns: Name (truncated 500px, medium weight), Description (truncated 300px, "—" fallback), Updated (relative, `formatDistanceToNow`), row-actions column (`evals/components/columns.tsx:10-62`).
5. **Server-side name filter** — "Filter by name…" input, `contains` filter, refetch on change (`evals/components/data-table.tsx:71-80, 107-109, 115-122`).
6. **Per-column sort/hide menu** — asc/desc/hide dropdown on sortable headers (client-side over current page) (`evals/components/data-table-column-header.tsx:36-71`).
7. **Column visibility "View" dropdown** — toggle columns; hidden below `lg` (`evals/components/data-table-view-options.tsx:23-58`).
8. **"Test cases" button** — secondary button navigating to `/evals/cases` (`evals/components/data-table.tsx:127-135`).
9. **"New Eval Set" dialog** — primary button → Dialog with Name (required) + Description (textarea), Cancel/Create, spinner while saving, fields reset and list refetch on success (`evals/components/create-eval-set-modal.tsx:48-118`).
10. **Row click navigation** — entire row navigates to `/evals/[id]` (`evals/components/data-table.tsx:177-186`).
11. **Row actions dropdown** — Edit → `/evals/[id]`; View Runs → `/evals/[id]` (same destination); Delete (write-only) behind AlertDialog confirm naming the set; delete triggers `window.location.reload()` (`evals/components/data-table-row-actions.tsx:88-145`).
12. **Pagination** — "Page X of Y (Z total)", first/prev/next/last buttons (first/last hidden below `lg`), fixed page size 10 (`evals/components/data-table.tsx:211-259`).
13. **Polling + loading + empty states** — 30 s `pollInterval`, skeleton rows while loading, "No eval sets found." empty row (`evals/components/data-table.tsx:79, 166-206`).

**B. `/evals/cases` — Test case library**

14. **RBAC page gate** — identical pattern (`cases/page.tsx:25-38`).
15. **Back button + header** — ghost arrow button to `/evals`, "Test Cases" title + description (`cases/page.tsx:44-57`).
16. **Test cases table** — columns: Name (400px truncate), Description (500px truncate), Messages count badge (`{n} messages`), Updated (relative), actions. Columns for expected tools / knowledge sources / agent tools exist but are commented out (`cases/components/columns.tsx:11-125`, commented block 57-101).
17. **Name filter, view options, pagination, polling** — server-side `contains` filter wired through the tanstack column filter (`cases/components/data-table.tsx:140-147`), page size 10, 30 s poll, skeletons, "No test cases found." empty row (`cases/components/data-table.tsx:87-96, 164-305`).
18. **"New Test Case" button** — primary, opens TestCaseModal in create mode (`cases/components/data-table.tsx:179-188`).
19. **Row click → edit** — opens TestCaseModal pre-filled (`cases/components/data-table.tsx:222-241, 149-157`).
20. **Row actions dropdown** — Edit; Delete (write-only) with confirm; delete calls `window.location.reload()` (`cases/components/data-table-row-actions.tsx:48-73, 117-137`). (A second, never-invoked `DELETE_TEST_CASE` mutation lives in `cases/components/data-table.tsx:98-113` — dead code.)
21. **TestCaseModal — Basic Info tab** — Name (required), Description, Expected Output (required; helper text "exact expected response or a description") (`cases/components/test-case-modal.tsx:354-394`).
22. **TestCaseModal — Conversation tab** — ordered conversation builder: messages rendered through `Conversation`/`MessageRenderer` with per-message edit/remove (`showEdit`, `showRemove`, `onUpdate`), empty state, "Add User Message" textarea (Enter adds, Shift+Enter newline), and an auto-inserted assistant *placeholder* message after every user message ("generated agent response will be added here…", created after a deliberate 1 s `setTimeout` to avoid id collisions) (`cases/components/test-case-modal.tsx:186-228, 396-530`).
23. **File attachments on messages** — UppyDashboard picker (limit 10; whitelist: png/jpg/jpeg/gif/webp, pdf/docx/xlsx/xls/csv/pptx/ppt, mp3/wav/m4a/mp4/mpeg), selected-file preview grid with remove, S3 presigned-URL conversion to `FileUIPart`, amber warning that the agent must support the attached file types (`cases/components/test-case-modal.tsx:118-150, 471-522`).
24. **Expected tools / knowledge sources / agent tools** — fields are loaded from an existing case, kept in state, and submitted on save (`test-case-modal.tsx:90-98, 283-285`); the editor UI (third tab with three select+add pickers fed by `GET_TOOLS`, split into function/agent/context types at `test-case-modal.tsx:59-67`) exists but is commented out (`test-case-modal.tsx:347-350, 532-713`). The data path is live; the editing surface is not.
25. **Modal validation + modes** — name, expected output, and ≥1 input message required (toast on violation, submit disabled until valid); create vs. update mode; when opened from a set editor, `eval_set_id` is attached so new cases join the set (`test-case-modal.tsx:267-303, 717-734`); modal title appends the raw eval-set id when present (`test-case-modal.tsx:330`).

**C. `/evals/[id]` — Eval set editor**

26. **RBAC gates** — read for page, write for Save / add / remove / create (`[id]/page.tsx:44-45`).
27. **Loading skeletons + hero header** — gradient/blur "hero" header card with back button, "Edit Eval Set" title, inline description, and Save Changes button (write-only, spinner) (`[id]/page.tsx:189-234`).
28. **Save set metadata** — validates name required and ≤500 test cases; updates name/description with success/error toasts (`[id]/page.tsx:85-113`).
29. **"Basic information" collapsible card** — Name + Description inputs, disabled for read-only users; *collapsed by default* (Radix Collapsible without `defaultOpen`) (`[id]/page.tsx:237-286`).
30. **"Test cases" collapsible card** — `{n}/500` count badge, "Create New" button (→ TestCaseModal bound to this set), "Add Existing" button (→ selection modal, with a disabled-at-500 check), both write-only; collapsed by default (`[id]/page.tsx:288-337`).
31. **Test case rows** — icon chip, name, description; Edit and Remove buttons revealed only on hover (`opacity-0 group-hover:opacity-100`), write-only; "No test cases yet" empty state (`[id]/page.tsx:340-397`).
32. **Remove case from set** — confirm dialog clarifying the case is not deleted and can be re-added; sets `eval_set_id: null` (`[id]/page.tsx:115-136, 427-441`).
33. **Add Existing modal** — search by name; lists only cases with `eval_set_id: null` (limit 100); select-all with selected count; per-row checkbox + label; "Add N Test Case(s)" submit; destructive Alert explaining the one-set-per-case constraint; resets on close (`[id]/components/test-case-selection-modal.tsx:40-167`).
34. **Bulk add execution** — per-case `UPDATE_TEST_CASE` mutations with a 500-cap check and dedupe (`[id]/page.tsx:148-174`).

**D. Eval runs section (rendered inside `/evals/[id]`)**

35. **Workers-disabled warning (again)** — destructive Alert: existing runs viewable, new runs blocked (`[id]/runs/eval-runs.tsx:96-104`).
36. **"Evaluation runs" card + "New Eval Run"** — button shown only for write users *and* when workers are configured (`eval-runs.tsx:109-131`).
37. **Runs query** — limit 100, 10 s poll; skeletons; "No eval runs yet…" empty message (`eval-runs.tsx:57-65, 134-143`).
38. **Run matrix** — sticky left column listing test cases (name + id; click opens the case in TestCaseModal for view/edit); one column per run, sorted oldest→newest; only the last 3 shown initially; a "load more" chevron column reveals +5 at a time with striped placeholder cells (`eval-runs-table.tsx:116-131, 196-279`). When the set has zero test cases the entire matrix is replaced by a blocking centered message "No test cases in this eval set." (`eval-runs-table.tsx:188-194`) — even when runs exist.
39. **Run column header** — run name, created timestamp (`MMM d, yyyy · HH:mm`), agent name resolved via `GET_AGENTS_BY_IDS` (falls back to raw id) (`eval-runs-table.tsx:73-80, 249-266`).
40. **Per-run actions row** — five outline icon buttons with tooltips per column: refetch job results, copy run, edit run, start run, delete run (`eval-run-column.tsx:98-196`).
41. **"Average Result" pinned row** — mean of fetched job results per run, color-coded against `pass_threshold` (green ≥ T, orange ≥ T−20, red below), "No results available." fallback (`eval-run-column.tsx:94-95, 198-215`).
42. **Score cells** — one per case×run; job results fetched per column (`GET_JOB_RESULTS`, limit 500, label-matched on run id + case id); completed → score (1 decimal) colored vs. threshold, clickable; non-completed → status icon + label for waiting/active(spinner)/failed/delayed/paused/stuck; case not in run → "—" on muted striped cell; no result yet → "Not started" (`eval-run-column.tsx:25-43, 55-93, 216-276`).
43. **Start run** — confirm dialog stating how many cases will be scheduled; `RUN_EVAL`; toast with scheduled count (`eval-runs-table.tsx:144-147, 489-506`; also `eval-runs.tsx:34-48`).
44. **Copy run** — opens the run dialog pre-filled with id stripped and name suffixed " (Copy)" (`eval-runs-table.tsx:138-142`).
45. **Edit run** — same dialog in edit mode → `UPDATE_EVAL_RUN` (`eval-runs-table.tsx:133-136`; `create-eval-run-modal.tsx:133-151`).
46. **Delete run** — confirm dialog warning that the run *and all results* are permanently deleted, plus an inline Alert that already-scheduled queue jobs are NOT removed ("check the queue below"); `DELETE_EVAL_RUN_BY_ID` (`eval-runs-table.tsx:99-114, 508-531`).
47. **Create/Edit Eval Run dialog** — fields: Name; Agent select (first 100 agents); Eval Functions multi-select with Select All/Deselect All and per-function config textareas (schema from `GET_EVAL_FUNCTIONS`: `config[].name/description`, editors appear only when the function is selected); Test Cases multi-select (cases of this set) with Select All; Scoring method (median/average/sum); Pass threshold (0–100); Timeout in seconds. Defaults: average / 70 / 300. `rights_mode` (default `"private"`) and `RBAC.users/roles` are carried through on submit though no UI edits them. Validation toasts for missing name/agent/≥1 case/≥1 function; submit disabled until valid (`create-eval-run-modal.tsx:54-89, 155-255, 257-528`).
48. **Result detail sheet — Overview tab** — opens on completed-cell click: Score card (1 decimal), Duration card (`formatDuration`), Status badge with state icon, Job ID (mono), Error Details card with JSON `CodePreview` when an error object exists, Token Usage card (total / input / output) (`eval-runs-table.tsx:122-127, 281-390`).
49. **Result detail sheet — Messages tab** — full conversation transcript via `Conversation` + `MessageRenderer`, read-only (`eval-runs-table.tsx:392-415`).
50. **Result detail sheet — Functions tab** — per eval function: name, function id (mono), numeric result (2 decimals), config key/value listing; empty state when none (`eval-runs-table.tsx:417-453`).
51. **Result detail sheet — Raw Data tab** — full result metadata as JSON in `CodePreview` (`eval-runs-table.tsx:455-469`).

**E. Queue management (inside `/evals/[id]`, shown when workers enabled and ≥1 run exists)**

52. **"Queue management" collapsible card** — collapsed by default, wraps the generic `QueueManagement` component for queue `eval_runs` with an eval-specific job-name generator and retry handler that re-schedules via `RUN_EVAL` with the job's `eval_run_id` + `test_case_id` (`eval-runs.tsx:157-210`).
53. **Queue stats strip** — status badge (Paused / Maxed / Active), max queue concurrency, max worker concurrency, job timeout, rate limit; queue polled every 5 s (`queue-management.tsx:69-72, 330-373`).
54. **Job-status tabs with live counts** — Active / Waiting / Failed / Stuck / Completed, each with a count badge; footnote "Only last 5.000 succesfull and failed jobs are kept." (`queue-management.tsx:374-410`).
55. **Pause / Resume queue** — single toggle button, each direction behind its own confirm dialog (`queue-management.tsx:306-315, 765-801`).
56. **Drain queue** — removes waiting + delayed jobs; destructive confirm dialog spelling out exactly what is and isn't removed (`queue-management.tsx:317-325, 803-824`).
57. **Jobs table** — select-all checkbox (active jobs excluded from selection), per-row checkbox, Name (via name generator), ID (click-to-copy with tooltip + toast), Attempts, Created, Processed On, Finished On, Inputs preview (`TextPreview`, 50 chars), Outputs or failure reason preview (red for failures), per-row Delete (non-active jobs), per-row Retry (failed jobs) (`queue-management.tsx:481-602`); "No jobs in queue" centered empty text when the active tab has no jobs (`queue-management.tsx:476-479`).
58. **Bulk retry / bulk delete** — appear when jobs are selected; both confirm-gated; retry dialog offers a "Delete the original job(s) after retrying" checkbox; deletes run in parallel with success/error toasts (`queue-management.tsx:153-165, 444-465, 658-763`).
59. **Jobs pagination + refresh affordances** — page-size select (20/50/100/200), first/prev/next pager, total count, persistent "Auto Refresh" badge with spinner (5 s poll) (`queue-management.tsx:422-443, 466-469, 605-652`).

### UX review

**High severity**

- **Both list pages are deliberately hidden on mobile.** Root containers use `hidden … md:flex` — below 768 px the pages render *nothing at all* (`evals/page.tsx:33`, `cases/page.tsx:42`). Violates philosophy §7 and anti-pattern 9.
- **The detail page hides its own content.** "Basic information" and "Test cases" cards are Radix Collapsibles without `defaultOpen` (`[id]/page.tsx:238, 290`) — on arrival the page shows three closed headers and a Save button that saves *invisible* fields. A user can edit nothing without first discovering two chevron toggles.
- **RBAC leak in the run matrix.** `EvalRunsTable` receives `canWrite` but destructures it away (`eval-runs-table.tsx:47`), so read-only users still see Edit / Start / Delete / Copy buttons on every run column (`eval-run-column.tsx:128-193`). Mutations will fail server-side, but the UI offers foot-guns to users who shouldn't see them.
- **RBAC leak in queue management — bigger foot-gun than the matrix.** `QueueManagement` performs zero permission checks (no `canWrite`/`super_admin`/`role` anywhere in the file) and `eval-runs.tsx:158` renders it for any user with read access. Pause/Resume (`queue-management.tsx:306-315`), Drain (`:317-325`), bulk retry/delete (`:444-465`), and per-row delete/retry (`:578-597`) are all visible and clickable for read-only users — and these are queue-level operations (drain removes every waiting job), not single-row edits. Any redesign that reuses the component as-is re-ships this leak.
- **Five icon buttons per run column.** With 3 visible runs that is 15 outline buttons floating in the matrix header band (`eval-run-column.tsx:98-196`) — the noisiest region of the screen is pure chrome. Violates "calm surfaces" and anti-pattern 2 (primary actions deserve text).
- **Full page reloads after delete.** Eval-set and test-case deletion call `window.location.reload()` (`evals/components/data-table-row-actions.tsx:55`, `cases/components/data-table-row-actions.tsx:56`) instead of refetching — jarring, slow, loses scroll/filter state. Violates "Performance is a feature".
- **Average-score math is wrong.** The pinned average includes non-completed results and sums possibly-undefined `jr.result` (`eval-run-column.tsx:94-95`) → `NaN` contamination when any job failed or is pending; only the zero-results case is guarded.
- **Silent failure on eval-set creation.** `onError` only `console.log`s (`create-eval-set-modal.tsx:42-45`) — the dialog just sits there. Violates "Trust through transparency".
- **Hover-only actions.** Test-case Edit/Remove use `opacity-0 group-hover:opacity-100` (`[id]/page.tsx:371`) — invisible to keyboard users (no `focus-within` handling) and nonexistent on touch.
- **Duplicate row actions.** "Edit" and "View Runs" in the set row menu navigate to the identical URL (`evals/components/data-table-row-actions.tsx:89-106`) — two labels, one destination.

**Medium severity**

- **Broken dynamic Tailwind class.** `` className={`flex grid-cols-${3 + …}`} `` (`eval-runs-table.tsx:198`) — `grid-cols-*` is never generated by Tailwind at runtime and is meaningless on a flex container anyway.
- **Stale edit state on the set editor.** Clicking Edit sets `editingTestCase` (`[id]/page.tsx:376`) but the modal's `onClose` only clears `showCreateModal` (`:416`) — `editingTestCase` is never reset, so clicking "Create New" after editing reopens the *previous case in edit mode* instead of a blank create form.
- **Matrix case modal never refetches.** The TestCaseModal opened from the matrix's sticky column has an `onSuccess` containing only the comment "// Refetch to get the new test case in the list" with no actual call (`eval-runs-table.tsx:537-540`) — edits don't appear until the next 10 s poll.
- **Query errors render nothing.** Both list pages destructure `error` from `useQuery` and never use it (`evals/components/data-table.tsx:71`, `cases/components/data-table.tsx:87`) — a failed fetch leaves a silent empty table, indistinguishable from "no data". Violates philosophy §8 (errors must state what happened and what to do next).
- **Dead state drives live UI.** `testCases` state on the editor is never populated (`[id]/page.tsx:37`), so `excludeIds={testCases}` is always `[]` (`:411`), the "Add Existing" 500-cap disable never triggers (`:322`), and the Save-time `testCases.length > 500` check (`:95`) can never fire.
- **Hardcoded palette colors break theming.** Status badges and tabs use `bg-blue-100 text-blue-800`-style literals (`queue-management.tsx:264-279, 377-407`; `eval-run-column.tsx:35-43`) instead of semantic tokens — unreadable in dark mode and off-system. CLAUDE.md mandates the CSS-variable color system.
- **N+1 result fetching.** Each visible run column independently queries `GET_JOB_RESULTS` with limit 500 (`eval-run-column.tsx:55-62`); loading more runs multiplies queries; console.log inside `getCellColor` fires per cell per render (`:77`).
- **Sequential unbatched bulk add.** Adding N existing cases fires N separate mutations in a loop with no progress feedback or partial-failure handling, then a single refetch races them (`[id]/page.tsx:163-172`).
- **Selection modal silently caps at 100 unassigned cases** with no pagination or "more exist" hint (`test-case-selection-modal.tsx:43`).
- **1-second artificial delay** when adding a conversation message (`test-case-modal.tsx:209-210`) — perceptible lag engineered as an id-collision workaround.
- **No i18n.** Every string in the area is hardcoded English while the shell translates its nav label (`main-nav.tsx:155`); app supports en/de.
- **Misleading message count.** The "Messages" badge counts user + auto-inserted placeholder messages together (`cases/columns.tsx:44-56`) — a 2-turn case shows "4 messages".
- **Misleading sort affordance.** Column sort menus sort client-side over the current 10-row page only (`evals/components/data-table.tsx:85-105`) while filtering is server-side — sorting "Name asc" reorders 10 of 200 rows.
- **Raw UUID in dialog title.** "Create Test Case for Eval Set: 3f9c…" (`test-case-modal.tsx:330`).
- **Header invention.** The detail page builds a one-off gradient/blur hero card (`[id]/page.tsx:203-205`) instead of the standard header; "purple confetti" icon chips (`bg-primary/10` + primary icon) decorate every card header (`[id]/page.tsx:242, 294`; `eval-runs.tsx:113-115, 164-166`) — violates philosophy §4/§5 and anti-pattern 5.
- **Two different workers-warning texts** for the same condition on `/evals` vs. inside the runs section (`evals/page.tsx:46-49` vs. `eval-runs.tsx:99-102`); both use `variant="destructive"` for what is a configuration notice, diluting red's meaning.

**Low severity**

- Empty states are bare table rows / centered text, three different styles across the area (`evals/components/data-table.tsx:198-205`, `[id]/page.tsx:340-349`, `eval-runs.tsx:140-143`) — no shared EmptyState.
- Console noise shipped to production (`create-eval-set-modal.tsx:28`, `eval-runs-table.tsx:60`, `test-case-modal.tsx:61, 235-263`, `queue-management.tsx:627-630`).
- Pagination renders four buttons + "Page 1 of 1" even for a single page (`evals/components/data-table.tsx:211-259`).
- Matrix alignment relies on hand-balanced fixed heights (`h-[120px]` header vs. two stacked `h-[60px]` rows, `eval-runs-table.tsx:202, 252`) — fragile to text wrap.
- Typo in user-facing copy: "Only last 5.000 succesfull and failed jobs are kept." (`queue-management.tsx:409`); stray comment typo "Test sases" (`[id]/page.tsx:288`).
- Title mismatch: nav says "Evals", page says "Eval Sets", route is `/evals`.

### Mobile audit (390 px)

- **`/evals` and `/evals/cases`: completely blank.** `hidden h-full flex-1 flex-col … md:flex` removes the entire page below 768 px (`evals/page.tsx:33`, `cases/page.tsx:42`). The RBAC-denied alert *does* render on mobile (no `hidden`), so a denied user sees an error while an authorized user sees nothing.
- **`/evals/[id]` renders but degrades badly:**
  - `p-8` shell (`[id]/page.tsx:201`) burns 64 px of a 390 px viewport; no `sm:` step-down anywhere in the area.
  - Hero header puts title and description side by side in a non-wrapping flex (`[id]/page.tsx:214-219`); Save button competes for the same row → overflow.
  - The run matrix: sticky left column `min-w-[200px]` (`eval-runs-table.tsx:200`) plus per-run columns with fixed-height cells inside `overflow-x-auto` (`:198`) — endless horizontal scrolling with a 5-button action row per column; tooltips (hover-only) never fire on touch.
  - Test-case row actions are hover-revealed (`[id]/page.tsx:371`) — *unreachable* on touch.
  - The queue jobs table has 10 columns with no responsive variants (`queue-management.tsx:481-504`) → page-wide horizontal scroll; the stats strip is a non-wrapping `flex items-center gap-8` (`queue-management.tsx:334`) that overflows.
  - Dialogs (`max-w-4xl h-[90vh]`, `create-eval-run-modal.tsx:259`; `max-w-4xl max-h-[90vh]`, `test-case-modal.tsx:328`) technically fit but stack dense two-column grids (`grid-cols-2`, `create-eval-run-modal.tsx:467`) without collapse.
- **Verdict: broken.** The P4 mobile job ("check an eval run's status") is impossible: the entry route renders nothing on a phone.

---

## 2. Jobs to be done

**P4 — Developer (PRIMARY).** #1 job in one sentence: *"Run my eval suite against an agent and see at a glance whether scores regressed compared to previous runs."*

Ranked jobs on these pages:
1. **Check results / compare runs** — open the set, scan the matrix, spot red cells and average drops (most frequent; after every agent/prompt/model change, plus CI-adjacent monitoring).
2. **Start a run** — re-execute an existing run config, or copy one against a different agent.
3. **Debug a failing case** — open a cell, read the transcript, the per-function scores, the error, the raw payload.
4. **Define/modify run configs** — agent, eval functions + configs, scoring method, threshold, timeout.
5. **Curate test cases** — create/edit cases, attach files, assemble sets.
6. **Unstick the machinery** — retry failed jobs, drain/pause the queue (rare, reactive).

**P2 — Power User (SECONDARY).** Validates their agents after prompt/knowledge changes: run an existing suite (job 2), read results (job 1), occasionally add a test case capturing a real-world failure (job 5). They should never need the queue internals; those stay one level deeper.

**P3 — Admin** touches this area only via the workers/Redis configuration warning (resolution lives in `/configuration`, not here).

**Mobile job (per personas.md):** P4 — "check an eval run's status"; read-only glance, copy an id at most.

**Ownership matrix check:** `design/personas.md:173` lists Evals as P4 primary / P2 secondary. **Confirmed correct** — the code's center of gravity (scoring thresholds, raw JSON tabs, queue management, mono ids) is developer-shaped, and run configuration assumes familiarity with eval functions. No correction needed.

---

## 3. Design concept

### Default view (L1)

**`/evals` — the suite list.** Standard list page on the shared bones:

- **PageHeader**: title "Evals" (`text-2xl`), purpose line "Test agents against expected behavior and track scores across runs." (`text-base text-muted-foreground`), primary action **"New eval set"** (default Button, the only purple element) on the right.
- **Toolbar** directly beneath: search input (server-side name filter, debounced), and on the right a quiet link-style button "Test case library" (→ `/evals/cases`) plus the column-visibility menu behind a single overflow icon.
- **Workers notice** (when applicable): a single, calm **warning** (orange, not destructive) banner under the toolbar: "Background workers are not configured — eval sets are viewable but runs can't execute." with a "Configuration →" link for admins. One copy of this text, reused everywhere (inventory #2/#35 unified in placement, both preserved).
- **The table** (ListDetail, list side): columns **Name**, **Cases** (count), **Last run** (status dot + average score + relative time), **Updated**. Row click → detail. Row overflow menu (⋯): **Open**, **Delete** (write-only, red, ConfirmDialog). The redundant "View Runs" entry merges into "Open" since both targeted the same URL (#11 — capability preserved, duplicate label removed).
- **Data strategy for the Cases and Last-run columns (binding):** these columns require new data — `GET_EVAL_SETS` returns only id/name/description/timestamps (`queries/queries.ts:2101-2107, 2195-2213`); run status/scores live in `GET_EVAL_RUNS` + `GET_JOB_RESULTS` and case counts in `GET_TEST_CASES`, all fetched only on the detail page today. The strategy is to **extend `GET_EVAL_SETS` server-side** with a lightweight per-set aggregate (`test_case_count`; `last_run { status, avg_score, finishedAt }`). There is deliberately **no client-side fallback**: fanning out per-row queries from the list would recreate exactly the N+1 pattern the Risks section condemns. Until the aggregate ships, the list renders Name / Description / Updated as today — the two new columns are additive and gated on the backend change.
- **EmptyState** (shared primitive): BookCheck icon, "Create your first eval set to start testing agents.", primary "New eval set" button.
- Pagination: shared compact pager, hidden when only one page.

**`/evals/[id]` — the set detail, restructured around job #1.** The page becomes a **results-first** surface:

- **PageHeader**: back chevron, set name as title with description beneath it (truncated, full text in the Details dialog), primary action **"Run eval"** (purple; opens the start-run flow — if exactly one run config exists it confirms that one, otherwise a small menu of run configs + "New run config…"). Secondary header actions in one overflow menu: "Edit details" (name/description dialog, #28/#29), "New run config" (#47).
- **Workers gating of run actions (same rule as today, `eval-runs.tsx:124-129`):** "Run eval" and every "New run config" entry (header menu, runs EmptyState CTA) render **only when** `canWrite` **and** `config.workers.enabled && config.workers.redisHost`. When workers are unconfigured they are *hidden, not disabled* — the warning banner is the single explanation, and its "Configuration →" link is the path to resolution; a disabled button would duplicate the banner's message. The runs EmptyState likewise drops its action button (and the "create a run config" sentence) for readers or when workers are off, mirroring the conditional copy at `eval-runs.tsx:142`.
- **Two tabs** under the header (the only L2 navigation): **Results** (default) and **Test cases**.
- **Results tab = the run matrix**, decluttered: sticky case column; per-run columns showing name, agent, date; the pinned average row; score cells exactly as today (colors vs. threshold). The five per-column icon buttons collapse into **one ⋯ menu per run column** (Start, Copy, Edit, Refresh results, Delete — Delete styled destructive, all write-gated properly this time). The matrix is the hero; nothing else competes.
- **Zero-cases condition on the Results tab:** when the set has no test cases (the blocking "No test cases in this eval set." at `eval-runs-table.tsx:188-194` today), the tab shows the shared EmptyState — "No test cases in this set yet — add cases before running evals." with a **"Go to test cases"** action that switches to the Test cases tab. "Run eval" in the header is disabled with a tooltip ("Add test cases first") in this state — unlike the workers gate this is user-resolvable one tab away, so a disabled-with-reason control beats hiding.
- **Queue status chip**: when workers are enabled and jobs exist, a quiet inline status line above the matrix — "Queue: 2 active · 1 failed" with the failed count in red — clicking it opens the Queue panel (L3). Failure visibility stays at L2 per philosophy §2 ("nothing critical to trust below L2"); the management *controls* live deeper. The chip and the panel's **read** surfaces (stats, status tabs, jobs table, pager) are available to readers; **every mutating control — Pause/Resume, Drain, bulk retry/delete, per-row retry/delete, and the selection checkboxes that feed bulk actions — renders only with write permission**, fixing the second RBAC leak (`queue-management.tsx` currently checks nothing).

The collapsed-cards problem disappears: name/description editing moves to a deliberate L3 dialog (it's a rare action), and test cases get their own tab instead of a collapsible.

### Disclosure ladder

| # | Capability | Level | Physical location |
|---|---|---|---|
| 1 | RBAC page gate (read access) | L0 | Nav item hidden without `evals` permission; direct-URL hit shows shared AccessDenied state |
| 2 | Workers-disabled warning | L1 | Single warning banner under the Toolbar on `/evals` and under the PageHeader on `/evals/[id]` |
| 3 | Page header (title + purpose) | L1 | PageHeader on `/evals` |
| 4 | Eval sets table (name/description/updated) | L1 | `/evals` table; Description column off by default, available via column menu; Cases + Last-run columns added only once the `GET_EVAL_SETS` server aggregate ships (binding data strategy above — no client fan-out) |
| 5 | Name search filter | L1 | Toolbar search input |
| 6 | Per-column sort/hide | L2 | Column header click cycles sort; hide via column-visibility menu |
| 7 | Column visibility toggle | L2 | Toolbar overflow (⋯) → "Columns" |
| 8 | Navigate to test case library | L1 | "Test case library" link button in `/evals` Toolbar |
| 9 | Create eval set (name+description dialog) | L1→L3 | Primary "New eval set" button in PageHeader; form itself is the dialog (L3 surface, one click away) |
| 10 | Row click → set detail | L1 | Table row on `/evals` |
| 11 | Row actions: open / delete (confirm) | L2/L3 | Row ⋯ menu; Delete behind ConfirmDialog ("Edit"/"View Runs" merged into "Open" — same destination preserved) |
| 12 | Eval sets pagination | L1 | Compact pager under table (auto-hidden at one page) |
| 13 | Polling, skeletons, empty state | L1 | Table skeleton mirrors layout; shared EmptyState; 30 s poll retained; query failures render an inline error state (Alert: what happened + Retry) in the table body — today `error` is destructured and silently dropped |
| 14 | RBAC gate on `/evals/cases` | L0 | Same AccessDenied state |
| 15 | Back navigation + library header | L1 | PageHeader with breadcrumb "Evals / Test cases" on `/evals/cases` |
| 16 | Case table (name/description/messages/updated) | L1 | `/evals/cases` table; Messages badge counts *user* messages only |
| 17 | Case search/columns/pagination/polling | L1/L2 | Toolbar search (L1); columns + sort (L2 as #6/#7); query-error state as #13 |
| 18 | Create test case | L1→L3 | Primary "New test case" button → TestCaseModal |
| 19 | Row click → edit case | L2 | Row click opens TestCaseModal in edit mode |
| 20 | Case row actions: edit / delete | L2/L3 | Row ⋯ menu; Delete behind ConfirmDialog; refetch instead of reload |
| 21 | Case basics (name/description/expected output) | L3 | TestCaseModal "Details" tab |
| 22 | Conversation builder (add/edit/remove messages, placeholder responses) | L3 | TestCaseModal "Conversation" tab (default tab — it's the core of a case) |
| 23 | File attachments (Uppy, type whitelist, previews, agent-support warning) | L3 | Attach button inside the conversation composer; warning appears contextually when files attached |
| 24 | Expected tools / knowledge sources / agent tools | L3 | "Advanced expectations" collapsed section at the bottom of the Details tab — reinstates the disabled picker UI; field passthrough on save preserved regardless |
| 25 | Case validation + create/edit modes + set association | L3 | TestCaseModal; dialog title shows the *set name*, not its UUID |
| 26 | Detail-page RBAC (read vs. write) | L0–L3 | Write-only controls (Run eval, ⋯ menus, add/remove) rendered only with write permission — including run-column actions **and all queue mutations in #55–#58** (fixes both leaks: the matrix discarding `canWrite` at `eval-runs-table.tsx:47` and `queue-management.tsx` checking nothing at all). Readers keep full read access to the matrix, result sheets, and the Queue panel's stats/tabs/jobs views |
| 27 | Set detail header | L1 | Standard PageHeader (hero card removed; capability = navigation + identity + save, all preserved) |
| 28 | Save set name/description | L3 | "Edit details" dialog from header ⋯ menu; explicit Save in dialog footer |
| 29 | Name/description fields (read-only for readers) | L3 | Same dialog; inputs disabled without write |
| 30 | Case membership management (count, create new, add existing) | L2 | "Test cases" tab: count in tab label ("Test cases · 12"), "New case" + "Add existing" buttons in the tab's toolbar; 500-cap enforced against the *fetched* list |
| 31 | Case list with edit/remove | L2 | Rows in the Test cases tab; actions always visible as quiet ghost icon buttons (with tooltips + aria-labels), not hover-only |
| 32 | Remove case from set (confirm, non-destructive copy) | L3 | ConfirmDialog from row action |
| 33 | Add-existing picker (search, unassigned-only, select-all, constraint note) | L3 | Dialog from Test cases tab; constraint note as muted info text, not destructive alert |
| 34 | Bulk add (dedupe, cap) | L3 | Same dialog; mutations batched with progress + single result toast |
| 35 | Workers warning on detail page | L1 | Same single banner component as #2 |
| 36 | New run config | L2→L3 | "New run config" in header ⋯ menu and as EmptyState action when no runs exist → run dialog; rendered only with write permission **and** workers configured (hidden otherwise — gating rule in §3) |
| 37 | Runs polling/loading/empty | L1 | Results tab; skeleton mirrors matrix; EmptyState "No runs yet — create a run config to start evaluating." (action + sentence only for write users with workers configured, mirroring `eval-runs.tsx:142`); when the set has zero cases the tab instead shows the "Go to test cases" EmptyState (§3) replacing today's bare "No test cases in this eval set." text |
| 38 | Run matrix (sticky cases, last-3 runs, load-more) | L1 | Results tab default; "Show older runs" text button replaces the bare chevron column |
| 39 | Run column header (name/date/agent) | L1 | Matrix column header |
| 40 | Per-run actions (refresh/copy/edit/start/delete) | L2 | Single ⋯ DropdownMenu per run column header (replaces 5 icon buttons); Start also reachable via header "Run eval" |
| 41 | Average row with threshold colors | L1 | Pinned first matrix row; computed from *completed* results only |
| 42 | Score cells with status states | L1 | Matrix cells, unchanged semantics; semantic color tokens |
| 43 | Start run (confirm, scheduled count) | L3 | ConfirmDialog from "Run eval" / run ⋯ menu |
| 44 | Copy run | L2→L3 | Run ⋯ menu → run dialog prefilled "(Copy)" |
| 45 | Edit run | L2→L3 | Run ⋯ menu → run dialog in edit mode |
| 46 | Delete run (confirm + queue-jobs caveat) | L3 | ConfirmDialog with the scheduled-jobs Alert preserved, linking "open queue" |
| 47 | Run config dialog (name, agent, functions+config, cases, scoring, threshold, timeout; rights_mode/RBAC passthrough) | L3 | Dialog; "Scoring" group (method/threshold/timeout) presented as an "Advanced" collapsed section with the defaults summarized ("average · pass ≥ 70 · 300 s") since defaults serve most runs; all fields retained |
| 48 | Result Overview (score, duration, status, job id, error, tokens) | L2 | Side Sheet, "Overview" tab (default) — costs/errors at L2 per philosophy §8 |
| 49 | Result transcript | L2 | Sheet "Messages" tab |
| 50 | Per-function results + configs | L2 | Sheet "Functions" tab |
| 51 | Raw metadata JSON | L4 | Sheet "Raw" tab (mono, CodePreview, copy button) |
| 52 | Queue management entry | L2→L3 | Queue status chip above matrix (L2 visibility) → opens Queue panel (Sheet on desktop) at L3 |
| 53 | Queue stats (status, concurrency, timeout, rate limit) | L3 | Top of Queue panel as definition list |
| 54 | Job-status tabs with counts + retention note | L3 | Tabs inside Queue panel |
| 55 | Pause/Resume queue (confirms) | L3 | Buttons in Queue panel header, **write-only** (hidden for readers); ConfirmDialogs |
| 56 | Drain queue (destructive confirm) | L3 | Queue panel header ⋯ menu, **write-only**; destructive ConfirmDialog |
| 57 | Jobs table (selection, copy id, timestamps, attempts, I/O previews, per-row delete/retry) | L3 | Queue panel body; full row payloads (inputs/outputs JSON) expandable per row (L4); selection checkboxes and per-row delete/retry **write-only** — readers get a read-only table; shared EmptyState replaces the bare "No jobs in queue" text |
| 58 | Bulk retry/delete + delete-original option | L3 | Selection action bar in Queue panel, **write-only** (selection itself is write-only per #57); confirm dialogs preserved verbatim |
| 59 | Jobs page size, pager, auto-refresh indicator | L3 | Queue panel footer |

Every inventory item (1–59) is mapped; none removed.

### Layout & components

**Shared primitives (philosophy §5):**
- **PageShell** — full-bleed work-surface variant for all three routes; `p-8` desktop, `p-4` below `md`.
- **PageHeader** — on every route; back-chevron + breadcrumb on subpages; one primary action max.
- **Toolbar** — search left, view/secondary actions right; identical on `/evals` and `/evals/cases`.
- **ListDetail** — list pages are the "list" half; the result Sheet (#48–51) and Queue panel (#52–59) are the "detail" half.
- **EmptyState** — one component, five uses: sets list, case library, runs (no runs yet), Results tab with zero cases ("Go to test cases"), and the Queue panel's jobs view ("No jobs in queue").
- **ConfirmDialog** — replaces the seven hand-rolled AlertDialogs (delete set, delete case, remove-from-set, start run, delete run, pause/resume/drain queue, delete/retry jobs); destructive variants get red confirm buttons, informational ones (start run, resume) keep default.

**shadcn composition per surface:**
- *Tables:* `Table` inside the shared DataTable wrapper (TanStack), `Skeleton` rows mirroring columns, `DropdownMenu` for row actions, `Badge` (secondary) for counts, `Badge` (outline) for neutral states. Query failures render an inline error in the table body — `Alert` with a plain-language message and a Retry button (philosophy §8); never a silent empty table (today both list pages destructure `error` and drop it).
- *Set detail:* `Tabs` (Results / Test cases) directly under PageHeader; matrix is a custom grid (CSS grid with `grid-template-columns: minmax(200px,280px) repeat(n, minmax(140px,1fr))`, sticky first column) — replaces the broken flex/`grid-cols-${n}` hybrid; row height driven by content with `min-h-12`, not `h-[60px]` literals.
- *Score cells:* new `ScoreCell` component — score in `text-sm font-semibold` with semantic tokens (`text-success` / `text-warning` / `text-destructive` mapped to the existing green/orange/red CSS vars), status states as muted icon+label, completed cells get `hover:bg-accent` + `cursor-pointer` + visible focus ring (keyboard-activatable `button`).
- *Result detail:* `Sheet` (`sm:max-w-2xl`) with `Tabs`; Overview uses plain stacked definition rows (label `text-sm text-muted-foreground` / value `text-base font-medium`), score as the one large number (`text-4xl`) — no card-in-card nesting (anti-pattern 6); errors in an `Alert variant="destructive"` with `CodePreview` beneath.
- *Queue panel:* `Sheet` (wide, `sm:max-w-3xl`) hosting the existing `QueueManagement` content restyled with semantic badge tokens; stats as a `dl` grid; tabs/`Select`/`Checkbox`/`Table` as today; takes a `canWrite` prop and renders Pause/Resume/Drain, checkboxes, and per-row/bulk retry/delete only when true.
- *Dialogs:* run config and test case dialogs keep `max-w-4xl`; internal section headers `text-sm font-semibold` + `text-xs text-muted-foreground` helper lines; `Separator` between groups; spacing `gap-6` between groups, `gap-2` label-to-field (CLAUDE.md scale).
- *Type scale:* page titles `text-2xl`, tab labels default, card/section titles `text-lg`/`text-sm font-semibold` per CLAUDE.md; ids and JSON `font-mono text-xs` with one-click copy (P4 design bias).
- *Color discipline:* purple only on the page's primary action and active tab; status colors strictly semantic; queue/status badges move from `bg-blue-100`-style literals to token-based variants so dark mode works.

**Copy fixes folded in:** one shared workers-warning string; "5.000 succesfull" typo corrected; set name (not UUID) in case-dialog titles; message count counts user turns.

### Mobile behavior

Designed for the P4 mobile job ("check an eval run's status, copy an id"). Philosophy §7 envisions a shared `design/responsive.md` for the standard table→card and panel→sheet behaviors, but **that file does not exist yet** — so this section is the normative breakpoint spec for these pages (and should be folded into the shared spec when it is written):

- **< md (`390px` target) — `/evals`:** the `hidden md:flex` gate is removed. Table becomes a card list (name, case count, last-run dot + score + relative time); search collapses into an expanding icon field in the Toolbar; "New eval set" remains in the header (RBAC-gated). Pagination becomes prev/next only.
- **< md — `/evals/cases`:** same table→card collapse (name, description one-line, message count). Creating/editing cases on mobile opens the dialog as a full-screen sheet; authoring is desktop-optimized but never broken (philosophy §7) — all fields stack single-column, the composer textarea is full-width, Uppy opens its own sheet.
- **< md — `/evals/[id]`:** the matrix inverts to **run summary cards**, newest first: run name, agent, date, average score (threshold-colored), and a compact status summary ("12 ✓ · 2 failed · 1 running"). Tapping a card opens a full-screen sheet listing per-case scores (case name + ScoreCell rows); tapping a completed row opens the result detail as a full-screen sheet (tabs preserved, Raw included). This *serves the mobile job better than a shrunk matrix*: status at a glance, one tap to the failing case. Run ⋯ menu available on each card (write users). "Run eval" stays in the header. The queue chip remains; the Queue panel becomes a full-screen sheet where the jobs table collapses to job cards (name, state badge, attempts, timestamps stacked; copy-id button visible, not hover-gated). Tab bar (Results / Test cases) becomes full-width segmented control.
- **md–lg:** matrix shows 2 run columns by default instead of 3; Toolbar keeps full search; result Sheet covers ~80% width.
- **≥ lg:** as designed above; first/last pager buttons reappear; column-visibility menu visible.
- **Touch affordances:** nothing hover-only — all row actions are visible ghost icon buttons or ⋯ menus; tooltips supplemented by `aria-label`s.

### Motion

Few and purposeful, per CLAUDE.md timings, all honoring `prefers-reduced-motion`:

1. **Result/Queue Sheet slide-in** — 300 ms `ease-in-out` from the right (explains origin: the cell/chip you tapped).
2. **Score cell update pulse** — when polling changes a cell's state (e.g., active → completed), a single 200 ms background fade from `accent` to transparent (explains causality: "this just finished"). No animation on initial render.
3. **Hover/focus on rows, cells, buttons** — 150 ms background/border transitions.
4. **Tab switches & "Advanced" collapsibles** — 200 ms height/opacity ease; no slide.
5. **Queue chip count change** — number swaps with a 150 ms opacity crossfade; failed count appearing also shifts the chip to its red-tinted state in the same 150 ms.
6. **Skeletons** mirror final layout (table rows, matrix grid); shimmer reserved for streaming, spinners only inside buttons during submits (existing `Loader2` pattern, kept).

---

## 4. Implementation notes

**Files to change:**
- `app/(application)/evals/page.tsx` — rebuild on PageShell/PageHeader/Toolbar; remove `hidden md:flex`; add the Cases + Last-run columns **only once the `GET_EVAL_SETS` server aggregate lands** (binding data strategy in §3 — no client-side per-row fan-out; columns are additive until then); single workers-warning component.
- `app/(application)/evals/components/*` — fold into shared DataTable usage; merge row actions ("Open" + confirm Delete); replace `window.location.reload()` with `refetch`; surface create-modal errors via toast; render the inline query-error state instead of silently dropping `error` (`data-table.tsx:71`).
- `app/(application)/evals/cases/page.tsx` + `cases/components/*` — same list-page treatment (incl. the query-error state, `data-table.tsx:87`); remove dead `DELETE_TEST_CASE` in `data-table.tsx`; fix message-count badge; card collapse at `<md`.
- `cases/components/test-case-modal.tsx` — reinstate "Advanced expectations" (the commented tab content, as a collapsed section); remove the 1 s `setTimeout` (use `crypto.randomUUID()` for message ids); set-name in title; full-screen sheet behavior `<md`.
- `app/(application)/evals/[id]/page.tsx` — restructure to PageHeader + Tabs (Results / Test cases); move name/description into an "Edit details" dialog; fix the dead `testCases` state (derive cap/excludes from `testCasesData`); clear `editingTestCase` whenever the modal closes (stale-edit bug: set at `:376`, never reset at `:416`, so "Create New" reopens the last-edited case); always-visible case row actions; batch bulk-add with progress.
- `[id]/runs/eval-runs.tsx` — drop the card-in-card/collapsible wrappers; queue entry becomes the status chip + Sheet; reuse the shared workers warning.
- `[id]/runs/components/eval-runs-table.tsx` — CSS-grid matrix; run ⋯ menu replacing the 5-button row; respect `canWrite` (currently destructured away — RBAC fix); zero-cases EmptyState with "Go to test cases" action (replaces the bare `:188-194` text); wire the missing `onSuccess` refetch for the sticky-column TestCaseModal (`:537-540` is a comment with no call today); "Show older runs" affordance; mobile run-card inversion; Sheet content de-nested.
- `[id]/runs/components/eval-run-column.tsx` — ScoreCell extraction; average computed over completed results only; semantic color tokens; remove per-render console.logs. Consider lifting job-result fetching to one query for all visible runs (label `contains` per-run today → batched `OR` filter or server aggregate) to kill the N+1.
- `[id]/runs/components/create-eval-run-modal.tsx` — section restructure with "Advanced" scoring group; unchanged data contract (incl. `rights_mode`/RBAC passthrough).
- `[id]/runs/components/queue-management.tsx` — **add a `canWrite` prop and gate every mutating control behind it** (Pause/Resume `:306-315`, Drain `:317-325`, bulk retry/delete `:444-465`, per-row delete/retry `:578-597`, selection checkboxes — the component performs zero RBAC checks today and `eval-runs.tsx:158` renders it for any reader); token-based status colors; Sheet hosting; job-card collapse `<md`; shared EmptyState for "No jobs in queue" (`:476-479`); copy typo fix; ConfirmDialog adoption.
- i18n: extract all strings to en/de message catalogs (the area currently has zero i18n).

**Shared components needed:** PageShell, PageHeader, Toolbar, ListDetail, EmptyState, ConfirmDialog (all from philosophy §5). **NEW shared primitives to flag:**
- **DataTable** — the standardized TanStack wrapper (toolbar slot, server filter/sort contract, skeletons, pager, card-collapse breakpoint). Both list pages here are copy-paste duplicates today; agents/users/keys pages will want it too.
- **ScoreCell / ScoreBadge** — threshold-colored score display (also useful on the dashboard P4 widget "eval status" per personas.md:178).
- **QueuePanel** — `QueueManagement` is already generic (`queueName`, `nameGenerator`, `retryJob`); promote it to a shared, themed, responsive primitive (workflows/n8n will reuse it).
- **AccessDenied** — shared RBAC-denied state (the same alert is hand-rolled four times in this area alone).

**Scope estimate: L.** One backend contract change is required for the full concept: the `GET_EVAL_SETS` aggregate behind the list page's Cases/Last-run columns (§3). The list ships without those two columns until it lands — deliberately no client-side fallback, since per-row fan-out from the list is the same N+1 pattern the Risks section condemns. Batching the matrix's job-results queries remains optional. Beyond that, every file in the area is touched, the detail page is re-architected, and the matrix/mobile inversion is genuinely new UI.

**Dependencies:** shared primitives (PageShell/PageHeader/Toolbar/EmptyState/ConfirmDialog/DataTable) must exist first — this page should be an early consumer, not the inventor. Evals belongs to the "Develop" nav group per `design/personas.md`. Philosophy.md references `design/navigation.md` (nav shell) and `design/responsive.md` (table→card, panel→sheet standards), but **neither file exists in the repo yet** — until they are written, this doc's Mobile section is the normative breakpoint spec for these pages and the persona matrix is the nav-placement source; when those specs land, they should absorb (not contradict) the behaviors stated here. The dashboard doc consumes ScoreBadge for the P4 widget. The `GET_EVAL_SETS` aggregate (§3) needs backend coordination before the list page's new columns can ship.

**Risks:**
- The matrix N+1 (`GET_JOB_RESULTS` per run column, limit 500) caps practical run history; batching changes query shape and needs backend coordination.
- Label-substring matching for results (`label contains eval-run-{id}` + case-id includes, `eval-run-column.tsx:59, 67-69`) is fragile — any redesign of cell-data lookup must preserve these label semantics exactly or coordinate a backend change.
- Polling cadence stack (5 s queue + 10 s runs/cases + per-column results) can thrash on slow connections; consolidate intervals when restructuring, but don't lengthen them silently — live status is the page's value.
- Reinstating the "Advanced expectations" UI re-exposes `GET_TOOLS`-driven pickers that were commented out, possibly for product reasons — confirm with the team before shipping; the save-path passthrough must be preserved either way.
- `rights_mode`/RBAC on runs has no editing UI today (silently `private`); surfacing it is out of scope here but should be tracked, since invisible access semantics violate "Nothing here can surprise me."
