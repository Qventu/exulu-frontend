# Dashboard / Home — Review & Design Concept
**Routes:** `/`  **Primary persona:** varies by role — in practice P2 (highest-frequency multi-hat visitor); P1-only accounts bypass the page entirely  **Secondary:** P3, P4 (RBAC-gated widget sections), P1 (resume-work strip)  **Current state:** There is no dashboard — `/` is a blind redirect to `/chat`; the "dashboard" widget library exists but is scattered across `/analytics` and `/data`, themed inconsistently, and partially dead code.

---

## 1. Current state

`app/(application)/page.tsx` is 11 lines: a client component that imports `./home.css` and calls `redirect("/chat")` (`app/(application)/page.tsx:9`). The original 343-line `/dashboard` stats page (commit `f4f3091`) was renamed to `/analytics` in commit `3194d38` ("restructured main nav"), and `/` was repointed from `/dashboard` to `/chat`. What remains of "Dashboard / Home" is therefore: (a) the redirect + the de facto landing logic it delegates to, and (b) the dashboard widget library (`components/dashboard/`, `components/custom/dashboard-main-chart.tsx`, `components/custom/recent-{embeddings,processings}.tsx`) that any new Home must compose without breaking its current consumers (`/analytics`, `/data`).

### Functionality inventory

**A. Route & arrival behavior (what `/` does today)**

1. **Force-dynamic redirect `/` → `/chat`** — `app/(application)/page.tsx:6,9` (`dynamic = "force-dynamic"`).
2. **Server-side auth gate with destination preservation** — unauthenticated requests to `/` redirect to `/login?destination=<path>` (`app/(application)/layout.tsx:32–33`, via `serverSideAuthCheck`).
3. **`.gradient` animated gradient-text CSS class** — defined in `app/(application)/home.css:1–26` and imported globally by the page (`page.tsx:3`); no element in the app currently uses the class (verified: only import site is `page.tsx`).
4. **De facto landing A — zero accessible agents:** info `Alert` "No agents found / You don't have permission… contact your administrator" (`app/(application)/chat/page.tsx:27–37`).
5. **De facto landing B — exactly one active agent:** auto-redirect to `/chat/{id}` (`chat/page.tsx:40–42`).
6. **De facto landing C — a `defaultagent`-flagged agent exists:** auto-redirect to `/chat/{defaultAgent.id}` (`chat/page.tsx:44–48`).
7. **De facto landing D — otherwise:** "Select an agent" screen with the agent-selection grid (`chat/page.tsx:50–53`, `AgentSelectionModalContentWrapper`).

**B. Dashboard widget library (`components/dashboard/`) — the building blocks this area owns**

8. **SummaryCard — 24h total** for a statistics entity (`agent_sessions` | `jobs` | `tracking`) computed by summing `{entity}Statistics` counts (`components/dashboard/summary-cards.tsx:71–123`, totals at 102–110).
9. **SummaryCard — trend vs. 7-day daily average:** % change, `TrendingUp`/`TrendingDown`/`Minus` icon, semantic green/red/neutral tinting, "vs 7-day avg: N" caption (`summary-cards.tsx:38–65`).
10. **SummaryCard — skeleton loading state** mirroring the card layout (`summary-cards.tsx:17–36`).
11. **DateRangeSelector — popover range calendar**, two months side by side, formatted `LLL dd, y – LLL dd, y` trigger label, "Pick a date range" placeholder (`components/dashboard/date-range-selector.tsx:58–99`).
12. **DateRangeSelector — max-range validation:** ranges > `maxDays` (default 30) rejected with a destructive toast (`date-range-selector.tsx:28–42`).
13. **DateRangeSelector — dynamic disabled days** outside the permitted window once a start date is picked, plus "Maximum range: N days" footnote (`date-range-selector.tsx:44–56, 95–97`).
14. **TimeSeriesChart — data-type Select** over a caller-provided `STATISTICS_TYPE` list with enum→label prettifying (`components/dashboard/time-series-chart.tsx:85–98, 24–29`).
15. **TimeSeriesChart — unit Select** (tokens/count), rendered only when more than one option is supplied (`time-series-chart.tsx:99–114`).
16. **TimeSeriesChart — day-granular area chart** with zero-filled date gaps, themed gradient stroke/fill, dot + activeDot, tooltip with full formatted date, legend (`time-series-chart.tsx:50–79, 132–217`).
17. **TimeSeriesChart — skeleton / error / empty states** (`time-series-chart.tsx:119–130`).
18. **DonutChart — group-by Select** (caller-provided options, e.g. label/user/role), hidden when no options (`components/dashboard/donut-chart.tsx:106–123`).
19. **DonutChart — ranked slice rendering:** `--chart-1`…`--chart-10` palette, radial gradients per slice, percentage labels suppressed below 5% (`donut-chart.tsx:22–33, 58–102, 142–181`).
20. **DonutChart — skeleton / error / empty states** (`donut-chart.tsx:126–138`).
21. **Leaderboard — top-N ranking** (default 10, `maxEntries` prop) with proportional progress-bar background fill and configurable value label / empty message (`components/dashboard/leaderboard.tsx:94–139, 181–236`).
22. **Leaderboard — ID→name hydration** via optional secondary query (`GET_USERS_BY_IDS` / `GET_PROJECTS_BY_IDS`), number/string id matching, display-name fallback chain email → firstname+lastname → name → raw id (`leaderboard.tsx:74–129`).
23. **Leaderboard — top-3 captions** ("Top performer" / "Runner up" / "Third place"), skeleton and empty states (`leaderboard.tsx:141–179, 216–221`).
24. **DashboardMainChart — orphaned area chart** (hardcoded `#2563eb` blue, unstyled `.custom-tooltip` class, `DD.MM.YYYY` placeholder series). Zero import sites anywhere in the app since the old `/dashboard` page was deleted (`components/custom/dashboard-main-chart.tsx:20–62`; verified by repo-wide grep).

**C. Recent-activity widgets (`components/custom/`)**

25. **RecentEmbeddings** — per-context table of the 5 most recent items with `embeddings_updated_at` within 21 days, sorted desc, 10-second poll interval, each row linking to `/data/{contextId}/{itemId}` with truncated name and relative timestamp ("never" fallback), spinner-loading and "No recent embeddings" empty state (`components/custom/recent-embeddings.tsx:24–128`; mounted at `app/(application)/data/components/embeddings.tsx:356`).
26. **RecentProcessings** — identical pattern for `last_processed_at` ("Recently Processed") (`components/custom/recent-processings.tsx:26–172`; mounted at `app/(application)/data/components/processors.tsx:282`).
27. **RecentProcessings — declared chunk mutations:** `GENERATE_CHUNKS` / `DELETE_CHUNKS` mutations with background-job success toasts are wired up (`recent-processings.tsx:60–98`) but **no rendered element ever invokes them** — unreachable inside this component. (The same mutations have live triggers on the `/data` item pages; chunk actions as user-facing functionality are owned by the Knowledge page doc.)

> Items 25–27 are inventoried because the brief assigns these files to this area; their *user-facing home* is the Knowledge page (`/data`). The disclosure ladder below places them explicitly so nothing is dropped between the two docs.

### UX review

| # | Severity | Issue | Evidence |
|---|---|---|---|
| 1 | **High** | **The platform has no home.** `/` blind-redirects to chat, so P2/P3/P4 have no landing surface; the role-composed dashboard promised by the ownership matrix (`design/personas.md:176–178`) does not exist. An admin's first screen after login is a chat composer. | `app/(application)/page.tsx:9` |
| 2 | **High** | **Double-redirect entry chain.** `/` → `/chat` → `/chat/[agent]` costs two sequential server redirects (plus an agents fetch) on *every* app entry for most users. Violates "Performance is a feature." | `page.tsx:9`, `chat/page.tsx:41,47` |
| 3 | **High** | **SummaryCard trend races its data (ASI bug).** `const isLoading = loading24h loading7d` — automatic semicolon insertion makes `isLoading` equal `loading24h` only; `loading7d` is a dead expression. The card renders a trend computed against an unloaded 7-day average (shows a wrong % or "No change" mid-load). | `components/dashboard/summary-cards.tsx:112–114` |
| 4 | **Med** | **Dark mode broken in DonutChart labels:** percentage labels are `fill="black"` — invisible/unreadable on dark backgrounds. Violates "both themes are first-class" (`philosophy.md` §4). | `donut-chart.tsx:92` |
| 5 | **Med** | **Off-token styling across the widget set:** Leaderboard hardcodes `from-blue-100/50 … dark:from-blue-900/20` bars and `text-slate-900 dark:text-slate-100` values; DashboardMainChart hardcodes `#2563eb`. None use the established CSS-variable palette. | `leaderboard.tsx:205,225`; `dashboard-main-chart.tsx:38–39,47,56` |
| 6 | **Med** | **Debug console noise in production paths** (5 `console.log("[EXULU] …")` calls render-side in Leaderboard). | `leaderboard.tsx:83,84,92,112,113` |
| 7 | **Med** | **Dead code shipped:** DashboardMainChart (no imports), `home.css` gradient class (no users), RecentProcessings' unreachable mutations. Bundle and maintenance cost with zero user value. | `dashboard-main-chart.tsx`; `home.css:1–26`; `recent-processings.tsx:60–98` |
| 8 | **Med** | **Anti-card cards / box-in-box:** Recent* widgets render `<Card className="border-0 rounded-none">` (a card that isn't a card) wrapping a `border rounded-lg` div wrapping a Table — three nested containers for one list. Violates philosophy anti-pattern #6. | `recent-embeddings.tsx:73,88`; `recent-processings.tsx:115,131` |
| 9 | **Med** | **Custom segmented control re-implements Tabs** with hardcoded `bg-white dark:bg-primary shadow-sm text-secondary` and no `aria-pressed`/roving focus — inconsistent with shadcn conventions and inaccessible. (Lives on `/analytics` but is part of the leaderboard widget composition this concept inherits.) | `app/(application)/analytics/components/dashboard.tsx:81–100` |
| 10 | **Low** | **Type-scale drift:** widget compositions use `text-4xl font-bold` page titles + `text-lg` subtitles + `text-2xl` section heads, vs. the PageHeader standard (`text-2xl` title) in `philosophy.md` §5. | `analytics/components/dashboard.tsx:45–50`; `data/components/contexts-dashboard.tsx:82–87` |
| 11 | **Low** | **Unconditional 10s polling** in Recent* widgets with no visibility/back-off handling — wasteful when tabbed away. | `recent-embeddings.tsx:40`; `recent-processings.tsx:42` |
| 12 | **Low** | **`h-screen` scroll trap:** widget-grid compositions use `flex-1 … h-screen` without `overflow-auto`; the sibling variant adds `overflow-auto` explicitly, showing the clipping was a real, half-fixed bug. | `analytics/components/dashboard.tsx:41`; `data/components/contexts-dashboard.tsx:78` vs `:168` |

### Mobile audit

The route itself cannot break at 390 px — it renders nothing. The audit therefore covers (a) the de facto landing and (b) the widget library a Home would be built from:

- **De facto landing (chat):** acceptable — chat is the P1 mobile-first surface. The "Select an agent" fallback (`chat/page.tsx:50–53`) uses `p-10` (80 px of horizontal padding total at 390 px) — cramped but functional.
- **DateRangeSelector:** trigger button is fixed `w-[260px]` (`date-range-selector.tsx:66`) — combined with a page title in a `justify-between` row (`analytics/components/dashboard.tsx:43–60`) it forces overflow at 390 px. The popover calendar renders `numberOfMonths={2}` (`date-range-selector.tsx:93`) — two months side by side cannot fit a 390 px viewport; no responsive variant exists anywhere in the file.
- **Widget grids:** `grid gap-4 md:grid-cols-2 lg:grid-cols-5` (`analytics/components/dashboard.tsx:68`) and `md:grid-cols-3` (`:102,152`) stack correctly to one column — fine.
- **TimeSeriesChart controls:** two fixed `w-[150px]` Selects right-aligned (`time-series-chart.tsx:85,100`) — 300 px + gaps consumes the whole row; no `sm:` handling.
- **`h-screen` without `overflow-auto`** (`analytics/components/dashboard.tsx:41`): on a short mobile viewport, content below the first viewport-height is unreachable where the parent doesn't scroll — the worst class of mobile failure per philosophy anti-pattern #9.
- **Leaderboard / Recent tables:** single-column internals, truncation via `truncate`/`TruncatedText` — OK at 390 px.
- **Hover-only affordances:** Recent* row links rely on `hover:` color/underline only (`recent-embeddings.tsx:106`) — no visual affordance at all on touch; links look like plain text.

**Verdict: minor** for the route as shipped (a redirect can't break), but every dashboard building block it would compose has at least one 390 px failure that the new design must fix.

---

## 2. Jobs to be done

This is the one legitimately multi-persona surface (`design/personas.md:176–178`). Jobs by persona, ranked by frequency:

**P2 — Power user (primary in practice).** Visits many times daily as the entry point to the build-test loop.
1. Re-enter yesterday's loop: jump back into the agent/session I was iterating on. *(daily, many×)*
2. Spot anomalies in *my* agents: failed runs, error spikes, weird usage. *(daily)*
3. Check knowledge pipeline health: did last night's embedding/processing jobs finish? *(weekly–daily)*
4. Jump to a build surface (Agents, Knowledge, Prompts). *(daily — but that's L0 navigation's job)*

**P1 — End user.** Their #1 job is "start/continue a conversation without thinking about agents" (`personas.md:24–28`). A dashboard *is friction* for them — they should never see one.

**P3 — Admin.** Visits deliberately/reactively (`personas.md:84–86`).
1. Headline check: is usage/spend normal? Any budget near its limit? *(weekly / on alert)*
2. Triage: anything failing that needs my action? *(on alert)*
3. Descend into Analytics / Budgets / Users for the deep dive. *(L2 click-through)*

**P4 — Developer.**
1. Did my eval runs pass? Any regression? *(per CI cycle)*
2. Grab the fast path to Explorer / token. *(L0 navigation's job)*

**Primary persona and #1 job in one sentence:** *P2, who arrives many times a day and needs to resume yesterday's build-test loop in one click while spotting at a glance whether anything they own is failing.*

**Ownership-matrix correction:** the matrix's "varies by role*" is right but under-specified, and its current implementation is wrong in one direction: today `/` serves *only* P1 (redirect to chat) and abandons P2/P3/P4. The correction this doc commits to: **for P1-only accounts, `/` keeps routing straight into Chat (their Exulu is a chat app — `personas.md:193–194`); for any account with elevated rights, `/` renders a role-composed Home whose L1 defaults to P2's job, with P3/P4 sections appearing strictly by RBAC.** "Varies by role" thus means *composed by role*, not *everything for everyone*.

---

## 3. Design concept

**Concept name: "Today" — a calm, role-composed home.** Three regions, assembled from RBAC-gated widget sections: **Resume** (get back to work), **Vitals** (is everything normal?), **Needs attention** (what's not?). Charts, leaderboards, and date-range exploration do *not* live here — they remain the L1 of `/analytics`; Home links into them. Healthy states are quiet; only problems earn color.

### Default view (L1)

**Routing rule (server component):** `serverSideAuthCheck()` → if `!user.super_admin` **and** every elevated right (`agents`, `workflows`, `evals`, `users`, `variables`, `api`, `budget_management` — `types/models/user-role.ts:4–10`) is `null`/absent → `redirect("/chat")` exactly as today (preserves inventory items 1, 4–7 for P1). Otherwise render Home. This also removes one hop of the redirect chain for elevated users.

**What an elevated user (P2 hat) sees on arrival, desktop 1440 px, inside PageShell (centered content page, `max-w-6xl`):**

1. **PageHeader** — title "Home" (`text-2xl`), one-line purpose `text-sm text-muted-foreground` ("Where you left off, and what needs you."), primary action right-aligned: **`New chat`** button (variant `default` — the page's single purple element). One per page, per `philosophy.md` §5.
2. **Region A — Resume** (`gap-4` under a `text-lg` "Pick up where you left off" group label): a horizontal row of up to 4 compact session cards from `GET_AGENT_SESSIONS` (limit 4, sorted by recency) — agent name (`text-sm font-medium`), session title truncated, relative timestamp (`text-xs text-muted-foreground`). One click resumes at `/chat/{agent}/{session}`. Empty state: single quiet line + "Start a conversation" ghost button (EmptyState primitive, compact variant).
3. **Region B — Vitals** (group label "Last 24 hours"): a 4-up row of **StatCard**s (the philosophy §5 primitive, extracted from SummaryCard): Sessions, Agent calls, Tokens, plus one role-dependent slot — Workflow runs (workflows ≥ write), Spend vs. budget (budget_management ≥ read), or Eval pass rate (evals ≥ read), priority in that order; super_admins get Workflow runs and the others move to Region C links. Each card: label (`text-sm font-medium text-muted-foreground`), value (`text-3xl font-bold`), muted trend caption (item 9's % vs 7-day average — trend stays *gray* unless the delta exceeds ±25%, then semantic color; "status is quiet until it isn't").
4. **Region C — Needs attention**: a single bordered list (AttentionList primitive, *not* nested cards) aggregating, per RBAC: failed workflow runs last 24h (workflows ≥ write; `GET_JOB_RESULTS_LIGHT` filtered to failed), failed/stuck knowledge processing or embedding items (any visible context — backend already scopes `GET_CONTEXTS`; reuses item 25/26 queries filtered to error states), failing eval runs (evals ≥ read; `GET_EVAL_RUNS`), budgets ≥ 80% consumed (budget_management ≥ read; `budgetsApi`). Each row: semantic dot (red/orange), one-line description, relative time, chevron → deep link to the owning object. When everything is healthy the region collapses to one muted line: "✓ All clear — nothing needs your attention." with a green-tinted check only.
5. **Footer links row** (`text-sm`, ghost links): "Open analytics →" (super_admin only, mirrors `analytics/page.tsx:10`), "Budgets →", "Evals →" — per RBAC. No widgets, just paths down.

Whitespace per CLAUDE.md scale: `gap-8` between regions, `gap-4` within; page padding `p-8` desktop / `p-4` mobile. No card nesting deeper than one level; Regions A/B use cards, Region C is one bordered list.

### Disclosure ladder

Every inventory item mapped. "Moves to" notes relocation, never deletion.

| # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | `/` → `/chat` redirect | L0 | Kept for P1-only accounts (routing rule above); elevated accounts get Home instead |
| 2 | Auth gate + `?destination=` | L0 | Unchanged (`layout.tsx:32–33`) |
| 3 | `.gradient` CSS class | — | Unreachable dead code (no usage sites); deleted with the rewrite — not a user-facing capability, nothing relocated |
| 4 | Zero-agents alert | L1 (on `/chat`) | Unchanged; for elevated users Home's Resume region shows its EmptyState instead |
| 5 | Single-agent auto-redirect | L0 | Unchanged on `/chat`; P1-only `/` entry still flows through it |
| 6 | Default-agent auto-redirect | L0 | Unchanged on `/chat` |
| 7 | Agent-selection fallback | L1 (on `/chat`) | Unchanged; also reachable from Home via "New chat" primary action |
| 8 | 24h totals | **L1** | Region B StatCards (Sessions / Agent calls / Tokens / role slot) |
| 9 | Trend vs 7-day avg | **L1** (muted) | StatCard caption; semantic color only past ±25% threshold; full comparison detail at L2 tooltip on hover/focus |
| 10 | SummaryCard skeleton | L1 | StatCard skeleton state, layout-mirroring per `philosophy.md` §6 |
| 11 | Date-range popover calendar | **L2 → on `/analytics`** | Stays the L1 toolbar of `/analytics` (its owning page); Home links there ("Open analytics →"). Not on Home — Home is fixed to "now / last 24h / last 7d" |
| 12 | Max-range validation + toast | L2 (on `/analytics`) | Unchanged behavior wherever DateRangeSelector renders |
| 13 | Disabled-days window + footnote | L2 (on `/analytics`) | Unchanged |
| 14 | Time-series type selector | L2 (on `/analytics`) | Unchanged; Region B StatCards deep-link to `/analytics` pre-filtered to the matching `STATISTICS_TYPE` via query param |
| 15 | Unit selector (tokens/count) | L2 (on `/analytics`) | Unchanged |
| 16 | Area chart w/ gap filling | L2 (on `/analytics`) | Unchanged (ChartCard primitive adoption per analytics page doc) |
| 17 | Chart loading/error/empty | L2 (on `/analytics`) | Unchanged |
| 18 | Donut group-by selector | L2 (on `/analytics`) | Unchanged |
| 19 | Donut slices/palette/labels | L2 (on `/analytics`) | Unchanged, with the dark-mode label fix (UX review #4) |
| 20 | Donut loading/error/empty | L2 (on `/analytics`) | Unchanged |
| 21 | Leaderboard top-N + bars | L2 (on `/analytics`) | Unchanged; reachable from Home footer link |
| 22 | Leaderboard name hydration | L2 (on `/analytics`) | Unchanged (minus console noise) |
| 23 | Leaderboard top-3 captions/states | L2 (on `/analytics`) | Unchanged |
| 24 | DashboardMainChart | — | Unreachable dead code (zero import sites); deleted — no user-facing capability exists to relocate |
| 25 | Recent embeddings table | **L2** (on `/data` context detail, unchanged) + its *error subset* surfaces at **L1 Home** Region C ("N items failed embedding in {context}") | `data/components/embeddings.tsx:356` stays the canonical mount; Home row deep-links to it |
| 26 | Recent processings table | **L2** (on `/data`, unchanged) + error subset at **L1 Home** Region C | Same pattern as 25 |
| 27 | Unreachable chunk mutations in RecentProcessings | — | Dead in this component; the live chunk generate/delete actions on `/data` item pages are owned (and ladder-mapped) by the Knowledge page doc — no capability lost |

### Layout & components

```
PageShell (centered, max-w-6xl, p-8 / p-4 mobile, vertical rhythm gap-8)
└─ PageHeader            title="Home" (text-2xl) · purpose line · Button default "New chat"
└─ section Resume        h3 text-lg "Pick up where you left off"
   └─ div grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
      └─ Card (one level, hover:border-primary/40 transition 150ms) × ≤4
         · CardContent p-4: agent name text-sm font-medium · title truncate · text-xs muted timestamp
   └─ EmptyState (compact): MessageCircle icon · 1 sentence · ghost "Start a conversation"
└─ section Vitals        h3 text-lg "Last 24 hours"
   └─ div grid grid-cols-2 lg:grid-cols-4 gap-4
      └─ StatCard × 4 (NEW shared primitive, extracted from summary-cards.tsx with the
         isLoading fix; props: label, value, trend?, href?, skeleton)
└─ section Attention     h3 text-lg "Needs attention" + count Badge (destructive) when >0
   └─ AttentionList (NEW shared primitive): single border rounded-lg divide-y list
      · row: status dot (bg-destructive / warning orange) · text-sm description ·
        text-xs muted relative time · ChevronRight; row is a full-surface <Link>
      · all-clear state: single row, muted, green check icon
└─ footer nav row        ghost link Buttons text-sm, RBAC-gated, gap-2
```

- **shadcn:** `Card`, `Button` (default/ghost), `Badge` (destructive count), `Skeleton`, `Tooltip` (StatCard trend detail at L2), `Separator` only if a theme demands it — prefer whitespace per `philosophy.md` §4.
- **Shared primitives from philosophy §5:** PageShell, PageHeader, EmptyState, StatCard. **StatCard does not yet exist as code** — it is extracted from `summary-cards.tsx` and becomes the canonical implementation for `/analytics` too (single source, fixes UX #3 once).
- **NEW primitives to propose for §5:** `AttentionList` (cross-domain status feed — reusable on `/budgets` and `/evals` for their own alert strips) and `WidgetSection` (thin wrapper: group label + RBAC predicate + error-isolated boundary so one failing query never blanks the page — pattern already proven by `ChartErrorBoundary` in `main-nav.tsx:~80`).
- **Type/spacing per CLAUDE.md:** page title `text-2xl` (PageHeader standard overrides the legacy `text-4xl` compositions), group labels `text-lg`, stat values `text-3xl font-bold`, metadata `text-xs`; spacing steps 4/6/8 only.
- **Color:** one purple element ("New chat"); semantic red/orange confined to Region C and the >±25% trend case; everything else neutral. Both themes verified — no literal colors permitted in the new components (fixes UX #4/#5 by construction).
- **RBAC gates, explicit:** Resume — all elevated users; Vitals base cards — all elevated users; Workflow runs card + failed-runs rows — `super_admin || role.workflows === "write"` (mirrors `main-nav.tsx:145`); Eval card + failing-eval rows — `super_admin || role.evals ∈ {read, write}` (`main-nav.tsx:153`); Budget card + budget rows — `super_admin || role.budget_management ∈ {read, write}` (`main-nav.tsx:244–248`); knowledge-failure rows — no extra gate, backend-scoped via `GET_CONTEXTS`; "Open analytics →" — `super_admin` only (`analytics/page.tsx:10`).

### Mobile behavior

Persona mobile jobs (`personas.md:39, 72, 104, 134`): P1 never sees this page on mobile (redirect to chat — their flawless surface). For elevated hats the mobile job is **monitor and react**, so:

- **< 640 px (390 px target):** single column, `p-4`. **Region order changes: Needs attention first** (the admin/power-user mobile job is triage), then Resume (vertical list, max 3, full-width rows — tap targets ≥ 44 px), then Vitals as a `grid-cols-2` 2×2. PageHeader stacks: title row, then full-width "New chat" button. Attention rows are full-row links (no hover dependency — fixes the hover-only affordance class of bug). No fixed widths anywhere; no element wider than `100%`.
- **640–1024 px:** two-column: Vitals 2×2 left of Resume? No — keep vertical stacking with Vitals `grid-cols-4` at `md` if it fits, else 2×2; Attention returns below Resume (desktop order resumes at `md`).
- **≥ 1024 px:** the L1 desktop layout above.
- **Scrolling:** PageShell owns `overflow-y-auto`; **no `h-screen` on content** (fixes UX #12 by construction).
- StatCard L2 trend detail uses `Tooltip` on desktop, tap-to-toggle `Popover` on touch.
- Charts/date-range never render on Home, so the `w-[260px]` / `numberOfMonths={2}` mobile failures are scoped to the `/analytics` doc to fix.

### Motion

Few and purposeful, per CLAUDE.md timings and `prefers-reduced-motion` respected throughout:

1. **Section entrance:** regions fade-up 8 px, 200 ms `ease-in-out`, 50 ms stagger A→B→C — explains page hierarchy on arrival; runs once, skipped on reduced motion.
2. **Skeleton → content crossfade:** 200 ms per widget, layout-mirroring skeletons (no spinner walls, `philosophy.md` §6).
3. **Hover/focus on resume cards and attention rows:** border/background transition 150 ms; focus uses the standard ring-offset pattern.
4. **Attention count badge:** when the count increases while mounted, a single 300 ms scale pulse (1 → 1.06 → 1) — causality cue, never looping.

Nothing else animates. No count-up numbers, no chart draw-in on Home (decorative).

---

## 4. Implementation notes

**Files to change**
- `app/(application)/page.tsx` — rewrite as **server** component: auth + rights check, P1-only → `redirect("/chat")`, else render `<HomeDashboard user={user} />`. Drop `"use client"`, drop `./home.css` import.
- `app/(application)/home.css` — delete (orphaned; only importer is the page being rewritten).
- `components/custom/dashboard-main-chart.tsx` — delete (zero import sites; unreachable code, not functionality).
- `components/dashboard/summary-cards.tsx` — fix the `isLoading` ASI bug (`:112–114`) immediately regardless of the rest; then supersede with StatCard.
- `components/dashboard/leaderboard.tsx` — remove `console.log`s (`:83,84,92,112,113`) and re-token colors (`:205,225`) — benefits `/analytics` directly.
- `components/dashboard/donut-chart.tsx` — label fill `black` → `hsl(var(--foreground))` or contrast-computed (`:92`).

**Files to create**
- `components/home/home-dashboard.tsx` — page composition + RBAC predicates (reuse the right checks exactly as written in `main-nav.tsx:145–254` so nav and home never disagree; consider extracting a shared `lib/rights.ts`).
- `components/home/resume-sessions.tsx` — `GET_AGENT_SESSIONS` (queries/queries.ts:217), limit 4.
- `components/home/vitals.tsx` — composes StatCard with `GET_AGENT_SESSIONS_STATISTICS` (:1800), `GET_AGENT_RUN_STATISTICS` (:1847), `GET_TOKEN_USAGE_STATISTICS` (:1860), `GET_WORKFLOW_RUNS_STATISTICS` (:1811), eval/budget sources below.
- `components/home/attention-list.tsx` — failed jobs via `GET_JOB_RESULTS_LIGHT` (:604), failing evals via `GET_EVAL_RUNS` (:2275), budgets via `budgetsApi` (util/api.ts:552), knowledge failures via `GET_CONTEXTS` (:264) + per-context error-filtered `GET_ITEMS`.
- **Shared primitives (NEW, flag for philosophy §5 and `design/codebase-structure.md`):** `components/shared/stat-card.tsx` (extracted from summary-cards — *already named in §5*), `components/shared/attention-list.tsx` and `components/shared/widget-section.tsx` (**genuinely new — propose adding both to philosophy §5**). PageShell/PageHeader/EmptyState are assumed delivered by the shell workstream; if not yet available, build Home against local stubs matching their spec.

**Scope: M** (≈3–5 engineering days): one new composed page, three new widgets, one primitive extraction + two new primitives, two deletions, three small fixes. No backend changes strictly required (all queries exist), though a single aggregated "attention" endpoint would cut request count.

**Dependencies**
- `design/navigation.md` shell: Home must appear as the first L0 sidebar item for elevated roles (today no "Home"/"Dashboard" nav item exists — `main-nav.tsx:104–257`); P1-only roles get no Home item (their `/` is chat).
- `/analytics` page doc: owns DateRangeSelector/TimeSeriesChart/DonutChart/Leaderboard fixes and the `?type=` deep-link param Home's StatCards target; `/data` doc owns Recent* widgets' canonical home and chunk actions; `/evals` and `/budgets` docs may adopt AttentionList.
- Rights model: if new `UserRole` fields appear (e.g. a future `knowledge` right), the Home RBAC predicate must follow `main-nav.tsx` in lockstep — hence the shared `lib/rights.ts` recommendation.

**Risks**
- **Fan-out queries:** Region C issues up to 4+N requests (N = visible contexts). Mitigate: parallel fire on mount, per-section skeletons, `WidgetSection` error isolation, cap context checks at the 5 most recently updated, 60 s poll instead of the legacy 10 s.
- **"Failed" semantics:** eval/job/embedding failure filters depend on backend status enums (`JOB_STATUS`, eval run status); verify exact values before building filters — wrong enums silently produce a fake "All clear".
- **Redirect behavior change:** elevated users currently land in chat muscle-memory; communicate via release note. P1 behavior is bit-identical, so zero risk for the largest population.
- **Empty platform (day-one admin):** all regions empty → Home must not be a wall of empty states; if Resume is empty *and* Vitals are all zero, show one consolidated onboarding EmptyState ("Create your first agent") instead of three hollow sections.
