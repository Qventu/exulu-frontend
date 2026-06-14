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
- [ ] Wire `getRequestConfig` in `i18n/config.ts` so server pages can use
      `next-intl/server`'s `getTranslations` directly — work-around has now bitten agents 2.8,
      prompts 2.9, skills 2.10, and knowledge 2.11; each has client-wrapper compensation.
      Estimated S scope.

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
| 2.3 | Chat | pages/chat.md | XL | 2 | 0.4, 1A (AppNavTrigger) | done (adversarial verification 2026-06-11: 18 findings, 2 must-fix — both fixed in revision a2fa2ea; gates green: tsc, vitest 44/44, eslint 0 errors, i18n parity 733 keys, build. The Quiet Column shipped fully route-colocated: app/(application)/chat/components/ + hooks.ts + queries.ts; session-files panel and prompt/save-preset modals moved out of global components/ into the route; the three legacy delete patterns unified on ConfirmDialog; tool-call-approval now tokens-only. 1A deferral closed: MobileTopbar suppression on /chat/[agent]/[session] restored — ChatHeader mounts AppNavTrigger leftmost per navigation.md §5.3. Note for 4.6: message-renderer.tsx only received theme-token fixes here; the read-only replay contract is still open and lands with the feedback console. Minor findings left open after revision a2fa2ea (the other review findings — Save-as-Routine disabled hint, Toolbar adoption in agent search, search-route double-scroll, Files-chip null flash, double safe-area inset — were verified fixed in code): ladder row 72's third managed-context placement (the one-line note inside the shared Context modal) is unshipped — the modal is shared with projects, so the note rides the ItemsSelectionModal/FilePicker promotion; ladder row 75's "Attach to next message" action stays inert (exact legacy parity — tool outputs carry no file contract; needs a backend decision). Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of the 319 new de keys) |
| 2.4 | Projects | pages/projects.md | M | 2 | 0.4, 1A, 2.3 contracts | done (adversarial review passed after revision; gates green: tsc, vitest 44/44, eslint 0 errors (the one items-selection-modal warning pre-exists this work item), i18n parity 844 keys, build. FavoriteToggle primitive born here (e9be75d, next consumer: prompts); ConfirmDialog gained the registry `warning` blast-radius slot, PageHeader gained `leading`/`truncateDescription`. /projects is now a standard collection page (one purple New project, Toolbar search, Favorites pinned once, visible Load more past the legacy 200/50 windows, ?new=1 palette deep-link); ProjectNav sidebar + projects/layout.tsx deleted. Detail = Sessions/Files/Settings in URL-backed ?tab= tabs; delete uses ConfirmDialog cascade checkboxes with live counts and a paginated session cascade; the 15-item limit is enforced. Both doc-flagged dead ends fixed: Presets wired from the Files tab (onApplyPreset/onSelectContext passed; shared ItemsSelectionModal untouched apart from a comment), orphaned project_items render a visible removable card (UX 4). Legacy globals retired: project-nav/create-project-dialog/agent-selection-dialog deleted; project-details.tsx survives only as the SessionItemBadge shim for chat's PinnedContextRow (inventory 42) — delete it when chat adopts a colocated badge. GraphQL ops are verbatim copies in projects/queries.ts; queries/queries.ts untouched. Still open from 2.3, not this row: the managed-context note inside the shared Context modal rides the ItemsSelectionModal/FilePicker promotion (3.4). Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of the 131 new de keys) |
| 2.5 | Auth / Login | pages/auth.md | M | 2 | 0.4 (AuthShell) | done (adversarial review passed after revision — 4 findings fixed: missing auth.* catalog, terms-link touch target/hover-only underline, LocaleSwitcher focusability + aria-pressed, AUTH_MODE-aware login skeleton; gates green: tsc, vitest 44/44, eslint 0 errors, i18n parity 965 keys, build. The identify→verify state machine ships with the first-class OTP step (sent-to + expiry copy, auto-submit, 30 s resend cooldown, change-email, in-step failure recovery — U2/U3 dead ends closed), the full NextAuth error map incl. CredentialsSignin, the EU trust note, autofill wiring, a real error.tsx boundary, and the scrollable min-h-dvh AuthShell (V1/V4). NextAuth call signatures, options.ts, and server-side-auth-check.ts untouched. Integration note: the track's transitional route-local auth catalog (auth-messages.ts + AuthIntlProvider) was retired at integration — auth.* landed in messages/{en,de}.json (652014f) per the shim's own removal rule. Deviations: AuthShell + LocaleSwitcher live route-local under app/(authentication)/components/ (single consumer; graduate to components/shell/ with the second pre-auth surface per codebase-structure §1.1). Honest remainders: pages.error: "/login" was NOT added to options.ts (auth flows treated as untouchable), so full-redirect errors — e.g. Google domain-allowlist denial — still land on the stock NextAuth error page; the inline branded alert covers every ?error= render on /login (ladder rows 5/11 partially realized — needs a deliberate, separately staged options.ts change). Logout still routes through the stock /api/auth/signout confirmation (components/shell/user-menu.tsx, owned by the shell workstream per auth.md §4). Remaining human actions: stage the pages.error + signOut() decisions; manual pass of the auth test matrix (AUTH_MODE × Google × email server × en/de × themes × 390/1440); verify backend GET /theme is anonymously readable (U12); native-speaker review of new de keys) |
| 2.6 | Settings & Configuration | pages/settings-config.md | M | 2 | 0.1, 0.4, 1A | done (adversarial review passed after revision — 5 findings fixed: i18n catalog returned for merge, 44 px appearance control below md, full-row Modified-only toggle target, L4 raw view serializes the STORED config (not the draft), per-row color-validation hint + one modified-count semantic via countModifiedTokens; gates green: tsc, vitest 44/44, eslint 0 errors, i18n parity 965 keys (settings.* + configuration.* landed at integration, 652014f), build. /settings finally earns its name: Light/Dark/System segmented control (System restorable, U6), language Select with dirty-prompt ConfirmDialog guard, dirty-gated prompt save with UserContext write-back (U9), read-only Account section with the /token row (visible to all authenticated users — today's behavior — until the role.api auth-check fix from keys-token.md lands). /configuration: server-side super_admin route guard (U1), grouped ~50-token manifest from route-local theme-defaults.ts (U3), live draft preview incl. bottom Sheet below lg (U2), publish/reset behind ConfirmDialog, runtime apply on publish, Import CSS dialog with skipped-line warnings, L3 Export CSS + L4 raw view both serving the stored artifact (ladder row 26). Loads via GET_PLATFORM_CONFIGURATION_BY_KEY; writes only the theme_config row; ops copied to route-local queries.ts, queries/queries.ts untouched. FormSection registry primitive born here (652014f). Honest remainders: the globals.css-drift CI assertion for the token manifest (doc risk 3) is not implemented — manifest divergence is currently caught by eye; theme-defaults.ts lives route-local rather than lib/ (single consumer, codebase-structure graduation rule). Remaining human actions: visual QA both themes at 390/768/1440 incl. preview-fidelity check in the opposite app theme, native-speaker review of new de keys) |
| 2.7 | Dashboard / Home | pages/dashboard.md | M | 2 | 1B, lib/rights.ts | done (adversarial review passed clean — no must-fix findings; gates green: tsc, vitest 44/44, eslint 0 errors, i18n parity 998 keys, build; verified zero diff under components/dashboard/, components/custom/ and app/(application)/analytics/. The "Today" page ships role-composed at / (75e75f0 + c79177d): Resume strip (4 sessions, capped at 3 full-width rows below sm), 24h Vitals StatCards vs 7-day daily average (±25% emphasis threshold, role-dependent 4th slot priority routines → budgets → evals), Needs attention (failed/stuck job_results last 24h at a 60 s poll + budget alerts via the /budgets overview queries and computeBudgetProjection), RBAC-gated footer links (analytics SA-only) — all predicates via lib/rights can(), identical to nav-config. Phase 1B routing rule preserved byte-for-byte (P1-only → /chat); HomePlaceholder + home-placeholder.tsx deleted; consolidated onboarding EmptyState on an empty platform; mobile reorders triage-first below md; loading.tsx mirrors the real layout. Registry primitives born (75e75f0, built page-agnostic to codebase-structure §2.2/§2.3): StatCard (fixes the legacy SummaryCard isLoading ASI bug by construction), ChartCard, WidgetSection (RBAC-gated + error-isolated regions), AttentionList (next consumers: /budgets, /evals). Architecture note: page colocated under app/(application)/(home)/ with route-local components/hooks/queries.ts (doc's components/home/ superseded by codebase-structure §1.1 colocation); GraphQL ops are verbatim copies — queries/queries.ts untouched; the route-local token-usage copy is renamed TokenUsageStatistics so the monolith's duplicate-op-name bug isn't inherited. Documented backend-aggregate fallbacks: (1) no eval pass-rate aggregate — the eval slot honestly shows the 24h run count; (2) no budget-alert endpoint (doc's budgetsApi has no list method) — first-page (20) scan per entity type with the same projection math as /budgets; (3) context items expose no error-state field, so the per-context knowledge-failure scan is not implementable — embedding/processing failures surface via the shared job_results feed instead. Honest remainders: ChartCard ships consumer-less until 4.4 adopts it (built here so the extraction happens once, per §4 Wave 1); the legacy summary-cards ASI bug, leaderboard console noise/off-token colors and donut black labels remain in components/dashboard/ — those files are /analytics-consumed and deliberately untouched (shared-file care), their fix is 4.4 adopting StatCard/ChartCard; /analytics?type= deep links target the contract owned by the analytics doc — verify param handling when 4.4 lands. Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of the 35 new de keys, release note that elevated accounts now land on Home instead of chat) |
| 3.1 | Agents | pages/agents.md | L | 3 | 0.4, 1A; backend schema verifications | done (adversarial review: 7 findings, 2 must-fix, revised in fca7e84; gates green: tsc, vitest 44/44, working tree clean. The agents redesign ships across two commits (3a0254f + fca7e84) on top of the registry primitives born in 65d2a9e — SectionNav, SaveBar, SettingRow. Index is now a true table-of-rows view (AgentsView + AgentRow) replacing the legacy card grid; Create is a focused CreateAgentDialog (replaces the inline card pattern) with the AgentAvatarGenerator surfaced as its own component. Editor workbench gets the full SectionNav + SaveBar treatment with route-local hooks.ts/queries.ts/sections/ colocation, sliced from the monolith into Basics/Prompt/Tools/Knowledge/Variables sections (codebase-structure §1.1 colocation honored). The Detail panel (agent-detail-panel.tsx) and tool config field extractions (tool-config-fields.tsx, variable-selection-element.tsx) land cleanly. Honest remainders from the minor findings left open after revision: (1) editor-header.tsx:84 Duplicate action calls editor.duplicate() in hooks.ts:402-411 which routes via router.push('/agents/edit/{copyId}') without going through useUnsavedChangesGuard.confirmIfDirty — the SaveBar guard catches anchor clicks + beforeunload, the header wraps Test-in-chat in confirmIfDirty, but Duplicate is not intercepted; agents.md §3 only mandates Back/nav are guarded (which they are via the PageHeader breadcrumb Link), so this is a minor gap not a contract violation. (2) agent-model-selector.tsx:191-193 renders inline 'No models found. Create one in the Models page.' hint that is not localized via next-intl; the rest of the redesigned editor is fully i18n'd and the model selector is shared between the create dialog and Basics — should also be translated. (3) prompt-browser-sheet.tsx i18n pass: ~~hard-coded English shell around the 'Untagged' relabel~~ LANDED with 3.2 Prompts in the agents.promptBrowser.* namespace (loadingFolders/loadingPrompts/noPromptsFound/noPromptsInFolder/assignedToAgent/otherPrompts/backToFolders + add/remove/title/foldersSubtitle/promptsSubtitle/searchPlaceholder/createPrompt/addedToAgent/removedFromAgent/updateFailed all wired; en/de parity verified at 1335 keys). (4) Two purple-primary Save buttons render simultaneously when the form is dirty — editor-header.tsx:140-148 (header Save) and components/primitives/save-bar.tsx:95-107 (SaveBar Save); agents.md §3 specifies both explicitly so it is spec-compliant by letter, but tugs against the 'ONE purple primary per screen' philosophy (the spec line 'this and Save are the only purple on the editor screen' described only the header Save) — worth a deliberate decision to either keep both as redundant safety or demote the header Save to outline when SaveBar is mounted. (5) agent-model-selector.tsx:13 still imports GET_LITELLM_CATALOG and GET_MODELS_LITE from '@/queries/queries' rather than colocating in app/(application)/agents/queries.ts — minor inconsistency with the colocation pattern the rest of the route now follows. (6) Lint guard not yet in place: a shadcn `Form*` primitive (FormLabel / FormField / FormItem / FormControl / FormMessage) used outside a `<Form>` wrapper crashes at runtime ("Cannot destructure property 'getFieldState' of useFormContext as it is null") — caught in QA on basics.tsx:174 (commit f88714c), no lint rule prevents recurrence. Add a `no-restricted-syntax`/scoped `no-restricted-imports` rule to .eslintrc forcing shadcn Form* imports to live in files that also reference `<Form>` (or equivalent FormProvider). Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of new de keys, decision on the header/SaveBar dual-purple question, localize the AgentModelSelector empty-state hint, route the Duplicate action through confirmIfDirty if unsaved-edit safety is desired, colocate the two model GraphQL ops into agents/queries.ts) |
| 3.2 | Prompts | pages/prompts.md | M | 3 | 0.4, 1B (⌘K); 3.1 coordination | done (gates green: tsc, vitest 44/44, eslint 0 errors on touched dirs, i18n parity 1335 keys, build. /prompts ships the calm ListDetail library per prompts.md §3: PageHeader + Toolbar (search + Sort Select + Filters popover with Favorites-only switch + tag/agent multi-selects) + active-filter chip row + bordered ListDetail (static detail pane lg+, list-only below). Pagination restored (Prev/Next + range, fixes H1). The detail document replaces the legacy preview with safe `{{var}}` rendering via the new PromptContent primitive (fixes H3 stored-XSS / mangled regex), star FavoriteToggle (fixes H2 — toggle now resolves favoriteId via useUserPromptFavorites; defensive throw rather than legacy double-create), Use-prompt path now increments usage_count (fixes M8), Delete behind ConfirmDialog (fixes H5), token-only AccessBadge with explicit teams case (fixes H4 / M1). Editor sectioned (Essentials / Organize / Sharing collapsible / change note) with PROMPTS_RBAC_TEAMS_SUPPORTED gate mirroring agents (teams persisted client-side, omitted from mutation until backend introspection confirms RBACData.teams). Version history sorted newest-first with isLatest derived from max(version) (fixes M12), change_message rendered (fixes M9), restore attributes to acting user (fixes M9), diff modal splitView md+ only (fixes mobile sliver bug), buildVersionHistory/buildRestoreHistory extracted to lib/prompts. /prompts/[id] gets a working client wrapper (Edit + post-delete router.push + back-link, fixes H6) — server page stays translation-free (NotFoundView client component) because next-intl/server getRequestConfig pathway is not wired (same pattern as agents/edit/[id]/page.tsx). New ?new=1 palette deep-link opens the create dialog and strips the param; ⌘K reserved for the global palette (kept released — the doc explicitly forbids re-squatting); N opens create, / focuses search via ref. Bonus landed: agents 3.1 minor #3 (prompt-browser-sheet hardcoded shell) — all strings now route through agents.promptBrowser.*; en/de parity. Honest remainders: (1) PROMPTS_OR_SEARCH_SUPPORTED stays false — backend `or:` combinator on FilterPrompt_library_item is unverified, so list search stays name-only server-side (chat selector still or-searches name/desc/content client-side, semantic preserved for now per spec deltas in prompts.md §3). (2) PROMPTS_RBAC_TEAMS_SUPPORTED stays false — gate inherits agents 2.8's introspection finding; flip after backend confirms RBACData.teams reads back. (3) "Favorites only" is a client-side intersection against the user's prompt_favorites ids — large libraries yield sparse pages, accepted per spec deltas; move server-side when the favorites_only filter exists. (4) prompt-card.tsx (legacy, agents form consumer) left untouched — its retirement belongs to a future agents-form pass per inventory item 66; usePrompts/useIncrementPromptUsage stay in hooks/use-prompts.tsx for the 4 cross-feature consumers (chat composer, chat selector, agents form, agents PromptBrowserSheet) per the brief. (5) GET_USER_BY_ID N+1 in version-history rows acknowledged (M10) but unfixed — batching is out-of-scope L4 machinery. Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of the new de prompts.* keys (best-effort German) + the new agents.promptBrowser.* entries, public-write tightening (H8) is documented but not behavior-changed — needs product sign-off + release note before flipping checkPromptWriteAccess for public prompts.) |
| 3.3 | Skills | pages/skills.md | L | 3 | 0.4, 1B (⌘K) | done (adversarial verification: 5 findings, 2 must-fix, revised; gates green: tsc clean, vitest 44/44, working tree clean. Skills redesign ships across 2ff7d18 (feat) + 061c6ec (fix) on top of the registry primitives borrowed from prior waves. Honest remainders from the minor findings left open after revision: (1) Duplicate "Save Version" button on mobile — app/(application)/skills/[skillId]/components/skill-editor-view.tsx:589-639 mounts a MobileTopbarAction with a Save Version button (rendered <md via components/shell/mobile-topbar.tsx:159 `md:hidden`) while app/(application)/skills/[skillId]/components/editor-top-bar.tsx:256-275 ALSO renders Save Version inline with no md+ visibility gate. On a 390px phone both bars stack and the user sees two primary 'Save Version' buttons (both purple) — anti-pattern #5 'one canonical action' and adds a second purple primary visible simultaneously with the file-header Save (which is the agents-precedent second purple). Fix: hide the inline Save Version below md, or wrap the entire inline EditorTopBar in `hidden md:flex`. (2) Raw palette classes in app/(application)/skills/components/skill-detail-panel.tsx:254-263 (border-amber-200, bg-amber-50, text-amber-600, text-amber-900, plus dark: variants) for the SKILL.md-missing warning. The brief calls for tokens-only; this dodges the semantic-color tokens (e.g., a token-mapped warning color or the design system's amber tokens). There is precedent in app/(application)/prompts/components/version-restore-modal.tsx:141-145, so this is a consistency note rather than a regression — but it propagates the off-token pattern into the redesigned skills surface. (3) Raw palette classes in app/(application)/skills/[skillId]/components/skill-diff-modal.tsx:81,85,89,435,457 (text-green-600, text-red-600, text-yellow-600, border-green-600/30, border-red-600/30 plus dark: variants) for diff status indicators. Arguably semantic-domain colors for added/removed/modified, but they bypass the token system; the brief's 'tokens only' rule is strict. Consider mapping to design-system success/destructive/warning tokens. Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of new de skills.* keys, decision on the mobile dual-Save-Version question (gate inline vs hide MobileTopbarAction), token-mapping pass for the amber warning + diff status colors.) |
| 3.4 | Knowledge | pages/knowledge.md | XL | 3 | 0.4, 1A; FilePicker contract after 2.1/2.3/3.1 | done (adversarial verification: 13 findings, 5 must-fix, revised in 1cff6c1; gates green: tsc clean, vitest 44/44, eslint 0 errors on touched dirs, i18n en/de parity 1801 keys, working tree clean. Knowledge redesign ships across four commits on redesign/phase-0-foundations: 5177b66 promoted FilePicker + FilterPanel + QueuePanel + DetailSection to components/primitives/ (registry-primitive birth — next consumers: 3.5 workflows for QueuePanel, /transcriptions for FilePicker promotion close-out, /chat session-files for FilePicker); 20189ee redesigned /data per knowledge.md (ContextList rail + ItemsTable + DetailDrawer + ActivityList; the legacy /data/[ctx]/(sources|processors|embeddings|archived) catch-all retired in favor of URL-state filters; ItemFormFields sliced into route-local sections; ItemFieldsSection now exposes keyboard-accessible CopyButton on name + external_id, replacing the legacy invisible-div-click pattern); 86463db migrated 6 consumers onto the promoted FilePicker primitive. Legacy globals retired: components/uppy-dashboard.tsx + components/item-form-fields.tsx deleted; components/items-selection-modal.tsx survives pending external-consumer audit (verify before deletion). Documented primitive-boundary deviation: components/primitives/file-picker.tsx imports lib/api/files (single consumer of the upload contract — graduate the import to a typed prop when the second consumer demands a different transport). Honest remainders from the minor findings left open after revision: (1) components/custom/recent-processings.tsx and components/custom/recent-embeddings.tsx are now orphaned — `grep -rn 'RecentProcessings|RecentEmbeddings' --include='*.tsx' --include='*.ts'` returns only the two definitions. They are dead code but still ship `GENERATE_CHUNKS`/`DELETE_CHUNKS` mutation hooks (recent-processings.tsx:60-98) and broken `/data/${contextId}/${item.id}` links (recent-processings.tsx:150, recent-embeddings.tsx:107). knowledge.md §4 explicitly required them to be merged into ActivityList AND the dead chunk mutations deleted; the merge happened (activity-list.tsx) but the legacy files were not removed — schedule deletion in a follow-up cleanup pass. (2) No middleware or next.config redirect for the legacy URL shapes the page-doc §3 enumerates: `/data/[ctx]/sources|processors|embeddings`, `/data/[ctx]/archived[/item]`, `/data/[ctx]/[item]`. The catch-all route is gone; any external link (toast, email, notification, saved bookmark) using these will 404. Less acute than the two must-fixes already revised because there are no in-repo live consumers besides the two flagged in message-renderer/response. (3) ItemFieldsSection's view-mode click-to-copy row (item-fields-section.tsx:50-98) only exposes copy buttons for `name` and `external_id` — description and tags fall back to ItemFormFields' read-only display with no copy affordance. Inventory item #41 ("Click-to-copy of any field value") is partially regressed for description/tags in view mode. The keyboard-accessible CopyButton fix is correctly applied to the values that are present, so this is a coverage gap rather than the legacy invisible-div-click bug returning. (4) Hardcoded user-facing string in NEW knowledge code: app/(application)/data/[ctx]/components/item-form-fields.tsx:341 — `<SelectValue placeholder="Select a value" />` for context-defined enum fields. Verifier rule (4) says "no hardcoded user-facing strings in NEW code under app/(application)/data". The string was carried over verbatim from the legacy components/item-form-fields.tsx but is now in NEW redesign code — needs a knowledge.* (or common.*) i18n key + en/de pair. (5) Documented primitive-boundary deviation: components/primitives/file-picker.tsx imports lib/api/files (above). Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of new de knowledge.* keys, audit + delete components/items-selection-modal.tsx after external-consumer verification, delete recent-processings.tsx + recent-embeddings.tsx (dead code + dead mutations) in a cleanup commit, add a middleware or next.config redirect for the four legacy /data URL shapes, extend ItemFieldsSection view-mode CopyButton coverage to description + tags, i18n the SelectValue placeholder on item-form-fields.tsx:341.) |
| 3.5 | Workflows / Routines | pages/workflows.md | L | 3 | 0.4, 1A; QueuePanel w/ 3.4+5.1; backend filter (partial) | done (adversarial verification: 8 findings, 0 must-fix, no revision required; gates green: tsc clean, vitest 44/44, i18n en/de parity 1962 keys, working tree clean. Routines redesign ships across 58e5010 (feat) + 7f00e6e (terminology canon) on redesign/phase-0-foundations. The /workflows route now carries the JTBD-first "Routine" pattern (saved conversations that run on demand or on a schedule): RoutineList rail + RoutinePanel detail with Overview/Runs/Schedule/Queue tabs (app/(application)/workflows/components/), RunRoutineDialog for typed-variable runs (now/queue, prefill-aware), ScheduleEditor for CRON presets + custom expressions, QueuePanel reused from the 3.4 primitive birth (components/primitives/queue-panel.tsx) with retry routing through the non-interactive RUN_WORKFLOW path to fix the dialog-overwrite bug, VisibilityChip/CronChip route-local. Legacy retired: components/save-workflow-modal.tsx slimmed to the routine-editor surface; the monolith columns.tsx + data-table.tsx + data-table-view-options.tsx deleted. Backend-gated /n8n full-bleed page split out (app/(application)/n8n/n8n-client.tsx) with slim header, mobile escape hatch + open-in-new-tab affordance, and notConfigured empty state. Terminology canon: "Routine" replaces "Workflow" in user-facing copy across analytics summary cards and role permissions area labels (7f00e6e). Honest remainders from the minor findings left open (none of them must-fix, but each is a tracked gap to close): (1) Inventory item #7 (bulk delete) is unreachable in the redesign — the disclosure ladder places it at L3 ("Toolbar 'Select' mode adds checkboxes; bulk Delete via shared ConfirmDialog with count"), but RoutineList (app/(application)/workflows/components/routine-list.tsx:73-144) never passes the `selection` prop to DataTable and RoutineToolbar (app/(application)/workflows/components/routine-toolbar.tsx) has no Select toggle. The DataTable primitive supports it (components/primitives/data-table.tsx:71-92) — it's just unwired. Net effect: same legacy gap (silently unreachable), no semantic regression on a working flow — sits at the floor of "missed ladder commitment" rather than a broken capability. (2) Inventory item #26 partial — the "Retry with edits…" per-job menu item that closes the Queue Sheet and opens RunRoutineDialog seeded from `data.inputs` is not implemented. Bulk + default retry correctly route through the non-interactive RUN_WORKFLOW path (app/(application)/workflows/routines-client.tsx:351-379) via QueuePanel's `retryJob` prop (fixing the dialog-overwrite bug), but the alternative seeded-edit interactive path called out in the ladder for ad-hoc per-job edits is absent. RunRoutineDialog already accepts a `prefill` map (app/(application)/workflows/components/run-routine-dialog.tsx:48-67) — the wiring in QueuePanel is the only missing piece. (3) Inventory item #11 routing intent ("click last-run cell = open panel on Runs tab") is not honored. RoutinePanel hardcodes `defaultTab="overview"` (app/(application)/workflows/components/routine-panel.tsx:55,63) and routines-client.tsx never threads an entry-point tab through. Clicking anywhere on a row lands users on Overview, even when their click target was the StatusDot in the Last Run column. Type `RoutinePanelTab` exists; the wiring is the missing piece. (4) Inventory item #51 (legacy `getStatusBadge` retirement) is incomplete outside /workflows: the dead helper and the two commented State column call sites still live at app/(application)/evals/[id]/runs/components/queue-management.tsx:233 (helper) and :504 (TableCell). Workflows itself migrated to the promoted QueuePanel primitive (components/primitives/queue-panel.tsx), but the evals queue-management was not touched in this work item — it sits at the boundary between 2.12 and the eventual evals redesign and should be cleaned up either in a follow-up cleanup commit or rolled into the next evals work item. Remaining human actions: visual QA both themes at 390/768/1440, native-speaker review of the new de routines.* + n8n.* keys, wire RoutineList → DataTable `selection` prop + RoutineToolbar Select toggle to ship the L3 bulk-delete affordance (Inventory #7), wire QueuePanel "Retry with edits…" per-job action to RunRoutineDialog with `prefill={data.inputs}` (Inventory #26), thread an entry-point `defaultTab` from routines-client.tsx so Last Run cell clicks land on the Runs tab (Inventory #11), delete the dead `getStatusBadge` helper + commented State TableCell at app/(application)/evals/[id]/runs/components/queue-management.tsx:233,504 in a cleanup commit (Inventory #51 close-out). Subpage promotion landed 2026-06-14: routine panel → /workflows/[id] subpage (commits 8b38c99 fix(routines): five QA fixes from /workflows panel review + 9e63d8e feat(routines): promote routine panel to /workflows/[id] subpage). Verification: 2 findings, 0 must-fix, no revision required; gates green: tsc clean, vitest 44/44, working tree clean. The detail surface graduated from a slide-over Sheet to a routed subpage at /workflows/[id] (app/(application)/workflows/[id]/page.tsx + components/routine-workbench.tsx); rail navigation routes via router.push, deep links + browser Back work; Queue tab promoted to a Sheet inside the subpage (routine-workbench.tsx mounts QueuePanel there). The ChatSaveAsRoutineHandshake (app/(application)/workflows/types.ts:123-136) preserved byte-for-byte (save-workflow-modal barrel re-export untouched in 9e63d8e). Honest open remainders from the minor findings (both pre-existing, not introduced by the promotion): (a) Cross-feature claim partially false — workflows.md states "After saving from chat, the user lands on /workflows/[newId] (not back at /workflows)". In app/(application)/chat/components/chat-header.tsx:460-466 SaveWorkflowModal is mounted with only `onClose={() => setRoutineOpen(false)}` and no id-receiving callback; the editor's handleSave in app/(application)/workflows/components/routine-editor-dialog.tsx:296-310 calls `onClose()` after the CREATE mutation without exposing the created template's id; ChatSaveAsRoutineHandshake interface only defines `onClose: () => void`. So a chat user who saves a new routine stays in chat — they do NOT land on /workflows/[newId]. The promotion preserves the handshake exactly as it was before (`git diff 8b38c99 9e63d8e -- components/save-workflow-modal.tsx` is empty), so this is a pre-existing limitation rather than a regression. Closing the gap requires coordinated changes in chat-header.tsx and the editor's onClose signature. (b) Queue Sheet RBAC carry-over — inside the subpage Queue Sheet (app/(application)/workflows/[id]/components/routine-workbench.tsx:185) QueuePanel is passed `canWrite={true}` unconditionally, so a read-only user (canRun=false, canWrite=false per app/(application)/workflows/access.ts:96-97) reaching the workbench could still pause/drain/retry the agent's queue from the Sheet. This mirrors the legacy panel exactly (git show 8b38c99:routines-client.tsx line 351 also had `canWrite={true}`), so it is not a regression from the promotion — but workflows.md ladder §3 RBAC explicitly says "queue ops … gated to write". Worth a follow-up; not blocking the promotion.) |
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
