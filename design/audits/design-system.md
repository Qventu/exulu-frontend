# Design System Consistency — Audit

> Evidence base for the redesign synthesis. Scope: tokens, shadcn component inventory, and a
> sample of 16+ page files audited for heading scale, page padding, color usage, button/badge
> usage, icon conventions, table/list/empty/loading patterns, and theme bugs. All paths are
> relative to the repo root. Decision framework: `design/philosophy.md` (esp. §4 "Calm
> surfaces", §5 "Same bones everywhere", anti-patterns 4/5/9) and `CLAUDE.md` (token,
> typography, spacing, animation standards).

---

## Current state

### 1. Token layer

**Color tokens** — defined as HSL triplets in `app/globals.css:34-130` (light `:root`, dark
`.dark`), mapped in `tailwind.config.js:38-86`.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--primary` | `257.94 100% 60%` | `257.67 100% 68%` | The brand purple; matches CLAUDE.md |
| `--destructive` | red 59.6% | red 70.8% | only semantic status token that exists |
| `--accent` | blue-tinted 94% | blue-tinted 17% | used as hover surface by shadcn, *not* an accent |
| `info` | **aliases `--primary`** (`tailwind.config.js:56-59`) | same | "info" renders purple, not blue |
| `--chart-1..5` | green/purple/orange/blue/gray | mostly adjusted; `--chart-3` flips hue (see below) | consumed by the dashboard donut/time-series charts via `ChartContainer`; two other chart implementations bypass them, and `--chart-6..10` are referenced but never defined (see §6) |
| success / warning | **do not exist** | — | no token despite CLAUDE.md naming green/orange semantics |
| `--sidebar-*` | full set `app/globals.css:59-66` | `:109-116` | plus a *second* var `--sidebar-background:81` |

Key structural observations:

- **No `success`, `warning`, or true `info` tokens.** CLAUDE.md and `design/philosophy.md` §4
  require green/orange/blue semantics, but the palette stops at `destructive`. Consequence:
  **53 files** reach for raw Tailwind palette classes (`text-green-600` ×18, `text-red-600`
  ×28, `text-amber-600` ×13, `text-blue-600` ×13, `bg-amber-500` ×7, etc. — counts from
  grep over `app/` + `components/`).
- **Two sources of truth for the sidebar background.** `tailwind.config.js:76-85` maps
  `sidebar.DEFAULT` to `hsl(var(--sidebar-background))` (`0 0% 98%`), while
  `app/globals.css:160-162` defines a hand-written `.bg-sidebar` class using
  `hsl(var(--sidebar))` (`210 42.86% 97.25%`) — a different color. Whichever rule wins depends
  on CSS order, not intent.
- **`addVariablesForColors` plugin** (`tailwind.config.js:147-156`) dumps the *entire
  flattened Tailwind palette* into `:root`, including self-referential definitions such as
  `--border: hsl(var(--border))`. It currently "works" by cascade accident and bloats `:root`
  with ~250 unused vars (`--red-500`, `--lime-300`, …). It exists only to serve one or two
  Aceternity-style effects.
- **`--chart-3` changes hue between themes.** Light is orange (`24.86 98% 58%`,
  `app/globals.css:56`) but dark is red/pink (`0 93.55% 81.76%`, `:106`) — visually colliding
  with `--destructive` in dark mode (`0 90.6% 70.78%`, `:99`). The same
  same-semantic/different-color drift this audit flags in components (§6) exists inside the
  token layer itself: series 3 of any chart silently changes meaning-color when the theme flips.
- **Dead tokens.** `--shadow-2xs` … `--shadow-2xl` (`app/globals.css:71-78`, repeated
  `:121-128`) and `--spacing: 0.27rem` (`:80`) are Tailwind-v4-style theme vars that nothing
  in a Tailwind 3.4 build reads — `shadow-sm` etc. resolve to Tailwind defaults. The shadow
  design intent encoded there is silently ignored.
- **Duplicate base layers.** `@layer base` appears twice (`app/globals.css:33-146` and
  `:261-268`) repeating `* { border-border }` and the body rules.
- **Radius:** single `--radius: .4rem` token, mapped to `lg/md/sm` (`tailwind.config.js:87-91`).
  Consistent and healthy.

**Hardcoded colors inside globals.css itself:**

- `app/globals.css:156` — `.recharts-active-bar { background: #0c85d0 }` (raw hex, both themes).
- `app/globals.css:270-278` — `.chat-response-container p { color: black }` with a manual
  `.dark … { color: white }` override instead of `hsl(var(--foreground))`.
- `app/globals.css:191` — `.chat-table` ships its own box-shadow in raw `rgb()`.
- `.chat-table` (`:183-257`) is a complete parallel table system (striped rows, hover, its own
  responsive rules) living in CSS, independent of `components/ui/table.tsx`.

### 2. Typography

**Fonts** — `lib/fonts.ts` loads local fonts via `next/font`:

- Inter at weights **300, 400, 700 only** (`lib/fonts.ts:4-24`)
- JetBrains Mono 400 (`:27-31`), Merriweather 400 (`:34-38`)

**Weight utilities actually used** (grep counts, `app/` + `components/`):
`font-medium` ×286, `font-semibold` ×164, `font-bold` ×64, `font-black` ×2, `font-light` ×2.

→ **450 of ~518 weight usages (`font-medium`, `font-semibold`) request weights 500/600 that
are not loaded.** Browsers resolve 500→400 and 600→700 (or synthesize), so "medium" labels
render identical to body text and "semibold" renders as full bold. The intended 4-step weight
hierarchy collapses to 2 steps. `font-black` (900, `app/(application)/prompts/page.tsx:133`,
`skills/page.tsx:213`) also falls back to 700.

`globals.css:67-69` *also* declares `--font-sans: 'Inter', system-ui` by family name — but
next/font registers a hashed family (`__Inter_…`) via its own variable; the globals fallback
only works because the class on `<html>` re-sets the same var. Redundant double definition.

**Global letter-spacing:** `app/globals.css:79` defines `--tracking-normal: -0.025em` and
`:138` applies it to `body` — the **entire app** renders with tightened tracking, and several
headings stack `tracking-tight`/`tracking-tighter` on top of it (the `text-2xl font-bold
tracking-tight` title family below; `tracking-tighter` heroes at `prompts/page.tsx:133`,
`skills/page.tsx:213`). Note: `--tracking-normal` belongs to the same Tailwind-v4-style theme
var family as the dead `--shadow-*`/`--spacing` vars (§1), but unlike them it *is* consumed —
a blanket "delete the v4 vars" cleanup would change type rendering app-wide.

**Page-title scale in practice** — 19 sampled titles, 6 distinct treatments:

| Treatment | Pages (file:line) |
|---|---|
| `h2 text-2xl font-bold tracking-tight` | models `models/page.tsx:24`, users `users/page.tsx:46`, variables `variables/page.tsx:19`, feedback `feedback/page.tsx:13`, evals `evals/page.tsx:36`, eval cases `evals/cases/page.tsx:52`, workflows `workflows/page.tsx:93` ("Routines"), configuration `configuration/page.tsx:184`, models create/edit `models/create/page.tsx:19` |
| `h1 text-3xl font-bold (tracking-tight)` | settings `settings/page.tsx:64`, token `token/page.tsx:94`, agents `agents/page.tsx:119`, roles `roles/page.tsx:199`, teams `teams/page.tsx:135`, keys `keys/page.tsx:206` |
| `h1 text-2xl font-bold` | budgets `budgets/page.tsx:288` (with inline icon), variables create/edit/usage `variables/create/page.tsx:90` etc. |
| `h1 text-2xl font-semibold` | transcriptions `transcriptions/page.tsx:165`, projects `projects/page.tsx:9` (h2) |
| `h1 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter` | prompts `prompts/page.tsx:133`, skills `skills/page.tsx:213` ("editorial hero" with `<br/>` + purple span) |
| `h2 text-4xl font-bold tracking-tight bg-clip-text` | analytics `analytics/components/dashboard.tsx:45`, contexts dashboard `data/components/contexts-dashboard.tsx:82,172` (`bg-clip-text` with no gradient — dead class) |

Note: CLAUDE.md's hierarchy says page titles are `text-4xl`; `design/philosophy.md` §5's
PageHeader spec says `text-2xl`. Per the stated precedence (philosophy wins on what/why), the
target is **`text-2xl`** — today only ~half the pages land there, and none through a shared
component.

**CardTitle collision** — `components/ui/card.tsx:39` keeps the legacy shadcn default
`text-2xl font-semibold` for `CardTitle`, i.e. *card* titles render at the same size as most
*page* titles. Pages patch it ad hoc (`budgets/page.tsx:301` → `CardTitle className="text-base"`),
others don't (`keys/page.tsx:215` full-size).

### 3. Spacing & layout shells

No shared PageShell exists. Sampled top-level page containers:

| Shell pattern | Pages |
|---|---|
| `hidden h-full flex-1 flex-col space-y-8 p-8 md:flex` | models `:21`, users `:43`, variables `:16`, feedback `:10`, evals `:33`, eval cases `:42`, workflows `:90`, models create `:39`, models edit `:44` |
| `hidden h-full flex-1 flex-col space-y-4 p-8 md:flex` | models create `:18`, models edit `:23` (the LiteLLM-mode branch of each page — same hidden shell, different rhythm) |
| `container mx-auto py-12 px-6` | agents `agents/page.tsx:117` |
| `container mx-auto p-6` | settings `:61`, token `:59,:69` |
| `container mx-auto py-6 space-y-8 max-w-7xl` | budgets `:286`, teams `:127`, roles `:191` |
| `container mx-auto py-6 space-y-8 max-w-5xl` | keys `:204` |
| `flex-1 p-6 max-w-4xl mx-auto w-full` | transcriptions `:162` |
| `h-full flex-1 flex-col p-4 sm:p-6 lg:p-8` | prompts `:129`, skills `:209` |
| `flex-1 flex flex-col p-8 pt-6 h-screen` | analytics `dashboard.tsx:46`, contexts dashboard `contexts-dashboard.tsx:78` |
| `h-full flex-1 flex-col space-y-8 p-8` (no `hidden`) | configuration `:181` |

So: page gutter is variously `p-6`, `p-8`, `px-6 py-12`, `p-4→p-8` responsive; content
max-width is variously Tailwind `container` (1400px cap, 2rem padding per
`tailwind.config.js:16-22`), `max-w-7xl`, `max-w-5xl`, `max-w-4xl`, `max-w-2xl`
(settings inner), or unconstrained.

**The `hidden … md:flex` shell deserves its own callout:** **9 page files render nothing at
all below `md`** (11 shell instances — models create and models edit each contain two, one per
LiteLLM render branch) — Models, Users, Variables, Feedback, Evals, Eval Cases, Workflows, and
the model create/edit pages are blank screens on mobile. This is anti-pattern #9
("Desktop-only afterthought") in its strongest form: not degraded, absent.

**Arbitrary values:** 326 bracketed px/rem values in classNames across `app/` + `components/`
(`[10px]` ×32, `[80px]` ×24, `[500px]` ×19, …). Many are legitimate (table column widths),
but they include type sizes (`[11px]` ×8) and spacing that should come from the scale.

### 4. shadcn/ui component inventory

`components/ui/` — 56 files + 1 directory (`shadcn-io/`):

| Category | Files |
|---|---|
| Stock shadcn primitives (46) | accordion, alert-dialog, alert, avatar, badge, breadcrumb, button-group, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, dropdown-menu, form, hover-card, input-group, input-otp, input, label, navigation-menu, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle-group, toggle, tooltip |
| **App-specific code living in `ui/`** (10) | `loading.tsx`, `loading-text.tsx`, `markdown-editor.tsx`, `mode-toggle.tsx`, `navigation.tsx`, `rating.tsx`, `role-selector.tsx`, `team-selector.tsx`, `sortable.tsx`, `use-toast.ts` |
| Registry effects | `shadcn-io/gradient-text`, `shadcn-io/shimmering-text` |

Vintage notes:
- Mixed shadcn generations: `button.tsx` uses old-style `size: icon: "size-10"` + `h-10`
  defaults (pre-"new-york" sizing); both `toast.tsx`/`toaster.tsx` **and** `sonner.tsx`
  toast systems are installed.
- `badge.tsx` has only `default/secondary/destructive/outline` — no success/warning/info, so
  status badges are hand-rolled per page.
- `alert.tsx:14` adds a custom `info` variant — which, via the `info`→`primary` alias, renders
  **purple**, conflicting with philosophy §4 (blue = informational) and diluting the accent
  (used at `chat/page.tsx:28`, `agents/components/create-new-agent.tsx:196`).
- `dialog.tsx:24`, `sheet.tsx:24`, `alert-dialog.tsx:21` overlays use `bg-black/80` (stock,
  acceptable, noted for completeness).

### 5. Buttons & destructive confirmation

Explicit variant usage (grep): `outline` ×227, `ghost` ×150, `secondary` ×77, `destructive`
×43, `default` ×17 (plus implicit defaults), `link` ×4, `variant="info"` ×2 (Alert).

Concrete misuse / divergence:
- **Bespoke primary CTAs:** prompts `prompts/page.tsx:144-151` and skills
  `skills/page.tsx:224-228` override the primary button with `size="lg" h-12 sm:h-14 px-8
  shadow-lg shadow-primary/20 hover:-translate-y-0.5 …` — a one-off button language found
  nowhere else; `prompts/page.tsx:147` even redundantly re-applies `bg-primary hover:bg-primary/90`.
- **Two competing destructive-confirmation patterns** (violates philosophy §5 ConfirmDialog
  and anti-pattern #4): native `confirm()`/`window.confirm()` in 12+ call sites
  (`transcriptions/page.tsx:754`, `users/components/data-table.tsx:232`,
  `users/components/columns.tsx:71,93`, `users/components/data-table-row-actions.tsx:147`,
  `prompts/components/prompt-card.tsx:75`, `prompt-preview.tsx:74`, `prompt-list-item.tsx:30`,
  `skills/components/skill-list-item.tsx:45`, `skills/[skillId]/page.tsx:139`,
  `components/image-generation/edit-style-dialog.tsx:136`,
  `components/session-files/session-files-panel.tsx:72`) vs. `AlertDialog` in 13 files.

### 6. Color usage in components (ad-hoc hex / palette / dark-mode bugs)

- **Chart color usage is split — and the token-driven half has an undefined-token bug.**
  Two implementations hardcode hexes: `app/(application)/data/components/chart.tsx:51-83` and
  `components/custom/dashboard-main-chart.tsx:38-55` use `#2563eb`, `#10b981`, axis `#888` —
  these don't adapt to dark mode and don't match the brand palette. Two others *do* consume
  tokens, via the shadcn `ChartContainer` (`components/ui/chart.tsx`):
  `components/dashboard/donut-chart.tsx:22-33` builds its entire palette from
  `hsl(var(--chart-1..10))` and `components/dashboard/time-series-chart.tsx:34` uses
  `hsl(var(--muted-foreground))` — both rendered by the audited dashboards
  (`analytics/components/dashboard.tsx:154,178`,
  `data/components/contexts-dashboard.tsx:103,122`). The bug: `donut-chart.tsx:28-32`
  references `--chart-6` through `--chart-10`, which are defined **nowhere** —
  `globals.css` defines only `--chart-1..5` (`:54-58` light, `:104-108` dark) — so donut
  segments 6–10 resolve to invalid `hsl()` colors and lose their fill in *both* themes.
- **`components/tool-call-approval.tsx:65-90`** is written entirely in `gray-*` with manual
  `dark:` pairs (`border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800`,
  `text-gray-900 dark:text-gray-100`, amber warning block) — a parallel neutral system that
  drifts from the cool-gray tokens.
- **`components/callout.tsx:17-20`** — `border-red-900 bg-red-50` / `border-yellow-900
  bg-yellow-50` with **no dark variants**: in dark mode, near-white foreground text sits on a
  pale red/yellow background. Unreadable.
- **`components/ui/loading.tsx:8`** — spinner defaults to `text-white`: invisible on light
  backgrounds unless every one of its 42 call sites remembers to override.
- **`icons/index.tsx`** (the entire custom icon module — 9 exports, 8 of them fixed-color)
  hardcodes colors: `Times` `stroke="black"` (`:71-74`, invisible in dark mode), `Github`
  `fill="black"` (`:126`, invisible in dark mode), `Docs` `stroke="#344054"` (`:106`),
  `DownArrow` `stroke="#475467"` (`:32`), `RightArrow` `stroke="white"` (`:12`), `Dot`
  `fill="#12B76A"` (`:90`), `Twitter` `fill="#47ACDF"` (`:143`), and `Discord` (`:149-181`) a
  hardcoded gradient fill `#687EC9→#5971C3` (`:160,:175-176`) plus `fill="white"` (`:164`) —
  it neither themes nor recolors. None use `currentColor` except `CopyIcon`.
- **Code blocks:** `components/custom/code-preview.tsx:82,109,156` force `!bg-[#282a36]`
  (Dracula) in both themes; `components/custom/code-display-block.tsx:55-56` switches between
  hardcoded `#303033`/`#fcfcfc` via inline style instead of tokens.
- **Capability chips:** `agents/edit/[id]/form.tsx:873-912` and
  `agents/components/agent-details-sheet.tsx:105-143` use `bg-gray-500 text-white` for
  disabled capabilities. For the *enabled* "text" capability, the edit form (`form.tsx:873`)
  renders `bg-none text-primary-foreground` — no background under near-white text, i.e. an
  **invisible icon in light mode** — while the sheet (`agent-details-sheet.tsx:105`) renders
  `bg-green-500` for the same state; the *other* enabled capabilities (images/files/audio/
  video) use `bg-primary` in both files (`form.tsx:879+`, sheet `:110+`). One state, three
  treatments — one of them unreadable (belongs with the H5 theme bugs).
- 143 `dark:` overrides across 37 files — most are compensation for not using tokens.

### 7. Icons

- Standard: lucide-react, with a global `.lucide { stroke-width: 1 }` rule
  (`app/globals.css:280-282`) matching CLAUDE.md ("stroke-width: 1").
- **30+ explicit overrides** fight the global rule: `strokeWidth={1.5}` in
  `prompts/page.tsx:298`, `prompts/components/prompts-grouped-view.tsx:183,215`,
  `skills/[skillId]/page.tsx:276`, `components/message-renderer.tsx:1264`, all of
  `components/feedback/*`; `strokeWidth={1}` re-stated in `skills/page.tsx:275,316`. Result:
  three live stroke weights (1 / 1.5 / 2 in custom SVGs).
- Sizing notation is split: `h-4 w-4` ×399 vs `size-4` ×194 (plus `h-3 w-3` ×112,
  `h-5 w-5` ×46, `h-6 w-6` ×33, `size-5` ×9) — two syntaxes for the same thing.
- `icons/index.tsx` is a stranded Figma-export module (9 exports, 8 of them fixed-color —
  `CopyIcon` is the lone `currentColor` exception — no size/className props) that bypasses
  lucide entirely (see §6 for its color bugs, incl. the Discord gradient).

### 8. Collections: table vs list vs grid

At least five collection presentations coexist:

1. **TanStack + shadcn `DataTable` — copy-pasted 7×**: `evals/components/data-table.tsx`
   (262 lines), `evals/cases/…`, `workflows/…`, `models/…` (336), `feedback/…` (627),
   `variables/…`, `users/…` (433). Diffing evals vs models shows the same scaffold with
   drifted details (different loading UI, different filter types).
2. **Card grid**: agents `agents/page.tsx:136-163` (responsive 1→4-col grid + a "create" card
   `create-new-agent.tsx:66` with `text-4xl` plus icon).
3. **Editorial grouped list**: prompts/skills (`prompts/components/prompts-grouped-view.tsx:183-217`
   — `h-16 w-16` folder icons, `text-2xl` row titles, hover scale/rotate animations).
4. **Plain `<ul>` rows**: transcriptions `transcriptions/page.tsx:203-235`.
5. **CSS-only `.chat-table`** for markdown tables in chat (`app/globals.css:183-257`) with
   striped rows + hover styling that `components/ui/table.tsx` does not have.

Even within pattern 1, empty rows differ: "No results." (`users/components/data-table.tsx:330`,
`data/components/data-list.tsx:450`), "No models found." (`models/components/data-table.tsx:262`),
"No feedback found." (`feedback/components/data-table.tsx:518`).

### 9. Empty states

Four unrelated empty-state languages (philosophy §5 requires one `EmptyState` primitive):

- Bare table cell, `h-24 text-center` (all DataTable copies, §8).
- Dashed-border text box: transcriptions `transcriptions/page.tsx:199-201`.
- Multi-section illustrated Cards with glow effects, numbered step-by-step instructions, and
  gradient panels: `data/components/contexts-dashboard.tsx:365-450`
  ("No Knowledge Sources Yet" / "Ready to Add Your First Items?" with
  `blur-3xl bg-primary/20`, `bg-gradient-to-br from-primary/10 to-purple-500/10` — raw
  `purple-500` next to `--primary`).
- Oversized-icon hero: `prompts/components/prompts-grouped-view.tsx:61-65`
  (`FolderPlus h-24 w-24 text-primary`, `text-3xl` heading), skills `skills/page.tsx:275`.

### 10. Loading states

- **105× `Loader2`** (lucide spin), **42× custom `<Loading>`** (`components/ui/loading.tsx`,
  `text-white` default), **99× `<Skeleton>`**, **12× ad-hoc `animate-pulse`** divs (e.g.
  agents grid `agents/page.tsx:136-140` builds its own skeleton cards instead of `Skeleton`).
- Within the 7 DataTable copies: evals uses `Skeleton` rows (`evals/components/data-table.tsx:171`),
  models/users/feedback render a `<Loading/>` spinner in a single `h-24` cell
  (`models/components/data-table.tsx:227-262`, `users…:294-330`, `feedback…:490-493`) —
  opposite strategies for the identical situation, against CLAUDE.md's "skeleton for known
  layouts".
- **Only one route-level `loading.tsx` in the whole app**
  (`app/(application)/chat/[agent]/[session]/loading.tsx`); every other route renders nothing
  during RSC navigation.
- Additional bespoke systems: `components/loading-states.tsx` (multi-stage rotating-copy
  dialog spinner, `h-16 w-16` Loader2 + progress dots), `components/ui/loading-text.tsx`,
  `components/ui/shadcn-io/{gradient-text,shimmering-text}`,
  `components/ai-elements/loader.tsx`. Six loading vocabularies total.

### 11. Motion

- Tailwind keyframes are minimal (`tailwind.config.js:92-141`: accordion ×2 + two `expand-*`
  at 0.5s). `globals.css:6-15` implements a correct global `prefers-reduced-motion` kill
  switch. Good.
- Durations in class usage: `duration-200` ×33, `duration-300` ×18, `duration-500` ×9,
  **`duration-700` ×5, `duration-1000` ×1** — the last two exceed CLAUDE.md's 500ms ceiling
  (page-entrance slides on prompts `prompts/page.tsx:132,143` and skills `skills/page.tsx:212`,
  hover transitions at 300ms on list rows `prompts-grouped-view.tsx:183`).

### 12. i18n

Of 38 `page.tsx` files, **1** uses `useTranslation` (`agents/page.tsx`); 7 `.tsx` files total
in `app/(application)` reference it. Everything else hardcodes English
(`users/page.tsx:49` "Here's a list of all the users.", every `confirm()` string, all empty
states). The en/de mandate is effectively unimplemented outside chat/agents/analytics.

### 13. Misc primitives audited

- `components/truncated-text.tsx` — naive `slice(0, length) + "..."`: no `title` attr, no
  tooltip, not CSS truncation; duplicates what `truncate`/line-clamp + Tooltip should do.
- `components/callout.tsx` — overlaps `ui/alert.tsx` (two "callout" systems), string-emoji
  `icon` prop, broken dark mode (§6).

---

## Issues

Severity = impact on coherence/trust × breadth.

### High

- **H1. No success/warning/info tokens → 53 files of raw palette color.** Every status UI
  invents its own greens/ambers/blues; `info` aliases primary purple
  (`tailwind.config.js:56-59`), so "informational" UI consumes the accent (violates
  philosophy §4 and anti-pattern #5). Evidence: §1, §6.
- **H2. 9 admin/build routes (11 shell instances) render nothing on mobile** via
  `hidden … md:flex` shells (models, users, variables, feedback, evals, eval cases, workflows,
  model create/edit — the create/edit pages each carry two shells, `models/create/page.tsx:18,:39`
  and `models/edit/[id]/page.tsx:23,:44`, one per LiteLLM branch). Direct violation of
  philosophy §7 and anti-pattern #9 — P3's "respond to alerts on a phone" job is impossible.
  Evidence: §3.
- **H3. Font weights 500/600 are used 450× but never loaded** (`lib/fonts.ts:4-24`). The
  typographic hierarchy the code *intends* does not render; "medium" text is
  indistinguishable from body. Evidence: §2.
- **H4. Six page-title treatments, no PageHeader primitive** — from `text-2xl font-bold` to
  `text-6xl font-black`; two flagship "Build" pages (prompts/skills) use an editorial hero
  style that exists nowhere else, and dashboards use `text-4xl` h2s with a dead
  `bg-clip-text`. Violates philosophy §5 (PageHeader: `text-2xl`, one per page). Evidence: §2.
- **H5. Dark/light-mode color bugs in shared components:** `callout.tsx` unreadable in dark
  (`:17-20`); `ui/loading.tsx` invisible in light (`:8`); `icons/index.tsx` `Times`/`Github`
  invisible in dark (`:71,:126`); two chart implementations hardcode light-theme hexes
  (`data/components/chart.tsx:51-83`, `custom/dashboard-main-chart.tsx:38-55`) while the
  token-driven donut chart references **undefined** `--chart-6..10`
  (`components/dashboard/donut-chart.tsx:28-32` — only `--chart-1..5` exist,
  `globals.css:54-58,:104-108`), losing fills for segments 6–10 in both themes; the agent
  edit form's enabled-text capability chip is invisible in light mode (`bg-none
  text-primary-foreground`, `agents/edit/[id]/form.tsx:873`); `.recharts-active-bar #0c85d0`
  (`globals.css:156`); `code-preview.tsx` forces a dark code bg in light theme. Evidence: §6.
- **H6. Two destructive-confirmation systems** — 12+ native `confirm()` calls beside 13
  AlertDialog files (violates philosophy §5 "ConfirmDialog" and the L3-destructive rule;
  native confirms are unstyled, untranslatable, and unbrandable). Evidence: §5.
- **H7. Seven diverged copies of DataTable** with inconsistent loading (skeleton vs spinner)
  and empty copy, plus four other collection presentations — anti-pattern #4 ("five ways to
  do the same thing") realized literally. Evidence: §8, §10.

### Medium

- **M1. Page shell entropy:** 8+ container/padding/max-width combos (`p-6` vs `p-8` vs
  `py-12 px-6`; `container` vs `max-w-7xl/5xl/4xl/2xl` vs none). No PageShell. Evidence: §3.
- **M2. Empty-state entropy:** four languages from bare table cell to animated illustrated
  multi-step Cards; the elaborate ones also leak `purple-500` gradients beside `--primary`.
  Evidence: §9.
- **M3. Loading entropy:** six loading vocabularies; only one route `loading.tsx`; skeleton
  vs spinner chosen per-author, not per CLAUDE.md rule. Evidence: §10.
- **M4. CardTitle default `text-2xl`** (`ui/card.tsx:39`) collides with page-title scale and
  is patched inconsistently per page. Evidence: §2.
- **M5. Token-layer hygiene:** `addVariablesForColors` self-referential vars + ~250 junk
  `:root` vars; dead `--shadow-*`/`--spacing` tokens; duplicate `@layer base`; `.bg-sidebar`
  vs `sidebar.DEFAULT` conflict (`globals.css:160-162` vs `tailwind.config.js:76-85`).
  Evidence: §1.
- **M6. i18n absent from ~95% of pages** despite the en/de requirement; all `confirm()` and
  empty-state strings are hardcoded. Evidence: §12.
- **M7. Icon inconsistency:** stroke-width fought per-call-site (1 vs 1.5 vs 2); `h-4 w-4` vs
  `size-4` split; stranded fixed-color `icons/index.tsx` module. Evidence: §7.
- **M8. Same state, different colors:** the enabled "text" capability chip is green in the
  details sheet (`bg-green-500`, `agent-details-sheet.tsx:105`) vs background-less in the edit
  form (`bg-none text-primary-foreground`, `form.tsx:873` — its light-mode invisibility is
  filed under H5), while the other enabled capabilities are `bg-primary` purple in both files
  (`form.tsx:879+`); `bg-gray-500` for disabled instead of `muted`. Evidence: §6.
- **M9. Bespoke primary-CTA style on prompts/skills** (h-14, glow shadows, translate
  hover) breaks the button system and pairs with over-budget `duration-700` entrance
  animations. Evidence: §5, §11.

### Low

- **L1. `app/globals.css` is a grab-bag:** chat-table system, markdown-editor theme,
  GraphiQL patches, recharts patches, `.text-wrap`, `.code-block` all in one file with
  duplicated blocks. Evidence: §1.
- **L2. Two toast stacks installed** (`ui/toast.tsx`+`toaster.tsx` and `ui/sonner.tsx`).
  Evidence: §4.
- **L3. `components/ui/` contains 10 non-primitive app components** (role-selector,
  team-selector, navigation, markdown-editor, …), blurring the "vendored primitives" boundary.
  Evidence: §4.
- **L4. `truncated-text.tsx`** duplicates CSS truncation without accessibility affordances;
  `callout.tsx` duplicates `ui/alert.tsx`. Evidence: §13.
- **L5. 326 arbitrary px values**, including font sizes (`text-[11px]`), eroding the scales.
  Evidence: §3.
- **L6. Mixed shadcn vintages** (old button sizing, old CardTitle, `Cross2Icon` from
  radix-icons in some tables vs lucide elsewhere). Evidence: §4, §8.

---

## Recommendations

Normalization rules for the synthesis, in priority order. Each is a *decision*, stated with
its recommended option.

### R1. Complete the semantic color tokens; reserve purple for accent (fixes H1, M8)
Add `--success`, `--warning`, `--info` (blue, *not* the current primary alias — remove
`info: primary` from `tailwind.config.js:56-59`), each with `-foreground` and light/dark
values, plus muted surface tints (e.g. `success/10` usage convention). Extend `badge.tsx` and
`alert.tsx` with matching variants. Then mechanically migrate the 53 raw-palette files; ban
`{red,green,amber,yellow,blue,orange,gray}-N` classes in app code via lint rule
(`tailwind-csstools` or eslint-plugin-tailwindcss `no-arbitrary-value`-style custom rule).
Disabled/inactive = `muted`/`muted-foreground`, never `gray-500`.

### R2. Build the five shared bones and migrate pages onto them (fixes H4, H7, M1, M2, M3)
Implement `PageShell`, `PageHeader`, `Toolbar`, `EmptyState`, `ConfirmDialog` exactly as
philosophy §5 specifies, plus **one** generic `DataTable` (TanStack wrapper with slots for
columns/filters/row-actions; skeleton-row loading built in; `EmptyState` built in).
- PageHeader: `h1 text-2xl font-semibold tracking-tight` + one-line `text-sm
  text-muted-foreground` purpose + primary action right. (Choose `text-2xl` per philosophy
  §5; update CLAUDE.md's "Display/Hero text-4xl — page titles" line to match — philosophy
  explicitly wins this conflict.)
- PageShell: recommend `mx-auto w-full max-w-7xl p-4 md:p-8 space-y-8` for content pages,
  `full-bleed` variant for work surfaces (chat, explorer, data). Settings-like narrow pages
  use a `narrow` (`max-w-2xl`) variant — three named widths, no per-page values.
- Retire the prompts/skills hero header and dashboard `text-4xl` h2s to PageHeader; the
  editorial energy can survive in the *content* area, not the title block.
- Delete the 7 DataTable copies after migration; this also collapses the empty/loading
  divergence to single implementations.

### R3. Kill the `hidden md:flex` shells (fixes H2)
PageShell must never hide content by breakpoint. Tables get the standard tables→cards
degradation from `design/responsive.md` (**forthcoming** — the responsive-behaviors synthesis
doc that philosophy §7 calls for; it does not exist yet, so until it ships this rule stands
on its own); until each page is redesigned, an interim `overflow-x-auto` read-only table is
acceptable — a blank page is not. This is a hard rule: **no route renders empty at 390px.**

### R4. Load Inter 500 + 600 (fixes H3)
Add `Inter-Medium.woff2` and `Inter-SemiBold.woff2` to `lib/fonts.ts` (or switch to the
variable font file). Then define the weight scale: body 400, UI labels/medium emphasis 500,
headings/buttons 600, reserved 700. Drop `font-black` usages (weight not loaded; off-brand
per "calm"). This single change makes ~450 existing class usages render as intended.

### R5. One confirmation pattern (fixes H6)
Ship `ConfirmDialog` (AlertDialog-based, destructive variant button, i18n keys) and replace
all 12+ native `confirm()` sites. Native `confirm` is banned (lint: `no-restricted-globals`).

### R6. Theme-safe shared components (fixes H5)
- `callout.tsx`: delete; fold into `ui/alert.tsx` variants from R1.
- `ui/loading.tsx`: default to `text-current`/`text-muted-foreground`, never `text-white`.
- `icons/index.tsx`: delete; replace with lucide equivalents (`ArrowRight`,
  `ArrowDownCircle`, `Copy`, `X`) and `simple-icons` (or inline `currentColor` SVGs) for
  brand marks.
- Charts: require `var(--chart-N)` / `ChartContainer` config colors (the pattern
  `dashboard/donut-chart.tsx` and `dashboard/time-series-chart.tsx` already follow); forbid
  hex in chart props. Either define `--chart-6..10` in both themes or cap the donut palette
  cycle at 5 (the chips at `donut-chart.tsx:28-32` currently reference undefined tokens —
  §6); while there, fix the `--chart-3` light/dark hue flip (§1). Fix `globals.css:156` and
  `code-display-block.tsx`/`code-preview.tsx` to token-driven backgrounds (one code-block
  surface token, both themes).
- `tool-call-approval.tsx`: rewrite on card/muted/warning tokens (good test case: it
  currently needs 20+ `dark:` overrides; the token version should need ~0).
- Acceptance check: grep for `dark:` in feature code should trend toward zero; `dark:` is a
  smell outside primitives.

### R7. Icon rules (fixes M7)
Global stroke-width stays 1 (keep `globals.css:280`), with **one** sanctioned emphasis
exception (e.g. 1.5 inside filled/primary buttons) if the synthesis wants it — pick one and
codify; remove per-call-site `strokeWidth`. Standardize on `size-N` notation (Tailwind 3.4
supports it; 194 usages already do) and sizes: `size-4` default, `size-5` toolbar, `size-3`
inline/meta, `size-10`+ only inside EmptyState.

### R8. Token-layer cleanup (fixes M5, L1)
Remove `addVariablesForColors` (port the one or two effects depending on it to explicit
vars); delete dead `--shadow-*`/`--spacing` vars **or** wire them into
`theme.extend.boxShadow` if the softer shadow ramp is wanted (recommended: wire them — the
defined ramp is gentler and on-brand); delete duplicate `@layer base`; resolve
`--sidebar` vs `--sidebar-background` to a single var; move chat-table/markdown-editor/
GraphiQL CSS into co-located CSS modules or components. Replace `.chat-table` styling with
the `ui/table.tsx` look so chat markdown tables and app tables match (decision: app table
style wins; chat keeps its horizontal-scroll wrapper).

### R9. Card and title scale (fixes M4)
Patch `ui/card.tsx` CardTitle to `text-base font-semibold` (matches how the newest pages
already override it) and CardDescription stays `text-sm text-muted-foreground`. This
re-establishes the ladder: page title `text-2xl` > section `text-lg/xl` > card `text-base`.

### R10. Loading decision tree, enforced by primitives (fixes M3)
Per CLAUDE.md: route/list initial load → Skeleton mirroring layout (DataTable from R2 does
this automatically; add `loading.tsx` files for the main routes); short indeterminate action →
`Loader2` inside the triggering button; streaming text → shimmer (keep `shadcn-io/
shimmering-text`, drop `gradient-text` and `components/ui/loading-text.tsx` unless a page doc
claims them). Keep `loading-states.tsx` only for long multi-stage jobs (embedding runs), and
restyle its `h-16` spinner down. Delete `ui/loading.tsx` after R6 migration (Loader2 covers it).

### R11. `components/ui/` hygiene + single toast stack (fixes L2, L3, L6)
Move the 10 app-specific files out of `ui/` (recommended target: `components/<domain>/` per
the codebase-structure doc); pick **sonner** as the single toast system (newer, less code,
already installed) and migrate `use-toast` call sites; refresh stale primitives
(button/card) to current shadcn versions in one pass so vintage drift stops compounding.

### R12. i18n as definition-of-done (fixes M6)
Every string in the new primitives (EmptyState copy, ConfirmDialog, DataTable "No X yet",
PageHeader purposes) goes through the translation layer from day one — retrofitting per page
is what produced the current 1/38 coverage. Add a CI grep for hardcoded strings in the shared
primitives at minimum.

### R13. Motion budget enforcement (fixes M9, part of H4)
Cap utilities at `duration-500`; replace prompts/skills `duration-700` entrances with the
shell-level transition from `design/navigation.md` (**forthcoming** — the shell/navigation
synthesis doc referenced by philosophy §6, not yet written; interim: cap those entrances at
`duration-500` or drop them). Fold the bespoke CTA button back to
`<Button size="lg">`; if a "marquee" button is wanted anywhere, it must become a named
variant in `button.tsx`, not className soup.

### Priority order for synthesis
1. R1 + R4 (tokens & type — everything else is expressed in these)
2. R2 + R3 (bones & mobile unblocking — the structural redesign vehicle)
3. R5 + R6 (trust & theme correctness)
4. R7–R11 (system hygiene, can ride along page-by-page migration)
5. R12–R13 (enforced continuously from the first migrated page)
