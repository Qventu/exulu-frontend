# Codebase Structure — Target

> The structural contract for the Exulu frontend redesign. Philosophy §5 ("Same bones
> everywhere") names this document as the home of the shared primitives; every page doc in
> `design/pages/` references primitives and paths that this document resolves canonically.
> Evidence base: `design/audits/codebase-structure.md` (file layout, data fetching, dead
> code), `design/audits/design-system.md` (component divergence), and the "Implementation
> notes" (§4) of all twenty page docs.
>
> Nothing here removes capability. Everything relocates, layers, or consolidates —
> per `design/philosophy.md` §2.

---

## 0. Decisions at a glance

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Feature code organization | **Route colocation** under `app/(application)/<feature>/` — no parallel `features/` tree | 17 route-local `components/` dirs (80 files) already follow it; App Router supports it natively; a `features/` tree would be a second migration (audit rec 2) |
| D2 | `lib/` vs `util/` | **`lib/` survives; `util/` dissolves** | 150 vs 30 importers; `lib/utils.ts` is the shadcn-mandated path (`components.json` → `@/lib/utils`) (audit rec 5) |
| D3 | Shared component tiers | `components/{ui, primitives, widgets, shell, ai-elements}` with lint-enforced import rules | One placement rule replaces five undocumented conventions (audit M2) |
| D4 | Data fetching | **Apollo only**; TanStack Query removed; per-feature data hooks; memoized client, `errorPolicy: "all"` | 87 vs 3 consumer files (audit rec 7, H4, M3) |
| D5 | GraphQL operations | `queries/queries.ts` dissolves: single-feature ops colocate as `<feature>/queries.ts`; multi-feature ops in `lib/graphql/operations/<domain>.ts` | Kills the 3,223-line / 91-importer hotspot (audit H5) without cross-route imports |
| D6 | GraphQL typing | **Fix codegen**: output to `lib/graphql/__generated__/`; `codegen.ts` is the single config; delete `apollo.config.json` + `graphql.config.yml` | Three contradicting configs, dead output path today (audit M4); dynamic knowledge-context factories stay hand-typed (excluded) |
| D7 | Toasts | **sonner only** | Current shadcn default; newer code already uses it (audit rec 9, design-system R11) |
| D8 | Barrels | **No `index.ts` barrels in app code**; exceptions: vendored kits (`ai-elements/`) and `lib/prompts/` | Tree-shaking, no circular imports, fewer merge conflicts |
| D9 | Primitive naming collisions across page docs | Merged registry (§2.1): QueuePanel=QueueManager, BulkActionBar=SelectionBar, SaveBar=UnsavedChangesBar, FormSection⊇SettingsSection, AccessBadge=RightsModeLabel | Anti-pattern #4: one pattern per job |
| D10 | Migration mode | **Bulk hygiene up front (Wave 0); structure migrates page-by-page with each redesign (Wave 2)** | God files decompose once, to the new design — never refactored ahead of it (audit rec 13) |

---

## 1. Target directory tree

```
.
├── app/
│   ├── (application)/                  # authenticated shell (server layout: auth, config, theme, providers)
│   │   ├── layout.tsx                  # slimmed: dup import fixed, console.log removed, single toaster (sonner)
│   │   ├── authenticated.tsx           # memoized Apollo client, errorPolicy "all"
│   │   ├── (home)/                     # route group — URL stays "/"
│   │   │   ├── page.tsx                # server component: RBAC compose; P1-only → redirect("/chat")
│   │   │   └── components/            # home-dashboard, resume-sessions, vitals, attention sources
│   │   ├── chat/
│   │   │   ├── page.tsx
│   │   │   ├── queries.ts              # session ops extracted from queries/queries.ts
│   │   │   └── [agent]/
│   │   │       ├── layout.tsx          # PageShell full-bleed + history rail/sheet
│   │   │       ├── components/        # history-rail, session-row
│   │   │       ├── search/page.tsx
│   │   │       └── [session]/
│   │   │           ├── page.tsx
│   │   │           ├── components/    # chat-header, composer, attach-menu, usage-popover, session-files/*
│   │   │           └── hooks/          # use-chat-session.ts (transport + state)
│   │   ├── agents/
│   │   │   ├── page.tsx                # thin: guard + compose
│   │   │   ├── components/            # agent-row, agent-detail-panel, create dialog, avatar-generator
│   │   │   ├── queries.ts              # agent-only ops; AGENT_FIELDS fragment if single-feature
│   │   │   ├── hooks.ts                # use-agents.ts data hooks
│   │   │   └── edit/[id]/
│   │   │       ├── page.tsx
│   │   │       ├── sections/          # basics, instructions, tools, knowledge, chat-experience,
│   │   │       │                       #   access, safety, appearance, developer (ladder-level split)
│   │   │       └── components/        # editor-header, hierarchy-view, tool-card
│   │   ├── data/                       # Knowledge (route name kept; nav label "Knowledge")
│   │   │   ├── page.tsx                # context library (L1)
│   │   │   ├── [ctx]/page.tsx          # per-context workspace (tab/view/item via searchParams)
│   │   │   ├── [[...query]]/page.tsx   # redirect shim only — legacy URL shapes → new routes
│   │   │   ├── components/            # context-library, usage-panel, items-table, item-panel,
│   │   │   │                           #   pipeline-tab, stage-card, activity-list, item-form-fields
│   │   │   └── queries.ts              # incl. dynamic GET_ITEMS/UPDATE_ITEM factories (hand-typed, codegen-excluded)
│   │   ├── models/{page.tsx, create/, edit/[id]/, components/, queries.ts}
│   │   ├── prompts/{page.tsx, [id]/, components/, queries.ts}        # uses hooks/use-prompts + lib/prompts
│   │   ├── skills/{page.tsx, [skillId]/, components/, queries.ts}
│   │   ├── workflows/{page.tsx, components/, queries.ts}             # routine-panel.tsx lives here
│   │   ├── evals/{page.tsx, cases/, [id]/, components/, queries.ts}
│   │   ├── users/{page.tsx, components/, queries.ts}                 # Access area host (Users · Roles · Teams tabs)
│   │   ├── roles/{page.tsx, components/}                             # role-panel, permission-matrix
│   │   ├── teams/{page.tsx, components/}                             # team-panel
│   │   ├── budgets/{page.tsx, components/}                           # entity-budget-table, default-policy
│   │   ├── analytics/{page.tsx, components/}                         # analytics-view
│   │   ├── variables/{page.tsx, create/, edit/[variableId]/, usage/[variableId]/, components/, queries.ts}
│   │   ├── keys/{page.tsx, components/}                              # keys-table, key-create-dialog, key-detail-sheet
│   │   ├── token/page.tsx
│   │   ├── explorer/{page.tsx, graphiql.tsx, graphiql.css, components/}  # examples-plugin, credentials-menu,
│   │   │                                                                  #   mobile-toolkit; CSS colocated (out of app/)
│   │   ├── configuration/{page.tsx, components/}                     # theme-editor, theme-preview, import-css-dialog
│   │   ├── settings/page.tsx
│   │   ├── transcriptions/{page.tsx, components/, hooks/}            # composer, job-row, review-sheet,
│   │   │                                                              #   audio-timeline, use-transcription-jobs
│   │   ├── projects/{page.tsx, [project]/, components/}              # sessions-tab, files-tab, settings-tab, item-card
│   │   ├── feedback/{page.tsx, components/, hooks/}                  # feedback-list, feedback-toolbar,
│   │   │                                                              #   feedback-detail-panel, use-feedback-query
│   │   └── n8n/page.tsx
│   ├── (authentication)/
│   │   ├── layout.tsx                  # thin: wraps components/shell/auth-shell
│   │   └── login/{page.tsx, login.tsx, error.tsx, components/}       # otp-step, auth-error-alert
│   ├── api/{config/, auth/[...nextauth]/}
│   └── globals.css                     # tokens only after design-system R8; feature CSS colocates
│
├── components/
│   ├── ui/                             # VENDORED SHADCN ONLY — no Apollo, no app types, no queries
│   ├── primitives/                     # the shared bones (§2) — presentational, zero data fetching
│   ├── widgets/                        # data-aware shared composites used by 2+ features (§2.4)
│   ├── shell/                          # main-nav, providers (theme/language/config), auth-shell,
│   │                                   #   locale-switcher, logo, navigation error boundary
│   └── ai-elements/                    # vendored Vercel AI Elements (prune unused after chat redesign)
│
├── lib/                                # framework-agnostic logic — no JSX
│   ├── utils.ts                        # cn() — path fixed by components.json, does not move
│   ├── api/                            # REST: client.ts (ONE request() helper replacing skillsRequest/
│   │   │                               #   sessionsRequest/budgetsRequest), files.ts, skills.ts,
│   │   └── …                           #   session-files.ts, budgets.ts, config.ts — all exports `<domain>Api`
│   ├── graphql/
│   │   ├── server.ts                   # ex util/fetch-graphql-server-side.ts
│   │   ├── fragments.ts                # shared field fragments (CONTEXT_FIELDS, AGENT_FIELDS, …)
│   │   ├── operations/                 # multi-feature ops by domain: agents.ts, sessions.ts, users.ts, …
│   │   └── __generated__/              # codegen output (D6)
│   ├── enums/                          # SINGLE enum home: absorbs util/enums/, types/enums/, lib/enum-utils.ts
│   ├── prompts/                        # existing well-formed module — unchanged (keeps its barrel)
│   ├── rights.ts                       # shared RBAC predicates (extracted from main-nav buildNavigation)
│   ├── budget.ts                       # canonical budget-level math (status-filter contract source)
│   ├── fonts.ts                        # + Inter 500/600 (design-system R4)
│   ├── server-side-auth-check.ts       # + 'api' role key fix (explorer/keys/settings docs)
│   ├── theme-defaults.ts               # token manifest (configuration page)
│   ├── provider-brands.ts              # interim provider→brand map (models page)
│   └── workflow-access.ts              # workflow access predicate (workflows page)
│
├── hooks/                              # CROSS-FEATURE hooks only
│   ├── use-mobile.tsx
│   ├── use-uppy.tsx                    # FilePicker dependency
│   ├── use-prompts.ts                  # consumed by prompts + chat selector + agents form
│   ├── use-skills.ts
│   └── use-contexts.ts                 # renamed from contexts.tsx; 20-item cap removed
│
├── queries/queries.ts                  # TRANSITIONAL — shrinks monotonically (§4), then deleted
├── types/                              # TRANSITIONAL — hand-written models, replaced by codegen per feature;
│                                       #   @EXULU_SHARED alias frozen (18 files) until retirement
├── i18n/config.ts                      # single source for locales (proxy.ts imports it — M7 fix)
├── messages/{en,de}.json               # per-feature namespaces (§3.5); CI key-parity check
├── proxy.ts                            # imports i18n/config.ts instead of re-declaring constants
├── codegen.ts                          # fixed URL; outputs lib/graphql/__generated__/ (D6)
├── scripts/                            # select-env.js, add-shebang-to-server.js, check-messages.js (new)
├── package/                            # npm distribution wrapper (unchanged; fix stale next pin, audit L2)
└── design/                             # this plan; PROMPT_LIBRARY_SPEC.md moves here
```

**Deleted outright** (capability-free dead weight; audit M5/L4/H1, page docs):
root `index.ts`, `custom.d.ts`, `remove-bg.js` (rotate the leaked PhotoRoom/TinyPNG keys),
`ngrok.{bash,md,yml}`, `components/icons.tsx`, `components/runs-table.tsx`,
`components/callout.tsx`, `components/main-loader.{tsx,css}`,
`components/custom/{dashboard-main-chart,query-examples,code-display-block,date-range-picker}.tsx`,
`icons/` (after swapping the one `CopyIcon` import for lucide `Copy`),
`app/(application)/home.css`, `app/(application)/data/components/{nav,search-bar,chart}.tsx`,
`app/(application)/users/data/schema.ts` (duplicate `User`), `apollo.config.json`,
`graphql.config.yml`, `components/ui/{toast,toaster,use-toast}` (after sonner migration).
`components/custom/` dissolves entirely: main-nav → `shell/`, code-preview/text-preview →
`primitives/`, recent-embeddings/recent-processings → absorbed by knowledge's ActivityList.

### 1.1 Feature module shape (the standard)

```
app/(application)/<feature>/
  page.tsx        # thin: server guard (RBAC redirect/AccessDenied) + composition only
  components/     # route-local components, organized by ladder level when large
                  #   (L1 surface, L2 panels, L3 dialogs — one component per level, audit rec 13)
  queries.ts      # GraphQL ops consumed ONLY by this feature
  hooks.ts        # use-<feature>.ts data hooks (folder hooks/ when >3)
  types.ts        # feature types until codegen covers them
```

Graduation rule (both directions): code lives with its only consumer. A component/op/hook
moves **up** (to `components/widgets|primitives/`, `lib/graphql/operations/`, `hooks/`) only
when it gains a second importer from another feature. Never import from another feature's
folder — that is the lint-enforced signal that something must graduate.

### 1.2 Import rules per tier (lint-enforced)

| Tier | May import | Must NOT import |
|---|---|---|
| `components/ui/` | react, radix, cva, lucide, `lib/utils` | Apollo, `lib/api`, `lib/graphql`, queries, app types, other tiers |
| `components/primitives/` | ui, lucide, next/link, next-intl (`common` ns only) | Apollo, `lib/api`, `lib/graphql`, `app/` |
| `components/widgets/` | primitives, ui, Apollo, `lib/*`, `hooks/` | `app/` (feature folders) |
| `components/shell/` | widgets, primitives, ui, `lib/*` | feature folders |
| `app/(application)/<feature>/` | everything above | **other features' folders** |

Enforced via `eslint-plugin-boundaries` (or `no-restricted-imports` patterns) added in Wave 0.
Additional Wave-0 lint: `no-console: ["error", {allow:["warn","error"]}]`,
`no-restricted-globals` banning `confirm`/`prompt`, ban on `@/util/*` and
`@/queries/queries` imports **in migrated folders**, `react/jsx-no-literals` scoped to
migrated folders (i18n exit criterion, audit rec 10).

### 1.3 Page-doc path resolver

Page docs were written before this document; their path references resolve as follows:

| Page-doc reference | Canonical target |
|---|---|
| `components/shared/<x>.tsx` (dashboard, knowledge, workflows docs) | `components/primitives/<x>.tsx` or `components/widgets/<x>.tsx` per §2 registry |
| `components/home/*` (dashboard doc) | `app/(application)/(home)/components/*` |
| `components/chat/*` (chat doc) | `app/(application)/chat/[agent]/…/components/*` |
| `components/custom/keys/*` (keys-token doc) | `app/(application)/keys/components/*` |
| `components/custom/explorer/*` (explorer doc) | `app/(application)/explorer/components/*` |
| `components/projects/*`, `components/transcriptions/*` | `app/(application)/<feature>/components/*` |
| `components/auth-shell.tsx` (auth doc) | `components/shell/auth-shell.tsx` |
| `components/prompt-content.tsx` (prompts doc) | `components/primitives/prompt-content.tsx` |
| `queries/queries.ts — add X` (several docs) | apply wherever the op lives at implementation time (monolith or its extracted home) |
| `util/api.ts — add X` (budgets doc) | `lib/api/budgets.ts` |
| `app/graphiql.css` | `app/(application)/explorer/graphiql.css` (colocated) |

---

## 2. Shared layout primitives

All philosophy §5 bones plus every primitive proposed across the twenty page docs, deduplicated.
**Location rule:** presentational, data-in-via-props → `components/primitives/`;
data-aware (fetches, mutates, polls) → `components/widgets/`; shell furniture → `components/shell/`.
File names kebab-case; one primary export per file; no barrels.

### 2.1 Merges & aliases (one pattern per job)

| Page-doc names | Canonical primitive | Note |
|---|---|---|
| QueuePanel (knowledge, evals) / QueueManager (workflows) | **QueuePanel** | promoted from `evals/[id]/runs/components/queue-management.tsx`; gains `canWrite` |
| BulkActionBar (budgets, models, users) / SelectionBar (feedback) | **BulkActionBar** | sticky-bottom variant on mobile |
| SaveBar (agents) / UnsavedChangesBar + dirty-state pattern (settings-config) | **SaveBar** | `mode: "save" \| "publish"`; owns the navigation guard |
| SettingsSection (settings) / FormSection (models, variables, access) | **FormSection** | `collapsible?: boolean` (default false = the SettingsSection shape) |
| AccessBadge / RightsModeLabel (skills, models) | **AccessBadge** | fixes the unknown-mode fallback once ("Restricted", never "Public") |
| ScoreCell / ScoreBadge (evals) | **ScoreBadge** | evals keeps a local `ScoreCell` table wrapper |
| RelativeTime (projects) / RelativeTime + use-ticker (transcriptions, feedback) | **RelativeTime** | live tick scoped inside the component |
| "Inline destructive confirm in-dialog" (budgets) / ConfirmDialog options slot (projects) | **ConfirmDialog** + documented in-dialog pattern | both documented in one place; never modal-on-modal |
| "Table skeleton loading pattern" (budgets) | built into **DataTable** | skeleton rows mirror columns |

### 2.2 Core bones (philosophy §5)

`components/primitives/` — consumed by effectively every page; prop sketches:

```tsx
// page-shell.tsx — three named widths, no per-page values (design-system R2/R3).
// NEVER hides content by breakpoint (kills the `hidden md:flex` shells, design-system H2).
interface PageShellProps {
  variant?: "content" | "narrow" | "full-bleed"; // max-w-7xl p-4 md:p-8 | max-w-2xl | edge-to-edge bounded height
  children: ReactNode;
}

// page-header.tsx — h1 text-2xl font-semibold tracking-tight; ONE per page.
// density="compact" for full-bleed work surfaces (explorer, skills editor, n8n, chat).
interface PageHeaderProps {
  title: string;
  description?: string;            // one-line purpose, text-sm text-muted-foreground
  action?: ReactNode;              // THE primary action (purple budget lives here)
  breadcrumb?: { label: string; href: string };
  density?: "default" | "compact";
  meta?: ReactNode;                // quiet inline summary (e.g. budgets default-policy line)
}

// toolbar.tsx — search + filters + view switches, identical placement under PageHeader.
interface ToolbarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder: string; debounceMs?: number }; // 300ms default
  filters?: ReactNode;             // Selects / EntityCombobox slots
  view?: ReactNode;                // view-switch / column-visibility slot
  selection?: ReactNode;           // BulkActionBar slot when rows selected
}

// list-detail.tsx — THE collection pattern: list left/top, detail as panel (≥lg) or Sheet (<lg)
// or subpage. Owns selection↔URL sync (?selected= / subroute).
interface ListDetailProps<T> {
  list: ReactNode;                 // usually <DataTable/> or a slim row list
  detail: (item: T) => ReactNode;  // rendered in SidePanel / Sheet / static pane
  selected?: T | null;
  onSelect: (item: T | null) => void;
  detailMode?: "panel" | "page" | "static"; // static = prompts' always-visible right pane
  emptyDetail?: ReactNode;         // quiet EmptyState variant when nothing selected
}

// data-table.tsx — ONE generic TanStack wrapper replacing the 7 copies (audit H2, design-system H7).
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  loading?: boolean;               // skeleton rows mirroring columns (the table-skeleton pattern)
  error?: { message: string; onRetry: () => void } | null; // inline error + Retry — never the empty row
  pagination?: { pageInfo: PageInfo; onPageChange: (p: number) => void }; // server-side
  sorting?: { state: SortingState; onChange: (s: SortingState) => void }; // server-side
  selection?: { selected: string[]; onChange: (ids: string[]) => void };
  onRowClick?: (row: T) => void;
  empty: EmptyStateProps;          // built-in EmptyState (gated on successful response)
  mobileCard?: (row: T) => ReactNode; // tables→cards below md — mandatory, no horizontal scroll
}

// empty-state.tsx — icon, one sentence of value, one primary action (philosophy §5).
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void } | { label: string; href: string };
  variant?: "default" | "quiet" | "error"; // quiet = detail-pane placeholder; error adds Retry styling
}

// stat-card.tsx — extracted from components/dashboard/summary-cards.tsx (ASI bug fixed first).
interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  loading?: boolean;
  href?: string;                   // e.g. Home → /analytics?type=…
  icon?: LucideIcon;
}

// chart-card.tsx — the only other dashboard widget shape; chart content via children.
interface ChartCardProps {
  title: string;
  description?: string;
  toolbar?: ReactNode;             // RangePicker / lens controls
  loading?: boolean;
  error?: { message: string; onRetry: () => void } | null;
  children: ReactNode;
}

// confirm-dialog.tsx — THE destructive confirmation (replaces 12+ native confirm() + 13 AlertDialogs).
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;         // blast-radius statement (variables/access docs)
  variant?: "destructive" | "default";
  confirmLabel?: string;           // defaults from common.* i18n
  typeToConfirm?: string;          // agents/workflows type-the-name friction
  options?: { id: string; label: string; count?: number }[]; // cascade checkboxes (projects/evals/knowledge)
  onConfirm: (optionIds?: string[]) => Promise<void>; // async pending state built in
  errors?: { item: string; message: string }[]; // per-item bulk failure report (access U4)
  children?: ReactNode;            // extension slot
}
// Documented alongside: the in-dialog two-step inline confirm pattern for deletes that
// originate INSIDE an open dialog (budgets editor) — one overlay at a time, never modal-on-modal.
```

### 2.3 Generic primitives (`components/primitives/`)

| Primitive | File | Prop sketch | Consumers |
|---|---|---|---|
| **SidePanel** | `side-panel.tsx` | `{ open, onOpenChange, width?: number; resizable?: boolean; children }` — resizable desktop panel, degrades to Sheet `<lg` | chat, knowledge item panel, models/variables/users/feedback detail panels, workflows routine panel, evals sheets, transcriptions review |
| **OverflowMenu** | `overflow-menu.tsx` | `{ items: {label, icon?, onSelect, destructive?, disabled?, shortcut?}[]; align? }` — the standardized ⋯ menu, ARIA-labeled | chat header, every list-row action set, evals run columns, skills rows/editor |
| **WidgetSection** | `widget-section.tsx` | `{ title, allowed: boolean; href?; children }` — RBAC-gated (predicate result in), error-isolated (ErrorBoundary inside) dashboard region | Home regions; knowledge usage panel |
| **AttentionList** | `attention-list.tsx` | `{ items: {id, severity:"error"\|"warn", title, meta?, href}[]; loading?; allClearLabel }` — presentational cross-domain feed; sources composed per page | Home, /budgets (over/at-risk), /evals (failing) |
| **RelativeTime** | `relative-time.tsx` | `{ date: Date\|string; live?: boolean }` — "2d ago" + absolute tooltip, locale-aware, 1s tick scoped inside | projects, chat history, prompts, feedback, transcriptions, keys, variables, Home |
| **FavoriteToggle** | `favorite-toggle.tsx` | `{ pressed: boolean; onToggle: () => void; label: string }` — star with `aria-pressed` | projects, prompts |
| **SectionNav** | `section-nav.tsx` | `{ sections: {id, label}[]; activeId; onSelect }` — sticky anchored nav for long editors | agents editor; future long forms |
| **SaveBar** | `save-bar.tsx` | `{ dirty: boolean; saving?: boolean; mode?: "save"\|"publish"; onSave; onDiscard; summary? }` — sticky dirty-state bar + navigation guard | agents editor, /configuration publish, /settings, skills editor |
| **SettingRow** | `setting-row.tsx` | `{ label, description?, children /* the control */ }` | agents sections, /settings, models form, budgets policy |
| **FormSection** | `form-section.tsx` | `{ title, description?, collapsible?: boolean; summary?: string /* collapsed header value */; children }` — the L3 "Advanced" pattern | models/variables forms, access panels, /settings, agents |
| **CopyButton** | `copy-button.tsx` | `{ value: string; label: string /* aria */ }` — icon button + clipboard + check feedback + toast | explorer, prompts, /keys, /token, models, knowledge, transcriptions |
| **CopyField** | `copy-field.tsx` | `{ value: string; label?: string; mono?: boolean }` — mono value + CopyButton | /token, /keys, agents developer section, models detail, variables, access |
| **SecretField** | `secret-field.tsx` | `{ getValue: () => Promise<string>; masked?: string; remaskAfterMs?: number; canCopyWithoutReveal?: boolean; onReveal? /* audit hook */ }` — canonical L3 secret pattern; never holds the value before reveal | /variables, /keys reveal, /token, model form credentials, users token field |
| **StatusDot** | `status-dot.tsx` | `{ status: "success"\|"warning"\|"error"\|"info"\|"muted"; label?: string; pulse?: boolean }` — semantic tokens only (requires design-system R1) | models, access/users, evals, workflows, agents, transcriptions, Home |
| **AccessBadge** | `access-badge.tsx` | `{ mode: "private"\|"users"\|"roles"\|"teams"\|"public"\|undefined; counts?: {users?, roles?, teams?} }` — unknown renders "Restricted" | skills, models, prompts, agents, workflows, knowledge, projects |
| **SearchableSelect** | `searchable-select.tsx` | `{ options: {value,label,icon?}[]; value; onChange; placeholder; disabled? }` — Popover+Command, local options | models (reranker/model selector), access selectors, RBAC pickers, agents |
| **InlineEditCell** | `inline-edit-cell.tsx` | `{ display: ReactNode; editor: ReactNode /* SearchableSelect */; confirm?: Partial<ConfirmDialogProps>; onCommit: (v) => Promise<void> }` | access (role/team cells), keys (role) |
| **InputDialog** | `input-dialog.tsx` | `{ open, onOpenChange, title, label, defaultValue?, validate?, onSubmit: (v: string) => Promise<void> }` — single-field create/rename/label | skills (×4), prompts/agents/knowledge rename flows |
| **RawJsonView** | `raw-json-view.tsx` | `{ data: unknown; collapsed?: boolean; label?: string }` — the standard L4 toggle, `font-mono` | models detail, users detail, evals results, knowledge item |
| **BulkActionBar** | `bulk-action-bar.tsx` | `{ count: number; onClear: () => void; actions: {label, onClick, destructive?}[] }` — sticky-bottom `<md` | budgets, models, users, variables, feedback, keys |
| **AccessDenied** | `access-denied.tsx` | `{ requiredRight?: string; backHref?: string }` — shared RBAC-denied state (EmptyState composition) | evals, explorer, keys, feedback, configuration, variables |
| **ScoreBadge** | `score-badge.tsx` | `{ score: number; thresholds?: {pass: number; warn: number} }` — threshold-colored, semantic tokens | evals matrix, Home P4 widget |
| **RankedList** | `ranked-list.tsx` | `{ items: {id, label, value: number, href?}[]; max?: number; format?: (v) => string }` — refactored leaderboard | analytics Breakdown, budgets top-spenders |
| **RangePicker** | `range-picker.tsx` | `{ value: DateRange; onChange; presets?: {label, range}[] }` — wraps DateRangeSelector logic; inner API stays stable for /data | analytics, knowledge usage panel, Home |
| **Dropzone** | `dropzone.tsx` | `{ onFiles: (files: File[]) => void; accept?: string[]; hint?: string; disabled? }` — dashed drag-and-drop + click-to-browse | transcriptions composer, chat attachments, knowledge upload |
| **PromptContent** | `prompt-content.tsx` | `{ content: string }` — safe `{{variable}}` chip renderer (split-on-regex, Badge chips; extracted from prompt-selector-modal) | prompts detail, chat prompt selector, future evals |
| **DetailSection** | `detail-section.tsx` | `{ title; meta?: string\|number /* badge */; collapsible?: boolean; children }` — titled section for detail panels | knowledge item panel, models/variables/users panels |
| **CodePreview / TextPreview** | `code-preview.tsx`, `text-preview.tsx` | moved from `components/custom/` (4–5 importers each); re-tokened backgrounds (design-system R6) | knowledge, chat, skills |

### 2.4 Data-aware shared composites (`components/widgets/`)

| Widget | File | Prop sketch / contract | Consumers |
|---|---|---|---|
| **QueuePanel** | `queue-panel.tsx` | `{ queueName: string; nameGenerator?; retryJob?; canWrite: boolean }` — promoted from evals' queue-management.tsx; themed badges, mobile cards, gated mutations, ConfirmDialog adoption | evals, knowledge pipeline, workflows |
| **FilePicker** | `file-picker.tsx` | promoted `components/uppy-dashboard.tsx`; **all five public exports stay API-stable** (`UppyDashboard`-equivalent default, `FileGalleryAndUpload`, `FileItem`, `FileDataCard`, `getPresignedUrl`) — the knowledge doc's 11-consumer list is the acceptance contract | knowledge, agents, evals cases, transcriptions, chat, save-workflow-modal, image-gen, message-renderer, lottie, ai-elements/response |
| **FilterPanel** | `filter-panel.tsx` | `{ fields: FilterFieldDef[]; value; onChange; preview?: {count?: number, loading?}; batchLimit? }` — generalizes knowledge's ItemsFilter | knowledge items; future feedback/evals filters |
| **EntityCombobox** | `entity-combobox.tsx` | `{ entity: "user"\|"agent"\|"role"\|"team"; value; onChange; preload?: number /* ~20 */ }` — async server-searching picker (debounced `contains`) | feedback, analytics, budgets, evals filters |
| **RunInspector** | `run-inspector.tsx` | `{ kind: "workflow"; subjectId: string; onRetry? }` — run history + detail (absorbs LastRunCell/run-history) | workflows; candidate for evals run detail |
| **ScheduleEditor** | `schedule-editor.tsx` | `{ subjectId; schedule?: {cron, next}; onSave; onRemove }` — absorbs ScheduleManagementDialog with prefill | workflows |
| **RBACControl** | `rbac-control.tsx` | moved from `components/rbac.tsx`; `+ subjectLabel` prop (context-blind copy fix), `allowedModes`, 4-arg `onChange` incl. teams | agents, models, prompts, skills, workflows, transcriptions, projects, evals |
| **MessageRenderer** | `message-renderer.tsx` | moved from flat `components/`; decomposed during chat redesign; read-only mode is feedback-replay's contract | chat, feedback replay |
| **ItemsSelectionModal** | `items-selection-modal.tsx` | moved from flat `components/`; public API (`onConfirm/onSelectContext/onApplyPreset`) frozen | chat, projects, knowledge |
| **BudgetBar** | `budget-bar.tsx` | props stay backward-compatible (chat composer + editor consumers) | budgets, chat |
| **Charts** | `time-series-chart.tsx`, `donut-chart.tsx` | moved from `components/dashboard/`; token-driven (`--chart-1..10` defined per analytics doc); lens via props | analytics, Home, knowledge usage |
| **AgentSelectionDialog, ToolCallApproval, ImageGeneration\*, FeedbackDialog/Chat, SaveWorkflowModal, SavePresetModal, ItemFormFields, PromptVariableForm** | own files | existing cross-feature components relocated as-is (re-tokened per design-system R6); each moves when its primary page is redesigned | per current importers |

### 2.5 Shell (`components/shell/`)

| Component | File | Contract | Consumers |
|---|---|---|---|
| **MainNav** | `main-nav.tsx` | moved from `components/custom/`; persona-grouped nav reading `lib/rights.ts` predicates (nav and Home never disagree) | app shell |
| **Providers** | `theme-provider.tsx`, `language-provider.tsx`, `config-context.tsx` | moved from flat `components/` | both layouts |
| **AuthShell** | `auth-shell.tsx` | `{ children /* the column */ }` — branded pre-auth frame: theme injection, centered column, cover pane, slim footer w/ LocaleSwitcher | login, login error boundary, future pre-auth surfaces |
| **LocaleSwitcher** | `locale-switcher.tsx` | `{ variant?: "footer" \| "menu" }` — EN/DE toggle writing `NEXT_LOCALE` | AuthShell, shell Personal area, /settings |
| **Logo** | `logo.tsx` | moved; `resolvedTheme` + stable pre-hydration placeholder | AuthShell, MainNav brand slot |

---

## 3. Conventions

### 3.1 Naming

- **Files:** kebab-case, no exceptions (already 100% — keep the streak).
- **Components:** PascalCase export; one primary component per file; file name = component name kebab-cased.
- **Hooks:** `use-*.ts(x)` file, `useX` export. Rename `hooks/contexts.tsx` → `hooks/use-contexts.ts`.
- **Route params:** camelCase. Rename `[variable_id]` → `[variableId]` (2 segments). Keep `[id]` (majority convention) and existing `[agent]`/`[session]`/`[project]`/`[skillId]`/`[ctx]`.
- **GraphQL:** op constants SCREAMING_SNAKE (`GET_AGENTS`); operation names PascalCase and globally unique (fix the duplicate `AgentCallsStatistics`, analytics doc).
- **REST namespaces:** uniformly `<domain>Api` (`filesApi`, `configApi` — ends the `files` vs `skillsApi` split).
- **Icons:** direct `lucide-react` imports (the 162-file de-facto standard); `size-N` notation; global stroke-width 1.

### 3.2 Data fetching (standardize on the dominant pattern)

- **Apollo is the single client-side stack** (87 files; TanStack Query's 3 consumers — graphiql, lottie, uppy-dashboard — rewritten to plain fetch/Apollo, provider + dependency removed).
- **Client config (Wave 0):** memoized construction; `errorPolicy: "all"` with surfaced errors (philosophy §8). The `no-cache` → `cache-first` flip happens **per feature** as its data hooks land (each hook sets an explicit `fetchPolicy`), so cache semantics change only on surfaces being actively redesigned and tested.
- **Feature data hooks:** redesigned pages never call `useQuery(GET_X)` inline. Each feature exposes `use<Domain>()` hooks (in `<feature>/hooks.ts` or `hooks/` if cross-feature) that own: fetch policy, polling cadence (consolidated — no per-row queries; N+1 is banned, batched/aggregate queries or capped per-page combined queries instead), loading/error contracts matching DataTable's props, optimistic updates.
- **Server components:** `lib/server-side-auth-check.ts` + `lib/graphql/server.ts`. Page-level RBAC guards run server-side (redirect or AccessDenied) per the keys/feedback/configuration docs.
- **REST:** `lib/api/<domain>.ts` over the single `request()` helper in `lib/api/client.ts`.
- **GraphQL ops:** single-feature → `<feature>/queries.ts`; multi-feature → `lib/graphql/operations/<domain>.ts`; shared fragments → `lib/graphql/fragments.ts`; dynamic knowledge factories stay in `data/queries.ts`, hand-typed, excluded from codegen.

### 3.3 Where components live

Decision tree, in order:
1. Used by one route → `app/(application)/<feature>/components/`.
2. Used by 2+ features, presentational → `components/primitives/`.
3. Used by 2+ features, data-aware → `components/widgets/`.
4. Shell/provider/pre-auth → `components/shell/`.
5. Vendored → `components/ui/` (shadcn) or `components/ai-elements/` — never edited beyond re-vendoring.

Large feature surfaces split by disclosure-ladder level (one component per level), not by
arbitrary size: the chat/agents/knowledge god files decompose into L1 surface + L2 panels +
L3 dialogs at their redesign (audit rec 13).

### 3.4 Barrel exports

None in app code (D8). Import the file: `@/components/primitives/page-header`. Exceptions:
`components/ai-elements/` (vendored kit) and `lib/prompts/` (existing module, grandfathered).
During migration, temporary re-export shims are allowed for **one release** per moved module,
tagged `// MIGRATION-SHIM: remove by <date>`.

### 3.5 i18n

- **Namespace = feature** (camelCase of the feature folder; knowledge uses `knowledge` despite the `/data` route): `chat.*`, `agents.*`, `knowledge.*`, `models.*`, `evals.*`, `prompts.*`, `skills.*`, `workflows.*`, `variables.*`, `access.*` (users+roles+teams), `budgets.*`, `analytics.*`, `keys.*`, `token.*`, `settings.*`, `configuration.*`, `transcriptions.*`, `projects.*`, `feedbackReview.*` (triage console) vs `feedback.*` (submit widget), `auth.*`, `home.*`, `explorer.*`. Shared: `common.*` (primitive built-ins: cancel/confirm/delete/copy/copied/search/retry/noResults), `navigation.*`.
- Keys camelCase, max depth 3 (`namespace.section.key`).
- **Primitives** use `useTranslations("common")` for their built-in strings only; all other copy arrives via props — so primitives are translated once, on day one (design-system R12).
- **Exit criterion per redesigned page:** zero hardcoded user-facing strings (lint-scoped `react/jsx-no-literals`), en + de keys land in the same PR, `scripts/check-messages.js` (new, CI) asserts en/de key-set parity.
- Plumbing fixes (Wave 0): `proxy.ts` imports `i18n/config.ts`; `<html lang>` reflects the active locale in both layouts; `I18N_GUIDE.md` rewritten (`getTranslations` server API, `proxy.ts` reference).

### 3.6 Misc

- **Toasts:** sonner only; `<Toaster/>` mounted once in each root layout.
- **Confirmation:** ConfirmDialog only; native `confirm()`/`prompt()` lint-banned.
- **CSS:** tokens in `globals.css`; feature CSS colocates with its feature (graphiql.css, chat-table styles move out of globals per design-system R8/L1).
- **`@EXULU_SHARED/*` alias:** frozen — no new usages (18 today); retired when `types/` dissolves into codegen + feature types.

---

## 4. Migration strategy

Principle: **bulk moves only where mechanical and behavior-free; structural migration rides
each page redesign** (the page is being rebuilt and QA'd anyway — that's when its files move,
its queries extract, its strings translate, and its god file decomposes). Nothing migrates
"for tidiness" ahead of its redesign.

### Wave 0 — bulk hygiene (before/alongside the first redesigned page; ~2–4 days, all mechanical)

1. **Security:** delete `remove-bg.js`; rotate the PhotoRoom + TinyPNG keys; add secret scanning (audit H1).
2. **Dead-file sweep:** the full deletion list in §1 (zero importers verified by the audit; re-verify at execution). Move `PROMPT_LIBRARY_SPEC.md` → `design/`.
3. **`util/` → `lib/`:** split `util/api.ts` into `lib/api/*` with one `request()`; `fetch-graphql-server-side.ts` → `lib/graphql/server.ts`; consolidate the three enum homes into `lib/enums/`; fix the `lib/budget.ts` ↔ `util/api.ts` circular pairing. ~30 import sites, codemod + single atomic PR. `util/` deleted.
4. **Apollo client:** memoize; `errorPolicy: "all"`; remove TanStack Query (rewrite 3 consumers, drop provider + dependency). No fetch-policy flip yet (see §3.2).
5. **Toasts:** migrate 53 `use-toast` call sites to sonner; delete `ui/toast.tsx`/`toaster.tsx`/`use-toast.ts`; unmount the radix Toaster.
6. **`components/ui/` purge:** move the 10 app components out (`role-selector`/`team-selector` → `widgets/`; `navigation`, `mode-toggle` → `shell/`; `markdown-editor`, `rating`, `sortable`, `loading*` → `primitives/` or deletion per design-system R10); flatten `shadcn-io/*`.
7. **Shell relocations (no behavior change):** `components/custom/main-nav.tsx` → `components/shell/`; providers → `components/shell/`; extract `lib/rights.ts` from `buildNavigation` (Home depends on it).
8. **GraphQL tooling:** fix `codegen.ts` (real introspection URL, output `lib/graphql/__generated__/`); delete `apollo.config.json` + `graphql.config.yml`; run a codegen spike — if the dynamic knowledge factories or schema quirks make it impractical, fall back to explicit ownership of `types/models/` and delete `codegen.ts` too (the half-state is the worst option, audit M4).
9. **Lint guardrails:** the §1.2 boundary rules, `no-console`, `no-restricted-globals` (confirm/prompt), `@/util` ban, scoped `jsx-no-literals`; strip the 110 `console.log`s.
10. **i18n plumbing:** proxy/config dedupe, `<html lang>`, guide rewrite, `scripts/check-messages.js`.

### Wave 1 — primitives (built on demand, to spec)

Primitives are **built by the first consuming page's redesign, but to this document's spec**,
reviewed against §2 — never page-flavored. Build order follows the page schedule; the
universal eight (PageShell, PageHeader, Toolbar, DataTable, ListDetail, EmptyState,
ConfirmDialog, EmptyState's quiet/error variants) plus StatusDot/OverflowMenu/CopyButton are
needed by virtually every page and should land with the first two list-page redesigns
(keys-token and transcriptions are the docs' nominated small early adopters). StatCard/
ChartCard extraction is shared between Home and Analytics — coordinate so it happens once.
If a page ships before a primitive it needs, it builds a **local stub with the §2 API**
(dashboard/budgets docs already commit to this) and swaps imports when the primitive lands.

### Wave 2 — per-page migration (ships with each page redesign)

When `design/pages/<page>.md` is implemented, that PR also:

1. Moves the page's single-importer components from flat `components/` into
   `<feature>/components/` (e.g. `role-form.tsx` → roles, `budget-editor.tsx` → budgets,
   `tag-selector.tsx`/`reranker-selector.tsx` → their owners, `session-files/` → chat).
2. Extracts its GraphQL ops from `queries/queries.ts` into `<feature>/queries.ts` or
   `lib/graphql/operations/<domain>.ts`; updates that domain's importers in the same PR.
   `queries/queries.ts` shrinks monotonically; **once a domain has moved, editing it in the
   monolith is lint-banned**; the file is deleted with the last migrated feature.
3. Replaces its data-table copy with DataTable; deletes the copy (the seven copies die one
   per page; ~30 files total).
4. Adds its i18n namespace (en + de) and turns on scoped `jsx-no-literals` for its folder.
5. Applies its route-param rename if any (`[variable_id]` → `[variableId]` with the
   variables redesign; redirect shims for old URLs where deep links exist — knowledge's
   `[[...query]]` shim is the template).
6. Decomposes its god file along ladder levels (chat.tsx, agents form.tsx,
   data-display.tsx, message-renderer.tsx — each only at its page's turn).
7. Promotions with blast radius (FilePicker/uppy: 11 consumers; RBACControl; QueuePanel:
   evals+workflows+knowledge; ItemsSelectionModal: chat+projects+knowledge) ship behind the
   **consumer acceptance contracts** the page docs enumerate — every consumer compiles and
   behaves unchanged, verified in the promoting PR.

**What stays put (deliberately):**
- `lib/utils.ts` (shadcn-pinned path), `i18n/config.ts`, `messages/*`, `proxy.ts`, `app/api/*`.
- `types/` + `@EXULU_SHARED` until codegen (or explicit ownership) replaces them feature-by-feature.
- `queries/queries.ts` as the shrinking legacy hub — never bulk-exploded in one PR.
- `package/`, release configs, `Dockerfile`, `deploy.sh` (fix the stale `next: 14.2.35` pin opportunistically, audit L2).
- `components/ai-elements/` vendored; pruned (not restructured) after the chat redesign settles its real usage.

### Sequencing summary

```
Wave 0 (one-time, mechanical)  ──►  unblocks everything; no visual change
Wave 1 (with first 2–3 pages)  ──►  primitives exist; review rule "shared bones or written reason" enforceable
Wave 2 (page-by-page)          ──►  each redesign PR = new UI + its slice of the structure migration
Tail                            ──►  delete queries/queries.ts, retire types/+alias, prune ai-elements,
                                     remove migration shims, drop boundary-rule exemptions
```

---

## 5. Risks

1. **Import-path churn.** `@/queries/queries` has 91 importers, `@/util` 30, `@/lib` 150;
   flat `components/` files have scattered consumers. Mitigation: Wave 0 moves land as
   single atomic codemod PRs (zero behavior change → trivial review); Wave 2 moves are
   bounded per domain and land inside the page PR that already owns the QA; one-release
   re-export shims (§3.4) cover stragglers. The riskiest single rename is
   uppy-dashboard → FilePicker (11 consumers) — gated by its acceptance contract.

2. **Merge conflicts with in-flight work.** `queries/queries.ts` and `main-nav.tsx` are the
   repo's hottest files; any feature branch alive during Wave 0 will conflict. Mitigation:
   schedule Wave 0 in a quiet window, communicate a short freeze on those two files, land
   the lint bans immediately after so new code can't re-enter old locations. The
   monotonic-shrink rule for the query monolith means at most one team touches a domain's
   ops at a time.

3. **Codegen / GraphQL config coupling.** Three configs disagree on the schema URL and the
   current output path doesn't exist; IDE GraphQL tooling (Apollo/GraphQL extensions) reads
   the files being deleted. The dynamic knowledge-context factories are string-built and can
   never be codegen'd — they must be explicitly excluded or codegen fails. Mitigation: the
   Wave 0 spike has a written fallback (own `types/models/` explicitly); either outcome
   removes the contradiction. Until resolved, no page migration may *depend* on generated types.

4. **Apollo cache-semantics flip.** Moving from global `no-cache` to per-hook `cache-first`
   changes staleness behavior and (if `addTypename` is enabled for normalization) adds
   `__typename` to payloads — code doing exact object comparisons or spreading results into
   mutations can break. Mitigation: the flip is per-feature inside redesign PRs (§3.2),
   never global; pages keeping polls (queues, transcriptions) set explicit policies.

5. **Release/distribution coupling.** `package/` wraps the standalone build and the repo runs
   dual release lines (`v*` Docker + `npm-v*` package) whose tags break if history is
   rewritten — all moves must be normal commits, no rebases of published branches. Verify
   `Dockerfile`/`deploy.sh`/`scripts/add-shebang-to-server.js` reference no moved paths
   (they currently reference build output, not source — re-check at Wave 0).

6. **Route-shape changes.** `(home)` route group and the knowledge `/data/[ctx]` restructure
   change file paths but not URLs — except knowledge's legacy `[[...query]]` deep links
   (8 shapes, linked from toasts/notifications) and the `[variableId]` rename. Redirect
   shims are part of the owning page's PR; e2e tests targeting old paths must move with them.

7. **Boundary-rule friction.** The §1.2 lint rules will flag existing violations en masse
   (e.g. ui/ files importing Apollo) before Wave 0 completes. Mitigation: enable rules with
   a checked-in exemption list that only shrinks; CI fails on *new* entries.

8. **Two sources of truth during transition.** Until a feature migrates, its ops live in the
   monolith, its strings are hardcoded, and its tables are forks — by design. The risk is a
   "migrated-looking" page consuming unmigrated parts (e.g. a redesigned page importing the
   monolith). Accepted where the page doc says so; tracked by the lint ban list so the tail
   (§4) is enumerable, not archaeological.

---

*Everything above relocates or layers; nothing removes capability. With this structure, the
disclosure ladder is cheap to express (one component per level, colocated), and the shared
bones are impossible to fork (one home, lint-fenced).*
