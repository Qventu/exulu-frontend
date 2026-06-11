# API Explorer — Review & Design Concept

**Routes:** `/explorer`  **Primary persona:** P4 (Developer)  **Secondary:** P2 (Power user with API-write role, occasional)  **Current state:** A bare, unbranded GraphiQL drop-in with a working auth wire-up but a broken RBAC gate, a token leaked to the console, dead theming CSS, and zero mobile handling.

> Ladder context: in the app-wide disclosure ladder (philosophy.md §2) this entire page **is the L4
> destination** ("Raw / expert — GraphiQL"). The ladder levels used in §3 below are therefore the
> page-internal ladder: L1 = what a developer sees on arrival at `/explorer`.

---

## 1. Current state

The route is a 7-line server page (`app/(application)/explorer/page.tsx:1-8`, `force-dynamic` at
line 4) that renders a single client component `GraphiQLComponent`
(`app/(application)/explorer/graphiql.tsx`). That component fetches the session JWT, builds an
authenticated fetcher, and renders the stock `<GraphiQL>` from `graphiql@5.2.2` with **no props
except `fetcher`** (graphiql.tsx:47) — so every GraphiQL default is active and constitutes page
functionality. There is no page header, no Exulu chrome, and no responsive handling.

### Functionality inventory

*A. Exulu wrapper (route, auth, chrome)*

1. **Route `/explorer`** — server page, `export const dynamic = 'force-dynamic'`, renders the
   client GraphiQL wrapper (page.tsx:1-8).
2. **Sidebar nav entry** — label `navigation.apiPlayground` = "Playground" (en, messages/en.json:22)
   / "API Playground" (de, messages/de.json:22), `Code` lucide icon, in the bottom nav group;
   **RBAC gate:** rendered only if `user.super_admin || role.api === "write"`
   (components/custom/main-nav.tsx:204-210).
3. **Session JWT acquisition** — TanStack Query, key `["user"]`, `getToken()` →
   `next-auth` `session.user.jwt` (graphiql.tsx:20-23; util/api.ts:30-34).
4. **Loading state** — a single `<Skeleton className="h-10 w-20" />` while the token loads
   (graphiql.tsx:25-27).
5. **Error state** — destructive `Alert` with `ExclamationTriangleIcon`, title "Error", and the
   raw error message (graphiql.tsx:29-37).
6. **Authenticated fetcher** — `createGraphiQLFetcher({ url: \`${backend}/graphql\`, headers:
   { Authorization: \`Bearer ${jwt}\` } })`; backend URL comes from `ConfigContext`
   (graphiql.tsx:41-45), populated server-side from `process.env.BACKEND`
   (app/(application)/layout.tsx:54; components/config-context.tsx).
7. **Custom GraphiQL stylesheet** — `app/graphiql.css` imported at graphiql.tsx:8: editor
   background/token-color/search-dialog/selection overrides mapping GraphiQL to Exulu CSS
   variables. Written against the CodeMirror editor (`.CodeMirror`, `.cm-s-graphiql`,
   graphiql.css:9-119) — see UX review for why this is now mostly dead.
8. **Monaco worker setup** — `import 'graphiql/setup-workers/webpack'` (graphiql.tsx:6) wires
   the Monaco editor web workers for the Next/webpack build.

*B. GraphiQL 5.2.2 built-ins (all defaults active; verified against
`node_modules/graphiql/dist/` and `@graphiql/react`)*

9. **Query editor** — Monaco-based: GraphQL syntax highlighting, schema-aware autocomplete,
   inline validation/lint, hover type info.
10. **Execute / stop** — run button (Ctrl/Cmd-Enter), operation picker when multiple named
    operations exist in one tab, abort of in-flight requests.
11. **Variables editor** — JSON editor in the collapsible "editor tools" drawer.
12. **Headers editor** — JSON editor for per-request custom headers (`isHeadersEditorEnabled`
    defaults to `true`); can override `Authorization` to test as another principal.
13. **Editor-tools drawer toggle** — show/hide variables+headers; auto-opens when either has
    content (`defaultEditorToolsVisibility` default behavior).
14. **Response pane** — formatted, syntax-highlighted JSON; `createGraphiQLFetcher` supports
    multipart/incremental delivery (`@defer`/`@stream`).
15. **Multi-tab sessions** — add/close/switch tabs; tab titles derive from operation names;
    per-tab query/variables/headers state.
16. **Documentation Explorer plugin** — sidebar-rail icon toggles a resizable pane: browse and
    search schema types/fields/arguments, deprecation notices, type navigation.
17. **History plugin** — sidebar-rail icon: automatic log of executed operations; re-open into
    the editor, favorite, edit label, delete entries.
18. **Re-fetch schema** — sidebar button re-runs introspection ("Re-fetch GraphQL schema",
    graphiql/dist/ui/sidebar.js).
19. **Short Keys dialog** — keyboard-shortcut reference (graphiql/dist/ui/short-keys.js).
20. **Settings dialog** — "Persist headers" toggle, Theme System/Light/Dark, "Clear storage"
    (wipes all persisted GraphiQL state) (graphiql/dist/ui/sidebar.js).
21. **Toolbar actions** — "Prettify query" (Shift-Ctrl-P), "Merge fragments into query"
    (Shift-Ctrl-M), "Copy query" (Shift-Ctrl-C) (graphiql/dist/ui/toolbar.js).
22. **Resizable split panes** — drag dividers between editor/response, plugin pane, and
    editor-tools drawer.
23. **localStorage persistence** — queries, variables, headers, tabs, history, and settings
    survive reloads; keys are currently **un-namespaced** (default storage).
24. **Logo & footer slots** — default "GraphiQL" wordmark/link in the session header
    (`GraphiQL.Logo`/`GraphiQL.Footer` slots, graphiql/dist/ui/logo.js, footer.js).
25. **Default query template** — commented onboarding text in a fresh/empty tab.

*C. Repo-level developer tooling (adjacent artifacts, no rendered UI — listed so nothing is lost)*

26. **`queries/queries.ts`** — 175 exported `gql` operations covering every domain the app
    touches (agents, sessions, contexts/items/chunks, models, users/roles/teams, prompts,
    skills, evals, budgets, transcriptions, platform config; queries.ts:1-3223). The de-facto
    example catalog for the API — currently not surfaced anywhere in the explorer.
27. **`graphql.config.yml`** — IDE/codegen schema pointer:
    `http://localhost:9001/api/graphql/introspection` (graphql.config.yml:1).
28. **`apollo.config.json`** — Apollo VSCode tooling pointer:
    `http://localhost:9001/graphql/introspection` (apollo.config.json:1-8).

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | **Session JWT logged to the browser console** — `console.log("token", data)` prints the bearer token on every render; anyone with devtools access (screenshares, support sessions, log harvesters) sees a live credential. | graphiql.tsx:39 |
| U2 | **High** | **RBAC gate is broken in both directions.** (a) `serverSideAuthCheck` builds the `role` object without `roles.api` (lib/server-side-auth-check.ts:43-52: only id, name, agents, workflows, variables, users, evals, budget_management) — so `role.api === "write"` at main-nav.tsx:204 is never true and the nav entry only ever renders for `super_admin`s; users whose role legitimately grants API write cannot find the page. (b) There is **no route-level guard**: page.tsx does no role check and the repo has no `middleware.ts`, so *any* authenticated user can open `/explorer` by URL and run introspection against the backend with their own token. The same broken predicate also hides the API Keys entry (main-nav.tsx:220). | lib/server-side-auth-check.ts:43-52; main-nav.tsx:204, 220; page.tsx:6-8 |
| U3 | **High** | **Theme split-brain.** GraphiQL manages its own System/Light/Dark setting in its Settings dialog, persisted in its own localStorage — the app's next-themes toggle has no effect (`forcedTheme` prop exists in GraphiQL 5 but is unused). A user in dark Exulu can sit in a light GraphiQL. Violates philosophy §4 ("Both themes are first-class"). | graphiql.tsx:47; graphiql/dist/GraphiQL.d.ts (`forcedTheme`) |
| U4 | **Med** | **The custom theming CSS is dead code.** `app/graphiql.css` targets the CodeMirror editor (`.CodeMirror`, `.cm-s-graphiql`), but GraphiQL 5 swapped to Monaco (dist/style.css contains 950 `monaco` selectors and a single legacy CodeMirror mention). Result: the carefully mapped Exulu token colors/fonts silently no-op and GraphiQL renders in its stock pink-accented look — off-brand inside the product shell. | app/graphiql.css:9-119; node_modules/graphiql/dist/style.css |
| U5 | **Med** | **Loading state doesn't mirror the layout** — an 80×40 px skeleton floats in the top-left of an otherwise empty viewport while the token loads. CLAUDE.md mandates skeletons for known layouts; philosophy §6 mandates they mirror the real layout. | graphiql.tsx:26 |
| U6 | **Med** | **Stale-token failure mode.** The JWT is captured once into the fetcher closure at render. If the session token rotates/expires while the tab stays focused, every request silently 401s with no recovery hint (TanStack's refetch-on-focus is the only accidental refresh path). | graphiql.tsx:20-23, 41-45 |
| U7 | **Med** | **No page identity & inconsistent naming.** The page renders no title or header at all; the nav calls it "Playground" (en) / "API Playground" (de); the route is `/explorer`; personas.md calls it "API explorer". Three names for one surface. | messages/en.json:22; messages/de.json:22; personas.md:172 |
| U8 | **Low** | Error `Alert` renders flush against the content area with no page padding or recovery action. | graphiql.tsx:29-37 |
| U9 | **Low** | Fetcher object is recreated on every render (no memoization) — needless churn for GraphiQL's internals. | graphiql.tsx:41-45 |
| U10 | **Low** | GraphiQL localStorage keys are un-namespaced; any other GraphiQL instance on the same origin collides with Exulu's persisted tabs/history (the GraphiQL README explicitly warns about this). | graphiql.tsx:47 |
| U11 | **Low** | **No Exulu-specific on-ramp.** Stock placeholder query, no example operations, no endpoint URL or credential affordance. P4's adjacent jobs (get credentials, discover how to call an agent — personas.md:121-123) require round-trips to `/token` and `/keys`. The app's own 175-operation catalog (queries.ts) is invisible here. | graphiql.tsx:47; queries/queries.ts |

### Mobile audit

At 390 px the page is **broken**, not merely degraded:

- GraphiQL's entire stylesheet contains exactly **one** media query — `prefers-color-scheme: dark`
  (node_modules/graphiql/dist/style.css:1508). There are zero responsive breakpoints; the
  desktop three-region layout (icon rail ≈50 px + optional plugin pane + side-by-side
  editor/response panes) is rendered at desktop proportions and squeezed.
- The Exulu wrapper adds nothing: `graphiql.tsx` renders `<GraphiQL fetcher>` bare — no `sm:`/`md:`
  variants, no alternative layout (graphiql.tsx:47).
- Monaco editors at sub-400 px: cramped line widths, virtual-keyboard overlap, poor touch text
  selection, autocomplete popovers overflowing the viewport.
- Pane resizing is **drag-only with hover affordances** — unusable on touch (anti-pattern: hover-only
  affordances).
- The tab bar plus toolbar overflow horizontally; with the docs/history pane open, the editor is
  reduced to a sliver.

This violates philosophy anti-pattern 9 ("Desktop-only afterthought"). Per personas.md:133-134,
P4's mobile job is "nearly none — check a status, copy a token in a pinch", so the answer is a
*designed mobile fallback* (see §3), not a responsive GraphiQL.

---

## 2. Jobs to be done

**PRIMARY: P4 — Developer.** *#1 job in one sentence: run an ad-hoc GraphQL operation against this
deployment with my credentials already wired, and see the raw response.*

P4's jobs on this page, ranked by frequency:

1. **Run a query/mutation to debug an integration** (personas.md:126 "Debug integrations: inspect
   raw payloads, errors") — the daily driver; needs auth pre-wired, fast execute, raw response.
2. **Discover the schema** (personas.md:122 "explore the API … schema discovery") — doc explorer,
   autocomplete, introspection refresh.
3. **Get something copy-paste-ready** (personas.md:121, 130-131 "one-click copy on every
   ID/key/snippet") — the endpoint URL, a bearer header, a cURL template, a working operation.
4. **Re-run/iterate on previous work** — tabs, history, persisted state.
5. **Test as a different principal / with extra headers** — headers editor override (rare,
   deliberate).

**Secondary: P2 — Power user**, only when their role grants `api: "write"`: occasionally pulls
data the UI doesn't surface (bulk session exports, ID lookups for agent config). Served entirely
by the same L1 plus the Examples pane — no separate treatment needed.

P1 and P3 must never see this page (personas.md:36 explicitly lists GraphiQL under "should never
see" for P1; RBAC-trimmed, not collapsed).

**Ownership matrix check:** personas.md:172 (`/explorer` → primary P4, secondary "—") is
**confirmed correct** on the primary. One refinement: secondary should read **P2 (via `api:
write` role)** rather than "—", since the existing RBAC predicate intentionally admits non-admin
API-write roles (main-nav.tsx:204) and personas.md itself makes P2 cumulative. Not a change of
owner — L1 is designed for P4 either way.

---

## 3. Design concept

**Essence: GraphiQL stays the work surface — we stop fighting it and start framing it.** A slim
Exulu chrome (one 48 px bar) gives the page identity, credentials, and the endpoint; GraphiQL is
re-skinned with Exulu tokens and theme-synced; the app's own query catalog becomes an Examples
pane inside GraphiQL's native plugin rail. RBAC is fixed at the route, the token leak is removed,
and mobile gets the job it actually has (copy things), not a crushed IDE.

### Default view (L1)

Full-bleed work surface (PageShell `variant="full-bleed"`: `h-full flex flex-col`, no max-width,
no page padding around the work surface).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ API Explorer   POST ⟨backend⟩/graphql ⧉        [Credentials ▾]  (h-12 bar)  │
├───┬──────────────────────────────────────────────────────────────────────────┤
│ ▤ │  Tab: "GetAgents" ×   +                                                  │
│ ▦ │ ┌──────────────────────────────┬─────────────────────────────────────┐   │
│ ◷ │ │  query editor (Monaco,       │  response pane                      │   │
│   │ │  Exulu-token themed)     ▶   │  (formatted JSON)                   │   │
│ ⟳ │ │                              │                                     │   │
│ ⌘ │ ├──────────────────────────────┤                                     │   │
│ ⚙ │ │  Variables · Headers drawer  │                                     │   │
│   │ └──────────────────────────────┴─────────────────────────────────────┘   │
└───┴──────────────────────────────────────────────────────────────────────────┘
```

- **ExplorerBar (compact PageHeader)** — left: title "API Explorer" (`text-sm font-medium`; see
  Layout & components for why the compact density variant is justified); immediately right of it
  the **endpoint pill**: `font-mono text-xs text-muted-foreground` reading
  `POST https://…/graphql` with a CopyButton — one click copies the URL (P4 job 3 at L1). Right
  edge: a single ghost **"Credentials" dropdown trigger** (KeyRound icon + label).
- **GraphiQL fills the remaining height**, themed via Exulu tokens (rewritten `graphiql.css`
  mapping GraphiQL 5's official CSS variables) and `forcedTheme` synced to next-themes — purple
  execute button, Exulu mono font, correct light/dark.
- **The primary action is GraphiQL's Execute button** — the only purple element on the screen
  besides the active nav item (philosophy §4: one accent doing the work).
- **First visit:** the default tab is pre-filled with a working Exulu starter operation (a
  commented header + a simple `agents` query from the examples catalog) instead of GraphiQL's
  generic placeholder — arrive, press Ctrl-Enter, see real data. This is the page's EmptyState
  equivalent: the empty editor *is* the empty state, primed to succeed.
- **Loading:** a skeleton mirroring the real layout (bar + icon rail + two panes), not a floating
  80×40 box. **Error:** centered EmptyState (icon, plain-language sentence, "Retry" button, raw
  error message in a collapsed `font-mono text-xs` detail — trust through transparency).

### Disclosure ladder

Page-internal levels; globally the whole page sits at L4 of the app ladder. Every inventory item
from §1 is mapped — nothing is dropped.

| # | Capability | Level | Where it lives |
|---|-----------|-------|----------------|
| 1 | Route `/explorer` | L0 | URL + sidebar; now also server-side RBAC-guarded |
| 2 | Nav entry (RBAC-gated) | L0 | Sidebar "Develop" group, renamed **"API Explorer"** (en) / **"API-Explorer"** (de); gate fixed: `super_admin \|\| role.api === "write"` actually evaluable |
| 3 | JWT acquisition | L1 (invisible) | Wired automatically; surfaced only via Credentials menu |
| 4 | Loading state | L1 | Full-layout skeleton (bar + rail + panes) |
| 5 | Error state | L1 | Centered EmptyState with Retry; raw message in collapsed mono detail (L2) |
| 6 | Authenticated fetcher / endpoint | L1 | Endpoint pill in ExplorerBar (copyable); fetch itself invisible |
| 7 | Exulu theming of GraphiQL | L1 (ambient) | Rewritten `graphiql.css` on GraphiQL 5 CSS variables |
| 8 | Monaco worker setup | L1 (invisible) | Unchanged import |
| 9 | Query editor (highlight/autocomplete/lint) | L1 | Main editor pane |
| 10 | Execute / stop / operation picker | L1 | Execute button (the page's primary action), Ctrl-Enter |
| 11 | Variables editor | L2 | Editor-tools drawer (GraphiQL native), auto-opens when populated |
| 12 | Headers editor / auth override | L2 | Editor-tools drawer, "Headers" tab |
| 13 | Editor-tools toggle | L2 | Drawer chevron below the query editor |
| 14 | Response pane (incl. @defer/@stream) | L1 | Right pane |
| 15 | Multi-tab sessions | L1 | Tab bar above editors (add/close/switch) |
| 16 | Documentation Explorer | L2 | Plugin rail icon → resizable pane |
| 17 | History (re-open/favorite/label/delete) | L2 | Plugin rail icon → resizable pane |
| 18 | Re-fetch schema | L2 | Plugin rail button |
| 19 | Short Keys dialog | L3 | Plugin rail → dialog |
| 20 | Settings: persist headers / clear storage | L3 | Plugin rail → Settings dialog. Theme row becomes inert/hidden via `forcedTheme` (theme now follows the app — capability superseded, not lost: the app theme toggle is the one control). "Clear storage" is destructive → stays behind the dialog, native confirm pattern |
| 21 | Prettify / Merge / Copy query | L2 | GraphiQL toolbar next to Execute (+ shortcuts) |
| 22 | Resizable panes | L2 | Drag dividers (desktop only) |
| 23 | localStorage persistence | L1 (invisible) | Namespaced `exulu:graphiql:*` storage |
| 24 | GraphiQL logo/footer slots | L2 | `GraphiQL.Logo` replaced by muted `text-xs` "GraphiQL" attribution link at the session-header right — branding relocated, link preserved |
| 25 | Default query template | L1 | Replaced by Exulu starter operation (commented guidance + runnable query) |
| 26 | App query catalog (queries.ts) | L2 | **NEW "Examples" plugin** in GraphiQL's plugin rail: curated, grouped, searchable operations (Agents, Sessions, Knowledge, Models, Users/Roles/Teams, Prompts, Skills, Evals, Budgets, Transcriptions, Platform config); click inserts into a new tab with sample variables |
| 27 | `graphql.config.yml` | n/a (repo) | Unchanged developer tooling; referenced in doc only |
| 28 | `apollo.config.json` | n/a (repo) | Unchanged developer tooling; referenced in doc only |
| — | NEW: Credentials menu | L2 | ExplorerBar right: dropdown with "Copy bearer token", "Copy Authorization header", "Copy cURL template" (endpoint + auth + example body), "Personal token →" (`/token`), "Manage API keys →" (`/keys`, shown only when the keys nav predicate passes) |

Rule check: nothing critical descended below L2; the only L3 items are reference/maintenance
dialogs (19, 20) and the destructive "Clear storage" (mandatory L3 per philosophy §2).

### Layout & components

- **PageShell** (shared primitive, `full-bleed` work-surface variant): `flex h-full min-h-0
  flex-col`. The explorer and chat are the two full-bleed pages; both must use the same variant.
- **PageHeader, `density="compact"` variant** (shared-primitive change — flagged in §4): a 48 px
  (`h-12`) single-row header — `flex items-center gap-4 border-b px-4`. Written justification per
  philosophy heuristic 5: the standard `text-2xl` PageHeader spends ~96 px of vertical space that
  a full-height IDE surface cannot afford; the compact variant keeps the "one header per page, no
  page invents its own" contract while fitting work surfaces. Title `text-sm font-medium`;
  purpose is conveyed by the endpoint pill instead of a description line.
- **Endpoint pill**: `Badge variant="outline"` + `font-mono text-xs`, content
  `POST {config.backend}/graphql`, trailing **CopyButton** (NEW shared primitive, see §4) —
  `ghost` icon button, `Copy`→`Check` swap on success, tooltip "Copy endpoint URL", ARIA label.
  Truncates with `truncate max-w-[40ch]` on narrow desktop widths, full URL in the tooltip.
- **Credentials menu**: shadcn `DropdownMenu`, `ghost` Button trigger (`KeyRound` icon,
  strokeWidth 1.5, text label "Credentials" at `text-sm`). Items as in the ladder table; each copy
  item uses the CopyButton behavior + sonner toast ("Copied — expires with your session" for the
  bearer token). The token is **never rendered on screen** here — copy-only (the `/token` page
  remains the place to view it).
- **GraphiQL theming**: delete every CodeMirror rule from `app/graphiql.css`; re-map GraphiQL 5's
  *official* CSS variables (the only supported customization — class names are unstable per the
  GraphiQL README) in `:root` / `.dark`: `--color-primary` → Exulu `--primary` (execute button,
  keywords), `--color-base`/`--color-neutral` → `--background`/`--foreground` ramps,
  `--font-family` → Inter var, `--font-family-mono` → JetBrains Mono var, border radii to match
  `--radius`. Pass `forcedTheme={resolvedTheme}` from `useTheme()` so GraphiQL follows next-themes.
- **Examples plugin**: GraphiQL plugin API (`plugins` prop) — `title: "Exulu examples"`,
  `icon: BookOpen` (lucide, strokeWidth 1.5), `content`: a pane with a `text-sm` search Input on
  top (`p-2`), then groups (`text-xs uppercase text-muted-foreground` group labels, `gap-1`
  items) of operation names in `font-mono text-xs`; clicking inserts the operation + sample
  variables into a new tab. The catalog is a hand-curated `explorer-examples.ts` (~20 entries)
  derived from `queries/queries.ts` so it stays meaningful, not auto-dumped.
- **EmptyState** (shared primitive) for the error state and for access-denied (route guard):
  icon, one sentence, one action.
- **Skeleton**: compose from shadcn `Skeleton` mirroring bar (h-12 full-width), rail (w-12
  full-height), editor and response panes (two flex-1 blocks, `gap-px`).
- Spacing per CLAUDE.md: bar `px-4`, internal `gap-4`/`gap-2`; type per scale (`text-sm` labels,
  `text-xs` mono metadata). No Card anywhere on this page — it is a work surface, not content
  blocks.

### Mobile behavior

P4's mobile job (personas.md:133-134): *"copy a token in a pinch"* — design for that, keep the
full surface reachable.

- **≥ lg (1024 px+):** layout as described; plugin pane and editor-tools resizable.
- **md (768–1023 px):** identical structure; the Credentials trigger collapses to icon-only
  (with tooltip + ARIA label); endpoint pill truncates earlier (`max-w-[24ch]`).
- **< md (below 768 px, incl. 390 px):** the page defaults to the **Mobile toolkit** instead of
  the crushed IDE:
  - Compact header (title + endpoint pill, wrapping to two lines).
  - A single-column stack (`p-4 gap-2`) of full-width action rows: **Copy endpoint**, **Copy
    bearer token**, **Copy cURL template**, **Example queries** (opens a bottom `Sheet` with the
    examples list; tapping an example copies the operation), **Personal token →** (`/token`).
  - At the bottom, a `ghost` text button: **"Open full explorer anyway"** → renders GraphiQL
    full-screen with `min-w-0 overflow-x-auto` containment. Honest degradation, capability
    preserved at L3 — never removed (philosophy §7: read-only/awkward is acceptable, broken
    default is not).
  - All touch targets ≥ 44 px; no hover-only affordances in the toolkit.

### Motion

Per CLAUDE.md timings, all honoring `prefers-reduced-motion`:

- **Copy feedback** — `Copy`→`Check` icon swap, 150 ms `ease-in-out`, revert after 2 s (same
  pattern as `/token`; codified in CopyButton).
- **Skeleton → content** — single 200 ms opacity crossfade when GraphiQL mounts; no layout shift
  (skeleton mirrors final geometry).
- **Credentials dropdown / mobile Sheet** — stock shadcn/Radix enter-exit (≈150–300 ms); the
  Sheet slides from the bottom edge at 300 ms (explains origin).
- Everything inside GraphiQL keeps its native (minimal) motion; no added animation on the work
  surface — an IDE should feel inert and instant (philosophy §6: motion must explain something).

---

## 4. Implementation notes

**Files to change**

- `lib/server-side-auth-check.ts:43-52` — add `'api', roles.api` (cross-cutting fix; also
  unbreaks the API Keys nav gate at main-nav.tsx:220). Audit the json_build_object against
  `types/models/user-role.ts:1-13` for other missing keys while there.
- `app/(application)/explorer/page.tsx` — keep thin; add server-side RBAC guard using the (fixed)
  `serverSideAuthCheck` result: if `!user.super_admin && user.role?.api !== "write"`, render the
  access-denied EmptyState (or `redirect('/')`). Roles with API access: **super_admin** or
  **role.api = "write"**; consider whether `role.api = "read"` should grant read-only explorer
  access (today it grants nothing — product decision, backend enforces regardless).
- `app/(application)/explorer/graphiql.tsx` — rewrite: **delete the `console.log` token leak
  (line 39)**; memoize the fetcher; replace static auth header with a custom `fetch` wrapper
  passed to `createGraphiQLFetcher` that calls `getToken()` per request (fixes stale-token 401s);
  `forcedTheme` from `useTheme().resolvedTheme`; namespaced `storage` (`exulu:graphiql:` prefix,
  per GraphiQL README pattern); `plugins={[examplesPlugin]}`; Exulu `defaultQuery`; compact
  PageHeader + endpoint pill + Credentials menu; full-layout skeleton; EmptyState error with
  retry; `<md` Mobile toolkit branch.
- `app/graphiql.css` — rewrite for GraphiQL 5: remove all `.CodeMirror`/`.cm-s-graphiql` rules
  (lines 9-119 are dead); map official GraphiQL CSS variables to Exulu tokens in `:root`/`.dark`.
- `messages/en.json` / `messages/de.json` — rename `navigation.apiPlayground` →
  "API Explorer" / "API-Explorer" (resolves naming split U7); add `explorer.*` strings
  (credentials menu, toolkit labels, error copy) — both locales, i18n is en/de.
- **New:** `components/custom/explorer/examples-plugin.tsx` + `explorer-examples.ts` (curated
  catalog derived from `queries/queries.ts`).
- **New:** `components/custom/explorer/credentials-menu.tsx`.
- **New:** `components/custom/explorer/mobile-toolkit.tsx`.

**Shared components needed**

- `PageShell` (full-bleed variant) — philosophy §5, shared with Chat.
- `PageHeader` — **needs a NEW `density="compact"` variant** for full-bleed work surfaces; this
  is a change to the shared primitive and should be recorded in philosophy §5.
- `EmptyState` — philosophy §5, used for error + access denied.
- **NEW shared primitive: `CopyButton`** (icon button + clipboard + check feedback + toast +
  ARIA) — not in philosophy §5 yet; immediately reusable on `/token` (which hand-rolls the same
  pattern, app/(application)/token/page.tsx), `/keys`, and agents' programmatic info. Propose
  adding it to philosophy §5.
- `ConfirmDialog` — optional: wire GraphiQL's `confirmCloseTab` to it for tabs with unsaved
  edits; GraphiQL's own "Clear storage" confirm stays native.

**Scope: M.** One page, no data model changes, but it touches a shared auth helper, introduces
two small shared primitives, a GraphiQL plugin, and a CSS re-skin.

**Dependencies**

- Nav/shell: the "Develop" sidebar group and the nav rename (design/navigation.md); the shell
  must give full-bleed pages a bounded height (`h-screen`-derived flex chain through
  main-nav.tsx:599-603) or GraphiQL cannot size itself.
- The `role.api` fix lands before (or with) the route guard, or super_admins remain the only
  audience.
- `/token` and `/keys` pages: CopyButton adoption and link targets from the Credentials menu.

**Risks**

- GraphiQL class names are explicitly unstable between versions — theme **only** via its official
  CSS variables and slots; pin the `graphiql` minor version.
- Monaco web workers under Next 16 (webpack vs. turbopack) — the existing
  `setup-workers/webpack` import works today; re-verify on bundler changes.
- `forcedTheme` vs. users' previously persisted GraphiQL theme setting — namespacing the storage
  resets persisted tabs/history once; communicate in the release note.
- Examples catalog can drift from the live schema — keep it small and curated; optionally
  validate entries against introspection in CI.
- Headers editor lets users override `Authorization` (item 12) — intended capability; the backend
  must remain the authority on permissions (it is — the UI gate is convenience, not security).
