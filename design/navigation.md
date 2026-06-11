# Navigation & App Shell — Information Architecture and Design Concept

> The shared shell every page lives inside: the sidebar IA, RBAC rendering rules, page chrome,
> command palette, mobile navigation, and the shell's motion language. Derives from
> `design/philosophy.md` (L0 of the disclosure ladder) and `design/personas.md` (final ownership
> matrix — corrections from all 20 page docs are applied there and consumed here). Evidence base:
> `design/audits/shell-navigation.md`.

**The one-sentence test (philosophy §1):** the shell's primary persona is *whoever just logged
in*, and its #1 job is *show me only the destinations my role needs and get me into the right
one in a single click*. A pure end user's Exulu is a 4–6 item chat app; a super admin's is a
calm, grouped command center. Same shell, RBAC-composed.

---

## 1. Information architecture

### 1.1 Principles applied

1. **Persona-altitude groups, not feature alphabet** (`personas.md` §"How personas shape the
   navigation"): Workspace → Build → Develop → Administration → Personal, top to bottom in
   descending frequency-of-use and ascending privilege.
2. **RBAC trims whole groups, not items-greyed-out.** A group with zero visible items does not
   render — header included. A persona never sees evidence of machinery they can't use
   (resolves audit H1/H2).
3. **One declarative source of truth.** The entire table below ships as
   `components/shell/nav-config.ts` — a single
   `NavEntry { id, group, route, i18nKey, icon, requires, configFlag?, aliases?, mobile? }`
   array consumed by the sidebar, the mobile drawer, the command palette, and route guards.
   Gating can never diverge between surfaces again (audit rec. 2).
4. **Labels follow the terminology canon** (audit M1/M2): every label via `navigation.*` i18n
   keys in both locales; no hardcoded strings; nav label = page H1 = palette entry.

### 1.2 The navigation tree

`requires` notation: `SA` = `user.super_admin`; `role.x:w` = `role.x === "write"`;
`role.x:r+` = `role.x ∈ {read, write}`; `elevated` = SA or any non-null role right
(`agents | workflows | evals | users | variables | api | budget_management`).

| Group | Item (en / de) | Route | Icon (lucide, stroke-1) | Visible when | Notes |
|---|---|---|---|---|---|
| — (top, ungrouped) | Home / Start | `/` | `House` | `elevated` | P1-only accounts get **no Home item**; for them `/` server-redirects to `/chat` (dashboard.md routing rule). Elevated users land here post-login. |
| **Workspace** | Chat / Chat | `/chat` | `MessageCircle` | all | Aliases: `/chat/*` |
| Workspace | Projects / Projekte | `/projects` | `FolderOpen` | all | Aliases: `/projects/*` |
| Workspace | Transcripts / Transkripte | `/transcriptions` | `FileAudio` | all **and** `config.transcription.enabled` | Fixes audit M3 (config flag finally honored) |
| **Build** | Agents / Agenten | `/agents` | `Bot` | `SA \|\| role.agents:r+` | Aliases: `/agents/edit/*` |
| Build | Knowledge / Wissen | `/data` | `Brain` | `SA \|\| role.knowledge:r+` → **interim:** `SA \|\| role.agents:r+` | RBAC-trimmed away from P1 (knowledge.md #83). Long-term route rename `/data`→`/knowledge` (audit rec. 9). Aliases: `/data/*` |
| Build | Prompts / Prompts | `/prompts` | `ClipboardType` | `SA \|\| role.agents:r+` | Route stays open to all by URL — P1's "use" path lives in the chat composer's prompt selector, not the sidebar (prompts.md row 1; same placement-vs-access logic as `/token`) |
| Build | Skills / Skills | `/skills` | `Sparkles` | `SA \|\| role.agents:w` | skills.md ladder row 1 |
| Build | Routines / Routinen | `/workflows` | `ListChecks` | `SA \|\| role.workflows:r+` | Read role now gets the item + read-only page (workflows.md row 187). Terminology canon: "Routine" everywhere |
| Build | Automation / Automatisierung | `/n8n` | `Workflow` | (`SA \|\| role.workflows:r+`) **and** `config.n8n.enabled` | n8n secondary = P4, not P3 (workflows.md correction) |
| Build | Feedback / Feedback | `/feedback` | `Inbox` | `SA` (future `role.feedback`) | The review console (feedback.md). **Product decision 2026-06-11: lives in Build** (originally Administration). Icon deliberately ≠ the footer's "Send feedback" icon — the name is split, the surfaces stay |
| **Develop** | Evals / Evaluationen | `/evals` | `BookCheck` | `SA \|\| role.evals:r+` | Aliases: `/evals/[id]`, `/evals/cases` |
| Develop | API Explorer / API-Explorer | `/explorer` | `Code` | `SA \|\| role.api:w` | Gate made *evaluable* by adding `api` to `serverSideAuthCheck`'s role object (explorer.md U2). Secondary persona: P2 via `role.api:w` |
| Develop | API keys / API-Schlüssel | `/keys` | `Key` | `SA \|\| role.api:w` | **Product decision 2026-06-11: lives in Develop** beside the Explorer and Personal token (originally Administration). Same `serverSideAuthCheck` fix as Explorer |
| Develop | Personal token / Persönlicher Token | `/token` | `KeyRound` | `SA \|\| role.api:r+` | **Moves out of the every-user dropdown** into Develop (keys-token.md row 23). Route stays URL-accessible for all — placement fix, not an access change |
| **Administration** | Users & access / Benutzer & Zugriff | `/users` | `Users` | `SA \|\| role.users:w` | One entry for the whole identity area; `/roles` and `/teams` are tabs of it and **aliases** for active-state matching (access.md). Fixes audit M5 |
| Administration | Models / Modelle | `/models` | `Cpu` | `SA \|\| role.models:w` → **interim:** `SA \|\| role.agents:w` | Interim gate is the current (semantically wrong) one; recorded as backend dependency (audit M4) |
| Administration | Budgets / Budgets | `/budgets` | `Wallet` | `SA \|\| role.budget_management:r+` | Read-scoped roles are the legitimate secondary audience (budgets.md correction) |
| Administration | Analytics / Analytik | `/analytics` | `BarChart3` | `SA` | Unchanged gate; a future `role.analytics:r+` opens an agent-scoped P2 path without IA change (analytics.md) |
| Administration | Variables / Variablen | `/variables` | `Variable` | `SA \|\| role.variables:r+` | Label unified ("Vault" retired); read role gets read-only page (variables.md row 1). Aliases: `/variables/*` |
| Administration | Theme / Theme | `/configuration` | `Palette` | `SA` | **Product decision 2026-06-11: relabeled "Theme"** (the page is theming/white-label only, so the earlier "Configuration" canon overstated it; route unchanged). If the page ever grows beyond theming, revisit the label |
| **Personal** (footer) | Send feedback / Feedback senden | dialog (no route) | `MessageSquarePlus` | all **and** `config.feedback.enabled` | Relabeled from "Feedback" to break the homonym with the review console (feedback.md issue 2) |
| Personal (footer) | Settings / Einstellungen | `/settings` | `Settings` | all | **Product decision 2026-06-11: not a footer item** — Settings lives only in the user menu (and the ⌘K palette). The entry stays in `nav-config.ts` with `hiddenInSidebar` so the palette and mobile top-bar label keep resolving it |
| Personal (footer) | User menu | — | avatar | all | Theme (light/dark/**system** three-state), Language submenu (scales past 2 locales), Settings link (the only Settings affordance), Log out. **Token link removed** (lives in Develop) |

**Routes with no nav entry (by design):** `/login` (unauthenticated shell — auth.md owns it;
design owner P1, flow identical for all), `/chat/[agent]/search` (reached from chat's history
rail), `/evals/cases` (tab/breadcrumb inside Evals), `/models/create|edit`,
`/variables/create|edit|usage`, `/agents/edit`, `/prompts/[id]`, `/skills/[skillId]`,
`/projects/[project]`, `/data/[ctx]/…` — all detail/sub-surfaces that highlight their parent
item via the alias list.

### 1.3 What each persona actually sees

| Account | Sidebar contents | Item count |
|---|---|---|
| **P1 only** (no role rights) | Chat · Projects · Transcripts* — no group header rendered (single-group rule) — footer: Send feedback* · user menu (Settings inside) | **3–4** — a chat app |
| **P2 hat** (agents/workflows write) | Home · Workspace (3) · Build (4–6*) · footer | ~9–11 |
| **P4 hat** (api/evals) | Home · Workspace (3) · Develop (3–4) · footer | ~8 |
| **P3 / super admin** | Everything: Home · Workspace (3) · Build (7*) · Develop (4) · Administration (6) · footer | ~22, grouped and scrollable (subtle token-styled scrollbar, §2) |

\* config-flag dependent. Personas are cumulative — a real P2 account usually also has
Develop items; the groups compose additively.

**Rendering rules (normative):**

1. A group renders iff ≥1 of its items passes `can(user, requires)` **and** its config flags.
2. When exactly one group (Workspace) survives, its header label is suppressed — P1's sidebar
   reads as a flat app, not a one-folder tree.
3. Group headers are never interactive — **with one deliberate exception** (product decision
   2026-06-11): **Administration is collapsible**, because most of its items are infrequent
   even for admins. Guard rails that distinguish it from the retired auto-collapsing "Admin"
   accordion (audit M10): collapse is **manual only** (never auto-collapses), the choice
   **persists** (`localStorage`), the group **auto-expands when it contains the active
   route**, and a collapsed group owning the active route shows a small primary dot on its
   header so "where am I" never disappears. All other groups stay non-interactive; RBAC
   remains the primary density control.
4. Active-state matching is **first-segment equality plus the alias list**
   (`pathname.split("/")[1]`), never substring matching (fixes audit H7).
5. Route-level guards consume the same `requires` predicate via `lib/rights.ts` —
   nav-hidden must imply route-guarded (closes the `/workflows`, `/keys`, `/explorer`,
   `/configuration` open-by-URL gaps; pages render the shared AccessDenied EmptyState).

---

## 2. Sidebar design concept — "The Spine"

Not a stock shadcn sidebar. The shadcn `Sidebar` primitives (`components/ui/sidebar.tsx`)
remain the structural base (provider, rail, sheet, tooltips, cookie persistence), but the
visual identity is Exulu's own:

### Brand & header affordances

*(Reworked by the 2026-06-11 chrome decision — see §3.)* The sidebar itself has **no brand
header on desktop**: the generic **"AI Studio"** wordmark (`text-sm font-semibold
tracking-tight`, i18n key `navigation.brand.productName` — no customer logo, the platform
presents itself generically) and the collapse trigger (`PanelLeft`, tooltip "Collapse
sidebar — ⌘B", audit L3) live in the **top bar**, left cluster. The search ⌘K affordance
(ghost input-shaped button — opens the palette, is not an input) lives in the top bar's
right cluster. The mobile drawer keeps its own search affordance as its header, since the
desktop bar is hidden below `md`. The sidebar's nav column starts below the fixed bar
(`md:pt-14`) so the menu visibly "hangs" from the chrome.

### Items & icon language

- **Icons:** lucide, global `stroke-width: 1` (per CLAUDE.md and the design-system audit —
  per-call-site `strokeWidth` overrides are removed), `size-4`, color inherits text.
- **Item anatomy:** `h-8 rounded-md px-2 gap-2 text-sm` — icon + label. Inactive items are
  `text-sidebar-foreground/70` and transition to full foreground on hover (replaces the
  WCAG-risky `opacity-60`, audit M13).
- **Active state — the signature move:** a **sliding indicator**, not a color fill alone.
  A `w-[3px] h-4 rounded-full bg-primary` bar sits flush to the sidebar's left edge,
  vertically centered on the active item, and **slides** between items on navigation
  (Framer Motion `layoutId="nav-spine"`). The active item additionally gets
  `bg-sidebar-accent text-foreground font-medium`; its icon stays neutral (purple budget:
  the indicator is the sidebar's only purple, philosophy §4). This is where the concept name
  comes from — the indicator travels the spine of the app.
- **Group headers:** `text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70
  px-2 pt-6 pb-1`, never sticky. The first group gets `pt-2`. Non-interactive except
  Administration's collapsible header (§1.3 #3 amendment): chevron right-aligned (rotates 90°
  open, 200 ms), 0.2 s height animation, reduced-motion instant; collapsibility is disabled in
  rail mode (at 3 rem every item stays reachable under the hairline).
- **Hover affordance:** background `bg-sidebar-accent/50` in 150 ms; no scale, no shadow.
- **Focus:** standard ring-offset pattern on every item (keyboard parity with hover).

### Collapse behavior (rail mode)

- Widths: `16rem` expanded → `3rem` rail (existing tokens). State persists in the
  `sidebar_state` cookie; **the first-run default becomes expanded** (the inverted
  `=== "true"` check is fixed — audit §4) so new users meet labels, not mystery icons.
- In rail mode: labels unmount, each item shows a **right-side tooltip with its full label**
  (and shortcut where one exists) — no mystery meat, per philosophy anti-pattern #2.
  Group headers collapse to a centered 16px hairline (`border-t border-sidebar-border w-4`)
  so the grouping rhythm survives at 3rem. The active indicator persists at the rail's left
  edge.
- `⌘B` toggles; the trigger is also always visible in the header.

### Footer

*(Reworked by the 2026-06-11 chrome decision.)* The desktop sidebar has **no footer**: the
Feedback button and the avatar user menu live in the top bar (§3). The **mobile drawer**
keeps a hairline-separated footer with the **Send feedback** item (`MessageSquarePlus`,
config-gated, opens the shared FeedbackDialog), because the desktop bar is hidden below
`md`; the avatar menu sits in the MobileTopbar's right edge there. The user menu itself:
avatar trigger (initial, `bg-muted text-foreground` — no gradient/`text-white` contrast
trap, audit L8), opening downward with an identity header (name + email), then **Theme**
(light / dark / system — three-state, audit M8), **Language** (locale submenu, audit M9,
cookie + `router.refresh()`), **Settings** (*the only Settings affordance*), **Log out**.
Nothing else — Token has moved to Develop.

### Tokens

The `--sidebar-*` token set is kept but reconciled to a single background var (the
`--sidebar` vs `--sidebar-background` conflict resolved — design-system audit), and
`--sidebar-ring` is remapped to the brand ring, killing the stray blue. Sidebar background
stays a quiet cool gray one step off the content background with a `border-r
border-sidebar-border` hairline — structure from spacing first, lines second.

Long trees (super admin) scroll inside `SidebarContent` with the **`scrollbar-subtle`**
utility (app/globals.css): thin, transparent track, rounded `--border`-token thumb that
darkens on hover — quiet, theme-correct in both modes. Pages adopt the same utility for
their scroll containers as they migrate.

---

## 3. Top bar / page chrome

**Product decision 2026-06-11 (supersedes the original "no desktop top bar" rule):** the
shell uses a **unified chrome "L"** — a fixed `h-12` top bar and the sidebar share the
`--sidebar` background as one surface, and the page content sits in an **inset card** with a
rounded top-left corner (`md:rounded-tl-2xl md:border-l md:border-t border-sidebar-border`,
`bg-background`) that flows out of the chrome. The sidebar carries no side border — the
card's edge is the separator. Reference: Mistral Studio's console layout.

**Top bar contents (≥ md):** left — sidebar collapse trigger (⌘B tooltip) + the generic
"AI Studio" wordmark; right — **Feedback** ghost button (config-gated, opens the shared
FeedbackDialog), the **search ⌘K affordance** (input-shaped button, `w-56 lg:w-64`, opens
the command palette), and the **avatar user menu** (opens downward, identity header with
name + email, then Theme / Language / Settings / Log out). The sidebar itself is pure
navigation: its nav column starts below the bar (`md:pt-14`), and its old header/footer
affordances live in the bar. No border under the bar — the chrome flows into the page card.

Everything inside the content card belongs to the page, built on the shared primitives
(philosophy §5):

- **PageShell** — the layout renders a single scroll container (`div`, not `main` — the one
  `<main>` landmark lives in `layout.tsx`, fixing the nested-main a11y bug, audit M11) with
  two variants: centered content page and full-bleed work surface (chat, knowledge, skills
  editor, explorer, n8n).
- **PageHeader** — owned by each page: `text-2xl` title, one-line purpose, one primary action.
  **Breadcrumbs live here, not in shell chrome**: subpages render a `text-sm
  text-muted-foreground` breadcrumb line above the title using the shadcn `Breadcrumb`
  primitive (finally consumed) — "Agents / {name}", "Knowledge / {context}", "Evals / Test
  cases". The shell exports the recipe; pages supply the trail.
- **Toolbar** — directly under PageHeader on list pages, identical placement everywhere.

**What deliberately does NOT exist in the shell:** a notification bell, global breadcrumbs
(breadcrumbs live in PageHeaders), a real top-bar search *input* (the affordance is a button
into ⌘K), theme/language toggles outside the user menu, and any second "Settings" affordance
(product decision 2026-06-11: Settings exists only in the user menu). The bar holds chrome,
never page content — page titles, toolbars, and actions stay inside the content card.

**Mobile (< md)** — see §5: the MobileTopbar replaces the desktop bar (drawer trigger + page
label + action slot + the same avatar menu, fixes audit H3); the drawer keeps its own ⌘K
search affordance and Send-feedback footer since the desktop bar is hidden there.

---

## 4. Command palette (⌘K)

`cmdk` via the existing shadcn `Command` + `Dialog` primitives. Fed **exclusively from
`nav-config.ts` plus a registry of create-actions and entity-search providers** — the palette
can never show a destination the sidebar would hide (same `can()` predicate).

### Scope & grouping (in result order)

| Group | Contents | Source |
|---|---|---|
| **Recent** | Last 5 visited pages + last 3 chat sessions | client-side history (localStorage) |
| **Navigate** | Every RBAC-visible nav entry, icon + label + group name as muted suffix ("Variables — Administration") | `nav-config.ts` |
| **Create** | New chat · New project · New agent · New prompt · New skill · New routine *(from chat — deep-links there)* · New eval · New variable · New model · New API key · Invite user · Upload audio (transcribe) — each RBAC-gated like its page's primary action | action registry |
| **Search** (async, ≥2 chars, 300 ms debounce) | Agents · Chat sessions · Projects · Prompts · Knowledge contexts · Skills — grouped headers, max 5 per group, "Searching…" shimmer rows while pending | existing GraphQL search/list queries, scoped by backend RBAC |
| **Preferences** | Theme: light / dark / system · Language: {locales} · Toggle sidebar | shell actions |

Selection always navigates or executes immediately — the palette never opens a second overlay
(anti-pattern #3); "Create" entries deep-link to the owning page with its create surface open
(`?new=1`).

### Keyboard shortcuts table

| Shortcut | Action | Owner |
|---|---|---|
| `⌘K` / `Ctrl+K` | Open command palette | shell (global; pages release any prior ⌘K bindings — skills.md H8) |
| `⌘B` / `Ctrl+B` | Toggle sidebar / rail | shell (existing, now surfaced in tooltip) |
| `↑` `↓` `Enter` | Move / select in palette | cmdk default |
| `Esc` | Close palette → close overlays (existing chat priority chain) | shell / page |
| `N` | Create (page-local, list pages: prompts, skills, evals…) | pages, hinted in their primary-action tooltip |
| `⌘.` | Chat overflow menu | chat page (registered in palette as "Chat: open session menu" when in chat) |

No chord sequences (G-then-X) in v1 — the persona spread includes non-technical P1; chords are
a later, additive enhancement.

---

## 5. Mobile navigation

Decision: **drawer, not bottom tabs — for everyone.** Rationale: P1's mobile job is a
full-screen chat (philosophy §7); a persistent bottom bar steals composer/keyboard space and
duplicates what the chat header already provides, and the consumer apps P1 benchmarks against
(ChatGPT, Claude) use a drawer. Power/admin personas get the same drawer with their fuller
tree — one pattern, RBAC-composed (anti-pattern #4: no second nav system).

### The pieces (below `md` / 768px)

1. **Shell mobile top bar** — `h-12 px-3 border-b flex items-center gap-2`, shell-rendered on
   every route **except chat sessions**: `[Menu (hamburger) trigger]` `[current page label
   from nav-config]` `[spacer]` `[page action slot]`. This is the guaranteed drawer trigger
   the app currently lacks (audit H3 — today there is literally no way to open navigation on
   a phone).
2. **Nav drawer** — the existing sidebar `Sheet` (`side="left"`, `w-[18rem]`), same grouped
   tree, same RBAC trims, same active indicator; the Sheet's stock close button is restored
   (the `[&>button]:hidden` suppression is removed). Tapping any item navigates and closes.
   Swipe-from-left-edge optional, scrim tap always closes.
3. **Chat stays full-screen.** On `/chat/[agent]/[session|new]` the shell suppresses its top
   bar; the ChatHeader (chat.md) is the only bar, and the shell exports **`AppNavTrigger`**
   (the hamburger, `Menu` icon) which ChatHeader mounts as its **leftmost** control. Chat's
   own history trigger uses the `History` icon (amending chat.md's ☰ glyph) and sits with the
   agent identity — resolving the collision exactly as chat.md's dependency note requires:
   left = app nav, in-page = history.
4. **P1 reality check:** drawer contents are Chat / Projects / Transcripts + footer — three
   taps' worth of app. Their daily loop (history, new chat, search) never needs the drawer at
   all; it lives in the chat header. The drawer is for the weekly "switch surface" moment.
5. **P3/P4 reality check:** monitor-and-react jobs (`personas.md`) — drawer to Budgets /
   Evals / Users, read, act, leave. The mobile top bar's page-action slot carries each page's
   single primary action; tables degrade per `design/responsive.md` (tables→cards,
   panels→sheets).
6. Safe areas: drawer and top bar respect `env(safe-area-inset-*)`; all touch targets ≥44px;
   `useIsMobile`'s desktop-first flash is fixed by initializing from a media-query snapshot
   (audit L4).

---

## 6. Motion language

The shell owns exactly five animations (CLAUDE.md timings; every one behind
`prefers-reduced-motion` — reduced gets instant state swaps):

| # | Moment | Spec | What it explains |
|---|---|---|---|
| 1 | **Active indicator slide** | Framer Motion `layoutId="nav-spine"`, 200 ms `ease-in-out` | Where you went — continuity of position in the IA |
| 2 | **Rail collapse / expand** | width 200 ms `ease-in-out`; labels fade 150 ms (fade-in delayed 50 ms on expand so text never overflows mid-animation) | The same items persist; only density changes |
| 3 | **Mobile drawer** | slide-in 300 ms `ease-in-out` + scrim fade 300 ms | Origin: nav lives off-canvas left |
| 4 | **Command palette** | fade + scale 0.98→1, 150 ms `ease-in-out`; close 150 ms | Summoned overlay, not a page change |
| 5 | **Hover / focus on items** | background 150 ms | Standard affordance |
| 6 | **Administration group collapse** *(2026-06-11 amendment)* | height 200 ms `ease-in-out` (Radix Collapsible), chevron rotate 200 ms | The same items persist; only the group's density changes |

**Deliberately absent:** page-transition animations (navigation must feel instant —
philosophy §6; perceived speed comes from route-level `loading.tsx` skeletons that mirror each
page's real layout, added per top-level route group), logo animation, badge pulses in the nav,
and any looping motion.

---

## 7. Implementation notes

### New structure (per `design/audits/codebase-structure.md` target layout)

```
components/shell/
  nav-config.ts        # the declarative NavEntry table (§1) — single source of truth
  app-sidebar.tsx      # Sidebar composition: brand, search button, groups, footer
  nav-group.tsx        # group header + item list (one renderer — kills the duplicated markup)
  nav-item.tsx         # item + sliding indicator + rail tooltip
  user-menu.tsx        # avatar dropdown (theme 3-state, language submenu, settings, logout)
  brand.tsx            # generic "AI Studio" wordmark + rail monogram (product decision 2026-06-11)
  mobile-topbar.tsx    # h-12 bar below md, page label + action slot
  app-nav-trigger.tsx  # exported hamburger (consumed by ChatHeader)
  command-palette.tsx  # cmdk dialog fed from nav-config + action/search registries
lib/rights.ts          # Requirement type + can(user, requirement) — shared by nav, palette,
                       # route guards, and Home's RBAC widgets (dashboard.md dependency)
```

### What happens to `components/custom/main-nav.tsx` (608 lines)

**Deleted at the end of the migration.** Its responsibilities disperse: `buildNavigation()` →
`nav-config.ts` + `lib/rights.ts`; `NavigationItems`/`AdminNavigationSection` (≈40 duplicated
lines) → `nav-group.tsx`/`nav-item.tsx`; footer/user dropdown → `user-menu.tsx`;
`MainNavProvider` → an `AppShell` component mounted by `app/(application)/layout.tsx`;
`NavigationErrorBoundary` survives, i18n'd. Dead code goes with it: the unreachable `!user`
skeleton, the never-firing auto-close effect, 12 unused lucide imports, plus
`components/ui/navigation.tsx`, `components/main-loader.tsx`, and the orphaned `ldrs` CDN
script in `layout.tsx:108` (audit L1, M7).

### `components/ui/sidebar.tsx` (shadcn primitive)

Kept as vendored primitive. Sanctioned changes: (1) first-run `defaultOpen` fixed in
`layout.tsx` (`cookie === undefined ? true : cookie === "true"`); (2) mobile Sheet close
button un-suppressed; (3) mobile Sheet `duration-300` (motion budget §6 #3); (4) side
borders removed (2026-06-11 chrome decision — the inset content card's edge is the
separator). No other forks — tooltips, cookie, `⌘B` machinery are reused as-is.

### Layout / providers (same milestone, shell-adjacent)

`app/(application)/layout.tsx`: content wrapper becomes a `div` (one `<main>` only, M11);
single toast system (Sonner; radix `Toaster` unmounted, M14); `<html lang={locale}>`;
`theme-provider.tsx` stops overriding `defaultTheme` (M8); production `console.log`s removed
and `FEEDBACK_TOKEN` proxied server-side (H4 — ships first, independent of redesign); Apollo
client memoized (M12). i18n: complete `navigation.*` keys in en+de (Models, Budgets, Personal
token, Home, group labels `navigation.groups.*`), orphaned keys pruned.

### Sequencing & scope

**Scope: L** (≈1.5–2 weeks engineering, after the one-day security/correctness fixes).

1. **M0 (immediately):** FEEDBACK_TOKEN proxy, console.log removal, active-state segment
   matching, theme-provider fix, sidebar default-open fix.
2. **M1:** `lib/rights.ts` + `nav-config.ts` + grouped sidebar + mobile top bar/drawer +
   brand header + user menu. This is the visible redesign and unblocks every page doc's
   "Build/Develop/Administration group" dependency.
3. **M2:** command palette; Home route + redirect rule (with dashboard.md); route-level
   `loading.tsx` skeletons.
4. **M3 (threaded through page work):** breadcrumb adoption in PageHeaders, terminology canon
   in `messages/*.json`, `/data`→`/knowledge` route rename behind a redirect.

### Risks & dependencies

- **Backend role-model extension** (cross-team): new permission keys for `knowledge`,
  `models`, `feedback`, `analytics` (and a populated `api` field in `serverSideAuthCheck` —
  today `role.api` is never set, so Explorer/Keys gates silently collapse to super_admin,
  explorer.md U2 / keys-token.md U3). The IA ships with the interim gates in §1.2 and flips
  predicates in `nav-config.ts` only — one-line changes when the keys land.
- **Muscle-memory breaks:** Token leaves the user dropdown (route unchanged — release note);
  elevated users land on Home instead of chat (dashboard.md accepts this; P1 unaffected).
- **Chat coordination:** `AppNavTrigger` placement inside ChatHeader must land with chat's
  header rework or chat temporarily renders the shell mobile bar above its own — agreed
  fallback, ugly but navigable.
- **Group-trim correctness:** an account whose only right is `budget_management:read` must see
  *only* Administration→Budgets — test the matrix of single-right roles; the `can()` unit
  tests are the cheap insurance.
- **i18n review for German labels** (Benutzer & Zugriff, Persönlicher Token) by a native
  speaker before ship.
