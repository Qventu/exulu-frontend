# Exulu Responsive & Mobile Standards

> The shared responsive contract forward-referenced by `design/philosophy.md` §7, by the
> design-system audit (R3: "kill the `hidden md:flex` shells"), and by the page docs that
> shipped interim normative specs while this file was pending (`design/pages/models.md`,
> `design/pages/evals.md`, `design/pages/budgets.md`). Those interim specs are absorbed and
> normalized here; from now on this document is canonical and page docs reference it.
>
> Companions: `design/philosophy.md` (decision framework), `design/personas.md` (mobile jobs),
> `design/navigation.md` §5 (shell & mobile nav chrome — the canonical mobile-navigation
> spec), `CLAUDE.md` (implementation tokens).

---

## 1. Strategy — mobile is a context, not a shrink

Philosophy §7: each persona has a *mobile job* that differs from their desktop job.
Responsive design serves that job — it does not cram 1440 px of layout into 390 px, and it
**never** solves the problem by hiding the page (today, 9 page files render literally nothing
below `md` — design-system audit H2).

### What each persona's mobile experience optimizes for

| Persona | Mobile job (personas.md) | The mobile experience optimizes for |
|---|---|---|
| **P1 End user** | Full chat: composing, streaming, files, history. "Must be excellent, not acceptable." | Consumer-grade: one column, thumb-reachable composer, history one tap away, zero horizontal pan, keyboard/safe-area perfect. |
| **P2 Power user** | Monitor and triage: check an agent's sessions, read a failed run, make a small prompt edit. | Fast read paths: card lists, status at a glance, detail in a sheet, small edits possible; heavy authoring reachable but not optimized. |
| **P3 Admin** | Respond to alerts: check a budget, deactivate a user, rotate a secret, read analytics headlines. One-handed. | Read-mostly with a few critical actions ≤3 taps deep: find → open sheet → act → confirm. Nothing destructive by accident. |
| **P4 Developer** | Nearly none: check an eval run's status, copy a token in a pinch. | Copy-first: status cards, copy buttons everywhere, designed fallbacks instead of crushed IDEs. Functional degradation OK; broken layouts are not. |

### Surface tiers

Every route belongs to exactly one tier. The tier sets the quality bar, not the effort cap —
tier C pages still must pass the full definition of done (§5).

**Tier A — flawless (P1-owned surfaces).** The mobile experience *is* the product:
`/chat/*`, `/login` (the gate to chat), `/settings`, `/projects` (router into chat),
`/transcriptions` (voice memos are born on phones), the P1 feedback dialog.

**Tier B — monitor & react (read-mostly + critical actions).** Full content parity, optimized
for triage; authoring may be simplified but every read and every critical action works
one-handed: `/` (Home), `/analytics`, `/budgets`, `/users` `/roles` `/teams`, `/variables`,
`/keys`, `/token`, `/models`, `/workflows`, `/feedback` (triage), `/evals` (status), `/data`
(knowledge health/items), `/prompts`, `/skills` (list + detail), `/agents` (list + detail).

**Tier C — desktop-optimized work surfaces, never broken.** Heavy authoring stays
desktop-first, but at 390 px each surface offers a deliberate, working alternative
(read-only view, mobile toolkit, stepped flow, or an honest "open on desktop / open in
browser" affordance — capability preserved, philosophy §2): the agent editor, the skill
mini-IDE (`/skills/[skillId]`), eval/case authoring, the routine editor, `/configuration`
theme editing, `/explorer` (GraphiQL), `/n8n`.

### Hard rules (non-negotiable, all tiers)

1. **No route renders empty at 390 px.** `hidden … md:flex` page shells are banned. PageShell
   never hides content by breakpoint. (Fixes design-system H2; until a page is redesigned, an
   interim `overflow-x-auto` read-only table is acceptable — a blank page is not.)
2. **No horizontal page scroll at any width ≥320 px** (philosophy anti-pattern #9). Inner
   horizontal scroll is allowed only where deliberate: code blocks, chip rows, StatCard snap
   rows — always inside an `overflow-x-auto` container, never the page.
3. **No fixed pixel widths on content** (`w-[850px]`, `w-[400px]`, `w-[260px]`, `w-[250px]`…).
   Fluid `w-full` + `max-w-*` at `sm+` only. Fixed widths are reserved for table column
   sizing inside scroll containers at `md+`.
4. **No hover-only functionality.** Every hover-revealed action, tooltip-only datum, and
   `title`-attribute hint has a touch path (§3.T7).
5. **No `window.confirm`.** Native confirms are worst on mobile; the shared ConfirmDialog
   (philosophy §5) is the only destructive confirmation.

---

## 2. Breakpoint system

Exulu uses **stock Tailwind 3.4 breakpoints** (`tailwind.config.js` overrides only the
`container` cap at 1400 px). We assign meanings; we do not add custom screens.

| Prefix | Min-width | Meaning | Reference test viewport |
|---|---|---|---|
| *(base)* | 0 | **Phone, portrait. The default authoring target.** Single column, card lists, sheets, stacked forms. Mobile-first: base classes describe the phone layout; larger layouts are added with prefixes — never the reverse. | **390 × 844** (also smoke-test 320 px and 390 px landscape) |
| `sm:` | 640 px | Large phone / phone landscape. Two-column forms return, footer buttons sit side by side, dialogs become centered dialogs again. | — |
| `md:` | 768 px | **Tablet.** Tables replace card lists, side sheets replace bottom sheets, toolbars inline on one row, in-page rails may return (collapsed). | **768 × 1024** |
| `lg:` | 1024 px | **Desktop.** Persistent rails, inline ListDetail panels, optional table columns, first/last pagination, column-visibility menus, hover affordances as *enhancements*. | **1024 × 768** |
| `xl:` | 1280 px | Wide desktop. Extra optional columns, wider detail panels. | — |
| `2xl:` / container | 1400/1536 px | Content max-width. PageShell caps content (`max-w-7xl` content pages); full-bleed work surfaces keep growing. | **1440 × 900** |

**The four named widths in this redesign** — 390 phone / 768 tablet / 1024 desktop / 1440
wide — are *test viewports*, mapped to base / `md` / `lg` / `2xl`-capped respectively. Every
definition-of-done check (§5) runs at all four.

### Touch targets

- **Minimum hit area 44 × 44 px** for every interactive element on touch (Apple HIG class).
  Visual size may be smaller — pad the hit area (`size-10` button + padding, or an absolute
  inset overlay), never shrink the target.
- Tappable list rows / cards: full-row tap target, min height 44 px.
- Icon buttons in card actions and sheet headers: minimum `size-10` (40 px) rendered, padded
  to 44. The current `h-8`/`size-8` ghost icons are desktop-only sugar.
- Adjacent targets (row title + two icon buttons) keep ≥8 px gap so fat-finger errors don't
  trigger the wrong action; destructive icons never sit at a row's extreme tap edge without a
  ConfirmDialog behind them.
- Text inputs: `font-size ≥ 16px` (`text-base`) on touch to prevent iOS focus zoom.

### Viewport & safe-area handling (the V-rules)

- **V1 — `dvh`, never `100vh`.** `h-[100vh]`/`h-screen` ignores mobile browser chrome and
  puts composers behind the iOS/Android toolbar (`chat/[agent]/layout.tsx:22`). Use `h-dvh` /
  `min-h-dvh` / `max-h-[85dvh]`. `h-screen` on inner content is banned outright — combined
  with a non-scrolling parent it creates the scroll traps found on analytics
  (`dashboard.tsx:41`) and the contexts dashboard.
- **V2 — PageShell owns vertical scroll.** Exactly one scroll container per page region; no
  nested page-level double scroll (the prompts/skills stacked `max-h-[50vh]` list +
  below-the-fold preview pattern is banned).
- **V3 — safe-area insets on fixed bottom chrome.** Anything pinned to the bottom edge —
  chat composer, sticky SaveBar, bulk-selection bars, bottom-sheet footers, bottom nav —
  adds `pb-[env(safe-area-inset-bottom)]` (requires `viewport-fit=cover` in the root
  viewport meta).
- **V4 — the keyboard must never trap a control.** No `overflow-hidden` on `body`/page
  roots (the auth layout's `max-h-screen overflow-y-hidden` made the submit button
  unreachable with the keyboard open — `(authentication)/layout.tsx:50`). Focused fields and
  their submit buttons must be scrollable into the visual viewport.
- **V5 — sticky over fixed.** Prefer `sticky` headers/footers inside the scroll container to
  `fixed` elements; they cooperate with the visual viewport and on-screen keyboard.

---

## 3. Standard transforms

The reusable responsive patterns, specified once. Page docs reference these by ID and only
document *deviations*. Components implementing them live with the shared bones (PageShell /
Toolbar / ListDetail / DataTable — philosophy §5), so pages get the behavior for free.

### T1 — Data table → card list *(below `md`)*

The suite-wide replacement for every DataTable (and for the 9 `hidden md:flex` shells).

- **Card anatomy (one border level, no nesting):**
  line 1 — primary identifier (`font-medium`, truncating) + the one status signal
  (StatusDot / badge) right-aligned;
  line 2 — `text-xs text-muted-foreground` metadata ("Role · Team", "Last used 2 h ago ·
  Created Mar 3", schedule chip…). Optional compact visualization (e.g. `compact` BudgetBar)
  as line 3.
- Whole card is a ≥44 px tap target → opens the detail per **T2**. Row actions live in the
  detail sheet (or an always-visible `⋯` menu) — never hover-revealed, never as a crowded
  icon cluster on the card edge.
- **Toolbar** collapses per **T3**. Column-visibility ("View") menus are hidden — there are
  no columns. **Pagination** reduces to prev/next + "Page x of y" (44 px targets); first/last
  return at `lg`.
- **Bulk selection:** long-press is not discoverable — a "Select" item in the toolbar
  overflow enters selection mode (checkboxes appear on cards); the selection/bulk bar becomes
  a **sticky bottom bar** above the safe area (V3). Same ConfirmDialog as desktop.
- `md`–`lg`: real table with the page's L1 column set only; `≥ lg`: full table, optional
  columns, View menu.
- Empty/loading states: the shared EmptyState and skeleton *cards* (mirroring card anatomy),
  not spinner cells.

### T2 — Side panel → bottom sheet *(below `md`)*

The detail half of every ListDetail.

- Below `md`: detail renders as a bottom `Sheet` (`side="bottom"`, `max-h-[85dvh]`,
  internally scrollable; full-height `h-dvh` for document-like content such as item detail,
  conversation replay, transcript review). Identical content component as the desktop panel.
- Primary actions stack full-width at the top of the sheet ("Open in chat", "Edit");
  destructive actions in a Danger zone / header overflow, behind ConfirmDialog.
- `md`–`lg`: right-side overlay `Sheet` (`w-full sm:max-w-*` — **never** a fixed
  `w-[400px]`, which is wider than a 390 px viewport: `agent-details-sheet.tsx:49`);
  `≥ lg`: docked/inline panel or subpage per the page doc.
- URL-backed where the desktop panel is (`?item=`, `/prompts/[id]`): deep links open the
  sheet directly; closing restores the list URL. Below `lg`, ListDetail is **list-only with
  no auto-selection** — auto-selected detail below the fold is the double-scroll bug
  (prompts, skills).

### T3 — Toolbar → search + one Filter button *(below `md`)*

- Search input full-width on its own line (never fixed `w-[150px]`/`w-[250px]`).
- All filters + sort collapse into **one** "Filter" outline button (badge shows active-filter
  count) opening a small bottom `Sheet` with the filter controls stacked + Reset. Segmented
  chip rows may stay inline when they fit one line (e.g. a 3-value type filter).
- Active-filter chips render in a single horizontally scrollable row (`overflow-x-auto
  no-scrollbar`), not a wrapping stack.
- PageHeader on phones: title row first, primary action as a full-width button beneath (or
  compact icon+label top-right when the title is short). Header rows **must wrap or stack** —
  the non-wrapping `justify-between` title-vs-actions row is the single most repeated 390 px
  overflow in the audit (analytics, configuration, transcriptions, evals, skills editor).

### T4 — Multi-column form → single column *(below `sm`)*

- Every form grid drops to `grid-cols-1` below `sm` (`grid-cols-2` returns at `sm:`); no
  unprefixed `grid-cols-2` in forms (the agents editor's `grid-flow-col` two-column-at-all-
  widths layout, `form.tsx:551`, is the canonical violation).
- Labels above inputs; radio/option rows stack label *over* description (side-by-side cramps
  unreadably — `role-form.tsx:180-186`).
- Footer actions: sticky footer, full-width buttons (stacked below `sm`, side-by-side from
  `sm:`); Save never scrolls out of reach (sticky SaveBar pattern).
- Page padding steps down: `p-4` base → `md:p-6`/`md:p-8` (a flat `p-8` burns 64 px ≈ 17 %
  of a 390 px viewport).

### T5 — Dialog → full-screen sheet *(below `sm`; multi-pane dialogs below `md`)*

- Simple dialogs (`max-w-md` class) may stay centered — they already fit.
- Anything taller than the viewport or wider than `max-w-lg` becomes a full-screen sheet
  (`h-dvh` or `h-[90dvh]`, internal `overflow-y-auto`, sticky footer with the confirm
  action). Fixed dialog heights (`h-[700px]`, `h-[600px]` ScrollAreas, `h-[80vh]` with the
  keyboard open) are banned; use `max-h-[85dvh]` + flex-fill.
- **Multi-pane dialogs become stepped flows:** each desktop pane is a step with a back
  header; the selection tray becomes a bottom bar with count + confirm CTA. Canonical cases:
  ItemsSelectionModal (3 panes → context picker → item list → bottom bar), the prompt
  selector (categories → list → detail), eval run/case modals, FilePicker (panes → Tabs:
  Gallery | Upload). One overlay at a time still holds (anti-pattern #3) — a step is not a
  second dialog.

### T6 — Sidebar / rails → drawer *(below `md`)*

- **App navigation:** the sidebar renders as an off-canvas drawer `Sheet`; the shell renders
  a **fixed mobile top bar** (logo + hamburger trigger + page title) so the drawer is always
  openable — today no trigger exists outside the closed sheet itself (shell-navigation audit
  H3). Full spec: `design/navigation.md` §5 (mobile navigation).
- **In-page rails** (chat history rail, knowledge context rail, project section nav, skill
  file tree): below `md` the rail disappears from the flow and becomes a left `Sheet`
  (`w-[85vw] max-w-sm`) behind a visible trigger in the page/work-surface header; selecting
  an item closes it. Fixed inline rails (`w-[250px]`, `w-60`, `w-80`) below `md` are banned —
  they are how projects reached *negative* content width (250 + 320 px of rails at 390 px).
- Tab-like section navs may instead collapse to a horizontally scrollable chip row or a
  `Select` jump menu pinned under the header (agents editor SectionNav).

### T7 — Hover → touch *(all widths; touch is not a breakpoint)*

Use capability, not width: gate hover-only *enhancements* behind
`@media (hover: hover) and (pointer: fine)`; provide the touch path unconditionally.

- Hover-revealed action buttons (`opacity-0 group-hover:opacity-100`, `hidden
  group-hover:block`) become **always-visible** ghost icons or a `⋯` menu on touch.
- Tooltip-only data (cron schedules, retry/backoff config, scope allowlists, MIME types,
  BudgetBar projections, segment text) moves to tap-to-open `Popover`s, plain text in the
  detail sheet, or expanders — the information must be reachable without a cursor.
- `title` attributes are never the only affordance.
- Long-press and swipe are accelerators only, never the sole path (Radix ContextMenu
  long-press is undiscoverable — skills file ops need visible buttons too).
- Links and tappable rows carry a visible affordance (chevron, underline, button styling) —
  not hover-only color shifts (`recent-embeddings.tsx:106`).

### T8 — Wide comparison surfaces → stacked / inverted *(below `md`)*

- **Split diffs → unified:** `splitView={false}` inside a full-screen sheet; version/file
  pickers stack or become chip strips. (Split diff at 390 px = two ~60 px columns:
  prompts/skills diff modals.)
- **Score/run matrices → status cards:** invert columns into newest-first summary cards
  (name, key metric, compact status line); tap → per-row detail sheet. A shrunk matrix with
  horizontal scroll does not serve the mobile job; the inversion does (evals).
- **Wide queue/jobs tables → two-line job cards** (name, state badge, attempts, timestamps;
  copy-id visible).
- Raw JSON / code blocks scroll inside their own `overflow-x-auto` container — never the page.

### T9 — Desktop work surface → designed mobile fallback *(below `md`, Tier C)*

When the surface is a third-party or genuinely desktop tool, do not shrink it — replace the
default with a purpose-built mobile alternative and keep the full surface reachable:

- `/explorer`: the **Mobile toolkit** — copy endpoint / copy token / copy cURL / examples
  sheet — with a ghost "Open full explorer anyway" escape (GraphiQL full-screen, `min-w-0
  overflow-x-auto` contained).
- `/n8n`: EmptyState-style notice ("The n8n editor needs a larger screen") + "Open n8n in
  browser" (new tab) instead of a broken iframe.
- Routine/eval/theme authoring: read-only-by-default with an explicit "Edit anyway", or
  simplified single-column editing. Read-only degradation is acceptable; broken or hidden
  is not (philosophy §7).

### Supporting standards

- **S1 Tabs:** ≤3 tabs → full-width segmented control (fits 390 px). 4+ tabs → horizontally
  scrollable underline tab row (`overflow-x-auto`, no clipping) when tabs are *views*, or a
  full-width `Select` when tabs are a *scoping filter* (budgets' 5 entity types). The stock
  non-wrapping `TabsList` clips at 390 px (`ui/tabs.tsx:17`) — never ship it bare on phones.
- **S2 Charts:** fixed mobile heights (`h-48`–`h-56`), `dot={false}` on dense lines, touch
  tooltips verified; donut/ring charts pair with a tappable legend list (tap row → highlight
  slice) — hover-only slice identification is banned. Chart toolbars stack per T3 (no fixed
  `w-[150px]` selects).
- **S3 Date pickers:** `numberOfMonths={1}` below `md` (two months ≈ 560 px can never fit);
  presets as a segmented row; trigger is fluid, never `w-[260px]`.
- **S4 StatCards:** `grid-cols-2` (2×2) or a horizontal snap-scroll row below `sm`;
  `md:grid-cols-3/4`; the desktop 5-up row at `lg+`. StatCard L2 detail = tap `Popover` on
  touch, `Tooltip` on pointer (T7).
- **S5 Long values:** UUIDs, JWTs, keys, emails — `truncate` + copy button, or `break-all`
  when full visibility is the job (one-time key reveal). Never let a mono value stretch a
  row off-screen.
- **S6 Region order may change on phones:** the mobile job leads (Home puts *Needs
  attention* first; transcriptions puts *upload* before the gallery). Order changes are a
  deliberate design decision recorded in the page doc, not free-styling.

---

## 4. Per-page hotlist

Severity from each page doc's mobile audit. "Transforms" lists the standard fixes (§2 V-rules,
§3 T/S patterns) that resolve the page's breakages; page docs hold the full specs.

| Page doc | Severity | Worst concrete breakages today | Standard fixes |
|---|---|---|---|
| `dashboard.md` | minor | Route redirects, so it can't break — but every building block fails: `w-[260px]` range trigger + `numberOfMonths={2}` calendar; `h-screen` scroll trap (`analytics/components/dashboard.tsx:41`); hover-only row links. | V1/V2, S3, S4, T7 |
| `chat.md` | **broken** | `w-[850px]` composer forces ~2.2× viewport pan (`chat.tsx:1152`); sessions sidebar `hidden` below `md` with no replacement — phone users trapped in one session; `h-[100vh]` puts composer behind browser chrome; hover-only message/file/citation actions; desktop-width multi-pane dialogs. | V1/V3/V4, T6 (history Sheet), T5, T7; rule 3 (no fixed widths) |
| `projects.md` | **broken** | 250 px nav + 320 px section rail at 390 px ⇒ **negative content width** (`project-nav.tsx:124`, `project-details.tsx:208-209`); hover-revealed remove buttons = curation impossible on touch; ItemsSelectionModal `1200×700` 3-pane. | T6, T2, T5 (stepped), T7, S1 |
| `agents.md` | **broken** | Editor lays two form columns side-by-side at *all* widths — ~170 px each (`form.tsx:551`); `w-[400px]` sheets overflow a 390 px viewport; non-wrapping 4-button header row clips. | T4, T2, T3, T6 (SectionNav chips), T7 |
| `models.md` | **broken** | All three routes render **nothing** (`hidden md:flex` ×4 incl. LiteLLM branches); behind it: 9-column table, `w-[150px]` search, fixed `grid-cols-2` limits grid. | Rule 1, T1, T2, T3, T4 |
| `knowledge.md` | **broken** | 550 px of fixed rails before content renders (`contexts.tsx:83`, `data-list.tsx:250`); `w-[500px]` search sheet > viewport; `1200×700` modal; bulk-op `grid-cols-2` filter+preview never stacks; tile actions and cron/retry config hover/tooltip-only. | T6, T1, T2, T5 (stepped, Tabs), T7, T3 |
| `explorer.md` | **broken** | GraphiQL ships exactly one media query (dark mode) — zero responsive layout; drag-only pane resizing; Monaco unusable sub-400 px. | T9 (Mobile toolkit + escape hatch) |
| `evals.md` | **broken** | `/evals` + `/cases` blank (`hidden md:flex`) — denied users see an alert, authorized users see nothing; run matrix = endless horizontal scroll with hover-only tooltips and hover-revealed row actions; 10-column queue table. | Rule 1, T1, T8 (matrix→run cards, queue cards), T2, T5, T7 |
| `prompts.md` | minor | Stacked double-scroll with auto-selected preview below the fold; hover-only row actions (share/delete two scrolls away); split-view diff collapses to slivers. | V2, T2 (list-only + sheet), T3, T7, T8 (unified diff) |
| `skills.md` | **broken** | Editor top bar crushes title + 6 controls with no responsive variants; fixed `w-60` file tree leaves ~150 px of editor; rename/delete are right-click-only (no touch path); split diff ~60 px columns. | T6 (tree Sheet), T3, T7, T8, T2 |
| `workflows.md` | **broken** | Page body blank (`hidden md:flex`, `workflows/page.tsx:90`); 6-column table; `max-w-6xl`/`90vw×85vh` dialogs; run-history dialog hardcodes a `w-80` sidebar; `/n8n` iframe `h-screen` under app chrome. | Rule 1, T1, T2, T5, T8 (queue cards), T9 (n8n notice), V1 |
| `variables.md` | **broken** | `/variables` blank (`hidden md:flex`); behind it a 7-column table; usage page's mono UUID column forces overflow with no copy affordance. | Rule 1, T1, T2, T4, S5 |
| `access.md` | **broken** | `/users` blank (`hidden md:flex`); roles/teams 5-column tables horizontal-scroll the page; `window.confirm` on mobile browsers; cramped side-by-side radio rows. | Rule 1 & 5, T1, T2, T3, T4, S1 |
| `budgets.md` | minor | Five-trigger `TabsList` clips / forces page scroll at 390 px; BudgetBar detail (projection, reset) is hover-tooltip-only — unreachable on touch; long emails push the bar column off-screen; cramped bulk bar. | S1 (tabs→Select), T1, T2, T7, S5, V3 (sticky bulk bar) |
| `analytics.md` | **broken** | First row overflows (`text-4xl` title + `w-[260px]` trigger, no wrap); two-month calendar can't be operated; `h-screen` without overflow = content below fold unreachable; 2× `w-[150px]` chart selects overflow their panel. | V1/V2, T3, S2, S3, S4 |
| `keys-token.md` | **broken** (/keys) · minor (/token) | 7-column table puts Last Used + delete off-screen — revoking a key (the #1 mobile job) requires discovering sideways scroll; non-wrapping scope RadioGroup; scope allowlist hover-only; one-time key needs an unsignposted scroll to verify. /token: fine, minus a theme-bug spinner. | T1, T2, T5, T7, S5 (`break-all` reveal) |
| `settings-config.md` | minor | `/configuration` header: no-wrap title + two text buttons cram at 390 px; flat `p-8`; preview pane shares 390 px with the editor. `/settings` is already a clean single column. | T3 (header stack), T4 (padding), T2 (preview→bottom Sheet) |
| `transcriptions.md` | minor | Segment popups hover-only — transcript can't be read from the ribbon on touch; ribbon segments as small as ~0.5 px; `sm:max-w-[900px]` upload dialog with no max-height/scroll — confirm button can land off-screen; non-wrapping header. | T7 (blocks as the reading mechanism), T5 (gallery → full-screen Sheet), T2 (review sheet), T3, T4 |
| `feedback.md` | **broken** | Page body blank (`hidden md:flex`, `page.tsx:10`); behind it a toolbar of fixed widths ≈800 px and a 6-column table; detail sheet's fixed `h-[600px]` ScrollArea double-scrolls; submit dialog `h-[80vh]` + keyboard crops the conversation. | Rule 1, T1, T3, T2, T5, V4 |
| `auth.md` | minor | `max-h-screen overflow-y-hidden` on body — the page *cannot scroll*; keyboard or an error alert pushes the submit/Google buttons out of reach; fixed `w-[350px]` column overflows 320–349 px viewports; 176 px of fixed chrome before content. | V1 (`min-h-dvh` + natural scroll), V4, rule 3 (`w-full max-w-[350px]`) |

Tally: 13 broken, 7 minor, 0 acceptable. Eleven of the broken cases share two root causes —
the `hidden md:flex` shell (rule 1) and fixed-width rails/tables (rules 2–3) — which is why
the transforms are built once into the shared bones rather than fixed per page.

---

## 5. Definition of done — the responsive checklist

Every redesigned page passes all of this before it ships. Run at the four reference
viewports (390 / 768 / 1024 / 1440), plus 320 px and 390 px-landscape smoke tests, in **both
themes**.

**Layout**
- [ ] Renders meaningful content at 390 px — no `hidden md:flex`, no blank or placeholder-only state (Tier C pages render their designed fallback, §3.T9).
- [ ] Zero horizontal page scroll at 320–1440 px (intentional inner `overflow-x-auto` regions only); no element wider than 100 % of its container.
- [ ] No fixed pixel widths on content/controls below `md`; dialogs/sheets sized with `max-w-*`/`dvh`, never fixed px heights.
- [ ] Exactly one vertical scroll container per region; no `h-screen`/`100vh` (uses `dvh`); nothing below the first viewport is unreachable.
- [ ] Standard transforms applied (T1–T9/S1–S6 as relevant); deviations documented in the page doc.

**Touch**
- [ ] All interactive targets ≥44 px hit area; adjacent targets ≥8 px apart; list rows/cards fully tappable.
- [ ] Every action and every datum reachable without hover (no hover-only buttons, tooltips, or `title`-only hints); long-press/swipe only as accelerators.
- [ ] Destructive actions behind the shared ConfirmDialog (no `window.confirm`); accidental-tap-safe.
- [ ] The page's persona mobile job (§1 table) is achievable end-to-end one-handed, ≤3 taps from page entry — name the job and walk it.

**Viewport & input**
- [ ] On-screen keyboard never hides the focused field or its submit action (V4); fixed bottom chrome respects `env(safe-area-inset-bottom)` (V3).
- [ ] Text inputs ≥16 px font on touch (no iOS focus zoom).

**Theming & motion**
- [ ] Verified in light *and* dark at every test viewport (philosophy §4: both themes first-class).
- [ ] All animation honors `prefers-reduced-motion` (the global kill switch must not be bypassed by inline/JS animation); durations within the budget (≤500 ms).

**Keyboard & accessibility**
- [ ] Full keyboard operability: logical tab order, visible focus rings (ring-offset pattern), no focus traps in sheets/dialogs, `Esc` closes overlays.
- [ ] Icon-only controls have `aria-label`s; sheets/dialogs announce titles; touch-replaced tooltips keep their text accessible.
- [ ] Contrast meets WCAG AA in both themes at all sizes.

**Content resilience**
- [ ] German strings, long emails, UUIDs, and long titles truncate or wrap by design (`truncate` + copy / `break-all` / `line-clamp`) — never stretch the layout (the analytics header overflows *in German* today).
- [ ] Loading and empty states render correctly at 390 px (skeletons mirror the mobile layout, not the desktop one).
