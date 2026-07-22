# Fold /runs into the Routines Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone `/runs` page and its main-nav item; render the global runs console on `/workflows` underneath the routines table, move the needs-attention nav badge to the Routines item, redirect `/runs`, and retarget the chat run banner.

**Architecture:** The runs UI already lives in a shared widget (`components/widgets/routine-runs/runs-list.tsx`) consumed by both the old `/runs` page and the per-routine section on `/workflows/[id]`. This change only moves the *unscoped* mount point from a dedicated route into the routines list page, deletes the route body, and rewires three references (nav entry, nav badge key, chat banner link). No widget or query changes.

**Spec:** `docs/superpowers/specs/2026-07-22-runs-into-routines-page-design.md`

**Tech Stack:** Next.js 16 App Router, next-intl, vitest, Apollo (untouched).

## Global Constraints

- All user-facing copy goes through next-intl; `messages/en.json` and `messages/de.json` must stay key-parallel (`npm run check-messages` exits 0).
- Known BASELINE failures that must NOT be treated as regressions (memory: frontend-baseline-failures, re-verified 2026-07-20 and re-confirmed 2026-07-22 for the vitest one):
  - `components/shell/nav-config.test.ts` → `agents:read → Build's read surfaces…` fails (receives an extra `"models"` entry). Unrelated to runs.
  - `npm run lint` → pre-existing entity-types lint error.
  - Only NEW failures block a task.
- Commit after every task. Never `git add -A` — the tree contains unrelated changes (`lib/skills/install-sh.generated.ts`, `.superpowers-flag-removal-report.md`); stage only the files named in the task.
- Comments follow codebase idiom: state design constraints (`design §7.3`-style refs), never change-history narration.

---

### Task 1: Remove the /runs nav entry; badge moves to Routines

**Files:**
- Modify: `components/shell/nav-config.test.ts` (lines 20, 72, 139, 144, 285, 347, 394–396)
- Modify: `components/shell/nav-config.ts` (lines 14, 197–205)
- Modify: `components/shell/app-sidebar.tsx` (lines 85–90)
- Modify: `components/shell/use-runs-attention.ts` (comment, line 8)
- Test: `components/shell/nav-config.test.ts`

**Interfaces:**
- Consumes: `useRunsAttentionCount(user)` (unchanged signature, `components/shell/use-runs-attention.ts`).
- Produces: the sidebar `badges` map now keys the attention count as `routines` (matched by `NavGroup` against `entry.id` — `components/shell/nav-group.tsx:169`). NAV_ENTRIES no longer contains an entry with `id: "runs"`.

- [ ] **Step 1: Update the nav test to expect no runs entry**

In `components/shell/nav-config.test.ts`:

1. Delete line 20:

```ts
const RUNS_ROWS = ["runs"];
```

2. Delete the four `...RUNS_ROWS,` spread lines (currently 72, 144, 285, 347 — each sits directly under a `"routines",` line).

3. Rename the test at line 139:

```ts
  it("workflows:read → routines + automation (n8n flag on)", () => {
```

(was `"workflows:read → routines + runs (flagged) + automation (n8n flag on)"`).

4. Replace the `/runs` active-match test (lines 394–396):

```ts
  it("matches no entry for /runs (folded into /workflows; route is a redirect)", () => {
    expect(activeEntryFor("/runs")).toBeNull();
  });
```

(was `expect(activeEntryFor("/runs")?.id ?? null).toBe("runs");`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/shell/nav-config.test.ts`
Expected: FAIL — the table test and the three matrix tests receive an unexpected `"runs"` id, and the `/runs` match test receives the runs entry instead of null. The pre-existing `agents:read` failure also appears (baseline — ignore).

- [ ] **Step 3: Remove the nav entry**

In `components/shell/nav-config.ts` delete the entry and its comment (lines 197–205):

```ts
  // Global runs console (email-routines design §7.3).
  {
    id: "runs",
    group: "build",
    route: "/runs",
    i18nKey: "navigation.runs",
    icon: Activity,
    requires: { area: "workflows", level: "read" },
  },
```

Then remove `Activity,` from the lucide-react import at the top (line 14) — it has no other usage in the file (verify with a file-local search before deleting).

- [ ] **Step 4: Re-key the sidebar badge to the Routines entry**

In `components/shell/app-sidebar.tsx` replace lines 85–90:

```ts
  // Needs-attention badge on the flag-gated /runs entry (design §7.3).
  const runsAttentionCount = useRunsAttentionCount(user);
  const badges = React.useMemo<Partial<Record<string, number>>>(
    () => ({ runs: runsAttentionCount }),
    [runsAttentionCount],
  );
```

with:

```ts
  // Needs-attention badge on the Routines entry (design §7.3 — the runs
  // console lives on /workflows underneath the routines table).
  const runsAttentionCount = useRunsAttentionCount(user);
  const badges = React.useMemo<Partial<Record<string, number>>>(
    () => ({ routines: runsAttentionCount }),
    [runsAttentionCount],
  );
```

In `components/shell/use-runs-attention.ts` update the header comment (lines 7–8): replace

```
 * every ~10 s, backing off to 60 s while the query errors (recovers on the
 * next success). Zero network unless the account can read workflows —
 * mirrors the /runs nav entry's gate exactly.
```

with

```
 * every ~10 s, backing off to 60 s while the query errors (recovers on the
 * next success). Zero network unless the account can read workflows —
 * mirrors the Routines nav entry's gate exactly.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/shell/nav-config.test.ts`
Expected: 26 passed, 1 failed — the ONLY failure is the baseline `agents:read → Build's read surfaces…` one. Any other failure is a regression from this task.

- [ ] **Step 6: Commit**

```bash
git add components/shell/nav-config.ts components/shell/nav-config.test.ts components/shell/app-sidebar.tsx components/shell/use-runs-attention.ts
git commit -m "feat(nav): remove /runs entry, needs-attention badge moves to Routines"
```

---

### Task 2: Runs console section on /workflows

**Files:**
- Modify: `app/(application)/workflows/routines-client.tsx` (imports ~line 29, header comment lines 3–17, insert section after line 216)
- Modify: `messages/en.json` (add `routines.runsConsole.*` before `routines.runs` at line 3641)
- Modify: `messages/de.json` (same position, line 3641)

**Interfaces:**
- Consumes: `RoutineRunsList` from `@/components/widgets/routine-runs/runs-list` with props `{ showRoutineColumn?: boolean; defaultNeedsAttention?: boolean }` (no `workflow` prop = unscoped/global list).
- Produces: message keys `routines.runsConsole.title` and `routines.runsConsole.description` (Task 4 relies on the standalone page's old top-level `runs.*` keys being unused after Task 3).

- [ ] **Step 1: Add the i18n keys (both locales)**

In `messages/en.json`, directly before the `routines.runs` sub-object (anchor is unique — the top-level `runs` object has `description`, not `count`):

```json
    "runsConsole": {
      "title": "Runs",
      "description": "Every routine run across your workspace — items needing attention first."
    },
    "runs": {
      "title": "Runs",
      "count": "{count, plural, =0 {no runs} one {# run} other {# runs}}",
```

(the last two lines shown are the existing anchor — do not duplicate them).

In `messages/de.json`, same position:

```json
    "runsConsole": {
      "title": "Läufe",
      "description": "Alle Routine-Läufe in Ihrem Arbeitsbereich — Einträge mit Handlungsbedarf zuerst."
    },
    "runs": {
      "title": "Läufe",
      "count": "{count, plural, =0 {keine Läufe} one {# Lauf} other {# Läufe}}",
```

- [ ] **Step 2: Verify message parity**

Run: `npm run check-messages`
Expected: exit 0 (both locales gained the same two keys).

- [ ] **Step 3: Render the section under the table**

In `app/(application)/workflows/routines-client.tsx`:

1. Add the import (after the `Button` import, keeping the `@/components/*` group sorted):

```ts
import { RoutineRunsList } from "@/components/widgets/routine-runs/runs-list";
```

2. Insert the section between the table block's closing `</div>` (line 216) and the `{/* Run dialog … */}` comment. `PageShell variant="content"` provides `space-y-8`, so no extra margin:

```tsx
      {/* Global runs console (email-routines design §7.3): every readable
          routine's runs, routine column on, needs-attention lens on by
          default. Rendered in both table branches — runs can reference
          since-deleted routines. */}
      <section
        aria-labelledby="runs-console-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h2 id="runs-console-heading" className="text-lg font-medium">
            {t("runsConsole.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("runsConsole.description")}
          </p>
        </div>
        <RoutineRunsList showRoutineColumn defaultNeedsAttention />
      </section>
```

Note: the section is a sibling OUTSIDE the `showEmptyInitial ? … : …` ternary — it renders in the empty branch too.

3. In the file's header comment (lines 3–17), add one line after the "NO primary action" paragraph:

```
 * The global runs console (design §7.3) renders below the table: the shared
 * RoutineRunsList, unscoped, routine column + needs-attention lens on.
```

- [ ] **Step 4: Type-check and lint the touched files**

Run: `npx tsc --noEmit`
Expected: exit 0 (memory: tsc baseline is clean).

Run: `npx eslint "app/(application)/workflows/routines-client.tsx"`
Expected: exit 0 — in particular no feature-isolation violation (widgets tier is importable from features).

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/workflows/routines-client.tsx" messages/en.json messages/de.json
git commit -m "feat(routines): global runs console below the routines table"
```

---

### Task 3: /runs becomes a redirect stub

> **SUPERSEDED during execution (2026-07-22):** the user confirmed `/runs` was
> never deployed anywhere, so the whole `app/(application)/runs/` folder is
> deleted instead — no redirect stub, and the nav test asserting
> `activeEntryFor("/runs")` is dropped as moot. Steps below kept for the
> record.

**Files:**
- Modify: `app/(application)/runs/page.tsx` (full rewrite)
- Delete: `app/(application)/runs/runs-client.tsx`
- Delete: `app/(application)/runs/layout.tsx`
- Modify: `components/widgets/routine-runs/runs-list.tsx` (header comment lines 9–13 only)

**Interfaces:**
- Consumes: `redirect` from `next/navigation`; the anchored `<section id="runs">` on `/workflows/[id]` (`app/(application)/workflows/[id]/sections/runs.tsx:32`).
- Produces: `/runs?workflow=<id>` → `/workflows/<id>#runs`; `/runs` → `/workflows`. After this task the top-level `runs.*` message namespace has zero consumers (Task 4 deletes it).

- [ ] **Step 1: Rewrite the page as a server redirect**

Replace the entire content of `app/(application)/runs/page.tsx`:

```tsx
/**
 * /runs — redirect stub. The global runs console lives on /workflows
 * underneath the routines table; scoped links land on the routine subpage's
 * anchored runs section. The URL shipped publicly, so it must keep resolving.
 * No guard: both destinations guard themselves.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ workflow?: string }>;
}) {
  const { workflow } = await searchParams;
  redirect(
    workflow
      ? `/workflows/${encodeURIComponent(workflow)}#runs`
      : "/workflows",
  );
}
```

- [ ] **Step 2: Delete the page body and guard**

```bash
git rm "app/(application)/runs/runs-client.tsx" "app/(application)/runs/layout.tsx"
```

- [ ] **Step 3: Correct the widget's consumer list**

In `components/widgets/routine-runs/runs-list.tsx`, replace comment lines 9–13:

```
 * Lives in the widgets tier because BOTH the per-routine Runs section
 * (app/(application)/workflows) and the global /runs page
 * (app/(application)/runs) render it, and feature folders may not import
 * each other (eslint feature isolation) — widgets + lib are the shared
 * altitude.
```

with:

```
 * Lives in the widgets tier and is rendered twice inside the workflows
 * feature: the routines list page's runs console (app/(application)/
 * workflows, unscoped) and the per-routine Runs section
 * (app/(application)/workflows/[id], scoped via `workflow`).
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 — proves nothing still imports `RunsClient` or the deleted layout.

Run: `grep -rn "runs-client\|runs/layout" app components lib --include="*.ts*"`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/runs/page.tsx" components/widgets/routine-runs/runs-list.tsx
git commit -m "refactor(runs): /runs is a redirect stub into /workflows"
```

(the `git rm` from Step 2 is already staged).

---

### Task 4: Delete the dead message keys

**Files:**
- Modify: `messages/en.json` (line 3164 `navigation.runs`; lines 3973–3976 top-level `runs`)
- Modify: `messages/de.json` (same keys)

**Interfaces:**
- Consumes: Task 1 removed the only `navigation.runs` consumer (the nav entry's `i18nKey`); Task 3 removed the only top-level `runs.*` consumer (`runs-client.tsx`).
- Produces: nothing — pure cleanup.

- [ ] **Step 1: Verify the keys are actually dead**

Run: `grep -rn 'navigation.runs\|useTranslations("runs")' app components lib --include="*.ts*"`
Expected: no matches. If anything matches, STOP — a consumer was missed; report instead of deleting.

- [ ] **Step 2: Delete the keys (both locales)**

In `messages/en.json`:

1. In the `navigation` object delete the line:

```json
    "runs": "Runs",
```

(anchor: it sits between `"routines": "Routines",` and `"search": "Search…",`).

2. Delete the top-level object (2-space indent, sits before `"settings"`):

```json
  "runs": {
    "title": "Runs",
    "description": "Every routine run across your workspace — items needing attention first."
  },
```

In `messages/de.json`:

1. In `navigation` delete (between `"routines": "Routinen",` and `"search": "Suchen…",`):

```json
    "runs": "Läufe",
```

2. Delete the top-level object:

```json
  "runs": {
    "title": "Läufe",
    "description": "Alle Routine-Läufe in Ihrem Arbeitsbereich — Einträge mit Handlungsbedarf zuerst."
  },
```

- [ ] **Step 3: Verify parity**

Run: `npm run check-messages`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "chore(i18n): drop navigation.runs and the standalone runs page namespace"
```

---

### Task 5: Chat run banner links into /workflows

**Files:**
- Modify: `app/(application)/chat/components/run-session-banner.tsx` (line 112 + header comment lines 5–7)

**Interfaces:**
- Consumes: the anchored `<section id="runs" className="scroll-mt-20">` on `/workflows/[id]` (already exists — `app/(application)/workflows/[id]/sections/runs.tsx:32`).
- Produces: nothing downstream.

- [ ] **Step 1: Retarget the link**

Replace line 112:

```ts
  const runsHref = run.workflow ? `/runs?workflow=${run.workflow}` : "/runs";
```

with:

```ts
  const runsHref = run.workflow
    ? `/workflows/${encodeURIComponent(run.workflow)}#runs`
    : "/workflows";
```

In the header comment, replace

```
 * name, trigger, live run state, link back to the run (global /runs page,
 * pre-scoped to the routine). The approval card itself is the untouched
```

with

```
 * name, trigger, live run state, link back to the run (the routine
 * subpage's anchored runs section). The approval card itself is the untouched
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx eslint "app/(application)/chat/components/run-session-banner.tsx"`
Expected: exit 0 (chat still imports only `lib/routine-runs`, no feature-isolation change).

- [ ] **Step 3: Commit**

```bash
git add "app/(application)/chat/components/run-session-banner.tsx"
git commit -m "fix(chat): run banner links to the routine subpage runs section"
```

---

### Task 6: Full verification sweep

**Files:** none modified (verification only; fix-forward if a NEW failure appears).

- [ ] **Step 1: Stale-reference grep**

Run: `grep -rn "/runs" app components lib --include="*.ts*" | grep -vE "routine-runs|runs-list|app/\(application\)/runs/page.tsx"`
Expected: no matches — every remaining `/runs` occurrence is either the widget/lib path segment (`routine-runs`, `runs-list`) or the redirect stub itself. Any other hit is a stale link or comment; fix it before proceeding.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: the ONLY failing test is the baseline `nav-config.test.ts > agents:read → Build's read surfaces…`.

- [ ] **Step 3: Type-check + lint + messages**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run lint` → only the pre-existing entity-types error.
Run: `npm run check-messages` → exit 0.

- [ ] **Step 4: Manual smoke (dev server)**

Run: `npm run dev`, then verify in the browser:

1. `/workflows` shows the "Runs" section (heading + description + filter bar + list) under the routines table; needs-attention toggle starts ON; rows show the routine-name column.
2. Sidebar: no "Runs" item; the needs-attention count badge (if any runs need approval) appears on "Routines".
3. `/runs` → lands on `/workflows`; `/runs?workflow=<some-id>` → lands on `/workflows/<some-id>#runs` scrolled to the Runs section.
4. A routine-run chat session's banner "View run" → routine subpage runs section.

Note: run-data behaviors need the backend with the Plan-1 `routineRuns` API; if the local backend lacks data, verify rendering/empty states and record what was NOT verified in the summary.

- [ ] **Step 5: Report**

No commit. Summarize: what passed, what was skipped (with reason), any NEW failures fixed along the way.
