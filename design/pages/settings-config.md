# Personal Settings & Platform Configuration — Review & Design Concept
**Routes:** `/settings`, `/configuration`  **Primary persona:** P1 End User (`/settings`) / P3 Admin (`/configuration`)  **Secondary:** all personas (`/settings`), P4 Developer (`/configuration`, token consumer)  **Current state:** two stub pages — `/settings` is a single textarea while the rest of P1's preferences hide in a sidebar dropdown, and `/configuration` is a blind theme editor (no defaults shown, no preview, no route guard, "personalize your IMP" copy) whose changes only appear after a full page reload.

These are two deliberately separate pages with different owners. `/settings` is the one page
**every** account sees — it must feel like the consumer-grade settings screen P1 expects.
`/configuration` is white-label theming for the platform owner — visited rarely, high-stakes
(one bad HSL value restyles the app for the whole org), and currently offers zero feedback
before publishing. The persona separation stays sharp: nothing platform-wide ever appears on
`/settings`, nothing personal ever appears on `/configuration`.

---

## 1. Current state

### Functionality inventory

Numbered contract — nothing on this list may be lost. File references relative to repo root.
"main-nav" = `components/custom/main-nav.tsx`; "queries" = `queries/queries.ts`.

**Entry points & shell-resident personal preferences (the personal-settings job today)**

1. `/settings` entry point: item "Settings" (`navigation.settings`, `messages/en.json:27`) with `Settings` icon inside the sidebar-footer **user dropdown** (main-nav:568-573). No RBAC gate — every authenticated user. There is **no sidebar nav item** for `/settings`; the dropdown is the only path in the entire app (verified: sole `href="/settings"` occurrence).
2. **Theme toggle** lives in the same user dropdown, not on `/settings`: item showing Sun/Moon icon + label `navigation.theme`, flips `light` ⟷ `dark` via next-themes (main-nav:550-559, handler 437-443). The provider default is `system` (`app/(application)/layout.tsx:113`) but the toggle is binary — once a user touches it, **"system" can never be restored** from the UI.
3. **Language toggle** in the same dropdown: `Languages` icon, label shows the *other* locale ("Deutsch"/"English"), flips `en` ⟷ `de` (main-nav:559-566, handler 446-452). `setLocale` writes a 1-year cookie, loads the new message bundle, then forces `window.location.reload()` (`components/language-provider.tsx:44-58`; cookie read server-side at `app/(application)/layout.tsx:27,40`).
4. Link to `/token` (personal API token page — own page doc) in the same dropdown, `Album` icon, hardcoded label "Token" (main-nav:574-579). **No RBAC gate anywhere on this path today**: the dropdown item renders for every authenticated user, and `/token` itself checks only `useSession` status — no role or user check (`app/(application)/token/page.tsx:14,57-88`).
5. Logout item in the same dropdown: pushes `/api/auth/signout`, with a `window.location.href` fallback on error (main-nav:580-585, handler 455-463).

**`/settings` page — `app/(application)/settings/page.tsx`**

6. Client component with `export const dynamic = "force-dynamic"` (settings/page.tsx:18). No skeleton/loading state (user arrives synchronously from `UserContext`).
7. Page header: "Settings" (`text-3xl font-bold`) + "Manage your personal preferences." — **hardcoded English**, centered column `max-w-2xl mx-auto` inside `container mx-auto p-6` (settings/page.tsx:61-68).
8. Single Card "Personal system prompt" with a long CardDescription explaining the field is appended to the system prompt of **every chat the user starts** (settings/page.tsx:70-79).
9. Textarea: 10 rows, `resize-y`, example placeholder "e.g. I'm a backend engineer working in TypeScript…" (settings/page.tsx:81-87).
10. Local state seeded from `UserContext.user.personal_system_prompt`, re-seeded whenever `user.id` changes (settings/page.tsx:24-30; context provided in `app/(application)/authenticated.tsx:30,35` from the server-side user of `lib/server-side-auth-check.ts:33-71`). The mutation result is **never written back to the context**, so revisiting the page after navigation shows the pre-save value until a full reload.
11. Save button → `UPDATE_USER_BY_ID` mutation sending only `id` + `personal_system_prompt` (settings/page.tsx:50-58; mutation queries:827-855 — it also supports `email/firstname/lastname/anthropic_token/super_admin/role/team/favourite_agents`, used elsewhere). Button disabled while saving or when `user.id` is missing; label flips to "Saving…" (settings/page.tsx:89-91). No dirty-state tracking — Save is always clickable, even with zero changes.
12. Feedback: success toast "Settings saved" (3 s) / destructive toast surfacing the **raw GraphQL `error.message`** (5 s) (settings/page.tsx:32-48).
13. Downstream contract: `personal_system_prompt` is part of `USER_FIELDS` (queries:97) and the type model (`types/models/user.ts:9`); the backend appends it to every chat system prompt (behavior documented in the card copy, settings/page.tsx:73-78).

**`/configuration` entry & gating**

14. Sidebar nav item label `navigation.themeSettings` — **"Theme"** (en) / **"Design"** (de) (`messages/en.json:25`, `messages/de.json:25`) — `Palette` icon, inside the collapsible bottom "Admin" section, visible **only when `user.super_admin`** (main-nav:212-218). No granular role right exists for it in the type model (roles cover agents/workflows/evals/variables/users/budget_management only — `types/models/user.ts:21-31`). Clarification so this doesn't contradict the RBAC summary in §4: the nav *also* gates `/explorer` and `/keys` on a `role.api` right at runtime (main-nav:204, 220) that exists in neither the type model nor the `serverSideAuthCheck` role object — it is never populated, so those gates currently evaluate to super_admin-only (the bug documented in `design/pages/keys-token.md` U3). `/configuration` does not use `role.api`; only the `/token` row on `/settings` (§3 item 5) is affected.
15. **No route-level authorization**: the page is a client component with no user/role check (`configuration/page.tsx` imports no user context), and the app-layout guard only checks *authentication* (`app/(application)/layout.tsx:32-33`). Any signed-in user who types the URL renders the full editor; write protection depends on the GraphQL backend alone.

**`/configuration` page — `app/(application)/configuration/page.tsx`**

16. Header row: "Platform theme" (`text-2xl font-bold tracking-tight`) + description **"Import custom styles to personalize your IMP."** — leftover product name "IMP", hardcoded English — with two right-aligned actions (configuration/page.tsx:181-196; the `space-y-2` on the flex row at :182 is a no-op).
17. **"Reset Theme"** outline button (RotateCcw icon): clears `lightTheme`/`darkTheme` **local state only** to `{}` and toasts "Both themes have been reset to default (empty)." — the persisted config is untouched until Save, no confirmation dialog (configuration/page.tsx:123-131,190-193).
18. **"Save Configuration"** primary button: upserts the `platform_configurations` row `config_key: "theme_config"` with `config_value: { light, dark }` and description "Platform theme configuration" — `UPDATE_PLATFORM_CONFIGURATION` when `configId` is known, `CREATE_PLATFORM_CONFIGURATION` otherwise (capturing the new id), then `refetch()`; success/destructive toasts (configuration/page.tsx:133-178,194; mutations queries:2477-2495).
19. Initial load: `GET_PLATFORM_CONFIGURATIONS` fetches **every** `platform_configurations` row unfiltered (queries:2443-2459), then client-side `find(config_key === "theme_config")` seeds `configId` + both theme objects (configuration/page.tsx:31,37-52). The purpose-built `GET_PLATFORM_CONFIGURATION_BY_KEY` (queries:2460-2475) is unused here. The `loading` flag is captured but never rendered (configuration/page.tsx:31).
20. **"Import Theme CSS"** card: `font-mono text-xs min-h-[200px]` textarea for pasting a full CSS theme (`:root` + `.dark` blocks); "Import Theme" button disabled while empty or importing, with an inline spinner during an **artificial 500 ms `setTimeout`** (configuration/page.tsx:198-229,97-121).
21. CSS parser: regex extraction of the first `:root {…}` and `.dark {…}` blocks, splitting `--var: value` declarations into light/dark records (configuration/page.tsx:62-95). Known limits: first block only, breaks on nested braces, no value validation.
22. Import side-effects: parsed variables are **merged** into existing state (not replaced); each collapsible auto-expands only when its *own* parsed block contains >0 variables — `setLightOpen(true)`/`setDarkOpen(true)` each sit inside an `Object.keys(...).length > 0` guard, so a light-only paste leaves the dark section closed (configuration/page.tsx:101-110); the textarea clears, and a toast reports the total variable count imported (configuration/page.tsx:112-119).
23. **"Light Theme Variables"** collapsible Card: clickable CardHeader trigger (`hover:bg-accent/50`), `CheckCircle2` in primary color when at least one variable is set, ChevronDown rotating 180° on open; content is an `md:grid-cols-2` grid of rows — `text-xs font-mono` Label (variable name) + `font-mono text-xs` Input (value) with proper `htmlFor`/`id` pairing (configuration/page.tsx:232-270). Only variables **already in state** render — a fresh install shows an empty section, and there is no way to add or even see a single variable without pasting CSS (the app's defaults span ~50 unique CSS custom properties — 51 distinct tokens declared across the `:root` and `.dark` blocks, most with a light *and* a dark value — in `app/globals.css`).
24. **"Dark Theme Variables"** collapsible — structurally identical (configuration/page.tsx:272-310).
25. Per-variable inline editing: `handleLightThemeChange`/`handleDarkThemeChange` update local state per keystroke (configuration/page.tsx:54-60). No swatch/preview, no per-variable reset, no validation.
26. **Publication pipeline** (the part that makes this page matter): saved values are served by the backend `/theme` endpoint, fetched server-side on every app-layout render (`util/api.ts:76-98`, returning `{light:{},dark:{}}` on any failure) and injected as a `<style>` tag overriding `:root` and `.dark` custom properties for the **entire app, all users** (`app/(application)/layout.tsx:76,85-100`). Consequence: there is **no preview** — an admin sees their change only after Save **and** a full page reload.
27. Coexistence & vestiges that must survive untouched: the `platform_configurations` collection also stores image-generation styles under `config_key: image_generation_style:<slug>` (`components/image-generation/edit-style-dialog.tsx:118`, picker at `components/image-generation/image-generation-widget.tsx:175`) — this page must never clobber those rows (today it only writes `theme_config`, but the unfiltered fetch in #19 retrieves them all); `DELETE_PLATFORM_CONFIGURATION` exists unused (queries:2497-2503); dead `characterStyle` state (configuration/page.tsx:27).

### UX review

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| U1 | **High** | `/configuration` has no route-level guard — super_admin gating is nav-cosmetic only; any authenticated user can open the editor and attempt writes | configuration/page.tsx (no user check); main-nav:211; layout.tsx:32-33 |
| U2 | **High** | Theme editing is blind: no preview, no swatches; effects visible only after Save + full reload because the theme is a server-injected `<style>` tag. For a rare, high-stakes P3 task this is the opposite of "nothing here can surprise me" | layout.tsx:85-100; util/api.ts:76-98 |
| U3 | **High** | Fresh install shows two **empty** collapsible sections with no variable list, no "add variable", and no reference to the ~50 default tokens in `globals.css` — the only entry path is pasting a complete CSS theme | configuration/page.tsx:254,294; app/globals.css |
| U4 | **High** | i18n violation: every string on both pages is hardcoded English despite full en/de support elsewhere (nav labels are translated, page content is not) | settings/page.tsx:64-91; configuration/page.tsx:184-303 |
| U5 | **High** | P1's preference set (theme, language, prompt — personas.md P1 job 6) is fragmented: theme + language live only in a transient dropdown, the prompt only on `/settings`. The page named "Settings" contains one setting | main-nav:549-566; settings/page.tsx:70-94 |
| U6 | Med | Theme toggle is binary light/dark — the `system` default can never be restored once touched | main-nav:437-443; layout.tsx:113 |
| U7 | Med | "Reset Theme" misleads: clears local state, toasts "reset to default", but persists nothing until Save; also no confirmation for an action that wipes all overrides | configuration/page.tsx:123-131 |
| U8 | Med | "personalize your IMP" — leftover brand name in user-facing copy | configuration/page.tsx:186 |
| U9 | Med | Saved prompt never written back to `UserContext`; revisiting `/settings` after navigation shows the stale pre-save value | settings/page.tsx:24-30; authenticated.tsx:35 |
| U10 | Med | Collapsible trigger is a `CardHeader` **div** via `asChild` — clickable but not keyboard-focusable; keyboard users cannot expand the variable sections | configuration/page.tsx:234-251,274-291 |
| U11 | Med | Loads every platform_configurations row (incl. all image styles) to find one key; `GET_PLATFORM_CONFIGURATION_BY_KEY` exists unused; `loading` never rendered (blank flash) | configuration/page.tsx:31,37-52; queries:2460-2475 |
| U12 | Med | Type-scale inconsistency: `/settings` title is `text-3xl`, `/configuration` is `text-2xl`; PageHeader standard is `text-2xl` (philosophy §5) | settings/page.tsx:64; configuration/page.tsx:184 |
| U13 | Low | Save on `/settings` always enabled — no dirty tracking, no unsaved-changes signal | settings/page.tsx:89-91 |
| U14 | Low | Artificial 500 ms import delay; dead `characterStyle` state; stale-closure merge in the `[data]` effect; no-op `space-y-2` on a flex row | configuration/page.tsx:101,27,37-52,182 |
| U15 | Low | Raw GraphQL `error.message` surfaced to P1 in a toast; no plain-language failure copy | settings/page.tsx:40-47 |
| U16 | Low | No validation of CSS values on import or edit — a typo'd HSL silently ships to the whole org on save | configuration/page.tsx:54-95 |

### Mobile audit

**`/settings` — OK at 390 px.** `container mx-auto p-6` + `max-w-2xl` collapses to a clean
single column; the textarea and full-width-ish button behave. Only debt: `p-6` could relax to
`p-4` below `sm`, and the *entry point* (a dropdown at the very bottom of a collapsible
sidebar) is awkward on mobile where the sidebar becomes a sheet.

**`/configuration` — minor breakage at 390 px:**
- Root `p-8` fixed with no `sm:` variant burns 64 px of width (configuration/page.tsx:181).
- Header row `flex items-center justify-between` with **no wrap and no responsive stacking**
  holds the title plus two text buttons ("Reset Theme", "Save Configuration") — at 390 px the
  title compresses to a sliver and button labels wrap mid-word (configuration/page.tsx:182-196).
- The variable grid degrades fine (`md:grid-cols-2` → 1 column, :253,:293) and textareas are
  fluid; long mono HSL values fit the full-width inputs.
- Collapsible headers are comfortable touch targets, but the focusability problem (U10)
  applies to external-keyboard users everywhere.

Severity for the area: **minor** — nothing horizontally scrolls or becomes unusable, but the
configuration header is cramped and ugly on a phone.

---

## 2. Jobs to be done

### `/settings` — primary owner: **P1 End User**

**P1's #1 job in one sentence: set how Exulu looks, speaks, and responds to *me* — once, in
under a minute, without learning anything.**

Ranked by frequency (all are low-frequency; this is a set-and-forget page):
1. **P1:** Pick theme and language (first session, then rarely) — *currently not on this page at all* (inventory #2, #3).
2. **P1:** Write/refine the personal system prompt so every chat knows their role and style (occasionally revisited as they learn what works).
3. **P1:** Confirm "who am I here" — email, name, role — when something behaves unexpectedly (rare; currently impossible, the page shows no identity).
4. **P2/P3/P4 (secondary):** same personal jobs — they are also users. P4 additionally wants the shortest path from "settings" to their personal API token (`/token`).

### `/configuration` — primary owner: **P3 Admin**

**P3's #1 job in one sentence: brand the platform to the organization and verify it looks
right in both themes *before* every user sees it.**

Ranked:
1. **P3:** Apply an org theme (usually: paste CSS generated by a designer or a tool like a shadcn theme generator) and publish it with confidence (rare — setup time and rebrands).
2. **P3:** Tweak individual tokens afterwards ("our primary is too loud in dark mode") without re-pasting everything (occasional).
3. **P3:** Revert to the stock theme safely (rare, reactive).
4. **P4 (secondary):** export/inspect the active tokens to keep an embedded product visually consistent; paste-from-pipeline CSS import (rare).

### Ownership matrix check

The provisional matrix (personas.md:155,170) is **correct**: `/settings` → P1 primary with
all personas secondary; `/configuration` → P3 primary. One sharpening, not a correction: the
matrix lists `/configuration` with no secondary, but P4 has a light read-only interest
(token export/inspection) that the design serves at L3/L4 without diluting P3's L1. The
persona separation between the two pages is right and must stay hard: RBAC-trimmed, not
merely visually separated.

---

## 3. Design concept

### Default view (L1)

**`/settings` — "Settings"** (centered content page)

A calm, single-column page, `max-w-2xl`, every personal preference in one place — the page
finally earns its name. Top to bottom:

1. **PageHeader** — "Settings" (`text-2xl font-semibold`), purpose line "How Exulu looks,
   speaks, and responds to you." No header action — each section owns its own state.
2. **Appearance** section — label + one control: a three-option segmented control
   **Light / Dark / System** (fixes U6; applies instantly via next-themes, no save).
3. **Language** section — Select with **English / Deutsch**, helper text "Changing language
   reloads the page." Applies on selection (cookie + reload, behavior #3 preserved).
4. **Personal system prompt** section — the existing description (#8), the textarea (#9,
   auto-growing, 6-row minimum), a subtle character count, and a **Save** button that is
   the page's only primary (purple) element — enabled only when dirty (fixes U13).
5. **Account** section (read-only, quiet) — name, email, role name as an outline badge, and
   a plain link row "Personal API token →" to `/token` (#4 made discoverable). **RBAC,
   stated precisely because the current state is easy to misread:** `/token` is **ungated
   today** — the page checks only `useSession` authentication status (no role/user check)
   and the dropdown item renders for every authenticated user (inventory #4). There is no
   existing gate to mirror. The *intended* predicate, shared with `design/pages/keys-token.md`
   (#23): show the row when `user.super_admin || role.api ∈ {read, write}`. That predicate
   is **not currently evaluable**: `role.api` is never populated by `serverSideAuthCheck`
   (`lib/server-side-auth-check.ts:42-52` builds the role object with only
   id/name/agents/workflows/variables/users/evals/budget_management), so shipping it as-is
   would collapse the row to super_admin-only — hiding `/token` from exactly the users this
   page is meant to make it discoverable for (ladder #4). Therefore: the row **renders for
   all authenticated users (today's behavior, preserved)** until the `role.api` auth-check
   fix from keys-token.md lands (see Dependencies, §4); only then does the predicate switch on.

Sections are separated by whitespace + `Separator`, **not** nested cards (philosophy §4:
dividers over boxes). One purple element on screen: the prompt's Save when dirty.

**`/configuration` — "Platform theme"** (full-bleed work surface, super_admin only)

A two-pane editor that makes publishing a *seen* decision:

- **PageHeader** — "Platform theme", purpose "White-label Exulu for your organization —
  changes apply to every user." Right side: overflow menu (⋯: Import CSS…, Export CSS,
  Reset to defaults…) + primary **"Publish theme"** button (replaces "Save Configuration"),
  disabled when clean, showing a dot + "unsaved changes" hint when dirty.
- **Left pane — token editor.** A **Light / Dark** Tabs switch (replaces the two
  collapsibles, fixes U10), a search input ("Filter variables…") and a "Modified only"
  toggle beneath it. Below: the **full default variable manifest** (~50 tokens — 51 unique
  custom properties × light/dark values — sourced from `globals.css`, fixes U3) grouped
  under quiet `text-sm font-medium text-muted-foreground`
  headings — *Surfaces, Text, Brand, Semantic, Charts, Sidebar, Shape*. Each row: color
  swatch (rendered from the value when parseable), `font-mono text-xs` name, value Input,
  a "modified" dot when overriding the default, and a per-variable reset icon-button
  (tooltip "Reset to default") visible on hover/focus.
- **Right pane — live preview.** A sticky panel rendering a sample composition (button
  variants, a card with badge set, an input, a mini chat bubble, the chart color ramp)
  inside a scoped container whose CSS variables are the **draft** values — every keystroke
  previews instantly, before anything is published (fixes U2). A small Light/Dark toggle on
  the panel previews the *other* mode without switching the admin's own app theme.
- **Publish flow:** ConfirmDialog summarizing "N light / M dark overrides — applies to all
  users." On confirm: upsert via key (#18, now using `GET_PLATFORM_CONFIGURATION_BY_KEY` for
  load), then apply the published values to the live document at runtime (update the
  injected style values client-side) so the admin sees the result without a manual reload;
  the server-injected tag (#26) continues to serve everyone else on next load.

### Disclosure ladder

Every inventory item, relocated — nothing dropped.

| # | Capability | Level | Where it lives in the new design |
|---|-----------|-------|----------------------------------|
| 1 | `/settings` entry point | L0 | Stays in the user menu; additionally surfaces in the nav's bottom "Personal" group per `design/navigation.md` (personas.md:191) |
| 2 | Theme switching | **L1** on `/settings` (Light/Dark/System segmented control) | Quick toggle stays in the user menu (L0 convenience); both write the same next-themes state, "System" restored |
| 3 | Language switching | **L1** on `/settings` (Select) | Quick toggle stays in the user menu (L0); cookie + reload behavior preserved |
| 4 | Link to `/token` | L2 | "Personal API token →" row in the Account section + retained user-menu item. Visible to **all authenticated users** (matching today's ungated `/token`) until the keys-token.md `role.api` auth-check fix lands; then gated `super_admin \|\| role.api ∈ {read, write}` (never super_admin-only — see §3 item 5) |
| 5 | Logout | L0 | Unchanged in the user menu (incl. error fallback) |
| 6 | `force-dynamic` client page | — | Implementation detail, preserved |
| 7 | Settings page header | L1 | PageHeader (`text-2xl`, i18n'd) |
| 8 | Prompt explanation copy | L1 | Section description under "Personal system prompt" (i18n'd) |
| 9 | Prompt textarea | L1 | Same section; auto-grow, min 6 rows, `resize-y` kept |
| 10 | State seeding from UserContext | L1 (behavior) | Preserved + mutation result written back to context (fixes U9) |
| 11 | Save via `UPDATE_USER_BY_ID` | L1 | Section-local Save, dirty-gated, "Saving…" state kept |
| 12 | Save success/error toasts | L1 (feedback) | Kept; error copy becomes plain-language with detail preserved in the toast description (U15) |
| 13 | Prompt appended to every chat | — | Backend contract untouched; explained by #8's copy |
| 14 | Admin nav item "Theme/Design" | L0 | Stays in Administration group, Palette icon, super_admin gate |
| 15 | Route authorization | L0 (gate) | **Fixed**: server-side super_admin check on the route; non-admins redirected (RBAC-trimmed, philosophy §3) |
| 16 | Configuration page header | L1 | PageHeader, corrected copy (no "IMP"), i18n'd |
| 17 | Reset theme (all overrides) | **L3** | Overflow menu → "Reset to defaults…" → ConfirmDialog stating it clears all overrides *and is published on confirm* (fixes U7); per-variable reset is the new L2 fine-grained path |
| 18 | Save/upsert `theme_config` | L1 | "Publish theme" primary + ConfirmDialog summary; create-or-update logic preserved |
| 19 | Load existing config | L1 (behavior) | Via `GET_PLATFORM_CONFIGURATION_BY_KEY` (queries:2460); skeleton rows while loading (uses the previously ignored `loading`) |
| 20 | Import-CSS textarea + button | **L3** | "Import CSS…" Dialog from the overflow menu; mono textarea, disabled-when-empty, spinner only for actual parse time (drops the fake 500 ms) |
| 21 | `:root`/`.dark` regex parser | L3 | Preserved inside the import dialog; adds a non-blocking warning list for unparseable lines (U16) |
| 22 | Import merge + auto-reveal + count toast | L3 → L1 | Merge semantics preserved; after import the dialog closes, the editor filters to "Modified only" so imported values are immediately visible; count toast kept |
| 23 | Light variable editing | **L1** | "Light" tab of the grouped token editor; per-variable rows with label/input pairing kept; `CheckCircle2` indicator becomes a per-tab modified-count badge |
| 24 | Dark variable editing | L1 | "Dark" tab, identical |
| 25 | Per-keystroke value editing | L1 | Preserved; now drives the live preview; swatch + validation hint per row |
| 26 | Publication pipeline (`/theme` + server `<style>`) | — / **L4** | Server injection untouched; runtime apply added on publish; an **L4 "Raw" toggle** shows the stored `config_value` as JSON and as generated CSS with one-click copy (= P4's export, also "Export CSS" at L3) |
| 27 | Coexistence with image styles / unused queries / dead state | — | Page reads/writes only the `theme_config` row by key (never the full collection); `characterStyle` deleted; `DELETE_PLATFORM_CONFIGURATION` remains available to the backend/API (unused by this page, by design — deleting the row equals "reset", which #17 covers) |

### Layout & components

**`/settings`** (`app/(application)/settings/page.tsx` rewrite):
- **PageShell** (centered variant: `max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8`) +
  **PageHeader** from philosophy §5.
- **SettingsSection** (NEW shared primitive — see §4): `<h2 class="text-lg font-medium">` +
  `text-sm text-muted-foreground` description + content slot; sections separated by
  `Separator` and `space-y-8` (Large spacing per CLAUDE.md).
- Appearance: shadcn `Tabs` styled as a segmented control (or `ToggleGroup type="single"`),
  three items with Sun/Moon/Monitor lucide icons (`strokeWidth={1.5}`, matching nav).
- Language: shadcn `Select`, two items; helper `text-xs text-muted-foreground`.
- Prompt: `Textarea` + `Button` (default variant, right-aligned) + char count `text-xs`.
- Account: plain definition rows (`text-sm`, `grid grid-cols-[120px_1fr]`), `Badge`
  variant=outline for the role, `link`-variant Button for the token row. No Card nesting —
  the whole page uses zero Cards (philosophy §4).

**`/configuration`** (rewrite + extracted components):
- **PageShell** (full-bleed work-surface variant: `p-4 md:p-8 space-y-6`) + **PageHeader**
  with primary action + `DropdownMenu` overflow.
- Editor pane: `Tabs` (Light/Dark, modified-count `Badge` per trigger), `Input` for search,
  `Switch` + label for "Modified only", `ScrollArea` for the grouped token list. Token row:
  `div` grid `grid-cols-[16px_minmax(0,1fr)_minmax(0,1fr)_28px] gap-2 items-center` —
  swatch, mono name (`text-xs font-mono truncate` + `Tooltip` for full name), value `Input`
  (`font-mono text-xs h-8`), ghost icon `Button` reset (with `aria-label` + Tooltip).
- Preview pane: one `Card` (the only Card on the page) with the component sampler; sticky
  via `lg:sticky lg:top-6`; draft variables applied as inline `style` custom properties on
  the card's wrapper so the preview is scoped and instant.
- Dialogs: shared **ConfirmDialog** (publish summary, reset-to-defaults), shadcn `Dialog`
  for Import CSS, `Sheet`/`Collapsible` is *not* used — one overlay at a time (anti-pattern 3).
- Two-pane grid: `grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]`.
- All strings via next-intl keys in `messages/en.json` / `messages/de.json` (fixes U4).

### Mobile behavior

Persona mobile jobs (personas.md): P1 — full first-class experience; P3 — read-mostly,
one-handed, never broken.

**`/settings` (must be excellent — P1):**
- ≤ `sm`: padding drops to `px-4 py-6`; segmented control and Select go full-width;
  Account grid stacks to single column (`grid-cols-1`); Save becomes full-width below the
  textarea. Everything thumb-reachable, no behavior differences.
- The user-menu quick toggles (#2, #3) remain in the mobile sidebar sheet unchanged.

**`/configuration` (desk task; degrade gracefully, never break — P3):**
- < `lg`: the preview pane leaves the grid and becomes a **bottom `Sheet`** opened by a
  persistent "Preview" outline button next to "Publish theme" — editing and previewing
  alternate instead of sharing 390 px.
- < `md`: `p-8` → `p-4`; PageHeader actions collapse — overflow menu keeps its items,
  "Publish theme" stays visible (the one critical mobile action: publish/inspect from a
  phone after an alert); header stacks `flex-col gap-3` instead of squeezing (fixes the
  390 px cram).
- Token rows keep the same grid (they fit: swatch + name truncates + input + reset);
  search and "Modified only" stack vertically. Read and small edits fully usable;
  full theming remains a desktop-optimized authoring task per philosophy §7.

### Motion

Budget per CLAUDE.md / philosophy §6, all `ease-in-out`, all behind
`prefers-reduced-motion`:

- **Preview repaint** — `transition-colors duration-150` on preview-sampler elements, so a
  token edit visibly *flows* into the preview (explains causality).
- **Tab switch** (Light/Dark) — 200 ms content cross-fade; the preview swatches transition
  rather than snap.
- **Dirty-state appearance** — the "unsaved changes" dot + enabled Publish button fade/scale
  in at 150 ms (explains that an edit was registered).
- **Theme segmented control** on `/settings` — thumb slides 200 ms between options.
- Dialogs/Sheets use stock shadcn enter/exit (~200 ms). Nothing else moves.

---

## 4. Implementation notes

**Files to change/create**

| File | Action |
|------|--------|
| `app/(application)/settings/page.tsx` | Rewrite per §3 (sections, theme/language controls, account block, dirty-gated save, i18n, context write-back) |
| `app/(application)/configuration/page.tsx` | Rewrite into a thin server component performing the super_admin check (redirect otherwise — fixes U1) + client editor |
| `app/(application)/configuration/components/theme-editor.tsx` | NEW — tabs, search, grouped token rows, modified-only filter |
| `app/(application)/configuration/components/theme-preview.tsx` | NEW — scoped sampler, light/dark sub-toggle, sheet wrapper < `lg` |
| `app/(application)/configuration/components/import-css-dialog.tsx` | NEW — moves #20-22, parser preserved from configuration/page.tsx:62-95 |
| `lib/theme-defaults.ts` | NEW — the default token manifest (name, group, default light/dark value) generated from `app/globals.css`; build-time script or checked-in constant with a CI check against globals.css drift |
| `components/custom/main-nav.tsx` | Theme menu item gains "System" (or cycles light→dark→system); coordinate with `design/navigation.md` shell work; user-menu items otherwise unchanged |
| `messages/en.json`, `messages/de.json` | New `settings.*` and `configuration.*` key groups (fixes U4) |
| `queries/queries.ts` | No schema change; switch page load to `GET_PLATFORM_CONFIGURATION_BY_KEY` (already defined, queries:2460-2475) |

**Shared components needed**
- From philosophy §5: **PageShell**, **PageHeader**, **ConfirmDialog**.
- **NEW shared primitives to propose for philosophy §5** (both used beyond these pages —
  agents/models/budgets forms have the same shapes):
  - **SettingsSection** — titled, described form section with divider rhythm (used by
    `/settings`, and a natural fit for `/budgets` settings and agent config forms).
  - **UnsavedChangesBar / dirty-state pattern** — a single convention for "you have
    unpublished edits" (used here by `/configuration`; evals and agent editors share the
    need).
- Page-local (not shared): theme-editor, theme-preview, import-css-dialog.

**RBAC summary**
- `/settings`: all authenticated users. The `/token` link row: **current state — `/token` is
  ungated** (page checks only `useSession` status, `app/(application)/token/page.tsx:14`; the
  dropdown item at main-nav:574-579 renders for every authenticated user; note that
  main-nav:204-210 gates `/explorer`/apiPlayground, *not* `/token`). **Intended predicate:**
  `user.super_admin || role.api ∈ {read, write}`, aligned with keys-token.md #23. **Blocked
  on:** the `role.api` auth-check fix (`lib/server-side-auth-check.ts:42-52` never populates
  `api`, so `role.api === "write"` is always falsy — keys-token.md U3). Until that fix lands,
  the row renders for all authenticated users; applying the predicate early would silently
  reduce it to super_admin-only.
- `/configuration`: `user.super_admin` only — now enforced at the route (server redirect),
  not just the nav. No granular role right exists today; if one is added later
  (`platform_configuration: read|write`), the gate widens in exactly two places (nav +
  route guard).

**Scope: M.** `/settings` alone is S (one page, existing primitives). `/configuration` adds
the token manifest, preview pane, runtime-apply-on-publish, and the route guard — each
small, together a solid M. No backend changes required (all queries/mutations and the
`/theme` endpoint already exist).

**Dependencies**
- **`role.api` auth-check fix** (`design/pages/keys-token.md` §4, "must land first"
  dependency at its Dependencies section; change: add `'api', roles.api` to the
  `json_build_object` in `lib/server-side-auth-check.ts:42-52`, shared with `/explorer` and
  `/keys`): required before the Account section's `/token` row may adopt the
  `super_admin || role.api ∈ {read, write}` predicate. **Not a blocker for shipping
  `/settings` itself** — until the fix lands the row simply stays visible to all
  authenticated users, which is today's `/token` behavior.
- Shell/nav redesign (`design/navigation.md`): placement of the "Personal" group and the
  user menu; this page's design only *adds* L1 surfaces for theme/language and must not
  race the dropdown's relocation.
- PageShell/PageHeader/ConfirmDialog primitives must exist (shared with every other page
  doc).
- `lib/theme-defaults.ts` is also useful to `/models`/agents theming previews if any —
  keep it dependency-free.

**Risks**
1. **Specificity/ordering of runtime apply vs. the server-injected `<style>` tag**
   (layout.tsx:85-100): applying published values client-side must target the same custom
   properties; safest is updating the injected tag's text content by id rather than adding
   a second tag. Verify in both themes.
2. **Preview fidelity**: scoped inline custom properties cover color tokens but not
   `--radius`-driven Tailwind classes compiled at build; preview must set the full variable
   set on its wrapper and use components that read variables at runtime (shadcn does).
   Test both themes inside the preview while the app is in the opposite theme.
3. **globals.css drift**: the default manifest can silently diverge from `app/globals.css`;
   add a CI assertion (parse globals.css, diff against manifest).
4. **Shared collection**: never write `platform_configurations` rows other than
   `theme_config` (image styles live there, inventory #27).
5. **Language reload** (#3) interrupts unsaved prompt edits on `/settings`: guard with the
   dirty-state pattern (confirm before reload when the prompt section is dirty).
6. **CSS parser edge cases** (inventory #21): keep merge semantics, surface skipped lines;
   do not attempt full CSS parsing — the regex approach is a documented, deliberate limit.
