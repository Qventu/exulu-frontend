# Personal usage details — design

**Date:** 2026-07-16
**Status:** Approved
**Scope:** frontend + backend (new user-scoped endpoint)

## Problem

A user asked: *"kann man irgendwo sehen, welche Modelle man zuletzt genutzt hat und wie viel?"* Today the only per-user spend surface is the top-bar budget chip (`components/shell/top-bar-budget.tsx`), which shows a single spend/budget number. The detailed activity data (per model, per day) exists only on the super-admin analytics page via `/admin/litellm/tag-activity`. Regular users have no way to see which models they used recently and how much.

## Solution overview

1. A new user-scoped backend endpoint `GET /me/usage` returning the signed-in user's own LiteLLM tag activity (daily totals + by-model breakdown).
2. A new **Usage** section on `/settings` with a 7/30/90-day range toggle, a small usage-over-time chart, and a per-model table.
3. A "Details →" link in the top-bar budget popover deep-linking to `/settings#usage`.

Kept deliberately simple (approach A of three considered): no stacked charts, no lens switcher, no donut — one chart, one table.

## 1. Backend: `GET /me/usage`

New route in `backend/src/exulu/routes.ts`, placed next to `/me/budget` (line ~2472), using the same auth pattern (`requestValidators.authenticate(req)` → `authResult.user.id`).

**Query params:** `start_date`, `end_date` (YYYY-MM-DD). Default: last 30 days ending today. Validation: reject/normalise malformed dates, clamp the window to ≤ 92 days.

**Gating:** returns `{ usage: null }` when the admin setting `show_user_budget_in_chat` is off — the same gate and the same "null means hidden" contract as `/me/budget`. No new admin setting: an admin who exposes budget status to users is exposing spend data; this is the same data at finer grain.

**Data:** calls the existing `getTagDailyActivity()` (`litellm/activity-client.ts`) with the single tag `budgetTagFor("user", userId)` (`tags.ts`), then projects to:

```ts
{ usage: {
  window: { start_date: string, end_date: string },
  display: "amount" | "percent",          // user_budget_display setting
  totals: { spend, prompt_tokens, completion_tokens, total_tokens,
            successful_requests, failed_requests, api_requests },
  daily:   Array<{ date, spend, prompt_tokens, completion_tokens, total_tokens,
                   successful_requests, failed_requests, api_requests }>,
  byModel: Array<{ model, spend, prompt_tokens, completion_tokens, total_tokens,
                   successful_requests, failed_requests }>,   // sorted by spend desc
}}
```

`display` rides along so the frontend never correlates with `/me/budget`. Per the existing product decision (documented in `top-bar-budget.tsx:49`), percent mode is **UI-only**: the payload always contains spend figures; the UI decides what to show.

No caching layer (YAGNI — the section loads on demand on one page; can add a short `readCache` like `getUserBudgetView` later if needed).

## 2. Frontend data layer

New `lib/my-usage.ts`, mirroring `lib/litellm-activity.ts`:

- Response types matching the shape above.
- `buildMyUsagePath({ start_date, end_date })` URL builder (relative path, YYYY-MM-DD slicing).
- `useMyUsage(query, skip?)` hook using the same `request(path, "GET")` helper; `{ data, loading, error, refetch }` shape identical to `useTagActivity`. Query object must be referentially stable (memoised on the selected range).

## 3. UI: Usage section on `/settings`

New `UsageSection` client component in `app/(application)/settings/components/`, rendered in `settings-view.tsx` **after the Account section** (identity first, then activity), preceded by a `Separator`.

Page rules respected: `FormSection` + `Separator`, **no cards, no new purple elements** (the prompt Save stays the page's only primary element). Section root gets `id="usage"` and `scroll-mt` so the header deep-link lands cleanly.

Contents, top to bottom:

- **Range toggle:** 7 / 30 / 90 days (`ToggleGroup`, visual language of the theme control), default 30. Changing it refetches.
- **Totals line:** spend, tokens, requests for the window — a small `dl` row matching the Account rows' typography. In percent mode the spend figure is omitted (tokens + requests only), consistent with chart and table.
- **Chart:** one recharts `AreaChart` inside `ChartContainer` (~160 px tall), single muted series using the chart-1 color token, `ChartTooltipContent` tooltip. Metric: daily **spend** in amount mode, daily **total tokens** in percent mode.
- **Model table:** plain table — model · requests · tokens · spend. Spend column hidden in percent mode; rows sorted by spend (by tokens in percent mode). Failed requests surfaced only when > 0.
- **States:** `Skeleton` while loading; "no usage in this period" empty text; inline error with retry (reuses `refetch`). When `usage` is `null` (setting off), the entire section including its separator renders nothing.

Visibility: the section shows for any user when the setting is on, **even without a configured budget** — usage exists independently of budgets, and users without budgets are exactly who currently has zero visibility.

## 4. Header "Details" link

`TopBarBudget` popover (`components/shell/top-bar-budget.tsx`) gets a final row: a link-variant button "Details →" → `/settings#usage`. The chip face is unchanged. (The link only exists where the popover exists, i.e. when a budget is shown; the settings section itself does not depend on it.)

## 5. i18n

Additive keys in `messages/en.json` and `messages/de.json`:

- `settings.usage.*` — title, description, range labels, totals labels, column headers, empty state, error + retry.
- `budgets.bar.details` — the popover link label.

Both files carry uncommitted in-flight changes; edits must be additive and untouched keys left alone.

## 6. Error handling

- Backend: malformed dates → 400 with `detail`; LiteLLM failure → 502 with `detail` (match existing route error style); unauthenticated → 401 via the standard pattern.
- Frontend: hook surfaces the error; section shows inline error + retry; never crashes the settings page (section is self-contained).

## 7. Testing

- **Backend:** unit tests for the projection (daily/byModel aggregation from `getTagDailyActivity` rows), the `show_user_budget_in_chat` gate, and date defaulting/clamping — following the backend's existing route/service test patterns.
- **Frontend:** unit tests for `buildMyUsagePath` (defaults, YMD slicing) and the percent-mode display logic (spend hidden, token metric chosen). Component-level behavior (states, table rendering) per existing settings test patterns if present.
- Baseline: 4 known-failing checks on main are pre-existing; only new failures block.

## Out of scope

- Per-model-per-day (stacked) charts, donuts, spend/tokens/requests lens switcher.
- A dedicated `/profile` or `/usage` page.
- New admin settings.
- Server-side omission of spend in percent mode (existing product decision keeps it UI-only).
