# Exulu Frontend Redesign — Master Implementation Plan

> The single execution plan for the redesign. It sequences everything specified in
> `design/philosophy.md`, `design/personas.md`, `design/navigation.md`,
> `design/codebase-structure.md`, `design/responsive.md`, and the twenty page docs in
> `design/pages/`. The tracking table in §6 is the living progress tracker — update its
> Status column as work lands. How to use this plan: §7 Working agreement.

---

## 1. Goal & scope

**What this overhaul is:**

- **Reorganization around minimalism, jobs-to-be-done, and progressive disclosure.** Every
  page is rebuilt so its L1 serves its primary persona's #1 job, with every other capability
  relocated onto the disclosure ladder (L0–L4) exactly as its page doc specifies. Three
  words: Calm. Capable. Honest.
- **A fresh app shell.** Persona-grouped, RBAC-trimmed navigation (`design/navigation.md`):
  a pure end user gets a 4–6 item chat app; an admin gets a calm grouped command center.
  Command palette, mobile drawer + top bar, role-composed Home.
- **Codebase restructuring.** Shared layout primitives ("same bones everywhere"), route
  colocation, one data-fetching stack, one toast system, one confirm dialog, one table —
  per `design/codebase-structure.md`. Structure migrates page-by-page with each redesign.
- **Mobile, for real.** 13 of 20 surfaces are broken at 390 px today; every redesigned page
  passes the full responsive definition of done (`design/responsive.md` §5) at
  390/768/1024/1440 in both themes.
- **Design-system normalization.** Semantic color tokens, real font weights, one type
  scale, theme-safe components (`design/audits/design-system.md` recommendations R1–R13).

**What this overhaul is NOT:**

- **No feature removal.** The platform is feature-complete; minimalism means relocating and
  layering, never deleting (philosophy §2, anti-pattern #1). Each page doc's
  **functionality inventory is a hard contract** — every numbered capability must remain
  reachable at its assigned ladder level.
- **No backend changes as part of this plan.** Backend items named by page docs (new role
  keys, budget status endpoint, aggregate queries, `RBACInput.teams`, …) are tracked as
  **external dependencies** per work item; frontend slices that depend on them ship behind
  the documented interim/fallback behavior, never blocked wholesale.
- **No big-bang rewrite.** Bulk moves only where mechanical and behavior-free (Phase 0);
  everything structural rides the page redesign that owns its QA (codebase-structure §4).
- **No new visual language beyond the docs.** CLAUDE.md remains the implementation
  standard (tokens, spacing, animation timings, a11y); philosophy.md wins on what/why.

---

## 2. Phase 0 — Foundations

Mechanical, behavior-preserving (except the listed bug fixes). No page redesign ships
before 0.1; 0.2–0.4 land before or alongside the first redesigned pages. Estimated ~1–1.5
weeks total, parallelizable.

### 0.1 Security & correctness (ships first, independent of everything)

Sources: navigation.md "M0", codebase-structure Wave 0 #1, design-system audit, dashboard.md.

- [ ] Delete `remove-bg.js`; **rotate the leaked PhotoRoom + TinyPNG keys**; add secret
      scanning to CI.
- [ ] Proxy `FEEDBACK_TOKEN` server-side (never shipped to the browser); remove production
      `console.log`s (~110 sites) from `app/` + `components/`.
- [ ] `components/theme-provider.tsx` — stop overriding `defaultTheme` (restores the lost
      `system` option).
- [ ] `app/(application)/layout.tsx` — fix sidebar first-run default
      (`cookie === undefined ? true : cookie === "true"`); remove the orphaned `ldrs` CDN
      script; `<html lang={locale}>` in both layouts.
- [ ] Interim nav active-state fix in `components/custom/main-nav.tsx`: first-segment
      equality, never substring (replaced wholesale in Phase 1).
- [ ] `components/dashboard/summary-cards.tsx` — fix the `isLoading` ASI bug (:112–114).
- [ ] `lib/server-side-auth-check.ts` — add `'api', roles.api` to the role object
      (unblocks the `/explorer`, `/keys`, `/token`, `/settings` RBAC predicates; shared
      dependency of three page docs).

### 0.2 Hygiene & structure (codebase-structure §4 "Wave 0" — single atomic codemod PRs)

- [ ] **Dead-file sweep** per codebase-structure §1 deletion list (re-verify zero importers
      at execution): root `index.ts`, `custom.d.ts`, `ngrok.*`, `components/icons.tsx`,
      `components/runs-table.tsx`, `components/callout.tsx`, `components/main-loader.*`,
      `components/custom/{dashboard-main-chart,query-examples,code-display-block,date-range-picker}.tsx`,
      `icons/` (swap the one `CopyIcon` import for lucide `Copy`),
      `app/(application)/home.css`, `app/(application)/data/components/{nav,search-bar,chart}.tsx`,
      `app/(application)/users/data/schema.ts`, `apollo.config.json`, `graphql.config.yml`.
      Move `PROMPT_LIBRARY_SPEC.md` → `design/`.
- [ ] **`util/` → `lib/`**: split `util/api.ts` into `lib/api/{client,files,skills,
      session-files,budgets,config}.ts` with ONE `request()` helper; all exports `<domain>Api`.
      `util/fetch-graphql-server-side.ts` → `lib/graphql/server.ts`. Consolidate the three
      enum homes into `lib/enums/`. Fix the `lib/budget.ts` ↔ `util/api.ts` circular pair.
      Delete `util/`.
- [ ] **Apollo**: memoize client construction in `app/(application)/authenticated.tsx`;
      `errorPolicy: "all"` with surfaced errors; **remove TanStack Query** (rewrite the 3
      consumers, drop provider + dependency). No global fetch-policy flip — per-feature in
      Wave 2.
- [ ] **Toasts**: migrate 53 `use-toast` call sites to sonner; delete
      `components/ui/{toast,toaster,use-toast}`; one `<Toaster/>` (sonner) per root layout.
- [ ] **`components/ui/` purge**: move the 10 app components out (`role-selector`/
      `team-selector` → `components/widgets/`; `navigation`, `mode-toggle` →
      `components/shell/`; `markdown-editor`, `rating`, `sortable`, `loading*` →
      `components/primitives/` or deletion per design-system R10); flatten `shadcn-io/*`.
- [ ] **Shell relocations (no behavior change)**: `components/custom/main-nav.tsx` →
      `components/shell/`; theme/language/config providers → `components/shell/`; extract
      `lib/rights.ts` from `buildNavigation` (Phase 1 and Home both depend on it).
- [ ] **GraphQL tooling**: fix `codegen.ts` (real introspection URL, output
      `lib/graphql/__generated__/`); run the codegen spike with the written fallback
      (explicit ownership of `types/models/` if impractical); dynamic knowledge factories
      excluded either way.
- [ ] **Lint guardrails**: tier boundary rules (codebase-structure §1.2, exemption list
      that only shrinks); `no-console: ["error", {allow:["warn","error"]}]`;
      `no-restricted-globals` banning `confirm`/`prompt`; ban `@/util/*` and
      `@/queries/queries` imports in migrated folders; `react/jsx-no-literals` scoped to
      migrated folders.
- [ ] **i18n plumbing**: `proxy.ts` imports `i18n/config.ts` (stop re-declaring locales);
      new `scripts/check-messages.js` CI check asserting en/de key parity; rewrite
      `I18N_GUIDE.md`.

### 0.3 Design tokens & theme safety (design-system audit R1, R4, R6–R9, R13)

All in `app/globals.css`, `tailwind.config.js`, `lib/fonts.ts`, `components/ui/` unless noted.

- [ ] **R1 — semantic tokens**: add `--success`, `--warning`, `--info` (+`-foreground`,
      light + dark values; info = blue, NOT purple) to `app/globals.css`; map them in
      `tailwind.config.js`; **remove the `info` → `--primary` alias**
      (`tailwind.config.js:56-59`); add matching `badge.tsx` and `alert.tsx` variants;
      lint-ban raw `{red,green,amber,yellow,blue,orange,gray}-N` classes (the 53-file
      migration rides each page's redesign; primitives ship token-only from day one).
- [ ] **R4 — typography**: load Inter 500 + 600 in `lib/fonts.ts` (or the variable font);
      codify the weight scale (body 400 / labels 500 / headings & buttons 600); drop
      `font-black` usages.
- [ ] **R6 — theme-safe shared components**: `--chart-6..10` defined in both themes; fix
      the `--chart-3` light/dark hue flip; `.recharts-active-bar` hex → token;
      `components/dashboard/donut-chart.tsx` label fill → `hsl(var(--foreground))`;
      `ui/loading.tsx` default `text-current` (deleted entirely after R10 migration);
      one token-driven code-block surface (full `code-preview` retoken rides the knowledge/
      chat redesigns; `tool-call-approval.tsx` rebuild rides chat).
- [ ] **R7 — icons**: remove the 30+ per-call-site `strokeWidth` overrides (global
      stroke-1 rule stands); standardize on `size-N` notation.
- [ ] **R8 — token-layer cleanup**: remove the `addVariablesForColors` plugin (port the 1–2
      dependent effects to explicit vars); wire the `--shadow-*` ramp into
      `theme.extend.boxShadow` (or delete); delete `--spacing`; delete the duplicate
      `@layer base`; resolve `--sidebar` vs `--sidebar-background` to one var; remap
      `--sidebar-ring` to the brand ring. (Chat-table / markdown-editor / GraphiQL CSS
      colocation rides the owning pages' redesigns.)
- [ ] **R9 — scale repair**: `ui/card.tsx` `CardTitle` → `text-base font-semibold`
      (page `text-2xl` > section `text-lg/xl` > card `text-base`; update CLAUDE.md's
      "Display/Hero text-4xl — page titles" line to `text-2xl` per philosophy precedence).
- [ ] **R13 — motion budget**: cap utilities at `duration-500` (prompts/skills
      `duration-700` entrances die with their page redesigns).

### 0.4 Directory scaffolding & core primitives

- [ ] Scaffold `components/primitives/`, `components/widgets/`, `components/shell/`
      (lib dirs created in 0.2); wire the §1.2 import boundaries to them.
- [ ] **Build the universal core primitives to the codebase-structure §2 spec** (i18n via
      `common.*` from day one — R12; responsive transforms T1–T3 + V-rules built in, so
      pages get correct mobile behavior for free):
      - `components/primitives/page-shell.tsx` (3 named widths; never hides by breakpoint)
      - `components/primitives/page-header.tsx` (`text-2xl`, one per page, breadcrumb slot)
      - `components/primitives/toolbar.tsx` (search + filters + view; T3 collapse)
      - `components/primitives/data-table.tsx` (ONE TanStack wrapper; skeleton rows,
        inline error+Retry, built-in EmptyState, mandatory `mobileCard` → T1)
      - `components/primitives/list-detail.tsx` (panel/page/static modes; URL sync; T2)
      - `components/primitives/empty-state.tsx` (default/quiet/error variants)
      - `components/primitives/confirm-dialog.tsx` (async pending, type-to-confirm,
        cascade options, bulk error report; the ONLY destructive confirmation)
      - `components/primitives/side-panel.tsx` (resizable ≥lg, Sheet below; T2)
      - `components/primitives/status-dot.tsx`, `overflow-menu.tsx`, `copy-button.tsx`,
        `copy-field.tsx`, `relative-time.tsx`, `access-denied.tsx`, `bulk-action-bar.tsx`
- [ ] All remaining registry primitives/widgets (codebase-structure §2.3/§2.4 — SaveBar,
      FormSection, SecretField, AccessBadge, SearchableSelect, InputDialog, RawJsonView,
      ScoreBadge, RankedList, RangePicker, Dropzone, PromptContent, DetailSection,
      WidgetSection, AttentionList, StatCard, ChartCard, QueuePanel, FilePicker,
      EntityCombobox, RBACControl, …) are **built on demand by their first consuming page,
      to the registry spec, never page-flavored**; review against §2 is part of that PR.
      If a page ships before a primitive it needs exists, it builds a local stub with the
      §2 API and swaps imports later.

**Phase 0 exit criteria:** app builds and behaves identically except the listed bug fixes;
both themes render; all lint guards active in CI; `scripts/check-messages.js` green;
no route renders worse on mobile than before (interim `overflow-x-auto` acceptable,
blank pages already-existing only — they die with their page work items).

---

## 3. Phase 1 — Shell & navigation

Implements `design/navigation.md` in full (its M0 items landed in Phase 0.1). Scope: **L**.
This phase unblocks every page doc's "Build/Develop/Administration group" dependency.

### 1A — The Spine (navigation.md M1)

- [ ] `components/shell/nav-config.ts` — the declarative `NavEntry` table (navigation.md
      §1.2) — single source of truth for sidebar, drawer, palette, and route guards.
- [ ] `lib/rights.ts` — `Requirement` type + `can(user, requirement)`; **unit tests for the
      single-right matrix** (e.g. `budget_management:read`-only sees exactly
      Administration → Budgets).
- [ ] `components/shell/app-sidebar.tsx` — brand header, ⌘K search affordance, groups,
      footer; group renders iff ≥1 visible item; single-group header suppression (P1 flat
      sidebar); no collapsible sections.
- [ ] `components/shell/nav-group.tsx` + `nav-item.tsx` — one renderer; sliding active
      indicator (Framer Motion `layoutId="nav-spine"`, the sidebar's only purple); rail
      tooltips with labels + shortcuts; hairline group markers in rail mode.
- [ ] `components/shell/brand.tsx` — backend-served logo (`resolvedTheme` fix) + product
      name from `/config`; the hardcoded "AI Studio" string dies.
- [ ] `components/shell/user-menu.tsx` — theme light/dark/**system**, Language submenu
      (cookie + `router.refresh()`), Settings, Log out. **Token link removed** (moves to
      Develop group; route stays URL-accessible — release note).
- [ ] `components/shell/mobile-topbar.tsx` (h-12 below `md`: hamburger + page label +
      action slot; suppressed on chat sessions) + `app-nav-trigger.tsx` (exported hamburger
      consumed by ChatHeader — agreed fallback if chat lands later: shell bar renders above
      chat's own header, ugly but navigable).
- [ ] Mobile drawer: existing sidebar `Sheet`, stock close button un-suppressed; safe-area
      insets; `useIsMobile` desktop-first flash fixed.
- [ ] `components/ui/sidebar.tsx`: exactly the 3 sanctioned changes (default-open fix
      already in 0.1; Sheet close button; nothing else forked).
- [ ] **Route guards**: every nav-gated route consumes the same `requires` predicate via a
      server-side guard rendering the shared `AccessDenied` (closes the `/workflows`,
      `/keys`, `/explorer`, `/configuration` open-by-URL gaps).
- [ ] Complete `navigation.*` i18n keys (en + de, incl. `navigation.groups.*`); orphaned
      keys pruned; German labels reviewed by a native speaker.

### 1B — Palette, Home route, skeletons (navigation.md M2)

- [ ] `components/shell/command-palette.tsx` — cmdk over Command+Dialog; groups
      Recent / Navigate / Create / Search / Preferences, fed exclusively from
      `nav-config.ts` + an RBAC-gated action registry + existing search queries; never
      opens a second overlay; Create deep-links with `?new=1`. Pages release squatted ⌘K
      bindings (prompts, skills) as they migrate.
- [ ] `/` routing rule: `app/(application)/(home)/page.tsx` as **server component** —
      P1-only accounts `redirect("/chat")`; elevated accounts render Home (interim: a
      minimal placeholder until work item `dashboard` lands; the redirect rule itself ships
      here).
- [ ] Route-level `loading.tsx` skeletons per top-level route group (mirror real layouts).
- [ ] Layout: content wrapper becomes `div` (single `<main>` landmark, a11y fix M11).
- [ ] **Delete `components/custom/main-nav.tsx`** (608 lines) + dead satellites
      (`components/ui/navigation.tsx`, `components/main-loader.tsx`) once all consumers
      point at the new shell.

### 1C — threaded through Phase 2+ (navigation.md M3)

Breadcrumb adoption in PageHeaders, terminology canon in `messages/*.json`, and the
`/data` → `/knowledge` route rename (behind redirects) ride the owning page work items.

**Phase 1 exit criteria:** the persona sidebar matrix (navigation.md §1.3) renders correctly
for P1-only / P2 / P4 / super-admin test accounts; drawer reachable on every route at
390 px; all five shell animations within budget and reduced-motion-safe; both themes;
en + de; `can()` tests green; zero nav-hidden-but-URL-open routes.

---

## 4. Phases 2–5 — Pages

**Ordering rationale:** P1 surfaces first (chat is the product for the largest population),
then P2's Build area (the quality loop behind P1's experience), then P3 Administration,
then P4 Develop. Two deliberate deviations: **transcriptions** and **keys-token** go first
as the docs' nominated primitive early adopters (small surfaces that exercise the universal
bones + SecretField/CopyField before the XL pages depend on them) — keys-token is P3/P4-owned
but cheap insurance for everything after it. Within a phase, M-scope items are
parallelizable once their primitives exist; the only strict serialization is primitive
birth (first consumer builds it to spec).

**No page is scope S.** Batching candidates (one engineer, one review context):
`auth` + `settings-config` (small, low-dependency); `models` + `variables` (same
table→panel+FormSection anatomy); `budgets` + `feedback` (both M, Administration,
ListDetail + status filters).

### Definition of done — EVERY page work item (the shared acceptance contract)

1. **Functionality inventory preserved (hard contract):** every numbered capability in the
   page doc's §1 "Functionality inventory" is reachable at the ladder level assigned in its
   §3 "Disclosure ladder" table. Zero removals. Verified line-by-line in PR review.
2. **Responsive:** the full `design/responsive.md` §5 checklist passes at 390/768/1024/1440
   (+320 px and 390-landscape smoke), per the page's surface tier; standard transforms
   (T1–T9/S1–S6) applied; deviations recorded in the page doc.
3. **Both themes** verified at every test viewport; semantic tokens only; no raw palette
   classes; `dark:` overrides trend to zero in the feature folder.
4. **i18n:** zero hardcoded user-facing strings (scoped `jsx-no-literals` turned on for the
   folder); en + de keys land in the same PR under the page's namespace
   (codebase-structure §3.5); `check-messages.js` green.
5. **Structure slice (Wave 2):** single-importer components colocated into
   `app/(application)/<feature>/components/`; the feature's GraphQL ops extracted from
   `queries/queries.ts`; its DataTable copy deleted; god files decomposed by ladder level;
   route-param renames + redirect shims where the doc says so.
6. **Shared bones** (PageShell/PageHeader/Toolbar/ListDetail/EmptyState/ConfirmDialog/…)
   used — or a written reason in the page doc.
7. **Promotion contracts:** any component promoted to `primitives/`/`widgets/` ships behind
   its consumer acceptance contract (every existing consumer compiles + behaves unchanged,
   verified in the promoting PR).
8. The page doc's §4 **risks** are addressed or explicitly ticketed.

Per-page entries below list only doc, scope, **page-specific dependencies**, and
**page-specific acceptance criteria** on top of the shared contract.

---

### Phase 2 — Primitive proving + P1 workspace

**2.1 Transcriptions** — [`design/pages/transcriptions.md`](pages/transcriptions.md) · Scope **M** · P1 (P2 secondary: knowledge-curation fields at L3)
- *Deps:* Phase 0 primitives (nominated early adopter — exercises PageHeader, Toolbar,
  EmptyState, ConfirmDialog, Sheet-detail at small scale); Workspace group (Phase 1);
  knowledge doc owns the `/data/transcriptions` deep-link targets (keep URLs stable);
  FilePicker/RBACControl changes ripple — coordinate, don't promote here.
- *Accept:* three-stage queue at L1; review promoted to a side panel with the tappable,
  audio-synced transcript (blocks, not hover ribbons — T7); project/sharing fields at L3;
  Transcripts nav item honors `config.transcription.enabled`.

**2.2 API keys & personal token** — [`design/pages/keys-token.md`](pages/keys-token.md) · Scope **M** · P3 (/keys), P4 (/token)
- *Deps:* `role.api` fix (0.1); Phase 1 groups (Keys → Administration, Token → Develop);
  early adopter for DataTable + SidePanel + SecretField + CopyField (birthed here to spec);
  explorer's Credentials menu links both routes — paths stay stable. Backend (non-blocking):
  key-postfix parsing contract, scope-semantics decision.
- *Accept:* /keys = paginated four-column audit table + two-step create dialog + detail/
  role/delete side panel, and **stops lying about scope**; /token = masked, expiry-honest
  copy card; one-time key reveal uses `break-all` + copy (S5); Token nav entry lives in
  Develop, route stays URL-accessible.

**2.3 Chat** — [`design/pages/chat.md`](pages/chat.md) · Scope **XL** · P1 (P2 debugging)
- *Deps:* ConfirmDialog/EmptyState exist; `AppNavTrigger` from Phase 1 (left = app nav,
  in-page History icon = history rail — the agreed collision resolution); responsive.md
  contracts (chat is the first big consumer); reference implementation for
  SidePanel/OverflowMenu and the mobile sheet patterns. Backend untouched — preserve the
  server-side project-scoped agent fetch and transport headers exactly.
- *Accept:* all **91 inventory capabilities** reachable per the ladder (overflow menu +
  composer "+" menu); `chat.tsx` (1813 lines) decomposed into header/composer/attach-menu/
  usage-popover + `use-chat-session.ts` with **stable localStorage keys**; no fixed widths
  (`w-[850px]` dies), `h-dvh` everywhere; history rail ↔ sheet; message actions
  touch-visible; tool-call-approval rebuilt on tokens; Tier A mobile: the full P1 chat job
  is flawless at 390 px.

**2.4 Projects** — [`design/pages/projects.md`](pages/projects.md) · Scope **M** · P1 (P2 secondary)
- *Deps:* shell nav handles project switching (else keep the breadcrumb fallback the doc
  specifies); chat imports `SessionItemBadge` and reads `project.custom_instructions`/
  `project_items` — field semantics frozen; ItemsSelectionModal internals co-owned with
  knowledge.
- *Accept:* detail leads with sessions + one purple "New session"; files/access/deletion in
  URL-backed tabs; double-sidebar collapsed to standard list-to-detail; the 250+320 px rail
  stack is gone (T6); ItemsSelectionModal stepped on mobile (T5).

**2.5 Auth** — [`design/pages/auth.md`](pages/auth.md) · Scope **M** · P1 (design owner; flow identical for all)
- *Deps:* `components/shell/auth-shell.tsx` + LocaleSwitcher (shell work); /configuration
  owns the white-label assets displayed here (non-blocking).
- *Accept:* one centered column adapting to the configured auth mode (password/OTP/Google);
  first-class OTP step (sent-to address, expiry, resend, change-email); all failures
  recover inline; **no stock NextAuth surfaces anywhere**; `min-h-dvh` natural scroll
  (the `overflow-y-hidden` keyboard trap dies — V1/V4); fluid column width.

**2.6 Settings & Configuration** — [`design/pages/settings-config.md`](pages/settings-config.md) · Scope **M** · P1 (/settings), P3 (/configuration)
- *Deps:* `role.api` fix (0.1, non-blocking — fallback documented); Phase 1 Personal group
  + user-menu relocation must not race this page; SaveBar primitive (mode "save" |
  "publish") born here or in agents — coordinate; `lib/theme-defaults.ts` token manifest.
- *Accept:* /settings = the one calm page for all P1 preferences (theme/language/prompt/
  identity); /configuration = guarded two-pane token editor against a live preview with a
  deliberate **Publish** (no blind save), preview → bottom sheet at 390 px.

**2.7 Dashboard / Home** — [`design/pages/dashboard.md`](pages/dashboard.md) · Scope **M** · composed by role (L1 = P2; P3/P4 RBAC sections; P1-only never sees it)
- *Deps:* Phase 1B Home route + redirect rule; `lib/rights.ts` (nav and Home must never
  disagree); StatCard/ChartCard extracted **once**, shared with analytics; WidgetSection +
  AttentionList born here; analytics doc owns the `/analytics?type=…` deep-link contract
  Home's StatCards target.
- *Accept:* three RBAC-gated regions (Resume work / 24h Vitals / Needs attention); all
  charts one deliberate step away on /analytics; per-section skeletons + error isolation;
  fan-out capped (5 contexts, 60 s poll); consolidated onboarding EmptyState on an empty
  platform; P1-only accounts still go straight to chat.

### Phase 3 — P2 Build area

**3.1 Agents** — [`design/pages/agents.md`](pages/agents.md) · Scope **L** · P2 (P4 secondary)
- *Deps:* Build group (Phase 1); SectionNav + SaveBar primitives born here (to spec);
  prompts components (`PromptCard`, `PromptEditorModal`, `PromptBrowserSheet`) reused
  as-is — coordinate with 3.2; models edit deep-link survives 4.2. Backend verifications:
  `firewall` + `RBAC.teams` read/write, `image` on update, `instructions` at create — any
  gap blocks only its dependent slice (Safety / Access teams / Appearance / create dialog).
- *Accept:* 3-field create dialog (name, pre-selected model, instructions); anchored-
  section workbench editor with the iterate-and-test loop at L1; **all 69 capabilities
  including the restored firewall UI** layered L2–L4; sticky SaveBar + navigation guard;
  editor single-column below `sm` (the `grid-flow-col` violation dies).

**3.2 Prompts** — [`design/pages/prompts.md`](pages/prompts.md) · Scope **M** · P2 (P1 use via chat composer)
- *Deps:* ListDetail static-pane mode; `usePrompts`/`lib/prompts/*`/`PromptVariableForm`/
  `PromptCard`/`PromptEditorModal` exports + props **frozen** (chat selector + agents form
  + PromptBrowserSheet contract); `N` shortcut coordinated with palette (⌘K returned to
  shell); PromptContent primitive extracted here.
- *Accept:* slim searchable list with **restored pagination** left, document-style detail
  with single purple "Use prompt" right; versioning/sharing/bulk metadata one step down;
  editorial hero + bespoke CTA replaced by PageHeader/Button; favorites fix + teams wiring;
  list-only + sheet below `lg` (no auto-selected below-fold preview — V2).

**3.3 Skills** — [`design/pages/skills.md`](pages/skills.md) · Scope **L** · P2 (P4 secondary)
- *Deps:* InputDialog + AccessBadge born here; ⌘K release with palette; agents form
  consumes `GET_SKILLS` — query shape unchanged.
- *Accept:* calm ListDetail library, write-gated actions; full-bleed mini-IDE editor with
  dialogs/file tree/diff normalized to shared primitives; file tree → Sheet below `md`
  (T6); rename/delete get visible touch paths (right-click-only dies — T7); unified diff
  in full-screen sheet on mobile (T8); genuinely usable at 390 px.

**3.4 Knowledge** — [`design/pages/knowledge.md`](pages/knowledge.md) · Scope **XL** · P2 (P3 usage/queue, P4 debugging)
- *Deps:* Build-group RBAC trim (interim gate `SA || role.agents:r+` until a backend
  `knowledge` right exists); **FilePicker promotion (11 consumers across 6 areas) gated by
  its acceptance contract** — sequence after chat/transcriptions/agents have landed;
  QueuePanel promoted from evals' queue-management to spec (evals + workflows are
  consumers); ItemsSelectionModal API frozen (chat + projects); backend aggregate for
  context-row meta (N+1) + chunk pagination flagged.
- *Accept:* two-level area — context library at L1, per-context workspace where **Items
  lead**; entire ingestion machinery in one Pipeline tab with stage cards; item detail as
  layered SidePanel; legacy `[[...query]]` URL shapes redirect-shimmed; `/data` →
  `/knowledge` rename behind redirects (navigation M3); mobile ground-up (550 px of fixed
  rails die).

**3.5 Workflows / Routines** — [`design/pages/workflows.md`](pages/workflows.md) · Scope **L** · P2 (P4 secondary)
- *Deps:* QueuePanel (from 3.4/evals coordination); RunInspector + ScheduleEditor widgets
  born here; terminology canon "Routine"; n8n config-gating. Backend-gated slices: toolbar
  status filter waits for `FilterWorkflow_template` last-run/schedule filtering; L1
  schedule chip runs on the capped per-page combined query until batched data lands —
  **never per-row polls**.
- *Accept:* four quiet columns (name, status dot, schedule chip, Run); the four stacked
  dialogs absorbed as side-panel tabs (runs/schedule/queue/sharing); read role gets the
  read-only page; n8n full-bleed behind a slim header + mobile escape hatch (T9); the three
  bug fixes (file parts, agent detach, teams-RBAC payload) land.

### Phase 4 — P3 Administration

**4.1 Access (Users · Roles · Teams)** — [`design/pages/access.md`](pages/access.md) · Scope **L** · P3
- *Deps:* one nav entry + tabs (Phase 1, `/roles`+`/teams` as aliases); ConfirmDialog's
  bulk error reporting + async pending (built in 0.4); InlineEditCell born here;
  RoleSelector subtitle change ships to /keys too.
- *Accept:* one tabbed Access area on the ListDetail skeleton — find a person at L1, fix
  role/team in a detail panel at L2; **one-viewport permission matrix** replaces the
  seven-card mega-dialog; every `window.confirm` dies; blank-below-`md` shell dies.

**4.2 Models** — [`design/pages/models.md`](pages/models.md) · Scope **M** · P3 (P4/P2 secondary)
- *Deps:* interim gate `SA || role.agents:w` (flips to `role.models` when backend lands);
  SearchableSelect + FormSection consumers; `lib/provider-brands.ts`; agents "Edit this
  model" deep-link stays. Backend: `RBACInput.teams` confirmation.
- *Accept:* one calm registry table + detail side panel; creation = three decisions;
  advanced limits/access fold away (FormSection); LiteLLM mode shares the same bones with
  an honest external-management affordance; all four `hidden md:flex` shells die (T1/T2).

**4.3 Budgets** — [`design/pages/budgets.md`](pages/budgets.md) · Scope **M** (+S backend) · P3 (read-scoped reviewers secondary)
- *Deps:* **Backend phase 1 blocks the Status filter** (`GET /admin/budgets/{type}?status=…`
  + name-or-email user filter) — ship the rest behind the doc's fallback; BudgetBar widget
  props stay chat-compatible; AttentionList adoption optional; entity-type tabs → Select
  below `md` (S1).
- *Accept:* status-first monitor — quiet always-visible default-policy summary in the
  header (PageHeader `meta`), Over / At risk / No budget filter carries the #1 job; every
  hover-only detail gets an accessible click path (T7); bulk bar sticky above safe area.

**4.4 Analytics** — [`design/pages/analytics.md`](pages/analytics.md) · Scope **M** · P3 (future role-gated P2 path specified, not built)
- *Deps:* StatCard/ChartCard shared with Home (extracted in 2.7 — consume, don't refork);
  owns the `?type=…` searchParams contract Home targets; RangePicker must stay
  backward-compatible with `/data`'s DateRangeSelector or knowledge migrates in the same
  PR; chart tokens from 0.3; RankedList born here; duplicate `AgentCallsStatistics` op name
  fixed.
- *Accept:* "Usage" — one date range + one explicit event-type/measure lens scoping a KPI
  strip, an honest trend chart, and a single tabbed Breakdown card (Agents/Users/Projects/
  Roles, List|Share views) replacing three leaderboards and the remotely-controlled donut;
  `h-screen` scroll trap dies; one-month calendar below `md` (S3).

**4.5 Variables** — [`design/pages/variables.md`](pages/variables.md) · Scope **M** · P3 (P4 secondary)
- *Deps:* SecretField (born in 2.2) — masked-by-default contract; `[variable_id]` →
  `[variableId]` rename + shims; backend items 1–2 (lite query without secret values) with
  consumers migrating in the same change; read role gets the read-only page (Phase 1 gate).
- *Accept:* a vault that behaves like one — **secret values never ship to the browser
  pre-reveal**; reveal is a deliberate, audited act; live "used by" trail on every
  variable; delete/rename/decrypt state their blast radius in ConfirmDialog; 7-column
  blank-on-mobile table → cards (T1) with copyable UUIDs (S5).

**4.6 Feedback (review console)** — [`design/pages/feedback.md`](pages/feedback.md) · Scope **M** · P3 (P2 secondary)
- *Deps:* "Send feedback" relabel in the Personal group (Phase 1) breaks the homonym;
  MessageRenderer read-only mode is the replay contract (coordinate with 2.3);
  EntityCombobox born here; i18n namespaces split `feedbackReview.*` vs `feedback.*`.
  Backend flagged, non-blocking: `feedback` role right, `feedbackUpdateOne` triage, true
  bulk delete.
- *Accept:* negative-first ListDetail triage console with conversation replay and
  jump-to-session; P1 submission untouched (chat thumbs + relabeled shell dialog);
  blank-below-`md` shell dies; fixed-height ScrollArea double-scroll dies.

### Phase 5 — P4 Develop

**5.1 Evals** — [`design/pages/evals.md`](pages/evals.md) · Scope **L** · P4 (P2 secondary)
- *Deps:* DataTable/ConfirmDialog/AccessDenied (early consumer, not inventor); ScoreBadge
  born here (Home's P4 widget consumes); QueuePanel co-reviewed with knowledge/workflows;
  backend `GET_EVAL_SETS` aggregate before the new list columns; matrix N+1 batching needs
  backend coordination; label-substring result matching preserved exactly.
- *Accept:* results-first workspace — calm suite list → score-matrix detail with **Run
  eval** as the single primary action; run management in per-column menus; result/queue
  depth in side sheets; matrix inverts to run-status cards on mobile (T8); both
  blank-below-`md` shells die; "Advanced expectations" reinstatement confirmed with the
  team before shipping.

**5.2 API Explorer** — [`design/pages/explorer.md`](pages/explorer.md) · Scope **M** · P4 (P2 via `role.api:w`)
- *Deps:* `role.api` fix (0.1) — gate finally evaluable; Develop group (Phase 1);
  full-bleed PageShell with bounded height; /token + /keys stable routes for the
  Credentials menu; `graphiql.css` colocates to
  `app/(application)/explorer/graphiql.css`.
- *Accept:* GraphiQL kept as the L4 work surface in slim Exulu chrome — theme-synced and
  token-mapped; fixed RBAC gate; copyable endpoint pill; credentials menu; in-rail
  Examples plugin built from the app's own query catalog; **copy-first mobile toolkit**
  with "Open full explorer anyway" escape (T9).

---

## 5. Tail (after 5.2)

- [ ] Delete `queries/queries.ts` (empty by now — monotonic-shrink rule).
- [ ] Retire `types/` + the `@EXULU_SHARED` alias as codegen/feature types complete.
- [ ] Prune `components/ai-elements/` against chat's real post-redesign usage.
- [ ] Remove all `// MIGRATION-SHIM` re-exports; drop lint-boundary exemptions to zero.
- [ ] Final suite-wide audit: anti-pattern sweep (philosophy), responsive DoD spot checks,
      en/de parity, both-theme pass.

---

## 6. Tracking table

> The living progress tracker. One row per work item. Allowed Status values:
> `pending` → `in progress` → `in review` → `done` (plus `blocked (reason)`).
> Update the row in the same PR that changes its status.

| # | Work item | Doc | Scope | Phase | Depends on | Status |
|---|---|---|---|---|---|---|
| 0.1 | Security & correctness fixes | codebase-structure §4, navigation §7 | S | 0 | — | done (key rotation is a human action in vendor dashboards) |
| 0.2 | Hygiene & structure (Wave 0) | codebase-structure §4 | M | 0 | — | done (lint guards + check-messages enforced in CI via .github/workflows/quality.yml: lint, tsc, i18n parity, build on every PR) |
| 0.3 | Design tokens & theme safety | audits/design-system R1–R13 | M | 0 | — | done |
| 0.4 | Scaffolding + core primitives | codebase-structure §1–2 | M | 0 | 0.2, 0.3 | done (15 core primitives shipped; remaining registry primitives built on demand by first consumer, per plan) |
| 1A | Shell: Spine sidebar, rights, guards, mobile nav | navigation.md | L | 1 | 0.1, 0.2, 0.4 | done (exit-criteria audit 2026-06-11: matrix tests green for P1/P2/P4/SA + every single-right role; tsc/lint/build/i18n-parity clean; every nav-gated route guarded incl. the config-flag guard on /transcriptions; /prompts + /token deliberately URL-open per spec. Deferred to 2.3: chat-session topbar suppression re-enabled once ChatHeader mounts AppNavTrigger (fallback bar active until then). Remaining human actions: native-speaker de label review (Benutzer & Zugriff, Persönlicher Token), visual QA both themes at 390px, release note for the Token link moving to Develop; Sheet close button touch target <44px is stock shadcn — flagged, not forked) |
| 1B | Command palette, Home route, route skeletons | navigation.md §4, §7 | M | 1 | 1A | done (palette fed solely from nav-config + RBAC create registry + entity search, 150 ms fade+scale, reduced-motion safe; / redirects P1→/chat, elevated render interim Home; loading.tsx per route group; single <main> landmark; main-nav/navigation/main-loader deleted. Rides Phases 2–3: pages adopt ?new=1 and release squatted ⌘K bindings as they migrate) |
| 2.1 | Transcriptions | pages/transcriptions.md | M | 2 | 0.4, 1A | done (adversarial review passed after revision; gates green: tsc, vitest 44/44, eslint, i18n parity, build. Dropzone primitive born here. File gallery ships as a route-local FilePicker stub — promotion + shared-gallery touch-target/confirm fixes belong to 3.4 Knowledge; rbac.tsx gained subjectLabel but its remaining internal strings stay English until the RBACControl widget promotion (mixed-language de sentence flagged). Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of new de keys) |
| 2.2 | Keys & Token | pages/keys-token.md | M | 2 | 0.1, 0.4, 1A | done (adversarial review passed after revision; gates green: tsc, vitest 44/44, eslint, i18n parity, build. SecretField primitive born here — unblocks 4.5/5.2 deps. GET_API_KEYS no longer selects the synthetic email, closing the bcrypt-hash leak (U4b); /keys ships PageShell variant="content" — recorded deviation from the doc's max-w-5xl sketch. role-selector.tsx gained optional copy props; users route passes none (byte-identical) and wires its own translations in 4.1. Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of new de keys) |
| 2.3 | Chat | pages/chat.md | XL | 2 | 0.4, 1A (AppNavTrigger) | pending |
| 2.4 | Projects | pages/projects.md | M | 2 | 0.4, 1A, 2.3 contracts | pending |
| 2.5 | Auth / Login | pages/auth.md | M | 2 | 0.4 (AuthShell) | pending |
| 2.6 | Settings & Configuration | pages/settings-config.md | M | 2 | 0.1, 0.4, 1A | pending |
| 2.7 | Dashboard / Home | pages/dashboard.md | M | 2 | 1B, lib/rights.ts | pending |
| 3.1 | Agents | pages/agents.md | L | 3 | 0.4, 1A; backend schema verifications | pending |
| 3.2 | Prompts | pages/prompts.md | M | 3 | 0.4, 1B (⌘K); 3.1 coordination | pending |
| 3.3 | Skills | pages/skills.md | L | 3 | 0.4, 1B (⌘K) | pending |
| 3.4 | Knowledge | pages/knowledge.md | XL | 3 | 0.4, 1A; FilePicker contract after 2.1/2.3/3.1 | pending |
| 3.5 | Workflows / Routines | pages/workflows.md | L | 3 | 0.4, 1A; QueuePanel w/ 3.4+5.1; backend filter (partial) | pending |
| 4.1 | Access (Users·Roles·Teams) | pages/access.md | L | 4 | 0.4, 1A | pending |
| 4.2 | Models | pages/models.md | M | 4 | 0.4, 1A | pending |
| 4.3 | Budgets | pages/budgets.md | M | 4 | 0.4, 1A; **backend status endpoint** | pending |
| 4.4 | Analytics | pages/analytics.md | M | 4 | 0.3 (chart tokens), 2.7 (StatCard/ChartCard) | pending |
| 4.5 | Variables | pages/variables.md | M | 4 | 0.4, 2.2 (SecretField); backend lite query | pending |
| 4.6 | Feedback console | pages/feedback.md | M | 4 | 0.4, 1A (relabel), 2.3 (replay contract) | pending |
| 5.1 | Evals | pages/evals.md | L | 5 | 0.4, 1A; backend aggregate (partial) | pending |
| 5.2 | API Explorer | pages/explorer.md | M | 5 | 0.1 (role.api), 1A, 2.2 (routes) | pending |
| T | Tail cleanup | this plan §5 Tail | S | end | all of the above | pending |

---

## 7. Working agreement

How an implementing engineer or agent uses this plan.

### Read order (before touching a work item)

1. `design/philosophy.md` — the decision framework (disclosure ladder, anti-patterns,
   heuristics). Non-negotiable context.
2. `design/personas.md` — who the page is for; the final ownership matrix.
3. `design/navigation.md` — the shell every page lives inside.
4. `design/pages/<page>.md` — the full spec for your work item: current-state inventory,
   JTBD, design concept, ladder, mobile behavior, implementation notes, risks.
5. `design/responsive.md` + `CLAUDE.md` — the standards you build it with (transforms,
   V-rules, DoD checklist; tokens, type, spacing, motion, a11y).
6. `design/codebase-structure.md` — where files go, primitive specs (§2), Wave-2 checklist.

### Hard rules

- **The functionality inventory is a contract.** Before opening a PR, walk the page doc's
  §1 inventory item by item and verify each capability is reachable at its §3 ladder level.
  "I couldn't find where to put it" is a design question, not a deletion.
- **Primitives are built to the registry spec** (codebase-structure §2), never
  page-flavored. First consumer builds it; the PR review checks it against the spec. If
  yours isn't the first consumer, you import — you don't fork.
- **One pattern per job.** Before building anything shared-looking, check §2's registry and
  the merges table (§2.1). New shared components require a registry entry first.
- **Never import from another feature's folder.** That's the lint-enforced signal a
  component must graduate to `primitives/`/`widgets/` — with its consumer contract.
- **Backend is out of scope.** When a doc names a backend dependency, ship the documented
  interim/fallback and mark the row `blocked (partial)` only if the doc says the slice
  cannot ship without it (e.g. budgets' Status filter).
- **Every page PR carries its structure slice** (Wave-2 checklist, §4 DoD item 5) and its
  i18n namespace (en + de, same PR).

### When to update docs vs code

- **Code follows docs.** If implementation reveals the doc is wrong or impossible
  (API mismatch, backend gap, a ladder placement that breaks a flow), **update the page doc
  in the same PR** — a short "Implementation amendments" note at the bottom with date and
  reason — then implement the amended spec. Silent divergence is the failure mode this
  plan exists to prevent.
- Changes that touch the shared framework (ladder rules, primitive APIs, nav IA, responsive
  transforms) must be made in the owning doc (`philosophy` / `codebase-structure` /
  `navigation` / `responsive`), not locally in a page doc — those docs are canonical and
  page docs reference them.
- **This file:** update the §6 Status column as work moves; append newly discovered work
  items as new rows (never delete rows); record ordering changes with a one-line rationale.
- Persona/ownership changes require updating the matrix in `personas.md` — it is final
  unless a page doc correction goes through review.

### Review checklist (every page PR)

Inventory walk ✓ · ladder placements match the doc ✓ · responsive DoD at 4 viewports +
320 px ✓ · both themes ✓ · en/de keys + no literals ✓ · shared bones or written reason ✓ ·
purple budget respected ✓ · promotion contracts verified ✓ · structure slice complete ✓ ·
doc amendments recorded ✓ · tracking row updated ✓
