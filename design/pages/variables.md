# Variables / Secrets — Review & Design Concept
**Routes:** `/variables`, `/variables/create`, `/variables/edit/[variable_id]`, `/variables/usage/[variable_id]`  **Primary persona:** P3 Admin  **Secondary:** P4 Developer (deployment env vars, copy names/ids)  **Current state:** a generic CRUD table wearing a vault's badge — secret values are fetched to the browser for every row, the entire "where is this used" pillar is dead code, bulk delete has no confirmation, and the list page renders nothing on mobile.

This area is the org's secret store: variables (plain or encrypted) that credentials, agents,
models, and embedder configs depend on. The special mandate — **safety, scoping visibility,
and "where is this used"** — is exactly where the current implementation is weakest. The
redesign's center of gravity is therefore not visual: it is making reveal a deliberate,
on-demand act, making usage information real before anything destructive, and making every
dangerous flow explain its blast radius.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File references relative to repo root.

**Navigation & gating**

1. Sidebar nav item with translated label `navigation.systemVariables` — **"Vault"** in English, **"Systemvariablen"** in German — `Variable` icon, visible only when `user.super_admin || role.variables === "write"` (`components/custom/main-nav.tsx:228-234`; `messages/en.json:24`, `messages/de.json:24`). The `variables` RBAC right supports three levels — "" (No Access), `read` (Read Only), `write` (Read/Write) (`components/role-form.tsx:19-23,39-43`) — but a `read` role gets **no nav entry at all** today.
2. All four routes are client components with `export const dynamic = "force-dynamic"` (`variables/page.tsx:8`, `create/page.tsx:18`, `edit/[variable_id]/page.tsx:19`, `usage/[variable_id]/page.tsx:26`). No frontend route guard; authorization is enforced by the GraphQL backend only.
3. `createColumns(user)` receives the current user from `UserContext` but never uses it — dead parameter (`variables/page.tsx:10-12`; `variables/components/columns.tsx:21`).

**List page — `/variables`**

4. Page header: title "Variables" (`text-2xl font-bold`) + description "Manage your application variables and secrets." (`variables/page.tsx:19-22`).
5. The entire page root is `hidden h-full flex-1 flex-col space-y-8 p-8 md:flex` — desktop-only by construction (`variables/page.tsx:16`).
6. Server-paginated variables table, hard-coded 10 per page, default sort `updatedAt DESC` (query default), **30-second polling** with `fetchPolicy: "no-cache"` (`variables/components/data-table.tsx:92-101`; `GET_VARIABLES` at `queries/queries.ts:1446-1476`). The list query selects `id name value encrypted createdAt updatedAt` — i.e. **every variable's value, including encrypted secrets, is shipped to the client on every page load and every poll** (`queries/queries.ts:1466-1473`).
7. Stale-while-loading: previous page's data shown while a refetch is in flight (`data-table.tsx:113-124`).
8. Name search: "Filter variables..." input building a server-side `{ name: { contains } }` filter, refetching on **every keystroke**; width `w-[150px] lg:w-[250px]` (`data-table.tsx:151-165,173-180`).
9. "Reset" ghost button (Cross icon) clears the name filter, shown only while a filter is active (`data-table.tsx:167,232-248`).
10. "Add Variable" primary button (Plus icon) → `/variables/create`, placed inside the toolbar row next to the search input (`data-table.tsx:182-189`).
11. Row-select checkbox per row + select-all-on-page header checkbox, both with `aria-label`s (`columns.tsx:22-45`).
12. Bulk delete: when rows are selected, a **secondary** "Delete" button (Trash2 icon) appears and immediately fires `REMOVE_VARIABLE_BY_ID` per selected row via `Promise.all` — **no confirmation dialog**; success toast with count / destructive error toast; resets selection; spinner in the button while running (`data-table.tsx:191-230`).
13. Column: Name — `max-w-[200px] truncate font-medium` (`columns.tsx:46-60`).
14. Column: Value — `font-mono text-sm`, masked as `••••••••••••••••` when encrypted; truncated to 20 chars + "..." when plain; an **eye / eye-off reveal toggle** (per-row `React.useState` inside the cell render) shown when the variable is encrypted OR the plain value exceeds 20 chars; toggle reveals the full raw value inline (`columns.tsx:61-95`). Hard-coded `hover:bg-gray-100` / `text-gray-500`, and the toggle `<button>` has no aria-label (`columns.tsx:80-90`).
15. Column: Encryption — Lock icon (`text-green-600`) + badge "Encrypted" (`bg-green-100 text-green-800 border-green-300`) or Unlock icon + outline badge "Plain Text"; a values-includes `filterFn` is defined but **no filter UI is wired to it** (`columns.tsx:96-126`).
16. Column: Used By — secondary badge "N resource(s)" + the first two resource type prefixes + "+N more" overflow text, sourced from `row.original.used_by` (`columns.tsx:127-156`). **`used_by` is never selected by `GET_VARIABLES`** (`queries/queries.ts:1466-1473`), so the column always renders "0 resources". A TODO comment admits the backing query is missing (`columns.tsx:133-136`).
17. Column: Created — locale date, `text-sm text-muted-foreground` (`columns.tsx:157-169`).
18. Per-column sort dropdown in headers: Asc / Desc / Hide column (`variables/components/data-table-column-header.tsx:34-69`). Sorting state is held in the table but **never sent to the server** — with manual pagination it silently sorts only the current 10 visible rows (`data-table.tsx:90,126-149`; `GET_VARIABLES` `sort` variable never passed at `data-table.tsx:95-99`).
19. Column-visibility "View" dropdown toggling hideable columns — **hidden below `lg`** (`variables/components/data-table-view-options.tsx:23-58,:29`).
20. Row-actions dropdown (ghost `…` button with `sr-only` label): "Edit variable" → `/variables/edit/[id]`; "View usage (N)" → `/variables/usage/[id]` shown **only when `used_by.length > 0`** (never true today per #16); separator; "Delete variable" in red (`variables/components/data-table-row-actions.tsx:75-108`).
21. Single-delete confirmation AlertDialog: names the variable, warns "**Warning:** This variable is currently used by N resource(s)…" when `used_by` is non-empty (never triggers per #16), "This action cannot be undone.", red confirm button; success/error toasts (`data-table-row-actions.tsx:110-139,52-71`).
22. Empty table state — and, unintentionally, the **list error state**: single full-width row
"No variables found." (`data-table.tsx:289-298`). `error` is destructured from `useQuery` but
never consumed (`data-table.tsx:92`); when `GET_VARIABLES` fails on first load, `items` stays
undefined and the table falls through to this same row — a backend failure renders as an empty
vault (see U19).
23. Pagination footer: "x of y row(s) selected" (counts current page only), "Page x of y", first/prev/next/last icon buttons with `sr-only` labels, disabled from `pageInfo.hasPreviousPage/hasNextPage`; first/last `hidden lg:flex` (`data-table.tsx:302-366`).
24. Vestigial plumbing that must not be confused for behavior: the `usePagination` hook's `limit`/`skip` are computed but never passed to the query (`data-table.tsx:60-73,104`); the `VariableFilters` type supports `encrypted`, `createdAt`, `updatedAt` server filters that have no UI (`data-table.tsx:49-54`); "Reset" clears only the name filter (`data-table.tsx:235-243`).

**Create — `/variables/create`**

25. Header: outline "Back" button (ArrowLeft) → `/variables`, title "Create Variable", description "Add a new variable to your application" (`create/page.tsx:81-95`).
26. Card "Variable Details / Configure your new variable settings" wrapping the form (`create/page.tsx:97-103`).
27. Field: Variable Name* — placeholder "e.g., API_KEY, DATABASE_URL", helper "A unique identifier for your variable. Use UPPERCASE with underscores for constants."; required asterisk hard-coded `text-red-500` (`create/page.tsx:106-121`).
28. Field: Variable Value* — Textarea, 4 rows, helper text dynamically reflecting the switch: "This will be encrypted / stored as plain text." (`create/page.tsx:123-138`).
29. Field: "Encrypt this variable" Switch — **defaults to OFF** — with helper recommending encryption for "API keys, passwords, and tokens" (`create/page.tsx:24-28,140-153`).
30. Validation: name and value must be non-empty after trim → destructive toast "Validation Error" (`create/page.tsx:40-47`).
31. Submit: `CREATE_VARIABLE` (name trimmed, `queries/queries.ts:1491-1514`), refetches list, success toast naming the variable, redirect to `/variables`; server error surfaced in destructive toast; loading spinner + "Creating..." in the button (`create/page.tsx:49-71,161-170`).
32. Cancel button (outline) → `/variables` (`create/page.tsx:155-160`).

**Edit — `/variables/edit/[variable_id]`**

33. Loads `GET_VARIABLE_BY_ID` (`queries/queries.ts:1478-1489` — selects `value` but **not `used_by`**); full-page centered spinner while loading (`edit/[variable_id]/page.tsx:33-36,102-108`).
34. "Variable not found" state with "Back to Variables" button — actually a **combined error-or-missing state**: the gate is `if (error || !variable)` (`edit/[variable_id]/page.tsx:110-123`), so a transient load failure also claims the variable doesn't exist (see U19).
35. Header: Back button, title "Edit Variable", description `Modify variable "{name}"` (`edit/[variable_id]/page.tsx:126-140`).
36. Usage warning `Alert` (AlertTriangle): "This variable is currently used by N resource(s). Changes may impact those resources." with an inline link to `/variables/usage/[id]` — **never renders** because `used_by` is not fetched (`edit/[variable_id]/page.tsx:142-153` vs `queries/queries.ts:1478-1489`).
37. Same form as create, prefilled with name/value/encrypted (`edit/[variable_id]/page.tsx:48-56,163-211`). Prefilling `value` means **the stored secret (decrypted or ciphertext — backend-dependent) is returned to the client whenever the edit page opens**.
38. Submit: `UPDATE_VARIABLE` (`queries/queries.ts:1561-1586`), success/error toasts, redirect to `/variables` (`edit/[variable_id]/page.tsx:58-93,219-228`).
39. Cancel button → `/variables` (`edit/[variable_id]/page.tsx:213-218`).
40. "Variable Information" card: Created (locale string), Last Updated, Used by count (always "0 resources" per #36) (`edit/[variable_id]/page.tsx:234-252`).

**Usage — `/variables/usage/[variable_id]`**

41. Loads the variable by id; centered spinner; same "Variable not found" state as edit — and the same error-or-missing conflation: `if (variableError || !variable)` (`usage/[variable_id]/page.tsx:42-45,165-186`, gate at `:173`; see U19).
42. Header: Back button, title "Variable Usage", description `Resources using variable "{name}"` (`usage/[variable_id]/page.tsx:190-203`).
43. "Variable Details" card: Encrypted/Plain Text badge, "Created {date}" description, Name, Used-by count (`usage/[variable_id]/page.tsx:205-227`).
44. Empty state card "No Usage Found — This variable is not currently being used by any resources." — currently **always shown**, since `used_by` is never fetched (`usage/[variable_id]/page.tsx:229-235`).
45. "Resource Usage (N)" table: Type column with icon + badge mapping (`user` → User icon/default badge, `agent` → Bot/secondary, `workflow` → Workflow/outline); Name column resolved per resource via `GET_USER_BY_ID` / `GET_AGENT_BY_ID` with per-row loading spinners and "Unknown User/Agent/Flow" error fallbacks; ID column in mono. Resource ids are parsed from `"type/id"` strings (`usage/[variable_id]/page.tsx:56-163,237-284`).
46. Client-side pagination of the `used_by` array, 10 per page, Previous/Next buttons + "Showing x–y of z resources" + "Page x of y" (`usage/[variable_id]/page.tsx:50-54,286-313`).

**Downstream consumers (context the redesign must not break)**

47. Model form: the "Authentication variable" select lists **encrypted variables only** via `GET_VARIABLES` with an `encrypted eq true` filter, limit 100, and shows "No encrypted variables found. Create one in Variables first." when empty (`app/(application)/models/components/model-form.tsx:63-65,227-257`).
48. Agent edit form: a searchable variable combobox (`CommandInput` "Search variables...") matching the selected variable **by name** — agent configs reference variables by name, so renames silently break agents (`app/(application)/agents/edit/[id]/form.tsx:111-150,304-309`).
49. Knowledge embeddings config: embedder settings select a variable via `GET_VARIABLES` page 1 / limit 100 (`app/(application)/data/components/embeddings.tsx:146-148`).

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | **Secrets are over-fetched and only cosmetically masked.** The list query selects `value` for every row, re-fetched every 30 s by the poll — every secret lives in the browser's memory/network log whether or not anyone looks. The mask is purely visual; reveal requires no deliberate step, no re-fetch, no audit point. For a page whose mandate is safety, this is the defining defect. | `queries/queries.ts:1466-1473`; `data-table.tsx:92-101`; `columns.tsx:61-95` |
| U2 | **High** | **The entire "where is this used" pillar is dead code.** Neither `GET_VARIABLES` nor `GET_VARIABLE_BY_ID` selects `used_by`, so: Used By column always "0 resources" (#16), "View usage" menu item never appears (#20), the edit-page impact warning never renders (#36), the delete-dialog blast-radius warning never triggers (#21), and the usage page always shows "No Usage Found" (#44). The code's own TODO confirms the backing query was never built. The page's special mandate is unimplemented while appearing implemented. | `queries/queries.ts:1446-1489`; `columns.tsx:133-136`; `data-table-row-actions.tsx:93-99`; `edit/[variable_id]/page.tsx:142-153`; `usage/[variable_id]/page.tsx:229-235` |
| U3 | **High** | **Bulk delete of secrets with zero confirmation** — selecting rows and clicking the (secondary-styled!) Delete fires immediately, while single delete gets an AlertDialog. Violates the philosophy rule "anything destructive lives at L3+ with confirmation" on the page where deletion has the largest invisible blast radius (models lose credentials, agents lose config values). | `data-table.tsx:191-230` vs `data-table-row-actions.tsx:110-139` |
| U4 | **High** | The list page renders **nothing below `md`** (`hidden … md:flex`, no fallback). An admin paged at night to rotate a leaked key cannot even see the list from a phone. | `variables/page.tsx:16` |
| U5 | **High** | **Rules-of-Hooks violation on the usage page:** `useQuery` is called inside `currentPageUsedBy.forEach(...)` — hooks in a loop whose length changes with pagination. Latent crash/misbehavior the moment `used_by` ever carries data; also N+1 queries when batch queries exist (`GET_USERS_BY_IDS`, `queries/queries.ts:1608`). | `usage/[variable_id]/page.tsx:77-137` |
| U6 | Med | **Unsafe default:** the Encrypt switch defaults to OFF on create. The path of least resistance on a page nav-labeled "Vault" produces plain-text storage; the helper text even admits encryption is "recommended for API keys, passwords, and tokens". | `create/page.tsx:27,140-153` |
| U7 | Med | **Three names for one area:** the nav says "Vault" (en) / "Systemvariablen" (de) while every page header, button, and toast says "Variables". Users cannot connect the sidebar item to the page they land on. | `messages/en.json:24`, `messages/de.json:24` vs `variables/page.tsx:19` |
| U8 | Med | Hard-coded light-theme colors break dark mode: `hover:bg-gray-100`, `text-gray-500` on the reveal toggle; `text-green-600` and `bg-green-100 text-green-800 border-green-300` on the Encrypted badge. CLAUDE.md mandates semantic HSL tokens. | `columns.tsx:82-87,107-110` |
| U9 | Med | Zero i18n in all four routes — every title, helper, toast, and dialog is hard-coded English in an en/de app (the nav label is the only translated string in the area). | all files under `app/(application)/variables/` |
| U10 | Med | The reveal toggle is a raw `<button>` with no aria-label, no tooltip, and no keyboard-visible focus style — a mystery-meat icon guarding secret values; it also conflates two different jobs (reveal a secret vs. expand a long plain value). | `columns.tsx:80-90` |
| U11 | Med | Search refetches the server on every keystroke (no debounce) and never resets `page` — filtering while on page 3 can strand the admin on an empty page. | `data-table.tsx:151-165,89` |
| U12 | Med | Sort UI implies server sorting but only reorders the current 10 client-side rows (`getSortedRowModel` with `manualPagination`); the default `updatedAt DESC` sort is invisible because no Updated column is shown — the list looks unordered. | `data-table.tsx:90,126-149`; `columns.tsx` (no `updatedAt` column) |
| U13 | Med | Per-row reveal state is `React.useState` inside the cell render; the 30 s no-cache poll replaces the data array, silently re-masking (or unmounting) revealed values mid-read. Fragile pattern and confusing behavior. | `columns.tsx:67`; `data-table.tsx:92-101` |
| U14 | Low | Primary action "Add Variable" sits inside the filter row; when rows are selected, the unconfirmed bulk-Delete button appears directly beside it — adjacency of "create" and "destroy". | `data-table.tsx:182-230` |
| U15 | Low | Encryption `filterFn` and the `encrypted`/`createdAt`/`updatedAt` server-filter fields exist with no UI; "Reset" clears only the name filter. | `columns.tsx:123-125`; `data-table.tsx:49-54,235-243` |
| U16 | Low | No copy-to-clipboard anywhere — not on names (which agents reference verbatim), not on values, not on ids. P4's stated bias is "one-click copy on every ID/key/snippet". | `columns.tsx`, `usage/[variable_id]/page.tsx:277-279` |
| U17 | Low | "Page x of y" can render "Page 1 of -1" before the first response (`pageCount ?? -1`); the selected-rows counter counts only the current page. | `data-table.tsx:128,302-310` |
| U18 | Low | No actor attribution (who created/last changed a variable) and no value-version hint — personas.md P3 asks for "timestamps and actor attribution everywhere" on admin surfaces. Likely a schema gap, flagged as backend dependency in §4. | `queries/queries.ts:1446-1489` (no creator fields) |
| U19 | Med | **Errors masquerade as empty/missing states.** The list destructures `error` from `useQuery` but never consumes it — when `GET_VARIABLES` fails, `items` stays undefined and the table falls through to the same "No variables found." row as a genuinely empty store, so a backend outage renders as an empty vault. Same family on the subpages: edit and usage gate on `if (error \|\| !variable)`, so a transient network/GraphQL failure displays "Variable not found", misleadingly implying the secret was deleted. Violates the ladder rule "nothing critical to trust (errors…) may be hidden below L2" and philosophy §8 ("errors state what happened and what to do next") on the page whose mandate is safety and audit. | `data-table.tsx:92,289-298`; `edit/[variable_id]/page.tsx:110`; `usage/[variable_id]/page.tsx:173` |

### Mobile audit

**Severity: broken.** At 390 px:

- `/variables` renders **literally nothing** — the only root element is `hidden … md:flex`
  with no mobile branch (`variables/page.tsx:16`). The area's entry point is a blank screen.
- Were the gate removed, the 7-column table (select, name, value, encryption, used-by,
  created, actions) has no responsive variants and would overflow horizontally; the search
  input is fixed `w-[150px]` (`data-table.tsx:179`); the "View" menu is `hidden lg:flex`
  (`data-table-view-options.tsx:29`); first/last pagination buttons are `hidden lg:flex`
  (`data-table.tsx:314,353`).
- `/variables/create` and `/variables/edit/[id]` do render (`max-w-2xl mx-auto space-y-6 p-8`,
  `create/page.tsx:81`, `edit/[variable_id]/page.tsx:126`) but `p-8` consumes ~16 % of a
  390 px viewport, and the footer buttons don't stack.
- `/variables/usage/[id]` renders; the 3-column table is borderline — the mono ID column
  (`usage/[variable_id]/page.tsx:277-279`) forces overflow with long UUIDs; no tap-friendly
  copy affordance.
- The reveal toggle (hover-styled, 4×4 icon in a padded button) is small but tappable; the
  real issue is it never appears because the list page is hidden.
- P3's mobile job — *"respond to alerts … one-handed"*, e.g. rotate a leaked credential from
  a phone — is impossible today.

---

## 2. Jobs to be done

**PRIMARY: P3 Admin — "Create and rotate secrets safely, and know exactly what each one
affects before I touch it."** (personas.md JTBD 3: *"Manage secrets and environment variables
safely (create, rotate, see where used — never accidentally expose)"*.)

**P3 Admin (primary owner)** — infrequent, high-stakes visits; ranked by frequency:
1. Rotate a credential: find the variable, replace its value, confirm nothing else needs
   touching (most common deliberate visit; sometimes urgent/mobile).
2. Add a secret for a new integration (usually right before configuring a model — see #47),
   encrypted by default.
3. Audit the store: what exists, what's plain text that shouldn't be, what's unused and can
   be retired, when things last changed.
4. Check blast radius before edit/delete: which users/agents/models/workflows reference this
   variable (the page's special mandate).
5. Delete retired variables — safely, with usage shown first.
6. Occasionally verify a value (debugging a failing integration) — a deliberate reveal, not a
   browse-time default.

**P4 Developer (secondary)** — personas.md JTBD 5 (*"Configure models/providers and
environment variables for the deployment"*):
1. Seed env vars for a fresh deployment (fast create loop, paste-friendly).
2. Copy exact variable names for agent configs / API payloads (one-click copy; names are
   referenced verbatim — #48).
3. Verify which variable a failing model/agent points at; occasionally reveal a value while
   debugging.

**P2 Power user** — does not visit this page; they consume variables through the agent form
combobox (#48). Their need is satisfied by keeping name-stability and the lite list contract,
not by L1 real estate here.

**Ownership matrix check:** personas.md lists `/variables` as **P3 primary / P4 secondary —
correct; no correction needed.** One implementation mismatch to record (not a matrix change):
the RBAC model defines a `read` level for `variables` (`role-form.tsx:21`) but the nav only
renders the item for `write` (`main-nav.tsx:228`), and the pages render full edit/delete UI
regardless of role. The redesign should honor `read` with a visible, read-only page (see §3/§4).

---

## 3. Design concept

**Headline:** A vault that behaves like one — a calm masked-by-default list that never ships
secret values to the browser; reveal is a deliberate on-demand act; every variable carries a
live "used by" trail; and every destructive or risky flow (delete, rename, decrypt) states its
blast radius before the confirm button.

### Default view (L1)

What a P3 admin sees arriving at `/variables`, top to bottom:

1. **PageHeader** — title **"Variables"** (`text-2xl`), one-line purpose: "Secrets and
   environment variables your models, agents, and integrations depend on." Primary purple
   action on the right: **"Add variable"**. (Naming unified — the nav label changes from
   "Vault" to match; one concept, one name; fixes U7.)
2. **Toolbar** directly below — debounced search ("Search variables…", 300 ms, resets to
   page 1), a quiet **Type** filter (All / Secrets / Plain text — finally wiring #15/#24),
   and the column-visibility "View" menu at the right edge.
3. **The table** (ListDetail's list side) — deliberately *valueless*. Columns:
   - **Name** — `font-mono text-sm font-medium`, truncating; hover/focus shows a CopyField
     affordance (names are referenced verbatim by agents, #48).
   - **Type** — quiet, not shouting: Lock icon + "Secret" (muted, no green pill) or
     Unlock + "Plain text"; plain text is the state that earns attention, rendered with a
     subtle warning tint — on a vault, *unencrypted* is the anomaly (inverts #15's emphasis;
     fixes U8 with semantic tokens).
   - **Used by** — "3 resources" count chip; "—" when unused (#16, made real via the backend
     work in §4). Clicking it opens the detail panel on its Usage tab.
   - **Updated** — relative time ("2d ago"), making the default `updatedAt DESC` sort legible
     (fixes U12's invisible ordering); Created available via "View".
   - Row click opens the **detail panel** (L2). A `…` row-action menu remains for
     Edit / View usage / Delete (#20).
   - **No Value column at L1.** Values are never fetched with the list (fixes U1). The
     capability of viewing a value is *relocated* to the detail panel's reveal flow (L2→L3),
     not removed.
4. **Pagination footer** as today (#23), selected-count text only while a selection exists,
   "of -1" fixed (U17).
5. **EmptyState** (first run): Lock icon, "No variables yet. Store API keys and config values
   once — agents, models, and integrations reference them by name.", primary "Add variable"
   (#22 upgraded).
6. **List error state** — distinct from empty, never sharing its copy (fixes U19): when
   `GET_VARIABLES` errors, the table body renders an inline error block in the same slot —
   AlertTriangle icon (destructive token), "Couldn't load variables." + one plain-language
   sentence ("The vault is unreachable — your variables are unaffected."), and an outline
   **Retry** button wired to `refetch`. The raw error message sits one level deeper (L3,
   collapsible "Details" disclosure) per philosophy §8. An admin must always be able to tell
   "the store is empty" from "the list failed to load".

**Detail panel (L2)** — the one new surface, opened by row click (Sheet from the right,
`sm:max-w-md`):
- Header: variable name (mono) + Type badge.
- **Value** section: a `SecretField` — masked placeholder by default. "Reveal" button
  triggers an on-demand `GET_VARIABLE_VALUE` fetch *at that moment*; value displays for 30 s
  or until panel close, with an explicit "Hide" and a countdown affordance; "Copy" copies
  without revealing (fetches, writes to clipboard, toasts — never paints the value). This is
  the audit point the current eye-toggle lacks (fixes U1/U10/U13).
- **Used by** tab/section: the usage list (#45) — type icon + badge, resolved name, mono id
  with copy — with its count and pagination (#46). Loading via batch queries (fixes U5).
- **Meta**: Created, Last updated (full timestamps), id CopyField; actor attribution when the
  backend provides it (U18).
- Footer: **Edit** (default button → `/variables/edit/[id]`) and **Delete** (ghost
  destructive → ConfirmDialog #21).

**Read-only mode:** when `role.variables === "read"` (and not super_admin), the nav item
renders, the page renders, but "Add variable", Edit, Delete, bulk select, and Reveal are not
rendered (value access stays write-gated); the detail panel is the audit view. Write mode is
unchanged for `write`/super_admin (#1). **Deep links to the write routes:** `/variables/create`
and `/variables/edit/[variable_id]` have no frontend guard today (#2 — backend-only auth);
they gain a client-side role check that redirects a `read` user to `/variables` (for edit:
with that variable's detail panel open, preserving the audit intent of the link) plus a quiet
toast "Read-only access — changes require the write permission." No 404, no half-rendered
form. The redirect is UX, not security: the backend remains the authorization authority for
all mutations (see Risks).

**Primary action:** "Add variable" — the only purple on the screen.

### Disclosure ladder

Every inventory item mapped. "→" marks a move from the current location.

| # | Capability | Level | Where it lives |
|---|------------|-------|----------------|
| 1 | Sidebar nav entry (RBAC-gated) | L0 | Sidebar, Administration group; label unified to "Variables"/"Variablen"; rendered for `read` and `write` (read gets read-only page) |
| 2 | force-dynamic client routes, backend auth | — | unchanged (infrastructure); create/edit additionally gain the client-side `read`-role redirect guard (§3 Read-only mode) — backend auth stays authoritative |
| 3 | `createColumns(user)` dead param | — | removed; role now genuinely consumed for read-only rendering |
| 4 | Page title + purpose | L1 | PageHeader |
| 5 | Desktop-only `hidden md:flex` gate | — | **removed**; replaced by responsive layout (§ Mobile) |
| 6 | Server-paginated list (10/page, updatedAt DESC) | L1 | ListDetail table; 30 s poll dropped for refetch-on-focus + after mutations; list query no longer selects `value` |
| 7 | Stale-while-loading | L1 | kept; skeleton rows on first load |
| 8 | Name search (server `contains`) | L1 | Toolbar search, debounced 300 ms, resets page (fixes U11) |
| 9 | Reset filter | L1 | clear "×" inside the input + "Reset" chip when any filter active (clears *all* filters, fixes U15) |
| 10 | Add Variable → /variables/create | L1 | → PageHeader primary action (fixes U14) |
| 11 | Row selection / select-all | L2 | checkboxes appear on row hover/focus + header "select all"; selection mode via toolbar overflow on touch |
| 12 | Bulk delete | L3 | selection bar "n selected · Delete" → **ConfirmDialog** listing names and total used-by count (fixes U3) |
| 13 | Name column | L1 | table column, mono, copy-on-hover |
| 14 | Value display + reveal toggle | L2/L3 | → detail panel `SecretField`: masked at L2; **Reveal/Copy are L3 deliberate actions with on-demand fetch + auto-remask**. Long-plain-value expansion is subsumed (panel shows full value when revealed) |
| 15 | Encryption status + dormant filterFn | L1 | Type column (quiet); **Type filter wired in Toolbar** |
| 16 | Used By count + types preview | L1 | "Used by" count chip in table (backend-made-real); types preview → panel Usage tab |
| 17 | Created date column | L2 | → detail panel Meta + optional column via "View" |
| 18 | Column sort (asc/desc/hide) | L2 | click-to-toggle headers **wired to the server `sort` variable** (fixes U12); hide stays in header menu |
| 19 | Column-visibility "View" menu | L2 | Toolbar right edge |
| 20 | Row actions: Edit / View usage / Delete | L2 | row `…` menu (kept); row click → detail panel; "View usage" no longer conditional on a count that never loads — always present, opens panel Usage tab |
| 21 | Single-delete confirm + usage warning | L3 | shared ConfirmDialog; usage warning now real and **blocking-style copy** when used > 0 ("3 resources will lose this value — review usage first", with a "View usage" link inside the dialog) |
| 22 | List empty state — and the accidental error state | L1 | EmptyState primitive (genuinely empty store only); **query failure gets a distinct inline error state with Retry, consuming `useQuery`'s `error` — a backend failure never again renders as an empty vault (fixes U19)**; raw error detail at L3 |
| 23 | Pagination footer | L1 | table footer; prev/next everywhere, first/last ≥ md |
| 24 | Vestigial filters/limit-skip plumbing | L2 | `encrypted` filter wired (#15); `createdAt`/`updatedAt` become sortable columns (#18); dead `usePagination` deleted |
| 25 | Create page header + back | L2 | PageShell centered subpage, PageHeader with back chevron |
| 26 | "Variable Details" card | L2 | plain form sections (no card-in-page box; philosophy §4) |
| 27 | Name* field + format helper | L2 | form Essentials; live format hint; uniqueness error surfaced inline on submit |
| 28 | Value* textarea + dynamic helper | L2 | form Essentials; mono textarea; helper reflects type choice |
| 29 | Encrypt switch | L2 | **inverted into a "Type" choice: Secret (encrypted, default) / Plain text** — safe by default (fixes U6); choosing Plain shows a quiet warning line |
| 30 | Non-empty validation toast | L2 | inline field errors + toast fallback (same rule) |
| 31 | Create submit + toasts + redirect | L2 | sticky form footer |
| 32 | Cancel → /variables | L2 | form footer |
| 33 | Edit data load + spinner | L2 | edit subpage; form-shaped skeleton instead of spinner wall |
| 34 | "Variable not found" / load-failure state | L2 | **split (U19 family):** genuine not-found (query succeeds, no record) → EmptyState styling with back link; query `error` → distinct error state "Couldn't load this variable." with Retry + back — a transient failure no longer implies the secret was deleted |
| 35 | Edit header naming the variable | L2 | PageHeader, mono name |
| 36 | Usage-impact warning + link | L2 | restored and real: warning callout when used > 0, linking to the usage view; **rename adds an explicit second warning** (agents reference by name, #48) inside the save ConfirmDialog |
| 37 | Prefilled form incl. value | L2/L3 | name/type prefill at L2; **value field starts masked-empty with "value unchanged" semantics — "Replace value" expands the input (rotation-first), "Show current value" is the same L3 reveal as the panel** — the edit page no longer auto-fetches the secret (fixes U1 on edit) |
| 38 | Update submit + toasts + redirect | L2 | sticky footer; risky changes (rename-in-use, Secret→Plain) route through ConfirmDialog (L3) |
| 39 | Cancel | L2 | form footer |
| 40 | Variable Information card | L2 | → Meta block on the edit page sidebar/footer (created/updated/used-by, id CopyField) |
| 41 | Usage page load/not-found states | L2 | kept on the standalone route; same skeleton/EmptyState patterns; **same not-found vs. load-error split as #34 (U19 family)** |
| 42 | Usage page header | L2 | PageHeader with back chevron; route kept for deep links from dialogs/alerts |
| 43 | Variable details card on usage page | L2 | condensed summary strip (name, type, count) above the list |
| 44 | "No Usage Found" empty state | L2 | EmptyState ("Not referenced by any resource — safe to edit or delete.") |
| 45 | Resource list (type icon/badge, resolved names, mono id) | L2 | usage list, same rendering in panel tab and standalone route; names resolved via **batch** queries (fixes U5); each row links to the resource (agent/user/model) and gets a copy-id affordance (U16) |
| 46 | Usage pagination | L2 | kept (10/page) in both surfaces |
| 47 | Model form encrypted-variable select | — | unchanged contract; consumers migrate to the new lite list query (id/name/encrypted only) — strictly less data, same shape |
| 48 | Agent form variable combobox (by-name reference) | — | unchanged; informs the rename warning (#36) |
| 49 | Embeddings config variable select | — | unchanged; same lite-query migration as #47 |

Nothing is deleted; #14 and #37 are the only relocations that change a habit (inline eye →
panel reveal), and they move *up* in deliberateness precisely because the philosophy demands
destructive/sensitive acts live at L3.

### Layout & components

**`/variables`**
- `PageShell` (full-bleed work-surface variant) → `PageHeader` (title `text-2xl`, description
  `text-sm text-muted-foreground`, action slot) → `Toolbar` → table → pagination footer.
  Vertical rhythm `space-y-6`; padding `p-8` desktop / `p-4` mobile (CLAUDE.md spacing scale).
- Table: shadcn `Table` in a single `rounded-md border` (no nested boxes). Name cells
  `font-mono text-sm`; secondary text `text-xs text-muted-foreground`.
- Type indicator: Lock/Unlock at `size-4`, `stroke-width 1`, semantic tokens —
  secret = `text-muted-foreground` + plain label; plain text = warning-token tint
  (`text-orange-600 dark:text-orange-400` via the established warning variable). No green:
  encrypted is the *normal* state and stays quiet (philosophy: "status is quiet until it isn't").
- Used-by chip: `Badge variant="secondary"` with count; `text-muted-foreground "—"` when 0.
- Detail panel: shadcn `Sheet` (right, `sm:max-w-md`; bottom sheet < md). Sections separated
  by whitespace + `text-xs uppercase text-muted-foreground` labels, not boxes.
  `SecretField` (NEW primitive, see §4): `bg-muted rounded-md p-2 font-mono text-sm` value
  area, Reveal/Hide ghost button with `aria-label` + tooltip, Copy button, auto-remask.
- Bulk-selection bar: slides in above the table (`bg-muted/50 rounded-md p-2`): "n selected",
  destructive-outline Delete → `ConfirmDialog`, ghost "Clear".
- `EmptyState`, `ConfirmDialog` from philosophy §5 primitives; `Skeleton` rows on first load;
  inline list error state (AlertTriangle in destructive token, message, outline Retry,
  collapsible raw detail) rendered in the table-body slot on query failure (U19) — same
  component reused by the edit/usage load-error states (#34/#41).
- All strings via next-intl (`variables.*` namespace), en + de (fixes U9); nav key
  `navigation.systemVariables` re-translated to "Variables"/"Variablen".

**`/variables/create`, `/variables/edit/[id]`**
- `PageShell` centered-content variant, `max-w-2xl`; `PageHeader` with back chevron.
- Form `space-y-6`, two visible groups, no Card wrappers:
  1. **Essentials:** Name (`Input`, mono), Type (two-option `RadioGroup` or segmented
     control: "Secret — encrypted at rest" *(default)* / "Plain text", replacing the Switch),
     Value (`Textarea` mono, 4 rows; on edit: collapsed "Replace value" affordance per #37).
  2. **Meta** (edit only): created/updated timestamps, used-by count linking to usage, id
     CopyField — replaces the "Variable Information" card (#40).
- Risky-change interception on save (edit): rename while used > 0, or Secret→Plain →
  `ConfirmDialog` stating consequences (one dialog max — never dialog-on-dialog).
- Sticky footer (`border-t bg-background p-4`): primary submit + outline Cancel.
- Required markers use the destructive token, not `text-red-500` (U8-class hard-coded-color cleanup).

**`/variables/usage/[id]`** — kept as a thin standalone page (deep-link target from dialogs
and the edit warning): summary strip + the same usage list component the panel uses.

- shadcn inventory: `Table`, `Sheet`, `Badge`, `Button`, `Input`, `Textarea`, `RadioGroup`,
  `DropdownMenu`, `AlertDialog` (via ConfirmDialog), `Tooltip`, `Skeleton`, `Checkbox`.

### Mobile behavior

Designed for P3's mobile job: *"respond to alerts — rotate a leaked secret one-handed."*

- **< md (390 px target):** drop the `hidden md:flex` gate (fixes U4). The table becomes a
  **card list** (standard tables→cards per `design/responsive.md`): each card = mono name
  (truncating), Type icon, used-by count, relative updated time. Tap → detail **bottom
  Sheet** (`max-h-[85vh]`, scrollable) with the same SecretField, Usage tab, and Edit/Delete
  — rotation is fully possible on a phone: search → tap → Edit → Replace value → Save.
  Toolbar: search full-width; Type filter as a segmented chip row; "View" hidden (irrelevant
  for cards). Selection mode via toolbar overflow "Select" (no hover affordances). Pagination:
  prev/next + "Page x of y".
- **Forms < sm:** single column, `p-4`, sticky footer buttons full-width side by side;
  reveal/copy buttons sized `h-10` for touch.
- **Usage list < md:** rows become two-line cards (type badge + name / mono id with copy);
  no horizontal scroll for UUIDs.
- **md–lg:** full table with the L1 column set; detail Sheet from the right; "View" menu
  available from `md` (today's `lg` gate relaxed); first/last pagination restored.
- **≥ lg:** identical plus optional columns (Created) restorable.

### Motion

Per CLAUDE.md timings, all honoring `prefers-reduced-motion`:

- Row/card hover: background transition 150 ms `ease-in-out`.
- Detail Sheet: slide-in 300 ms (right ≥ md, bottom < md) — explains origin (the tapped row).
- **Reveal:** mask→value crossfade 200 ms; auto-remask after 30 s with a quiet 300 ms fade —
  the one signature moment, reinforcing "this is deliberate and temporary".
- Bulk-selection bar: slide/fade in 200 ms — explains causality (selection summoned it).
- Type choice on create: helper text crossfade 150 ms when switching Secret/Plain.
- First load: skeleton rows/cards mirroring the layout; form-shaped skeleton on edit. No
  other animation.

---

## 4. Implementation notes

**Files to change**
- `app/(application)/variables/page.tsx` — PageShell/PageHeader/Toolbar composition; remove
  `hidden md:flex`; move "Add variable" to header; read-only rendering for `role.variables === "read"`.
- `app/(application)/variables/components/data-table.tsx` — debounced search + page reset
  (U11), wire server `sort` (U12), Type filter, bulk delete behind ConfirmDialog (U3),
  selection bar, skeleton rows, card layout < md, drop the 30 s poll for refetch-on-focus,
  delete dead `usePagination` (#24), fix "of -1" (U17); **consume the currently-unused
  `error` from `useQuery` (`data-table.tsx:92`)** and branch the table body three ways —
  skeleton / inline error state with Retry (`refetch`) / EmptyState — instead of letting a
  failed query fall through to the "No variables found." row (`data-table.tsx:289-298`, U19).
- `app/(application)/variables/components/columns.tsx` — remove Value column (U1); Name with
  copy-on-hover; quiet Type cell with semantic tokens (U8); real Used-by chip; Updated
  (relative) column; remove dead `currentUser` param (#3).
- `app/(application)/variables/components/data-table-row-actions.tsx` — consume shared
  ConfirmDialog; "View usage" always present, opens panel tab; live usage count in the
  delete dialog.
- **NEW** `app/(application)/variables/components/variable-detail-panel.tsx` — Sheet (L2):
  SecretField, Usage tab, Meta, Edit/Delete footer.
- **NEW** `app/(application)/variables/components/usage-list.tsx` — shared by panel tab and
  the standalone usage route; batch name resolution (fixes U5) via `GET_USERS_BY_IDS`
  (`queries/queries.ts:1608`) + a new `GET_AGENTS_BY_IDS`.
- `app/(application)/variables/create/page.tsx`, `edit/[variable_id]/page.tsx` — shell/header
  refactor; Type radio (encrypted **default ON**, U6); edit's "Replace value" /
  value-unchanged semantics (#37); rename + decrypt ConfirmDialogs (#36/#38); Meta block
  (#40); skeleton instead of spinner (#33); **`read`-role redirect guard** per §3 Read-only
  mode (today both routes render unguarded, `create/page.tsx:18`,
  `edit/[variable_id]/page.tsx:19`); on edit, **split the combined
  `if (error || !variable)` branch (`edit/[variable_id]/page.tsx:110`)** into not-found
  (EmptyState) vs. load-error (error state + Retry) per ladder #34 (U19).
- `app/(application)/variables/usage/[variable_id]/page.tsx` — thin page over `usage-list`;
  delete the hooks-in-loop implementation (U5); same not-found vs. load-error split for the
  `if (variableError || !variable)` gate (`usage/[variable_id]/page.tsx:173`) per ladder #41
  (U19).
- `queries/queries.ts` —
  - split `GET_VARIABLES` into `GET_VARIABLES_LIST` (id, name, encrypted, `used_by_count`,
    createdAt, updatedAt — **no `value`**) and keep a lite variant for consumers #47/#49;
  - `GET_VARIABLE_USAGE(id)` returning resolved `used_by`;
  - `GET_VARIABLE_VALUE(id)` fetched only on Reveal/Copy and on "Show current value" in edit;
  - pass `sort` from table state; `UPDATE_VARIABLE` must accept an omitted `value`
    (value-unchanged) — verify backend semantics.
- `components/custom/main-nav.tsx:228-234` — render the item for `read` too; label key fix.
- `messages/en.json` / `messages/de.json` — `variables.*` namespace (U9); retranslate
  `navigation.systemVariables` (U7).

**Backend dependencies (blocking the mandate, not the visual redesign)**
1. **Usage computation** — the heart of U2: a resolver populating `used_by` /
   `used_by_count` from: `users.anthropic_token` (per the TODO at `columns.tsx:133-136`),
   agent config JSON (referenced **by name**, `agents/edit/[id]/form.tsx:121`), model auth
   variables (`model-form.tsx:63-65`), embedder settings (`embeddings.tsx:146-148`),
   workflows. Until it lands, the UI shows an honest "Usage unavailable" muted state — never
   a fake "0 resources".
2. **Value-on-demand** — confirm the API can return a variable *without* its value and serve
   the (decrypted) value via a separate authorized field; clarify today's behavior for
   encrypted values on the edit page (decrypted vs ciphertext — if ciphertext, the current
   edit flow re-encrypts ciphertext on save, a data-corruption hazard to verify immediately).
3. Optional: `created_by`/`updated_by` actor fields (U18); reveal/copy audit events.

**Shared components needed**
- From philosophy §5: `PageShell`, `PageHeader`, `Toolbar`, `ListDetail` (table + Sheet
  variant), `EmptyState`, `ConfirmDialog`.
- Proposed in `design/pages/models.md`, reused here: **`CopyField`** (mono value +
  one-click copy + toast), **`FormSection`** (collapsible form group).
- **NEW shared primitive not yet in philosophy §5** (propose adding):
  - **`SecretField`** — masked secret with deliberate Reveal (on-demand fetch), Hide,
    auto-remask timer, copy-without-reveal, `aria-label`s and tooltips. Needed by `/keys`,
    `/token`, and the model form's credential display as well — this is the canonical L3
    "show me the secret" pattern for the whole app.

**Scope: M.** Four routes restyled onto shared bones, one new surface (detail panel), one
new primitive (SecretField), query split, responsive work. The usage resolver is backend
scope (separate ticket) — the frontend ships with the honest-degradation state if it lags.

**Dependencies**
- Shell/nav redesign (`design/navigation.md`): Administration group placement; the
  `read`-level nav decision; renamed label.
- Shared primitives must exist or be extracted here and promoted
  (`design/codebase-structure.md`).
- `design/responsive.md` tables→cards and panel→sheet standards.
- Backend items 1–2 above; consumers #47/#49 migrate to the lite query in the same change.

**Risks**
- **Encrypted-value round-trip semantics** (backend dependency 2): if today's edit flow
  re-encrypts ciphertext, existing data may already be corrupted for any variable edited
  twice — audit before changing write paths.
- Removing `value` from the list query is a breaking change for any unnoticed consumer —
  grep confirms only #47–#49 (and this area) use `GET_VARIABLES`; all consume only
  id/name/encrypted, but re-verify at implementation time.
- Usage-by-name (agents) is heuristic — string occurrence in config JSON can over-match;
  the usage list should label agent matches "referenced in configuration" rather than imply
  a foreign key.
- The rename warning depends on usage data; until backend item 1 lands, rename of *any*
  variable should warn generically ("agents reference variables by name").
- Dropping the 30 s poll changes freshness for admins relying on it; refetch-on-focus +
  post-mutation refetch covers the realistic cases (this is a low-churn admin registry).
- `read`-role rendering relies on the backend actually rejecting mutations for read-only
  roles — verify before exposing the page to `read` users; the create/edit redirect guard
  (§3 Read-only mode) is client-side convenience, not enforcement.
