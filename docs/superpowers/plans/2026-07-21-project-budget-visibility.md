# Project Budget Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a project's budget usage (spend vs. cap, reset time) read-only on the project detail page for every user who can open the project.

**Architecture:** The backend's generic `budget` field hydration gains a project-only "member view" (reduced payload echoing the platform `user_budget_display` setting) for requesters without `budget_management` rights — row-level RBAC already decided they may see the row. The frontend adds `budget` to the project detail query, teaches the shared `BudgetBar` percent mode, extracts the percent-aware detail lines into a shared component, and renders a compact indicator + popover in the project detail PageHeader.

**Tech Stack:** Backend: Node/TypeScript, GraphQL (custom resolver pipeline), Knex/Postgres, LiteLLM tag budgets, jest. Frontend: Next.js 16 App Router, Apollo Client, shadcn/ui (Radix Popover/Tooltip), next-intl, vitest (node env — no DOM tests in this repo).

**Spec:** `docs/superpowers/specs/2026-07-20-project-budget-visibility-design.md`

## Global Constraints

- **Two repos.** Tasks 1 lives in `/Users/daniel.claessen/Desktop/Projects/exulu/backend`; Tasks 2–5 in `/Users/daniel.claessen/Desktop/Projects/exulu/frontend`. Task 6 needs both.
- **Known-failing baseline (verified 2026-07-20) — only NEW failures block:**
  - Frontend: `components/shell/nav-config.test.ts` (vitest) and an `entity-types` eslint failure are known-failing on main. `npx tsc --noEmit` is clean on main.
  - Backend: 14 pre-existing `tsc --noEmit` errors. Count errors before and after; the count must not grow.
- **Dirty working trees.** Both repos may contain unrelated uncommitted changes (frontend: chat new-chat fix, chat export formatting, `messages/*.json`, `lib/skills/install-sh.generated.ts`). Stage ONLY the files listed in each task's commit step, by explicit path. NEVER `git add -A`, `git add -u`, or `git add .`.
- **No new i18n keys.** Every string used here already exists in `messages/en.json` AND `messages/de.json` under `budgets.bar.*` (`usedOfMax`, `remainingDuration`, `projected`, `projectedOverPace`, `resetsOn`, `percentLeft`, `percentUsed`, `percentRemainingDuration`, `projectedPercent`, `projectedPercentOverPace`, `detailsAria`). Do not touch `messages/en.json` or `messages/de.json`.
- **`BudgetBar` amount-mode output must stay string-identical in English.** The only allowed deltas (all listed in Task 3): tooltip over-pace line color `text-amber-500` → `text-amber-600 dark:text-amber-400`, tooltip line elements `div` → `p` (visually identical under Tailwind preflight), `motion-reduce:transition-none` added to the fill (closes a filed follow-up from budgets redesign item 29).
- **Branches:** frontend work continues on the currently checked-out branch (verify with `git status`; it was `feat/public-agents` recently). Backend work lands on `develop` (recent practice). Confirm with `git -C /Users/daniel.claessen/Desktop/Projects/exulu/backend status` before committing; if the checked-out branch differs, ask the user rather than switching.

---

### Task 1: Backend — `budget-field.ts` module with project member view

The `addBudgetField` hydrator currently lives module-private inside `sanitize-and-hydrate-fields.ts`, whose import graph (EE agentic retrieval, app singleton, …) is too heavy to unit-test. Extract it into a focused module, add the member-view branch, and test it with jest.

**Files:**
- Create: `src/graphql/utilities/budget-field.ts`
- Create: `src/graphql/utilities/budget-field.test.ts`
- Modify: `src/graphql/utilities/sanitize-and-hydrate-fields.ts:15-79`

**Interfaces:**
- Consumes: `getTagBudgetMap()`, `getBudgetSettings()` from `@SRC/exulu/litellm/budget-service`; `budgetTagFor(entityType, id)`, `type BudgetEntityType` from `@SRC/exulu/tags`.
- Produces: `addBudgetField(requestedFields: string[], result: any, tableSingular: string, user: User | undefined): Promise<any>` and `BUDGET_ENTITY_SINGULARS: Set<string>` exported from `./budget-field` — consumed by `finalizeRequestedFields` (call sites at sanitize-and-hydrate-fields.ts:434-436 stay unchanged). The member-view JSON shape `{ spend, max_budget, budget_duration, budget_reset_at, display }` is what frontend Task 5 renders.

- [ ] **Step 1: Write the failing test**

Create `src/graphql/utilities/budget-field.test.ts`:

```ts
// budget-service is the only heavy dependency; mock it so importing the
// module under test never touches postgres or LiteLLM.
jest.mock("@SRC/exulu/litellm/budget-service", () => ({
  getTagBudgetMap: jest.fn(),
  getBudgetSettings: jest.fn(),
}));

import {
  getBudgetSettings,
  getTagBudgetMap,
} from "@SRC/exulu/litellm/budget-service";

import { addBudgetField } from "./budget-field";

const TAG_MAP = {
  project_id_p1: {
    name: "project_id_p1",
    spend: 12.5,
    max_budget: 50,
    budget_duration: "30d",
    budget_reset_at: "2026-08-01T00:00:00.000Z",
    budget_id: "b-123",
  },
  user_id_u1: {
    name: "user_id_u1",
    spend: 1,
    max_budget: 10,
    budget_duration: "30d",
    budget_reset_at: "2026-08-01T00:00:00.000Z",
    budget_id: "b-456",
  },
};

const SETTINGS = {
  global_user_budget: { enabled: false, max_budget: 0, budget_duration: "30d" },
  show_user_budget_in_chat: false,
  user_budget_display: "percent",
};

const admin = { super_admin: true } as any;
const member = { super_admin: false, role: {} } as any;
const reader = { super_admin: false, role: { budget_management: "read" } } as any;

beforeEach(() => {
  jest.clearAllMocks();
  (getTagBudgetMap as jest.Mock).mockResolvedValue(TAG_MAP);
  (getBudgetSettings as jest.Mock).mockResolvedValue(SETTINGS);
});

describe("addBudgetField — admin view (unchanged behavior)", () => {
  it("returns the full tag info (incl. budget_id, no display echo) for super admins", async () => {
    const result = await addBudgetField(["budget"], { id: "p1" }, "project", admin);
    expect(result.budget).toEqual(TAG_MAP.project_id_p1);
    expect(result.budget).not.toHaveProperty("display");
  });

  it("returns the full tag info for budget_management readers", async () => {
    const result = await addBudgetField(["budget"], { id: "p1" }, "project", reader);
    expect(result.budget).toEqual(TAG_MAP.project_id_p1);
  });

  it("does nothing when budget was not requested", async () => {
    const result = await addBudgetField(["id", "name"], { id: "p1" }, "project", member);
    expect(result).not.toHaveProperty("budget");
    expect(getTagBudgetMap).not.toHaveBeenCalled();
  });

  it("nulls the field when the row has no id", async () => {
    const result = await addBudgetField(["budget"], {} as any, "project", member);
    expect(result.budget).toBeNull();
  });
});

describe("addBudgetField — project member view", () => {
  it("returns the reduced member view (display echo, no budget_id) for a member", async () => {
    const result = await addBudgetField(["budget"], { id: "p1" }, "project", member);
    expect(result.budget).toEqual({
      spend: 12.5,
      max_budget: 50,
      budget_duration: "30d",
      budget_reset_at: "2026-08-01T00:00:00.000Z",
      display: "percent",
    });
    expect(result.budget).not.toHaveProperty("budget_id");
  });

  it("echoes 'amount' when the platform display setting is amount", async () => {
    (getBudgetSettings as jest.Mock).mockResolvedValue({
      ...SETTINGS,
      user_budget_display: "amount",
    });
    const result = await addBudgetField(["budget"], { id: "p1" }, "project", member);
    expect(result.budget.display).toBe("amount");
  });

  it("returns null for a member when the project has no budget tag", async () => {
    const result = await addBudgetField(["budget"], { id: "p2" }, "project", member);
    expect(result.budget).toBeNull();
  });

  it("still nulls the field for members on non-project entities", async () => {
    const result = await addBudgetField(["budget"], { id: "u1" }, "user", member);
    expect(result.budget).toBeNull();
    expect(getBudgetSettings).not.toHaveBeenCalled();
  });
});
```

Note: `budgetTagFor` is used un-mocked (it is a pure string sanitizer; `budgetTagFor("project", "p1")` → `"project_id_p1"`). If importing `@SRC/exulu/tags` turns out to pull heavy transitive deps into jest, add a second `jest.mock("@SRC/exulu/tags", …)` returning `{ budgetTagFor: (t: string, id: string) => `${t}_id_${id}` }` — but try without first.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx jest src/graphql/utilities/budget-field.test.ts
```

Expected: FAIL — `Cannot find module './budget-field'`.

- [ ] **Step 3: Create the module**

Create `src/graphql/utilities/budget-field.ts` (constants moved verbatim from `sanitize-and-hydrate-fields.ts:18-44`, hydrator extended with the member-view branch):

```ts
import {
  getBudgetSettings,
  getTagBudgetMap,
} from "@SRC/exulu/litellm/budget-service";
import { budgetTagFor, type BudgetEntityType } from "@SRC/exulu/tags";
import type { User } from "@EXULU_TYPES/models/user";

export const BUDGET_ENTITY_SINGULARS = new Set<string>([
  "user",
  "role",
  "team",
  "project",
  "agent",
  // `workflow_template` is the GraphQL table singular; budgets attach to it
  // under the user-facing BudgetEntityType "routine" (see tags.ts). The mapping
  // happens in BUDGET_ENTITY_TYPE_BY_SINGULAR below so budgetTagFor() emits the
  // correct `routine_id_<uuid>` tag.
  "workflow_template",
]);

/**
 * Some GraphQL table singulars don't match their BudgetEntityType verbatim
 * (e.g. workflow_template → routine). Map here so addBudgetField builds the
 * correct LiteLLM tag (`routine_id_<uuid>`) that matches what buildTags() emits
 * from the workflow job runner.
 */
const BUDGET_ENTITY_TYPE_BY_SINGULAR: Record<string, BudgetEntityType> = {
  user: "user",
  role: "role",
  team: "team",
  project: "project",
  agent: "agent",
  workflow_template: "routine",
};

/**
 * Resolve the computed `budget` field for an entity row. The budget lives in
 * LiteLLM (keyed by the entity's *_id_* tag); getTagBudgetMap is cached ~30s so
 * resolving a full page of rows is a single LiteLLM call + cheap map lookups.
 *
 * Gating:
 *  - super_admin / role.budget_management read|write → full tag info (admin view).
 *  - projects only: any other requester gets a reduced "member view" — the
 *    row-level RBAC on the query already decided they can see this project, so
 *    they may see its usage too. The view echoes the platform
 *    user_budget_display setting (same convention as /me/budget — the raw
 *    figures stay on the wire, rendering is a UI choice) and omits the
 *    internal budget_id. One getBudgetSettings() DB read per member-view row;
 *    fine for the detail page (single row), and no list UI queries budgets as
 *    a member today.
 *  - every other entity type stays admin-only (budget = null).
 */
export const addBudgetField = async (
  requestedFields: string[],
  result: any,
  tableSingular: string,
  user: User | undefined,
): Promise<any> => {
  if (!requestedFields.includes("budget")) return result;

  // Translate GraphQL table singular → BudgetEntityType (e.g. workflow_template → routine).
  const entityType = BUDGET_ENTITY_TYPE_BY_SINGULAR[tableSingular];
  const scope = (user as any)?.role?.budget_management;
  const canReadAll =
    !!user?.super_admin || scope === "read" || scope === "write";
  const memberView = !canReadAll && entityType === "project";
  if ((!canReadAll && !memberView) || result?.id == null || !entityType) {
    result.budget = null;
    return result;
  }

  const map = await getTagBudgetMap();
  const tag = budgetTagFor(entityType, result.id);
  const info = tag ? (map[tag] ?? null) : null;
  if (!memberView) {
    result.budget = info;
    return result;
  }
  if (!info) {
    result.budget = null;
    return result;
  }

  const settings = await getBudgetSettings();
  result.budget = {
    spend: info.spend,
    max_budget: info.max_budget,
    budget_duration: info.budget_duration,
    budget_reset_at: info.budget_reset_at,
    display: settings.user_budget_display,
  };
  return result;
};
```

- [ ] **Step 4: Point `sanitize-and-hydrate-fields.ts` at the new module**

In `src/graphql/utilities/sanitize-and-hydrate-fields.ts`:

Replace the two imports (current lines 15–16):

```ts
import { budgetTagFor, type BudgetEntityType } from "@SRC/exulu/tags";
import { getTagBudgetMap } from "@SRC/exulu/litellm/budget-service";
```

with:

```ts
import { addBudgetField, BUDGET_ENTITY_SINGULARS } from "./budget-field";
```

Then delete the entire moved block — the `BUDGET_ENTITY_SINGULARS` constant, the `BUDGET_ENTITY_TYPE_BY_SINGULAR` constant, and the `addBudgetField` function with their doc comments (current lines 18–79, i.e. everything between the import block and `const addProviderFields = async (`). The call site at the current lines 434–436 (`if (BUDGET_ENTITY_SINGULARS.has(table.name.singular)) { result = await addBudgetField(...) }`) stays byte-identical.

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx jest src/graphql/utilities/budget-field.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 6: Full backend gates**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx jest 2>&1 | tail -5
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: jest suite green (plus any failures already present on the base branch — compare against a pre-change run if unsure); tsc error count ≤ 14 (the pre-existing baseline — run the same grep on the untouched branch first if the count needs confirming).

- [ ] **Step 7: Commit (backend repo)**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && git status
```

Confirm branch is `develop` (ask the user if not). Then:

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && git add src/graphql/utilities/budget-field.ts src/graphql/utilities/budget-field.test.ts src/graphql/utilities/sanitize-and-hydrate-fields.ts && git commit -m "feat(budgets): project member view on the budget field

Members with row-level access to a project now get a reduced budget view
(spend/max/duration/reset + user_budget_display echo, no budget_id) instead
of null. All other entity types stay gated on budget_management. Extracts
addBudgetField into budget-field.ts for unit-testability.

Spec: frontend docs/superpowers/specs/2026-07-20-project-budget-visibility-design.md

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — `lib/budget.ts`: `hasCappedBudget` + `buildBudgetDetailLines`

Pure, node-testable model for the shared detail block. Keeping line selection out of JSX is what makes the "percent mode never leaks USD" contract unit-testable in this repo's node-only vitest setup.

**Files:**
- Modify: `lib/budget.ts` (append after `durationLabel`, before `defaultResetDate`)
- Modify: `lib/budget.test.ts` (append)

**Interfaces:**
- Consumes: existing `computeBudgetProjection`, `formatUsd`, `durationLabel`, `type BudgetInfo` (same file).
- Produces (used by Tasks 3–5):
  - `hasCappedBudget(b: BudgetInfo | null | undefined): b is BudgetInfo`
  - `type BudgetDetailLine = { key: <union of "bar.*" i18n keys>; values: Record<string, string | number>; emphasis?: boolean; tone?: "warn" | "muted" }`
  - `buildBudgetDetailLines(b: BudgetInfo): BudgetDetailLine[]`

- [ ] **Step 1: Write the failing tests**

Append to `lib/budget.test.ts` (also extend the first import line to pull in the new symbols and vitest timer helpers):

Replace the current import block

```ts
import { describe, it, expect } from "vitest";
import { defaultResetDate } from "./budget";
```

with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBudgetDetailLines,
  defaultResetDate,
  hasCappedBudget,
  type BudgetInfo,
} from "./budget";
```

Append at end of file:

```ts
describe("hasCappedBudget", () => {
  it("false for null / missing / zero / negative caps", () => {
    expect(hasCappedBudget(null)).toBe(false);
    expect(hasCappedBudget(undefined)).toBe(false);
    expect(hasCappedBudget({ spend: 1, max_budget: null, budget_duration: null, budget_reset_at: null })).toBe(false);
    expect(hasCappedBudget({ spend: 1, max_budget: 0, budget_duration: null, budget_reset_at: null })).toBe(false);
  });
  it("true for a positive cap", () => {
    expect(hasCappedBudget({ spend: 1, max_budget: 50, budget_duration: null, budget_reset_at: null })).toBe(true);
  });
});

describe("buildBudgetDetailLines", () => {
  // Fixed clock: 18 days into the 30d window ending 2026-08-01, so the linear
  // projection is spend * 30/18 (12.5 → $20.83 / 41.67% → rounds to 42%).
  const BASE: BudgetInfo = {
    spend: 12.5,
    max_budget: 50,
    budget_duration: "30d",
    budget_reset_at: "2026-08-01T00:00:00.000Z",
  };
  const resetDateLabel = new Date("2026-08-01T00:00:00.000Z").toLocaleDateString();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("amount mode: USD headline, remaining, projection, reset date", () => {
    expect(buildBudgetDetailLines(BASE)).toEqual([
      { key: "bar.usedOfMax", values: { spend: "$12.50", max: "$50" }, emphasis: true },
      { key: "bar.remainingDuration", values: { remaining: "$37.50", duration: "Monthly" } },
      { key: "bar.projected", values: { amount: "$20.83" } },
      { key: "bar.resetsOn", values: { date: resetDateLabel }, tone: "muted" },
    ]);
  });

  it("percent mode: percent-only lines", () => {
    expect(buildBudgetDetailLines({ ...BASE, display: "percent" })).toEqual([
      { key: "bar.percentUsed", values: { percent: 25 }, emphasis: true },
      { key: "bar.percentRemainingDuration", values: { percent: 75, duration: "Monthly" } },
      { key: "bar.projectedPercent", values: { percent: 42 } },
      { key: "bar.resetsOn", values: { date: resetDateLabel }, tone: "muted" },
    ]);
  });

  it("percent mode never emits a dollar sign anywhere", () => {
    const serialized = JSON.stringify(buildBudgetDetailLines({ ...BASE, display: "percent" }));
    expect(serialized).not.toMatch(/\$/);
  });

  it("over-pace flips the projection key and tone in both modes", () => {
    const hot = { ...BASE, spend: 45 }; // projected 45*30/18 = $75 → 150%
    expect(buildBudgetDetailLines(hot)[2]).toEqual({
      key: "bar.projectedOverPace",
      values: { amount: "$75" },
      tone: "warn",
    });
    expect(buildBudgetDetailLines({ ...hot, display: "percent" })[2]).toEqual({
      key: "bar.projectedPercentOverPace",
      values: { percent: 150 },
      tone: "warn",
    });
  });

  it("omits projection and reset lines when they cannot be computed", () => {
    const lines = buildBudgetDetailLines({
      spend: 10,
      max_budget: 50,
      budget_duration: null,
      budget_reset_at: null,
    });
    expect(lines.map((l) => l.key)).toEqual(["bar.usedOfMax", "bar.remainingDuration"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx vitest run lib/budget.test.ts
```

Expected: FAIL — `hasCappedBudget` / `buildBudgetDetailLines` are not exported.

- [ ] **Step 3: Implement**

In `lib/budget.ts`, insert after the `durationLabel` function (current line 122) and before the `defaultResetDate` doc comment:

```ts
/** True when a budget exists and has a positive cap — the shared "should we
 *  render an indicator at all" predicate. */
export function hasCappedBudget(b: BudgetInfo | null | undefined): b is BudgetInfo {
  return !!b && b.max_budget != null && b.max_budget > 0;
}

/** One line of the shared budget detail block (popovers / tooltips). `key` is
 *  an i18n key under the "budgets" namespace, `values` its interpolations.
 *  Kept as data rather than JSX so the percent-mode "never leak USD" contract
 *  is unit-testable in the node vitest environment. */
export type BudgetDetailLine = {
  key:
    | "bar.usedOfMax"
    | "bar.percentUsed"
    | "bar.remainingDuration"
    | "bar.percentRemainingDuration"
    | "bar.projected"
    | "bar.projectedOverPace"
    | "bar.projectedPercent"
    | "bar.projectedPercentOverPace"
    | "bar.resetsOn";
  values: Record<string, string | number>;
  /** Headline line (rendered font-medium). */
  emphasis?: boolean;
  tone?: "warn" | "muted";
};

/**
 * Build the used / remaining / projection / reset-date lines shown in budget
 * popovers and tooltips. `display === "percent"` selects the percent-only
 * variants (no USD value anywhere — the admin setting user_budget_display);
 * absent / "amount" keeps the dollar variants. Mirrors the line selection
 * previously inlined in TopBarBudget.
 */
export function buildBudgetDetailLines(b: BudgetInfo): BudgetDetailLine[] {
  const percentMode = b.display === "percent";
  const p = computeBudgetProjection(b);
  const usedPct = Math.round(p.percentUsed);
  const leftPct = Math.max(0, 100 - usedPct);
  const remaining = Math.max((b.max_budget ?? 0) - b.spend, 0);

  const lines: BudgetDetailLine[] = [
    percentMode
      ? { key: "bar.percentUsed", values: { percent: usedPct }, emphasis: true }
      : {
          key: "bar.usedOfMax",
          values: { spend: formatUsd(b.spend), max: formatUsd(b.max_budget) },
          emphasis: true,
        },
    percentMode
      ? {
          key: "bar.percentRemainingDuration",
          values: { percent: leftPct, duration: durationLabel(b.budget_duration) },
        }
      : {
          key: "bar.remainingDuration",
          values: { remaining: formatUsd(remaining), duration: durationLabel(b.budget_duration) },
        },
  ];

  if (percentMode) {
    const projectedPct = p.projectedPercent != null ? Math.round(p.projectedPercent) : null;
    if (projectedPct != null) {
      const line: BudgetDetailLine = {
        key: p.overPace ? "bar.projectedPercentOverPace" : "bar.projectedPercent",
        values: { percent: projectedPct },
      };
      if (p.overPace) line.tone = "warn";
      lines.push(line);
    }
  } else if (p.projected != null) {
    const line: BudgetDetailLine = {
      key: p.overPace ? "bar.projectedOverPace" : "bar.projected",
      values: { amount: formatUsd(p.projected) },
    };
    if (p.overPace) line.tone = "warn";
    lines.push(line);
  }

  if (b.budget_reset_at) {
    lines.push({
      key: "bar.resetsOn",
      values: { date: new Date(b.budget_reset_at).toLocaleDateString() },
      tone: "muted",
    });
  }

  return lines;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx vitest run lib/budget.test.ts
```

Expected: PASS (all describe blocks, including the pre-existing `defaultResetDate` ones).

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && git add lib/budget.ts lib/budget.test.ts && git commit -m "feat(budgets): hasCappedBudget + buildBudgetDetailLines model

Pure percent-aware line model for budget popovers/tooltips so the
'percent mode never leaks USD' contract is unit-testable in node.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — shared `BudgetDetailLines` component + `BudgetBar` percent mode

**Files:**
- Create: `components/budget-details.tsx`
- Modify: `components/budget-bar.tsx` (full rewrite shown below)

**Interfaces:**
- Consumes: `buildBudgetDetailLines`, `type BudgetInfo` (Task 2); i18n namespace `budgets` (keys `bar.*`, all existing).
- Produces: `BudgetDetailLines({ budget }: { budget: BudgetInfo }): JSX` — renders sibling `<p>` elements only (no wrapper), so hosts control spacing via `space-y-1` on the container. `BudgetBar` keeps its exact public props `{ budget, compact?, className? }`.

Allowed visual deltas in this task (per Global Constraints): over-pace tooltip line `text-amber-500` → `text-amber-600 dark:text-amber-400` (unifies with TopBarBudget); tooltip lines `div` → `p`; `motion-reduce:transition-none` on the fill. Everything else in amount mode must be string-identical in English; German admin tooltips switch from hardcoded English to the existing `de.json` translations (an improvement, not a regression).

- [ ] **Step 1: Create `components/budget-details.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";

import { buildBudgetDetailLines, type BudgetInfo } from "@/lib/budget";
import { cn } from "@/lib/utils";

/**
 * Shared used / remaining / projection / reset-date lines for budget popovers
 * and tooltips (TopBarBudget, BudgetBar tooltip, BudgetBarWithDetails, the
 * project-detail indicator). Percent-aware: when `budget.display ===
 * "percent"` no USD figure ever reaches the DOM — line selection lives in
 * lib/budget.ts (buildBudgetDetailLines) where it is unit-tested. Renders
 * bare <p> siblings; the host owns spacing (space-y-1) and text size.
 */
export function BudgetDetailLines({ budget }: { budget: BudgetInfo }) {
  const t = useTranslations("budgets");
  return (
    <>
      {buildBudgetDetailLines(budget).map((line) => (
        <p
          key={line.key}
          className={cn(
            line.emphasis && "font-medium",
            line.tone === "warn" && "text-amber-600 dark:text-amber-400",
            line.tone === "muted" && "text-muted-foreground",
          )}
        >
          {t(line.key, line.values)}
        </p>
      ))}
    </>
  );
}
```

(`t(line.key, …)` with a dynamic key is fine — this repo has no `IntlMessages` global typing, and the budgets feature already uses template-literal keys, e.g. `entity-config-section.tsx:151`.)

- [ ] **Step 2: Rewrite `components/budget-bar.tsx`**

Replace the file's entire contents with (4-space indent preserved; note the hook is called before the early return — React hooks rule):

```tsx
"use client"

import { useTranslations } from "next-intl"

import { BudgetDetailLines } from "@/components/budget-details"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    computeBudgetProjection,
    formatUsd,
    type BudgetInfo,
} from "@/lib/budget"
import { cn } from "@/lib/utils"

const FILL_COLORS: Record<string, string> = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    over: "bg-red-500",
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Animated, colour-coded budget bar with a burn-rate projection marker.
 * - fill width animates via a CSS transition on width
 * - colour: green (on track) / amber (≥80% or on track to exceed) / red (over)
 * - the dashed marker shows the projected spend by the reset date
 * - display-aware: `budget.display === "percent"` renders percentages only
 *   (inline numbers and tooltip switch to the bar.percent* strings — no USD
 *   anywhere). Absent / "amount" keeps the dollar rendering; admin queries
 *   never set `display`, so admin surfaces are unchanged.
 * Used in the admin overview, the BudgetEditor, the in-chat indicator, and
 * the project-detail header indicator.
 */
export function BudgetBar({
    budget,
    compact = false,
    className,
}: {
    budget: BudgetInfo | null
    compact?: boolean
    className?: string
}) {
    const t = useTranslations("budgets")

    if (!budget || budget.max_budget == null || budget.max_budget <= 0) {
        return (
            <span className={cn("text-xs text-muted-foreground", className)}>
                No budget
            </span>
        )
    }

    const p = computeBudgetProjection(budget)
    const usedPct = clamp(p.percentUsed)
    const projPct = p.projectedPercent != null ? clamp(p.projectedPercent) : null
    const percentMode = budget.display === "percent"

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("w-full", className)}>
                        <div
                            className={cn(
                                "relative w-full overflow-hidden rounded-full bg-muted",
                                compact ? "h-2" : "h-3",
                            )}
                        >
                            <div
                                className={cn(
                                    "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                                    FILL_COLORS[p.level],
                                )}
                                style={{ width: `${usedPct}%` }}
                            />
                            {projPct != null && (
                                <div
                                    className="absolute top-0 h-full border-l-2 border-dashed border-foreground/60"
                                    style={{ left: `calc(${projPct}% - 1px)` }}
                                    aria-hidden
                                />
                            )}
                        </div>
                        {!compact && (
                            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                                {percentMode ? (
                                    <span>
                                        {t("bar.percentUsed", {
                                            percent: Math.round(p.percentUsed),
                                        })}
                                    </span>
                                ) : (
                                    <>
                                        <span>
                                            {formatUsd(budget.spend)} / {formatUsd(budget.max_budget)}
                                        </span>
                                        <span>{Math.round(p.percentUsed)}%</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="space-y-1 text-xs">
                    <BudgetDetailLines budget={budget} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
```

(The hardcoded "No budget" string stays hardcoded — byte-stable for the admin table; changing it is out of scope.)

- [ ] **Step 3: Gates**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx vitest run
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx eslint components/budget-details.tsx components/budget-bar.tsx
```

Expected: tsc clean; vitest — only the known-failing `nav-config` test may fail; eslint clean on the two files.

- [ ] **Step 4: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && git add components/budget-details.tsx components/budget-bar.tsx && git commit -m "feat(budgets): percent-aware BudgetBar + shared BudgetDetailLines

BudgetBar now honors budget.display === 'percent' (inline row and tooltip
render percentages only — closes the chat usage-popover USD leak) and gains
the filed motion-reduce follow-up. Detail lines move to a shared component
backed by the unit-tested buildBudgetDetailLines model.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — adopt `BudgetDetailLines` in `TopBarBudget` and `BudgetBarWithDetails`

Pure deduplication: both components currently inline the same four lines. Output stays identical (TopBarBudget already used the amber-600/400 tone and the percent keys; BudgetBarWithDetails is admin-only where `display` is never set, so it keeps its exact USD strings).

**Files:**
- Modify: `components/shell/top-bar-budget.tsx`
- Modify: `app/(application)/budgets/components/budget-bar-with-details.tsx`

**Interfaces:**
- Consumes: `BudgetDetailLines` (Task 3). No produced interfaces change — both components keep their public props.

- [ ] **Step 1: `top-bar-budget.tsx` — swap the popover body**

Replace the import block's lib/budget line

```ts
import {
  computeBudgetProjection,
  durationLabel,
  formatUsd,
  type BudgetInfo,
} from "@/lib/budget";
```

with

```ts
import { BudgetDetailLines } from "@/components/budget-details";
import {
  computeBudgetProjection,
  formatUsd,
  type BudgetInfo,
} from "@/lib/budget";
```

(`computeBudgetProjection` is still needed for the status dot + chip percentages; `formatUsd` for the amount-mode chip face. `durationLabel` moves behind `BudgetDetailLines`. Delete the now-unused `leftPct`/`projectedPct` chip-body derivations ONLY if they become unused — `leftPct` is still used by `chipLabel`, `projectedPct` becomes unused and must be removed.)

Then replace the entire `<PopoverContent …>…</PopoverContent>` block (currently lines 94–152, from `<PopoverContent align="end"` through its closing tag) with:

```tsx
      <PopoverContent align="end" className="w-64 space-y-1 text-xs">
        <BudgetDetailLines budget={budget} />
      </PopoverContent>
```

- [ ] **Step 2: `budget-bar-with-details.tsx` — swap the popover body**

Replace the lib imports

```ts
import {
  computeBudgetProjection,
  durationLabel,
  formatUsd,
  type BudgetInfo,
} from "@/lib/budget";
```

with

```ts
import { BudgetDetailLines } from "@/components/budget-details";
import { type BudgetInfo } from "@/lib/budget";
```

Delete the now-unused derivations inside the component body:

```ts
  const projection = computeBudgetProjection(budget);
  const remaining = Math.max((budget.max_budget ?? 0) - budget.spend, 0);
```

Replace the `<PopoverContent …>…</PopoverContent>` block (currently lines 79–110) with:

```tsx
      <PopoverContent align="start" className="w-64 space-y-1 text-xs">
        <BudgetDetailLines budget={budget} />
      </PopoverContent>
```

Also update the stale part of the file header comment: delete the two sentences "The shared component (`components/budget-bar.tsx`) is consumed by the chat BudgetBar widget and is under the cross-feature byte-stable rule, so the fix lives here rather than inside the primitive. Follow-up: when the byte-stable lock relaxes, the Tooltip-only path inside BudgetBar should be upgraded to a single focus/click Popover (collapsing this wrapper)." and the paragraph "The reduced-motion guard … tracked as a separate follow-up." (the guard shipped in Task 3). Keep the first paragraph describing what the wrapper does.

The `useTranslations("budgets")` hook stays (still used for `bar.detailsAria`).

- [ ] **Step 3: Gates**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx eslint components/shell/top-bar-budget.tsx "app/(application)/budgets/components/budget-bar-with-details.tsx"
```

Expected: both clean (unused-import errors here mean a derivation from Step 1/2 wasn't removed).

- [ ] **Step 4: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && git add components/shell/top-bar-budget.tsx "app/(application)/budgets/components/budget-bar-with-details.tsx" && git commit -m "refactor(budgets): reuse BudgetDetailLines in TopBarBudget and admin popover

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — detail query `budget` field, `Project` type, `ProjectBudgetIndicator`, header wiring

**Files:**
- Modify: `app/(application)/projects/queries.ts:77-84`
- Modify: `types/models/project.ts`
- Create: `app/(application)/projects/components/project-budget-indicator.tsx`
- Modify: `app/(application)/projects/components/project-detail-view.tsx` (imports + `meta` block, currently lines 244–261)

**Interfaces:**
- Consumes: backend member view `{ spend, max_budget, budget_duration, budget_reset_at, display }` on `projectById.budget` (Task 1); `hasCappedBudget`, `type BudgetInfo` (Task 2); `BudgetBar` (Task 3); `BudgetDetailLines` (Task 3); i18n key `budgets.bar.detailsAria` = "Budget details for {name}" (exists in en + de).
- Produces: `ProjectBudgetIndicator({ budget, projectName }: { budget: BudgetInfo | null | undefined; projectName: string }): JSX | null`.

- [ ] **Step 1: Add `budget` to the detail query only**

In `app/(application)/projects/queries.ts`, replace

```ts
/** Verbatim copy of GET_PROJECT_BY_ID. */
export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($id: ID!) {
    projectById(id: $id) {
      ${PROJECT_FIELDS}
    }
  }
`;
```

with

```ts
/**
 * GET_PROJECT_BY_ID + the computed `budget` field (admin view or project
 * member view — spec docs/superpowers/specs/2026-07-20-project-budget-
 * visibility-design.md). `budget` is deliberately NOT in PROJECT_FIELDS so
 * list queries and mutation payloads skip the LiteLLM hydration round-trip.
 */
export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($id: ID!) {
    projectById(id: $id) {
      ${PROJECT_FIELDS}
      budget
    }
  }
`;
```

(Do NOT edit `PROJECT_FIELDS` itself. The file-header comment's "verbatim copies of the monolith" claim now has this one documented exception — the replacement comment above records it.)

- [ ] **Step 2: Extend the `Project` model type**

In `types/models/project.ts`, add the import at the top of the file:

```ts
import type { BudgetInfo } from "@/lib/budget";
```

and add to the `Project` interface (after `updatedAt?: string;`):

```ts
    /** Computed budget view (GET_PROJECT_BY_ID only): full tag info for
     *  budget admins, reduced member view (with `display` echo) for project
     *  members, null when unset or hidden. */
    budget?: BudgetInfo | null;
```

- [ ] **Step 3: Create `project-budget-indicator.tsx`**

Create `app/(application)/projects/components/project-budget-indicator.tsx`:

```tsx
"use client";

/**
 * Read-only budget usage for the project detail header (spec
 * docs/superpowers/specs/2026-07-20-project-budget-visibility-design.md):
 * compact shared BudgetBar + rounded percentage face, wrapped in a focusable
 * click/keyboard Popover carrying the shared detail lines (same
 * accessibility pattern as the admin BudgetBarWithDetails — every datum
 * reachable without hover). The percentage face is mode-neutral, so the
 * chip itself never leaks USD regardless of the user_budget_display
 * setting; the popover/tooltip lines are percent-safe via BudgetDetailLines.
 * Renders nothing when the project has no capped budget. No edit
 * affordances by design.
 */

import { useTranslations } from "next-intl";

import { BudgetBar } from "@/components/budget-bar";
import { BudgetDetailLines } from "@/components/budget-details";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  computeBudgetProjection,
  hasCappedBudget,
  type BudgetInfo,
} from "@/lib/budget";

export function ProjectBudgetIndicator({
  budget,
  projectName,
}: {
  budget: BudgetInfo | null | undefined;
  projectName: string;
}) {
  const t = useTranslations("budgets");

  if (!hasCappedBudget(budget)) return null;

  const usedPct = Math.round(computeBudgetProjection(budget).percentUsed);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("bar.detailsAria", { name: projectName })}
          // min-h-11 = 44px touch target below md (responsive.md DoD),
          // matching the instructions-active button beside it.
          className="flex min-h-11 w-44 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0"
        >
          <BudgetBar budget={budget} compact className="flex-1" />
          <span className="text-xs tabular-nums">{usedPct}%</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-1 text-xs">
        <BudgetDetailLines budget={budget} />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Wire into the detail header**

In `app/(application)/projects/components/project-detail-view.tsx`:

Add to the imports (with the other `@/lib` / local imports):

```ts
import { hasCappedBudget } from "@/lib/budget";
import { ProjectBudgetIndicator } from "./project-budget-indicator";
```

Replace the `meta={…}` prop of `<PageHeader>` (currently lines 244–261). The existing instructions `<button>` moves inside a flex row unchanged:

```tsx
        meta={
          hasCappedBudget(project.budget) || project.custom_instructions ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {/* Read-only usage (spec 2026-07-20): members see what the
                  project has spent; details in a click/keyboard popover. */}
              <ProjectBudgetIndicator
                budget={project.budget}
                projectName={project.name}
              />
              {project.custom_instructions ? (
                // Quiet trust line (philosophy §8): chats here inherit
                // instructions — one click shows them.
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  // min-h-11 = 44px touch target below md (responsive.md DoD).
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0"
                >
                  <span>{t("detail.instructionsActive")}</span>
                  <span aria-hidden="true">·</span>
                  <span className="underline underline-offset-2">
                    {t("detail.viewInstructions")}
                  </span>
                </button>
              ) : undefined}
            </div>
          ) : undefined
        }
```

- [ ] **Step 5: Gates**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx vitest run
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx eslint "app/(application)/projects/components/project-budget-indicator.tsx" "app/(application)/projects/components/project-detail-view.tsx" "app/(application)/projects/queries.ts" types/models/project.ts
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx next build 2>&1 | tail -5
```

Expected: tsc clean; vitest — only the known-failing nav-config test; eslint clean on the listed files; build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && git add "app/(application)/projects/queries.ts" types/models/project.ts "app/(application)/projects/components/project-budget-indicator.tsx" "app/(application)/projects/components/project-detail-view.tsx" && git commit -m "feat(projects): read-only budget indicator on the project detail header

GET_PROJECT_BY_ID now selects the computed budget field (backend returns a
member view for non-admins); a compact BudgetBar + percentage face with a
keyboard/touch popover renders in the PageHeader meta row. Hidden when no
capped budget is set.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end verification (both repos, dev servers)

No new code. Run the stack and verify the behavior matrix. Needs a LiteLLM-enabled backend env (`EXULU_USE_LITELLM=true` + `LITELLM_MASTER_KEY`) — if the local env lacks LiteLLM, flag this to the user as a remaining human-verification step instead of skipping silently.

- [ ] **Step 1: Start both dev servers** (backend and frontend, per each repo's `npm run dev`).

- [ ] **Step 2: Verify the matrix** (use the `verify` skill / Playwright UAT if available, otherwise report as manual QA items):

| # | Actor | Setup | Expected on project detail page |
|---|-------|-------|--------------------------------|
| 1 | Budget admin | Project with budget set (via /budgets → Projects tab) | Compact bar + `NN%` under the description on all three tabs; popover shows USD lines (`$x of $y used`, remaining, projection, `Resets <date>`) |
| 2 | Regular member (no budget_management), `user_budget_display = amount` | Same project shared with the member | Same as #1 — USD lines visible |
| 3 | Regular member, `user_budget_display = percent` (flip in /budgets → default policy dialog) | Same project | Bar + `NN%` face; popover/tooltip show ONLY percentages — grep the rendered popover text for `$`: none |
| 4 | Any user | Project with NO budget | No indicator rendered in the header (no "No budget" text) |
| 5 | Regular member | — | /budgets route still denied (AccessDenied) |
| 6 | Budget admin | /budgets Projects tab + chat top-bar indicator | Unchanged rendering (regression check on BudgetBar/TopBarBudget refactor) |

- [ ] **Step 3: Report results** — pass/fail per row with screenshots if UAT tooling ran; anything unverifiable locally goes to the user as an explicit remaining-QA list.

---

## Self-Review (done while writing)

- **Spec coverage:** backend member view + gating (Task 1); `projectById` hydration path verified during research (resolvers/index.ts:174 calls `finalizeRequestedFields`); query/type (Task 5 Steps 1–2); BudgetBar percent mode incl. chat-popover leak fix (Task 3); shared detail block extraction (Tasks 3–4); header indicator, hidden-when-unset, no editing (Task 5); i18n reuse with zero new keys (Global Constraints); backend unit tests (Task 1); frontend percent-safety tests adapted to the repo's node-only vitest reality (Task 2 — the spec's "component tests" are delivered as the model-level percent-safety contract since this repo has no DOM test infra).
- **Placeholder scan:** none — every code step carries complete code.
- **Type consistency:** `BudgetDetailLine`/`buildBudgetDetailLines`/`hasCappedBudget` names match across Tasks 2–5; `addBudgetField` signature unchanged from the existing call site; member-view field names match `BudgetInfo` exactly (`spend`, `max_budget`, `budget_duration`, `budget_reset_at`, `display`).
