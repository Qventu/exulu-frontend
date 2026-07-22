# Fold /runs into the Routines page — design

**Date:** 2026-07-22
**Status:** Approved

## Problem

The global runs console shipped as its own page (`/runs`) with its own main-nav
item (commit `2cd39f4`). Product decision: runs should not be a standalone page
or nav destination. Instead, the runs list belongs on the Routines page
(`/workflows`), underneath the routines table.

## Decisions (user-approved 2026-07-22)

- **Presentation:** always-visible section below the routines table (not
  collapsible). The needs-attention lens stays on by default, keeping it short.
- **Nav badge:** the polled needs-attention count moves to the **Routines** nav
  item (not dropped).
- **Old URL:** `/runs` was never deployed anywhere (user-confirmed 2026-07-22;
  being on `origin/main` ≠ deployed), so the route is deleted outright — no
  redirect stub.

## Changes

### 1. Runs section on /workflows

In `app/(application)/workflows/routines-client.tsx`, below the routines table
block (after the toolbar + `RoutineList` / empty-state branch), render:

- `h2` heading "Runs" (`text-lg`) with the muted description "Every routine run
  across your workspace — items needing attention first."
- `<RoutineRunsList showRoutineColumn defaultNeedsAttention />` — the exact
  configuration the `/runs` page used (unscoped: no `workflow` prop).

The section renders in **all** branches, including when the routines table shows
its initial empty state — runs can exist for since-deleted routines, and the
layout stays stable.

i18n: the standalone page's top-level `runs.*` namespace dies with the page. Its
`title`/`description` move into the routines namespace as
`routines.runsConsole.title` / `routines.runsConsole.description`, in both
`messages/en.json` and `messages/de.json`.

### 2. Navigation

- Remove the `runs` entry from `components/shell/nav-config.ts`.
- `components/shell/app-sidebar.tsx`: keep `useRunsAttentionCount`; re-key the
  badge map from `{ runs: count }` to `{ routines: count }` so the count shows
  on the Routines nav item. Update the comment in
  `components/shell/use-runs-attention.ts` (it references the /runs entry).
- Delete `navigation.runs` from `messages/en.json` and `messages/de.json`.
- Update `components/shell/nav-config.test.ts` for the removed entry. Note: this
  test has a pre-existing baseline failure (memory: frontend-baseline-failures);
  judge only NEW failures as blocking.

### 3. Chat run banner

`app/(application)/chat/components/run-session-banner.tsx` currently links
"View run" to `/runs?workflow=<id>` (or `/runs`). New targets:

- with workflow id → `/workflows/<id>#runs` (the routine subpage's anchored,
  scoped runs section — `<section id="runs">` already exists with scroll
  offset),
- without → `/workflows`.

### 4. /runs route deleted

- Delete the entire `app/(application)/runs/` folder (`page.tsx`,
  `runs-client.tsx`, `layout.tsx`). No redirect: the URL never reached any
  deployment, so nothing external links to it.

## Not in scope

- The per-routine runs section on `/workflows/[id]` (unchanged; same shared
  widget).
- Any change to `components/widgets/routine-runs/runs-list.tsx` — its two
  consumers become the routines list page and the routine subpage; its header
  comment should be touched only to correct the consumer list.

## Verification

- `tsc`, lint, and the nav-config test — judged against the known baseline
  failures (FE: nav-config test + entity-types lint).
- Manual: /workflows shows the runs section under the table in both the
  populated and empty-routines branches; sidebar badge appears on Routines;
  chat banner "View run" lands on the subpage runs section.
