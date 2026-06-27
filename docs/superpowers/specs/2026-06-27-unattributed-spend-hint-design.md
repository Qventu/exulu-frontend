# Unattributed Spend Hint

**Date:** 2026-06-27
**Status:** Approved

## Problem

Exulu filters LiteLLM totals to `user_id_*`-tagged requests only (to avoid double-counting across multi-tagged requests). This means our dashboard and analytics totals are always ≤ the LiteLLM global total. Admins comparing the two surfaces will see a gap with no explanation.

## Solution

Show a per-card hint line below the existing caption when the unattributed gap exceeds 1% of the unfiltered total. The hint shows the actual gap value so admins understand exactly what is excluded.

Example:

```
Spend (24h)
$106.42
↑ +8.3%  vs 7-day avg
+ $12.34 unattributed     ← new hint line
```

## Scope

Two surfaces: the home dashboard vitals section and the analytics KPI strip. Three cards each: Spend, Tokens, Requests.

## Design

### 1. StatCard — `hint` prop

Add `hint?: string` to `StatCardProps`. Renders as a `<p>` below the existing caption in `text-xs text-muted-foreground/70` (one opacity step below caption). No logic in the component — threshold check and formatting happen in callers.

### 2. Dashboard — `useTodayVitals`

Add one extra `useTagActivity` call with the same `dayStart`/`today` window as the existing tagged `dayQuery` but without `tag_prefix`. Add `unfilteredTotals: TagActivityTotals | null` to the `TodayVitals` return shape (null while loading or on error).

The dashboard component computes the gap and formats the hint string before passing it to `StatCard`.

### 3. Analytics — `KPIStrip`

Add one `useTagActivity` call at the top of `KPIStrip` using the current window resolved from the lens (`resolveWindow(lens).current`) with no `tag_prefix`. No changes to `useActivityTotals` — the three existing calls already return `currentTotals` which holds the tagged totals for subtraction.

When the lens changes, `currentWindow` recomputes and the unfiltered query refires automatically, keeping the hint in sync with the card values.

### 4. Hint computation (shared pattern)

```ts
function unattributedHint(
  tagged: number | null,
  unfiltered: number | null,
  format: (n: number) => string,
): string | undefined {
  if (tagged == null || unfiltered == null || unfiltered === 0) return undefined;
  const gap = unfiltered - tagged;
  if (gap <= 0) return undefined;           // negative gap suppressed (timing skew)
  if (gap / unfiltered <= 0.01) return undefined;  // ≤1% threshold
  return `+ ${format(gap)} unattributed`;
}
```

Each card uses its own formatter: `formatCurrency.format` for Spend, `formatNumber.format` for Tokens and Requests.

This helper is defined locally in each component file (dashboard + KPIStrip) — it's four lines and the two call sites have different formatter signatures, so a shared utility would add more ceremony than it saves.

## Data flow

```
useTodayVitals (home)
  ├─ dayQuery (tagged)       → TagActivityTotals (tagged)
  ├─ weekQuery (tagged)      → TagActivityTotals (weekly, for trend)
  └─ unfilteredDayQuery      → unfilteredTotals

KPIStrip (analytics)
  ├─ useActivityTotals ×3    → spend/tokens/requests (tagged, current + previous)
  └─ useTagActivity(unfiltered current window) → unfiltered totals
```

## Edge cases

- **Gap negative:** suppressed (tagged > unfiltered shouldn't happen but can due to query timing skew).
- **Unfiltered loading:** hint is `undefined` until both tagged and unfiltered resolve — no flash of incorrect value.
- **Gap exactly 0:** suppressed (0/unfiltered = 0% ≤ 1%).
- **All requests untagged:** gap = 100%, hint shown. Correct — this is exactly the situation admins need to see.

## Out of scope

- Showing unattributed trend (previous window gap) — not useful, adds complexity.
- A global "X% unattributed" banner — per-card gives more actionable context.
- Backend changes — pure frontend computation.
