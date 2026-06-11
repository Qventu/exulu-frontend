# Users, Roles & Teams — Review & Design Concept
**Routes:** `/users`, `/roles`, `/teams`  **Primary persona:** P3 Admin  **Secondary:** — (P2/P4 consume roles & teams only through pickers on other pages)  **Current state:** functionally complete identity & access area, but split across three visually unrelated pages with hidden navigation, three competing confirmation patterns (incl. native `window.confirm`), a roles list that hides two of the seven permissions it grants, and a `/users` page that renders nothing on mobile.

These three pages are one product area: **a user is assigned exactly one role and one team**
(`user.role` / `user.team` strings, `queries/queries.ts:692-693`); roles gate navigation and
page access for the whole app (`components/custom/main-nav.tsx:145-254`); teams exist for cost
attribution (budgets) and content sharing (`teams/page.tsx:137`,
`queries/queries.ts:3186`). Today they are connected only by two outline buttons buried in the
`/users` toolbar and "Back to Users" links — the redesign treats them as one **Access** area.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File references relative to repo root;
route-local files relative to `app/(application)/`.

**Navigation & gating**

1. Sidebar nav item "Users" (Users icon, translated label `t('navigation.users')`), visible when `user.super_admin || role.users === "write"` — `components/custom/main-nav.tsx:187-193`. This is the **only** sidebar entry for the whole area.
2. `/roles` and `/teams` are reachable only via "Manage roles" / "Manage teams" outline buttons inside the `/users` toolbar (`users/components/data-table.tsx:199-215`) or by deep link; each carries a ghost "Back to Users" button implying a hierarchy the nav doesn't have (`roles/page.tsx:193-198`, `teams/page.tsx:129-134`).
3. All three routes are client components; `/users` sets `export const dynamic = "force-dynamic"` (`users/page.tsx:10`). No frontend route guard on any of them — authorization is enforced by the GraphQL backend.

**`/users` — list page**

4. Page header: "Users" (`text-2xl font-bold`) + "Here's a list of all the users." — wrapped in `hidden h-full flex-1 flex-col space-y-8 p-8 md:flex`, i.e. the entire page renders nothing below `md` (`users/page.tsx:43-51`).
5. Server-paginated users table via `GET_USERS` (`queries/queries.ts:662-697`): hardcoded `limit: 10`, fixed server sort `createdAt DESC`, permanent filter `type ne "api"` excluding API-key accounts (those live in `/keys`), `pollInterval: 30000` (`users/components/data-table.tsx:98-118`).
6. Stale-while-loading: previous page's data rendered while a refetch is in flight (`data-table.tsx:130-141`).
7. Email search "Filter users..." building a server-side `{ email: { contains } }` filter, refetching on every keystroke; fixed width `w-[150px] lg:w-[250px]` (`data-table.tsx:168-182,188-197`).
8. "Reset" ghost button (Cross icon) clears the email filter, rendered only while filtered (`data-table.tsx:184,267-283`).
9. "Add User" primary button (Plus icon), rendered **only for `user.super_admin`** (`data-table.tsx:217-225`).
10. Add-user modal, step 1 (email): required + must-contain-`@` validation with destructive toasts; the modal itself returns `null` for non-super-admins (double gate) (`users/components/add-user-modal.tsx:52-69,148-150,167-182`).
11. Add-user modal, password-auth branch (`configContext.auth_mode === 'password'`): step 2 shows a client-generated 12-char temporary password (Math.random charset), masked input with show/hide and copy-to-clipboard (toast), "send it manually / user changes on first login" guidance, then `CREATE_USER {email, password}` (`add-user-modal.tsx:42-50,71-74,94-121,184-226`; mutation `queries/queries.ts:1151-1163`).
12. Add-user modal, SSO/other-auth branch: immediate `CREATE_USER {email, type: "user", emailVerified: new Date()}` (note: also sends the empty `password` string; no try/catch) (`add-user-modal.tsx:75-91`).
13. Bulk row selection: per-row checkbox + select-all-on-page header checkbox, both with `aria-label`s (`users/components/columns.tsx:18-41`).
14. Bulk "Remove selected" (secondary button, Trash icon) appears when any rows selected: native `window.confirm` → `Promise.all` of `REMOVE_USER_BY_ID` per row → "Removed users / We removed n users." toast, selection reset, loading state (`data-table.tsx:227-265`; mutation `queries/queries.ts:1399-1405`).
15. Column-visibility "View" dropdown toggling hideable columns — hidden below `lg` (`users/components/data-table-view-options.tsx:23-58`, `:29`).
16. Per-column header dropdown: sort Asc / Desc / Hide column (`users/components/data-table-column-header.tsx:34-69`). Sorting is client-side over the current 10-row page only; the server sort stays fixed (`data-table.tsx:104-107`).
17. Email column: `max-w-[300px] truncate font-medium` (`columns.tsx:42-59`).
18. Role column: a full inline `RoleSelector` combobox per row (Popover + Command, searchable); on pick → `window.confirm("…update the role for this user?")` → `UPDATE_USER_BY_ID {role}` (`columns.tsx:60-83`, confirm at `:71`; callback `users/page.tsx:16-23`; mutation `queries/queries.ts:827-856`). Code comment admits the gap: "todo rbac and / or super_admin check" (`columns.tsx:70`).
19. RoleSelector item subtitles summarize each role's permissions — but only agents/workflows/variables/users; api, evals, budgets are omitted; fallback "No specific permissions configured" (`components/ui/role-selector.tsx:56-97,122-152`).
20. Team column: same pattern with `TeamSelector` (name + description subtitle), `window.confirm` → `UPDATE_USER_BY_ID {team}` (`columns.tsx:84-105`, confirm at `:93`; `components/ui/team-selector.tsx:48-105`).
21. Status column: `emailVerified` → "verified" in `text-primary` (purple) else "pending" in `text-orange-400` (`columns.tsx:106-125`).
22. Super Admin column — rendered only when the **viewer** is super admin (`columns.tsx:126-137`).
23. `SuperAdminToggle`: red-styled Switch (`data-[state=checked]:bg-red-500`) + "Yes/No" label; confirmation Dialog with grant/remove copy (grant uses destructive variant); self-demotion blocked with a destructive toast; hardcoded amber "last super administrator" warning panel on removal; `UPDATE_USER_BY_ID {super_admin}` (`users/components/super-admin-toggle.tsx:43-54,92-141`, warning `:115-124`).
24. Row actions "…" ghost button (sr-only label) → dropdown: "Reset password", "Delete user" (`users/components/data-table-row-actions.tsx:122-165`).
25. Reset password: client-generated 12-char password (Math.random), dialog with masked value, show/hide, copy-with-toast, manual-handoff guidance, confirm → `RESET_USER_PASSWORD` (a password-only `usersUpdateOneById`), success/error toasts (`data-table-row-actions.tsx:60-104,167-234`; mutation `queries/queries.ts:1165-1173`).
26. Delete user: self-delete blocked with toast ("that would be a bad idea"); `window.confirm`; `REMOVE_USER_BY_ID`; success toast fired optimistically *before* the mutation resolves (`data-table-row-actions.tsx:138-163`).
27. Row payload is zod-parsed (`userSchema`: numeric id, email, emailVerified, optional roles array — the roles array is never displayed) before actions render (`data-table-row-actions.tsx:41`; `users/data/schema.ts:3-16`).
28. Empty table state: single "No results." row spanning all columns (`data-table.tsx:324-333`).
29. Pagination footer: "x of y row(s) selected", "Page x of {pageCount}", first/prev/next/last icon buttons with sr-only labels, disabled states from `pageInfo.hasPreviousPage/hasNextPage`; first/last hidden below `lg`. The "go to last page" handler wraps `setPageIndex` in an inner closure that is never invoked — dead code (`data-table.tsx:337-425`, bug at `:408-417`).
30. Commented-out rows-per-page Select (10/20/30/40/50) — dead code kept in the tree (`data-table.tsx:343-364`); related: `usePagination` defaults `pageSize: 5` while the query hardcodes `limit: 10` (`data-table.tsx:64-77` vs `:103`).

**`/roles`**

31. Header: ghost "Back to Users" + "Role Management" (`text-3xl font-bold`, off-scale) + purpose line (`roles/page.tsx:192-203`).
32. `GET_USER_ROLES` page 1 / limit 100, `cache-first` then `network-only`; no pagination UI — >100 roles silently truncated (`roles/page.tsx:34-38`; query `queries/queries.ts:636-661`).
33. Client-side name search "Search roles..." (`roles/page.tsx:28,52-55,214-220`).
34. "Create Role" primary button → Dialog (`max-w-2xl max-h-[90vh] overflow-y-auto`) hosting `RoleForm` → `CREATE_USER_ROLE` with success/error toasts (`roles/page.tsx:221-241,108-134`; mutation `queries/queries.ts:1096-1113`).
35. Roles table: Role Name (Shield icon + medium name), Permissions, Created, Updated (`format(…, "PP hh:mm")`), right-aligned Actions (`roles/page.tsx:260-302`).
36. Permission summary badges via `formatPermissions` — secondary badges "Area: Read" / "Area: Read/Write" covering **only agents, workflows, variables, users, api**; `evals` and `budget_management` are granted by the form but invisible here; "No permissions" outline fallback (`roles/page.tsx:57-106,280-295`).
37. Edit role: ghost pencil icon per row → Dialog with prefilled `RoleForm` → `UPDATE_USER_ROLE_BY_ID`, toasts (`roles/page.tsx:305-336,136-166`; mutation `queries/queries.ts:884-918`).
38. Delete role: ghost red trash icon, **disabled for reserved roles `admin` and `default`** (`roles/page.tsx:347,373`); confirmation Dialog with irreversibility copy and loading spinner; `REMOVE_USER_ROLE_BY_ID`; toasts (`roles/page.tsx:338-386,168-188`; mutation `queries/queries.ts:1414-1420`).
39. `RoleForm` name field: required; locked (disabled + destructive helper text) when editing the reserved `admin`/`default` roles (`components/role-form.tsx:128-143`).
40. `RoleForm` permissions: 7 areas — Agents, Workflows, Variables, Users, API, Evals, Budgets — each rendered as a full Card (icon + title + description) wrapping a 3-option RadioGroup: No Access / Read Only / Read/Write (with per-option descriptions) (`role-form.tsx:19-68,154-193`).
41. `RoleForm` submit: empty selections coerced to `null`; Cancel + submit button with loading spinner and Shield icon; submit disabled until name present (`role-form.tsx:104-123,197-214`).
42. Roles loading state (centered spinner + "Loading roles...") and dual empty states (no roles yet / no search matches) (`roles/page.tsx:249-257`).

**`/teams`**

43. Header: ghost "Back to Users" + "Team Management" (`text-3xl`) + description explaining teams group users "for cost attribution and sharing" (`teams/page.tsx:127-139`).
44. `GET_TEAMS` page 1 / limit 100 `cache-first`; client-side name search "Search teams..." (`teams/page.tsx:33-37,52-54,150-155`; query `queries/queries.ts:699-718`).
45. "Create Team" primary button → Dialog with `TeamForm` (Name required with e.g.-placeholder; optional 3-row Description textarea) → `CREATE_TEAM`, toasts (`teams/page.tsx:156-176,56-76`; `components/team-form.tsx:42-87`; mutation `queries/queries.ts:1115-1127`).
46. Teams table: Team Name (Building2 icon), Description (`max-w-md truncate`, "—" fallback), Created, Updated, Actions (`teams/page.tsx:194-310`).
47. Edit team: ghost pencil → Dialog with prefilled `TeamForm` → `UPDATE_TEAM_BY_ID`, toasts (`teams/page.tsx:224-255,78-102`; mutation `queries/queries.ts:1129-1141`).
48. Delete team: ghost red trash → confirmation Dialog → `REMOVE_TEAM_BY_ID`; **no reserved-team protection and no blast-radius warning** (assigned users? attached budgets? shared content?) (`teams/page.tsx:257-304,104-124`; mutation `queries/queries.ts:1143-1149`).
49. Teams loading spinner and dual empty states (`teams/page.tsx:183-191`).

**Cross-page wiring & downstream consumers (context the redesign must not break)**

50. Roles drive RBAC for the whole app: `buildNavigation` shows/hides sidebar groups from `role.{users,api,variables,agents,workflows,evals,budget_management}` + `super_admin` (`main-nav.tsx:145-254`). Editing a role here instantly reshapes its members' navigation.
51. `RBACControl` (`components/rbac.tsx`) is the sharing widget that consumes users, roles and teams everywhere content is shared (agents, models, prompts, skills, knowledge/data, transcriptions, projects, workflow/preset modals, image styles, chat): modes private/users/roles/teams/public with per-entry read/write rights (`rbac.tsx:39-48`); user search capped at 5 results with a "+n more users" modal listing all selections (`rbac.tsx:276-279,335-347,541-616`). Quirk: it passes a `filters` variable to `GET_USER_ROLES`, which declares no such argument — silently ignored (`rbac.tsx:87-101` vs `queries/queries.ts:636-637`).
52. `RoleSelector` is reused by `/keys` for API-key role assignment (`app/(application)/keys/page.tsx`); the selectors fetch up to 100 roles/teams `cache-first` (`components/ui/role-selector.tsx:48-51`, `team-selector.tsx:40-43`).
53. Teams feed budget attribution (`GET_TEAMS_WITH_BUDGETS`, `queries/queries.ts:3186`, used by `/budgets`); the teams page references this in copy but offers no link to `/budgets`.

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | `/users` — the area's home page — renders **nothing below `md`**: root is `hidden … md:flex` with no fallback. P3's mobile job ("deactivate a user … one-handed") is impossible. | `users/page.tsx:43` |
| U2 | **High** | Three competing destructive-confirmation patterns in one area: native `window.confirm` (bulk remove, delete user, role change, team change), ad-hoc shadcn Dialogs (role/team delete), and a custom Dialog (super-admin). `window.confirm` is unstyled, untranslatable, and shows no context. Violates philosophy anti-pattern #4 and the ConfirmDialog primitive. | `data-table.tsx:232`; `data-table-row-actions.tsx:147`; `columns.tsx:71,93` vs `roles/page.tsx:353-385` |
| U3 | **High** | The roles list hides what roles actually grant: `formatPermissions` omits **Evals and Budgets** entirely, so a role granting budget write shows no badge for it. RoleSelector subtitles are worse (omit api/evals/budgets). Directly contradicts "Trust through transparency" and P3's "nothing here can surprise me". | `roles/page.tsx:57-106`; `role-selector.tsx:56-97` |
| U4 | **High** | False success feedback: "We deleted the user." toast fires before the mutation resolves (failure shows success); bulk remove reports success for the whole `Promise.all` without per-item error handling. | `data-table-row-actions.tsx:147-160`; `data-table.tsx:236-252` |
| U5 | Med | Hidden information architecture: `/roles` and `/teams` exist only behind two buttons inside the `/users` toolbar; "Back to Users" headers fake a hierarchy. An admin who lands on `/roles` via URL has no nav context at all. | `data-table.tsx:199-215`; `roles/page.tsx:193-198` |
| U6 | Med | L1 visual overload on `/users`: every row renders two full-width outline comboboxes (Role, Team) — 20 comboboxes for 10 rows — plus a red switch column. The calm audit glance the persona needs doesn't exist. | `columns.tsx:60-105,126-137` |
| U7 | Med | Status column uses the purple accent (`text-primary`) for "verified" — accent reserved for actions/active states — and hardcoded `text-orange-400` instead of semantic warning tokens. | `columns.tsx:113-119` |
| U8 | Med | Hardcoded light-theme colors: amber warning panel (`bg-amber-50 border-amber-200 text-amber-800`) and red switch / red hover styles; glow in dark mode; CLAUDE.md mandates semantic tokens. | `super-admin-toggle.tsx:97,115-124`; `data-table-row-actions.tsx` (red trash hovers in roles/teams pages: `roles/page.tsx:348`, `teams/page.tsx:266`) |
| U9 | Med | Zero i18n across all three pages, every dialog, toast and table header — hardcoded English in an en/de app; only the nav label is translated. | all files under `users/`, `roles/`, `teams/`; cf. `main-nav.tsx:189` |
| U10 | Med | Search refetches the server per keystroke with no debounce and never resets `page` — filtering from page 3 can land on an empty page. Client-side column sort silently sorts only the visible 10 rows while the server sort stays `createdAt DESC` — headers lie. | `data-table.tsx:168-182` (page untouched), `:104-107` vs `data-table-column-header.tsx:34-69` |
| U11 | Med | The role permission editor is 7 stacked Cards inside a scrolling `max-h-[90vh]` dialog — boxes-in-boxes, ~1400px of scroll for 7 three-way choices. A matrix would show it in one viewport. | `role-form.tsx:154-193`; `roles/page.tsx:228` |
| U12 | Med | Roles/teams fetch a hard `limit: 100` with no pagination UI — orgs beyond 100 silently truncate; search only filters the loaded page. | `roles/page.tsx:35`; `teams/page.tsx:34` |
| U13 | Med | Header scale inconsistency: `/users` uses `text-2xl`, `/roles` and `/teams` use `text-3xl`; none use a shared PageHeader; primary actions sit inside a search Card rather than the header. | `users/page.tsx:46` vs `roles/page.tsx:199`, `teams/page.tsx:135,141-179` |
| U14 | Low | Temporary passwords generated with `Math.random()` — not cryptographically secure (use `crypto.getRandomValues`); also duplicated verbatim in two files. | `data-table-row-actions.tsx:60-68`; `add-user-modal.tsx:42-50` |
| U15 | Low | Team deletion has no consequence copy (users keep a dangling team id; budget attribution stops) and no reserved/teams-in-use guard. | `teams/page.tsx:271-303` |
| U16 | Low | Pagination dead code: "last page" inner closure never invoked; commented-out page-size selector; `usePagination` pageSize 5 disagrees with query limit 10; "Page x of -1" possible pre-load. | `data-table.tsx:408-417,343-364,64-77,103` |
| U17 | Low | SSO-mode add-user sends an empty-string password and has no error handling (a failed create still closes with a success toast path). | `add-user-modal.tsx:75-91` |
| U18 | Low | `RBACControl` passes a `filters` variable that `GET_USER_ROLES` doesn't declare — dead parameter masking the intent to exclude api-type roles. | `rbac.tsx:90-100` vs `queries/queries.ts:636-637` |
| U19 | Low | 30s polling on a low-churn admin list; `fetchPolicy: "no-cache"` defeats Apollo caching entirely. | `data-table.tsx:99,117` |
| U20 | Low | zod `userSchema` types `id` as `z.number()` while GraphQL `ID` serializes as string in sibling models; `roles` array is parsed but never used. | `users/data/schema.ts:3-16` |

### Mobile audit

**Severity: broken** (the area's primary page is blank).

- `/users` at 390px renders **literally nothing**: the only wrapper is `hidden … md:flex`
  (`users/page.tsx:43`). No fallback, no message.
- `/roles` and `/teams` render but degrade badly: 5-column tables (name, badges/description,
  two timestamp columns, actions) sit in `overflow-x-auto` wrappers → horizontal scrolling,
  philosophy anti-pattern #9 (`roles/page.tsx:259`, `teams/page.tsx:193`). The permission
  badges wrap into tall cells; `Created`/`Updated` at `PP hh:mm` precision eat half the width.
- Dialog forms: the role dialog is `max-w-2xl max-h-[90vh] overflow-y-auto`
  (`roles/page.tsx:228`) — usable but a very long scroll at 390px; radio option rows place
  label and description side-by-side (`role-form.tsx:180-186`), cramping to unreadable at
  narrow widths.
- Were `/users` un-hidden, it would still fail: a 7-column table with two comboboxes and a
  switch per row has no card fallback; the search input is fixed `w-[150px]`
  (`data-table.tsx:196`); "View" menu `hidden lg:flex` (`data-table-view-options.tsx:29`);
  first/last pagination `hidden lg:flex` (`data-table.tsx:371,410`).
- Hover-only affordances: none strictly (the `…` menu is always visible), but `window.confirm`
  dialogs on mobile browsers are especially jarring.

---

## 2. Jobs to be done

**PRIMARY: P3 Admin — "Onboard, offboard, and correct a person's access — fast and without surprises."** Their #1 job on `/users` is finding a specific person and verifying or fixing their role/team assignment.

**P3 Admin (primary owner)** — deliberate, infrequent, high-stakes visits; ranked by frequency:
1. Find a user; check/correct their role and team assignment (most visits; often triggered by "X can't see Y").
2. Onboard: add a user, hand over the temporary credential (password mode) or confirm SSO pickup (per new joiner).
3. Support: reset a password (recurring help-desk job).
4. Offboard: remove a user (or several) safely (monthly; high stakes — this is deletion, not deactivation).
5. Adjust what a role can do when platform capabilities change (rare; reshapes nav for everyone with that role).
6. Create/rename teams as the org changes; keep cost attribution clean (rare).
7. Grant or revoke super admin (very rare, most dangerous action in the app).
8. Audit: "who has access to what?" — scan users by role/team, scan role grants (periodic/compliance).

**P2 Power user / P4 Developer (indirect):** they never visit these pages — but they *consume*
roles and teams daily as sharing targets via `RBACControl` and selectors (inventory #51-52).
Their need is that role/team names and descriptions are meaningful — a design requirement on
the create forms (good naming guidance), not a claim on these pages' L1.

**Ownership matrix check:** `personas.md` lists `/users`, `/roles`, `/teams` each as P3
primary with no secondary — **correct, no correction needed**. The redesign strengthens the
matrix's intent by merging the three rows into one P3-owned "Access" area; the matrix may
optionally collapse the three rows into one, but ownership stands as written.

---

## 3. Design concept

**Headline:** One tabbed **Access** area — Users · Roles · Teams — on the shared ListDetail
skeleton: find a person at L1, fix their role/team in a detail panel at L2, with a single
ConfirmDialog pattern for everything destructive and a one-viewport permission matrix
replacing the seven-card mega-dialog.

The three routes stay (deep links, bookmarks, and the existing nav gate keep working), but
they render as **one page shell with a Tabs control**; switching tabs navigates between
routes. The sidebar keeps exactly one entry (inventory #1) in the Administration group.
"Back to Users" buttons and the toolbar's "Manage roles/teams" buttons dissolve into the tabs
(#2 relocated, not removed).

### Default view (L1)

What a P3 admin sees arriving at `/users`, top to bottom:

1. **PageHeader** — title "Users & access" (`text-2xl`), one-line purpose ("Who can sign in,
   and what they can do."), and the tab-dependent primary action on the right:
   **"Add user"** (purple; rendered only for super admins, #9) on the Users tab.
2. **Tabs** directly under the header: **Users · Roles · Teams** (shadcn `Tabs` styled as
   quiet segmented control). The active tab is the page's one accent-adjacent active state.
3. **Toolbar** — search ("Search by email…", debounced 300ms, resets to page 1, fixes U10),
   a **Role** filter and a **Team** filter (Selects fed by the existing role/team queries,
   wired to `GET_USERS`' generic `filters` argument), and the column "View" menu at the right
   edge. Reset appears as an "×" inside the search plus a filter-clear chip (#8).
4. **The users table** (ListDetail list side), calm and read-first:
   - **User** — email (truncating, `font-medium`) with a quiet StatusDot + label underneath:
     muted success dot "Verified" / warning dot "Pending" (#21, semantic tokens, no purple —
     fixes U7). A small Shield glyph with tooltip "Super admin" appears next to the email when
     applicable, visible only to super-admin viewers (#22 read-state at L1; the toggle moves
     to L3).
   - **Role** — current role name as a quiet inline-edit cell: renders as text, hover/focus
     reveals a pencil affordance, click opens the existing searchable RoleSelector popover
     (#18-19); selection opens **ConfirmDialog** ("Change role of {email} to {role}? This
     changes what they can see and do.") replacing `window.confirm` (fixes U2/U6).
   - **Team** — same inline-edit pattern with TeamSelector (#20).
   - Row click (outside the edit cells) opens the **user detail panel** (L2). The `…` menu
     stays for keyboard/explicit access (#24).
   - Selection checkboxes (#13) appear on row hover/focus and in a header "Select" affordance;
     a selection bar slides in above the table with "n selected · Remove" → ConfirmDialog (#14).
5. **Pagination footer** as today (#29), dead code removed, "Page x of y" never shows -1.
6. **EmptyState** (first run / filtered-empty): Users icon, "No users match." / "Invite your
   first user.", primary "Add user" (super admins) (#28 upgraded).

**Roles tab L1:** table of roles — **Role** (name + "System" outline badge for the reserved
`admin`/`default` roles), **Permissions** (compact badge summary now covering **all seven
areas**, e.g. `Agents RW · Users R · Budgets RW` — fixes U3), **Updated** (date only). Primary
action becomes **"New role"**. Row click → role panel (L2).

**Teams tab L1:** table of teams — **Team** (name), **Description** (truncated), **Updated**.
Primary action **"New team"**. Row click → team panel. A quiet header link "Budgets →" closes
the loop the current copy only promises (#53).

**Primary action:** the single purple button in the header — Add user / New role / New team
depending on tab. Nothing else on the screen is purple.

### Disclosure ladder

Every inventory item mapped. "→" = item moves from its current location.

| # | Capability | Level | Where it lives |
|---|------------|-------|----------------|
| 1 | Sidebar "Users" entry (RBAC-gated) | L0 | Sidebar, Administration group (label → "Users & access") |
| 2 | Cross-links between the three pages | L1 | → Tabs (Users · Roles · Teams) under the PageHeader; "Back to Users" buttons retired in favor of tabs |
| 3 | Client routes, backend-enforced authz | — | unchanged (infrastructure); routes preserved for deep links |
| 4 | Page title + purpose | L1 | PageHeader (one per area; fixes U13) |
| 5 | Paginated user list (10/page, `type ne api` filter, fixed sort) | L1 | ListDetail table; poll replaced by `cache-and-network` + refetch-on-focus (U19) |
| 6 | Stale-while-loading | L1 | unchanged + skeleton rows on first load |
| 7 | Email search | L1 | Toolbar search (debounced, resets page — U10) |
| 8 | Reset filter | L1 | "×" in search input + clear-filters chip when any filter active |
| 9 | Add User (super-admin only) | L1 | PageHeader primary action (Users tab) |
| 10 | Add-user step 1: email + validation | L3 | Add-user Dialog (kept a dialog: 1-2 fields, fits) with inline field error instead of toast |
| 11 | Password-mode step 2: temp password show/hide/copy + guidance | L3 | same Dialog, step 2; password via `crypto.getRandomValues` (U14); CopyField primitive |
| 12 | SSO-mode immediate create | L3 | same Dialog (single step); add error handling (U17); no empty password sent |
| 13 | Row selection / select-all | L2 | checkboxes on hover/focus + "Select" toolbar affordance (calmer L1) |
| 14 | Bulk remove users | L3 | selection bar "n selected · Remove" → **ConfirmDialog** with per-item failure reporting (U2/U4) |
| 15 | Column visibility "View" menu | L2 | Toolbar right edge (kept) |
| 16 | Per-column sort / hide | L2 | click-to-toggle headers; until server sort is wired, header sort is removed from server-paginated columns and kept only as "Hide" — headers must not lie (U10); server `SortBy` wiring is the follow-up that restores sort |
| 17 | Email cell | L1 | User column (primary line) |
| 18 | Inline role assignment (+ confirm) | L1.5 | quiet inline-edit cell → RoleSelector popover → ConfirmDialog (frequency justifies staying at the surface; rendering calms down) |
| 19 | RoleSelector permission subtitles | L2 | inside the popover, now summarizing **all 7 areas** |
| 20 | Inline team assignment (+ confirm) | L1.5 | same pattern as #18 |
| 21 | Verified/pending status | L1 | StatusDot under email (semantic tokens — U7) |
| 22 | Super-admin visibility (viewer-gated) | L1 read / L3 write | Shield glyph + tooltip at L1; the **toggle** lives in the user panel's "Danger zone" (L3) |
| 23 | Super-admin toggle + confirm + last-admin warning | L3 | user panel Danger zone → ConfirmDialog (destructive variant on grant *and* revoke), warning callout with semantic warning tokens (U8); self-demotion still blocked inline |
| 24 | Row `…` menu (Reset password / Delete) | L2 | kept on the row; same actions also in the user panel footer |
| 25 | Reset password flow | L3 | Dialog from row menu or panel (kept); secure generation (U14); CopyField |
| 26 | Delete user (self-delete guard) | L3 | ConfirmDialog ("This permanently deletes {email}…"); toast only after resolution (U4); self-delete item disabled with tooltip instead of post-click toast |
| 27 | zod row validation | — | kept (schema fixed: string id, drop unused roles array — U20) |
| 28 | Users empty state | L1 | EmptyState primitive |
| 29 | Pagination controls | L1 | table footer; dead closure fixed, page-size mismatch resolved (U16) |
| 30 | Rows-per-page selector (commented out) | L2 | resurrected as a real page-size Select in the footer (capability existed in intent; now honest) — or deleted outright if product says no; never shipped commented |
| 31 | Roles header + back link | L1 | → Roles tab under the shared PageHeader |
| 32 | Roles fetch (limit 100) | L1 | Roles tab table; server pagination added past 100 (U12) |
| 33 | Roles search | L1 | Toolbar search (same slot, per-tab placeholder) |
| 34 | Create role | L1 action → L2 editor | "New role" header action → **role panel** (Sheet), not a mega-dialog |
| 35 | Roles table columns | L1 | Role / Permissions / Updated; Created + exact times → panel meta block (L2) |
| 36 | Permission summary badges (all areas) | L1 | Permissions column — **now includes Evals & Budgets** (U3) |
| 37 | Edit role | L2 | row click or `…` → role panel with prefilled matrix |
| 38 | Delete role (reserved-role guard) | L3 | panel footer + row `…` → ConfirmDialog; reserved roles show disabled action + "System role" tooltip |
| 39 | Role name (reserved lock + helper) | L2 | panel field; lock note as muted helper, not destructive red |
| 40 | 7-area permission editor | L2 | → **PermissionMatrix** in the panel: 7 rows × (None / Read / Write) segmented controls, area icon + name + info tooltip with the description; one viewport, no nested cards (U11) |
| 41 | Null coercion + cancel/submit | L2 | panel footer (sticky), unchanged data behavior |
| 42 | Roles loading/empty states | L1 | skeleton rows + EmptyState |
| 43 | Teams header + back link | L1 | → Teams tab |
| 44 | Teams fetch + search | L1 | Teams tab table + Toolbar search; pagination past 100 (U12) |
| 45 | Create team (name + description) | L1 action → L2 | "New team" header action → team panel (two fields) |
| 46 | Teams table columns | L1 | Team / Description / Updated; Created + times → panel meta (L2) |
| 47 | Edit team | L2 | row click → team panel |
| 48 | Delete team | L3 | ConfirmDialog with blast-radius copy ("Users assigned to {team} lose this grouping; budget attribution for this team stops.") (U15) |
| 49 | Teams loading/empty states | L1 | skeleton rows + EmptyState ("Teams group people for cost attribution and sharing.") |
| 50 | Roles gate app navigation | L2 (info) | role panel shows a quiet info line "Changes apply to members' navigation immediately"; behavior unchanged |
| 51 | RBACControl consumers | — | unaffected (data contracts unchanged); its `filters` dead parameter cleaned up (U18); long-term it adopts SearchableSelect — tracked in its consumers' page docs |
| 52 | RoleSelector reuse in /keys; single-valued role/team | — | unchanged; selectors get the full-7-area subtitle fix (#19) |
| 53 | Teams ↔ budgets relationship | L2 | "Budgets →" link in Teams tab header area; budget display itself remains on `/budgets` |
| — | User identity & audit detail (created, last_used, id) | L2/L4 | **NEW user detail panel**: today `GET_USERS` already fetches `created`, `last_used`, `name`, `type` (`queries/queries.ts:677-694`) and shows none of it; the panel surfaces it with CopyField for id/email and a "Raw" L4 toggle for P4-grade debugging |

No item is removed; #2, #13-14, #22-23, #30, #35, #40, #46 move levels with frequency
rationale stated above (rules of the ladder, philosophy §2).

### Layout & components

**Shared shell (all three tabs)**
- `PageShell` (full-bleed work-surface variant) → `PageHeader` (title `text-2xl`, description
  `text-sm text-muted-foreground`, action slot) → `Tabs` (shadcn, `h-9`, value bound to route;
  `router.push` on change) → `Toolbar` → table → pagination. Vertical rhythm `space-y-6`;
  padding `p-8` desktop / `p-4` mobile (CLAUDE.md spacing scale).
- Tables: shadcn `Table` in a single `rounded-md border` (no card nesting). Cells `text-sm`;
  secondary lines `text-xs text-muted-foreground`; ids/emails that get copied `font-mono
  text-xs` in panels.
- StatusDot (shared primitive, also proposed by `design/pages/models.md`): `size-2
  rounded-full` + label; verified = success token, pending = warning token.
- Inline-edit cells (#18/#20): ghost button look — value text + `Pencil` icon at
  `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`; opens existing
  RoleSelector/TeamSelector `Popover`+`Command`; pick → shared `ConfirmDialog`.
- Selection bar: `bg-muted/50 rounded-md p-2`, "n selected", destructive-outline "Remove",
  ghost "Clear".
- `EmptyState`, `ConfirmDialog` from philosophy §5. **One** ConfirmDialog component handles:
  bulk remove, delete user, role change, team change, super-admin grant/revoke, delete role,
  delete team — seven of today's patterns collapse into one (U2).

**User detail panel** — shadcn `Sheet`, right, `sm:max-w-md`:
- Identity: email (CopyField), StatusDot verified/pending, created date, last used, user id
  (CopyField, mono). L4: "Raw" toggle → `font-mono text-xs` JSON in `bg-muted` block.
- Access section: Role select, Team select (same selectors, same ConfirmDialog).
- Actions: "Reset password" (outline) → existing dialog (#25).
- Danger zone (`border-destructive/20` section): Super admin toggle (super-admin viewers
  only, #23) and "Delete user" (destructive) → ConfirmDialog.

**Role panel** — `Sheet`, right, `sm:max-w-lg`:
- Name `Input` (+ "System role — name locked" muted helper when reserved).
- **PermissionMatrix** (new, local component): one row per area — icon, label, `Info` tooltip
  carrying the area description (#40's copy preserved verbatim), and a 3-state segmented
  control (`ToggleGroup type="single"`: None / Read / Write) with proper `aria-label`s.
  Radio semantics preserved; presentation compacted from ~1400px of cards to ~320px.
- Info line: "Members see navigation changes immediately." (#50).
- Meta block: created/updated (L2 home of #35's timestamp columns).
- Sticky footer: Cancel (outline) + Save (primary, loading spinner); Delete (ghost
  destructive, disabled+tooltip for reserved roles) → ConfirmDialog.

**Team panel** — `Sheet`, right, `sm:max-w-md`: Name, Description (`Textarea rows=3`), meta
block, footer as role panel; Delete with blast-radius ConfirmDialog (#48).

**Dialogs kept as dialogs** (single-step, small): Add user (#10-12), Reset password (#25) —
they never open from inside a Sheet-with-Sheet flow; from the panel they replace it
(philosophy: one overlay at a time — panel closes, dialog opens, returns to list).

**i18n:** every string through the message catalog under an `access.*` namespace, en + de
(fixes U9), including ConfirmDialog copy and toasts.

### Mobile behavior

Designed for P3's mobile job (personas.md): *respond to an alert — find the person, fix the
role, deactivate, one-handed.* Read-mostly, critical actions reachable.

- **< md (390px target):** remove the `hidden md:flex` gate (U1). Tabs render as a
  full-width segmented control under the header (3 labels fit at 390px). Tables become
  **card lists** (standard tables→cards from `design/responsive.md`):
  - User card: email (truncating) + StatusDot line + "Role · Team" muted line; tap → user
    panel as **bottom sheet** (`max-h-[85vh]`, scrollable). All edits/actions live in the
    sheet — inline cell editing is desktop-only sugar, the panel is the canonical editor.
  - Role card: name + permission badges (wrap, max 2 lines); tap → role bottom sheet; the
    PermissionMatrix stacks: area label above, segmented control below, full-width.
  - Team card: name + truncated description; tap → team bottom sheet.
  - Toolbar: search full-width; Role/Team filters collapse into one "Filter" button opening a
    small sheet; "View" hidden (no columns to toggle on cards).
  - Pagination: prev/next + "Page x of y" only.
  - Bulk selection: "Select" in a toolbar overflow menu enters selection mode (checkboxes on
    cards); same ConfirmDialog.
  - Add user / Reset password dialogs already fit small screens (`max-w-md`); buttons
    full-width stacked.
- **md–lg:** table view with the L1 column set; detail Sheets from the right; filters inline;
  first/last pagination appears at `lg` as today.
- **≥ lg:** full table, "View" column menu, optional columns restorable.
- No horizontal scroll anywhere (anti-pattern #9); no `window.confirm` (native dialogs are
  worst on mobile).

### Motion

Per CLAUDE.md timings, all respecting `prefers-reduced-motion`:

- Row/card hover and inline-edit pencil reveal: 150ms background/opacity, `ease-in-out`.
- Detail Sheet: 300ms slide (right ≥ md, bottom < md) — explains origin (the row).
- Tab switch: 200ms content crossfade, no slide (tabs are siblings, not hierarchy).
- Selection bar: 200ms slide/fade above the table (causality: selecting made it appear).
- ConfirmDialog: default shadcn 200ms scale/fade.
- First load: skeleton rows mirroring table/card layout; no spinner walls (replaces the
  centered Loader2 blocks, `roles/page.tsx:249-253`, `teams/page.tsx:183-187`). Nothing else.

---

## 4. Implementation notes

**Files to change**
- `app/(application)/users/page.tsx` — PageShell/PageHeader/Tabs composition; remove
  `hidden md:flex` (U1); move role/team-change confirms out of `window.confirm`.
- `app/(application)/users/components/data-table.tsx` — Toolbar extraction; debounced search
  + page reset (U10); selection bar + ConfirmDialog bulk remove (U2/U4); pagination fixes
  (U16); card list < md; drop poll for `cache-and-network` + focus refetch (U19); remove
  "Manage roles/teams" buttons (→ tabs).
- `app/(application)/users/components/columns.tsx` — User column with StatusDot + Shield
  glyph (U7); inline-edit cells for Role/Team; server-honest sort handling (U10).
- `app/(application)/users/components/data-table-row-actions.tsx` — ConfirmDialog adoption;
  post-resolution toasts (U4); disabled self-delete item; `crypto.getRandomValues` (U14).
- `app/(application)/users/components/super-admin-toggle.tsx` — relocate into user panel
  Danger zone; semantic warning/destructive tokens (U8).
- `app/(application)/users/components/add-user-modal.tsx` — inline validation, SSO error
  handling (U17), shared password generator + CopyField.
- **NEW** `app/(application)/users/components/user-detail-panel.tsx` — Sheet with identity,
  access, danger zone, raw view (L2/L3/L4).
- `app/(application)/roles/page.tsx`, `app/(application)/teams/page.tsx` — rebuild on the
  shared shell + tabs; tables per §3; ConfirmDialogs; full-7-area badges (U3); server
  pagination beyond 100 (U12).
- **NEW** `app/(application)/roles/components/role-panel.tsx` (+ `permission-matrix.tsx`),
  **NEW** `app/(application)/teams/components/team-panel.tsx` — replacing the Dialog+form
  composition; `components/role-form.tsx` / `components/team-form.tsx` are absorbed (check
  for other importers first — currently only these pages).
- `components/ui/role-selector.tsx` — subtitle summary covering all 7 areas (U3).
- `components/rbac.tsx` — remove the ignored `filters` variable (U18); no behavior change.
- `users/data/schema.ts` — id type + unused field cleanup (U20).
- `messages/en.json` / `messages/de.json` — `access.*` namespace (U9).
- `queries/queries.ts` — optional: wire `SortBy` variables for user sorting (restores honest
  column sort, ladder #16); roles/teams pagination variables already exist.

**Shared components needed**
- From philosophy §5: `PageShell`, `PageHeader`, `Toolbar`, `ListDetail` (table + Sheet
  detail variant), `EmptyState`, `ConfirmDialog`.
- **NEW shared primitives not yet in philosophy §5** (shared with `design/pages/models.md`'s
  proposals — coordinate, build once):
  - `StatusDot` — quiet semantic status (verified/pending here; active/inactive elsewhere).
  - `CopyField` — mono value + one-click copy + toast (passwords, emails, ids).
  - `SearchableSelect` — the Popover+Command combobox pattern (RoleSelector, TeamSelector,
    RBAC pickers all hand-roll it today).
  - `FormSection` — collapsible form group (used by the panels' meta/danger sections).
  - `InlineEditCell` — **new proposal from this page**: display-as-text, edit-on-click table
    cell wrapping a SearchableSelect + ConfirmDialog; likely reusable wherever a list row
    carries one assignable attribute (e.g. keys → role).
  - `PermissionMatrix` stays local to roles until a second consumer appears.

**Scope: L.** Three routes rebuilt on the shared shell, three new panel surfaces, a tabbed
navigation pattern, the permission-matrix redesign, responsive card layouts for all three
lists, ConfirmDialog consolidation across seven call sites, and full i18n. No backend/schema
changes required (sort wiring and >100 pagination use existing GraphQL arguments).

**Dependencies**
- Shell/nav redesign (`design/navigation.md`): Administration group; decision whether the nav
  label becomes "Users & access"; tabs-vs-three-nav-items must be settled there (this doc
  assumes one nav item + tabs).
- Shared primitives existence (`design/codebase-structure.md`); `design/responsive.md`
  tables→cards and sheet standards.
- ConfirmDialog primitive must support: destructive + non-destructive variants, async pending
  state, and per-item bulk error reporting (U4).
- `/keys` consumes `RoleSelector` (#52) — subtitle change ships to both surfaces; verify
  layout there.
- `/budgets` link from Teams tab (#53) — text link only, no data dependency.

**Risks**
- Replacing `window.confirm` changes timing semantics: today's confirms are synchronous and
  blocking; ConfirmDialog is async — guard against double-submission while the dialog is open
  (disable the triggering cell).
- Role edits have immediate blast radius on navigation for all members (#50) — the panel's
  info line is required, and the ConfirmDialog on *save* (not just delete) should state the
  member impact for permission downgrades.
- The `type ne "api"` filter (#5) is the only thing separating people from API-key accounts in
  this table — any query refactor must preserve it or API keys appear as deletable "users".
- Server-side user deletion is hard delete (no deactivate exists in the schema surfaced
  here). The redesign must not soften the copy into "deactivate"; if product wants
  deactivation (personas.md P3 JTBD 1 says "deactivate"), that's a backend feature request —
  flag, don't fake.
- Removing the 30s poll: keep refetch-on-focus so an admin returning to the tab still sees
  fresh data (e.g. emailVerified flipping after a user's first login).
- zod schema change (#27/U20): verify the GraphQL `ID` serialization for users before
  switching `z.number()` → `z.string()`; a mismatch throws at render time in row actions.
