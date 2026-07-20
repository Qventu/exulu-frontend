# Personal Usage Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user see which models they used recently and how much — a Usage section on `/settings` (range toggle + daily chart + per-model table) fed by a new user-scoped `GET /me/usage` endpoint, deep-linked from the top-bar budget popover.

**Architecture:** Backend gets a new pure/testable module `usage-view.ts` (window resolution, LiteLLM-row projection, orchestrator) plus a thin Express route next to `/me/budget`, gated on the existing `show_user_budget_in_chat` setting (`usage: null` = hidden). Frontend gets `lib/my-usage.ts` (types, URL builder, zero-fill helper, fetch hook mirroring `useTagActivity`), a self-contained `UsageSection` on the settings page, and a "Details" link in the budget popover.

**Tech Stack:** Backend: Express + LiteLLM `/tag/daily/activity`, Jest (ts-jest). Frontend: Next.js 16 App Router, recharts via shadcn `ChartContainer`, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-16-personal-usage-details-design.md` (frontend repo).

## Global Constraints

- Two repos: backend tasks run in `/Users/daniel.claessen/Desktop/Projects/exulu/backend`, frontend tasks in `/Users/daniel.claessen/Desktop/Projects/exulu/frontend`. Commit in the repo you changed.
- Settings page rules (`settings-view.tsx` header comment): sections are `FormSection` + `Separator`, **zero Cards**, the prompt's Save stays the page's only purple/primary element.
- Percent display mode (`display: "percent"`) hides USD **in the UI only** — the payload always carries spend (existing product decision, `top-bar-budget.tsx:49`).
- i18n edits are strictly additive; never touch existing keys. Keys must land in BOTH `messages/en.json` and `messages/de.json`.
- Backend imports use explicit `.ts` extensions (e.g. `from "./activity-client.ts"`) — match this style.
- Frontend known-failing baseline (pre-existing, NOT ours to fix; only NEW failures block): nav-config test, 31 `de` `variables.*` message keys, one `tsc` svg error, entity-types lint.
- Frontend files must be prettier-formatted: run `npx prettier --write <touched files>` before each commit.
- Window clamp: `/me/usage` windows are ≤ 92 days; default is the last 30 days ending today (UTC).

---

### Task 1: Backend — pure helpers `resolveUsageWindow` + `projectMyUsage`

**Files:**
- Create: `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/exulu/litellm/usage-view.ts`
- Test: `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/exulu/litellm/usage-view.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces (Task 2 and 3 rely on these exact names/types):
  - `resolveUsageWindow(startRaw: unknown, endRaw: unknown, now?: Date): UsageWindow | null`
  - `projectMyUsage(raw: any): { totals: UsageMetrics; daily: MyUsageDailyRow[]; byModel: MyUsageModelRow[] }`
  - `MAX_WINDOW_DAYS = 92`
  - Types `UsageWindow`, `UsageMetrics`, `MyUsageDailyRow`, `MyUsageModelRow`, `MyUsageView`

- [ ] **Step 1: Write the failing test**

Create `src/exulu/litellm/usage-view.test.ts`:

```typescript
/**
 * usage-view — pure helpers behind GET /me/usage.
 * resolveUsageWindow / projectMyUsage need no mocks; getMyUsageView (Task 2)
 * mocks budget-service + activity-client at module level (workers.flow
 * pattern).
 */

import {
  MAX_WINDOW_DAYS,
  projectMyUsage,
  resolveUsageWindow,
} from "./usage-view.ts";

const NOW = new Date("2026-07-20T10:00:00.000Z");

describe("resolveUsageWindow", () => {
  it("defaults to the last 30 days ending today (UTC)", () => {
    expect(resolveUsageWindow(undefined, undefined, NOW)).toEqual({
      start_date: "2026-06-21",
      end_date: "2026-07-20",
    });
  });

  it("passes through an explicit YYYY-MM-DD range", () => {
    expect(resolveUsageWindow("2026-07-01", "2026-07-10", NOW)).toEqual({
      start_date: "2026-07-01",
      end_date: "2026-07-10",
    });
  });

  it("accepts ISO datetimes and slices to the date", () => {
    expect(
      resolveUsageWindow(
        "2026-07-01T00:00:00.000Z",
        "2026-07-10T23:59:59.000Z",
        NOW,
      ),
    ).toEqual({ start_date: "2026-07-01", end_date: "2026-07-10" });
  });

  it("defaults only the missing bound", () => {
    expect(resolveUsageWindow("2026-07-01", undefined, NOW)).toEqual({
      start_date: "2026-07-01",
      end_date: "2026-07-20",
    });
  });

  it("returns null for malformed dates", () => {
    expect(resolveUsageWindow("yesterday", undefined, NOW)).toBeNull();
    expect(resolveUsageWindow(undefined, "20-07-2026", NOW)).toBeNull();
    expect(resolveUsageWindow(["2026-07-01"], undefined, NOW)).toBeNull();
  });

  it("returns null when start is after end", () => {
    expect(resolveUsageWindow("2026-07-10", "2026-07-01", NOW)).toBeNull();
  });

  it(`clamps windows longer than ${MAX_WINDOW_DAYS} days to the most recent ${MAX_WINDOW_DAYS}`, () => {
    expect(resolveUsageWindow("2025-01-01", "2026-07-20", NOW)).toEqual({
      start_date: "2026-04-20", // 2026-07-20 minus 91 days
      end_date: "2026-07-20",
    });
  });
});

/** One LiteLLM /tag/daily/activity result row (nested-metrics variant). */
const row = (
  date: string,
  spend: number,
  models: Record<string, number> = {},
) => ({
  date,
  metrics: {
    spend,
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    successful_requests: 2,
    failed_requests: 1,
    api_requests: 3,
  },
  breakdown: {
    models: Object.fromEntries(
      Object.entries(models).map(([name, modelSpend]) => [
        name,
        {
          metrics: {
            spend: modelSpend,
            total_tokens: 10,
            successful_requests: 1,
          },
        },
      ]),
    ),
  },
});

describe("projectMyUsage", () => {
  it("sums totals across rows and sorts daily ascending by date", () => {
    const raw = { results: [row("2026-07-02", 2), row("2026-07-01", 1)] };
    const { totals, daily } = projectMyUsage(raw);
    expect(totals).toEqual({
      spend: 3,
      prompt_tokens: 200,
      completion_tokens: 100,
      total_tokens: 300,
      successful_requests: 4,
      failed_requests: 2,
      api_requests: 6,
    });
    expect(daily.map((d) => d.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(daily[0].spend).toBe(1);
  });

  it("aggregates the model breakdown across days, sorted by spend desc", () => {
    const raw = {
      results: [
        row("2026-07-01", 1, { "gpt-5": 0.25, "claude-fable-5": 0.75 }),
        row("2026-07-02", 2, { "gpt-5": 1.5 }),
      ],
    };
    const { byModel } = projectMyUsage(raw);
    expect(byModel.map((m) => m.model)).toEqual(["gpt-5", "claude-fable-5"]);
    expect(byModel[0]).toEqual({
      model: "gpt-5",
      spend: 1.75,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 20,
      successful_requests: 2,
      failed_requests: 0,
    });
  });

  it("reads flat metrics when the nested `metrics` object is absent", () => {
    const raw = { results: [{ date: "2026-07-01", spend: 5, total_tokens: 7 }] };
    const { totals } = projectMyUsage(raw);
    expect(totals.spend).toBe(5);
    expect(totals.total_tokens).toBe(7);
  });

  it("merges duplicate rows for the same date (per-tag rows)", () => {
    const raw = { results: [row("2026-07-01", 1), row("2026-07-01", 2)] };
    const { daily } = projectMyUsage(raw);
    expect(daily).toHaveLength(1);
    expect(daily[0].spend).toBe(3);
  });

  it("returns zeroed output for empty or malformed raw payloads", () => {
    for (const raw of [{}, null, { results: "nope" }, { results: [{}] }]) {
      const { totals, daily, byModel } = projectMyUsage(raw);
      expect(totals.spend).toBe(0);
      expect(totals.api_requests).toBe(0);
      expect(daily).toEqual([]);
      expect(byModel).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npm test -- src/exulu/litellm/usage-view.test.ts
```

Expected: FAIL — `Cannot find module './usage-view.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/exulu/litellm/usage-view.ts`:

```typescript
/**
 * User-scoped usage view behind `GET /me/usage` — the signed-in user's own
 * LiteLLM daily activity (totals, per-day, per-model), gated on the same
 * `show_user_budget_in_chat` setting as `/me/budget` (null = surface hidden).
 *
 * resolveUsageWindow and projectMyUsage are pure (unit-tested without mocks);
 * getMyUsageView is the thin orchestrator the route calls. Spec:
 * frontend/docs/superpowers/specs/2026-07-16-personal-usage-details-design.md
 */

import { budgetTagFor } from "../tags.ts";
import { getTagDailyActivity } from "./activity-client.ts";
import { getBudgetSettings, type UserBudgetDisplay } from "./budget-service.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Longest selectable window; longer requests are clamped, not rejected. */
export const MAX_WINDOW_DAYS = 92;
const DEFAULT_WINDOW_DAYS = 30;

export type UsageWindow = { start_date: string; end_date: string };

export type UsageMetrics = {
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
};

export type MyUsageDailyRow = UsageMetrics & { date: string };

export type MyUsageModelRow = {
  model: string;
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
};

export type MyUsageView = {
  window: UsageWindow;
  display: UserBudgetDisplay;
  totals: UsageMetrics;
  daily: MyUsageDailyRow[];
  byModel: MyUsageModelRow[];
};

/** undefined = not provided (use default); null = malformed (400). */
const parseDateParam = (raw: unknown): string | null | undefined => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  if (DATE_ONLY_RE.test(raw)) return raw;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const ymdShift = (ymd: string, days: number): string =>
  new Date(Date.parse(ymd) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Resolve raw query params into a concrete YYYY-MM-DD window: defaults to the
 * last DEFAULT_WINDOW_DAYS ending today (UTC), clamps to MAX_WINDOW_DAYS.
 * Returns null on malformed input or start > end (route answers 400).
 */
export function resolveUsageWindow(
  startRaw: unknown,
  endRaw: unknown,
  now: Date = new Date(),
): UsageWindow | null {
  const start = parseDateParam(startRaw);
  const end = parseDateParam(endRaw);
  if (start === null || end === null) return null;

  const end_date = end ?? now.toISOString().slice(0, 10);
  let start_date = start ?? ymdShift(end_date, -(DEFAULT_WINDOW_DAYS - 1));
  if (start_date > end_date) return null;

  const days =
    Math.round((Date.parse(end_date) - Date.parse(start_date)) / DAY_MS) + 1;
  if (days > MAX_WINDOW_DAYS) {
    start_date = ymdShift(end_date, -(MAX_WINDOW_DAYS - 1));
  }
  return { start_date, end_date };
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const zeroMetrics = (): UsageMetrics => ({
  spend: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  successful_requests: 0,
  failed_requests: 0,
  api_requests: 0,
});

/** LiteLLM rows carry metrics nested (`row.metrics.spend`) or flat depending
 *  on proxy version — read nested first, fall back to flat, zero-fill. */
const readMetrics = (source: any): UsageMetrics => {
  const m = source?.metrics ?? {};
  return {
    spend: num(m.spend ?? source?.spend),
    prompt_tokens: num(m.prompt_tokens ?? source?.prompt_tokens),
    completion_tokens: num(m.completion_tokens ?? source?.completion_tokens),
    total_tokens: num(m.total_tokens ?? source?.total_tokens),
    successful_requests: num(
      m.successful_requests ?? source?.successful_requests,
    ),
    failed_requests: num(m.failed_requests ?? source?.failed_requests),
    api_requests: num(m.api_requests ?? source?.api_requests),
  };
};

const addMetrics = (into: UsageMetrics, add: UsageMetrics): void => {
  into.spend += add.spend;
  into.prompt_tokens += add.prompt_tokens;
  into.completion_tokens += add.completion_tokens;
  into.total_tokens += add.total_tokens;
  into.successful_requests += add.successful_requests;
  into.failed_requests += add.failed_requests;
  into.api_requests += add.api_requests;
};

/**
 * Project raw /tag/daily/activity JSON (single-tag call) into totals + daily
 * + byModel. Tolerant like projectTagActivity in routes.ts: unknown shapes
 * zero-fill rather than throw.
 */
export function projectMyUsage(raw: any): {
  totals: UsageMetrics;
  daily: MyUsageDailyRow[];
  byModel: MyUsageModelRow[];
} {
  const results: any[] = Array.isArray(raw?.results)
    ? raw.results
    : Array.isArray(raw)
      ? raw
      : [];

  const totals = zeroMetrics();
  const byDate = new Map<string, UsageMetrics>();
  const byModelMap = new Map<string, UsageMetrics>();

  for (const result of results) {
    const date = typeof result?.date === "string" ? result.date : null;
    if (!date) continue;

    const metrics = readMetrics(result);
    addMetrics(totals, metrics);

    const day = byDate.get(date) ?? zeroMetrics();
    addMetrics(day, metrics);
    byDate.set(date, day);

    const models =
      result?.breakdown && typeof result.breakdown.models === "object"
        ? result.breakdown.models
        : {};
    for (const [model, entry] of Object.entries(models ?? {})) {
      const acc = byModelMap.get(model) ?? zeroMetrics();
      addMetrics(acc, readMetrics(entry));
      byModelMap.set(model, acc);
    }
  }

  const daily: MyUsageDailyRow[] = [...byDate.entries()]
    .map(([date, m]) => ({ date, ...m }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byModel: MyUsageModelRow[] = [...byModelMap.entries()]
    .map(([model, m]) => ({
      model,
      spend: m.spend,
      prompt_tokens: m.prompt_tokens,
      completion_tokens: m.completion_tokens,
      total_tokens: m.total_tokens,
      successful_requests: m.successful_requests,
      failed_requests: m.failed_requests,
    }))
    .sort((a, b) => b.spend - a.spend);

  return { totals, daily, byModel };
}
```

(`getMyUsageView` is added in Task 2 — do not write it yet.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npm test -- src/exulu/litellm/usage-view.test.ts
```

Expected: PASS (all `resolveUsageWindow` and `projectMyUsage` tests green).

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend
git add src/exulu/litellm/usage-view.ts src/exulu/litellm/usage-view.test.ts
git commit -m "feat(usage): pure window/projection helpers for user-scoped usage view"
```

---

### Task 2: Backend — `getMyUsageView` orchestrator

**Files:**
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/exulu/litellm/usage-view.ts` (append)
- Test: `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/exulu/litellm/usage-view.test.ts` (append)

**Interfaces:**
- Consumes: `projectMyUsage`, types from Task 1; `getBudgetSettings()` (returns `{ show_user_budget_in_chat: boolean; user_budget_display: "amount" | "percent"; global_user_budget: {...} }`), `budgetTagFor("user", id)` → `"user_id_<id>"`, `getTagDailyActivity({ startDate, endDate, tags, page, pageSize })`.
- Produces (Task 3 relies on): `getMyUsageView(userId: number | string, window: UsageWindow): Promise<MyUsageView | null>` — null = hidden (setting off / no tag). LiteLLM errors propagate (`LiteLLMAdminError` thrown by `getTagDailyActivity`).

- [ ] **Step 1: Write the failing test**

Append to `src/exulu/litellm/usage-view.test.ts` — module mocks MUST be added at the very top of the file (before the existing imports; Jest hoists them, but keep them physically first for readability):

```typescript
jest.mock("./budget-service.ts", () => ({
  getBudgetSettings: jest.fn(),
}));
jest.mock("./activity-client.ts", () => ({
  getTagDailyActivity: jest.fn(),
}));
```

Update the import block at the top to also pull the mocked modules and `getMyUsageView`:

```typescript
import { getTagDailyActivity } from "./activity-client.ts";
import { getBudgetSettings } from "./budget-service.ts";
import {
  MAX_WINDOW_DAYS,
  getMyUsageView,
  projectMyUsage,
  resolveUsageWindow,
} from "./usage-view.ts";

const mockSettings = getBudgetSettings as jest.Mock;
const mockActivity = getTagDailyActivity as jest.Mock;

afterEach(() => jest.clearAllMocks());
```

Append the describe block:

```typescript
describe("getMyUsageView", () => {
  const WINDOW = { start_date: "2026-06-21", end_date: "2026-07-20" };

  it("returns null without calling LiteLLM when show_user_budget_in_chat is off", async () => {
    mockSettings.mockResolvedValue({
      show_user_budget_in_chat: false,
      user_budget_display: "amount",
      global_user_budget: { enabled: false, max_budget: 0, budget_duration: "30d" },
    });

    await expect(getMyUsageView(7, WINDOW)).resolves.toBeNull();
    expect(mockActivity).not.toHaveBeenCalled();
  });

  it("fetches the caller's own tag and returns the projected view with display", async () => {
    mockSettings.mockResolvedValue({
      show_user_budget_in_chat: true,
      user_budget_display: "percent",
      global_user_budget: { enabled: true, max_budget: 10, budget_duration: "30d" },
    });
    mockActivity.mockResolvedValue({
      results: [
        {
          date: "2026-07-01",
          metrics: {
            spend: 2,
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            successful_requests: 1,
            failed_requests: 0,
            api_requests: 1,
          },
          breakdown: { models: { "gpt-5": { metrics: { spend: 2 } } } },
        },
      ],
    });

    const view = await getMyUsageView(7, WINDOW);

    expect(mockActivity).toHaveBeenCalledWith({
      startDate: "2026-06-21",
      endDate: "2026-07-20",
      tags: ["user_id_7"],
      page: 1,
      pageSize: expect.any(Number),
    });
    expect(view).not.toBeNull();
    expect(view?.display).toBe("percent");
    expect(view?.window).toEqual(WINDOW);
    expect(view?.totals.spend).toBe(2);
    expect(view?.byModel[0]?.model).toBe("gpt-5");
  });

  it("propagates LiteLLM client errors (route maps them to 502)", async () => {
    mockSettings.mockResolvedValue({
      show_user_budget_in_chat: true,
      user_budget_display: "amount",
      global_user_budget: { enabled: true, max_budget: 10, budget_duration: "30d" },
    });
    mockActivity.mockRejectedValue(new Error("boom"));

    await expect(getMyUsageView(7, WINDOW)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npm test -- src/exulu/litellm/usage-view.test.ts
```

Expected: FAIL — `getMyUsageView` is not exported. Task 1's pure tests must still PASS (they use the real functions; the mocks only replace budget-service/activity-client, which the pure functions never touch).

- [ ] **Step 3: Write the implementation**

Append to `src/exulu/litellm/usage-view.ts`:

```typescript
/**
 * The caller's own usage view, or null when the admin keeps spend data
 * hidden from users (same gate as getUserBudgetView). Per the existing
 * product decision, "percent" display mode is UI-only — the payload always
 * carries spend; callers decide what to render.
 */
export async function getMyUsageView(
  userId: number | string,
  window: UsageWindow,
): Promise<MyUsageView | null> {
  const settings = await getBudgetSettings();
  if (!settings.show_user_budget_in_chat) return null;

  const tag = budgetTagFor("user", userId);
  if (!tag) return null;

  // One tag → one row per day; +100 headroom mirrors the tag-activity route.
  const daysInRange =
    Math.round(
      (Date.parse(window.end_date) - Date.parse(window.start_date)) / DAY_MS,
    ) + 1;

  const raw = await getTagDailyActivity({
    startDate: window.start_date,
    endDate: window.end_date,
    tags: [tag],
    page: 1,
    pageSize: Math.min(daysInRange + 100, 10_000),
  });

  const { totals, daily, byModel } = projectMyUsage(raw);
  return {
    window,
    display: settings.user_budget_display,
    totals,
    daily,
    byModel,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npm test -- src/exulu/litellm/usage-view.test.ts
```

Expected: PASS (all describes green).

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend
git add src/exulu/litellm/usage-view.ts src/exulu/litellm/usage-view.test.ts
git commit -m "feat(usage): getMyUsageView — gated, user-scoped LiteLLM activity"
```

---

### Task 3: Backend — `GET /me/usage` route

**Files:**
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/backend/src/exulu/routes.ts` (import block + one route, placed directly after the existing `app.get("/me/budget", ...)` handler)

**Interfaces:**
- Consumes: `getMyUsageView`, `resolveUsageWindow` (Task 2/1); existing `requestValidators.authenticate` and `LiteLLMAdminError` (already imported in routes.ts).
- Produces: `GET /me/usage?start_date&end_date` → `200 {"usage": MyUsageView | null}` | `400 {"detail"}` | `401 {"detail"}` | `502 {"detail"}` (LiteLLM) | `500 {"detail"}`. This is the contract the frontend (Task 4) builds against.

- [ ] **Step 1: Add the import**

In the import block of `src/exulu/routes.ts`, next to the existing `./litellm/budget-service.ts` import, add:

```typescript
import { getMyUsageView, resolveUsageWindow } from "./litellm/usage-view.ts";
```

- [ ] **Step 2: Add the route**

Directly after the `app.get("/me/budget", ...)` handler (search for `"/me/budget"`), insert:

```typescript
  /**
   * The caller's own usage detail (daily + per-model) for the /settings Usage
   * section. Same visibility gate as /me/budget: `usage: null` when the
   * "show budget status in chat" setting is off. Spec:
   * frontend/docs/superpowers/specs/2026-07-16-personal-usage-details-design.md
   */
  app.get("/me/usage", async (req: Request, res: Response) => {
    const authResult = await requestValidators.authenticate(req);
    if (!authResult.user?.id) {
      res.status(authResult.code ?? 401).json({ detail: authResult.message });
      return;
    }

    const window = resolveUsageWindow(req.query.start_date, req.query.end_date);
    if (!window) {
      res.status(400).json({
        detail:
          "start_date and end_date must be YYYY-MM-DD or ISO datetimes, with start_date <= end_date.",
      });
      return;
    }

    try {
      res
        .status(200)
        .json({ usage: await getMyUsageView(authResult.user.id, window) });
    } catch (err) {
      if (err instanceof LiteLLMAdminError) {
        res.status(502).json({ detail: err.message });
        return;
      }
      console.error("[EXULU] /me/usage failed", err);
      res.status(500).json({
        detail: err instanceof Error ? err.message : "Usage query failed.",
      });
    }
  });
```

- [ ] **Step 3: Verify type-check, lint, and full test suite**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npm run type-check && npm run lint && npm test
```

Expected: all pass with no NEW failures (compare against a pre-change run if anything fails — only new failures block).

- [ ] **Step 4: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend
git add src/exulu/routes.ts
git commit -m "feat(usage): GET /me/usage — user-scoped model/day usage endpoint"
```

---

### Task 4: Frontend — `lib/my-usage.ts` data layer

**Files:**
- Create: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/lib/my-usage.ts`
- Test: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/lib/my-usage.test.ts`

**Interfaces:**
- Consumes: `request(path, method)` from `@/lib/api/client` (attaches Bearer token, throws Error with backend `detail` on non-2xx).
- Produces (Task 6 relies on these exact names/types):
  - Types `MyUsage`, `MyUsageResponse { usage: MyUsage | null }`, `MyUsageQuery { start_date: string; end_date: string }`, `MyUsageTotals`, `MyUsageDailyRow`, `MyUsageModelRow`
  - `buildMyUsagePath(query: MyUsageQuery): string`
  - `chartMetricFor(display: "amount" | "percent"): "spend" | "total_tokens"`
  - `fillDailySeries(daily: MyUsageDailyRow[], window: { start_date: string; end_date: string }): MyUsageDailyRow[]`
  - `useMyUsage(query: MyUsageQuery | null, skip?: boolean): { data: MyUsageResponse | null; loading: boolean; error: Error | null; refetch: () => void }`

- [ ] **Step 1: Write the failing test**

Create `lib/my-usage.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  buildMyUsagePath,
  chartMetricFor,
  fillDailySeries,
  type MyUsageDailyRow,
} from "./my-usage";

const day = (date: string, spend: number): MyUsageDailyRow => ({
  date,
  spend,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 100,
  successful_requests: 1,
  failed_requests: 0,
  api_requests: 1,
});

describe("buildMyUsagePath", () => {
  it("passes YYYY-MM-DD through", () => {
    expect(
      buildMyUsagePath({ start_date: "2026-07-01", end_date: "2026-07-20" }),
    ).toBe("/me/usage?start_date=2026-07-01&end_date=2026-07-20");
  });

  it("slices ISO datetimes to the date part", () => {
    expect(
      buildMyUsagePath({
        start_date: "2026-07-01T00:00:00.000Z",
        end_date: "2026-07-20T23:59:59.000Z",
      }),
    ).toBe("/me/usage?start_date=2026-07-01&end_date=2026-07-20");
  });
});

describe("chartMetricFor", () => {
  it("charts spend in amount mode and tokens in percent mode", () => {
    expect(chartMetricFor("amount")).toBe("spend");
    expect(chartMetricFor("percent")).toBe("total_tokens");
  });
});

describe("fillDailySeries", () => {
  it("zero-fills missing days across the window, keeping real rows", () => {
    const filled = fillDailySeries([day("2026-07-02", 5)], {
      start_date: "2026-07-01",
      end_date: "2026-07-03",
    });
    expect(filled.map((r) => r.date)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
    expect(filled.map((r) => r.spend)).toEqual([0, 5, 0]);
  });

  it("returns the rows sorted as-is when the window is unparsable", () => {
    const rows = [day("2026-07-02", 2), day("2026-07-01", 1)];
    const filled = fillDailySeries(rows, {
      start_date: "nope",
      end_date: "2026-07-03",
    });
    expect(filled.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx vitest run lib/my-usage.test.ts
```

Expected: FAIL — `Failed to resolve import "./my-usage"`.

- [ ] **Step 3: Write the implementation**

Create `lib/my-usage.ts`:

```typescript
/**
 * The signed-in user's own usage (`GET /me/usage`) — daily totals and a
 * per-model breakdown for the /settings Usage section. Mirrors
 * lib/litellm-activity.ts: response types + a URL builder + a small fetch
 * hook over `request`. The backend gates the payload on the same "show
 * budget status in chat" setting as /me/budget — `usage: null` means the
 * surface stays hidden entirely (the section renders nothing).
 */

import * as React from "react";

import { request } from "@/lib/api/client";

export interface MyUsageTotals {
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
}

export interface MyUsageDailyRow extends MyUsageTotals {
  date: string; // YYYY-MM-DD
}

export interface MyUsageModelRow {
  model: string;
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
}

export interface MyUsage {
  window: { start_date: string; end_date: string };
  /** "percent" → the UI hides all USD figures (same rule as the top bar). */
  display: "amount" | "percent";
  totals: MyUsageTotals;
  daily: MyUsageDailyRow[];
  byModel: MyUsageModelRow[];
}

export interface MyUsageResponse {
  usage: MyUsage | null;
}

export interface MyUsageQuery {
  start_date: string; // YYYY-MM-DD or ISO datetime
  end_date: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildMyUsagePath(query: MyUsageQuery): string {
  const params = new URLSearchParams();
  params.set("start_date", query.start_date.slice(0, 10));
  params.set("end_date", query.end_date.slice(0, 10));
  return `/me/usage?${params.toString()}`;
}

/** Chart metric per display mode — percent mode never charts USD. */
export function chartMetricFor(
  display: MyUsage["display"],
): "spend" | "total_tokens" {
  return display === "percent" ? "total_tokens" : "spend";
}

const zeroDay = (date: string): MyUsageDailyRow => ({
  date,
  spend: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  successful_requests: 0,
  failed_requests: 0,
  api_requests: 0,
});

/**
 * Zero-fill the sparse `daily` rows across the whole window so the chart's
 * time axis is honest — LiteLLM only returns days that saw traffic, and 3
 * active days in a 30-day window would otherwise render as 3 adjacent points.
 */
export function fillDailySeries(
  daily: MyUsageDailyRow[],
  window: { start_date: string; end_date: string },
): MyUsageDailyRow[] {
  const start = Date.parse(window.start_date);
  const end = Date.parse(window.end_date);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [...daily].sort((a, b) => a.date.localeCompare(b.date));
  }
  const byDate = new Map(daily.map((row) => [row.date, row]));
  const out: MyUsageDailyRow[] = [];
  for (let ts = start; ts <= end; ts += DAY_MS) {
    const date = new Date(ts).toISOString().slice(0, 10);
    out.push(byDate.get(date) ?? zeroDay(date));
  }
  return out;
}

export interface UseMyUsageResult {
  data: MyUsageResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch /me/usage for the given window. The query object MUST be
 * referentially stable (memoise it on the selected range) so the hook
 * doesn't refire every render. `skip` mirrors Apollo's option.
 */
export function useMyUsage(
  query: MyUsageQuery | null,
  skip = false,
): UseMyUsageResult {
  const [data, setData] = React.useState<MyUsageResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  const path = React.useMemo(
    () => (query ? buildMyUsagePath(query) : null),
    [query],
  );

  React.useEffect(() => {
    if (skip || !path) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const json = (await request(path, "GET")) as MyUsageResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, skip, tick]);

  const refetch = React.useCallback(() => setTick((n) => n + 1), []);

  return { data, loading, error, refetch };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx vitest run lib/my-usage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
npx prettier --write lib/my-usage.ts lib/my-usage.test.ts
git add lib/my-usage.ts lib/my-usage.test.ts
git commit -m "feat(usage): my-usage data layer — types, path builder, zero-fill, hook"
```

---

### Task 5: Frontend — i18n keys (en + de)

**Files:**
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/messages/en.json`
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/messages/de.json`

**Interfaces:**
- Produces: message keys `settings.usage.*` and `budgets.bar.details` consumed by Tasks 6 and 7. Key names below are canonical — components must use exactly these.

**IMPORTANT:** Edits are strictly additive. Before starting, run `git status --short messages/` — if the files show pre-existing modifications, STOP and ask the user how to handle them (do not sweep unrelated hunks into the commit).

- [ ] **Step 1: Add the `settings.usage` block to en.json**

In `messages/en.json`, inside the `"settings"` object, after the closing brace of the `"prompt"` object (add a comma to it), insert:

```json
"usage": {
  "colFailed": "Failed",
  "colModel": "Model",
  "colRequests": "Requests",
  "colSpend": "Spend",
  "colTokens": "Tokens",
  "description": "Which models you used recently and how much.",
  "empty": "No usage in this period.",
  "error": "Couldn't load your usage.",
  "range7": "7 days",
  "range30": "30 days",
  "range90": "90 days",
  "rangeLabel": "Time range",
  "retry": "Retry",
  "title": "Usage",
  "totalRequests": "Requests",
  "totalSpend": "Spend",
  "totalTokens": "Tokens"
}
```

- [ ] **Step 2: Add the `settings.usage` block to de.json**

Same position in `messages/de.json` (inside `"settings"`, after `"prompt"`):

```json
"usage": {
  "colFailed": "Fehlgeschlagen",
  "colModel": "Modell",
  "colRequests": "Anfragen",
  "colSpend": "Ausgaben",
  "colTokens": "Tokens",
  "description": "Welche Modelle Sie zuletzt genutzt haben und wie viel.",
  "empty": "Keine Nutzung in diesem Zeitraum.",
  "error": "Ihre Nutzungsdaten konnten nicht geladen werden.",
  "range7": "7 Tage",
  "range30": "30 Tage",
  "range90": "90 Tage",
  "rangeLabel": "Zeitraum",
  "retry": "Erneut versuchen",
  "title": "Nutzung",
  "totalRequests": "Anfragen",
  "totalSpend": "Ausgaben",
  "totalTokens": "Tokens"
}
```

- [ ] **Step 3: Add `budgets.bar.details` to both files**

In `messages/en.json`, inside `"budgets"` → `"bar"`, next to the existing `"detailsAria"` key, add:

```json
"details": "Details",
```

In `messages/de.json`, same position:

```json
"details": "Details",
```

- [ ] **Step 4: Verify message parity**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm run check-messages
```

Expected: only the KNOWN baseline failures (31 `de` `variables.*` keys). Zero new missing-key reports — in particular nothing under `settings.usage` or `budgets.bar`.

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
git add messages/en.json messages/de.json
git commit -m "feat(usage): i18n keys for settings usage section and budget details link"
```

---

### Task 6: Frontend — `UsageSection` on /settings

**Files:**
- Create: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/app/(application)/settings/components/usage-section.tsx`
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/app/(application)/settings/components/settings-view.tsx` (one import + one JSX line)

**Interfaces:**
- Consumes: everything from `@/lib/my-usage` (Task 4), `settings.usage.*` keys (Task 5), `FormSection` (`title`, `description`, spreads `id`/`className` onto `<section>`), `formatUsd` from `@/lib/budget`, shadcn `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartConfig`, `Table*`, `ToggleGroup*`, `Skeleton`, `Separator`, `Button`, recharts `AreaChart`/`Area`/`XAxis`/`YAxis`/`CartesianGrid`.
- Produces: `<UsageSection />` — self-contained (brings its own leading `Separator`, renders `null` when the backend hides usage). The `<section id="usage">` anchor is what Task 7 links to.

- [ ] **Step 1: Create the component**

Create `app/(application)/settings/components/usage-section.tsx`:

```tsx
"use client";

/**
 * /settings § Usage — the signed-in user's own model usage (spec
 * docs/superpowers/specs/2026-07-16-personal-usage-details-design.md):
 * 7/30/90-day range toggle, daily area chart, per-model table over
 * GET /me/usage. Self-contained: brings its own leading Separator and
 * renders NOTHING when the backend returns usage: null (admin "show budget
 * status in chat" off), so settings-view stays a flat section list.
 *
 * Page rules respected: FormSection + Separator, zero Cards, no new purple
 * elements. Percent display mode hides every USD figure (UI-only — same
 * product decision as the top-bar chip, top-bar-budget.tsx).
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { FormSection } from "@/components/primitives/form-section";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatUsd } from "@/lib/budget";
import {
  chartMetricFor,
  fillDailySeries,
  useMyUsage,
  type MyUsage,
  type MyUsageQuery,
} from "@/lib/my-usage";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { value: "7", days: 7, i18nKey: "usage.range7" },
  { value: "30", days: 30, i18nKey: "usage.range30" },
  { value: "90", days: 90, i18nKey: "usage.range90" },
] as const;

type RangeValue = (typeof RANGES)[number]["value"];

const formatCount = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function UsageSection() {
  const t = useTranslations("settings");
  const [range, setRange] = React.useState<RangeValue>("30");

  const query = React.useMemo<MyUsageQuery>(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? 30;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * DAY_MS);
    return { start_date: start.toISOString(), end_date: end.toISOString() };
  }, [range]);

  const { data, loading, error, refetch } = useMyUsage(query);
  const usage = data?.usage ?? null;

  // usage: null — the admin keeps spend data hidden from users; the whole
  // section (separator included) disappears.
  if (data && !usage) return null;

  const percentMode = usage?.display === "percent";
  const empty =
    usage != null &&
    usage.totals.api_requests === 0 &&
    usage.totals.total_tokens === 0;

  return (
    <>
      <Separator />
      <FormSection
        id="usage"
        className="scroll-mt-24"
        title={t("usage.title")}
        description={t("usage.description")}
      >
        <ToggleGroup
          type="single"
          value={range}
          // Radix emits "" when the active item is clicked again — never deselect.
          onValueChange={(next) => {
            if (next) setRange(next as RangeValue);
          }}
          aria-label={t("usage.rangeLabel")}
          className="grid w-full grid-cols-3 gap-2 rounded-lg bg-muted p-1 sm:inline-grid sm:w-auto sm:grid-cols-[repeat(3,minmax(6rem,1fr))] md:gap-1"
        >
          {RANGES.map(({ value, i18nKey }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className={cn(
                "h-11 min-w-0 rounded-md px-3 text-sm md:h-8",
                "text-muted-foreground hover:bg-transparent hover:text-foreground",
                "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              )}
            >
              {t(i18nKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {error ? (
          <UsageError onRetry={refetch} />
        ) : loading || !usage ? (
          <UsageSkeleton />
        ) : (
          <>
            <TotalsRow usage={usage} percentMode={percentMode} />
            {empty ? (
              <p className="text-sm text-muted-foreground">
                {t("usage.empty")}
              </p>
            ) : (
              <>
                <UsageChart usage={usage} percentMode={percentMode} />
                <ModelTable usage={usage} percentMode={percentMode} />
              </>
            )}
          </>
        )}
      </FormSection>
    </>
  );
}

function UsageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function UsageError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{t("usage.error")}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("usage.retry")}
      </Button>
    </div>
  );
}

function TotalsRow({
  usage,
  percentMode,
}: {
  usage: MyUsage;
  percentMode: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {!percentMode ? (
        <div>
          <dt className="text-muted-foreground">{t("usage.totalSpend")}</dt>
          <dd className="font-mono tabular-nums">
            {formatUsd(usage.totals.spend)}
          </dd>
        </div>
      ) : null}
      <div>
        <dt className="text-muted-foreground">{t("usage.totalTokens")}</dt>
        <dd className="font-mono tabular-nums">
          {formatCount(usage.totals.total_tokens)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("usage.totalRequests")}</dt>
        <dd className="font-mono tabular-nums">
          {formatCount(usage.totals.api_requests)}
        </dd>
      </div>
    </dl>
  );
}

const chartConfig: ChartConfig = {
  value: { label: "Value", color: "hsl(var(--chart-1))" },
};

function UsageChart({
  usage,
  percentMode,
}: {
  usage: MyUsage;
  percentMode: boolean;
}) {
  const t = useTranslations("settings");
  const metric = chartMetricFor(usage.display);
  const rows = React.useMemo(
    () =>
      fillDailySeries(usage.daily, usage.window).map((row) => ({
        date: row.date,
        value: row[metric],
      })),
    [usage, metric],
  );
  const formatValue = (v: number) =>
    percentMode ? formatCount(v) : formatUsd(v);

  return (
    <ChartContainer config={chartConfig} className="h-40 w-full">
      <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="settingsUsageFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="hsl(var(--chart-1))"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--chart-1))"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          tickMargin={6}
          fontSize={12}
          tickFormatter={(d: string) =>
            new Date(d).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={56}
          tickFormatter={(v: number) => formatValue(v)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              nameKey="value"
              formatter={(value) => [
                typeof value === "number" ? formatValue(value) : String(value),
                ` ${percentMode ? t("usage.colTokens") : t("usage.colSpend")}`,
              ]}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#settingsUsageFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function ModelTable({
  usage,
  percentMode,
}: {
  usage: MyUsage;
  percentMode: boolean;
}) {
  const t = useTranslations("settings");
  const showFailed = usage.byModel.some((m) => m.failed_requests > 0);
  // Backend sorts by spend; percent mode re-ranks by the visible metric.
  const rows = percentMode
    ? [...usage.byModel].sort((a, b) => b.total_tokens - a.total_tokens)
    : usage.byModel;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("usage.colModel")}</TableHead>
          <TableHead className="text-right">{t("usage.colRequests")}</TableHead>
          {showFailed ? (
            <TableHead className="text-right">{t("usage.colFailed")}</TableHead>
          ) : null}
          <TableHead className="text-right">{t("usage.colTokens")}</TableHead>
          {!percentMode ? (
            <TableHead className="text-right">{t("usage.colSpend")}</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.model}>
            <TableCell className="max-w-64 truncate font-mono text-xs">
              {m.model}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCount(m.successful_requests + m.failed_requests)}
            </TableCell>
            {showFailed ? (
              <TableCell className="text-right font-mono tabular-nums">
                {formatCount(m.failed_requests)}
              </TableCell>
            ) : null}
            <TableCell className="text-right font-mono tabular-nums">
              {formatCount(m.total_tokens)}
            </TableCell>
            {!percentMode ? (
              <TableCell className="text-right font-mono tabular-nums">
                {formatUsd(m.spend)}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Wire it into settings-view.tsx**

In `app/(application)/settings/components/settings-view.tsx`:

Add to the local imports (next to the `usePersonalSystemPrompt` import):

```typescript
import { UsageSection } from "./usage-section";
```

In the JSX, after the Account `FormSection`'s closing tag (`</FormSection>` of the section containing `<AccountRows user={user} />`) and before the closing `</div>`, add (NO extra `Separator` — the component brings its own):

```tsx
        <UsageSection />
```

- [ ] **Step 3: Verify tests, lint, typecheck**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm test && npm run lint && npx tsc --noEmit
```

Expected: no NEW failures. Baseline (allowed): nav-config test failure, entity-types lint, one pre-existing `tsc` svg error.

- [ ] **Step 4: Format and commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
npx prettier --write "app/(application)/settings/components/usage-section.tsx" "app/(application)/settings/components/settings-view.tsx"
git add "app/(application)/settings/components/usage-section.tsx" "app/(application)/settings/components/settings-view.tsx"
git commit -m "feat(settings): personal Usage section — range toggle, daily chart, per-model table"
```

---

### Task 7: Frontend — "Details" link in the top-bar budget popover

**Files:**
- Modify: `/Users/daniel.claessen/Desktop/Projects/exulu/frontend/components/shell/top-bar-budget.tsx`

**Interfaces:**
- Consumes: `budgets.bar.details` key (Task 5); the `/settings#usage` anchor (Task 6).
- Produces: navigation entry point for users with a visible budget chip.

- [ ] **Step 1: Make the Popover controlled and add the link row**

In `components/shell/top-bar-budget.tsx`:

Add imports:

```typescript
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
```

Inside `TopBarBudget`, after the `const t = useTranslations("budgets");` line, add state (the popover must close on navigation — Radix keeps it open because the trigger persists in the top bar across client-side route changes):

```typescript
  const [open, setOpen] = React.useState(false);
```

Change the Popover opening tag from `<Popover>` to:

```tsx
    <Popover open={open} onOpenChange={setOpen}>
```

Inside `PopoverContent`, after the `budget.budget_reset_at` paragraph (the last child), add:

```tsx
        <div className="pt-1">
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0 text-xs"
            onClick={() => setOpen(false)}
          >
            <Link href="/settings#usage">
              {t("bar.details")}
              <ChevronRight aria-hidden="true" className="size-3" />
            </Link>
          </Button>
        </div>
```

Also update the component's header JSDoc (lines 3–15) by appending one sentence: `The popover footer links to /settings#usage for the detailed per-model usage view.`

- [ ] **Step 2: Verify lint and typecheck**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm run lint && npx tsc --noEmit
```

Expected: no NEW failures (baseline allowed: entity-types lint, svg tsc error).

- [ ] **Step 3: Format and commit**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend
npx prettier --write components/shell/top-bar-budget.tsx
git add components/shell/top-bar-budget.tsx
git commit -m "feat(usage): Details link from top-bar budget popover to settings usage"
```

---

### Task 8: Final verification (both repos + manual smoke test)

**Files:** none (verification only).

- [ ] **Step 1: Backend full validation**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/backend && npm run type-check && npm run lint && npm test
```

Expected: green (no NEW failures vs. the pre-task-1 state).

- [ ] **Step 2: Frontend full validation**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npm test && npm run lint && npx tsc --noEmit && npm run check-messages && npm run prettier
```

Expected: only the 4 known baseline failures (nav-config test, entity-types lint, svg tsc, 31 `de` `variables.*` keys). `npm run prettier` clean for our files.

- [ ] **Step 3: Manual smoke test (requires running backend + LiteLLM)**

Start the frontend dev server and verify in the browser:
1. As a user with `show_user_budget_in_chat` ON: `/settings` shows the Usage section; the range toggle refetches; chart + table render; the top-bar budget chip's popover shows "Details" and clicking it navigates to `/settings` scrolled to the section with the popover closed.
2. Flip the admin setting OFF: `/settings` shows no Usage section (and no dangling separator).
3. If a percent-display user is available: no USD figures anywhere in the section (tokens chart, no Spend column, no Spend total).

If the environment isn't available, note it in the completion report instead of claiming verification.

- [ ] **Step 4: Report**

Summarize: endpoint contract, files touched in each repo, test results, any deviations from this plan.
