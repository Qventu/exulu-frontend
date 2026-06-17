# API Keys & Personal Token — Review & Design Concept

**Routes:** `/keys`, `/token`  **Primary persona:** P3 (Admin) for `/keys`; P4 (Developer) for `/token`  **Secondary:** P4 on `/keys`; P2 on `/token`  **Current state:** Two functional but unloved credential pages — `/keys` hides every key past the first ten, undermines its own role selector by minting every admin key as a super admin, and generates keys with `Math.random()`; `/token` shows a session JWT in plaintext with no expiry information behind a dark-mode-invisible spinner. Neither page is internationalized, RBAC-guarded at the route, or usable at 390 px (`/keys`).

> **Merge or stay separate?** **Stay separate.** The two pages share a theme (credentials) but
> not an owner or a job: `/keys` is org-level credential *governance* (P3 — audit, scope,
> revoke, rotate; high-stakes, infrequent), `/token` is personal credential *grab-and-go*
> (P4 — copy my bearer token and get back to the terminal; trivial, frequent). Merging them
> would put a destructive admin surface and an everyone-can-see-it convenience surface on one
> screen — an "everything-page" (philosophy anti-pattern 7) and a violation of "one screen,
> one owner" (philosophy §3), and it would force RBAC to partially hide half a page instead of
> trimming a whole route. What they *should* share is bones and primitives: the same
> CopyButton, the same SecretField mask/reveal pattern, and quiet cross-links (each page
> points to the other for the "I'm on the wrong page" case, and the API Explorer's
> Credentials menu links both — see `design/pages/explorer.md` §3 ladder item "NEW").

---

## 1. Current state

`/keys` is a single 507-line client component (`app/(application)/keys/page.tsx`) that
implements org-wide API key management as CRUD on `type: "api"` users via Apollo. Keys are
generated, post-fixed, and bcrypt-hashed **in the browser** and stored as a user record whose
`apikey` field holds the hash. `/token` is a 161-line client page
(`app/(application)/token/page.tsx`) that reads the next-auth session JWT and displays it for
copying. Neither route has a server component, a route-level RBAC guard, or i18n.

### Functionality inventory

*A. `/keys` — Org API keys (P3/P4)*

1. **Route `/keys`** — `"use client"` page, no server wrapper, no route-level role check;
   any authenticated user can open it by URL (page.tsx:1,52; auth redirect is layout-wide
   only, app/(application)/layout.tsx:32-33).
2. **Sidebar nav entry** — bottom nav group, label `navigation.apiKeys` = "Keys" (en + de,
   messages/en.json:23, messages/de.json:23), `Key` lucide icon; **RBAC gate:** rendered if
   `user.super_admin || role.api === "write"` (components/custom/main-nav.tsx:219-225).
   Note: the gate is currently broken — see UX review U3.
3. **Create-key form: name input** — free-text name with example placeholder
   ("Production, Development") (page.tsx:223-228).
4. **Create-key form: role selector** (admin scope only) — `RoleSelector` shared combobox:
   searchable Popover+Command list of roles from `GET_USER_ROLES` (page 1, limit 100), each
   role rendered with a derived read/write permission summary across agents / workflows /
   variables / users (page.tsx:229-241; components/ui/role-selector.tsx:39-155).
5. **Role disabled for agents scope** — selector disabled and helper text "Role is ignored
   for agents-scoped keys." shown when scope = agents (page.tsx:234-240).
6. **Scope mode radio** — "Admin (full access)" vs "Agents (allowlist, read-only)"
   (RadioGroup, page.tsx:244-264); switching back to admin resets nothing except enabling
   the role selector.
7. **Agent allowlist builder** (agents scope only) — selected agents shown as removable
   `secondary` Badges with an ARIA-labelled × button; "+ Add agent" Select fed by
   `GET_AGENTS` (page 1, limit 500, cache-first), already-selected agents filtered out of
   the dropdown (page.tsx:62-67, 266-317; queries/queries.ts:168).
8. **Client-side validation** — name required (destructive toast, page.tsx:86-93); agents
   scope requires ≥ 1 agent (destructive toast, page.tsx:97-105); Generate button disabled
   until valid (page.tsx:319-326).
9. **Key generation (client-side)** — plaintext key `sk_<13 chars>_<13 chars>` from two
   `Math.random().toString(36)` calls (page.tsx:107); a postfix `/` + name lowercased,
   trimmed, spaces→underscores is appended (page.tsx:108); the *plain* key is bcrypt-hashed
   in the browser at 12 salt rounds (page.tsx:39-40,109); `CREATE_API_USER` mutation creates
   a user with `type:"api"`, `apikey = <bcrypt hash><postfix>`, synthetic email
   `<bcrypt hash>@exulu-api-user.com`, `role` only for admin scope,
   **`super_admin: scopeMode === "admin"`**, `scope_mode`, and `agent_ids` for agents scope
   (page.tsx:110-121; queries/queries.ts:857-893). The displayed key is
   `<plain key><postfix>` (page.tsx:124-129) — the plaintext is never persisted.
10. **Generating state** — button shows `Loader2` spinner + "Generating…" while the mutation
    runs (page.tsx:328-338).
11. **One-time key reveal** — green Alert ("New API Key Generated") with the full plain key
    in a scrollable `code` block, an icon copy button, an "only displayed once / store it
    securely" warning, and a "Dismiss" link button; form fields are reset after creation
    (page.tsx:124-134, 345-376).
12. **Copy key to clipboard** — `navigator.clipboard` + "Copied!" toast (page.tsx:159-165).
13. **Keys list query** — `GET_USERS` filtered `type eq "api"`, page 1, **limit 10**,
    `pollInterval: 30000` (auto-refresh, incl. `last_used`), cache-first →
    network-only (page.tsx:69-80; queries/queries.ts:662-697). `refetchQueries` on
    create/delete/update keep the list in sync (page.tsx:137-156).
14. **Keys table** — columns: Name (`name || firstname`), Key (static `****` mask in mono
    code), Scope, Role, Created (`date-fns "PP hh:mm"`), Last Used, Actions
    (page.tsx:393-497).
15. **Scope display** — admin keys: default Badge "admin"; agents keys: `secondary` Badge
    "agents (n)" with a hover Tooltip listing the resolved agent *names* (IDs mapped against
    the GET_AGENTS list, falling back to raw IDs) (page.tsx:407-413, 422-439).
16. **Inline role reassignment** — a full `RoleSelector` (fixed `w-48`) in every row;
    selecting fires `UPDATE_USER_BY_ID` with `role || null` immediately, success/error
    toasts; disabled with placeholder "Not used" for agents-scoped keys
    (page.tsx:182-201, 440-448; queries/queries.ts:827-856).
17. **Last Used display** — formatted timestamp, or an `outline` Badge "Never"
    (page.tsx:451-457).
18. **Delete key** — per-row ghost trash icon button (red), opens a controlled confirmation
    Dialog naming the key ("This action cannot be undone"), Cancel / destructive "Delete API
    Key"; `REMOVE_USER_BY_ID` + refetch + "Deleted" toast (page.tsx:167-179, 458-491;
    queries/queries.ts:1399-1405).
19. **Empty state** — centered muted text "No API keys found. Generate your first key
    above." (page.tsx:387-390).
20. **Security footer** — CardFooter note: "API keys grant full access to your account. Keep
    them secure and rotate them regularly." (page.tsx:501-503).
21. **Page header** — `h1` "API Keys" (`text-3xl font-bold`) + description paragraph
    (page.tsx:204-210).

*B. `/token` — Personal token (P4)*

22. **Route `/token`** — `"use client"` page, no role gate (any authenticated user; it only
    exposes the caller's own session JWT) (token/page.tsx:13).
23. **Nav entry** — item "Token" (hardcoded English, not via `t()`) with `Album` icon in the
    sidebar-footer user dropdown, alongside Theme/Language/Settings/Logout; visible to **all**
    authenticated users (main-nav.tsx:574-579).
24. **Token acquisition** — on mount when session is authenticated, `getToken()` →
    next-auth `session.user.jwt` (token/page.tsx:20-35; util/api.ts:30-34); failure is
    caught, logged, and renders the no-token state.
25. **Loading state** — full-area spinner: `h-32 w-32 border-b-2 border-gray-900`
    (token/page.tsx:57-65).
26. **Unauthenticated state** — "Authentication Required" card with red `AlertCircle`
    (token/page.tsx:67-88) (mostly dead code: layout.tsx:32-33 redirects server-side).
27. **Status badge** — "Active" (default) when a token exists, "Unavailable" (destructive)
    otherwise, in the card title row (token/page.tsx:104-106).
28. **Token value field** — labelled readOnly `Input`, `font-mono text-sm`, full JWT in
    **plaintext** (token/page.tsx:115-126).
29. **Copy token** — outline icon Button; `Copy` → `CheckCircle` icon swap with 2 s revert;
    success and failure toasts (token/page.tsx:37-55, 127-138).
30. **Security note** — "This token provides access to your account. Keep it private and
    secure." (token/page.tsx:142-146).
31. **No-token state** — centered `AlertCircle` + "No token available. Please try refreshing
    the page or logging in again." (token/page.tsx:149-154).
32. **Page header** — `h1` "Authentication Token" (`text-3xl font-bold`) + description
    (token/page.tsx:93-98).

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | **The role selector on admin keys is (almost certainly) cosmetic.** Every admin-scoped key is created with `super_admin: true` *in addition to* the chosen role. Everywhere in the codebase `super_admin` short-circuits role checks (`user.super_admin \|\| role.x === …`, e.g. main-nav.tsx:219), so the backend most likely ignores the role for these principals. The UI offers — and the table inline-edits — a control that suggests least-privilege scoping that doesn't exist. P3's emotional goal is "nothing here can surprise me" (personas.md:107); this is the surprise. | page.tsx:116-117 (`role: …, super_admin: scopeMode === "admin"`), 440-448 |
| U2 | **High** | **Only the first 10 keys exist, silently.** The list queries page 1, limit 10 with no pagination controls and no use of the returned `pageInfo`. An org's 11th key can never be seen, audited, or revoked from this UI — a capability gap, not a styling issue. | page.tsx:73-74; queries/queries.ts:669-676 (pageInfo fetched, unused) |
| U3 | **High** | **RBAC gate broken + no route guard.** (a) `serverSideAuthCheck` builds the `role` object without `api` (only id, name, agents, workflows, variables, users, evals, budget_management) so `role.api === "write"` at main-nav.tsx:219 is never true — the nav entry renders for super_admins only, and users whose role legitimately grants API write can't find the page. (b) The page itself does no role check, so any authenticated user can open `/keys` by URL and is shown the full management UI (the backend is the real authority, but the UI invites actions that will fail or — worse — succeed). Same root cause as explorer.md U2. | lib/server-side-auth-check.ts:43-52; main-nav.tsx:219-225; page.tsx:52 |
| U4 | **High** | **Cryptographically weak key generation, with the hash shipped to every client.** Keys come from `Math.random()` (a predictable, non-CSPRNG source; ~26 base36 chars). Meanwhile `GET_USERS` returns the `apikey` bcrypt hash (and `anthropic_token`) to the browser for every listed key — handing an attacker exactly what's needed for offline guessing of low-entropy keys. | page.tsx:107; queries/queries.ts:684,687 |
| U5 | **Med** | **No loading or error state on the keys list.** `loading` and `error` are destructured and never used; while loading, the card renders a header-only table (the empty-state text appears only when `length === 0` is literally true), and a failed query renders the same — indistinguishable from "no keys". | page.tsx:69, 386-399 |
| U6 | **Med** | **Contradictory security copy.** The page intro and footer both claim keys "have full access to your account" — directly contradicted by the agents-scoped read-only mode introduced between them. For admin keys it's accidentally true (see U1), which is the wrong way to be right. | page.tsx:208, 217, 502 |
| U7 | **Med** | **`console.log` of live data in production paths** — the full users query result and the create-mutation response are logged on every render/creation. | page.tsx:82, 123 |
| U8 | **Med** | **bcrypt at 12 rounds on the main thread** blocks the UI for ~100–300 ms during generation; combined with the unexplained "Generating…" wait it makes creation feel heavier than it is. Key derivation belongs on the backend (see §4). | page.tsx:39-40, 109 |
| U9 | **Med** | **Inline role mutation with zero friction.** Changing a key's role from the table fires the mutation on select — no confirmation, no undo — for a change that silently re-scopes a production credential. Violates P3's design bias ("explicitness over cleverness — confirmation on destructive ops", personas.md:101-102). | page.tsx:440-448 |
| U10 | **Med** | **`/token` loading spinner is invisible in dark mode** — `border-gray-900` with no dark variant on a near-black background; also a 128 px spinner where CLAUDE.md mandates skeletons for known layouts. | token/page.tsx:61 |
| U11 | **Med** | **Session JWT rendered in plaintext by default** with no mask/reveal — shoulder-surfing and screen-share risk for a live bearer credential. (The keys page got this right: mask always, reveal once.) | token/page.tsx:120-126 |
| U12 | **Med** | **No expiry information for the token.** The JWT silently expires with the session; the page calls it "Active" right up until the moment it isn't, and the user finds out via a 401 in their terminal. The `exp` claim is sitting in the token, decodable client-side. Violates trust-through-transparency (philosophy §8). | token/page.tsx:104-106 |
| U13 | **Low** | **Naming split.** Nav dropdown: "Token"; page: "Authentication Token"; personas.md:171: "Personal API token". Three names, one surface — and the dropdown label is the only untranslated item in its menu. | main-nav.tsx:577; token/page.tsx:94 |
| U14 | **Low** | **Zero i18n on both pages** — every string is hardcoded English despite the app shipping en/de message catalogs (both pages import nothing from i18n). | keys/page.tsx, token/page.tsx (whole files) |
| U15 | **Low** | **Off-system styling.** Page titles `text-3xl` (neither CLAUDE.md's `text-4xl` display nor PageHeader's `text-2xl`); hardcoded `green-500/green-50/green-950` success alert and `red-500/red-50/red-950` delete button instead of semantic tokens; ad-hoc per-row delete Dialog instead of a shared ConfirmDialog (one Dialog instance mounted per row). | keys/page.tsx:206, 346-348, 469; token/page.tsx:94 |
| U16 | **Low** | **Edge cases in key identity.** The postfix slug only handles spaces — a name like `Prod/EU` or `Köln` flows raw into the key string; the synthetic email embeds a bcrypt hash (contains `$ . /`) into the local part; duplicate names produce colliding postfixes (backend disambiguation unverified). Scope/allowlist is also immutable after creation — fixing a typo'd allowlist means delete + recreate, stated nowhere. | page.tsx:108, 110-115 |

### Mobile audit

**`/keys` at 390 px — broken.** Container padding is 2 rem per side (tailwind.config.js:16-22),
leaving ~326 px of content:

- The 7-column table sits in `overflow-x-auto` (page.tsx:392) and is far wider than the
  viewport — Name + masked key + badges + a fixed `w-48` RoleSelector cell (page.tsx:441) +
  two timestamps mean **Last Used and the delete action render off-screen**; revoking a key
  (P3's #1 mobile job) requires discovering sideways scroll inside a card. Philosophy
  anti-pattern 9.
- The scope `RadioGroup` is `flex gap-6` with no wrap (page.tsx:249); "Admin (full access)" +
  "Agents (allowlist, read-only)" overflow/wrap awkwardly at 326 px.
- The one-time key `code` block scrolls horizontally (`overflow-x-auto
  max-w-[calc(100%-40px)]`, page.tsx:355) — the only chance to verify the full key requires a
  scroll the user may not notice.
- The create form itself stacks correctly (`flex-col sm:flex-row`, page.tsx:222) — the one
  deliberate responsive touch on the page.
- The scope tooltip (agent names) is hover-only (page.tsx:424-435) — the allowlist is
  unreadable on touch.

**`/token` at 390 px — minor.** Single column, `max-w-2xl`, input + `shrink-0` copy button fit;
the long JWT is clipped inside the input (acceptable — copy is the job). The real mobile issue
is the dark-mode-invisible spinner (U10), which is a theme bug, not a layout one.

---

## 2. Jobs to be done

**`/keys` — PRIMARY: P3 (Admin).** *#1 job in one sentence: see every service credential that
exists in this org — what it can do, when it was last used — and revoke or rotate it without
surprises.* (personas.md:96 "Manage API keys and service credentials at the org level".)

P3's jobs here, by frequency:

1. **Audit** — scan the list: what keys exist, what scope, last used, never used (most visits).
2. **Revoke** — delete a leaked/stale key fast and confidently (rare, urgent — also the
   mobile job, personas.md:104-105 "respond to alerts… one-handed").
3. **Create / rotate** — mint a key for a service, scoped as tightly as possible (infrequent;
   high care).
4. **Re-scope** — change a key's role (rarest; should be deliberate, see U9).

**Secondary: P4 (Developer)** (personas.md:121 "manage API keys"): creates keys for the
integrations they build, wants the key + a usage snippet copy-paste-ready, and wants to know a
key's name↔postfix so they can identify it in logs.

**`/token` — PRIMARY: P4 (Developer).** *#1 job in one sentence: copy a working bearer token
into my terminal in under five seconds.* (personas.md:121 "Get credentials fast".)

1. **Copy the token** (≈ the only job; also the explicitly named P4 mobile job,
   personas.md:133-134 "copy a token in a pinch").
2. **Know if/when it stops working** (expiry — currently unserved, U12).
3. **Grab a usage snippet** (Authorization header / cURL — currently unserved; P4 design bias
   "copy-paste-ready everything", personas.md:130-131).

**Secondary: P2 (Power user)** — same copy job, less often (scripting against their own agents).

**Ownership matrix check (personas.md:169,171):** `/keys` → P3 primary, P4 secondary —
**confirmed**. `/token` → P4 primary, P2 secondary — **confirmed as design intent, but the
implementation contradicts it today**: the Token link sits in *every* user's dropdown
(main-nav.tsx:574-579), so the de-facto audience is "all users", including P1 — whom
personas.md:35-36 says should never see API keys/tokens. The correction is to the *placement*,
not the matrix: move the entry into the Develop nav group (RBAC-trimmed), keep the route
itself accessible to any authenticated user by URL (it only reveals the caller's own session
JWT — no privilege escalation), so existing bookmarks and docs keep working.

---

## 3. Design concept

**Essence: `/keys` becomes a calm audit table whose creation and detail flows move into
layered panels — and stops lying about scope; `/token` becomes a masked, expiry-honest,
grab-and-go card.** Both pages adopt the shared bones (PageShell/PageHeader/ListDetail/
EmptyState/ConfirmDialog) and two small shared primitives (CopyButton, SecretField) that the
explorer concept already needs.

### Default view (L1)

**`/keys`** — centered content page (PageShell, `max-w-5xl`):

```
┌────────────────────────────────────────────────────────────────────────┐
│ API Keys                                              [+ Create key]   │  PageHeader
│ Service credentials for this organization.                             │
├────────────────────────────────────────────────────────────────────────┤
│ [Search keys…                              ]                           │  Toolbar
├────────────────────────────────────────────────────────────────────────┤
│ NAME          SCOPE              LAST USED        CREATED              │
│ Production    ● Admin            2h ago           Mar 3, 2026      ›   │
│ Staging bot   Agents (3)         Never            May 12, 2026     ›   │  ListDetail
│ CI smoke      Agents (1)         4d ago           May 30, 2026     ›   │  (table)
├────────────────────────────────────────────────────────────────────────┤
│                                            ‹ 1–10 of 23 ›              │  pagination
└────────────────────────────────────────────────────────────────────────┘
   Looking for your personal token? → /token        (text-xs, muted)
```

- **PageHeader**: title "API Keys" (`text-2xl`), one-line purpose, and the page's single
  purple element: **"+ Create key"** (Button `default`) on the right. Opens the creation
  dialog (L3).
- **The table is the page.** Four columns only: Name (`font-medium`), Scope (quiet — see
  below), Last Used (relative time, `text-sm text-muted-foreground`; "Never" stays an
  `outline` badge because an unused credential is an audit signal), Created. A chevron
  affordance marks rows as openable; clicking a row opens the **detail panel** (L2). The
  masked-asterisks column is dropped from the table (it conveyed nothing); the mask moves
  into the detail panel where it has context. *(QA decision 2026-06-11: the panel presents
  as a full-height right Sheet at every width — `ListDetail detailPresentation="sheet"` —
  because a docked aside inside this centered content page cannot reach the surface edges
  and looks clipped.)*
- **Scope is honest and quiet** (philosophy §4 "status is quiet until it isn't"): agents
  keys show `Agents (n)` as a plain `secondary` badge; admin keys show **`● Admin`** with a
  small filled dot — full-access credentials are the risk on this page and earn the one
  touch of weight. No tooltip-only information: the allowlist lives in the panel.
- **Pagination** (fixes U2): `‹ 1–10 of 23 ›` from `pageInfo`, bottom-right of the table.
  Toolbar holds a single search-by-name Input (left), nothing else — no filter chips this
  page doesn't need.
- **EmptyState** (shared primitive): Key icon, "No API keys yet. Create one to call the
  Exulu API from your services.", primary action "+ Create key".
- **Loading**: skeleton rows mirroring the table (fixes U5). **Error**: EmptyState variant
  with plain-language message + Retry, raw error in collapsed mono detail (L4).

**`/token`** — centered narrow page (PageShell, `max-w-2xl`):

```
┌──────────────────────────────────────────────┐
│ Personal token                               │  PageHeader
│ Your bearer token for the Exulu API.         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Token            ● Expires in 23 h     │  │
│  │ ┌────────────────────────┐ [👁] [Copy] │  │
│  │ │ ••••••••••••••••••••   │             │  │
│  │ └────────────────────────┘             │  │
│  │ Sent as  Authorization: Bearer <token> │  │
│  │ ▸ Usage example (cURL)                 │  │
│  └────────────────────────────────────────┘  │
│  Need an org-level key? → API Keys           │
└──────────────────────────────────────────────┘
```

- One card. The **primary action is Copy** (Button `default` with label "Copy token" — the
  one purple element; the job is copying, not reading).
- The token renders in a **SecretField**: masked by default, Eye toggle to reveal (fixes
  U11), `font-mono text-sm`.
- **Expiry is first-class** (fixes U12): decode the JWT `exp` claim client-side and show a
  status chip — `● Expires in 23 h` (muted/green while >1 h, orange `Expires soon` under
  1 h, red `Expired — sign in again` after). Replaces the binary Active/Unavailable badge
  while keeping its meaning (no token ⇒ red "Unavailable").
- A one-line `text-xs font-mono text-muted-foreground` hint shows *how* the token is sent;
  a collapsed **"Usage example"** disclosure (L2) reveals a copyable cURL snippet with the
  backend URL pre-filled.
- Cross-link to `/keys` shown only when the caller passes the keys RBAC predicate.

### Disclosure ladder

Every numbered item from §1 is mapped; nothing is dropped.

| # | Capability | Level | Where it lives |
|---|-----------|-------|----------------|
| 1 | Route `/keys` | L0 | URL + sidebar; now server-side RBAC-guarded (see §4) |
| 2 | Nav entry + RBAC gate | L0 | Sidebar "Administration" group (per personas.md:190); gate `super_admin \|\| role.api === "write"` made *evaluable* by the auth-check fix |
| 3 | Name input | L3 | Create-key Dialog, step 1 |
| 4 | Role selector (RoleSelector combobox incl. permission summaries) | L3 | Create-key Dialog, shown only for Admin scope; same RoleSelector component |
| 5 | "Role ignored for agents scope" behavior | L3 | Dialog: role field is *replaced* by the allowlist when scope = Agents (clearer than disabled-with-caption); helper text retained under the scope control |
| 6 | Scope mode selection | L3 | Create-key Dialog: two selectable option cards (Admin / Agents) with one-line consequence copy each — incl. the honest "acts as super admin" wording for Admin until U1 is fixed backend-side |
| 7 | Agent allowlist builder (badges + add-Select, GET_AGENTS) | L3 | Create-key Dialog, Agents scope; same badge+select pattern, `flex-wrap` |
| 8 | Validation (name, ≥1 agent, disabled CTA) | L3 | In-dialog inline field errors (not toasts); CTA disabled until valid |
| 9 | Key generation + CREATE_API_USER | L3 | Dialog submit; entropy/hashing fixes in §4 |
| 10 | Generating spinner | L3 | Dialog CTA: Loader2 + "Creating…" |
| 11 | One-time key reveal | L3 | **Step 2 of the same Dialog** (no dialog-on-dialog): success state with the full key in a mono block, CopyButton, "shown only once" warning, explicit "Done" button — can't be lost behind the page like today's dismissible Alert |
| 12 | Copy key | L3 | CopyButton in reveal step (+ toast) |
| 13 | List query, 30 s poll, refetch-on-mutation | L1 (invisible) | Unchanged data behavior; now drives pagination via `pageInfo` |
| 14 | Keys table | L1 | The page body (4 columns; Role + masked key relocated to L2 panel) |
| 15 | Scope display incl. agent names | L1 badge → L2 detail | Badge in table; full allowlist (named agents, copyable IDs) in the detail panel — no hover-only tooltip (mobile-safe) |
| 16 | Inline role reassignment | L2 → confirm at L3 | Detail panel "Role" section: same RoleSelector; selecting opens ConfirmDialog ("Change role of *Production* to *Read-only*?") before mutating (fixes U9). Disabled with "Not used for agents-scoped keys" caption for agents keys |
| 17 | Last-used display ("Never" badge) | L1 | Table column; exact timestamps (created + last used, full `PP hh:mm`) repeated in the detail panel |
| 18 | Delete key + confirmation | L2 action → L3 confirm | Destructive "Delete key…" button at the bottom of the detail panel → shared ConfirmDialog (destructive variant, names the key). One ConfirmDialog instance for the page, not one per row |
| 19 | Empty state | L1 | Shared EmptyState (icon, sentence, "+ Create key") |
| 20 | Security footer note | L3 | Folded into the create Dialog's scope-consequence copy and the reveal step ("store it securely; you can't view it again") — where the advice is actionable, not boilerplate under a table |
| 21 | `/keys` page header | L1 | PageHeader (title `text-2xl`, purpose line, primary action) |
| 22 | Route `/token` | L0 | URL; reachable by any authenticated user (unchanged) |
| 23 | Token nav entry | L0 | Moves from the all-users dropdown to the **"Develop" sidebar group** as "Personal token" (i18n'd), gated `super_admin \|\| role.api ∈ {read, write}`; the route stays open by URL so nothing breaks (see §2 matrix note) |
| 24 | Token acquisition (getToken/session JWT) | L1 (invisible) | Unchanged |
| 25 | Loading state | L1 | Skeleton mirroring the card (header line + field row), replaces the gray-900 spinner |
| 26 | Unauthenticated state | L1 (edge) | Kept as the EmptyState error variant (client-side session lag can still hit it) |
| 27 | Active/Unavailable status | L1 | Superseded-but-preserved: the expiry chip carries the same signal with more honesty ("Unavailable" = red chip, no token) |
| 28 | Token value display | L1 | SecretField: masked by default, Eye reveal toggle, mono |
| 29 | Copy token (icon swap + toasts) | L1 | CopyButton as the page's primary action ("Copy token"), same 2 s check feedback |
| 30 | Security note | L1 | One quiet `text-xs text-muted-foreground` line under the field ("This token acts as you. Keep it private.") |
| 31 | No-token state | L1 (edge) | EmptyState variant: icon, message, "Sign in again" action (link to `/login`) — adds the action U-curve the current text only implies |
| 32 | `/token` page header | L1 | PageHeader: "Personal token" (one name everywhere, fixes U13) |
| — | NEW: pagination + search | L1 | Table footer pager + Toolbar search (closes U2's capability gap) |
| — | NEW: detail panel | L2 | Side panel (Sheet on the right, ≥ md) per ListDetail: identity (name, key mask `sk_…/postfix` prefix visible so keys are matchable in logs, copyable id), scope/allowlist, role management, timestamps, delete |
| — | NEW: token expiry chip + usage snippet | L1 / L2 | Expiry chip inline; cURL snippet behind a collapsed disclosure |
| — | NEW: cross-links between the two pages | L1 (quiet) | `text-xs` muted links; `/token → /keys` only when keys-RBAC passes |

Ladder rule check: destructive ops (18) and creation (3-12) sit at L3 with confirmation;
nothing trust-critical (scope, last-used, expiry) sits below L2; no flow descends more than
one level mid-job (row → panel → confirm is L1→L2→L3, each a single deliberate step).

### Layout & components

**Shared bones (philosophy §5):**

- **PageShell** — centered content variant: `mx-auto w-full max-w-5xl p-6 lg:p-8 space-y-6`
  (`/keys`); `max-w-2xl` (`/token`).
- **PageHeader** — standard density: title `text-2xl font-semibold tracking-tight`, purpose
  line `text-sm text-muted-foreground`, action slot right. The only purple on each page is
  its primary action (philosophy §4).
- **Toolbar** (`/keys`) — one `Input` with search icon, `h-9`, `max-w-sm`; sits directly
  under the header (`gap-4` rhythm). Client-side filter over the loaded page is acceptable
  at this scale; server filter when the backend exposes name filters.
- **ListDetail** (`/keys`) — shadcn `Table` inside a plain bordered container (`rounded-lg
  border` — *not* a Card-in-Card; the table is the content). Rows `h-12`, `cursor-pointer`,
  hover `bg-muted/50` (150 ms). Detail = shadcn `Sheet side="right"` (`w-[400px]
  sm:max-w-md`), structured with `space-y-6` sections and `text-xs uppercase
  text-muted-foreground` section labels: Identity → Scope → Role → Activity → Danger zone.
- **EmptyState** — icon (Key, strokeWidth 1.5), one sentence, one action; reused for empty,
  error (+ collapsed raw detail), and `/token`'s no-token/unauthenticated states.
- **ConfirmDialog** — the shared destructive-confirmation primitive: used for key deletion
  (destructive variant) and role change (default variant). Replaces the per-row Dialogs.

**Page-specific composition:**

- **Create-key Dialog** (`/keys`): shadcn `Dialog`, `sm:max-w-lg`. Step 1: Name (`Input`),
  Scope as two selectable option cards (`RadioGroup` semantics, card visuals: border
  highlight `border-primary` on selection, 150 ms) each with one consequence line
  (`text-xs text-muted-foreground`); then either RoleSelector (Admin) or the allowlist
  builder (Agents, badges `flex-wrap gap-2` + add-Select). Inline field errors `text-xs
  text-destructive`. Footer: ghost Cancel / default "Create key". Step 2 (same Dialog):
  success state — `bg-muted` mono block with the full key, CopyButton, warning line, single
  "Done" button. Step transition is a 200 ms crossfade.
- **Scope badges** (table): `Badge variant="secondary"` for Agents; Admin = `Badge
  variant="outline"` with a `bg-primary`-free filled dot `●` in `text-foreground` — weight
  via the dot + label, not color noise.
- **SecretField** (NEW shared primitive, see §4): readOnly mono value, masked
  (`••••`) by default, Eye/EyeOff toggle (ghost icon Button, ARIA label, tooltip), optional
  trailing CopyButton. Used on `/token` now; designed for `/variables` and the create-reveal
  step next.
- **CopyButton** (NEW shared primitive, already specified in explorer.md §4): clipboard +
  `Copy`→`Check` 150 ms swap + toast + ARIA.
- **Expiry chip** (`/token`): `Badge variant="outline"` + status dot; semantic colors only
  by state (muted/green ok, orange < 1 h, red expired) per philosophy §4.
- Type/spacing per CLAUDE.md throughout: `text-sm` body, `text-xs` metadata, `font-mono`
  for keys/snippets, `gap-2/4/6` rhythm; lucide strokeWidth 1.5 to match the nav.
- i18n: all strings via `keys.*` / `token.*` message keys, en + de (fixes U14).

### Mobile behavior

Designed for P3's mobile job on `/keys` ("respond to alerts… deactivate… one-handed",
personas.md:104-105) and P4's on `/token` ("copy a token in a pinch", personas.md:133-134).

- **≥ md (768 px+):** as described. Detail Sheet from the right; Dialog centered.
- **< md (incl. 390 px), `/keys`:**
  - **Table → card list** (responsive.md standard): each key is a full-width row card —
    line 1: name (`font-medium`) + scope badge right; line 2: `text-xs text-muted-foreground`
    "Last used 2 h ago · Created Mar 3". Whole card tappable (≥ 44 px) → detail Sheet from
    the **bottom** (`side="bottom"`, ~85 vh). No horizontal scroll anywhere (fixes the
    audit's core break).
  - Revoke = open card → Danger zone → ConfirmDialog: three taps, one-handed, no sideways
    hunting.
  - PageHeader action collapses to full-width "+ Create key" under the title; Toolbar search
    is full-width; the create Dialog becomes a full-screen sheet, scope option cards stack
    vertically, allowlist badges wrap (`flex-wrap` — fixes the RadioGroup overflow).
  - One-time key reveal: the key renders **wrapped** (`break-all`) in the mono block — fully
    visible without scrolling, plus CopyButton.
  - Agent allowlist is plain text in the panel — the hover tooltip is gone everywhere, so
    nothing is hover-only (touch-safe).
- **< md, `/token`:** already single-column; Copy stays the top-most interactive element
  (thumb-reachable), touch targets ≥ 44 px, skeleton instead of the spinner. Nothing else
  changes — the page is the mobile job.

### Motion

Per CLAUDE.md timings; all gated by `prefers-reduced-motion`:

- **Copy feedback** — `Copy`→`Check` swap, 150 ms ease-in-out, 2 s revert (CopyButton; same
  language as explorer/token today).
- **Detail Sheet** — slide-in 300 ms ease-in-out from right (desktop) / bottom (mobile) —
  explains origin (the row you tapped).
- **Create Dialog step 1 → reveal step** — 200 ms opacity/4 px-rise crossfade; the success
  state should feel like a result, not a navigation.
- **Reveal toggle (SecretField)** — instant content swap, 150 ms icon transition; secrets
  shouldn't animate into view.
- **Row hover / scope-card selection** — 150 ms background/border transitions.
- **Expiry chip** — none; static. A countdown that visibly ticks is anxiety, not
  transparency (philosophy §6: motion must explain something).
- **Skeleton → content** — 200 ms opacity crossfade, no layout shift.

---

## 4. Implementation notes

**Files to change**

- `lib/server-side-auth-check.ts:43-52` — add `'api', roles.api` to the `json_build_object`.
  Shared prerequisite with explorer.md §4 (same root cause); land once.
- `app/(application)/keys/page.tsx` — replace with a thin **server component**: run
  `serverSideAuthCheck`, guard `super_admin || role.api === "write"` (render access-denied
  EmptyState or `redirect('/')`), render the client page. **Roles:** view/manage `/keys` =
  super_admin or `role.api = "write"`; consider `role.api = "read"` ⇒ read-only table
  (create/delete/role hidden) — product decision, backend remains the authority.
- **New** `components/custom/keys/keys-table.tsx` — table + Toolbar search + pagination
  (wire `pageInfo`; keep 30 s poll), skeleton + error states; drop `console.log`s.
- **New** `components/custom/keys/key-create-dialog.tsx` — two-step dialog. Generation
  changes: plaintext from `crypto.getRandomValues` (e.g. 32 bytes, base62 ⇒
  `sk_<43 chars>/<postfix>` — backend bcrypt-compare is format-agnostic, but **verify the
  backend's parsing of the `/postfix` convention before changing length**); sanitize the
  postfix slug (lowercase, `[a-z0-9_-]` only); move bcrypt off the main thread (web worker)
  — or, better, move generation+hashing to a backend mutation that returns the plaintext
  once (preferred fix for U4/U8; frontend-only CSPRNG is the acceptable interim).
- **New** `components/custom/keys/key-detail-sheet.tsx` — detail panel incl. role change
  (ConfirmDialog-wrapped `UPDATE_USER_BY_ID`) and delete (ConfirmDialog-wrapped
  `REMOVE_USER_BY_ID`).
- `queries/queries.ts` — add a narrowed `GET_API_KEYS` query (id, name, firstname,
  createdAt, last_used, scope_mode, agent_ids, role — **no `apikey`, no `anthropic_token`**)
  so credential hashes stop shipping to clients (U4b); keep `GET_USERS` untouched for
  `/users`.
- `app/(application)/token/page.tsx` — rewrite with PageHeader, SecretField, CopyButton,
  expiry chip (decode `exp` via a ~5-line base64url helper — no jwt lib needed), usage
  snippet disclosure, skeleton, EmptyState variants. Rename surface to "Personal token".
- `components/custom/main-nav.tsx:574-579` — remove the Token item from the user dropdown;
  add "Personal token" to the Develop/bottom nav group gated
  `super_admin || role.api === "read" | "write"` (depends on the nav regrouping in
  `design/navigation.md`).
- `messages/en.json` / `messages/de.json` — new `keys.*` and `token.*` namespaces; rename
  `navigation.apiKeys` ("API Keys"/"API-Schlüssel") and add `navigation.personalToken`.
- **U1 (super_admin keys) needs a backend decision** before the create-dialog copy is final:
  either (a) admin-scoped keys stop setting `super_admin: true` and genuinely honor the
  selected role, or (b) the role selector is removed from admin scope and the UI says
  plainly "full access". The dialog design above ships honest copy for (b) and flips to (a)
  when the backend lands. **Do not ship the current both-things UI.**

**Shared components needed**

- `PageShell`, `PageHeader`, `Toolbar`, `ListDetail`, `EmptyState`, `ConfirmDialog` — all
  philosophy §5 primitives; this page pair is a clean early adopter (small surface, every
  primitive exercised).
- **NEW shared primitive: `CopyButton`** — already proposed in explorer.md §4; `/token` and
  the key-reveal step are consumers #2 and #3. Add to philosophy §5.
- **NEW shared primitive: `SecretField`** (masked mono value + reveal toggle + optional
  copy) — not in philosophy §5 yet; consumers: `/token`, key reveal, `/variables` (secrets),
  users' `anthropic_token` field. Propose adding to philosophy §5.

**Scope: M.** Two small pages and one dialog/sheet flow, no data-model changes, but it
introduces two shared primitives, a narrowed query, a server-side guard, pagination, full
i18n, and touches the shared auth helper + nav.

**Dependencies**

- The `role.api` auth-check fix (shared with `/explorer`) must land first or the RBAC story
  stays super_admin-only.
- Nav regrouping (`design/navigation.md`): "Administration" group for Keys, "Develop" group
  for Personal token; the cross-link visibility predicate reuses the keys gate.
- Explorer's Credentials menu links to both routes — keep route paths stable.
- Backend: key-format/postfix parsing contract (see above); U1 scope-semantics decision;
  optional server-side key generation endpoint.

**Risks**

- **Key-format coupling:** the backend identifies keys by the `/postfix` and bcrypt-compares
  the prefix; changing entropy/length is safe only if parsing is truly split-on-last-`/` —
  verify with a backend test before shipping the CSPRNG change.
- **Narrowed query regressions:** confirm nothing else reads `apikey`/`anthropic_token`
  from this page's cache shape (Apollo normalizes by id — removing fields can surface
  missing-field warnings where `/users` shares cache entries; `GET_API_KEYS` as a separate
  query with its own variables avoids overlap).
- **Poll + pagination interplay:** the 30 s poll must re-request the *current* page, and
  delete-on-last-page must step back a page instead of showing a ghost-empty table.
- **Moving the token nav entry** changes a habit for existing users; the route stays, the
  release note should say where it went.
- **U1 honesty copy** may alarm existing admins ("acts as super admin") — that is the
  point; coordinate with the backend fix so the alarming copy is short-lived.
