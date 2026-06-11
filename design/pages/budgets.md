# Budgets — Review & Design Concept
**Routes:** `/budgets`  **Primary persona:** P3 Admin  **Secondary:** read-scoped reviewers (any role with `budget_management: "read"`, e.g. team leads / finance); P1/P2 see *their own* budget in chat, not here  **Current state:** functionally complete and recently built (clean code, working RBAC, bulk ops), but it is a *configuration* page wearing a *monitoring* job — no way to find at-risk entities without paging 5 rows at a time, the global policy is hidden inside one tab, budget removal has no confirmation, key data is hover-only, and there is zero i18n and no responsive design.

Budgets are LiteLLM tag budgets; the backend is the source of truth (`lib/budget.ts:1-8`). The page
sets spend caps per **user, role, team, project, or agent**, plus a global per-user default and a
"show budget in chat" platform setting. The in-chat budget indicator and message-blocking behavior
in Chat are downstream consumers of this page's settings and must remain compatible.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File references are relative to repo root;
`page.tsx` = `app/(application)/budgets/page.tsx`.

**Navigation & access control**

1. Sidebar nav item "Budgets" (Wallet icon) in the bottom/admin group, visible when
   `user.super_admin || role.budget_management === "read" || role.budget_management === "write"`
   — `components/custom/main-nav.tsx:244-254`. Label is hardcoded English (no `t()`).
2. Role-level RBAC scope `budget_management` with values `"read"` ("Read Only") and `"write"`
   ("Read/Write"), configured per role in the role form — `components/role-form.tsx:62-67`
   (permission entry), `:21-22` (value options); persisted via the role mutations
   (`queries/queries.ts:894-918`, `:1097-1108`); typed on `UserWithRole`
   (`types/models/user.ts:30`).
3. In-page permission derivation: `canRead` = super_admin ∨ read ∨ write; `canWrite` =
   super_admin ∨ write — `page.tsx:107-109`.
4. Access-denied state for `!canRead`: destructive Alert with Wallet icon, "contact your
   administrator" copy — `page.tsx:266-278`.
5. Read-only degradation (`canRead && !canWrite`): selection checkboxes not rendered
   (`page.tsx:448`, `:469`), per-row action replaced by "Read only" text (`page.tsx:499-503`),
   all global-policy controls disabled (`page.tsx:330`, `:347`, `:357`, `:375`), Save button
   hidden (`page.tsx:382`).

**Page scaffolding**

6. Page header: Wallet icon inside an `h1` ("Budgets", `text-2xl font-bold tracking-tight`) +
   description naming LiteLLM as the enforcement layer — `page.tsx:286-296`.

**Global budget policy (rendered only on the Users tab — `page.tsx:322`)**

7. "Global per-user budget" enable Switch — `page.tsx:326-335`.
8. Default amount Input (number, `min=0`, `step=0.01`, placeholder "20"), disabled while the
   toggle is off — `page.tsx:336-351`.
9. Reset-period Select: Daily / Weekly / Monthly (`1d`/`7d`/`30d`,
   `lib/budget.ts:24-30`) — `page.tsx:352-370`.
10. "Show budget status to user (in chat)." Switch (`show_user_budget_in_chat`) —
    `page.tsx:371-381`. Drives the in-chat indicator (item 42).
11. Save button with validation (a positive finite amount is required when the global budget is
    enabled, otherwise a destructive toast), spinner while saving, success/failure toasts —
    `page.tsx:208-238`, `:382-396`.
12. Settings loaded on mount (when `canRead`) via `budgetsApi.getSettings()` →
    `GET /admin/budgets/settings`; **load failures are silently swallowed** — `page.tsx:131-146`
    (`.catch(() => { })` at `:145`); `util/api.ts:593-596`.
13. Settings persisted via `budgetsApi.saveSettings()` → `PUT /admin/budgets/settings` —
    `util/api.ts:599-602`; `BudgetSettings` shape at `util/api.ts:514-521`.

**Entity browsing**

14. Five entity-type tabs — Users / Roles / Teams / Projects / Agents — from
    `BUDGET_ENTITY_TYPES` (`lib/budget.ts:12-22`), rendered as shadcn Tabs —
    `page.tsx:308-319`. Each type is backed by its own paginated GraphQL query returning a
    computed `budget` field (`QUERY_MAP`, `page.tsx:64-78`;
    `GET_USERS/ROLES/TEAMS/PROJECTS/AGENTS_WITH_BUDGETS`, `queries/queries.ts:3156-3223`;
    shared `BUDGET_PAGE_INFO` fragment `:3144-3154`).
15. Switching tab or changing the search term resets to page 1 and clears the selection —
    `page.tsx:194-197`.
16. Search input with leading icon and per-type placeholder ("Search users by name…"); 300 ms
    debounce; builds a server-side `contains` filter on `email` for users and `name` for all
    other types — `page.tsx:401-409`, `:188-191`, `:153-156`, search fields `:64-78`.
17. Server-side pagination, **5 items per page** (`PAGE_SIZE`, `page.tsx:80`), Apollo
    `network-only` fetch per page — `page.tsx:157-161`; `pageInfo` carries
    pageCount/itemCount/currentPage/hasPreviousPage/hasNextPage — `page.tsx:82-96`.
18. Pagination footer: range text "x–y of z", "Page x of y", prev/next outline icon buttons with
    disabled states — `page.tsx:512-541`.
19. User display-label fallback chain: `name` → `firstname lastname` → `email` — `page.tsx:72`
    (contains commented-out dead code appending `(type)`).
20. Loading state: centered spinner + "Loading…" — `page.tsx:433-437`.
21. Empty states, differentiated: `No <type> match "<term>".` when searching vs.
    `No <type> found.` otherwise — `page.tsx:438-443`.
22. Load-failure handling: destructive toast with the error message; list and pageInfo reset to
    empty — `page.tsx:172-179`.

**Budget table**

23. Columns: selection checkbox (write only), entity label (`w-1/4`, `font-medium`), Budget
    (BudgetBar), Actions (`w-24`, right-aligned) — `page.tsx:445-462`.
24. Select-all-on-page header checkbox and per-row checkboxes, each with `aria-label`s —
    `page.tsx:448-457`, `:469-477`. Selection is a Set that **accumulates across pages** within
    a tab (toggles only touch the current page's ids; the Set is cleared only on tab/search
    change or after an editor action) — `page.tsx:240-258`, `:194-197`, `:260-264`.
25. Per-row ghost button (Pencil icon) labelled "Set" when no budget exists, "Edit" otherwise →
    opens the single-entity editor dialog — `page.tsx:483-498`.
26. Bulk action bar, shown when `canWrite && selected.size > 0`: "{n} selected" + primary button
    "Set budget for {n} selected" (singular/plural entity label) → opens the bulk editor —
    `page.tsx:411-431`.

**BudgetBar visualization (shared component — also used in chat and inside the editor)**

27. "No budget" muted-text fallback when `max_budget` is null/0 — `components/budget-bar.tsx:41-47`.
28. Color-banded fill — green `ok` / amber `warn` / red `over` — where `over` = spend ≥ max,
    `warn` = ≥80% used **or** projected >100% ("over pace"), else `ok` —
    `budget-bar.tsx:17-21`; level logic `lib/budget.ts:94-99`.
29. Fill width animates via CSS transition, currently **700 ms ease-out** — `budget-bar.tsx:65-71`.
30. Dashed burn-rate projection marker positioned at the projected percentage —
    `budget-bar.tsx:72-78`; linear projection: `windowStart = reset − duration`,
    `projected = spend / elapsed × window`, elapsed floored at 1 h —
    `lib/budget.ts:73-102`; `parseDurationDays` `:62-66`. Percentages clamped 0–100 for render
    (`budget-bar.tsx:23`).
31. Caption under the bar (non-compact mode): `"$spent / $max"` left, `n%` right —
    `budget-bar.tsx:80-87`. A `compact` prop renders a thinner bar (`h-2`) without the caption —
    `budget-bar.tsx:61-63`.
32. Hover Tooltip with full detail: used/max, remaining + duration label
    (`durationLabel`, `lib/budget.ts:115-117`), "Projected ≈ $x by reset" (amber + "(over
    pace)" when over pace), and the reset date — `budget-bar.tsx:90-106`. USD formatting via
    `formatUsd` (`—` for non-finite, no decimals for whole amounts) — `lib/budget.ts:105-113`.

**Budget editor dialog**

33. One Dialog hosts both modes; title "Edit budget" (single) / "Set budget" (bulk); description
    is the entity name or "n projects"-style label; dismissable via overlay/X — `page.tsx:545-577`;
    `EditorState` union `page.tsx:98-101`.
34. Single mode with an existing budget shows a "Current status" BudgetBar inside the editor —
    `components/budget-editor.tsx:109-114`.
35. "Budget (USD)" amount Input (number, `inputMode="decimal"`, `step=0.01`); in single mode
    **prefilled from the existing budget's `max_budget`** (`budget-editor.tsx:41-43`); Save
    disabled until the amount is finite and > 0 — `budget-editor.tsx:117-129`, validity
    `:50-52`, gating `:174`.
36. "Reset period" Select (Daily / Weekly / Monthly); in single mode **prefilled from the
    existing `budget_duration`**, defaulting to Monthly (`30d`) — `budget-editor.tsx:44-46`,
    `:131-149`.
37. Save (single): `budgetsApi.upsert` → `PUT /admin/budgets/{type}/{id}`; success/error toasts —
    `budget-editor.tsx:54-63`, `:78-86`; `util/api.ts:552-565`.
38. Apply to all (bulk): `budgetsApi.bulkUpsert` → `PUT /admin/budgets/{type}/bulk` with
    `entityIds`; per-entity results summarized as "{ok} succeeded, {failed} failed" (destructive
    toast variant on any failure; individual failed ids/errors are discarded) —
    `budget-editor.tsx:65-76`; `util/api.ts:567-579`; `BulkBudgetResult` `:523-527`.
39. Remove budget (single mode, only when a budget exists): destructive-styled ghost button,
    fires `DELETE /admin/budgets/{type}/{id}` **immediately, with no confirmation**; toasts —
    `budget-editor.tsx:89-105`, `:152-166`; `util/api.ts:581-590`.
40. Cancel button; all controls disabled while saving/deleting, with spinners on the active
    button — `budget-editor.tsx:151-183`.
41. After save/remove: dialog closes, selection clears, current page refetches —
    `page.tsx:260-264`, `refreshBudgets` `:204-206`.

**Downstream consumers (compatibility contract)**

42. In-chat personal budget indicator: Wallet HoverCard button next to the composer revealing
    "Your budget" + BudgetBar; turns destructive and shows "Budget reached" copy when
    `spend >= max_budget`; the chat input is disabled and a paused-messaging notice is shown —
    `app/(application)/chat/[agent]/[session]/chat.tsx:129-134` (exceeded calc), `:591-595`
    (toast guard), `:1164-1165` (disabled composer), `:1372-1395` (HoverCard), `:1413-1417`
    (notice). The `user.budget` snapshot is attached server-side only when setting item 10 is on
    — `types/models/user.ts:32-36`, `UserBudgetView` `:14-19`.
43. `budgetsRequest` REST wrapper: bearer-token fetch against the backend base URI, JSON `detail`
    extraction on errors, 204 → null — `util/api.ts:529-550`.

### UX review

**High**

- **The monitoring job is unsupported.** P3's #1 job is "act before overruns"
  (`design/personas.md:93`), but there is no status filter, no sort by spend/level, and no
  aggregate signal. Finding over-budget entities means paging through 5-row pages
  (`page.tsx:80`) across five tabs and eyeballing bar colors. The page only supports the
  *configure* job, not the *monitor* job.
- **Users search is broken by its own promise.** Placeholder says "Search users by name…"
  (`page.tsx:404`) but the filter targets `email` only (`page.tsx:71`). Searching a display
  name silently returns nothing — an admin will conclude the user has no account.
- **Destructive action without confirmation.** "Remove" in the editor instantly deletes the
  budget (`budget-editor.tsx:89-105`) — removing a spend cap is exactly the kind of foot-gun
  the philosophy's ladder rule forbids ("anything destructive lives at L3 or deeper *with
  confirmation*", `design/philosophy.md:57`).
- **Global policy is buried and nested.** The platform-wide default + the show-in-chat setting
  render only on the Users tab, as a Card inside the "Entity budgets" Card
  (`page.tsx:322-399` inside `:299-543`) — anti-pattern #6 (boxes in boxes) and a
  discoverability failure: from Roles/Teams/Projects/Agents tabs the platform policy appears
  not to exist. "Show budget in chat" has nothing to do with the user *list* at all.

**Medium**

- Pagination prev/next are icon-only buttons with no `aria-label`/`sr-only` text —
  `page.tsx:520-527`, `:531-538` (anti-pattern #2).
- Critical budget detail (projection, remaining, reset date) lives **only** in a hover Tooltip
  whose trigger is a non-focusable `div` (`budget-bar.tsx:57-58`) — unreachable by keyboard and
  by touch. Violates "nothing critical to trust may be hidden below L2" in spirit: it's hidden
  behind an input modality.
- Selection silently accumulates across pages (`page.tsx:240-258`): "12 selected" can include
  rows on other pages with no way to review or clear them short of switching tabs. The bulk bar
  (`page.tsx:411-431`) has no "Clear" action.
- `PAGE_SIZE = 5` (`page.tsx:80`) makes every list a pagination exercise. (Note: likely chosen
  because each row triggers a LiteLLM budget lookup — see Risks.)
- Zero i18n: every string on the page, in both components, and the nav label are hardcoded
  English (`page.tsx` throughout; `main-nav.tsx:251`) on a platform shipping en/de.
- Loading is a spinner wall (`page.tsx:433-437`) instead of a table skeleton — contra
  CLAUDE.md loading-state patterns and philosophy §6.
- Settings GET failure is swallowed (`page.tsx:145`): an admin can unknowingly edit and save
  over settings that never loaded.

**Low**

- Header is hand-rolled (icon inside `h1`, `page.tsx:288-291`) — must move to the shared
  PageHeader primitive (philosophy §5).
- Select-all checkbox has no indeterminate state when only some rows are selected
  (`page.tsx:448-456`).
- The global "Amount" field never states its currency (`page.tsx:337-351`) while the editor
  says "Budget (USD)" (`budget-editor.tsx:117`).
- Dead commented-out code in the user label fn (`page.tsx:72`).
- BudgetBar's 700 ms fill (`budget-bar.tsx:67`) exceeds the 500 ms animation budget
  (CLAUDE.md) and has no `prefers-reduced-motion` guard.
- Bulk failures are reduced to a count; which entities failed and why is discarded
  (`budget-editor.tsx:69-75`).

### Mobile audit (390 px)

The page has **zero responsive classes** — no `sm:`/`md:` variant anywhere in
`page.tsx` — the desktop layout simply shrinks.

- **Tabs row:** `TabsList` is `inline-flex … whitespace-nowrap` with no overflow handling
  (`components/ui/tabs.tsx:17`, triggers `:32`). Five triggers (~75 px each) ≈ 380–400 px —
  at 390 px minus container padding the last tab(s) clip or force page-level horizontal scroll
  (anti-pattern #9). "Agents" budgets become near-unreachable.
- **Global policy card:** the `whitespace-nowrap` label "Show budget status to user (in chat)."
  (`page.tsx:378`) plus switch is ~300 px — borderline; the four control groups wrap into a tall
  ragged stack with the `ml-auto` Save button floating ambiguously (`page.tsx:324`, `:387`).
- **Table:** shadcn's wrapper scrolls horizontally (`components/ui/table.tsx:9`). Long
  non-breaking emails in the name column push the Budget column off-screen, and the flexible
  bar column collapses to a sliver — the page's core visualization becomes unreadable exactly
  where P3's mobile job ("respond to alerts — check a budget", `design/personas.md:104-105`)
  needs it.
- **Hover-only detail:** the BudgetBar Tooltip (projection, remaining, reset date) cannot be
  opened on touch at all (`budget-bar.tsx:55-107`).
- **Bulk bar:** `flex justify-between` with a nowrap button ("Set budget for 12 selected") gets
  cramped/overflows at 390 px (`page.tsx:412-430`).
- Dialog/editor and pagination footer are acceptable.

**Verdict: minor-to-broken.** Core numbers remain visible (bar caption), but tab access,
detail access, and the bar itself degrade badly; per philosophy anti-pattern #9 the horizontal
overflow must be fixed.

---

## 2. Jobs to be done

**Primary: P3 Admin.** *#1 job in one sentence:* **"Spot any user/team/project/agent that is over
or on pace to exceed its budget, and adjust or set the cap before the overrun."**
(personas.md:93 — "Set and monitor budgets (per team/agent/model); act before overruns.")

P3's jobs on this page, ranked by frequency:

1. **Monitor:** scan for over-budget / over-pace entities; triggered by a cost spike or a
   recurring check. (Most frequent; currently the worst-served.)
2. **Adjust:** set or change one entity's budget; remove a cap.
3. **Onboard in bulk:** apply the same budget to a batch (new team's users, all agents).
4. **Set policy:** configure the global per-user default and whether users see their budget in
   chat. (Rare — typically once, then revisited quarterly.)
5. **Audit:** verify a specific user's spend/reset date when investigating a complaint
   ("why am I blocked?") — needs search to actually work by name.

**Secondary: read-scoped reviewers** (any role granted `budget_management: "read"` — a team
lead or finance partner). Their job is monitoring only (job 1 + 5); the page already degrades
to read-only correctly (inventory item 5) and the redesign keeps that.

**Ownership matrix correction.** `design/personas.md:166` lists the secondary as "P2 (own
spend)". That is wrong for this page: `/budgets` is RBAC-gated to `budget_management`
(main-nav.tsx:244-254), and P2's *own spend* is served by the **in-chat indicator**
(chat.tsx:1372-1395), not by this route. The secondary should read "read-scoped reviewers
(roles with `budget_management: read`); P1/P2 personal spend is surfaced in chat." This
correction should flow back to personas.md.

P1 never sees this page. P4 has no job here (model-level rate/cost limits live on `/models`).

**Mobile job (P3):** "a budget alert fired — open the page, find the entity, see how bad it is,
raise/confirm the cap, one-handed." Monitoring and single edits must work on a phone; bulk
onboarding and policy editing may remain desktop-optimized but not broken.

---

## 3. Design concept

### Default view (L1)

A calm, table-first admin monitor. One screen, no nested cards, status before configuration.

```
┌──────────────────────────────────────────────────────────────────────┐
│ PageHeader                                                           │
│   Budgets                                  [ Default policy: $20 /  │
│   Spending limits per user, role, team,      Monthly · shown in     │
│   project, or agent — enforced by LiteLLM.   chat   (Edit) ]        │
├──────────────────────────────────────────────────────────────────────┤
│ Toolbar                                                              │
│   [Users] [Roles] [Teams] [Projects] [Agents]                       │
│   [⌕ Search users by name or email…]   [Status: All ▾]              │
├──────────────────────────────────────────────────────────────────────┤
│ (StatStrip — phase 2, see note) Over: 2 · At risk: 5 · No budget: 31 │
├──────────────────────────────────────────────────────────────────────┤
│ Table (25 / page)                                                    │
│ ☐  Entity              Budget                        Resets    ✎    │
│ ☐  anna@acme.com       ▓▓▓▓▓▓▓░░ $18 / $20 · 90% ⚠   Jul 1   Edit  │
│ ☐  Design team         ▓▓░░░░░░░ $45 / $200          Jul 1   Edit  │
│ ☐  ben@acme.com        No budget                       —       Set  │
│                                            1–25 of 38   ‹ 1/2 ›     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Region 1 — PageHeader** (shared primitive): title "Budgets" (`text-2xl`), one-line purpose.
  The header's right slot holds the **Default policy summary** — a single quiet line
  ("Default: $20 / Monthly · shown in chat" or "No default budget") with a ghost "Edit" button
  (`canWrite` only; read-only users see the summary without the button). This makes the global
  policy visible from *every* tab and pulls it out of the card nest (fixes inventory items
  7–13's placement). It is metadata, not the page's accent — no purple here.
- **Region 2 — Toolbar** (shared primitive): the five entity-type Tabs (Users default), the
  search input (placeholder corrected: "Search users by name or email…" — and the backend
  filter extended to match, see §4), and a **Status filter** Select: All · Over budget ·
  At risk · OK · No budget. The status filter is the single biggest fix for the monitoring job
  and ships in **phase 1**; it is **backend-evaluated** — a client-side filter would only sieve
  the 25 fetched rows — against the contract in §4 ("Backend contract — status filter").
- **Region 3 — table**: page size 25. Columns: select / Entity / Budget (BudgetBar with
  caption) / Resets (date, muted) / row action. Healthy rows stay quiet (philosophy §4 —
  "status is quiet until it isn't"); only `warn`/`over` rows carry amber/red, exactly as the
  bar already encodes. The per-row "Set"/"Edit" ghost button remains the L1 entry to editing.
- **Primary action:** there is deliberately no header-level "Create" — budgets are properties
  of existing entities; the primary action is per-row "Set"/"Edit". The one purple element on
  the screen is the bulk-apply button when a selection exists.
- **EmptyState** (shared primitive) replaces the bare centered text: Wallet icon, "No budgets
  yet — entities without a cap can spend freely.", primary action "Set a budget" focusing the
  first row's action (search-miss variant keeps the quoted-term copy, item 21).

**StatStrip note:** a compact one-line count of Over / At risk / No budget for the current
entity type (clicking a segment applies the status filter) is specified as **phase 2** because
it needs a backend aggregate (§4 Dependencies; the aggregate is a thin reuse of the phase-1
server-side status evaluation). The L1 design works without it; the status filter is the
phase-1 carrier of the monitoring job.

### Disclosure ladder

Every inventory item mapped. "Same" = behavior unchanged, possibly restyled.

| # | Capability | Level | Where it lives in the new design |
|---|------------|-------|----------------------------------|
| 1 | Sidebar nav entry (RBAC-gated) | L0 | Administration nav group; label i18n'd |
| 2 | `budget_management` role scope | L0/L3 | Unchanged; configured on `/roles` |
| 3 | canRead/canWrite derivation | — | Unchanged logic, same gates |
| 4 | Access-denied alert | L1 | Same (only render for `!canRead`) |
| 5 | Read-only degradation | L1 | Same: no checkboxes, no edit buttons, policy summary without Edit |
| 6 | Page header | L1 | Shared **PageHeader**; Wallet icon dropped from the `h1` (icons live in nav) |
| 7 | Global budget enable switch | L3 | "Default policy" dialog, opened from the header summary |
| 8 | Global default amount | L3 | Same dialog; label "Default budget (USD)" |
| 9 | Global reset period | L3 | Same dialog |
| 10 | Show-budget-in-chat toggle | L3 | Same dialog, its own "Visibility" group with helper text ("Users see their budget next to the chat composer") |
| 11 | Save settings + validation | L3 | Same dialog footer; identical validation + toasts |
| 12 | Settings GET on mount | — | Timing unchanged: **one eager GET on page load** (when `canRead`) hydrates the header summary; the policy dialog reuses that cached result — one fetch per visit, no second fetch path (§4 "Settings round-trip"); **failure now surfaces** as "—" in the summary and an inline alert with retry in the dialog |
| 13 | Settings PUT | — | Unchanged API call |
| 14 | Five entity-type tabs + per-type queries | L1 | Toolbar Tabs (desktop ≥ md); Select at < md |
| 15 | Tab/search reset of page + selection | L1 | Same; selection clear gets a toast-free inline note if >0 were selected ("Selection cleared") |
| 16 | Debounced search w/ server filter | L1 | Toolbar; users filter extended to name OR email (§4) |
| 17 | Server pagination | L1 | Same mechanics; PAGE_SIZE 25 (pending Risk check) |
| 18 | Pagination footer | L1 | Same, prev/next get `aria-label`s |
| 19 | User label fallback chain | L1 | Same (dead code removed); email shown as muted second line when label ≠ email |
| 20 | Loading state | L1 | Table **skeleton** mirroring 25 rows (philosophy §6), not a spinner |
| 21 | Empty states (none vs. no-match) | L1 | Shared **EmptyState**, both variants kept |
| 22 | Load-failure toast + reset | L1 | Same, plus inline retry button in the empty table area |
| 23 | Table columns | L1 | Entity / Budget / Resets / action; select column write-only as today |
| 24 | Row + select-all checkboxes, cross-page selection | L1/L2 | Same accumulation semantics, now **visible**: bulk bar shows "n selected (across pages)" + a "Clear" button; header checkbox gains indeterminate state |
| 25 | Per-row Set/Edit button | L1 | Same |
| 26 | Bulk action bar | L2 | Shared **BulkActionBar** (NEW primitive, §4), appears between Toolbar and table; purple primary "Set budget for n…" |
| 27 | "No budget" fallback text | L1 | Same |
| 28 | Color-banded fill (ok/warn/over) | L1 | Same thresholds, unchanged `lib/budget.ts` logic |
| 29 | Animated fill | L1 | Retimed to 500 ms ease-out + `motion-reduce:transition-none` (§ Motion) |
| 30 | Projection marker + math | L1 | Same; legend line added to the detail popover (item 32) |
| 31 | Caption + `compact` prop | L1 | Same; compact used on mobile cards |
| 32 | Tooltip detail (remaining, projection, reset) | **L2** | Becomes a click/focus **Popover** on a focusable bar trigger (keyboard + touch reachable); hover still opens it on pointer devices. Content unchanged + entity label + "Edit budget" shortcut |
| 33 | Editor dialog (both modes) | L3 | Same Dialog; sheet presentation on mobile |
| 34 | Current-status bar in editor | L3 | Same |
| 35 | Amount field + validity gating + single-mode prefill | L3 | Same, incl. prefill from `existing.max_budget` (`budget-editor.tsx:41-43`) |
| 36 | Reset-period select + single-mode prefill | L3 | Same, incl. prefill from `existing.budget_duration` / `30d` default (`budget-editor.tsx:44-46`) |
| 37 | Single upsert + toasts | L3 | Same |
| 38 | Bulk apply + per-entity result summary | L3 | Same call; on partial failure the toast adds "View details" expanding a list of failed entities (uses the `BulkBudgetResult.error` already returned, item 38/`util/api.ts:523-527`) |
| 39 | Remove budget | L3 | **Inline two-step confirm** inside the same dialog: "Remove" → button swaps to destructive "Confirm remove — spending becomes unlimited" + Cancel (no stacked dialog, per ladder rule "dialog opens dialog is a bug", philosophy:59) |
| 40 | Cancel/busy states | L3 | Same |
| 41 | Post-action refresh + selection clear | — | Same |
| 42 | In-chat indicator + send blocking | (other page) | Untouched; BudgetBar props stay backward-compatible (`budget`, `compact`, `className`) |
| 43 | `budgetsRequest` wrapper | — | Unchanged |
| — | NEW: Status filter (Over/At risk/OK/No budget) | L1 | Toolbar Select; serves job 1; **backend-evaluated**, phase-1 (§4 contract) |
| — | NEW (phase 2): StatStrip counts | L1 | One-line counts under Toolbar; tap = apply filter |

No inventory item is removed; items 7–13 move from a tab-scoped nested card to an
all-tabs header summary (L1 read) + dialog (L3 write); item 32 moves from hover-only to a
proper L2 surface.

### Layout & components

- **PageShell** — centered content page variant, `max-w-7xl`, `py-6`, vertical rhythm
  `space-y-6` (Medium spacing per CLAUDE.md scale).
- **PageHeader** — title `text-2xl font-bold tracking-tight`, purpose line
  `text-muted-foreground text-base`. Right slot: policy summary `text-sm text-muted-foreground`
  + `Button variant="ghost" size="sm"` "Edit". No icon in the title.
- **Toolbar** — single row, `flex items-center gap-2` (Small spacing): shadcn `Tabs`
  (entity types), `Input` with leading `Search` icon (`pl-8`, flexes), `Select` (status
  filter, `w-40`). Wrapping follows the shared responsive spec (`design/responsive.md` —
  **pending, not yet written**); until it lands, the per-breakpoint behavior in "Mobile
  behavior" below is normative for this page.
- **BulkActionBar** (NEW shared primitive — see §4): `rounded-md border bg-muted/40 px-4 py-2`,
  left "n selected (across pages)" `text-sm` + ghost "Clear", right primary Button
  (`default` variant — the screen's purple) "Set budget for n selected".
- **Table** — shadcn `Table`; row hover `bg-muted/50` 150 ms. Entity cell `font-medium` with
  optional muted email second line (`text-xs text-muted-foreground`). Budget cell: `BudgetBar`
  (full mode). Resets column `text-sm text-muted-foreground`, hidden below `lg`. Actions cell:
  `Button variant="ghost" size="sm"` with Pencil (stroke-width 1, per icon standard).
- **BudgetBar** — unchanged visual; trigger becomes a `button`-semantics element
  (`tabIndex=0`, `aria-label` summarizing "x of y used, resets …") opening a `Popover`
  (Radix) with the item-32 content; Tooltip behavior retained for hover on pointer devices.
- **Default policy dialog** — shadcn `Dialog` (max-w-md): Switch + amount `Input` + duration
  `Select` grouped under "Default per-user budget"; separator; "Visibility" group with the
  show-in-chat Switch + helper `text-xs text-muted-foreground`; footer Cancel (`outline`) /
  Save (`default`). Field groups `space-y-2`, groups `space-y-6`.
- **Budget editor dialog** — current structure kept (`space-y-5`, labels, footer
  `border-t pt-4`), Remove becomes the inline two-step confirm (item 39). Mobile: rendered as
  a bottom `Sheet`.
- **EmptyState / Skeleton** — shared primitives; skeleton mirrors the table (checkbox, text
  line, bar-shaped block, button-shaped block) per philosophy §6.
- **ConfirmDialog** — *not* used inside the editor (no modal-on-modal); the shared inline
  destructive-confirm pattern documented here should be referenced by other pages with
  in-dialog deletes.
- **i18n** — every string keyed under `budgets.*` in en/de, including the nav label
  (`navigation.budgets`).

### Mobile behavior

Follows the standard breakpoint behaviors (tables→cards, panels→sheets, toolbars→collapse)
that `design/responsive.md` will define centrally — that file is **pending** (it does not
exist yet; `design/` currently holds only `philosophy.md`, `personas.md`, `audits/`, and
`pages/`). Until it lands, the spec below is self-contained and normative. Designed for P3's
mobile job: *check a flagged budget, adjust the cap, one-handed.*

- **< md (≤ 767 px):**
  - Entity-type Tabs → a full-width `Select` in the Toolbar (no clipped tab row); search and
    status filter stack beneath it (`flex-col gap-2`).
  - Header policy summary collapses to its value only ("Default: $20/mo"); "Edit" remains a
    44 px tap target.
  - Table → **card list**: each card (one border level, no nesting) = entity label,
    `compact` BudgetBar + caption, status badge (only when warn/over), reset date `text-xs`.
    Tapping the card opens a bottom **Sheet** with the full item-32 detail (remaining,
    projection, reset) + "Edit budget" / "Remove" actions — this replaces the hover tooltip
    entirely on touch.
  - Selection: a checkbox stays on each card's leading edge (write only); the BulkActionBar
    becomes a **sticky bottom bar** above the safe area so "Set budget for n" is thumb-reachable.
  - Editor and policy dialogs render as bottom Sheets, full-width inputs.
  - Pagination: range text + prev/next only.
- **md–lg:** table layout; "Resets" column hidden (`hidden lg:table-cell`); Toolbar on one
  row with the search flexing.
- **≥ lg:** full layout as in the L1 sketch.
- No horizontal page scroll at any width (anti-pattern #9); long emails truncate with
  `truncate max-w-*` + title attribute instead of stretching the row.

### Motion

Few and purposeful, per CLAUDE.md timings; all guarded with `motion-reduce:`:

1. **Bar fill** — width transition retimed 700 ms → **500 ms ease-out** on mount/update; the
   one signature data animation (explains "how full"). Projection marker does not animate.
2. **Status filter / tab change** — table body content fades in **150 ms**; skeleton appears
   immediately (no layout shift: skeleton mirrors row height).
3. **BulkActionBar** — slides/fades in **200 ms ease-in-out** when the first row is selected
   (explains causality: selection → actions).
4. **Dialogs/Sheets/Popover** — stock shadcn enter/exit (~200 ms).
5. **Row hover** — background transition **150 ms**.
6. **Inline remove confirm** — button swap cross-fades **150 ms** (signals the state change
   without a new surface).

---

## 4. Implementation notes

**Files to change**

- `app/(application)/budgets/page.tsx` — rewrite as a thin route composing new components;
  remove the nested-card structure, add status filter, raise page size, add skeleton, fix
  pagination `aria-label`s, i18n.
- NEW `app/(application)/budgets/components/entity-budget-table.tsx` — table + mobile card
  list + pagination (or built on the shared ListDetail/table primitive once it lands).
- NEW `app/(application)/budgets/components/default-policy.tsx` — header summary + L3 dialog
  (absorbs current global-settings card, items 7–13).
- `components/budget-bar.tsx` — focusable trigger + click/focus Popover (keep Tooltip on
  hover), 500 ms + `motion-reduce`, `aria-label`. **Props stay backward-compatible** for the
  chat consumer (item 42) and the editor (item 34).
- `components/budget-editor.tsx` — inline two-step remove confirm; bulk-failure detail list
  from `BulkBudgetResult.error`; i18n.
- `queries/queries.ts` — users-with-budgets filter to match name OR email (see Backend
  contract); no other query changes — `status=All` keeps these queries untouched.
- `util/api.ts` — add `budgetsApi.listEntities(type, { status, search, page, limit })` for the
  phase-1 status filter (Backend contract below), reusing `budgetsRequest` (item 43); phase 2
  adds `getSummary`.
- `messages/en.json` / `messages/de.json` — `budgets.*` + `navigation.budgets` keys
  (also fixes the hardcoded nav label, `components/custom/main-nav.tsx:251`).
- `design/personas.md` — apply the §2 ownership-matrix correction for `/budgets`.

**Backend contract — status filter (phase 1, named dependency)**

The `budget` field on the entity lists is a **server-computed LiteLLM lookup**
(`queries/queries.ts:3141-3144`), not a column on `FilterUser`/`FilterRole`/etc., so no
GraphQL filter input can express "over budget" — and the "At risk" level is time-dependent
math that today exists only in client code (`lib/budget.ts:73-102`). The status filter
therefore runs on the budgets REST API, which already owns LiteLLM access:

- **Endpoint:** `GET /admin/budgets/{type}?status={over|warn|ok|none}&search={term}&page={n}&limit={n}`
  — extends the existing `/admin/budgets/{type}/…` family, called via `budgetsRequest`
  (item 43).
- **Response:** `{ items, pageInfo }` where `pageInfo` matches the GraphQL shape (pageCount /
  itemCount / currentPage / hasPreviousPage / hasNextPage, item 17) and each item carries the
  same fields as the GraphQL lists (`id`, `name`, plus `firstname`/`lastname`/`email`/`type`
  for users, and `budget`) — so the existing label fallback chain (item 19) and `BudgetBar`
  binding apply unchanged.
- **Server-side level semantics — must mirror `lib/budget.ts:73-102` exactly, evaluated at
  request time:** `over` = `max_budget > 0 && spend >= max_budget`; `warn` = not over AND
  (`spend / max_budget ≥ 80%` OR linear burn-rate projection > 100%, where
  `windowStart = budget_reset_at − budget_duration` and
  `projected = spend / max(elapsed, 1h) × window`); `ok` = budgeted and neither; `none` =
  no budget (`max_budget` null/0). `lib/budget.ts` remains the canonical definition; the
  backend implementation must pass a contract test against the same fixtures so the filter
  never disagrees with the bar colors it sits next to.
- **Pagination & search composition:** the endpoint evaluates status over the **full entity
  set** for the type — enumerate the type's LiteLLM tag budgets for `over|warn|ok`, diff
  against the entity table for `none` — applies `search` (same name-or-email semantics as the
  GraphQL fix), then paginates. The client switches data source on filter state: `status=All`
  keeps today's GraphQL queries (items 14, 17) untouched; any other status routes through this
  endpoint. One table component, two interchangeable fetchers returning the same shape.
- **Phasing:** the phase-2 `GET /admin/budgets/{type}/summary` (over/warn/none counts) is a
  thin aggregate over this same evaluation — phase 1 builds it, phase 2 reuses it.
- **Fallback:** if the endpoint slips a release, the Status Select is **not rendered** —
  shipping it as a client-side sieve over the fetched page is explicitly forbidden (it would
  filter only visible rows and lie about the rest).

**Shared components needed**

- Existing (philosophy §5): **PageShell**, **PageHeader**, **Toolbar**, **EmptyState**;
  table skeleton pattern.
- **NEW shared primitive — BulkActionBar** (not in philosophy §5): selection count +
  clear + actions, with the sticky-bottom mobile variant. Also needed by `/models` (bulk
  delete, `models/components/data-table.tsx:161-199`) and `/users`; propose adding it to
  philosophy §5.
- **NEW shared pattern — inline destructive confirm (in-dialog)**: the no-modal-on-modal
  two-step confirm; should be documented alongside ConfirmDialog so every in-dialog delete
  uses the same pattern.

**Scope: M frontend + S backend.** One route, two components, one shared primitive, no
data-model changes. **Phase-1 backend touchpoints:** the status-filter endpoint (contract
above) and the name-or-email search fix. **Phase-2 backend touchpoint:** the StatStrip
summary aggregate.

**Dependencies**

- Shell/nav redesign: Budgets sits in the **Administration** group (personas.md:190);
  RBAC gate (item 1) unchanged.
- Shared primitives (PageHeader/Toolbar/EmptyState, philosophy §5) must exist or be stubbed
  locally with identical APIs. Note: neither the primitives nor `design/responsive.md` /
  `design/navigation.md` exist yet — local stubs plus this doc's inline breakpoint spec
  (§3 Mobile behavior) keep the page buildable; reconcile when those land.
- **Backend, phase 1 (blocking the Status filter):** (a) the
  `GET /admin/budgets/{type}?status=…` endpoint per the Backend contract above — the Status
  filter is the phase-1 carrier of the monitoring job and does not ship without it (see
  Fallback); (b) extend the users budget filter to name-or-email (GraphQL `FilterUser` OR
  support, or a combined search arg).
- **Backend, phase 2:** aggregate endpoint `GET /admin/budgets/{type}/summary` →
  over/warn/none counts, reusing the phase-1 status evaluation.

**Risks**

- **LiteLLM lookup cost:** each list row resolves a live `budget` field
  (`queries/queries.ts:3142-3144` notes the lists are deliberately minimal because "the
  budgets page pays for the budget lookup"). `PAGE_SIZE` 5 → 25 multiplies backend LiteLLM
  calls per page-load by 5, and the phase-1 status endpoint evaluates the **full** entity set
  per request. Verify backend batching/caching before raising the page size; if costly, ship
  10 and keep 25 behind the verified batch path, and let the status endpoint cache its
  evaluation briefly (seconds, not minutes — this data drives "act before the overrun"
  decisions).
- **Status-semantics drift:** the "At risk" level is time-dependent math defined in
  `lib/budget.ts:73-102` and now duplicated server-side (Backend contract). Without the shared
  contract test, the filter and the bar colors beside it can disagree (e.g. a row returned by
  `status=warn` rendering green); any threshold or projection change must land in both places
  in the same release.
- **Selection semantics:** keeping cross-page accumulation (item 24) while making it visible
  is a behavior users may already rely on; the "Clear" affordance must not silently change
  what bulk-apply targets.
- **Chat compatibility:** any BudgetBar API change ripples into the chat composer
  (item 42); compact-mode rendering must remain pixel-stable there.
- **Settings round-trip:** the header summary needs settings at page load, so the GET stays
  eager (one per visit, when `canRead`, as today — item 12); the policy dialog must reuse the
  cached result, not introduce a second fetch path.
