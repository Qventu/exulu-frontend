# Analytics — Review & Design Concept
**Routes:** `/analytics`  **Primary persona:** P3 (Admin)  **Secondary:** P2 (own-agent usage — currently locked out, see §2)  **Current state:** A functioning but incoherent stats grid — five fixed 24h cards a date picker doesn't affect, three top-4 "top 10" leaderboards, a trend chart that silently truncates and lies when set to Tokens, and a donut remotely controlled by a toggle two sections away; unusable at 390 px.

---

## 1. Current state

The route is two files: a 13-line server gate (`app/(application)/analytics/page.tsx`) and one client composition (`app/(application)/analytics/components/dashboard.tsx`, 195 lines) that assembles the shared widget library in `components/dashboard/` (`summary-cards.tsx`, `date-range-selector.tsx`, `time-series-chart.tsx`, `donut-chart.tsx`, `leaderboard.tsx`). The brief also assigns `components/custom/date-range-picker.tsx` — an orphaned second range-picker implementation with zero import sites (verified by repo-wide grep). Note: `design/pages/dashboard.md` inventories the same widget library as Home building blocks and explicitly delegates ownership of the `/analytics` composition and all widget fixes to this document (`dashboard.md` §4 "Dependencies").

### Functionality inventory

**A. Access & arrival**

1. **Server-side RBAC gate — super_admin only.** `serverSideAuthCheck()`; any non-super_admin (or unauthenticated) request is redirected to `/chat` (`analytics/page.tsx:9–10`), with `dynamic = "force-dynamic"` (`page.tsx:5`). No role-based partial access exists.
2. **Sidebar nav entry** "Analytics" / de "Analytik" (`BarChart4` icon) in the bottom navigation group, rendered only for `user.super_admin` (`components/custom/main-nav.tsx:194–200`).
3. **Page header:** title `t('dashboard.title')` "Analytics Dashboard" at `text-4xl font-bold`, subtitle "Monitor your AI workflows and performance metrics." at `text-lg` (`dashboard.tsx:43–51`); both localized en/de (`messages/en.json` `dashboard.title/subtitle`, parity confirmed in `de.json`).

**B. Global date range**

4. **Range state, default last 14 days** (`subDays(new Date(), 14)` → today) (`dashboard.tsx:30–33`).
5. **Popover range calendar, two months side by side** (`numberOfMonths={2}`), opens from the header (`components/dashboard/date-range-selector.tsx:60–94`, months at `:93`).
6. **Trigger label** formatted `LLL dd, y – LLL dd, y`, single-date intermediate state, "Pick a date range" placeholder, `CalendarIcon`, fixed `w-[260px]` outline button (`date-range-selector.tsx:62–83`).
7. **Max-range validation:** ranges > `maxDays` (set to 30 on this page, `dashboard.tsx:58`) are rejected with a destructive toast "Date range too large / Please select a date range of 30 days or less." (`date-range-selector.tsx:28–42`).
8. **Dynamic disabled days:** once a start date is chosen, days outside ±30 days are disabled in the calendar (`date-range-selector.tsx:44–56`, applied at `:92`).
9. **"Maximum range: 30 days" footnote** inside the popover (`date-range-selector.tsx:95–97`).
10. **Range scoping:** the selected range drives the three leaderboards (with a hard fallback to last-14-days when unset, `dashboard.tsx:107–110, 120–123, 134–138`) and both charts (`:155, :184`); it deliberately does **not** affect the Summary cards, which query fixed windows (item 16).

**C. Summary section — five KPI cards** (`dashboard.tsx:64–75`, grid `md:grid-cols-2 lg:grid-cols-5` at `:68`; section heading "Summary" `text-2xl` at `:66`)

11. **Agent Sessions (24h)** — `agent_sessionsStatistics` filtered on `createdAt` (`dashboard.tsx:69`; `queries/queries.ts:1800–1809`).
12. **Agent Calls (24h)** — `trackingStatistics` `type: AGENT_RUN`, `name: "count"`, `limit: 10` (`dashboard.tsx:70`; `queries.ts:1847–1858`).
13. **Token Usage (24h)** — `trackingStatistics` `name in ["inputTokens","outputTokens"]` (`dashboard.tsx:71`; `queries.ts:1860–1871`).
14. **Workflow Runs (24h)** — `jobsStatistics` `type: "workflow"` (`dashboard.tsx:72`; `queries.ts:1811–1821`).
15. **Function Calls (24h)** — `trackingStatistics` `type: TOOL_CALL` (`dashboard.tsx:73`; `queries.ts:1835–1845`).
16. **Card computation:** two parallel queries per card — last 24h and last 7 days (dates memoized once per mount, `summary-cards.tsx:81–88, 91–98`); value = sum of all group counts (`:102–107`); comparison = 7-day total ÷ 7 (`:110`).
17. **Trend display:** % change vs the 7-day daily average, `TrendingUp`/`TrendingDown`/`Minus` icon in a tinted circle, semantic green/red/neutral coloring, caption "x% increase/decrease" + "vs 7-day avg: N", localized number formatting (`summary-cards.tsx:38–65`).
18. **Card loading skeleton** mirroring the layout (`summary-cards.tsx:17–36`); title gets a hardcoded English " (24h)" suffix (`:118`).

**D. Leaderboards section** (`dashboard.tsx:77–144`; heading "Leaderboards" `text-2xl` at `:80`)

19. **Count / Tokens segmented toggle** — two hand-rolled buttons in a pill (`dashboard.tsx:81–100`) that switch the metric of all three leaderboards (names filter `["count"]` vs `["inputTokens","outputTokens"]`, `:113, :127, :141`) **and** silently set the Distribution donut's unit (`:187`).
20. **Top Users leaderboard** — `trackingStatistics groupBy: "user"`, `type: AGENT_RUN`, `limit: 4` (`queries.ts:1891–1907`), hydrated to display names via `GET_USERS_BY_IDS` / field `userByIds` (`queries.ts:1608`; `dashboard.tsx:103–116`).
21. **Top Projects leaderboard** — `groupBy: "project"`, `limit: 4` (`queries.ts:1908–1924`), hydrated via `GET_PROJECTS_BY_IDS` / `projectByIds` (`queries.ts:2027–2033`; `dashboard.tsx:117–130`).
22. **Top Agents leaderboard** — `groupBy: "label"`, `limit: 4`, no hydration (labels are agent names) (`queries.ts:1925–1941`; `dashboard.tsx:131–142`).
23. **Ranked-row rendering:** filter empty groups, sort desc, slice to `maxEntries` (prop, default 10, `leaderboard.tsx:40, 94–101`); each row has a proportional progress-bar background scaled to rank 1 (`:181, :196, :204–207`), truncated name with native `title` tooltip (`:213`), localized value + value label "calls"/"tokens" (`:225–230`).
24. **ID→name hydration mechanics:** IDs extracted from top entries (`leaderboard.tsx:74–81`), secondary query skipped when not needed (`:87–90`), number/string id matching (`:114–118`), display-name fallback chain email → firstname+lastname → name → raw id (`:122–127`).
25. **Top-3 captions** "Top performer" / "Runner up" / "Third place" (`leaderboard.tsx:216–220`).
26. **Dynamic per-toggle subtitles and value labels** ("Most active users by agent calls" vs "…by token usage", etc.) (`dashboard.tsx:105, 112, 119, 126, 133, 140`; i18n keys `dashboard.leaderboards.*`).
27. **Leaderboard loading skeleton (5 rows) and empty state** with configurable `emptyMessage` (default "No data available.") (`leaderboard.tsx:39, 141–179`).

**E. Time Series section** (`dashboard.tsx:146–176`; heading "Time Series Analytics" `text-2xl` at `:150`; bordered panel `md:col-span-2 p-6` at `:153`)

28. **Section composition:** 2/3-width trend panel + 1/3-width donut panel in a `md:grid-cols-3` grid (`dashboard.tsx:152`).
29. **Event-type Select** over all nine `STATISTICS_TYPE`s — CONTEXT_RETRIEVE, SOURCE_UPDATE, EMBEDDER_UPSERT, EMBEDDER_GENERATE, EMBEDDER_DELETE, WORKFLOW_RUN, CONTEXT_UPSERT, TOOL_CALL, AGENT_RUN (`dashboard.tsx:164–174`; `types/enums/statistics.ts:1–13`) — with enum→Title Case prettifying (`time-series-chart.tsx:24–29, 85–98`); default `AGENT_RUN` (`dashboard.tsx:35`). The same selection also drives the donut (item 35).
30. **Unit Select** tokens/count, rendered only when more than one option is supplied (`time-series-chart.tsx:99–114`; options from `dashboard.tsx:160–163`); default "count" (`:36`).
31. **Trend query:** `GET_TIME_SERIES_STATISTICS` — `trackingStatistics groupBy: "createdAt"`, `limit: 12`, filters type + createdAt range + `name in $names` where `names = [unit]` (`queries.ts:1874–1890`; variables at `time-series-chart.tsx:40–46`); skipped until both range ends exist (`:47`).
32. **Zero-filled day series:** epoch-ms group values parsed to days, `eachDayOfInterval` generates every day in range, missing days filled with 0 (`time-series-chart.tsx:50–79`).
33. **Area chart rendering:** gradient stroke/fill (muted-foreground based), dashed horizontal grid, styled axes, dots + activeDot, tooltip with full formatted date and localized values, legend with prettified series name (`time-series-chart.tsx:132–217`).
34. **Trend chart states:** full-panel skeleton, inline red error with raw `error.message`, "No data available for the selected date range and type" empty text (`time-series-chart.tsx:119–130`).

**F. Distribution donut** (`dashboard.tsx:177–190`; bordered panel `p-6` at `:177`)

35. **"Distribution" panel** (`text-xl` heading, `donut-chart.tsx:107`) showing the share breakdown of the **same** `selectedType` as the trend chart (`dashboard.tsx:185`).
36. **Group-by Select:** Label / User / Role (`dashboard.tsx:179–183`; localized option labels), default `"label"` (`:37`), rendered in the panel header (`donut-chart.tsx:106–123`).
37. **Unit follows the Leaderboards toggle** (item 19): `names: ["inputTokens","outputTokens"]` for tokens, `["count"]` otherwise (`dashboard.tsx:187`; `donut-chart.tsx:53`).
38. **Donut query:** `GET_DONUT_STATISTICS` — `trackingStatistics` with variable `groupBy`, `limit: 10`, type + range + names filters (`queries.ts:1959–1975`); skipped until full range (`donut-chart.tsx:55`).
39. **Donut rendering:** slices sorted desc, palette `--chart-1`…`--chart-10` (`donut-chart.tsx:22–33`), per-slice radial gradients (`:142–163`), ring `innerRadius 45% / outerRadius 75%` (`:170–171`), percentage labels suppressed under 5% (`:81`), group values prettified (`:35–44`), tooltip with localized values (`:182–193`). No legend is rendered (`ChartLegend` imported at `:10`, unused).
40. **Donut states:** skeleton, inline red error with raw message, "No data available for the selected date range, type, and grouping." (`donut-chart.tsx:126–138`).

**G. Orphaned sibling (assigned to this area)**

41. **`CalendarDateRangePicker`** (`components/custom/date-range-picker.tsx:16–100`) — a second, unused range-picker implementation: default last 365 days (`:22–28`), no max-range validation, two-month calendar (`:81`), fixed `w-[260px]` trigger (`:49`), untyped `any` props (`:21`), and a "Reset date" secondary button that appears after any change (`:32–38, 86–97`). **Zero import sites anywhere in the repo** (verified by grep for the component and its module path).

### UX review

| # | Severity | Issue | Evidence |
|---|---|---|---|
| 1 | **High** | **The Tokens trend is fiction.** The unit Select passes `names: [unit]` → `["tokens"]`, but tracking rows are named `count` / `inputTokens` / `outputTokens` everywhere else in the app (`queries.ts:1865`; `donut-chart.tsx:53`; `dashboard.tsx:113`). `name in ["tokens"]` matches nothing, and the zero-fill (item 32) then renders a confident flatline of zeros as if it were real data. Trust-destroying for the persona whose job is cost oversight. | `time-series-chart.tsx:45` vs `donut-chart.tsx:53` |
| 2 | **High** | **Silent truncation in the trend query.** `GET_TIME_SERIES_STATISTICS` has `limit: 12` while grouping by day and allowing 30-day ranges — up to 19 day-groups are dropped, and the zero-fill disguises the loss as "no activity on those days." Charts must be honest or absent. | `queries.ts:1879`; `time-series-chart.tsx:68–78`; `date-range-selector` maxDays=30 via `dashboard.tsx:58` |
| 3 | **High** | **SummaryCard trend races its data (ASI bug).** `const isLoading = loading24h loading7d` — automatic semicolon insertion makes `isLoading === loading24h`; `loading7d` is a dead expression. Cards render a % trend against a 7-day average that hasn't loaded (flashing wrong trends / "No change"). Also flagged in `dashboard.md` UX#3; the fix is owned here. | `summary-cards.tsx:112–114` |
| 4 | **High** | **Hidden cross-section coupling.** The Leaderboards' Count/Tokens toggle silently changes the Distribution donut's unit two sections away (`dashboard.tsx:187`), while the trend chart has its own independent unit Select (`:159`) and the donut shares the trend's type select (`:185`). Three controls, three different scopes, zero visible relationships — a spike investigation becomes a guessing game. | `dashboard.tsx:38, 159, 185, 187` |
| 5 | **High** | **Scroll trap.** Root wrapper is `flex-1 flex flex-col p-8 pt-6 h-screen` with no `overflow-auto`; content (5 cards + 3 leaderboards + 2 charts) far exceeds one viewport. The `/data` sibling composition adds `overflow-auto` explicitly, showing the clipping was a real, half-fixed bug. | `dashboard.tsx:41`; cf. `data/components/contexts-dashboard.tsx:168` |
| 6 | **Med** | **Five of ten donut colors don't exist.** `CHART_COLORS` references `--chart-6`…`--chart-10`, but only `--chart-1`…`--chart-5` are defined in either theme → slices 6–10 get `hsl()` of an empty value (invalid → transparent/black). | `donut-chart.tsx:28–32`; `app/globals.css:54–58, 104–108` |
| 7 | **Med** | **Dark mode broken in donut labels:** percentage labels are `fill="black"` — illegible on dark backgrounds. Violates "both themes are first-class" (`philosophy.md` §4). | `donut-chart.tsx:92` |
| 8 | **Med** | **"Top 10" leaderboards are top-4.** The component design (progress bars, `maxEntries = 10`) implies a top-10 list, but all three queries hard-cap at `limit: 4`. Subtitles say "Most active users" with no hint of the cap. | `queries.ts:1895, 1912, 1929`; `leaderboard.tsx:40` |
| 9 | **Med** | **Summary cards ignore the page's date range.** The header range control reads as page-wide scope, but the first section is fixed 24h-vs-7d (`summary-cards.tsx:81–98`) — the "(24h)" qualifier only appears inside each card title. Two mental models on one page. | `dashboard.tsx:55–75`; `summary-cards.tsx:118` |
| 10 | **Med** | **Untranslated hardcoded strings across the widget set** despite en/de i18n: "Distribution", "Group by", "Pick a date range", "Maximum range: N days", the range-too-large toast, "Top performer/Runner up/Third place", "No data available…", both chart error/empty messages, "(24h)", "No change/increase/decrease", "vs 7-day avg". | `donut-chart.tsx:107, 112, 137`; `date-range-selector.tsx:34–36, 81, 96`; `leaderboard.tsx:39, 218`; `time-series-chart.tsx:88, 103, 125, 129`; `summary-cards.tsx:59–63, 118` |
| 11 | **Med** | **Hand-rolled segmented control re-implements Tabs** with hardcoded `bg-white dark:bg-primary shadow-sm text-secondary`, no `aria-pressed`/`role`, no keyboard semantics. Off-system and inaccessible. | `dashboard.tsx:81–100` |
| 12 | **Med** | **Hover-only slice identification.** The donut renders no legend (import unused) and labels only show percentages — on any device the only way to learn *which* slice is which is the hover tooltip; on touch it's impossible. | `donut-chart.tsx:10, 80–102, 182–193` |
| 13 | **Med** | **Render-path debug noise:** five `console.log("[EXULU] …")` calls fire on every Leaderboard render, including inside the hydration `find` callback (O(n·m) logging). | `leaderboard.tsx:83–84, 92, 112–113` |
| 14 | **Med** | **Off-token colors:** leaderboard bars hardcode `from-blue-100/50 … dark:from-blue-900/20` and values `text-slate-900 dark:text-slate-100`; trend chart hardcodes everything to `muted-foreground` gray instead of the chart palette; error text uses raw `text-red-500` instead of `text-destructive`. | `leaderboard.tsx:205, 225`; `time-series-chart.tsx:34, 124, 138–162`; `donut-chart.tsx:132` |
| 15 | **Low** | **Type-scale drift:** `text-4xl` page title + `text-lg` subtitle + `text-2xl` section heads vs the PageHeader standard (`text-2xl` title) in `philosophy.md` §5 / CLAUDE.md hierarchy. | `dashboard.tsx:45–50, 66, 80, 150` |
| 16 | **Low** | **Duplicate GraphQL operation name:** both `GET_AGENT_RUN_STATISTICS` and `GET_TOKEN_USAGE_STATISTICS` declare `query AgentCallsStatistics` — confuses devtools, persisted-query tooling, and server logs. | `queries.ts:1848, 1861` |
| 17 | **Low** | **React key collision risk:** leaderboard rows key on the *hydrated display name* (`key={entry.name}`); two users with identical names (or two unnamed groups) collide. | `leaderboard.tsx:200` |
| 18 | **Low** | **Raw error exposure without recourse:** chart errors print `error.message` verbatim with no retry and no plain-language summary (philosophy §8: plain language first, raw detail one level deeper). | `time-series-chart.tsx:124–125`; `donut-chart.tsx:132–133` |
| 19 | **Low** | **Dead duplicate range picker** (inventory #41): two implementations of one job (anti-pattern #4 "five ways to do the same thing"), one of them unreachable. | `components/custom/date-range-picker.tsx` |
| 20 | **Low** | **No spend view.** The page reports tokens but never cost; P3's stated job is "usage, **cost**, adoption, errors" (`personas.md:94`). Cost lives only on `/budgets` with no cross-link from here. | whole page; `personas.md:94` |

### Mobile audit

At 390 px the page is **broken**, not merely cramped:

- **Header overflow:** `flex items-center justify-between` with a `text-4xl` title block and a fixed `w-[260px]` trigger (`dashboard.tsx:43–60`; `date-range-selector.tsx:66`) — no wrap, no `sm:` variants → horizontal overflow on the very first row.
- **Two-month calendar:** the popover renders `numberOfMonths={2}` (~560 px+) with no responsive variant (`date-range-selector.tsx:93`) — the range picker, the page's central control, cannot be operated on a phone.
- **Scroll trap is fatal on mobile:** `h-screen` without `overflow-auto` (`dashboard.tsx:41`) — everything below the first viewport is unreachable where the parent doesn't scroll (anti-pattern #9).
- **Padding burn:** `p-8` (`dashboard.tsx:41`) costs 64 px of the 390; content gets 326 px; no `p-4` mobile step.
- **Trend-chart toolbar overflow:** two fixed `w-[150px]` Selects + `gap-2` (~308 px) inside a `p-6` panel leaves 278 px of content width → guaranteed overflow (`time-series-chart.tsx:85, 100`; panel `dashboard.tsx:153`).
- **Leaderboards header:** `text-2xl` "Leaderboards"/"Bestenlisten" + the two-button pill in a no-wrap `justify-between` row (`dashboard.tsx:79–100`) — overflows in German.
- **Grids stack correctly:** `md:grid-cols-2 lg:grid-cols-5` and `md:grid-cols-3` (`dashboard.tsx:68, 102, 152`) fall back to one column — fine.
- **Touch affordances:** donut slices identifiable only via hover tooltip (UX#12); leaderboard rows are non-interactive so their hover shadow is harmless.
- **Chart height fragility:** `ChartContainer className="h-full"` inside auto-height stacked panels relies on the `aspect-video` default class (`components/ui/chart.tsx:55`) to avoid collapsing — works, but only by accident.

**Verdict: broken** — the P3 mobile job ("read analytics headlines", `personas.md:104`) fails at the first row.

---

## 2. Jobs to be done

**P3 — Admin (primary owner).** Visits weekly or reactively (`personas.md:84–86`); job 5 is "Watch platform analytics: usage, cost, adoption, errors" (`personas.md:94`). Ranked:
1. **Headline check** — "is usage normal this period?" Totals + trend at a glance. *(weekly / on alert — the #1 job)*
2. **Investigate a spike** — a budget alert or cost surprise fired; which agent / user / project / event type drove it, over which days? *(reactive, high-stakes)*
3. **Adoption reporting** — who and which teams/projects actually use the platform; trend over the month. *(monthly)*
4. **Token-pressure scouting** — where tokens go, feeding decisions made on `/budgets` and `/models`. *(weekly)*

**P2 — Power user (secondary).** Job 7 is "watch usage/quality signals for *their* agents" (`personas.md:64`). Today they cannot: both the nav item and the route are super_admin-gated (inventory #1–2).

**P4 — Developer.** No job here beyond curiosity; eval analytics live on `/evals`. Not a stakeholder.

**Primary persona and #1 job in one sentence:** *P3, who opens Analytics weekly or on an alert and must answer "is usage normal, and if not, who or what caused it?" within one screen.*

**Ownership matrix check:** the matrix (`personas.md:168`) lists P3 primary / P2 secondary ("own agents") — **correct in intent, contradicted by the implementation**: the super_admin-only gate (`analytics/page.tsx:10`, `main-nav.tsx:194`) locks P2 out entirely, so the secondary persona is currently served at no level at all. This redesign keeps P3 as primary and the existing gate as-is (widening access requires a backend rights change — no `analytics` field exists on roles, `lib/server-side-auth-check.ts:43–53`), but specifies the page so an agent-scoped P2 view can be added behind a future `role.analytics` right without relayout (see §4 Dependencies). The matrix stands; the gap is recorded.

---

## 3. Design concept

**Concept name: "Usage" — one lens, three questions.** The page answers P3's three questions top-to-bottom: **How much?** (KPI strip) → **Trending how?** (trend chart) → **Driven by whom/what?** (breakdown). One date range scopes *everything*. One explicit **lens** (event type + Count/Tokens measure) scopes the explore region, replacing today's three scattered, secretly-coupled controls. Charts become honest (truncation and the tokens-name bug fixed). Everything stays; the three side-by-side leaderboards and the donut consolidate into one Breakdown card with dimension tabs and a List/Share view toggle.

### Default view (L1)

Desktop 1440 px, inside **PageShell** (centered content page, `max-w-7xl`, `p-8`, vertical rhythm `gap-8`, shell owns `overflow-y-auto` — no `h-screen` anywhere):

1. **PageHeader** — title "Analytics" (`text-2xl`, i18n key reuse `dashboard.title` shortened), purpose line `text-sm text-muted-foreground` ("Usage across agents, users, and projects."), and on the right the page's defining control: the **RangePicker** — a segmented preset control `24h · 7d · 14d · 30d · Custom` (active segment is the page's purple accent; default **14d**, preserving today's default). "Custom" opens the existing popover calendar (validation, disabled-days window, and 30-day footnote intact; one month on mobile, two on `md+`).
2. **Region A — KPI strip** (no section heading needed; the cards are self-labeling): five **StatCard**s — Sessions, Agent calls, Tokens, Workflow runs, Tool calls — now bound to the **selected range** (value = range total; muted `text-xs` caption = trend vs the previous equal-length period, semantic color only beyond ±25% per "status is quiet until it isn't"). On the 24h preset this *is* today's 24h snapshot. Each card is a quiet link: clicking **Agent calls** or **Tool calls** sets the explore lens to that event type; clicking **Tokens** sets the measure to Tokens; **Workflow runs** sets type Workflow Run; **Sessions** is non-lens (no tracking type) and links nowhere. Cards accept the `?type=` deep link from Home (`dashboard.md` ladder #14).
3. **Region B — Explore** — one region, one visible control row, two ChartCards beneath it, so the shared scope is *physically obvious*:
   - **Region toolbar** (Toolbar primitive): left — **event-type Select** (default "Agent runs"), options grouped with `SelectGroup` headings: *Agents* (Agent run, Tool call), *Knowledge* (Context retrieve, Context upsert, Source update, Embedder generate, Embedder upsert, Embedder delete), *Workflows* (Workflow run) — all nine types, now scannable. Right — **measure Tabs** `Count | Tokens` (shadcn Tabs, replacing both the hand-rolled pill and the per-chart unit Select; one control, explicit scope).
   - **ChartCard "Trend"** (2/3 width): the area chart, fed by the fixed query (`limit` ≥ 31, tokens → `["inputTokens","outputTokens"]`), zero-fill retained (now honest), palette `--chart-1`, legend retained.
   - **ChartCard "Breakdown"** (1/3 width): **dimension Tabs** `Agents · Users · Projects · Roles` (default **Agents** — today's donut default and the most actionable for P3), and a small **view toggle** `List | Share` (icon ToggleGroup with tooltips + ARIA labels). **List** = the RankedList (today's leaderboard rows: proportional bars, hydrated names, localized values, top-3 visually distinct), now a true top-10 (query limits fixed). **Share** = the donut (palette fixed to 10 real tokens, theme-aware labels) with a compact color-keyed legend list beneath it — slice identity no longer hover-only.
4. **Footer link row** (`text-sm` ghost links, RBAC-gated): "Budgets →" (spend lives there; answers UX#20 honestly instead of duplicating cost math here), "Evals →". One quiet row, no widgets.

What is *not* on L1: the custom calendar (L3 behind "Custom"), Users/Projects/Roles breakdowns (L2 tabs), the donut (L2 view toggle), raw error payloads (L4). Purple appears exactly twice: the active range preset and the active measure tab.

### Disclosure ladder

Every inventory item mapped; "moves" are relocations, never deletions.

| # | Capability | Level | Where it lives in the new design |
|---|---|---|---|
| 1 | super_admin server gate + `/chat` redirect | L0 | Unchanged (`page.tsx`); page additionally parses `?type=&range=&measure=` searchParams for deep links |
| 2 | Sidebar nav entry (super_admin) | L0 | Unchanged; sits in the "Administration" nav group per `design/navigation.md` |
| 3 | Page title + subtitle (i18n) | L1 | PageHeader — title `text-2xl`, purpose line `text-sm` (re-scaled per philosophy §5; keys reused) |
| 4 | Default last-14-days range | L1 | RangePicker default preset **14d** |
| 5 | Popover range calendar | **L3** | Behind the "Custom" preset segment; `numberOfMonths={2}` on `md+`, `1` below |
| 6 | Trigger label / placeholder formatting | L1 | RangePicker trigger shows preset name, or the formatted `LLL dd, y – LLL dd, y` range when custom |
| 7 | 30-day max validation + destructive toast | L3 | Unchanged inside the custom popover (i18n'd copy) |
| 8 | Disabled-days window | L3 | Unchanged |
| 9 | "Maximum range: 30 days" footnote | L3 | Unchanged |
| 10 | Range scoping of sections | L1 | **Upgraded to truly global:** range scopes KPI strip *and* Explore; the always-defined preset state removes the need for the 14d fallbacks (behavior preserved by construction) |
| 11 | Sessions KPI | L1 | StatCard 1 (range-scoped) |
| 12 | Agent-calls KPI | L1 | StatCard 2; click = lens deep-link (L2 affordance) |
| 13 | Token-usage KPI | L1 | StatCard 3; click sets measure Tokens |
| 14 | Workflow-runs KPI | L1 | StatCard 4; click sets type Workflow Run |
| 15 | Tool/function-calls KPI | L1 | StatCard 5; click sets type Tool Call |
| 16 | Sum-of-groups totals (24h + 7d windows) | L1 | StatCard value = range total; the fixed **24h window is the 24h preset**; the 24h-vs-7-day-avg snapshot additionally lives on Home's Vitals (`dashboard.md` ladder #8–9) — nothing lost |
| 17 | Trend %, icon, semantic tint, comparison caption | L1 (muted) / **L2** | Caption inline (gray until ±25%); full comparison detail (both period totals, exact %, window definition) in a Tooltip/Popover on the card |
| 18 | Card skeletons; "(24h)" suffix | L1 | StatCard skeleton (layout-mirroring); suffix replaced by the visible range scope — the RangePicker itself |
| 19 | Count/Tokens toggle (leaderboards + donut) | L1 | **Measure Tabs** in the Explore toolbar — one explicit control, visibly scoping both ChartCards (kills the hidden coupling) |
| 20 | Top Users leaderboard | **L2** | Breakdown card → **Users** tab (List view) |
| 21 | Top Projects leaderboard | **L2** | Breakdown card → **Projects** tab |
| 22 | Top Agents leaderboard | L1 | Breakdown card → **Agents** tab (default) |
| 23 | Ranked rows: sort, top-N, bars, truncation, values | L1 | RankedList rows, top-10 (query `limit` 4→10), tokenized bar color (`bg-primary/10`-style, see Layout) |
| 24 | ID→name hydration + fallback chain | L2 | Unchanged inside RankedList (minus console noise); keys switch to the stable group id |
| 25 | Top-3 captions | L1 | Replaced by rank styling: ranks 1–3 get a `font-medium` rank numeral + subtle medal tint — same information, language-free (fixes i18n + visual noise) |
| 26 | Dynamic subtitles / value labels per measure | L1 | Breakdown card description line follows the measure ("by agent calls" / "by token usage"); value label "calls"/"tokens" per row unchanged |
| 27 | Leaderboard skeleton + empty message | L1 | RankedList skeleton (5 rows) + **EmptyState** primitive (icon, one sentence, "Try a wider range" hint) |
| 28 | Trend + donut composition | L1 | Explore region grid: Trend ChartCard (2/3) + Breakdown ChartCard (1/3) |
| 29 | Event-type Select (9 types, prettified) | L1 | Explore toolbar Select with grouped options (Agents / Knowledge / Workflows); labels localized |
| 30 | Per-chart unit Select | L1 | **Merged into the measure Tabs** (#19) — choosing the unit remains one click, now in exactly one place |
| 31 | Trend query (groupBy createdAt, skip-until-range) | L1 | Unchanged shape; `limit: 12` → `limit: 31`; tokens measure sends `["inputTokens","outputTokens"]` (bug fixes, see §4) |
| 32 | Zero-filled day series | L1 | Unchanged (honest after #31 fix) |
| 33 | Area chart (gradients, axes, tooltip, legend, dots) | L1 | Unchanged in ChartCard; stroke/fill from `--chart-1` instead of gray |
| 34 | Trend skeleton / error / empty | L1 / **L4** | Skeleton + EmptyState at L1; error shows plain-language line + Retry; raw `error.message` inside a `<details>`-style "Technical details" expander (**L4**) |
| 35 | Donut shares the selected type | **L2** | Share view of the Breakdown card — same lens, same toolbar, coupling now visible by layout |
| 36 | Group-by Label/User/Role | **L2** | Dimension Tabs: Agents (=label) · Users · Projects · Roles — a superset of the old donut options (Projects added) and old leaderboard dimensions (Roles added to list view) |
| 37 | Donut unit from toggle | L1 | Measure Tabs (#19) |
| 38 | Donut query (limit 10, skip-until-range) | L2 | Unchanged behind the Share view |
| 39 | Donut rendering (palette, gradients, ≥5% labels, prettify, tooltip) | L2 | Unchanged in Share view; label fill `hsl(var(--foreground))` contrast-safe; `--chart-6…10` defined in both themes; color-keyed legend list added below (fixes hover-only) |
| 40 | Donut skeleton / error / empty | L2 / L4 | Same pattern as #34 |
| 41 | Orphaned `CalendarDateRangePicker` | — | Unreachable dead code (zero import sites) — deleted; not a user-facing capability, nothing to relocate. The RangePicker + DateRangeSelector become the single range-picking pattern (precedent: `dashboard.md` ladder #3/#24) |

### Layout & components

```
PageShell (centered, max-w-7xl, p-8 → p-4 <md, gap-8 rhythm, owns overflow-y-auto)
└─ PageHeader
   · h1 "Analytics" text-2xl font-semibold · purpose text-sm text-muted-foreground
   · right: RangePicker (NEW shared control)
     = Tabs-styled segmented presets [24h|7d|14d|30d|Custom] (active = primary)
       + Popover (Custom): Calendar mode="range", months 2 md+ / 1 below,
         disabledDays + maxDays toast + footnote (existing DateRangeSelector logic)
└─ section KPI strip
   └─ div grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4
      └─ StatCard ×5 (shared primitive, philosophy §5; extracted from summary-cards.tsx
         with the isLoading fix; props: label, value, trend?, caption?, href?/onActivate?)
         · label text-sm font-medium text-muted-foreground · value text-3xl font-bold
         · trend caption text-xs (gray; semantic green/red only past ±25%)
└─ section Explore (gap-4 internal)
   └─ Toolbar (shared primitive)
      · left: Select (event type; SelectGroup headings Agents/Knowledge/Workflows,
        w-full max-w-[220px])
      · right: Tabs "Count | Tokens" (measure)
   └─ div grid gap-6 lg:grid-cols-3
      └─ ChartCard "Trend" (lg:col-span-2)  — title text-lg, h-72 chart area
         · AreaChart (recharts via ui/chart), stroke/fill hsl(var(--chart-1))
         · states: Skeleton (mirrors h-72) / EmptyState / error line + Retry
           + Collapsible "Technical details" (L4, font-mono text-xs)
      └─ ChartCard "Breakdown"
         · header row: Tabs [Agents|Users|Projects|Roles] (scrollable) ·
           ToggleGroup [List|Share] (icon buttons List/ChartPie, tooltips + aria-labels)
         · List view: RankedList (NEW shared primitive, from leaderboard.tsx)
           row = rank numeral (top-3 font-medium + medal tint) · name truncate ·
           bar bg-primary/10 width % · value text-sm font-semibold tabular-nums ·
           unit text-xs muted; key = group id, not display name
         · Share view: PieChart ring + legend list (dot, name, %, value) text-xs
└─ footer ghost-link row text-sm gap-2 — "Budgets →", "Evals →" (RBAC-gated)
```

- **shadcn:** `Tabs`, `Select` (+`SelectGroup`/`SelectLabel`), `Popover`, `Calendar`, `Card` (inside ChartCard), `Skeleton`, `Tooltip`, `ToggleGroup`, `Collapsible`, `Button` (ghost links, Retry), toast (existing validation).
- **Shared primitives from philosophy §5:** PageShell, PageHeader, Toolbar, StatCard, ChartCard, EmptyState. **StatCard** is the same extraction Home (`dashboard.md` §3) specifies — single source for both pages, fixing the ASI bug once. **ChartCard** gets its first two concrete instances here (Trend, Breakdown) and becomes the canonical chart wrapper (title, toolbar slot, h-72 body, standard skeleton/error/empty states).
- **NEW shared primitives to propose for §5:** **RankedList** (top-N entity list with proportional bars and ID→name hydration — reusable by `/budgets` for top spenders and `/evals` for slowest cases) and **RangePicker** (preset segments + bounded custom calendar — reusable by `/data`'s contexts dashboard, which mounts the same `DateRangeSelector` today at `data/components/contexts-dashboard.tsx`).
- **Type & spacing per CLAUDE.md:** page title `text-2xl`, card titles `text-lg`, stat values `text-3xl font-bold`, metadata `text-xs`; spacing steps `gap-4` within sections, `gap-6` between cards, `gap-8` between regions; numbers `tabular-nums`.
- **Color:** purple only on active preset + active measure tab; `--chart-1…5` for series, with `--chart-6…10` **added to `globals.css` in both themes** (values to be chosen against both backgrounds); semantic green/red only for ±25% KPI trends; all literal Tailwind palette colors (blue/slate/red-500/black) removed.
- **i18n:** every string from UX#10 gets `dashboard.*` keys in `en.json` + `de.json`; existing keys reused wherever possible.
- **RBAC, explicit:** route + nav remain `user.super_admin` (`analytics/page.tsx:10`, `main-nav.tsx:194–200`). Footer links: "Budgets →" gated `super_admin || role.budget_management ∈ {read, write}` (mirrors `main-nav.tsx:244–248` — on this page effectively always true since only super_admins arrive), "Evals →" gated `super_admin || role.evals ∈ {read, write}` (`main-nav.tsx:153`). The Users dimension shows user emails/names — acceptable because the audience is super_admin by gate; if the page is later opened to P2 via a `role.analytics` right, the Users and Roles tabs and the Users leaderboard data **must** be additionally gated (`super_admin || role.users === "write"`) and the event-type lens scoped to the requester's agents server-side.

### Mobile behavior

P3's mobile job: *"read analytics headlines… read-mostly, one-handed"* (`personas.md:104`). The phone view is the headline check (job 1); spike forensics (job 2) may degrade gracefully.

- **< 640 px (390 px target):** PageShell `p-4`. PageHeader stacks: title row, then RangePicker full-width — presets render as a 5-segment Tabs row that fits (text-xs segments); "Custom" calendar renders `numberOfMonths={1}` inside a full-width Popover (or Sheet per `design/responsive.md` once defined). **KPI strip first** — `grid-cols-2` (2+2+1), each card full tap-target; this alone completes the mobile job. Explore toolbar stacks: type Select full-width, measure Tabs full-width below. Trend ChartCard full-width, fixed `h-56`, dots hidden (`dot={false}`) to reduce clutter; tooltip works via touch on recharts. Breakdown card full-width; dimension Tabs horizontally scrollable (`overflow-x-auto`, no wrap); List view rows ≥ 44 px tall; Share view shows the ring at `h-48` + the legend list (tap legend row to highlight slice — replaces hover entirely). Footer links wrap. **No fixed widths remain** (`w-[260px]`, `w-[150px]` all replaced by `w-full max-w-*` at `sm+` only).
- **640–1024 px:** KPI `md:grid-cols-3` (3+2); Explore cards stack vertically full-width (Trend then Breakdown); toolbar on one row.
- **≥ 1024 px:** desktop layout (KPI ×5 row, 2/3 + 1/3 grid).
- **Scrolling:** PageShell owns vertical scroll; no `h-screen` (fixes UX#5 by construction). No horizontal scroll at any width (anti-pattern #9).

### Motion

Per CLAUDE.md timings, all gated on `prefers-reduced-motion`:

1. **Skeleton → content crossfade**, 200 ms `ease-in-out` per card/chart — layout-mirroring skeletons, no spinner walls (philosophy §6).
2. **Lens change (type/measure/dimension/range):** chart data transitions via recharts' built-in series animation capped at 300 ms; the old data never blanks — it morphs, communicating "same chart, new lens" (causality).
3. **Breakdown view toggle (List ⇄ Share):** 200 ms opacity crossfade, no slide.
4. **RankedList bars:** width animates 300 ms `ease-in-out` on data change only (not on mount — entry animation would be decorative).
5. **Hover/focus:** StatCard and RankedList rows `border`/`background` 150 ms; standard ring-offset focus pattern.

Nothing else animates: no count-up numbers, no donut spin-in, no staggered section entrances (this page is a reading surface, not a landing).

---

## 4. Implementation notes

**Bug fixes to land first (independent of redesign — they correct lying data today):**
1. `queries.ts:1879` — `GET_TIME_SERIES_STATISTICS` `limit: 12` → `31` (verify backend honors it; see Risks).
2. `time-series-chart.tsx:45` — tokens measure must send `["inputTokens","outputTokens"]` (mirror `donut-chart.tsx:53`); delete the unused `name: unit` variable (`:44`).
3. `summary-cards.tsx:112–114` — `const isLoading = loading24h || loading7d;` (ASI bug).
4. `donut-chart.tsx:92` — label `fill="black"` → `hsl(var(--foreground))`; define `--chart-6…10` in `app/globals.css` (both themes) or mod the palette to 5 until then.
5. `queries.ts:1861` — rename duplicate operation `AgentCallsStatistics` → `TokenUsageStatistics`.
6. `leaderboard.tsx:83–84, 92, 112–113` — remove `console.log`s; `:200` key by group id.

**Files to change**
- `app/(application)/analytics/page.tsx` — keep gate; parse `searchParams` (`type`, `range`, `measure`) and pass as initial lens (enables Home's `?type=` deep link, `dashboard.md` dependency).
- `app/(application)/analytics/components/dashboard.tsx` — rewrite as `analytics-view.tsx`: PageShell/PageHeader/Toolbar composition, single lens state `{range, type, measure, dimension, view}`, no `h-screen`, type scale per CLAUDE.md.
- `components/dashboard/date-range-selector.tsx` — wrap into **RangePicker** (presets + existing popover/validation logic; responsive `numberOfMonths`; i18n the toast/footnote/placeholder). Keep the inner `DateRangeSelector` API stable — `/data`'s `contexts-dashboard.tsx` consumes it too; migrate that page opportunistically.
- `components/dashboard/time-series-chart.tsx` — fixes above; drop the inline unit Select (measure comes via prop); tokenize colors to `--chart-1`; error state → plain line + Retry + L4 details.
- `components/dashboard/donut-chart.tsx` — fixes above; add legend list; drop inline group-by Select (dimension comes via prop).
- `components/dashboard/leaderboard.tsx` — refactor to **RankedList**; remove logs, tokenize bar/value colors, rank styling replaces caption strings, stable keys.
- `components/dashboard/summary-cards.tsx` — ASI fix, then supersede with the shared **StatCard** (same extraction `dashboard.md` specifies — coordinate so it happens once).
- `queries/queries.ts` — limits: `:1879` (12→31), `:1895/:1912/:1929` (4→10); op-name dedupe `:1861`; add a roles-dimension list query (donut already supports `groupBy: "role"` via `GET_DONUT_STATISTICS`; list view reuses it).
- `messages/en.json` + `messages/de.json` — new keys for every UX#10 string; preset labels; breakdown tab labels.
- `app/globals.css` — `--chart-6…10` both themes.

**Files to delete**
- `components/custom/date-range-picker.tsx` — orphaned (`CalendarDateRangePicker`, zero import sites; inventory #41). Dead code, not functionality.

**Shared components needed** — PageShell, PageHeader, Toolbar, EmptyState (from the shell workstream; build against local stubs matching their spec if not yet landed), StatCard and ChartCard (philosophy §5, first concrete implementations shared with Home), plus **NEW primitives to add to philosophy §5: RankedList and RangePicker** (reuse cases named in §3).

**Scope: M** (≈3–5 engineering days): one page recomposition, two primitive extractions + two new primitives, six surgical bug fixes, i18n pass, query-limit changes. No new backend capabilities required — every query exists; only `limit` arguments and one op name change.

**Dependencies**
- **Home (`dashboard.md`):** shares StatCard (extract once) and targets `/analytics?type=…` — the searchParams contract here unblocks it. Home's "Open analytics →" link mirrors this page's gate.
- **Shell/nav (`design/navigation.md`):** Analytics sits in the Administration group; gate unchanged.
- **`/data` page doc:** consumes `DateRangeSelector` (`data/components/contexts-dashboard.tsx`) — RangePicker must remain backward compatible or that page migrates in the same PR.
- **`/budgets`:** footer link target; RankedList is a candidate for its top-spenders view.
- **Theme configuration (`/configuration`):** if the white-label theme editor exposes chart colors, `--chart-6…10` must be added there too.

**Risks**
- **Backend `trackingStatistics` semantics:** the summary queries pass `limit: 10` *without* an explicit `groupBy` (`queries.ts:1850, 1863`) — if the resolver groups by a default dimension with >10 groups, the 24h/range totals undercount today. Verify the resolver's default grouping and `limit` behavior before trusting any total; if needed, request a `groupBy: "none"`/aggregate mode. Same verification applies to the 12→31 limit change (does the backend cap it?).
- **`name: "tokens"` hypothesis:** the time-series fix assumes no tracking rows are literally named `"tokens"`; confirm against backend tracking writes before shipping (if such rows exist, the donut/KPI are the wrong ones instead — either way the inconsistency is the bug).
- **Day-bucket timezones:** `group` is epoch ms bucketed server-side; client `startOfDay` mapping (`time-series-chart.tsx:56–57`) can shift counts across midnight for non-UTC users — verify bucket boundaries; a mismatch makes the zero-fill mislabel days.
- **Roles list view** uses `GET_DONUT_STATISTICS` with `groupBy: "role"` — confirm role ids hydrate to names (a roles-by-ids query may be needed; until then show raw role names as the donut does today, no regression).
- **P2 opening (future):** adding a `role.analytics` right is a backend schema change; the design anticipates it (server-scoped lens, extra tab gating) but it is explicitly out of scope here.
