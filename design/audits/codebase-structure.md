# Codebase Structure — Audit

> System-wide audit of how the Exulu frontend is organized today: file layout, component
> placement, data-fetching patterns, REST vs GraphQL split, naming conventions, dead files,
> `lib/` vs `util/` duplication, and i18n wiring/coverage. This is the evidence base for the
> redesign synthesis — it complies with `design/philosophy.md` (disclosure ladder, shared
> layout primitives) and `design/personas.md` (page ownership), and feeds the restructuring
> plan referenced by philosophy §5 ("Same bones everywhere").
>
> All paths relative to repo root. Counts measured 2026-06-11 on `main` (c201e57).

---

## Current state

### 1. Top-level layout

39 route pages (`find app -name "page.tsx"` → 39), 348 TS/TSX source files outside
`node_modules` (347 git-tracked + the generated `next-env.d.ts`). The repo root mixes app
source, build artifacts, distribution packaging, one-off scripts, and stale docs:

| Path | What it is | State |
|---|---|---|
| `app/` | Next 16 App Router; two route groups `(application)` and `(authentication)`, each with its own root layout | Active |
| `components/` | 31 flat files (30 `.tsx` + `main-loader.css`) + 7 subdirectories (see §3) | Active, no placement rules |
| `lib/` | 9 utility files + `lib/prompts/` module | Active |
| `util/` | `api.ts` (REST client), `fetch-graphql-server-side.ts`, `enums/` (4 files) | Active — overlaps `lib/` |
| `hooks/` | 5 hooks | Active |
| `queries/queries.ts` | **All** GraphQL operations: 3,223 lines, 175 exports, imported by 91 files | Active monolith |
| `types/` | `models/` (26 hand-written interface files) + `enums/` (2 files) | Active, hand-maintained |
| `i18n/config.ts`, `messages/{en,de}.json`, `I18N_GUIDE.md` | next-intl cookie-based i18n | Active, very low coverage (§7) |
| `proxy.ts` | Next 16 middleware (CSP + locale header) | Active |
| `index.ts` | **Empty file (0 bytes), git-tracked** | Dead |
| `remove-bg.js` | One-off image script with **hardcoded third-party API keys** (`remove-bg.js:5-6`), git-tracked | Stray + security issue |
| `ngrok.bash`, `ngrok.md`, `ngrok.yml` | Local tunneling notes, git-tracked | Stray |
| `PROMPT_LIBRARY_SPEC.md` | 35 KB feature spec at root (belongs in `design/`) | Stray |
| `package/` | npm distribution wrapper `@exulu/frontend` (bin that boots the standalone build); own `release.config.cjs` with `npm-v*` tag line | Active but pins `next: 14.2.35` (`package/package.json:12`) while the app is Next 16.0.10 |
| `codegen.ts`, `apollo.config.json`, `graphql.config.yml` | Three GraphQL tooling configs | **Broken/contradictory** (§4.4) |
| `custom.d.ts` | Declares JSX element `ldrs-icon` | Dead — zero usages of `ldrs-icon` in `app/` or `components/` |
| `scripts/` | `select-env.js` (interactive env picker, wired into `npm run dev`), `add-shebang-to-server.js` (build-package step) | Active |
| `skills-lock.json`, `.mcp.json` | Tracked tooling manifests (skills lockfile, MCP server config) | Active |
| `.env` | **Symlink into a sibling repo** (`→ ../ai.open/.env`) — untracked and ignored (`.gitignore:37` `.env*`), but env config for this app lives outside this repo on dev machines | Local-only quirk |
| `tsconfig.tsbuildinfo` (732 KB), `.DS_Store` (root, `components/`, `app/api/`, `types/`) | Build/Finder litter on disk — untracked **and already gitignored** (`.gitignore:25`, `:46`) | Noise (local cleanup only) |
| `deploy.sh`, `Dockerfile`, `release.config.cjs`, `RELEASE.md`, `commitlint.config.js`, `.husky/` | CI/release plumbing (dual release lines: `v*` Docker + `npm-v*` package) | Active |

Path alias: only `@/*` → `./*` (`tsconfig.json` "paths"), so every import is `@/components/...`,
`@/lib/...`, `@/util/...`, `@/queries/queries`.

### 2. Routing (`app/`)

- `(application)/layout.tsx` is the authenticated root layout: auth check, backend config
  fetch, theme fetch, locale message load, then a provider stack
  (`ThemeProvider` → `TanstackQueryClientProvider` → `ConfigContextProvider` →
  `LanguageProvider` → `Authenticated` (Apollo + Session + UserContext + MainNavProvider)).
- `(application)/page.tsx` just redirects to `/chat` (`app/(application)/page.tsx:9`) —
  there is no dashboard/home page today despite `design/pages/dashboard.md`.
- **17** route-local `components/` directories across **12 features** already use the App
  Router colocation pattern (`find app -type d -name components` → 17: `agents` ×2 — list +
  `edit/[id]`, `analytics`, `chat/[agent]/[session]`, `data`, `evals` ×4, `feedback`,
  `models`, `prompts`, `skills` ×2, `users`, `variables`, `workflows`) —
  **80 route-local component files** in total.
- Other routes keep everything in the page file: `budgets/page.tsx` (580 lines),
  `keys/page.tsx` (507), `roles/page.tsx` (398), `teams/page.tsx` (317),
  `transcriptions/page.tsx` (1,036), `skills/page.tsx` (861), `configuration/page.tsx` (314).
- Two single-file routes are easy to miss in inventories: `app/(application)/token/page.tsx`
  (personal API token page, P4) and `app/(application)/n8n/page.tsx` (full-page iframe to
  `process.env.N8N_URL`; the separate hardcoded `/n8n` rewrite in `next.config.js` is §9/L5).
- One stray pattern: `app/(application)/users/data/schema.ts` (zod `userSchema` + a second
  `User` type) — a leftover of the shadcn table tutorial layout, used only by the users table,
  and **duplicating** `types/models/user.ts`'s `User`.
- Dynamic segment names are inconsistent: `[id]` (agents, evals, models, prompts),
  `[skillId]` (camelCase), `[variable_id]` (snake_case), `[agent]`, `[session]`, `[project]`.
- Local API routes are minimal: `app/api/config/route.ts` (exposes backend URL to the client)
  and `app/api/auth/[...nextauth]/` (NextAuth, with a 390-line `options.ts`).

Largest page-layer files (the redesign's hardest decomposition targets):

| File | Lines |
|---|---|
| `app/(application)/chat/[agent]/[session]/chat.tsx` | 1,813 |
| `app/(application)/agents/edit/[id]/form.tsx` | 1,662 |
| `app/(application)/data/components/data-display.tsx` | 1,560 |
| `app/(application)/workflows/components/columns.tsx` | 1,164 |
| `app/(application)/transcriptions/page.tsx` | 1,036 |
| `components/message-renderer.tsx` | 1,780 (73 KB) |

### 3. Component organization (`components/`)

Five coexisting placement conventions, none documented:

1. **`components/ui/`** (57 files) — shadcn/ui primitives. But it also contains non-shadcn,
   data-aware app components: `role-selector.tsx` and `team-selector.tsx` (both run Apollo
   `useQuery` — `components/ui/role-selector.tsx:4`), `navigation.tsx`, `loading.tsx`,
   `loading-text.tsx`, `markdown-editor.tsx`, `mode-toggle.tsx`, `rating.tsx`,
   `sortable.tsx`, plus a `shadcn-io/` subfolder (`gradient-text`, `shimmering-text`) with a
   different folder-per-component/`index.tsx` convention.
2. **`components/` flat** (31 files: 30 `.tsx` + `main-loader.css`) — a grab bag where most
   files are page-specific: single-importer files include `budget-editor.tsx`,
   `role-form.tsx`, `team-form.tsx`, `project-nav.tsx`, `items-selection-modal.tsx` (43 KB),
   `item-form-fields.tsx`, `tag-selector.tsx`, `reranker-selector.tsx`,
   `save-preset-modal.tsx`, `tool-call-approval.tsx`, `agent-selection-dialog.tsx`. Truly
   shared things live beside them: `message-renderer.tsx` (5 importers), `rbac.tsx` (26 KB
   RBAC sharing dialog), `uppy-dashboard.tsx`, providers (`theme-provider`,
   `language-provider`, `config-context`). It also hides **dead files**: `icons.tsx` and
   `runs-table.tsx`, both with zero importers (§Issues M5).
3. **`components/custom/`** (9 files) — name implies "non-shadcn custom components" but is
   really another junk drawer: the entire app shell `main-nav.tsx` (20 KB,
   `MainNavProvider`/`MainNavSidebar`), `code-preview.tsx` (4 importers), `text-preview.tsx`
   (5 importers), `recent-embeddings.tsx`/`recent-processings.tsx` (1 importer each, used by
   the knowledge dashboard), and **four dead files** (§Issues).
4. **Feature folders in `components/`** — `ai-elements/` (34 files, vendored Vercel
   AI Elements kit; only 7 files import from it), `dashboard/` (5 chart widgets, used by
   `analytics/components/dashboard.tsx` and `data/components/contexts-dashboard.tsx`),
   `feedback/` (4 files: the end-user feedback widget), `image-generation/` (2),
   `session-files/` (5, incl. its own `utils.ts`).
5. **Route-local `components/`** in `app/` (80 files) — the colocation pattern, including
   six near-identical copies of the shadcn data-table scaffold (§Issues #5).

There is no `components/primitives/` or equivalent of the philosophy §5 shared bones —
`PageShell`, `PageHeader`, `Toolbar`, `ListDetail`, `EmptyState`, `StatCard`,
`ConfirmDialog` do not exist today. Each page hand-rolls its header, toolbar, empty state,
and confirm dialogs (12 files implement their own `AlertDialog` confirms).

### 4. Data fetching

#### 4.1 GraphQL via Apollo (dominant)
- **87 files** import `@apollo/client` (`useQuery`/`useMutation`/`useApolloClient`).
- The client is configured in `app/(application)/authenticated.tsx:68` — **instantiated in
  the component body without memoization** (a new `ApolloClient` + `InMemoryCache` per
  render), with `fetchPolicy: "no-cache"` for both `watchQuery` and `query`
  (`authenticated.tsx:76,80`), `errorPolicy: "ignore"` for watch queries, and
  `addTypename: false`. Apollo is effectively used as a transport, with its cache disabled
  globally — every navigation refetches everything, working against philosophy §6
  ("Speed is the aesthetic").
- Server components use a separate raw-fetch helper `util/fetch-graphql-server-side.ts`
  (6 importers: chat pages, agent edit, prompt detail, knowledge page).

#### 4.2 GraphQL operation definitions
- 100% centralized in `queries/queries.ts`: 3,223 lines, 175 exported operations, zero
  `gql\`` definitions anywhere else. Imported by **91 files**. It mixes every domain (agents,
  sessions, users, roles, teams, models, variables, evals, workflows, prompts, feedback,
  knowledge items) plus dynamic query *factories* for the schemaless knowledge contexts
  (`GET_ITEMS(context, fields)` at `queries/queries.ts:282`, `UPDATE_ITEM` at `:422`, etc.)
  and shared field-fragment strings (`CONTEXT_FIELDS` `:7`, `AGENT_FIELDS` `:114`).

#### 4.3 REST via `util/api.ts` (20 KB)
The REST surface lives in one file as namespace objects: `config` (backend config/theme),
`agents.image.generate`, `files` (S3 list/object/download/delete), `skillsApi` (12 skill
file-management endpoints), `sessionFilesApi` (7 session-file endpoints), `budgetsApi`
(5 budget endpoints). Three **copy-pasted, near-identical request helpers** exist in the
same file: `skillsRequest` (`util/api.ts:262`), `sessionsRequest` (`:401` — its docstring
even says "Mirrors skillsRequest so error handling … [is] consistent across the two REST
surfaces"), and `budgetsRequest` (`:529`). Debug `console.log`s ship in this client
(`util/api.ts:87`, `:198`).

REST vs GraphQL split by domain (for the synthesis agent's mental model):

| Surface | Transport |
|---|---|
| CRUD for agents, sessions, users, roles, teams, models, variables, evals, prompts, workflows, knowledge items | GraphQL (Apollo, `queries/queries.ts`) |
| Chat streaming | `ai`-SDK `DefaultChatTransport` straight to backend (`chat.tsx:381`), plus raw `fetch` for `/agents/suggestions/:id` (`chat.tsx:475`) and `/transcribe` (`chat.tsx:668`) |
| File/S3, skills files, session files, budgets, backend config/theme | REST (`util/api.ts`) |
| Uploads | Uppy → presigned S3 (`hooks/use-uppy.tsx`, `components/uppy-dashboard.tsx`) |
| Auth | NextAuth (`app/api/auth/[...nextauth]/`) |

#### 4.4 TanStack Query (vestigial second stack)
`@tanstack/react-query` is installed and a `QueryClientProvider` wraps the whole app
(`app/(application)/query-client.tsx`, mounted in `layout.tsx`), but only **4 files** use it
(`explorer/graphiql.tsx`, `components/lottie.tsx`, `components/uppy-dashboard.tsx`, the
provider itself). Two caching/data libraries are shipped for what one does.

#### 4.5 GraphQL tooling configs (broken)
- `codegen.ts:9` outputs to `./src/__generated__/` — **no `src/` directory exists**; codegen
  has never produced consumed artifacts. All response types are hand-written in
  `types/models/` and drift from the schema by hand-maintenance.
- Three configs give three different introspection URLs: `codegen.ts:4`
  (`localhost:3000/api/graphql/introspection`), `apollo.config.json`
  (`localhost:9001/graphql/introspection`), `graphql.config.yml`
  (`localhost:9001/api/graphql/introspection`). At most one can be right.

### 5. `lib/` vs `util/` (and the three enum homes)

No discernible rule separates them. Measured imports: `@/lib/...` **150**, `@/util/...` **30**.

| Concern | Lives in |
|---|---|
| Class-name helper `cn`, duration format | `lib/utils.ts` |
| REST client | `util/api.ts` |
| Server-side GraphQL fetch | `util/fetch-graphql-server-side.ts` |
| Server-side auth check | `lib/server-side-auth-check.ts` |
| Budget math/types | `lib/budget.ts` (typed against `util/api.ts`'s `budgetsApi`, which imports types *from* `lib/budget.ts` — a lib↔util circular pairing) |
| Enum→label transforms | `lib/enum-utils.ts` |
| Enum value constants | `util/enums/{job-functions,job-status,job-types,source-types}.ts` |
| Enum type unions | `types/enums/{field-types,statistics}.ts` |
| Prompt-library helpers | `lib/prompts/` (6 files with an `index.ts` barrel — the one well-formed feature module in the repo) |

Three different directories own "enums", split by no principle: constants in `util/enums/`,
type unions in `types/enums/`, label-formatting in `lib/`.

### 6. `hooks/`

Five files, two naming conventions: `use-mobile.tsx`, `use-prompts.tsx`, `use-skills.tsx`,
`use-uppy.tsx` follow `use-*`, but `contexts.tsx` exports `useContexts` (knowledge-contexts
query hook) under a name that reads as React-context plumbing. Domain hooks (`use-prompts`,
`use-skills`, `useContexts`) are thin Apollo wrappers — the embryo of a per-feature data
layer that never spread; most of the 87 Apollo files call `useQuery(GET_X)` inline instead.

### 7. i18n wiring and coverage

**Wiring** (cookie-based, no `[locale]` route segment):
- `proxy.ts:110-116` reads the `NEXT_LOCALE` cookie and forwards `x-locale`; it **re-declares**
  `LOCALE_COOKIE`/`defaultLocale`/`locales` as literals (`proxy.ts:4-6`) instead of importing
  `i18n/config.ts:1-5`.
- `app/(application)/layout.tsx:28,40` reads the cookie and imports `messages/{locale}.json`,
  passing them to `components/language-provider.tsx`, which wraps `NextIntlClientProvider`
  and exposes `useLanguage()`; switching locale sets the cookie and does a full
  `window.location.reload()` (`language-provider.tsx:57`).
- `next.config.js` wraps with `next-intl/plugin` pointed at `./i18n/config.ts`.

**Coverage** (the headline problem):
- `messages/en.json` and `de.json` each contain **154 keys** across 7 namespaces
  (`navigation`, `language`, `agentSelection`, `common`, `agents`, `dashboard`, `feedback`).
- Only **13 of ~280** TSX files call `useTranslations` (agents pages, analytics dashboard,
  feedback widget, main nav, agent-selection dialog). Everything else — chat, knowledge,
  evals, models, users, roles, teams, budgets, keys, variables, workflows, prompts, skills,
  settings, transcriptions — is hardcoded English (e.g. `placeholder="Filter users..."` at
  `app/(application)/users/components/data-table.tsx:191`).
- `<html lang="en">` is hardcoded in both root layouts (`app/(application)/layout.tsx:79`,
  `app/(authentication)/layout.tsx:22`) even when the German locale is active.
- `I18N_GUIDE.md` is stale: step 3 (`:148-150`) says to edit `/middleware.ts`, which no
  longer exists (renamed `proxy.ts` for Next 16), and the server-component example
  (`:60-72`) shows `const t = await useTranslations()` — not a valid next-intl API
  (`getTranslations` is the server API).

### 8. Naming conventions

- **File names:** consistently kebab-case — a `find` for camelCase/PascalCase `.ts(x)` file
  names returns zero hits. This is the one fully-consistent convention in the repo.
- **Route params:** inconsistent (`[id]` / `[skillId]` / `[variable_id]`, §2).
- **Hooks:** `use-*.tsx` except `hooks/contexts.tsx` (§6).
- **GraphQL constants:** SCREAMING_SNAKE (`GET_AGENTS`), consistent.
- **API namespaces:** mixed style in `util/api.ts` — bare nouns (`config`, `files`,
  `agents`) next to `*Api` suffixes (`skillsApi`, `sessionFilesApi`, `budgetsApi`).
- **Icons:** effectively **one live convention** — direct `lucide-react` imports
  (162 files). The two would-be icon modules are dead or nearly so: `components/icons.tsx`
  (the shadcn `Icons` map) has **zero importers** — grepping `app/`, `components/`,
  `hooks/`, `lib/`, `util/` for `@/components/icons`, `import { Icons }`, relative
  `./icons`, and the exported `Icon` type finds no matches (dead file, M5) — and
  `icons/index.tsx` (hand-written SVG components) has exactly **one** importer
  (`app/(application)/agents/edit/[id]/form.tsx:44` imports `CopyIcon`).

### 9. Code hygiene signals

- **110** `console.log` calls across `app/` + `components/` (e.g. the root layout logs the
  whole backend config response on every request, `app/(application)/layout.tsx:36`).
- Duplicate import of the same symbol in the root layout:
  `import { config as api … }` / `import { config as apiConfig }` both from `@/util/api`
  (`layout.tsx:15-16`).
- Two toast systems run in parallel: shadcn `use-toast`/`Toaster` (53 files) **and** `sonner`
  (21 files); both toasters are mounted in `layout.tsx`.
- `next.config.js` rewrites `/n8n` to hardcoded `http://localhost:5678` — dev value in
  production config.

---

## Issues

Severity = impact on the redesign (ability to implement philosophy.md cleanly) × user-visible cost.

### High

| # | Issue | Evidence |
|---|---|---|
| H1 | **Leaked credentials committed to the repo.** `remove-bg.js` (git-tracked) hardcodes a PhotoRoom API key (`sk_pr_default_a33a…`, `remove-bg.js:5`) and a TinyPNG key (`:6`). Independent of the redesign, these must be rotated and the file removed. | `remove-bg.js:5-6`; `git ls-files` shows it tracked |
| H2 | **No shared list/table primitive — six diverging copies of the shadcn data-table scaffold.** `data-table.tsx` + `data-table-column-header/row-actions/view-options` + `columns.tsx` duplicated under `evals/`, `evals/cases/`, `models/`, `users/`, `variables/`, `feedback/`, `workflows/` (plus `data/components/columns.tsx`) — ~30 files, each drifting (workflows' `columns.tsx` is 1,164 lines). This is the direct blocker for philosophy §5's `ListDetail`/`Toolbar`/`EmptyState` and anti-pattern #4 ("five ways to do the same thing"). | `find app -name "data-table*"` → 23 files across 7 features |
| H3 | **i18n coverage ≈5%.** 13/280 TSX files translated; 154 keys total; whole personas' surfaces (P3 admin, P4 developer, most of P1 chat) are English-only; `<html lang="en">` hardcoded in both layouts. Any redesigned screen built today inherits hardcoded copy. | §7; `app/(application)/users/components/data-table.tsx:191`; `layout.tsx:79` |
| H4 | **Apollo client misconfiguration defeats perceived performance.** Client recreated on every render of `Authenticated` (no `useMemo`), global `fetchPolicy: "no-cache"`, `errorPolicy: "ignore"` silently swallows errors (conflicts with philosophy §8 transparency). Every page visit refetches all data — the "calm command center" will feel slow regardless of visual design. | `app/(application)/authenticated.tsx:68-84` |
| H5 | **Monolithic `queries/queries.ts`.** 3,223 lines / 175 operations / 91 importers; every feature change touches one shared hotspot; no per-feature data layer (the few hooks in `hooks/` prove the better pattern but cover 3 domains). | `queries/queries.ts`; §4.2, §6 |
| H6 | **Page-layer god files block disclosure-ladder layering.** `chat.tsx` 1,813 lines, `agents/edit/[id]/form.tsx` 1,662, `data/components/data-display.tsx` 1,560, `message-renderer.tsx` 1,780. L1/L2/L3 separation (philosophy §2) cannot be expressed inside single-file components that render all levels at once. | §2 table |

### Medium

| # | Issue | Evidence |
|---|---|---|
| M1 | **`lib/` vs `util/` split is arbitrary**, with a circular type relationship (`lib/budget.ts` ↔ `util/api.ts`) and three homes for "enums" (`util/enums/`, `types/enums/`, `lib/enum-utils.ts`). | §5 |
| M2 | **No component placement rule.** Single-use page components in flat `components/` (11 files with exactly 1 importer); app shell in `components/custom/`; Apollo-coupled selectors inside `components/ui/` (`ui/role-selector.tsx:4`, `ui/team-selector.tsx:4`); two conventions inside `ui/` itself (`shadcn-io/*/index.tsx` folders vs flat files). | §3 |
| M3 | **Dual data-fetching stacks.** TanStack Query provider wraps the app for 3 consumer files while Apollo serves 87. Bundle + mental overhead, two caching models. | §4.4 |
| M4 | **GraphQL codegen is dead-configured; types are hand-written.** `codegen.ts` outputs to nonexistent `./src/__generated__/`; three configs disagree on the schema URL; `types/models/*` drift by hand and are *already* duplicated (`types/models/user.ts:1` `User` vs `app/(application)/users/data/schema.ts:3` zod `User`). | §4.5; §2 |
| M5 | **Dead files (tracked).** Root `index.ts` (0 bytes); `components/icons.tsx` (the shadcn `Icons` map — zero importers, see §8); `components/runs-table.tsx` (zero importers — the only `runs-table`/`RunsTable` matches are the unrelated `evals/[id]/runs/components/eval-runs-table.tsx`'s `EvalRunsTable`); `components/callout.tsx`, `components/main-loader.tsx` + `main-loader.css`, `components/custom/{dashboard-main-chart,query-examples,code-display-block,date-range-picker}.tsx` — all with **zero importers** (verified by filename *and* exported-symbol grep across `app/`, `components/`, `hooks/`, `lib/`, `util/` — filename grep alone misses `runs-table.tsx` because the name substring-matches the live `eval-runs-table.tsx`); `custom.d.ts` declares an element never used; `ngrok.*` and `PROMPT_LIBRARY_SPEC.md` tracked at root. | grep results in §3 / §8 / §1 |
| M6 | **Two parallel toast systems** (shadcn `use-toast` ×53 files, `sonner` ×21), both mounted. Violates anti-pattern #4; inconsistent toast visuals across pages. | §9 |
| M7 | **i18n constants duplicated + guide stale/incorrect.** `proxy.ts:4-6` re-declares what `i18n/config.ts` exports; `I18N_GUIDE.md:148` points to a nonexistent `middleware.ts`; `:60-72` documents an invalid server API. New-language onboarding per the guide would silently miss `proxy.ts`. | §7 |
| M8 | **Inconsistent route-param naming** (`[id]`, `[skillId]`, `[variable_id]`, `[agent]`, `[project]`) leaks into hook params and link-building helpers. | §2 |
| M9 | **Debug noise in production paths.** 110 `console.log`s including the root layout (`layout.tsx:36`) and the REST client (`util/api.ts:87,198`). | §9 |

### Low

| # | Issue | Evidence |
|---|---|---|
| L1 | Duplicate import of `config` from `@/util/api` under two aliases in the root layout. | `app/(application)/layout.tsx:15-16` |
| L2 | `package/package.json` pins `next: 14.2.35` while the app builds with Next 16.0.10 — the published bin wraps a standalone build, but the stale pin is misleading and a second dependency surface. | `package/package.json:12` vs `package.json:100` |
| L3 | Hook file `hooks/contexts.tsx` breaks the `use-*` convention and its name collides with React-context terminology. | §6 |
| L4 | Icon sourcing is already settled by usage: direct `lucide-react` imports (162 files) are the de-facto standard; `components/icons.tsx` is dead (zero importers — M5) and `icons/index.tsx` has a single importer (`agents/edit/[id]/form.tsx:44`, `CopyIcon`). Swap that one import for lucide's `Copy` and delete the `icons/` dir alongside the M5 cleanup. | §8 |
| L5 | `/n8n` rewrite hardcoded to `localhost:5678` in `next.config.js`. | §9 |
| L6 | Disk litter: `.DS_Store` in 4+ dirs, `tsconfig.tsbuildinfo` (732 KB) at root. Both are untracked **and already gitignored** (`.gitignore:25` `.DS_Store`, `.gitignore:46` `*.tsbuildinfo`) — purely local cleanup (`rm`), no repo change needed. | §1 |
| L7 | Mixed API-namespace naming in `util/api.ts` (`files` vs `skillsApi`). | §8 |

---

## Recommendations

Prioritized for the synthesis agent. Where a decision is implied, the recommended option is
stated with rationale. The guiding constraint: the redesign's shared primitives
(philosophy §5) need a home and a placement rule *before* page redesigns start, or every
page doc will re-litigate structure.

### P0 — do before/alongside the first redesigned page

1. **Rotate and remove the leaked keys (H1).** Delete `remove-bg.js` (or move to a private
   ops repo), rotate the PhotoRoom and TinyPNG keys, and add a secret-scanning hook. Not a
   design task, but it is in scope for "clean the root."

2. **Adopt a feature-first structure, using route colocation as the backbone (H2, M2, H5).**
   *Decision: colocate per-feature code under the route (`app/(application)/<feature>/`)
   rather than a parallel `features/` tree.* Rationale: 17 route-local `components/` dirs
   across 12 features already follow the
   `app/<feature>/components/` pattern (80 files) — it is the de-facto convention; Next App
   Router supports colocation natively; a `features/` tree would be a second migration. Per
   feature: `components/`, `hooks.ts` (or `hooks/`), `queries.ts`, `types.ts`. Cross-feature
   code graduates *up* only when it gains a second importer.
   - Move the 11 single-importer flat components from `components/` into their owning
     feature (e.g. `role-form.tsx` → `app/(application)/roles/components/`,
     `items-selection-modal.tsx` → `data/components/`).
   - `components/feedback/`, `image-generation/`, `session-files/` are already shaped like
     feature modules — leave them shared only if genuinely cross-route (feedback widget is;
     session-files is chat-only and should move under chat).

3. **Build the shared primitives and kill the data-table copies (H2).** Create
   `components/primitives/` (distinct from `ui/` = vendored shadcn): `PageShell`,
   `PageHeader`, `Toolbar`, `ListDetail`/`DataTable` (one generic TanStack-table wrapper:
   columns + row actions in; search/filter/pagination/empty state built in), `EmptyState`,
   `StatCard`, `ChartCard`, `ConfirmDialog`. Migrate the seven table features onto it; each
   feature keeps only its `columns.tsx`. This single move deletes ~20 duplicated files and
   makes philosophy §5 enforceable in review ("uses the shared bones, or a written reason").

4. **Restore `components/ui/` to "vendored shadcn only" (M2).** Move `role-selector`,
   `team-selector`, `navigation`, `markdown-editor`, `mode-toggle`, `rating`, `sortable`,
   `loading*` out (to `primitives/` or their feature). Flatten `ui/shadcn-io/*` to flat
   files. Rule: nothing in `ui/` may import Apollo, `queries/`, or app types.

### P1 — structural consolidation (decisions)

5. **Merge `util/` into `lib/`.** *Decision: `lib/` wins.* Rationale: 150 vs 30 importers,
   and `lib/utils.ts` (`cn`) is the shadcn-mandated path (`components.json`). Target shape:
   `lib/api/` (split `util/api.ts` into `client.ts` — one shared `request()` replacing the
   three copy-pasted helpers at `util/api.ts:262,401,529` — plus `files.ts`, `skills.ts`,
   `session-files.ts`, `budgets.ts`, `config.ts`), `lib/graphql/server.ts`
   (`fetch-graphql-server-side.ts`), and one `lib/enums/` home absorbing `util/enums/` +
   `types/enums/` + `lib/enum-utils.ts` (M1).

6. **Split `queries/queries.ts` by domain (H5).** `queries/agents.ts`, `sessions.ts`,
   `users.ts`, `models.ts`, `evals.ts`, `variables.ts`, `knowledge.ts` (the dynamic
   factories), `workflows.ts`, `prompts.ts`, with `queries/fragments.ts` for the shared
   field strings — or colocate each file into its feature per rec 2 (preferred end-state;
   the domain split is an acceptable low-risk first step since 91 import sites only need
   path updates). Pair each with a feature hook (`use-agents.ts`) so pages stop calling
   `useQuery(GET_X)` inline — that hook layer is where the redesign's loading
   skeletons/optimistic updates (philosophy §6) get implemented once.

7. **One data-fetching stack (M3, H4).** *Decision: keep Apollo, drop TanStack Query.*
   Rationale: 87 vs 3 consumer files; migrating 87 files mid-redesign is unjustifiable. Fix
   the client: memoize construction, enable normalized caching (`cache-first` with explicit
   `network-only` where freshness matters), set `errorPolicy: "all"` and surface errors
   (philosophy §8). Rewrite the 3 TanStack consumers (`graphiql.tsx`, `lottie.tsx`,
   `uppy-dashboard.tsx` — all simple fetches) and remove the provider + dependency.

8. **Decide GraphQL typing (M4).** *Decision: fix codegen rather than hand-maintain.* Point
   `codegen.ts` at the real introspection URL, output to `lib/graphql/__generated__/`,
   delete `apollo.config.json`/`graphql.config.yml` (or align them), and migrate
   `types/models/*` to generated types feature-by-feature as each page is redesigned. Delete
   `app/(application)/users/data/schema.ts`'s duplicate `User`. If codegen proves
   impractical against the dynamic knowledge-context queries, the fallback decision is to
   delete all three config files and own `types/models/` explicitly — the current half-state
   is the worst option.

9. **One toast system (M6).** *Decision: `sonner`* — it is the current shadcn default, the
   newer code already uses it, and the API is smaller. Migrate the 53 `use-toast` call sites
   mechanically; remove `ui/toast.tsx`, `ui/toaster.tsx`, `ui/use-toast.ts`.

### P2 — i18n and hygiene (fold into each page redesign)

10. **Make i18n coverage a page-redesign exit criterion (H3).** Every redesigned page ships
    with a per-feature namespace in `messages/{en,de}.json` (mirroring the feature folders:
    `users`, `chat`, `evals`, …) and zero hardcoded user-facing strings (enforceable via
    eslint `react/jsx-no-literals` scoped to redesigned folders). Fix `<html lang>` to use
    the active locale in both layouts; make `proxy.ts` import from `i18n/config.ts`; rewrite
    `I18N_GUIDE.md` (correct `getTranslations` server API, reference `proxy.ts`).

11. **Naming standard (M8, L3, L7).** Codify in CLAUDE.md: kebab-case files (already 100%);
    route params camelCase (`[variableId]`; rename the two `[variable_id]` segments and
    `[id]` → keep, it's the majority); hooks `use-*.ts(x)` (rename `hooks/contexts.tsx` →
    `use-contexts.ts`); REST namespaces uniformly `*Api`.

12. **Delete dead weight (M5, L1, L4, L6).** Remove: root `index.ts`, `custom.d.ts`,
    `components/icons.tsx`, `components/runs-table.tsx`, `components/callout.tsx`,
    `components/main-loader.{tsx,css}`,
    `components/custom/{dashboard-main-chart,query-examples,code-display-block,date-range-picker}.tsx`,
    `ngrok.*`; swap `form.tsx:44`'s `CopyIcon` import for lucide's `Copy` and delete `icons/`
    (L4); move `PROMPT_LIBRARY_SPEC.md` → `design/`; delete the on-disk
    `.DS_Store`/`tsconfig.tsbuildinfo` litter (already gitignored — L6 — no `.gitignore`
    change needed); fix the duplicate import in `layout.tsx:15-16`. Strip the 110
    `console.log`s (eslint `no-console: ["error", { allow: ["warn", "error"] }]`).

13. **Decompose the god files as part of their page redesigns (H6).** When
    `design/pages/chat.md` / `agents.md` / `knowledge.md` are implemented, the decomposition
    target is the disclosure ladder itself: one component per ladder level (L1 surface, L2
    panels, L3 dialogs), colocated under the feature. Do not refactor these files ahead of
    their redesign — do it once, to the new design.

### Suggested target layout (end-state sketch for the synthesis agent)

```
app/(application)/<feature>/        # route + colocated components/, hooks, queries
components/
  ui/                               # vendored shadcn only (no app imports)
  primitives/                       # PageShell, PageHeader, Toolbar, DataTable/ListDetail,
                                    # EmptyState, StatCard, ChartCard, ConfirmDialog
  shell/                            # main-nav, providers (theme, language, config, auth)
  ai-elements/                      # vendored AI Elements (prune unused of the 34)
lib/
  api/                              # REST clients, one shared request helper
  graphql/                          # server fetch + __generated__ types
  enums/                            # single enum home
  prompts/                          # (already correct)
hooks/                              # cross-feature hooks only (use-mobile, use-uppy)
queries/ → dissolved into features (or interim per-domain split)
messages/{en,de}.json               # per-feature namespaces
```

*Everything above relocates or layers — nothing removes capability. Per philosophy.md, the
structure should make the disclosure ladder cheap to express and the shared bones impossible
to fork.*
