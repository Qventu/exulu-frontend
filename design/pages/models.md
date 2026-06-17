# Models — Review & Design Concept
**Routes:** `/models`, `/models/create`, `/models/edit/[id]`  **Primary persona:** P3 Admin  **Secondary:** P4 Developer (deployment config, IDs/raw detail), P2 Power user (browse/choose for agents)  **Current state:** functionally complete dual-mode registry (custom models vs. read-only LiteLLM catalog), but invisible on mobile, unconfirmed bulk delete, a silent RBAC-teams data-loss bug, an error-blind list query that renders failures as an empty registry, hardcoded light-theme colors, and zero i18n.

The Models area has two fundamentally different modes, branched on `config.liteLLM.enabled`
(`components/config-context.tsx`, consumed at `app/(application)/models/page.tsx:15`):

- **Custom-models mode** (LiteLLM off): full CRUD over models stored in Exulu's DB. A model =
  name + code-defined provider + encrypted auth variable + active flag + RBAC + optional
  rate/budget limits.
- **LiteLLM mode** (LiteLLM on): the page becomes a **read-only catalog** of models from
  LiteLLM's `config.yaml`; create/edit routes show a "not available" notice.

Both modes must survive the redesign intact.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File references are relative to repo root.

**Navigation & gating**

1. Sidebar nav item "Models" (Cpu icon), visible when `user.super_admin || role.agents === "write"` — `components/custom/main-nav.tsx:236-242`. Label is hardcoded English (no `t()`) — as is the adjacent "Budgets" item (`main-nav.tsx:250`), while the apiKeys/systemVariables siblings do use `t()` (`main-nav.tsx:222,230`).
2. All three routes are client components with `export const dynamic = "force-dynamic"` (`models/page.tsx:10`, `create/page.tsx:10`, `edit/[id]/page.tsx` — top). No frontend route guard; authorization is enforced by the GraphQL backend.
3. Mode branch on `configContext?.liteLLM?.enabled === true` in all three routes (`page.tsx:15`, `create/page.tsx:14`, `edit/[id]/page.tsx:19`).

**List page — `/models` (custom-models mode)**

4. Page header: title "Models" (`text-2xl font-bold`) + mode-dependent description (`page.tsx:24-29`).
5. Server-paginated models table, 10 per page, default order **`updatedAt` DESC** (most recently updated first — baked into `GET_MODELS` as the `$sort` variable's default, `queries/queries.ts:1196-1199`; the client never overrides it), with **30-second polling** (`GET_MODELS`, `queries/queries.ts:1193`; poll at `models/components/data-table.tsx:84-89`).
6. Stale-while-loading: previous page's data is shown while a refetch is in flight, preventing flicker (`data-table.tsx:100-109`). **Caveat:** the same fallback also masks *failed* polls/refetches — the query's `error` is never read, so stale `previousData` renders indefinitely with no indicator (see U19).
7. Column: row-select checkbox per row + select-all-on-page header checkbox, with `aria-label`s (`models/components/columns.tsx:44-67`).
8. Column: Name — medium-weight name + truncated description underneath, both `max-w-[260px] truncate` (`columns.tsx:68-85`).
9. Column: Provider — raw provider id in `font-mono text-xs` (`columns.tsx:86-94`).
10. Column: Auth variable — variable name in mono, `—` when unset (`columns.tsx:95-105`).
11. Column: Active — CheckCircle icon + green "Active" badge, or XCircle + outline "Inactive" badge; has a `filterFn` defined (values-includes) though no filter UI is wired to it (`columns.tsx:106-126`). **Caveat:** that `filterFn` is a *client-side* TanStack filter on a *server-paginated* table (`manualPagination`, 10 rows per fetch, `data-table.tsx:84-89,127`) — wired up, it would filter only the currently fetched page while pagination counts stay wrong. It is dead code, not a foundation to build on; the working mechanism is the server-side `ModelFilters.active` key (`data-table.tsx:46-52`), see §3.
12. Column: Access — `rights_mode` mapped to badge: public→default "Public", private→outline "Private", users→secondary "Users", roles→secondary "Roles", fallback outline with raw value or `—` (`columns.tsx:28-41,127-136`).
13. Column: Limits — compact summary string joining `requests_per_window/window_seconds s`, `token_budget tok`, `$cost_budget_usd` with `·`, `—` when none (`columns.tsx:137-157`).
14. Column: Created — locale date (`columns.tsx:158-168`).
15. Per-column "sort" via header dropdown: Asc / Desc / Hide column (`models/components/data-table-column-header.tsx:34-69`). **Caveat:** this is *client-side* sorting (`getSortedRowModel`, `data-table.tsx:124`) on a server-paginated table — it reorders only the 10 fetched rows; the `sorting` state is never sent as `GET_MODELS`'s `$sort` variable (`data-table.tsx:84-89`), so the true list order remains the server default `updatedAt DESC` (#5). The honest contract item is "reorder rows within the current page", not real sorting; the redesign replaces it with server-side sort (ladder row 15, U16).
16. Column visibility "View" dropdown toggling hideable columns **that have an accessor** — the menu filters to `typeof column.accessorFn !== "undefined"` (`models/components/data-table-view-options.tsx:40-43`), so the id-only Limits column (#13, `columns.tsx:137-157`, no `accessorKey`) cannot be toggled today. **Hidden below `lg`** (`data-table-view-options.tsx:29`).
17. Name search: "Filter models..." input building a server-side `{ name: { contains } }` filter and refetching on every keystroke (`data-table.tsx:131-141,149-154`).
18. "Reset" button clears the name filter, shown only while filtered (`data-table.tsx:143,201-217`).
19. "Add Model" button (primary, Plus icon) → `/models/create` (`data-table.tsx:156-159`).
20. Bulk delete: when any rows are selected, a secondary "Delete" button appears and immediately fires `REMOVE_MODEL_BY_ID` per selected row via `Promise.all` — **no confirmation dialog**; success/failure toasts; resets selection (`data-table.tsx:161-199`).
21. Row actions dropdown (ghost `…` button with `sr-only` label): "Edit model" → `/models/edit/[id]`, separator, "Delete model" in red (`models/components/data-table-row-actions.tsx:66-90`).
22. Single-delete confirmation AlertDialog with consequence copy ("Any agents pointing at this model will fail until they are reassigned. … cannot be undone"), red confirm button, success/error toasts (`data-table-row-actions.tsx:92-114,49-64`).
23. Empty table state: single row "No models found." (`data-table.tsx:256-264`). **Caveat:** this row is not gated on query success — it also renders when the first load *fails* (no error branch exists in the file), presenting an outage as an empty registry (see U19).
24. Pagination footer: "x of y row(s) selected" count, "Page x of y", first/prev/next/last icon buttons with `sr-only` labels and disabled states from `pageInfo.hasPreviousPage/hasNextPage`; first/last hidden below `lg` (`data-table.tsx:269-333`). **Caveat:** the disabled states bind to `data?.modelsPagination?.pageInfo` (`data-table.tsx:287,300,313,326`), not the *displayed* (possibly `previousData`) page info — `data` is momentarily undefined during every 30s poll and refetch, so all four buttons flash disabled while the stale rows (#6) stay visible (see U20).

**List page — `/models` (LiteLLM mode)**

25. Read-only info banner: "Models are configured in LiteLLM's `config.yaml`…" + outline button "Open LiteLLM Admin UI" opening `<backend-host>/litellm-admin/ui` in a new tab (URL derived from `config.backend`, `models/components/litellm-catalog-view.tsx:46-86`).
26. Catalog table from `GET_LITELLM_CATALOG` (`queries/queries.ts:1368`), `cache-and-network`: columns Model name, Context (in/out), Modalities, Cost (in/out), Active, Tags (`litellm-catalog-view.tsx:98-176`). An "Upstream model" column exists but is commented out (`:103,128-130`).
27. Model name cell renders `ProviderLogo` (brand + region) next to the name (`litellm-catalog-view.tsx:122-127`).
28. `ProviderLogo` shared component: brand logo with light/dark PNG variants from `/public/ai/logos/{light,dark}/<brand>.png` switched via `dark:` classes (no hydration mismatch), Sparkles fallback for unknown brand, region indicator — blue "EU" pill or Globe icon — with `aria-label`/`title` (`components/provider-logo.tsx:23-79`).
29. Token formatting helper: ≥1M → `1.2M`, ≥1K → `128K`, else raw, `—` for null (`litellm-catalog-view.tsx:39-44`).
30. Modality badges: vision / pdf / audio / tools, rendered only when supported (`litellm-catalog-view.tsx:135-150`).
31. Cost badges: `$X.XX/M` for input and output cost per million tokens (hidden when value falsy, including 0) (`litellm-catalog-view.tsx:151-158`).
32. Active/Inactive outline badge per catalog entry (`litellm-catalog-view.tsx:159-161`); secondary badges for arbitrary tags (`:162-170`).
33. Catalog loading spinner (only when no cached items), error panel ("Failed to load LiteLLM catalog. Make sure LiteLLM is running…"), and empty state ("No models configured in LiteLLM. Edit `config.yaml`…") (`litellm-catalog-view.tsx:88-118`).

**Create & edit — `/models/create`, `/models/edit/[id]` (custom-models mode)**

34. Shared `ModelForm` for create and edit (`models/components/model-form.tsx`), with page-level headers and descriptions (`create/page.tsx:39-48`, `edit/[id]/page.tsx:43-51`).
35. Field: Name* with example placeholder "e.g. Vertex Gemini 2.5 Flash — Production" (`model-form.tsx:178-187`).
36. Field: Description textarea, optional internal note, 2 rows (`model-form.tsx:189-198`).
37. Field: Provider* select sourced from `GET_PROVIDERS` (code-defined providers; each item shows mono provider id + display name) (`model-form.tsx:200-218`; query at `queries/queries.ts:1175` — note it also fetches `capabilities` and `maxContextLength`, currently unused by the form).
38. Provider authentication help panel: when the selected provider has `authenticationInformation`, show it in a muted, `whitespace-pre-wrap` callout under the select (`model-form.tsx:219-224`).
39. Field: Authentication variable select listing **encrypted variables only** (`GET_VARIABLES` filtered `encrypted eq true`, limit 100); inline empty state "No encrypted variables found. Create one in Variables first."; helper text explaining the pairing (`model-form.tsx:63-65,227-257`).
40. Field: Active switch, default on (`model-form.tsx:43,259-262`).
41. Field group: Access via shared `RBACControl` — rights_mode private/users/roles/teams/public with user/role/team pickers and per-entry read/write rights (`model-form.tsx:264-275`; `components/rbac.tsx:40-48,52+`). **Known defect:** the submit payload only sends `RBAC.users` and `RBAC.roles` (`model-form.tsx:124-127`) and `GET_MODEL_BY_ID` fetches no teams (`queries/queries.ts:1252-1262`), so a "teams" selection silently does not persist.
42. Collapsible "Rate limits & budget (advanced)" section, default collapsed, toggled by a text button with unicode `▶/▼` (`model-form.tsx:277-284`).
43. Inside it: amber warning "These limits are stored but **not enforced** until LiteLLM is enabled…" (`model-form.tsx:287-291`).
44. Limit fields in a 2-column grid: Requests per window, Window seconds, Token budget, Cost budget (USD, step 0.01), Budget window select (daily / monthly / lifetime) (`model-form.tsx:292-343`).
45. Validation: name + provider required → destructive toast "Missing fields" (`model-form.tsx:108-115`); empty optional numerics submitted as `null` (`model-form.tsx:128-132`).
46. Submit: `CREATE_MODEL` / `UPDATE_MODEL` with refetch of list (and detail on edit), loading spinner inside the button, success toast naming the model, redirect to `/models`; error toast with server message (`model-form.tsx:97-157,348-351`).
47. Cancel button → `/models`, disabled while submitting (`model-form.tsx:352-359`).
48. Edit prefill: `GET_MODEL_BY_ID` populates every field incl. RBAC and limits (`model-form.tsx:66-95`); the form blocks behind a centered spinner until providers + variables + model are all loaded, deliberately, so Select values can resolve to mounted items (`model-form.tsx:163-174`).
49. LiteLLM mode on create/edit: "Not available in LiteLLM mode" info card explaining `config.yaml` + restart, with an outline "Back to models" button (`create/page.tsx:16-36`, `edit/[id]/page.tsx:21-41`).

**Downstream consumers (context the redesign must not break)**

50. `AgentModelSelector` consumes `GET_MODELS_LITE` (custom mode) or `GET_LITELLM_CATALOG` (LiteLLM mode) for the agent form, including a synthetic "(unknown — re-select)" stale entry when an agent's stored model id is missing from the current catalog (`app/(application)/agents/components/agent-model-selector.tsx:35-110`); chat's model override does the same (`app/(application)/chat/[agent]/[session]/chat.tsx:268-273`).
51. `RerankerSelector` — model-adjacent selector used only inside the agent edit form (`app/(application)/agents/edit/[id]/form.tsx:1576`): a Select with an embedded search input that autofocuses on open, filtering rerankers from `GET_RERANKERS` (`components/reranker-selector.tsx`). Rerankers are code-defined (id/name/description, `queries/queries.ts:761`) and have **no UI surface of their own** today.

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | The entire area renders **nothing below `md`** — every page root is `hidden … md:flex` with no mobile alternative. A phone user gets a blank screen. | `models/page.tsx:21`, `create/page.tsx:18,39`, `edit/[id]/page.tsx:23,44` |
| U2 | **High** | Bulk delete fires immediately on click with no confirmation — destructive at L1, inconsistent with the single-delete AlertDialog, and violates the philosophy rule "anything destructive lives at L3+ with confirmation". | `data-table.tsx:161-199` vs `data-table-row-actions.tsx:92-114` |
| U3 | **High** | Silent data loss: RBACControl offers a "teams" mode, but the form never submits `RBAC.teams` and the detail query never fetches teams — the admin believes access is scoped to a team; it isn't. Directly contradicts P3's "nothing here can surprise me". | `model-form.tsx:124-127`; `queries/queries.ts:1252-1262`; `components/rbac.tsx:40-48` |
| U4 | Med | Hardcoded light-theme colors: Active badge `bg-green-100 text-green-800 border-green-300` (no dark variants), catalog error panel `border-red-300 bg-red-50 text-red-900`, the single-delete confirm button `bg-red-600 hover:bg-red-700`, and the `text-red-600` "Delete model" menu item. All bypass the semantic tokens CLAUDE.md mandates; the first two glow in dark mode. The two red instances are resolved by the shared ConfirmDialog replacement (#22/#20). Also (style nit): the EU region pill in `ProviderLogo` hardcodes a blue palette (`bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300`) — functional in both themes thanks to its `dark:` variants, but it bypasses the semantic tokens like the rest of this list; relevant because the redesign promotes `ProviderLogo` into the custom table (#8/#28). Restyle with info-semantic tokens (see §4). | `columns.tsx:115`; `litellm-catalog-view.tsx:93`; `data-table-row-actions.tsx:108,85`; `components/provider-logo.tsx:65` |
| U5 | Med | Zero i18n in the whole area (titles, table headers, toasts, dialogs all hardcoded English) in an en/de app; even the nav label skips `t()`. | every file under `app/(application)/models/`; `main-nav.tsx:238` |
| U6 | Med | Search refetches the server on every keystroke with no debounce, and never resets pagination — filtering while on page 3 can land on an empty page. | `data-table.tsx:131-141`, `:81` (page state untouched by `search`) |
| U7 | Med | Provider column shows the raw provider id in mono instead of the human provider name/logo; meanwhile the LiteLLM view *does* show `ProviderLogo`. Two visual languages for the same concept. | `columns.tsx:91-93` vs `litellm-catalog-view.tsx:122-127` |
| U8 | Med | The "Rate limits & budget (advanced)" toggle is a plain text button with unicode `▶/▼` — no chevron icon, no `aria-expanded`, not the shadcn Collapsible, doesn't match any other disclosure in the app. | `model-form.tsx:278-284` |
| U9 | Med | LiteLLM empty-state row `colSpan={5}` under a 6-column header — the empty cell doesn't span the table. | `litellm-catalog-view.tsx:103-109` (6 `TableHead`s) vs `:114` |
| U10 | Med | Auth variable can never be cleared once chosen — the Select has no "None" item, yet the schema treats it as optional (`—` in the table). | `model-form.tsx:229-252`; `columns.tsx:100-104` |
| U11 | Med | Primary action "Add Model" sits inside the filter row, between the search input and conditional bulk-delete button, instead of the page header — when rows are selected the destructive button appears directly beside it. | `data-table.tsx:148-199` |
| U12 | Low | Edit form blocks behind a full spinner instead of a skeleton mirroring the form layout (philosophy: "skeletons mirror the real layout"). The mount-order constraint explains the gating, not the spinner. | `model-form.tsx:163-174` |
| U13 | Low | "Page x of y" can render "of -1" before the first response (`pageCount ?? -1`), and the "x of y row(s) selected" counter only counts the current page. | `data-table.tsx:113,269-277` |
| U14 | Low | 30s polling on a low-churn admin registry causes unnecessary network and re-render churn. | `data-table.tsx:88` |
| U15 | Low | Cost badges hidden when cost is `0` (falsy check) — free models show nothing instead of `$0.00/M`. | `litellm-catalog-view.tsx:152-157` |
| U16 | Med | Header sort is both clumsy (open dropdown, choose Asc/Desc — 3 interactions instead of click-to-toggle) and **silently wrong**: it sorts client-side (`getSortedRowModel`) on a server-paginated table, reordering only the 10 fetched rows while the real order stays the server's `updatedAt DESC`; the `sorting` state is never sent as `$sort` (inventory #15). | `data-table-column-header.tsx:36-68`; `data-table.tsx:84-89,124` |
| U17 | Low | `RerankerSelector` placeholder says "Search providers..." while listing rerankers; its loading state is a selectable `SelectItem value="loading"`; props typed `any`. | `components/reranker-selector.tsx:51,59-63,13` |
| U18 | Low | Limits column compresses three different concepts (`10/60s · 5000 tok · $20`) into one unlabeled string — cryptic for the infrequent-visit persona. | `columns.tsx:142-155` |
| U19 | **High** | The custom-models list handles **no errors at all**: the `useQuery(GET_MODELS)` call destructures only `{ loading, data, refetch, previousData }` — the string `error` appears nowhere in the file. Two failure modes follow: (a) on a failed *first load* there is no data branch, so the table renders the empty-state row "No models found." — actively telling an auditing admin the registry is empty when the query failed; (b) on a failed *30s poll or refetch* the stale-while-loading fallback (#6) silently shows `previousData` forever, with no staleness indicator. The LiteLLM catalog has an explicit error panel (#33); the custom table — the *editable* registry — has nothing. Violates philosophy.md "nothing critical to trust (errors…) may be hidden below L2" and P3's "nothing here can surprise me". Fixed in §3 "Table states" and ladder rows 6/23 + the new error-states row. | `data-table.tsx:84-89` (no `error` destructured), `:256-264` (empty row on failure), `:100-109` (silent stale fallback) |
| U20 | Low | Pagination button disabled-states bind to `data?.modelsPagination?.pageInfo` rather than the *displayed* page info (which may come from `previousData`) — during every 30s poll and refetch `data` is momentarily undefined, so all four buttons flash disabled even though stale rows stay visible (#6). Same class as U13. Fix: derive disabled states from the same resolved `pageInfo` the rows render from. | `data-table.tsx:287,300,313,326` vs `:100-109` |

### Mobile audit

**Severity: broken.** At 390px:

- All three routes render literally nothing: page roots use `hidden … md:flex` with no
  fallback branch (`models/page.tsx:21`, `create/page.tsx:18,39`, `edit/[id]/page.tsx:23,44`).
  This includes the LiteLLM "not available" notices.
- Were the `hidden` removed, the layout would still fail: the 9-column custom table and
  6-column catalog table have no responsive variants and would overflow horizontally; the
  search input is fixed `w-[150px] lg:w-[250px]` (`data-table.tsx:153`); the column-visibility
  "View" button is `hidden lg:flex` (`data-table-view-options.tsx:29`); first/last pagination
  buttons are `hidden lg:flex` (`data-table.tsx:281,320`); the limits grid is a fixed
  `grid-cols-2` (`model-form.tsx:292`) which becomes cramped at 390px; `p-8` page padding
  (`page.tsx:21`) wastes ~17% of a 390px viewport.
- P3's mobile job (personas.md: "respond to alerts … read-mostly with a few critical
  actions, one-handed") is impossible today: an admin paged about a misbehaving model cannot
  even *view* the registry from a phone.

---

## 2. Jobs to be done

**PRIMARY: P3 Admin — "See and control which models the org can use."** Their #1 job on this page is verifying/altering the registry: which models exist, whether they're active, what credential they use, and who can access them.

**P3 Admin (primary owner)** — infrequent, high-stakes visits; ranked by frequency:
1. Audit the registry: what models exist, which are active, who can reach them (every visit).
2. Add a model for a new provider/credential: name + provider + encrypted auth variable (occasional).
3. Rotate/repair credentials: change a model's auth variable after a secret rotation in Variables (occasional, often urgent).
4. Deactivate or delete a model being retired; understand the blast radius (agents pointing at it fail) (rare).
5. Scope access (RBAC) and pre-configure rate/budget limits for the LiteLLM rollout (rare).
6. In LiteLLM mode: confirm what `config.yaml` exposes and jump to LiteLLM's Admin UI (per deployment).

**P4 Developer (secondary)** — personas.md JTBD 5 ("configure models/providers for the deployment"):
1. Set up models for a fresh deployment (create flow, provider auth instructions).
2. Grab model ids/names for API calls — wants one-click copy and raw detail (L4).
3. In LiteLLM mode: check context windows, modalities, and per-token costs while integrating.

**P2 Power user (secondary, "choose")** — read-only browsing:
1. See which models exist, their capabilities and costs, to pick one in the agent form. (They normally consume this through `AgentModelSelector`, but the catalog view is their reference page.)

**Ownership matrix check:** `personas.md` lists Models as P3 primary / P4, P2 secondary — **correct, keep it**. One implementation-level mismatch worth recording: the nav today gates Models behind `role.agents === "write"` (`main-nav.tsx:236`), i.e. *P2's* permission, giving agent-builders full create/edit/delete on models. The matrix's intent (P3 writes, P2 chooses) implies the write surface should be gated by an admin-grade permission (e.g. a `models` or `variables`-class right), with `agents: write` granting at most read/catalog access. Flagged as a follow-up in §4; not a matrix correction.

---

## 3. Design concept

**Headline:** One calm registry table with a detail side panel; creation is three decisions, everything else folds away; LiteLLM mode is the same page with editing replaced by an honest "managed externally" affordance.

### Default view (L1)

What a P3 admin sees arriving at `/models` (custom-models mode), top to bottom:

1. **PageHeader** — "Models", one-line purpose ("Language models available to your agents."),
   and the single purple action **"Add model"** on the right. The long two-sentence
   explanation moves into the create flow and an info tooltip; the header stays one line.
2. **Toolbar** directly below — search input ("Search models…", debounced 300ms, resets to
   page 1), a quiet **Status** filter (All / Active / Inactive), a **Provider** filter
   (options from `GET_PROVIDERS`), and the column-visibility "View" menu at the right edge.
   **Both filters are server-side:** they write the `active` / `provider` keys of the
   existing `ModelFilters` type (`data-table.tsx:46-52`) and refetch with a page-1 reset —
   exactly the mechanism the name search already uses (#17). The client-side `filterFn` on
   the Active column (inventory #11) must **not** be wired to UI: on this server-paginated
   table (`manualPagination`, 10 rows per fetch) a TanStack column filter would silently
   filter only the visible page while pagination counts stay wrong. Delete it instead.
3. **The table** (ListDetail's list side), default-ordered **`updatedAt` DESC** exactly as
   today (#5 — recently changed models surface first, which is what an audit visit wants;
   header sort overrides it via `$sort`, see ladder row 15), reduced to what an audit glance
   needs:
   - **Model** — `ProviderLogo` (inventory #28, visual parity with LiteLLM mode) + name;
     description as a second muted truncated line. **Brand resolution (required for this to
     work):** custom models carry only a raw `provider` string — neither `GET_MODELS`
     (`queries/queries.ts:1193-1231`) nor `GET_PROVIDERS` (`queries/queries.ts:1175-1191`)
     returns the `brand`/`region` props `ProviderLogo` needs
     (`components/provider-logo.tsx:6-12`); today those fields exist only on
     `litellmCatalog` entries (`queries/queries.ts:1376-1377`). Without a source, every
     custom row would render the Sparkles fallback and U7 would not actually be fixed. The
     spec: the backend adds `brand` (and optionally `region`) to the code-defined provider
     type returned by the `providers` query; the list page then joins `model.provider` →
     provider record from the `GET_PROVIDERS` result it already loads for the Provider
     filter. Until that field ships, use an interim frontend map (`lib/provider-brands.ts`,
     provider id → logo asset name under `/public/ai/logos/`) maintained alongside the
     code-defined provider list; providers missing from the map keep the Sparkles fallback,
     acceptable because the name sits beside the logo. Custom mode passes
     `showRegion={false}` — region is a LiteLLM-catalog concept, and without a value the
     component would render a meaningless Globe.
   - **Status** — quiet status: muted green dot + "Active" text for healthy, gray dot +
     "Inactive" for off (semantic tokens, both themes; replaces the green badge of #11).
   - **Access** — the existing rights_mode badge (#12).
   - **Auth variable** — mono, `—` when unset (#10). Critical to job 3 (credential
     rotation), so it stays at L1.
   - Row click opens the **detail panel** (L2). The `…` row-action menu remains for
     Edit / Delete.
   - Columns demoted to opt-in (hidden by default, restorable via "View"): Provider id (#9 —
     redundant with the logo+name), Limits (#13 — unenforced until LiteLLM; the column must
     gain an accessor first or the accessorFn-filtered View menu cannot list it, inventory
     #16), Created (#14). Nothing is removed; defaults get calmer.
4. **Pagination** footer as today (#24), with the selected-count text shown only while a
   selection exists, and disabled states derived from the *displayed* `pageInfo` (the same
   `data ?? previousData` resolution the rows use) so buttons no longer flash disabled during
   every poll/refetch (U20).
5. **Table states** — all four are L1 specifications, not implementation details
   (philosophy.md: errors are trust-critical and may not be hidden below L2; today the
   custom table has *no* error handling at all, U19):
   - **First load:** skeleton rows mirroring the table layout (#6 upgraded).
   - **First-load error** (no data, no `previousData`): the table body is replaced by the
     same semantic destructive callout pattern the LiteLLM catalog uses (ladder row 33) —
     plain-language message ("Couldn't load models. The server may be unreachable."), the
     server error detail one level deeper (collapsed, `font-mono text-xs`), and a "Retry"
     button wired to `refetch`. The "No models found." / EmptyState row must **never**
     render on error.
   - **Failed poll/refetch with stale data:** keep the stale rows visible (the fallback of
     #6 is right to avoid blanking the screen), but add a quiet staleness line above the
     table — warning-semantic tokens, "Couldn't refresh — showing data from HH:MM" + inline
     "Retry". It disappears on the next successful response. Silent-forever stale data
     (today's behavior) is the failure mode this exists to prevent.
   - **Empty** (successful response, zero items, no active filters): **EmptyState** — Cpu
     icon, "No models yet. Pair a provider with an encrypted credential to make it
     available to agents.", primary "Add model" button (#23 upgraded). With active filters:
     "No models match your filters." + Reset.

**LiteLLM mode L1:** identical PageHeader (description: "Read-only — models are managed in
LiteLLM."), no "Add model" button; in its place an outline **"Open LiteLLM Admin UI"**
button (#25). The banner shrinks to one quiet line above the table with an info tooltip
carrying the full `config.yaml` explanation. The catalog table keeps Model name (+logo),
Context, Modalities, Cost, Status, Tags (#26-#32) with the colSpan and $0-cost bugs fixed.
Row click opens the same detail panel pattern, read-only.

**Primary action:** "Add model" (custom mode) / "Open LiteLLM Admin UI" (LiteLLM mode). The
only purple on the screen.

### Disclosure ladder

Every inventory item mapped. "→" means the item moves from its current location.

| # | Capability | Level | Where it lives |
|---|------------|-------|----------------|
| 1 | Sidebar nav entry (RBAC-gated) | L0 | Sidebar, Administration group |
| 2 | force-dynamic client routes | — | unchanged (infrastructure) |
| 3 | LiteLLM mode branch | L1 | same page, swapped table + header action |
| 4 | Page title + purpose | L1 | PageHeader (description shortened; full text → tooltip/create page) |
| 5 | Paginated model list | L1 | ListDetail table |
| 6 | Stale-while-loading data | L1 | kept for in-flight refetches + skeleton rows on first load; on a *failed* poll/refetch the stale rows gain the staleness warning line (§3 Table states, U19) instead of masquerading as fresh |
| 7 | Row selection / select-all | L2 | checkboxes appear on row hover/focus or via "Select" in toolbar overflow; always-on at L1 is noise for an audit glance |
| 8 | Name + description cell | L1 | Model column, with ProviderLogo (brand resolved per §3 Default view: backend `brand` on the providers query, interim `lib/provider-brands.ts` map until then; `showRegion={false}`) |
| 9 | Provider id (raw, mono) | L2/L4 | hidden-by-default column via "View"; always in detail panel with CopyField |
| 10 | Auth variable cell | L1 | table column (credential rotation is a frequent urgent job) |
| 11 | Active status (+ filterFn) | L1 | StatusDot column; Toolbar Status select → **server-side** `ModelFilters.active` filter + page reset (the name search's mechanism, #17); the client `filterFn` (columns.tsx:125) is deleted, not wired — on the server-paginated table it could only ever filter the fetched page |
| 12 | Access badge | L1 | table column |
| 13 | Limits summary | L2 | → detail panel "Limits" section, labeled values; optional column via "View" (requires giving the column an accessor — it is id-only today and the View menu filters to accessorFn columns, inventory #16) |
| 14 | Created date | L2 | → detail panel meta block; optional column via "View" |
| 15 | Sort asc/desc/hide per column | L2 | click-to-toggle header sort, wired **server-side**: pass the `sorting` state as `GET_MODELS`'s `$sort` `{ field, direction }` variable with a page-1 reset, and drop `getSortedRowModel` (today's client sort reorders only the fetched page, U16/inventory #15). Unsorted default stays `updatedAt DESC`. Hide stays in the header dropdown |
| 16 | Column visibility "View" menu | L2 | Toolbar right edge; must list every hideable column — give Limits an accessor so it qualifies (see #13, inventory #16) |
| 17 | Name search | L1 | Toolbar search (debounced, resets page) |
| 18 | Reset filter | L1 | clear "×" inside the search input + "Reset" chip when any filter active |
| 19 | Add Model → /models/create | L1 | PageHeader primary action |
| 20 | Bulk delete | L3 | selection → contextual bar "n selected · Delete" → **ConfirmDialog** listing count + agent-breakage warning (fixes U2) |
| 21 | Row actions: Edit / Delete | L2 | row `…` menu (kept); row click → detail panel; Edit also a button in panel footer |
| 22 | Single-delete confirm + consequence copy | L3 | shared ConfirmDialog (same copy, same component as #20) |
| 23 | List empty state | L1 | EmptyState primitive — rendered only on a *successful* zero-item response, never on query failure (U19; error gets the destructive callout, §3 Table states) |
| 24 | Pagination controls | L1 | table footer (first/last restored on all sizes ≥ md, prev/next only on mobile); disabled states bound to the displayed pageInfo, not `data` only (U20) |
| 25 | LiteLLM read-only banner + Admin UI link | L1 | header action (link) + one-line notice; full explanation L2 tooltip |
| 26 | LiteLLM catalog table | L1 | catalog table (LiteLLM mode) |
| 27 | Logo in catalog name cell | L1 | unchanged |
| 28 | ProviderLogo (light/dark, EU/Globe, fallback) | L1 | unchanged in the catalog; reused in the custom table (#8) with brand from the §3 resolution and `showRegion={false}` (custom models have no region data) |
| 29 | K/M token formatting | L1 | unchanged |
| 30 | Modality badges | L1 | catalog column; full list also in detail panel |
| 31 | Cost badges | L1 | catalog column (render `$0.00/M`, fix falsy check); also detail panel |
| 32 | Active badge + tags | L1 | catalog columns (StatusDot for active) |
| 33 | Catalog loading / error / empty states | L1 | skeleton rows; error via semantic destructive callout; EmptyState |
| 34 | Create/edit form pages | L2 | subpages (kept — deep-linkable), form re-grouped per below |
| 35 | Name field | L2 | form "Essentials" group (step 1 of 3 decisions) |
| 36 | Description field | L3 | → "Details" collapsed group (optional metadata) |
| 37 | Provider select | L2 | "Essentials" group; enriched item rows (name primary, mono id secondary) |
| 38 | Provider auth info panel | L2 | inline callout under provider select when selected (unchanged level) |
| 39 | Auth variable select + empty-state + helper | L2 | "Essentials" group; add "None" item (fixes U10); empty state links to /variables |
| 40 | Active switch | L2 | form header row, next to title ("Active" is a status, not a buried field) |
| 41 | RBAC access control (+ teams fix) | L3 | "Access" FormSection, collapsed by default showing summary ("Private"); teams must persist (mutation + query fix) |
| 42 | Limits collapsible | L3 | "Rate limits & budget" FormSection (shadcn Collapsible, chevron, `aria-expanded`) — fixes U8 |
| 43 | "Not enforced until LiteLLM" warning | L3 | inside #42, semantic warning callout (tokens, not raw amber) |
| 44 | Five limit fields | L3 | inside #42, `grid-cols-1 sm:grid-cols-2` |
| 45 | Validation + null coercion | L2 | inline field errors on the required fields + toast fallback (unchanged data behavior) |
| 46 | Submit + toasts + redirect | L2 | sticky form footer |
| 47 | Cancel | L2 | form footer |
| 48 | Edit prefill + load gating | L2 | keep gating (Select mount-order constraint is real); replace spinner with form-shaped skeleton |
| 49 | LiteLLM "not available" notice on create/edit | L2 | unchanged (kept as guard for deep links) |
| 50 | Stale-model affordance in consumers | — | out of scope here; unaffected (list/detail data contracts unchanged) |
| 51 | RerankerSelector | L3 (in agent form) | refactor onto shared **SearchableSelect** primitive; fix placeholder/loading-item (U17). Optional follow-up: read-only "Rerankers" L2 tab on /models so the capability has a visible home — additive, not required |
| — | Model id, timestamps, created_by, raw record | L2/L4 | **NEW detail panel**: lazily fetches `GET_MODEL_BY_ID` on open (the list rows carry no RBAC block — see §3 Layout & components for the full data contract); CopyField for id/name, meta block (created/updated/created_by), "Raw JSON" toggle at L4 for P4 |
| — | Custom-list error & staleness states | L1 | **NEW (U19)**: first-load failure → semantic destructive callout with Retry replacing the table body (same pattern as catalog row 33), never the empty row; failed poll → stale rows stay + warning staleness line; full spec in §3 Table states |

The detail panel is the one genuinely new surface: it gives P3 an audit view (full limits,
access list, credential, timestamps) and P4 copyable ids/raw JSON without leaving the list —
today that information is only reachable by opening the edit form.

### Layout & components

**`/models` (both modes)**
- `PageShell` (full-bleed work surface variant) → `PageHeader` (title `text-2xl`, description
  `text-sm text-muted-foreground`, action slot) → `Toolbar` → table → pagination. Vertical
  rhythm `space-y-6`; page padding `p-8` desktop, `p-4` mobile (CLAUDE.md spacing scale).
- Table: shadcn `Table` inside `rounded-md border` (one box, no nesting). Cells `text-sm`,
  secondary text `text-xs text-muted-foreground`, mono values `font-mono text-xs`.
- StatusDot: `size-2 rounded-full` + label; active = success token, inactive =
  `bg-muted-foreground/40`. No hardcoded Tailwind greens (fixes U4).
- Filters: shadcn `Select` (Status, Provider) `h-8` to match the `h-8` View button; search
  `Input` `h-8 w-full max-w-[250px]`.
- Detail panel: shadcn `Sheet` (right, `sm:max-w-md`) — sections "Configuration" (provider w/
  logo, auth variable CopyField, status), "Access" (rights_mode + resolved user/role/team
  list — data contract below), "Limits" (labeled rows), "Meta" (created/updated/created_by,
  id CopyField), footer `Edit` (default) + `Delete` (ghost destructive → ConfirmDialog).
  L4: "Raw" toggle rendering the record as `font-mono text-xs` JSON in a `bg-muted` block.
  - **Data source (normative):** the panel **lazily fetches `GET_MODEL_BY_ID` on open**
    (`useLazyQuery`, fired when the Sheet mounts for a row). It cannot render from the list
    row alone: `GET_MODELS` items carry only `rights_mode` — no RBAC block at all
    (`queries/queries.ts:1212-1229`). While the query is in flight the Sheet shows a
    section-shaped skeleton (not a spinner); on error, the same destructive
    callout + Retry pattern as the table's first-load error (U19), inside the Sheet.
  - **Access-list resolution:** even `GET_MODEL_BY_ID` returns only bare
    `{ id, rights }` entries for users and roles (`queries/queries.ts:1252-1262`) — names
    are *not* in the payload, so "resolved" requires lookups the panel must own:
    **users** via the existing `GET_USERS_BY_IDS` (`queries/queries.ts:1608`, returns
    id/name/email) batched over the RBAC user ids; **roles** have no by-ids query — resolve
    client-side against the `GET_USER_ROLES` list (`queries/queries.ts:636`, the same query
    `RBACControl` already loads, `components/rbac.tsx:87`). Any id that fails to resolve
    renders as its mono id with a "deleted or inaccessible" tooltip — never silently
    dropped. Preferred end-state: the backend enriches the model's RBAC block with `name`
    per entry so the panel needs exactly one query (backend ticket, §4 Dependencies); the
    lookups above are the specified interim.
  - **Teams caveat:** `GET_MODEL_BY_ID` fetches **no teams** until the U3 query/mutation fix
    lands. Until then, when `rights_mode === "teams"`, the Access section must show an
    honest notice ("Team assignments can't be displayed yet — pending the teams persistence
    fix") rather than an empty list that implies nobody has access. After the U3 fix, teams
    resolve via `GET_TEAMS` (`queries/queries.ts:699`) like roles.
- Bulk-selection bar: slides in above the table (`bg-muted/50 rounded-md p-2`), "n selected",
  `Delete` (destructive outline) → ConfirmDialog, "Clear".
- `EmptyState`, `ConfirmDialog` from the shared primitives (philosophy §5).

**`/models/create`, `/models/edit/[id]`**
- `PageShell` centered-content variant, `max-w-3xl`; `PageHeader` with back-chevron to
  /models, title, Active switch in the action slot (#40).
- Form `space-y-6`. Groups:
  1. **Essentials** (always open): Name, Provider (+auth info callout #38), Auth variable.
  2. **Access** — `FormSection` (collapsed, summary value shown in the header, e.g.
     "Private" / "3 roles").
  3. **Rate limits & budget** — `FormSection` (collapsed; warning callout #43 inside, styled
     with warning tokens: `border-warning/40 bg-warning/10`).
  4. **Details** — `FormSection` (collapsed): Description.
- Sticky footer (`border-t bg-background p-4`): primary submit + outline Cancel.
- All shadcn: `Input`, `Textarea`, `Select`, `Switch`, `Label`, `Collapsible`, `Button`,
  `Sheet`, `AlertDialog`, `Badge`, `Skeleton`.
- Every user-facing string through next-intl (`models.*` namespace), en + de — fixes U5;
  includes the nav label (`main-nav.tsx:238`).

### Mobile behavior

Designed for P3's mobile job: *check the registry and flip a switch one-handed* — read-mostly,
critical actions reachable.

- **< md (390px target):** drop the `hidden md:flex` gate everywhere. The table becomes a
  **card list** — the intended suite-wide tables→cards standard. Note: `design/responsive.md`
  is **not yet written** (philosophy.md forward-references it, but no such file exists in
  `design/` yet); until it exists, the card spec in this paragraph is the normative,
  self-sufficient definition for this page and should seed that document. Each card =
  ProviderLogo + name (truncating), StatusDot, access badge; tap → detail Sheet sliding from
  the bottom (`max-h-[85vh]`, scrollable). All actions (Edit, Delete, copy id) live in the
  sheet — no hover-only affordances. Toolbar: search full-width; Status/Provider filters
  collapse into a single "Filter" button opening a small sheet; "View" (column toggles)
  hidden, irrelevant for cards. Pagination: prev/next + "Page x of y" only. Bulk select:
  long-press is not discoverable — selection mode entered via toolbar overflow "Select"; same
  ConfirmDialog. LiteLLM catalog cards: name+logo, context, cost, modality badges wrap.
- **Forms < sm:** single column (`grid-cols-1`), limit grid `sm:grid-cols-2`; sticky footer
  buttons full-width side by side; FormSections remain collapsible (less scrolling). Editing
  on a phone is acceptable-not-optimized per philosophy §7 — but never broken.
- **md–lg:** table view with the L1 column set (Model, Status, Access, Auth variable,
  actions); detail Sheet from the right; toolbar inline.
- **≥ lg:** full table + optional columns restorable, first/last pagination, View menu.

### Motion

Per CLAUDE.md timings, all honoring `prefers-reduced-motion`:

- Row/card hover: background transition 150ms `ease-in-out`.
- Detail Sheet: slide-in 300ms (right ≥ md, bottom < md) — explains origin (the row).
- FormSection expand/collapse: height + chevron rotate 200ms.
- Bulk-selection bar: slide/fade in 200ms above the table — explains causality (selection
  made it appear).
- First-load: skeleton rows mirroring the table/card layout (no spinner walls); form skeleton
  on edit prefill. No other animation.

---

## 4. Implementation notes

**Files to change**
- `app/(application)/models/page.tsx` — PageShell/PageHeader/Toolbar composition; remove
  `hidden md:flex`; move "Add model" to header; mode-aware header action.
- `app/(application)/models/components/data-table.tsx` — debounced search + page reset (U6);
  Status and Provider filters as **server-side** `ModelFilters` entries (`active`,
  `provider` — the type already supports both, `data-table.tsx:46-52`), refetching with a
  page-1 reset; **server-side sorting** — pass the `sorting` state as `GET_MODELS`'s `$sort`
  variable (page reset on change) and remove `getSortedRowModel` (U16); bulk delete behind
  ConfirmDialog (U2), selection bar, skeleton rows, drop or lengthen the 30s poll (U14),
  responsive card list < md, fix "of -1" page count (U13); **destructure and handle `error`
  from the `useQuery` result (U19)** — first-load failure renders the destructive callout +
  Retry in place of the table body (never the "No models found." row; gate the EmptyState on
  a successful response), poll/refetch failure renders the staleness warning line above the
  kept stale rows, per §3 Table states; bind the four pagination buttons' disabled states to
  the *displayed* pageInfo (`data ?? previousData` resolution) instead of
  `data?.modelsPagination?.pageInfo` so they stop flashing disabled on every poll (U20,
  `data-table.tsx:287,300,313,326`).
- `app/(application)/models/components/columns.tsx` — ProviderLogo in name cell (brand via
  the §3 resolution, `showRegion={false}`), StatusDot with semantic tokens (U4), default
  visibility (provider/limits/created hidden), give the Limits column an accessor so the
  View menu can list it (inventory #16), and **delete** the client-side Active `filterFn`
  (columns.tsx:125) — superseded by the server-side status filter in data-table.tsx; do not
  wire UI to it.
- `app/(application)/models/components/data-table-row-actions.tsx` — consume shared
  ConfirmDialog; add "View details" / make row click open the panel.
- **NEW** `app/(application)/models/components/model-detail-panel.tsx` — Sheet detail (L2)
  with CopyFields, limits, access, meta, raw JSON (L4). Data contract per §3 Layout &
  components: lazy `GET_MODEL_BY_ID` on open (list rows have no RBAC block), section-shaped
  skeleton while loading, in-Sheet error callout + Retry; Access names resolved via
  `GET_USERS_BY_IDS` (users) and the `GET_USER_ROLES` list (roles), unresolved ids shown as
  mono id + tooltip; "teams" mode shows the honest pending-U3 notice until the teams
  query/mutation fix lands.
- `app/(application)/models/components/model-form.tsx` — FormSection regrouping, shadcn
  Collapsible (U8), "None" auth-variable item (U10), inline validation, skeleton instead of
  spinner (U12), semantic warning tokens, **submit `RBAC.teams`** (U3).
- `queries/queries.ts` — add `teams { id rights }` to `GET_MODEL_BY_ID` RBAC block and pass
  teams in `CREATE_MODEL`/`UPDATE_MODEL` (verify backend `RBACInput` accepts `teams`; if not,
  this becomes a backend ticket and the UI must disable the "teams" mode option with an
  explanatory tooltip rather than silently no-op). Sorting needs **no query change** —
  `GET_MODELS` already declares `$sort` with default `updatedAt DESC`
  (`queries.ts:1196-1199`); the table just has to start sending it. Add `brand` (+ `region`)
  to `GET_PROVIDERS` once the backend exposes them on the provider type (backend ticket
  below); until then the §3 interim `lib/provider-brands.ts` map covers the join.
- `app/(application)/models/components/litellm-catalog-view.tsx` — colSpan fix (U9), `$0`
  cost rendering (U15), semantic error tokens (U4), condensed banner, card layout < md,
  optional re-enable of the upstream-model column inside the detail panel (it's currently
  commented out — surfaces at L2 instead of cluttering L1).
- `app/(application)/models/create/page.tsx`, `edit/[id]/page.tsx` — shell/header refactor;
  remove `hidden md:flex`.
- `components/provider-logo.tsx` — restyle the EU region pill (`:65`) with semantic
  info-tokens instead of the hardcoded blue palette (U4 addendum); behavior unchanged.
- `components/reranker-selector.tsx` — rebuild on SearchableSelect; fix placeholder, loading
  item, and `any` types (U17).
- `components/custom/main-nav.tsx:238` — translate the "Models" label; (follow-up) revisit
  the `role.agents === "write"` gate vs. an admin-grade models permission (§2).
- i18n: add `models.*` keys to `messages/en.json` / `messages/de.json` (U5).

**Shared components needed**
- From philosophy §5: `PageShell`, `PageHeader`, `Toolbar`, `ListDetail` (table + Sheet
  detail variant), `EmptyState`, `ConfirmDialog`.
- **NEW shared primitives not yet in philosophy §5** (used by many pages — propose adding):
  - `StatusDot` — quiet status indicator (dot + label, semantic tokens); needed by agents,
    users, evals, workflows too.
  - `CopyField` — mono value + one-click copy + toast; P4's "one-click copy on every ID"
    bias; needed by token, keys, agents, variables.
  - `FormSection` — collapsible form group with header summary value and `aria-expanded`;
    the standard L3 "Advanced" pattern for every create/edit form.
  - `SearchableSelect` — Select/Command hybrid with embedded search; currently hand-rolled
    three times (`reranker-selector.tsx`, `agent-model-selector.tsx`, RBAC pickers).
  - `RawJsonView` — collapsed `font-mono` JSON block, the standard L4 toggle.

**Scope: M.** No data-model changes (except the RBAC-teams wire-through), no route changes;
one new surface (detail panel), one form regroup, responsive work across three routes.

**Dependencies**

*Note: `design/navigation.md`, `design/codebase-structure.md`, and `design/responsive.md` are
**not yet written** — philosophy.md forward-references them as planned suite docs, but none
of these files exist in `design/` today. This page doc is deliberately self-sufficient
(mobile card spec in §3, primitives list above) so it does not block on them.*

- Shell/nav redesign (`design/navigation.md`, pending): Administration group placement and
  the gating decision for the Models item. Until it exists, keep the current sidebar
  placement.
- Shared primitives must exist first (or be extracted here and promoted) — coordinate with
  `design/codebase-structure.md` (pending).
- `design/responsive.md` (pending) tables→cards and panel→sheet standards — seed it from
  this page's §3 mobile spec rather than waiting on it.
- Backend: confirm `RBACInput.teams` support; confirm whether a dedicated `models` permission
  exists or `agents:write` remains the gate; expose `brand`/`region` on the code-defined
  provider type (`providers` query) so custom-model rows can render `ProviderLogo` without
  the interim frontend map (§3); (optional, simplifies the detail panel) enrich the model
  RBAC block with a per-entry `name` so the panel's Access list resolves in one query
  instead of the interim `GET_USERS_BY_IDS` / `GET_USER_ROLES` lookups (§3).

**Risks**
- The interim `lib/provider-brands.ts` map can drift from the backend's code-defined
  provider list (new provider added server-side → Sparkles fallback until the map is
  updated). Treat the map as temporary and prefer the backend `brand` field; the fallback
  degrades gracefully (logo missing, name still present).
- RBAC-teams fix changes persisted access data — needs a migration story for models already
  saved with `rights_mode: "teams"` and empty teams (today effectively private-ish; after the
  fix, behavior must not silently widen access).
- Removing the 30s poll could regress freshness for admins who rely on it after CLI-side
  changes; keep `cache-and-network` + refetch-on-focus as the replacement.
- The edit-form load gating (`model-form.tsx:163-174`) exists for a real Select mount-order
  constraint — keep the gating when swapping spinner for skeleton, or Select values render
  blank.
- LiteLLM Admin UI URL derivation (`litellm-catalog-view.tsx:49-60`) assumes a reverse-proxy
  path on the backend host; keep the fallback behavior when refactoring.
