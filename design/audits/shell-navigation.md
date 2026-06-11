# App Shell & Navigation — Audit

> System-wide audit of the authenticated app shell: sidebar navigation, RBAC/config gating,
> header/topbar, loading experience, backend-driven theming, fonts, locale switching, and the
> feedback entry point. Evidence base for the redesign synthesis; judged against
> `design/philosophy.md`, `design/personas.md`, and `CLAUDE.md`.

---

## Current state

### 1. Shell composition (provider stack)

The authenticated shell is assembled in `app/(application)/layout.tsx` (server component):

1. **Auth gate** — `serverSideAuthCheck()`; unauthenticated users are redirected to
   `/login?destination=<pathname>` (`app/(application)/layout.tsx:32-33`). The pathname comes
   from a custom `x-next-pathname` header set in `proxy.ts:112`.
2. **Backend config fetch** — `api.backend()` (`${BACKEND}/config`) merged with env-derived
   config (feedback, n8n, transcription, tts, auth) into one `config` object
   (`layout.tsx:35-74`).
3. **Theme fetch + injection** — `apiConfig.theme()` fetches `${BACKEND}/theme`
   (`util/api.ts:76-98`) and the result is injected as a raw `<style>` block via
   `dangerouslySetInnerHTML`, writing CSS custom properties into `:root` (light) and `.dark`
   (`layout.tsx:85-100`). On fetch failure it silently falls back to `{ light: {}, dark: {} }`
   (`util/api.ts:94-97`), leaving the static defaults in `app/globals.css`.
4. **Provider nesting** (`layout.tsx:109-129`):
   `ConfigContextProvider` → `LanguageProvider` → `ThemeProvider` → `<main>` →
   `TanstackQueryClientProvider` → `Authenticated` → children, with `Toaster` (radix) **and**
   `SonnerToaster` both mounted (`layout.tsx:125-126`) — two parallel toast systems.
5. **`Authenticated`** (`app/(application)/authenticated.tsx`) is a client component that
   builds an Apollo client (lines 47-84), wraps `SessionProvider` (next-auth), a
   `UserContext`, and `MainNavProvider`. The Apollo client is **recreated on every render**
   (`authenticated.tsx:68` — no `useMemo`), with `fetchPolicy: "no-cache"` everywhere, and
   sets `errorPolicy: "ignore"` for all `watchQuery` operations (`authenticated.tsx:77`) —
   GraphQL errors on watched queries are silently swallowed app-wide (one-shot `query`
   operations use `"all"`), directly against philosophy §8 ("Trust through transparency").
6. **`MainNavProvider`** (`components/custom/main-nav.tsx:595-608`) renders
   `NavigationErrorBoundary` → shadcn `SidebarProvider` → `MainNavSidebar` + a **second
   nested `<main>`** for page content (`main-nav.tsx:601`; the outer `<main>` is at
   `layout.tsx:116` — two nested `main` landmarks).

A near-duplicate of the head/theme/font boilerplate exists in
`app/(authentication)/layout.tsx` (favicon links, theme `<style>` injection, fonts) — the
shell scaffolding is copy-pasted between the two route groups rather than shared.

### 2. Navigation inventory

Navigation is built imperatively in `buildNavigation()` (`components/custom/main-nav.tsx:104-257`)
as two flat arrays: `mainNavigationItems` (top) and `bottomNavigationItems` (rendered inside a
collapsible "Admin" section).

**Main items (top group, in code order):**

| # | Label (en / de) | i18n key | Route | Icon (lucide) | Gate | Persona (per personas.md) |
|---|---|---|---|---|---|---|
| 1 | Chat / Chat | `navigation.chat` | `/chat` | `MessageCircle` | none — all users | P1 |
| 2 | Agents / Agenten | `navigation.agents` | `/agents` | `Bot` | none — all users | P2 |
| 3 | Knowledge / Wissen | `navigation.knowledge` | `/data` | `Brain` | none — all users | P2 |
| 4 | Prompts / Prompts | `navigation.prompts` | `/prompts` | `ClipboardType` | none — all users | P2 |
| 5 | Skills / Skills | `navigation.skills` | `/skills` | `Sparkles` | none — all users | P2 |
| 6 | Projects / Projekte | `navigation.projects` | `/projects` | `FolderOpen` | none — all users | P1 |
| 7 | Routines / Routinen | `navigation.routines` | `/workflows` | `Form` | `super_admin \|\| role.workflows === "write"` (main-nav.tsx:145) | P2 |
| 8 | Evals / Evaluationen | `navigation.evals` | `/evals` | `BookCheck` | `super_admin \|\| role.evals === "read"\|"write"` (153) | P4 |
| 9 | Feedback / Feedback | `navigation.feedback` | `/feedback` | `ThumbsUp` | `super_admin` only (161) | P3 (review) |
| 10 | Transcripts / Transkription | `navigation.transcriptions` | `/transcriptions` | `FileAudio` | none — **not gated by `config.transcription.enabled`** (170-174) | P1 |
| 11 | Automation / Automatisierung | `navigation.automation` | `/n8n` | `Workflow` | `(super_admin \|\| workflows === "write") && config.n8n?.enabled` (176-185) | P2 |

**Bottom items (inside the collapsible "Admin" section, `navigation.admin` = "Admin"/"Administration"):**

| # | Label (en / de) | i18n key | Route | Icon | Gate | Persona |
|---|---|---|---|---|---|---|
| 1 | Users / Benutzer | `navigation.users` | `/users` | `Users` | `super_admin \|\| role.users === "write"` (187) | P3 |
| 2 | Analytics / Analytik | `navigation.analytics` | `/analytics` | `BarChart4` | `super_admin` only (195) | P3 |
| 3 | Playground / API Playground | `navigation.apiPlayground` | `/explorer` | `Code` | `super_admin \|\| role.api === "write"` (204) | P4 |
| 4 | Theme / Design | `navigation.themeSettings` | `/configuration` | `Palette` | `super_admin` only (212) | P3 |
| 5 | Keys / Keys | `navigation.apiKeys` | `/keys` | `Key` | `super_admin \|\| role.api === "write"` (220) | P3/P4 |
| 6 | Vault / Systemvariablen | `navigation.systemVariables` | `/variables` | `Variable` | `super_admin \|\| role.variables === "write"` (228) | P3/P4 |
| 7 | **"Models" (hardcoded English)** | — | `/models` | `Cpu` | `super_admin \|\| role.agents === "write"` (236-242) | P3 |
| 8 | **"Budgets" (hardcoded English)** | — | `/budgets` | `Wallet` | `super_admin \|\| role.budget_management === "read"\|"write"` (244-254) | P3 |

**Footer (`main-nav.tsx:508-590`):**

| Element | Behavior |
|---|---|
| `FeedbackButton` (`components/feedback/feedback-button.tsx`) | Only when `config.feedback.enabled`; icon `MessageSquarePlus`, label `feedback.label`; opens `FeedbackDialog` (choice bug/feature → embedded feedback chat) |
| User dropdown (avatar initial + name + email domain) | Opens upward; items: **Theme** toggle (Sun/Moon, light↔dark only), **Language** toggle (en↔de), **Settings** link `/settings`, **Token** link `/token` (hardcoded English label, `Album` icon), **Logout** |

**Routes with no nav entry at all** (reachable only via in-page links or direct URL):
`/settings` and `/token` (user dropdown only), `/roles` and `/teams` (buttons inside the
`/users` table toolbar — `app/(application)/users/components/data-table.tsx:202,211`),
`/evals/cases`, and `/` itself (`app/(application)/page.tsx` is a client component that
immediately `redirect("/chat")` — there is **no dashboard**, despite the unused
`navigation.dashboard` key in `messages/en.json` and the dashboard plan in
`design/personas.md`).

The brand slot in the sidebar header is a **hardcoded string "AI Studio"**
(`main-nav.tsx:491`) next to the `SidebarTrigger` — the white-label `Logo` component
(`components/logo.tsx`, backend-served `logo_light.png`/`logo_dark.png`) is *not* used in
the shell at all (it is only used on the login layout and one chat view).

### 3. RBAC and config gating

- The role model (`types/models/user-role.ts`) has exactly **seven permission keys**:
  `agents`, `workflows`, `variables`, `users`, `api`, `evals`, `budget_management` — each
  `"read" | "write" | null` — plus the `super_admin` boolean on the user.
- Gating is inline boolean logic in `buildNavigation()`; there is no declarative
  route→permission map and no shared `can(user, resource)` helper for the nav.
- **Coverage gaps:** there are no permission keys for knowledge/contexts, prompts, skills,
  projects, transcriptions, models, analytics, configuration, teams, roles, or feedback.
  Consequently items 2-6 of the main nav are visible to *every* user, and several admin
  surfaces fall back to `super_admin`-only.
- **Semantic mismatches:** `/models` is gated by `role.agents` (main-nav.tsx:236);
  `/feedback` review is `super_admin`-only although personas assign feedback review to P3;
  `workflows === "read"` users get *no* Routines nav item even though the role supports read.
- Config gating: `n8n` requires `config.n8n.enabled` (env `N8N_URL`); the FeedbackButton
  requires `config.feedback.enabled`; but **Transcripts ignores
  `config.transcription.enabled`** — the item renders even on deployments with transcription
  disabled (the flag *is* respected inside chat: `app/(application)/chat/[agent]/[session]/chat.tsx:150`).
- `BackendConfigType.entitlements` (`util/api.ts:44`) is typed but **never consumed anywhere**
  in the app — a dead config dimension.
- `components/rbac.tsx` is unrelated to navigation: it is the `RBACControl`
  visibility/sharing widget (private/users/roles/teams/public + per-principal read/write)
  used in resource editors. Nothing in the shell imports it.

### 4. Sidebar behavior

Implementation is the stock shadcn sidebar (`components/ui/sidebar.tsx`) with
`collapsible="icon"` (`main-nav.tsx:487`):

- **Widths:** 16rem expanded, 3rem icon-collapsed, 18rem mobile sheet
  (`sidebar.tsx:29-31`).
- **Persistence:** open state written to a `sidebar_state` cookie, 7-day max-age
  (`sidebar.tsx:27-28,92`); read back server-side in `layout.tsx:26` and passed as
  `defaultOpen` — so the collapse state survives reloads without flicker. **But the
  first-run default is inverted:** `cookieStore.get("sidebar_state")?.value === "true"`
  (`layout.tsx:26`) evaluates a *missing* cookie to `false`, so first-time visitors get an
  icon-collapsed sidebar by default — overriding the shadcn `defaultOpen = true` default
  (`sidebar.tsx:65`). New users meet the shell as a rail of unlabeled icons until they
  discover the trigger.
- **Keyboard:** `Cmd/Ctrl+B` toggles (`sidebar.tsx:32,105-118`); the shortcut is not surfaced
  anywhere in the UI.
- **Collapsed mode:** labels hide; each item shows a right-side tooltip
  (`sidebar.tsx:592-602`); `tooltip` is passed for every item (`main-nav.tsx:276`).
- **Mobile (<768px, `hooks/use-mobile.tsx:3`):** the sidebar renders as an off-canvas `Sheet`
  (`sidebar.tsx:200-222`), closed by default (`openMobile` initial `false`,
  `sidebar.tsx:76`). **The only `SidebarTrigger` in the entire app lives inside the sidebar
  header itself** (`main-nav.tsx:489`) — i.e. inside the closed sheet. A repo-wide grep for
  `SidebarTrigger`/`useSidebar`/`setOpenMobile` finds no other trigger; on mobile there is
  no visible affordance to open the main navigation at all. The Sheet's own stock close
  button is also suppressed via `[&>button]:hidden` (`sidebar.tsx:206`).
- **Active state:** `pathname.includes(navItem.path)` (`main-nav.tsx:270,334`) — substring
  matching, not segment matching. Any pathname containing the token lights the item (e.g.
  `/chat/data-analyst/...` for an agent slug containing "data" would light both Chat and
  Knowledge); inactive items are dimmed with `opacity-60` (`main-nav.tsx:279,343`).
- **Dead logic:** the "close sidebar on agent detail pages" effect
  (`main-nav.tsx:418-422`) only runs when `sidebarDefaultOpen === undefined`, but the layout
  always passes a boolean (`layout.tsx:26`), so it never fires. Likewise the `if (!user)`
  skeleton branch (`main-nav.tsx:466-484`) is unreachable in practice because the server
  layout always supplies `user`.
- **"Admin" collapsible** (`AdminNavigationSection`, `main-nav.tsx:303-389`): trigger row
  (Settings icon + "Admin" + chevron) sits at the *bottom*, and the items expand *above* it
  (`CollapsibleContent` is rendered before the trigger, lines 331-362 vs 364-386).
  Auto-expands whenever the current pathname matches any admin item and re-collapses
  otherwise (`main-nav.tsx:317-322`); the user cannot pin it open across navigation.
- **Duplication:** `NavigationItems` (259-301) and the item loop inside
  `AdminNavigationSection` (333-360) are ~40 lines of identical markup maintained twice.
- `components/ui/navigation.tsx` is the untouched shadcn `NavigationMenuDemo` with hardcoded
  shadcn-docs content — dead code, never imported by the shell.

### 5. Header / topbar / breadcrumbs

There is **no shared topbar, page header, or breadcrumb system in the shell**. The shell
contributes only the sidebar; everything to the right is the raw page
(`main-nav.tsx:599-604`). Consequences observed:

- `components/ui/breadcrumb.tsx` exists (shadcn primitive) but is used by no shell or page
  chrome (only `components/items-selection-modal.tsx` references the word).
- Pages invent their own top bars, e.g. the skill detail page builds a custom toolbar with
  its own panel-toggle button explicitly commented *"same placement as SidebarTrigger in
  main-nav"* (`app/(application)/skills/[skillId]/page.tsx:239-252`); chat has its own
  session rail (`app/(application)/chat/[agent]/layout.tsx:21-26` renders
  `ChatSessionsComponent` beside children at `h-[100vh]`).
- There is no command palette and no global search, although `design/philosophy.md` lists
  "command palette" as an L0 navigation element.

### 6. Loading experience

- **Route-level:** exactly one `loading.tsx` exists in the entire app
  (`app/(application)/chat/[agent]/[session]/loading.tsx`) — a full-viewport spinning
  `Loader` icon. All other route transitions render nothing until the server component
  resolves (and `layout.tsx` awaits auth + `/config` + `/theme` per navigation).
- **`components/main-loader.tsx`** (the Uiverse "loader-square" animation +
  `main-loader.css`) is **imported by nothing** — dead code.
- **`ldrs` grid spinner script is loaded but never consumed.** A third-party CDN script is
  fetched on every authenticated page (`layout.tsx:108`:
  `https://cdn.jsdelivr.net/npm/ldrs/dist/auto/grid.js`), yet a repo-wide grep (excluding
  node_modules/.next) finds no `<l-grid>` — nor any other ldrs element — anywhere in JSX.
  The only other trace is an unused `'ldrs-icon'` JSX type declaration (`custom.d.ts:3`);
  chat.tsx's only "grid" hit is a Tailwind class (`chat.tsx:1433`), and
  `app/(authentication)/layout.tsx` contains neither the script nor any ldrs component.
  The script is pure dead weight — an external runtime request with no consumer.
- The sidebar skeleton (`main-nav.tsx:466-484`) is hand-rolled `animate-pulse` divs rather
  than the `SidebarMenuSkeleton` primitive that ships in `components/ui/sidebar.tsx:660-696`,
  and (as noted) is unreachable.
- This collectively violates philosophy §6 ("Skeletons mirror the real layout (no spinner
  walls)").

### 7. Theming pipeline

- **Source:** backend endpoint `${BACKEND}/theme` returns
  `{ theme: { light: Record<cssVar,value>, dark: Record<cssVar,value> } }`
  (`util/api.ts:60-98`). Fetched server-side per request with the user's bearer token; errors
  are swallowed to `{}` so the static `app/globals.css` tokens apply.
- **Injection:** raw string interpolation into a `<style>` tag with
  `dangerouslySetInnerHTML` (`layout.tsx:85-100`) — keys and values are not validated or
  escaped, so the backend can inject arbitrary CSS (accepted for a self-hosted product, but
  worth noting as the white-label trust boundary). The same block is duplicated in
  `app/(authentication)/layout.tsx`.
- **Mode switching:** `next-themes` with `attribute="class"`. The layout passes
  `defaultTheme="system" enableSystem` (`layout.tsx:111-115`), but the wrapper
  **overrides it**: `components/theme-provider.tsx:9` spreads props *then* sets
  `defaultTheme={"dark"}`, so the effective default is always dark and the layout's
  "system" intent is silently discarded. The footer toggle only flips light↔dark
  (`main-nav.tsx:437-443`) — once toggled, "system" is unreachable.
- **Brand assets:** favicons come from the backend (`layout.tsx:81-84`);
  `components/logo.tsx` picks `logo_light.png`/`logo_dark.png` from the backend but keys on
  `theme !== "dark"` instead of `resolvedTheme` (`logo.tsx:19,28`) — under
  `theme === "system"` on a dark OS it shows the light logo. The shell never renders it
  (hardcoded "AI Studio" instead).
- **Sidebar tokens:** `--sidebar*` variables defined in `app/globals.css:59-66` (light) and
  `109-116` (dark); note `--sidebar-ring` is a blue (217.2 91.2% 59.8%), not the brand
  purple, and the active menu state uses `bg-sidebar-accent` (neutral) rather than any
  primary accent — the sidebar currently has *no* purple at all.

### 8. Fonts

`lib/fonts.ts` loads three local font families via `next/font/local`: Inter
(300/400/700 → `--font-sans`), JetBrains Mono (`--font-mono`), Merriweather
(`--font-serif`), combined as `fontVariables` and applied on `<body>`
(`layout.tsx:102-107`). Matches `CLAUDE.md`. Duplicated setup in the authentication layout.

### 9. Locale switching (i18n)

- Two locales, `en`/`de`, default `en`, persisted in the `NEXT_LOCALE` cookie
  (`i18n/config.ts`).
- Server: `layout.tsx:27,40` reads the cookie and imports `messages/<locale>.json`;
  client: `LanguageProvider` (`components/language-provider.tsx`) wraps
  `NextIntlClientProvider`, re-reads the cookie on mount, and `setLocale()` writes the
  cookie (1-year expiry), loads the new messages, **then does a full
  `window.location.reload()`** (`language-provider.tsx:57`).
- The switcher is a single dropdown item that toggles to the *other* language
  (`main-nav.tsx:560-567`) — workable at 2 locales, a dead end at 3+.
- `<html lang="en">` is hardcoded in both layouts (`layout.tsx:79`) regardless of locale —
  incorrect for German users (a11y/SEO).
- **Translation drift in nav labels:** "Models", "Budgets" (main-nav.tsx:238,250) and
  "Token" (575-579) are hardcoded English; en/de pairs disagree in register
  (`systemVariables`: "Vault" vs "Systemvariablen"; `apiPlayground`: "Playground" vs
  "API Playground"; `themeSettings`: "Theme" vs "Design").
- The `NavigationErrorBoundary` fallback UI is hardcoded English too — "Navigation Error",
  "Something went wrong loading the navigation. Please refresh the page.", "Refresh Page"
  (`main-nav.tsx:85-93`) — so the shell's own error state never translates.
- The message catalog has drifted in the other direction as well: `messages/en.json`
  carries unused `navigation.*` keys beyond `dashboard` — `templates`, `keys`, `variables`,
  `api`, `terms` — orphaned entries no nav item references.

### 10. Feedback entry point

`FeedbackButton` (footer, above the user menu) → `FeedbackDialog` → choice (bug/feature) →
embedded feedback chat against dedicated agents configured via env
(`FEEDBACK_BACKEND`, `FEEDBACK_TOKEN`, `BUG_AGENT_*`, `FEATURE_AGENT_*`,
`layout.tsx:43-53`). Gated on `config.feedback.enabled`; properly tooltipped and
ARIA-labelled. The *review* side (`/feedback` page) is a separate super_admin-only nav item
in the main group.

### 11. Console/diagnostic noise & secrets

- `layout.tsx:36` logs the raw backend config response on every request;
  `util/api.ts:87` logs every theme response; `ConfigContextProvider` logs the merged
  config **in the browser** (`config-context.tsx:25`).
- That merged config includes `feedback.token` (env `FEEDBACK_TOKEN`, `layout.tsx:46`) —
  a server credential serialized into the client component tree and printed to the console
  of every user.

---

## Issues

### High

| # | Issue | Evidence |
|---|---|---|
| H1 | **Flat, persona-mixed navigation.** Eleven ungrouped top items interleave P1 (Chat, Projects, Transcripts) with P2 builder surfaces (Agents, Knowledge, Prompts, Skills, Routines, Automation), P4 (Evals) and P3 (Feedback review); the "Admin" section mixes P3 (Users, Analytics, Theme, Budgets) with P4 (Playground, Keys) and a P2/P3 hybrid (Models). Violates philosophy §1/§3 ("persona-shaped nav… an end user should see a 4-item sidebar, not a 20-item admin tree") and the grouping spec at the end of `personas.md`. | `main-nav.tsx:104-257`; `personas.md:182-195` |
| H2 | **Pure end users see the builder suite.** Agents, Knowledge, Prompts, Skills (and Transcripts/Projects) have no gate, because the role model has no permission keys for them. `personas.md:35-36` says P1 "should never see" these (RBAC-trimmed, not just collapsed). | `main-nav.tsx:109-143,170-174`; `types/models/user-role.ts` |
| H3 | **No way to open navigation on mobile.** The only `SidebarTrigger` is rendered inside the sidebar header, which on <768px is inside the closed off-canvas Sheet. No page or shell chrome renders an alternate trigger. Compounding it, the mobile Sheet suppresses its own built-in close button via `[&>button]:hidden` (`sidebar.tsx:206`) — the customization deliberately removed the one stock affordance the Sheet ships with. Anti-pattern #9 ("desktop-only afterthought"); blocks P1's first-class mobile chat job. | `main-nav.tsx:489`; `sidebar.tsx:200-222,76,206`; repo-wide grep for `SidebarTrigger`/`setOpenMobile` |
| H4 | **Server credential exposed to the client and logged.** `FEEDBACK_TOKEN` is placed in the config object passed to client components and `console.log`-ed in every browser session. | `layout.tsx:43-53`; `config-context.tsx:25` |
| H5 | **White-label brand broken in the shell.** Sidebar header shows hardcoded "AI Studio"; the backend-served `Logo` is unused in the shell, and `logo.tsx` keys on `theme` instead of `resolvedTheme`, showing the wrong logo under system-dark. Undermines the theming/white-label pipeline that the rest of the shell builds (favicons, CSS vars). | `main-nav.tsx:491`; `logo.tsx:19,28` |
| H6 | **No dashboard; `/` hard-redirects to `/chat`.** The personas matrix designates `/` as the role-composed dashboard; the i18n key `navigation.dashboard` exists but is unused. Every persona lands in P1's surface. | `app/(application)/page.tsx:8-10`; `personas.md:148-151,176-178`; `messages/en.json` |
| H7 | **Active-state substring matching.** `pathname.includes(path)` can light multiple items simultaneously and mis-highlight on slugs containing nav tokens (e.g. agent slug `data-analyst` lights Knowledge while chatting). | `main-nav.tsx:270,334` |

### Medium

| # | Issue | Evidence |
|---|---|---|
| M1 | **i18n drift in nav labels.** "Models", "Budgets", "Token" hardcoded English; the `NavigationErrorBoundary` fallback is hardcoded English as well ("Navigation Error" / "Something went wrong loading the navigation…" / "Refresh Page", `main-nav.tsx:85-93`); en/de label pairs diverge in meaning ("Vault"/"Systemvariablen", "Playground"/"API Playground", "Theme"/"Design"); and `messages/en.json` holds orphaned `navigation.*` keys (`templates`, `keys`, `variables`, `api`, `terms`, plus `dashboard`) that no nav item consumes. German users get a half-translated shell. | `main-nav.tsx:238,250,577,85-93`; `messages/en.json` vs `messages/de.json` |
| M2 | **Route↔label terminology drift.** `/data`→"Knowledge", `/workflows`→"Routines", `/n8n`→"Automation", `/explorer`→"Playground", `/variables`→"Vault", `/configuration`→"Theme" (the page is platform configuration, not just theming). Breaks the URL-as-orientation contract for P4 and support conversations. | `main-nav.tsx:104-257`; `personas.md` matrix rows |
| M3 | **Transcripts not gated by deployment config** — renders even when `config.transcription.enabled` is false (the flag exists and gates chat audio). | `main-nav.tsx:170-174` vs `chat.tsx:150` |
| M4 | **RBAC semantics miswired:** Models gated by `role.agents`; Feedback review and Analytics and Configuration are `super_admin`-only (P3 admins with full role grants cannot reach them); `workflows: "read"` grants no nav item. Plus dead `entitlements` config field. | `main-nav.tsx:161,195,212,236`; `util/api.ts:44` |
| M5 | **Roles and Teams unreachable from navigation** — only discoverable via buttons inside the `/users` table toolbar. High-stakes, infrequently visited admin pages must be self-explanatory per personas (P3 "visits are infrequent… self-explanatory on every visit"). | `users/components/data-table.tsx:202,211` |
| M6 | **No shared shell chrome (PageHeader/topbar/breadcrumbs/command palette).** Each page reinvents its own top bar (skills detail clones the trigger placement by hand); philosophy §5 mandates shared bones, §L0 names a command palette. | `main-nav.tsx:599-604`; `skills/[skillId]/page.tsx:239-252`; `philosophy.md:49,88-98` |
| M7 | **Loading experience violates philosophy §6.** One `loading.tsx` in the whole app (full-screen spinner); no nav-transition feedback; dead `MainLoader`; an *unused* third-party CDN spinner script loaded on every page (no consumer anywhere in the app — see §6). | `chat/[agent]/[session]/loading.tsx`; `main-loader.tsx`; `layout.tsx:108`; `custom.d.ts:3` |
| M8 | **Theme default contradiction & lost "system" option.** Wrapper hard-overrides `defaultTheme` to dark after spreading props, silently defeating the layout's `system` setting; the footer toggle only cycles light↔dark. | `theme-provider.tsx:9`; `layout.tsx:111-115`; `main-nav.tsx:437-443` |
| M9 | **Locale switch does a full page reload** and `<html lang>` is hardcoded to "en" in both layouts. | `language-provider.tsx:57`; `layout.tsx:79` |
| M10 | **Admin section UX:** expands upward above its own trigger, auto-collapses on leaving admin routes (cannot pin), trigger reuses the generic `Settings` icon while a `Settings` *link* with the same icon sits in the user dropdown — two different "Settings" affordances. | `main-nav.tsx:303-389,374,569-572` |
| M11 | **Nested `<main>` landmarks** (layout + MainNavProvider) — invalid landmark structure for screen readers. | `layout.tsx:116`; `main-nav.tsx:601` |
| M12 | **Apollo client recreated per render with global `no-cache`, and `errorPolicy: "ignore"` on all watchQuery operations** — shell-level perf cost on every state change in `Authenticated`, plus GraphQL errors silently swallowed app-wide for watched queries (violates philosophy §8, "Trust through transparency"). | `authenticated.tsx:66-84`, esp. `:77` |
| M13 | **Inactive nav items at `opacity-60`** — muted-on-muted text risks WCAG AA contrast failure in both themes, against CLAUDE.md accessibility standard. | `main-nav.tsx:279,343` |
| M14 | **Two toast systems mounted simultaneously** (radix `Toaster` + Sonner) — duplicate patterns, anti-pattern #4. | `layout.tsx:125-126` |

### Low

| # | Issue | Evidence |
|---|---|---|
| L1 | Dead code in the shell: `components/ui/navigation.tsx` (shadcn demo with hardcoded docs links), `components/main-loader.tsx` + CSS, the unreachable `!user` skeleton, the never-firing agent auto-close effect, 12 unused lucide imports on one line (ChevronDown, LayoutDashboard, Database, ListTodo, Route, FileCheck, FileText, TextSelect, BarChart2, BarChart, MessageSquare, Gamepad2). | `navigation.tsx`; `main-loader.tsx`; `main-nav.tsx:25,418-422,466-484` |
| L2 | Icon stroke width 1.5 everywhere in nav vs CLAUDE.md's stated "stroke-width: 1". Trigger (`PanelLeft`) uses default 2. Minor, but the standard and the code disagree. | `main-nav.tsx` passim; `CLAUDE.md` stack notes |
| L3 | Cmd/Ctrl+B sidebar shortcut undiscoverable (no tooltip/kbd hint). | `sidebar.tsx:32,104-118` |
| L4 | `useIsMobile` initializes `undefined`→`false`, causing a desktop-first render flash on phones. | `hooks/use-mobile.tsx:6,18` |
| L5 | Duplicated nav item markup between `NavigationItems` and `AdminNavigationSection`; duplicated head/theme/font scaffolding between the two route-group layouts. | `main-nav.tsx:259-301,333-360`; both `layout.tsx` files |
| L6 | Diagnostic `console.log`s in production paths (backend config, theme response, merged config). | `layout.tsx:36`; `util/api.ts:87`; `config-context.tsx:25` |
| L7 | Theme CSS injected without key/value validation — backend can emit arbitrary CSS into every page (acceptable trust boundary for self-hosted, but should be constrained to known tokens). | `layout.tsx:85-100` |
| L8 | Avatar fallback uses `text-white` over a primary-gradient regardless of theme/brand override — can fail contrast under white-label palettes. | `main-nav.tsx:524` |
| L9 | Sidebar token `--sidebar-ring`/dark `--sidebar-primary` are blues unrelated to the brand purple; active nav state has no accent at all (arguably correct per "calm", but inconsistent with "purple marks the active state", philosophy §4). | `app/globals.css:62,66,111,116` |

---

## Recommendations

Prioritized for the synthesis agent; each states the recommended decision where one is implied.

1. **Adopt the persona-grouped sidebar from `personas.md` as the navigation IA** —
   `Workspace` (Chat, Projects, Transcriptions) / `Build` (Agents, Knowledge, Prompts,
   Skills, Workflows, Automation) / `Develop` (Evals, API Explorer, Token) /
   `Administration` (Users, Roles, Teams, Budgets, Analytics, Variables, Keys, Models,
   Configuration) / `Personal` footer (Settings, Feedback, theme/language). Use
   `SidebarGroup` + `SidebarGroupLabel` (already in `components/ui/sidebar.tsx:425-460`,
   currently unused for labels) and hide *whole groups* via RBAC. This single change
   resolves H1 and most of M10.
2. **Replace inline gating with a declarative nav config** — one
   `NAV: Array<{ group, route, i18nKey, icon, requires: PermissionRule, configFlag? }>`
   consumed by a single renderer. Decision: keep `buildNavigation` semantics but derive both
   sidebar and (future) command palette from the same table so gating can never diverge.
   Fold in the missing gates (transcription config flag — M3) and fix the mismatches
   (Models→ its own permission or `models` key; Feedback review→ role-based — M4). This
   requires backend role-model extension (new permission keys for knowledge, prompts,
   skills, models, analytics, configuration, feedback) — flag as a cross-team dependency
   for H2.
3. **Fix mobile navigation access (H3) before any visual redesign ships.** Decision: add a
   fixed mobile top bar (logo + hamburger `SidebarTrigger` + page title) rendered by the
   shell for `useIsMobile()`, rather than expecting every page to place a trigger. This also
   becomes the natural home of the shared PageHeader on small screens.
4. **Introduce the shared shell chrome (philosophy §5):** a `PageShell`/`PageHeader` slot
   rendered by the layout to the right of the sidebar, with breadcrumbs for nested routes
   (agents/edit, evals/[id], variables/*) and the page's primary action. Add a command
   palette (cmdk is the shadcn-native choice) fed from the same nav table as L0 navigation
   for power/dev personas. Retire per-page hand-rolled top bars over time.
5. **Stop leaking `FEEDBACK_TOKEN` (H4) immediately:** proxy feedback-chat calls through a
   Next.js route handler that attaches the token server-side; remove the three production
   `console.log`s (L6). This is a one-day fix independent of the redesign.
6. **Restore white-label branding in the shell (H5):** render `Logo` (fixed to use
   `resolvedTheme`) in the sidebar header with a configurable product name (backend config),
   removing "AI Studio". Decision: brand name should come from the same `/config` payload
   that already drives logos/favicons.
7. **Build the role-composed dashboard at `/` (H6)** per `design/pages/dashboard.md`, and
   point the post-login redirect there for P2-P4 while pure P1 roles can keep landing in
   Chat. Wire up the unused `navigation.dashboard` label.
8. **Fix active-state matching (H7):** match on first path segment equality
   (`pathname.split('/')[1] === navItem.path`), with explicit alias lists where needed
   (e.g. `/roles`, `/teams` highlight Users group). Cheap, do it now.
9. **Unify naming and translations (M1/M2):** one terminology table (route, en, de) owned by
   the design system; recommended canon: keep route names as the source of truth and rename
   labels toward them — "Knowledge" stays (rename route `/data`→`/knowledge` long-term),
   "Variables" (drop "Vault"), "API Explorer" (drop "Playground"), "Configuration" (drop
   "Theme" since the page owns more than theming). Move all labels into `messages/*.json`
   (no hardcoded strings) and set `<html lang={locale}>`.
10. **Theme/locale mechanics:** make `ThemeProvider` respect incoming props (delete the
    `defaultTheme="dark"` override) and decide deliberately — recommended default
    `system` with a three-state selector (light/dark/system) in the user menu. Replace the
    locale toggle with a small submenu listing locales, and switch via
    `router.refresh()` after cookie write instead of `window.location.reload()` where
    feasible.
11. **Loading experience (M7):** add `loading.tsx` skeletons mirroring layout for every
    top-level route group (list pages share one `ListDetail` skeleton primitive); delete
    `MainLoader`, and simply delete the `ldrs` CDN script (`layout.tsx:108`) and the unused
    `'ldrs-icon'` type declaration (`custom.d.ts:3`) — nothing in the app consumes them, so
    no replacement is needed; use `SidebarMenuSkeleton` if a nav skeleton is ever genuinely
    needed.
12. **Shell hygiene (cheap wins during implementation):** memoize the Apollo client
    (M12); collapse to a single toast system — recommended Sonner, the newer shadcn default
    (M14); de-duplicate nav item rendering into one `NavItem` component and share the
    head/theme/font scaffolding between route-group layouts (L5); remove
    `components/ui/navigation.tsx` and other dead code (L1); raise inactive-item contrast
    (use `text-sidebar-foreground/70`+ hover full, not `opacity-60`) and verify AA (M13);
    fix nested `<main>` by making the shell's content wrapper a `div` (M11); constrain
    injected theme vars to an allowlist of known tokens (L7); standardize icon stroke
    width by updating CLAUDE.md to 1.5 (matches the actual app) rather than rewriting every
    icon (L2); surface the Cmd+B shortcut in the trigger tooltip (L3).

**Suggested sequencing:** (a) security + correctness fixes (5, 8, theme-provider part of 10)
ship immediately; (b) nav config table + persona groups + mobile top bar (1, 2, 3) as the
first redesign milestone; (c) shell chrome + dashboard + command palette (4, 7) second;
(d) naming/i18n + loading + hygiene (9, 11, 12) threaded through page-by-page work.
