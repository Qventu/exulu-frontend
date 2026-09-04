# Demo Cost & Control Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/analytics` and `/budgets` render convincing screens in demo mode, and add the two-step "Was es kostet" chapter at position 11 — arguing attribution and control, never savings, with its invented figures disclosed on screen and the disclosure enforced by a test.

**Architecture:** `/budgets` is pure GraphQL and drops into the existing resolver table. `/analytics` is the demo's only REST-backed screen, so a new `demoRestResponse(path, method)` sits beside `resolverFor(operationName)` and is consulted by `lib/api/client.ts` before its existing `return null`. The analytics fixture generates its rows *inside the requested date window*, deterministically, so it can never go stale.

**Tech Stack:** Next.js 16, React 19.2, Apollo Client 3.14, Shepherd.js 15, vitest 4 (`environment: "node"`, no DOM), Python 3 + gpt-image-2 for the illustration.

**Spec:** `docs/superpowers/specs/2026-09-04-demo-cost-control-design.md`

**Depends on:** the demo presentation engine and the data-first narrative, both merged to `main`. This plan consumes `ContentBlock`, the one-module-per-chapter layout, `DEMO_SUPPORTED_ROUTES`, and the chapter-integrity test suite. It adds one new mechanism: the REST fixture layer.

## Global Constraints

- **Tests run in node with no DOM.** `vitest.config.ts` sets `environment: "node"` and collects only `lib/**/*.test.ts`, `components/**/*.test.ts`, `app/**/*.test.ts`. Never write a test needing `document`; never create a `.test.tsx` — it will not be collected.
- **Demo copy is hardcoded German, never next-intl.** Sie-form. Demo-only strings must not enter `messages/*.json`.
- **The chapter never claims savings or ROI.** It shows spend, attribution and control. This mirrors the Value Ledger principle of stating the position rather than asserting a return.
- **The figures are invented and must say so on screen**, in the visitor-facing copy — not in a code comment. A test asserts the disclosure is present.
- **Scale: roughly €400/month.** Modest enough that attention stays on attribution rather than the total.
- **Client confidentiality:** NEW Lift and ALGI are named ONCE, in `lib/demo/chapters/contact.ts`. `chapters/index.test.ts` asserts no other chapter mentions them. Team names in this chapter are generic German functions — Technik, Service, Vertrieb.
- **Do not touch the product's `/analytics` or `/budgets` components.** If a screen renders awkwardly against fixture data, report it — the demo does not reshape the product to flatter itself.
- **Do not touch `messages/de.json` or `messages/en.json`** — another session's uncommitted work lives there in this checkout.
- **`tsconfig.json` sets `strict: true` but NOT `noImplicitReturns`** — a switch over a union needs an explicit `default: { const unhandled: never = x; return unhandled; }` guard.
- **Known pre-existing failure:** `components/shell/nav-config.test.ts` fails on `main` already (unrelated `models` nav entry). Not caused here.
- Branch: `feat/demo-cost-control`. Commit after every task.

## File Structure

**Create:**
- `lib/demo/rest-fixtures.ts` — `demoRestResponse(path, method)`. The REST counterpart to `resolvers.ts`. Owns the time-relative tag-activity generator.
- `lib/demo/rest-fixtures.test.ts`
- `lib/demo/fixtures/chapter-kosten.ts` — the teams, their budgets, and the per-prefix tag rosters the analytics fixture attributes spend to. One source of truth shared by the REST fixture and the budgets resolvers, so the two screens cannot disagree.
- `lib/demo/chapters/kosten.ts` — the chapter.

**Modify:**
- `lib/api/client.ts` — one line: `return demoRestResponse(path, method)` in place of `return null`.
- `lib/demo/resolvers.ts` — six `*WithBudgets` resolvers and five id→name hydration resolvers (`GetAgentsByIds` already exists).
- `lib/demo/supported-routes.ts` — add `/analytics` and `/budgets`.
- `lib/demo/tour.ts` — `DemoChapterId` gains `"kosten"`.
- `lib/demo/chapters/index.ts` — insert `kostenChapter` at position 11, replacing the reserved-slot comment.
- `lib/demo/tour.test.ts` — the hardcoded chapter-order array, and the invented-content register.
- `scripts/generate-demo-image.py` — one prompt.

---

### Task 1: The time-relative tag-activity generator

The riskiest piece, so it goes first. A fixture with hardcoded dates renders an empty chart the moment the demo outlives its window — silently, with the request succeeding.

**Files:**
- Create: `lib/demo/fixtures/chapter-kosten.ts`, `lib/demo/rest-fixtures.ts`
- Test: `lib/demo/rest-fixtures.test.ts`

**Interfaces:**
- Consumes: `TagActivityResponse` and its row types from `@/lib/litellm-activity`.
- Produces: `demoRestResponse(path: string, method: string): unknown | null`; `KOSTEN_TEAMS` from `lib/demo/fixtures/chapter-kosten.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/rest-fixtures.test.ts
import { describe, expect, it } from "vitest";
import { demoRestResponse } from "./rest-fixtures";
import type { TagActivityResponse } from "@/lib/litellm-activity";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 86_400_000));

const activity = (start: string, end: string, prefix = "user_id_") =>
  demoRestResponse(
    `/admin/litellm/tag-activity?start_date=${start}&end_date=${end}&tag_prefix=${prefix}`,
    "GET",
  ) as TagActivityResponse;

describe("demoRestResponse — routing", () => {
  it("answers the tag-activity path", () => {
    expect(activity(daysAgo(14), daysAgo(0))).not.toBeNull();
  });

  // Every other REST call in the demo returns null on purpose: session files
  // and follow-up suggestions are optional enrichments, and a thrown error
  // would put a failure state on screen for something a visitor was never
  // meant to notice. Adding one fixture must not disturb that.
  it("leaves every other path silent", () => {
    for (const path of ["/session-files", "/suggestions", "/admin/litellm/other"]) {
      expect(demoRestResponse(path, "GET"), path).toBeNull();
    }
  });

  it("does not answer a near-miss path", () => {
    expect(demoRestResponse("/admin/litellm/tag-activity-summary", "GET")).toBeNull();
  });
});

describe("demoRestResponse — time relativity", () => {
  // THE defect this fixture exists to avoid: hardcoded dates fall outside the
  // window the UI asks for, so the chart renders empty and nothing fails.
  it("puts every daily row inside the requested window", () => {
    const start = daysAgo(14);
    const end = daysAgo(0);
    const res = activity(start, end);
    expect(res.daily.length).toBeGreaterThan(0);
    for (const row of res.daily) {
      expect(row.date >= start, `${row.date} < ${start}`).toBe(true);
      expect(row.date <= end, `${row.date} > ${end}`).toBe(true);
    }
    expect(res.window).toEqual({ start_date: start, end_date: end });
  });

  it("still fills a window a year from now", () => {
    const start = ymd(new Date(Date.now() + 364 * 86_400_000));
    const end = ymd(new Date(Date.now() + 371 * 86_400_000));
    const res = activity(start, end);
    expect(res.daily.length).toBe(8);
    for (const row of res.daily) {
      expect(row.date >= start && row.date <= end).toBe(true);
    }
  });

  it("is deterministic — the same window twice yields identical data", () => {
    const start = daysAgo(14);
    const end = daysAgo(0);
    expect(JSON.stringify(activity(start, end))).toBe(JSON.stringify(activity(start, end)));
  });
});

describe("demoRestResponse — shape and scale", () => {
  it("totals equal the sum of the daily rows", () => {
    const res = activity(daysAgo(29), daysAgo(0));
    const summed = res.daily.reduce((s, r) => s + r.spend, 0);
    expect(res.totals.spend).toBeCloseTo(summed, 6);
  });

  // The spec fixes the scale at roughly EUR 400/month so a reader's attention
  // stays on where the money goes rather than on the total.
  it("lands near the specified monthly scale", () => {
    const res = activity(daysAgo(29), daysAgo(0));
    expect(res.totals.spend).toBeGreaterThan(250);
    expect(res.totals.spend).toBeLessThan(600);
  });

  it("attributes spend to the tags the caller asked for", () => {
    const res = activity(daysAgo(14), daysAgo(0), "team_id_");
    expect(res.byTag.length).toBeGreaterThan(0);
    for (const row of res.byTag) expect(row.tag.startsWith("team_id_")).toBe(true);
  });

  it("returns an empty breakdown for a prefix it has no roster for", () => {
    const res = activity(daysAgo(14), daysAgo(0), "nonsense_");
    expect(res.byTag).toEqual([]);
    // Totals still hold, so the chart renders even on an unknown dimension.
    expect(res.totals.spend).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/rest-fixtures.test.ts`
Expected: FAIL — cannot resolve `./rest-fixtures`.

- [ ] **Step 3: Write the shared fixture entities**

```ts
// lib/demo/fixtures/chapter-kosten.ts
/**
 * The teams the cost chapter attributes spend to, and their budgets.
 *
 * ONE source of truth for both screens. /analytics reads these through the
 * REST fixture and /budgets through the GraphQL resolvers; if they were
 * declared twice, the two halves of a single chapter could disagree about
 * who spent what while a prospect looked at them side by side.
 *
 * Generic German functions, never customer names — chapters/index.test.ts
 * asserts NEW Lift and ALGI appear only in contact.ts.
 *
 * THE FIGURES ARE INVENTED. No spend history was captured from the
 * deployment. The chapter says so on screen and a test asserts it keeps
 * saying so; see lib/demo/chapters/kosten.ts.
 */
export interface KostenTeam {
  id: string;
  name: string;
  /** Monthly cap in EUR, as a customer would set it. */
  budget: number;
  /** Share of total spend, 0..1. Sums to 1 across the roster. */
  share: number;
}

export const KOSTEN_TEAMS: KostenTeam[] = [
  { id: "team-technik", name: "Technik", budget: 250, share: 0.52 },
  { id: "team-service", name: "Service", budget: 150, share: 0.31 },
  { id: "team-vertrieb", name: "Vertrieb", budget: 100, share: 0.17 },
];

/**
 * Which roster answers a given tag prefix.
 *
 * /analytics asks for one prefix per dimension (lens.ts's
 * DIMENSION_TAG_PREFIX), and its totals/daily queries always slice on
 * `user_id_` (CANONICAL_DEDUPE_TAG_PREFIX). Anything we have no roster for
 * yields an empty breakdown rather than invented entities.
 */
export const KOSTEN_ROSTERS: Record<string, KostenTeam[]> = {
  team_id_: KOSTEN_TEAMS,
  user_id_: KOSTEN_TEAMS,
};
```

- [ ] **Step 4: Write the generator**

```ts
// lib/demo/rest-fixtures.ts
import type {
  TagActivityByTagByDayRow,
  TagActivityByTagRow,
  TagActivityDailyRow,
  TagActivityResponse,
} from "@/lib/litellm-activity";

import { KOSTEN_ROSTERS, KOSTEN_TEAMS } from "./fixtures/chapter-kosten";

/**
 * REST fixtures for the demo — the counterpart to resolvers.ts.
 *
 * lib/api/client.ts short-circuits every REST call in demo mode. That
 * silence is deliberate for most callers: session files and follow-up
 * suggestions are optional enrichments, and a thrown error would put a
 * failure state on screen for something a visitor was never meant to
 * notice. So this answers exactly one path and returns null for the rest,
 * leaving that contract intact.
 */
const TAG_ACTIVITY = "/admin/litellm/tag-activity";

export function demoRestResponse(path: string, _method: string): unknown | null {
  const [pathname, query = ""] = path.split("?");
  if (pathname !== TAG_ACTIVITY) return null;
  const params = new URLSearchParams(query);
  return tagActivity(
    params.get("start_date") ?? isoDay(0),
    params.get("end_date") ?? isoDay(0),
    params.get("tag_prefix"),
  );
}

/** YYYY-MM-DD, `offset` days from today. */
function isoDay(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A stable pseudo-random value in [0,1) for a given day.
 *
 * Derived from the date string itself, so the series is DETERMINISTIC —
 * the same window always yields the same numbers, which keeps screenshots
 * and assertions stable — while remaining RELATIVE, because the caller
 * supplies the window. A fixture with hardcoded dates would render an empty
 * chart the moment the demo outlived it, silently: the request succeeds and
 * the rows simply fall outside the range the UI asked for.
 */
function jitter(date: string): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Spend for one day, in EUR.
 *
 * Weekdays carry the work; weekends are a trickle. That shape is what makes
 * the chart read as a team using the product rather than as a generator
 * emitting numbers — and it is why the monthly total lands near the EUR 400
 * the spec fixes rather than being tuned directly.
 */
function spendFor(date: string): number {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const base = weekday === 0 || weekday === 6 ? 3.2 : 17.4;
  return Math.round((base + jitter(date) * 6 - 3) * 100) / 100;
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= Date.parse(`${end}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function tagActivity(
  start: string,
  end: string,
  prefix: string | null,
): TagActivityResponse {
  const days = daysBetween(start, end);

  const daily: TagActivityDailyRow[] = days.map((date) => {
    const spend = spendFor(date);
    // Tokens and requests track spend so the three measures the lens can
    // switch between tell the same story rather than contradicting it.
    const requests = Math.round(spend * 21);
    const prompt = Math.round(spend * 4100);
    const completion = Math.round(spend * 950);
    return {
      date,
      spend,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
      successful_requests: requests,
      failed_requests: Math.round(requests * 0.004),
      api_requests: requests,
    };
  });

  const sum = (pick: (r: TagActivityDailyRow) => number) =>
    daily.reduce((s, r) => s + pick(r), 0);
  const totalSpend = Math.round(sum((r) => r.spend) * 100) / 100;

  const roster = prefix ? (KOSTEN_ROSTERS[prefix] ?? []) : KOSTEN_TEAMS;

  const byTag: TagActivityByTagRow[] = roster.map((team) => ({
    tag: `${prefix ?? "team_id_"}${team.id}`,
    prefix: prefix ?? "team_id_",
    id: team.id,
    name: team.name,
    spend: Math.round(totalSpend * team.share * 100) / 100,
    prompt_tokens: Math.round(sum((r) => r.prompt_tokens) * team.share),
    completion_tokens: Math.round(sum((r) => r.completion_tokens) * team.share),
    total_tokens: Math.round(sum((r) => r.total_tokens) * team.share),
    successful_requests: Math.round(sum((r) => r.successful_requests) * team.share),
    failed_requests: Math.round(sum((r) => r.failed_requests) * team.share),
    api_requests: Math.round(sum((r) => r.api_requests) * team.share),
  }));

  const byTagByDay: TagActivityByTagByDayRow[] = roster.flatMap((team) =>
    daily.map((row) => ({
      tag: `${prefix ?? "team_id_"}${team.id}`,
      prefix: prefix ?? "team_id_",
      id: team.id,
      name: team.name,
      date: row.date,
      spend: Math.round(row.spend * team.share * 100) / 100,
      prompt_tokens: Math.round(row.prompt_tokens * team.share),
      completion_tokens: Math.round(row.completion_tokens * team.share),
      total_tokens: Math.round(row.total_tokens * team.share),
      successful_requests: Math.round(row.successful_requests * team.share),
      failed_requests: Math.round(row.failed_requests * team.share),
      api_requests: Math.round(row.api_requests * team.share),
    })),
  );

  return {
    window: { start_date: start, end_date: end },
    totals: {
      spend: totalSpend,
      prompt_tokens: sum((r) => r.prompt_tokens),
      completion_tokens: sum((r) => r.completion_tokens),
      total_tokens: sum((r) => r.total_tokens),
      successful_requests: sum((r) => r.successful_requests),
      failed_requests: sum((r) => r.failed_requests),
      api_requests: sum((r) => r.api_requests),
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    daily,
    byTag,
    byTagByDay,
    byModel: [
      {
        model: "vertex-gemini-2.5-flash",
        spend: Math.round(totalSpend * 0.79 * 100) / 100,
        total_tokens: Math.round(sum((r) => r.total_tokens) * 0.79),
        successful_requests: Math.round(sum((r) => r.successful_requests) * 0.79),
        failed_requests: 0,
      },
      {
        model: "text-embedding-3-large",
        spend: Math.round(totalSpend * 0.21 * 100) / 100,
        total_tokens: Math.round(sum((r) => r.total_tokens) * 0.21),
        successful_requests: Math.round(sum((r) => r.successful_requests) * 0.21),
        failed_requests: 0,
      },
    ],
    pagination: { page: 1, total_pages: 1, total_count: byTag.length, has_more: false },
    tagPrefix: prefix,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run lib/demo/rest-fixtures.test.ts && npx tsc --noEmit`
Expected: PASS, 9 tests, typecheck clean.

If the monthly-scale test fails, adjust the weekday/weekend bases in `spendFor` — **not** the test's bounds. The spec fixes the scale; the generator serves it.

- [ ] **Step 6: Commit**

```bash
git add lib/demo/rest-fixtures.ts lib/demo/rest-fixtures.test.ts lib/demo/fixtures/chapter-kosten.ts
git commit -m "feat(demo): time-relative REST fixture for tag activity"
```

---

### Task 2: Wire the REST layer into the client

**Files:**
- Modify: `lib/api/client.ts`
- Test: `lib/demo/rest-fixtures.test.ts` (already covers the routing contract)

**Interfaces:**
- Consumes: `demoRestResponse` from Task 1.
- Produces: `/analytics` receiving data in demo mode.

- [ ] **Step 1: Replace the short-circuit**

In `lib/api/client.ts`, the demo branch currently reads `if (isDemoMode()) return null;`. Change it to consult the fixture table, and extend the existing comment rather than replacing it — the paragraph explaining *why* unmapped REST stays silent is still true and still load-bearing:

```ts
    if (isDemoMode()) return demoRestResponse(path, method);
```

Add above it, continuing the existing comment block:

```ts
    // /analytics is the one demo screen driven by REST rather than GraphQL,
    // so it needs a fixture where the others need silence. demoRestResponse
    // answers that one path and returns null for everything else, which is
    // exactly the behaviour described above.
```

Import `demoRestResponse` from `@/lib/demo/rest-fixtures`.

- [ ] **Step 2: Verify the contract still holds**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS. The "leaves every other path silent" test from Task 1 is what proves the change did not disturb the other callers.

- [ ] **Step 3: Commit**

```bash
git add lib/api/client.ts
git commit -m "feat(demo): let the demo answer one REST path, keep the rest silent"
```

---

### Task 3: Budgets and hydration resolvers

**Files:**
- Modify: `lib/demo/resolvers.ts`
- Test: `lib/demo/resolvers.budgets.test.ts` (create)

**Interfaces:**
- Consumes: `KOSTEN_TEAMS` from Task 1.
- Produces: eleven resolvers — `GetUsersWithBudgets`, `GetRolesWithBudgets`, `GetTeamsWithBudgets`, `GetProjectsWithBudgets`, `GetAgentsWithBudgets`, `GetWorkflowTemplatesWithBudgets`, plus `GetUsersByIds`, `GetTeamsByIds`, `GetProjectsByIds`, `GetRolesByIds`, `GetRoutinesByIds`.

`GetAgentsByIds` already exists — do not add a second one.

- [ ] **Step 1: Write the failing test**

```ts
// lib/demo/resolvers.budgets.test.ts
import { describe, expect, it } from "vitest";
import { DEMO_RESOLVERS } from "./resolvers";
import { KOSTEN_TEAMS } from "./fixtures/chapter-kosten";

const world = { agents: [], contexts: [], items: [], sessions: [] } as never;

describe("budgets resolvers", () => {
  it("returns the same teams the analytics fixture attributes spend to", () => {
    const data = DEMO_RESOLVERS.GetTeamsWithBudgets(world, { page: 1, limit: 25 }) as {
      teamsPagination: { items: Array<{ id: string; name: string; budget: unknown }> };
    };
    expect(data.teamsPagination.items.map((t) => t.name)).toEqual(
      KOSTEN_TEAMS.map((t) => t.name),
    );
  });

  // /budgets renders a table per entity type. An unmapped operation resolves
  // to {data:{}} by design, which renders an empty table rather than an
  // error — so a missing resolver is silent, and that is what this pins.
  it.each([
    "GetUsersWithBudgets",
    "GetRolesWithBudgets",
    "GetTeamsWithBudgets",
    "GetProjectsWithBudgets",
    "GetAgentsWithBudgets",
    "GetWorkflowTemplatesWithBudgets",
  ])("maps %s", (op) => {
    expect(DEMO_RESOLVERS[op], op).toBeDefined();
  });

  it.each([
    "GetUsersByIds",
    "GetTeamsByIds",
    "GetProjectsByIds",
    "GetRolesByIds",
    "GetRoutinesByIds",
    "GetAgentsByIds",
  ])("maps the id-to-name hydration op %s", (op) => {
    expect(DEMO_RESOLVERS[op], op).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/demo/resolvers.budgets.test.ts`
Expected: FAIL — `GetTeamsWithBudgets` is undefined.

- [ ] **Step 3: Add the resolvers**

Add to `DEMO_RESOLVERS` in `lib/demo/resolvers.ts`, importing `KOSTEN_TEAMS` from `./fixtures/chapter-kosten`. Follow the existing `page(count)` pagination helper already in that file.

```ts
  // --- /budgets (chapter 11: what it costs and who controls it) -----------
  //
  // The teams come from fixtures/chapter-kosten.ts, the same source the
  // analytics REST fixture attributes spend to — so the two halves of the
  // chapter cannot disagree about who spent what while a prospect looks at
  // them side by side.
  GetTeamsWithBudgets: () => ({
    teamsPagination: {
      pageInfo: page(KOSTEN_TEAMS.length),
      items: KOSTEN_TEAMS.map((team) => ({
        id: team.id,
        name: team.name,
        budget: { max_budget: team.budget, spend: 0, budget_duration: "30d" },
      })),
    },
  }),
  GetUsersWithBudgets: () => ({ usersPagination: { pageInfo: page(0), items: [] } }),
  GetRolesWithBudgets: () => ({ rolesPagination: { pageInfo: page(0), items: [] } }),
  GetProjectsWithBudgets: () => ({ projectsPagination: { pageInfo: page(0), items: [] } }),
  GetAgentsWithBudgets: () => ({ agentsPagination: { pageInfo: page(0), items: [] } }),
  GetWorkflowTemplatesWithBudgets: () => ({
    workflowTemplatesPagination: { pageInfo: page(0), items: [] },
  }),

  // --- id → name hydration for /analytics' breakdown card -----------------
  //
  // byTag rows carry ids; the breakdown hydrates names via GraphQL. Teams is
  // the only roster with entities, matching KOSTEN_ROSTERS.
  GetTeamsByIds: () => ({ teams: { items: KOSTEN_TEAMS.map((t) => ({ id: t.id, name: t.name })) } }),
  GetUsersByIds: () => ({ users: { items: [] } }),
  GetProjectsByIds: () => ({ projects: { items: [] } }),
  GetRolesByIds: () => ({ roles: { items: [] } }),
  GetRoutinesByIds: () => ({ routines: { items: [] } }),
```

**Before writing these, read the real query documents** to confirm each operation's root field name and selection set — `app/(application)/budgets/queries.ts` re-exports them from `@/queries/queries`, and `app/(application)/analytics/queries.ts` re-exports the `*_BY_IDS` family. The root field names above are the plan's best reading; if a document disagrees, **the document wins** — say so in your report. An operation whose shape does not match its selection set resolves to `data: undefined` through Apollo's cache and renders an empty table with no error.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/demo/resolvers.ts lib/demo/resolvers.budgets.test.ts
git commit -m "feat(demo): budgets and id-hydration resolvers"
```

---

### Task 4: The chapter

**Files:**
- Create: `lib/demo/chapters/kosten.ts`
- Modify: `lib/demo/tour.ts`, `lib/demo/chapters/index.ts`, `lib/demo/supported-routes.ts`, `lib/demo/tour.test.ts`
- Test: `lib/demo/chapters/index.test.ts` (existing suite must pass unchanged)

**Interfaces:**
- Consumes: everything above.
- Produces: `kostenChapter` with id `"kosten"` at position 11.

- [ ] **Step 1: Allow the routes**

In `lib/demo/supported-routes.ts`, add `"/analytics"` and `"/budgets"` to `DEMO_SUPPORTED_ROUTES`, with a brief comment noting chapter 11 uses them. Without this the chapter's own steps render the "nicht in der Demo verfügbar" notice.

- [ ] **Step 2: Add the chapter id**

In `lib/demo/tour.ts`, add `"kosten"` to the `DemoChapterId` union.

- [ ] **Step 3: Write the chapter**

```ts
// lib/demo/chapters/kosten.ts
import type { DemoChapter } from "../tour";

/**
 * Chapter 11 — what it costs, and who controls it.
 *
 * THE ONLY CHAPTER WHOSE NUMBERS ARE INVENTED. Every other chapter shows
 * something that happened: nine real documents with real chunk counts, a
 * real meeting recording, real evals. No spend history was ever captured
 * from the deployment, so these figures are constructed.
 *
 * That is allowed here on one condition, and the condition is load-bearing:
 * the copy says so where a visitor reads it, and tour.test.ts's register of
 * chapters that show something invented asserts the sentence stays. The
 * evals chapter sets the same precedent for its scores.
 *
 * The argument is attribution and control — never savings. A demo that
 * claims "cheaper than a headcount" invites an argument it cannot win and
 * spends the credibility the previous ten chapters built.
 */
export const kostenChapter: DemoChapter = {
  id: "kosten",
  title: "Was es kostet",
  steps: [
    {
      id: "kosten-verbrauch",
      route: "/analytics",
      anchor: null,
      size: "wide",
      title: "Jede Anfrage hat einen Preis — und einen Absender",
      content: [
        {
          kind: "figure",
          src: "/demo/kosten.webp",
          alt: "Verbrauch nach Team",
        },
        {
          kind: "paragraph",
          text: "Verbrauch wird pro Team, Nutzer und Assistent erfasst. Nicht als Summe am Monatsende, sondern laufend und aufgeschlüsselt — Sie sehen, wofür ausgegeben wurde, nicht nur wie viel.",
        },
        {
          kind: "callout",
          tone: "fact",
          text: "Die Zahlen auf diesem Bildschirm sind Beispielwerte, keine Messwerte — anders als die Dokumente und Auswertungen in den vorigen Kapiteln.",
        },
      ],
    },
    {
      id: "kosten-kontrolle",
      route: "/budgets",
      anchor: null,
      title: "Ein Limit ist eine Einstellung, kein Versprechen",
      content: [
        {
          kind: "paragraph",
          text: "Jedes Team bekommt ein monatliches Limit. Ist es erreicht, greift die Grenze im Betrieb — nicht in einer Richtlinie, an die sich jemand erinnern muss.",
        },
        {
          kind: "paragraph",
          text: "Wer wie viel ausgeben darf, entscheiden Sie. Wir behaupten hier keine Einsparung — was die Einführung wert ist, hängt von Ihren Zahlen ab, nicht von unseren.",
        },
      ],
    },
  ],
};
```

- [ ] **Step 4: Register it at position 11**

In `lib/demo/chapters/index.ts`, import `kostenChapter` and put it where the reserved-slot comment sits — between `meetingsChapter` and `contactChapter`. Remove the comment reserving the slot, since the slot is now filled, and update `contactChapter`'s trailing comment: it is chapter 12 now, so the "11 today, 12 once the cost chapter lands" note becomes simply `// 12 · the ask`.

- [ ] **Step 5: Update the order array and the invented-content register**

`lib/demo/tour.test.ts` holds a hardcoded chapter-order array — add `"kosten"` between `"meetings"` and `"contact"`.

It also holds a register of chapters that show something invented, requiring on-screen disclosure. Add `kosten` to it, asserting its copy states the figures are examples. Read the existing register and follow its shape exactly; the point is that deleting the disclosure sentence fails the suite.

- [ ] **Step 6: Placeholder asset**

```bash
cp public/demo/ch5-evals.webp public/demo/kosten.webp
```

Task 5 replaces it. Note it in your report; never describe it as final art in the source.

- [ ] **Step 7: Run tests**

Run: `npx vitest run lib/demo && npx tsc --noEmit && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: PASS. Watch for two in particular — the cross-reference guard (inserting at 11 pushes `contact` to 12, which is exactly the two-digit condition its digit-boundary regex now handles) and the confidentiality check.

- [ ] **Step 8: Commit**

```bash
git add lib/demo public/demo/kosten.webp
git commit -m "feat(demo): chapter 11 — what it costs and who controls it"
```

---

### Task 5: The illustration

**Files:**
- Modify: `scripts/generate-demo-image.py`
- Replace: `public/demo/kosten.webp`

Requires `OPENAI_API_KEY` in the environment, supplied via a file outside the repo that the controller names in your dispatch. Never put the key on a command line, in the repo, or in your report.

- [ ] **Step 1: Add the prompt**

The `STYLE` constant already carries OPEN's collage register and is appended to every prompt automatically. **Describe subject only** — restating colour or style fights `STYLE`. Read the existing `DEMO_PROMPTS` entries for the register.

```python
    # Chapter 11. Attribution, not a total: one flow divided into labelled
    # streams of differing thickness, each ending in its own vessel.
    "kosten": (
        "A single broad stream entering from the left and dividing into three "
        "streams of visibly different widths, each ending in its own open "
        "container of a different size. A horizontal line across each "
        "container marks a fill limit. Flat diagrammatic side view."
    ),
```

- [ ] **Step 2: Generate**

```bash
source "<the env file path from your dispatch>"
python3 scripts/generate-demo-image.py kosten
```

- [ ] **Step 3: Check it before committing**

Open the image and confirm: **no text, lettering, numbers or pseudo-words anywhere** — this model invents labels on containers and gauges, and this prompt describes exactly those objects, so it is the highest-risk image in the set. Also confirm the lime field, flat ink geometry, no gradients or shadows, and that the subject reads as one flow dividing into three limited vessels.

If it fails, report it and say why. Do NOT silently regenerate — name the problem and the controller decides.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run lib/demo && NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build`
Expected: PASS — the figure-existence test proves the chapter still points at a real file.

```bash
git add public/demo/kosten.webp scripts/generate-demo-image.py
git commit -m "feat(demo): illustration for the cost chapter"
```

---

### Task 6: End-to-end walkthrough

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Build and serve**

```bash
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next build
NEXT_PUBLIC_DEMO_MODE=true BACKEND=https://demo.invalid npx next start -p 3111
```

- [ ] **Step 2: The check this whole plan exists for**

Open `http://localhost:3111/analytics?tour=kosten.0`. **The chart must show data.** An empty axis means the fixture's window and the lens's requested window disagree — the exact failure the time-relative generator was built to prevent, and it fails silently because the request succeeds.

Confirm the totals land near €400 for a 30-day range, and that switching the range preset (14d / 30d / 7d) keeps data on screen rather than emptying it.

- [ ] **Step 3: Check `/budgets`**

Open `http://localhost:3111/budgets?tour=kosten.1`. The teams table must list Technik, Service and Vertrieb with their limits. Other entity tables will be empty — that is intended, not a defect.

- [ ] **Step 4: Confirm the disclosure is visible**

On `kosten-verbrauch`, the sentence stating the figures are examples must be legible in the panel — not truncated, not scrolled out of view. This is the chapter's honesty condition and it only counts if a visitor can read it.

- [ ] **Step 5: Console and neighbours**

No `[demo] unmapped GraphQL operation` warnings on either screen. Then step back one chapter and forward one, confirming `meetings → kosten → contact` all render and the Tour bubble reads `11 von 12` and `12 von 12`.

- [ ] **Step 6: Commit any fixes, then report**

```bash
git add -A && git commit -m "fix(demo): <what the walkthrough found>"
```

If the walkthrough is clean, there is nothing to commit — say so rather than inventing a change.

---

## Self-Review

**Spec coverage.** REST fixture layer → Tasks 1 and 2. Time-relativity → Task 1, tested first and directly. Budgets → Task 3. The chapter, its disclosure and the enforcing test → Task 4. Illustration → Task 5. Manual verification of the empty-chart risk → Task 6. Scale (≈€400) → asserted in Task 1's tests. Never claims savings → the copy in Task 4 says so explicitly, and the chapter docblock records why.

**Deliberately not covered:** project 4 (the multi-agent gallery). No product component under `app/(application)/analytics` or `/budgets` is touched.

**Placeholder scan.** The `cp` in Task 4 Step 6 is a deliberate placeholder replaced in Task 5, flagged in the report, and it keeps the figure-existence invariant honest throughout. Task 3 Step 3 tells the implementer to verify root field names against the real query documents rather than trusting the plan — that is an instruction to check, not a gap. No "TBD", no "similar to Task N".

**Type consistency.** `demoRestResponse(path, method)` (Task 1) is consumed by `lib/api/client.ts` (Task 2). `KOSTEN_TEAMS` / `KostenTeam` / `KOSTEN_ROSTERS` (Task 1) are consumed by the resolvers (Task 3). `kostenChapter` (Task 4) is imported by `chapters/index.ts` in the same task. The chapter id `"kosten"` is added to `DemoChapterId` in Task 4 Step 2, before the chapter that uses it is registered in Step 4.
