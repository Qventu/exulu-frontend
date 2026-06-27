# Unattributed Spend Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a per-card hint line (e.g. `+ $12.34 unattributed`) on spend/tokens/requests StatCards when more than 1% of LiteLLM activity is not attributed to a `user_id_*` tag.

**Architecture:** Four sequential changes across four files. StatCard gains a passive `hint` prop. `useTodayVitals` adds a parallel unfiltered query and exposes the raw totals. The home dashboard computes gaps and passes hints to its two LiteLLM cards. KPIStrip on /analytics does the same against the active lens window.

**Tech Stack:** React 19, Next.js App Router, Tailwind CSS, `useTagActivity` / `TagActivityTotals` from `lib/litellm-activity.ts`

## Global Constraints

- Hint only shown when `gap / unfiltered > 0.01` (>1%) and `gap > 0`
- Unfiltered query uses identical time window to the tagged query — only `tag_prefix` is absent
- `StatCard` has zero threshold logic — it renders whatever string `hint` contains
- Hint format exactly: `+ {formatted_gap} unattributed`
- No backend changes
- `unattributedHint` is a module-level pure function in each component file (not a hook, not a shared util)

---

### Task 1: StatCard — `hint` prop

**Files:**
- Modify: `components/primitives/stat-card.tsx`

**Interfaces:**
- Produces: `StatCardProps.hint?: string` — optional third line in the caption block, rendered after `caption`

- [ ] **Step 1: Add `hint` to `StatCardProps`**

In `components/primitives/stat-card.tsx`, add the field after `caption` in the interface:

```ts
export interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  value: string | number;
  delta?: StatCardDelta;
  /** Quiet comparison caption, always visible (no hover-only data). */
  caption?: string;
  /** Second quiet caption line for contextual hints (e.g. unattributed spend). */
  hint?: string;
  loading?: boolean;
  /** Makes the whole card a link (e.g. Home → /analytics). */
  href?: string;
  icon?: LucideIcon;
}
```

- [ ] **Step 2: Destructure `hint` and render it**

In the `React.forwardRef` call, add `hint` after `caption` in the destructure:

```ts
{ label, value, delta, caption, hint, loading = false, href, icon, className, ...props },
```

Replace the existing `{(delta || caption) && ...}` block with one that also checks `hint`, and add the hint `<p>` after the caption `<p>`:

```tsx
{(delta || caption || hint) && (
  <div className="space-y-0.5">
    {delta && DeltaIcon && (
      <p className={cn("flex items-center gap-1 text-xs font-medium", deltaColor)}>
        <DeltaIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {delta.value}
      </p>
    )}
    {caption && (
      <p className="text-xs text-muted-foreground/70">{caption}</p>
    )}
    {hint && (
      <p className="text-xs text-muted-foreground/50">{hint}</p>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/daniel.claessen/Desktop/Projects/exulu/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add components/primitives/stat-card.tsx
git commit -m "feat(stat-card): add optional hint prop for second caption line"
```

---

### Task 2: `useTodayVitals` — expose unfiltered totals

**Files:**
- Modify: `app/(application)/(home)/hooks.ts`

**Interfaces:**
- Consumes: `TagActivityTotals` type from `@/lib/litellm-activity` (new import, same package)
- Produces: `TodayVitals.unfilteredTotals: TagActivityTotals | null` — raw unfiltered 24h totals; null while loading or on error

- [ ] **Step 1: Extend the `useTagActivity` import to include `TagActivityTotals`**

The current import in `app/(application)/(home)/hooks.ts` is:

```ts
import { CANONICAL_DEDUPE_TAG_PREFIX, useTagActivity } from "@/lib/litellm-activity";
```

Change it to:

```ts
import {
  CANONICAL_DEDUPE_TAG_PREFIX,
  useTagActivity,
  type TagActivityTotals,
} from "@/lib/litellm-activity";
```

- [ ] **Step 2: Add `unfilteredTotals` to the `TodayVitals` interface**

Find the `TodayVitals` interface and add the new field:

```ts
export interface TodayVitals {
  spend: StatPair;
  tokens: StatPair;
  requests: StatPair;
  /** Raw unfiltered 24h totals for computing unattributed gap. Null until loaded. */
  unfilteredTotals: TagActivityTotals | null;
}
```

- [ ] **Step 3: Add the unfiltered query inside `useTodayVitals`**

In `useTodayVitals`, the existing code already has `dayStart` and `today` in scope. After the `weekQuery` memo, add:

```ts
const unfilteredDayQuery = React.useMemo(
  () => ({ start_date: dayStart, end_date: today }),
  [dayStart, today],
);
```

Then add the corresponding `useTagActivity` call after the existing `day` and `week` calls:

```ts
const unfiltered = useTagActivity(unfilteredDayQuery, skip);
```

- [ ] **Step 4: Include `unfilteredTotals` in the return value**

The existing `return` block ends with the three StatPair fields. Add `unfilteredTotals`:

```ts
return {
  spend: ready ? pair(dayTotals!.spend, weekTotals!.spend, false) : empty,
  tokens: ready ? pair(dayTotals!.total_tokens, weekTotals!.total_tokens, true) : empty,
  requests: ready ? pair(dayTotals!.successful_requests, weekTotals!.successful_requests, true) : empty,
  unfilteredTotals: unfiltered.data?.totals ?? null,
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output. TypeScript will surface any `TodayVitals` shape mismatches across the codebase at this point.

- [ ] **Step 6: Commit**

```bash
git add "app/(application)/(home)/hooks.ts"
git commit -m "feat(home): expose unfilteredTotals in useTodayVitals for unattributed hint"
```

---

### Task 3: Home dashboard — render hints on spend and tokens cards

**Files:**
- Modify: `app/(application)/(home)/components/home-dashboard.tsx`

**Interfaces:**
- Consumes: `TodayVitals.unfilteredTotals` (Task 2), `StatCard.hint` (Task 1)
- Note: the dashboard shows two LiteLLM-driven cards — Spend and Tokens. The 4th slot (workflows / budgets / evals) is GraphQL-sourced and gets no hint.

- [ ] **Step 1: Add the `unattributedHint` helper at module level**

Add this pure function near the top of `app/(application)/(home)/components/home-dashboard.tsx`, outside the component (e.g. after the constants block):

```ts
function unattributedHint(
  tagged: number | null,
  unfiltered: number | null,
  format: (n: number) => string,
): string | undefined {
  if (tagged == null || unfiltered == null || unfiltered === 0) return undefined;
  const gap = unfiltered - tagged;
  if (gap <= 0) return undefined;
  if (gap / unfiltered <= 0.01) return undefined;
  return `+ ${format(gap)} unattributed`;
}
```

- [ ] **Step 2: Pass `hint` to the Spend StatCard**

Find the Spend `<StatCard>` (currently at roughly line 229). Add the `hint` prop:

```tsx
<StatCard
  label={t("vitals.spend")}
  value={spendStatValue(spendStat.current, spendStat.error)}
  loading={spendStat.loading}
  href={canAnalytics ? "/analytics?dimension=agents&measure=spend" : undefined}
  hint={unattributedHint(
    spendStat.current,
    vitals.unfilteredTotals?.spend ?? null,
    formatCurrency.format,
  )}
  {...trendOf(spendStat, formatCurrency.format)}
/>
```

- [ ] **Step 3: Pass `hint` to the Tokens StatCard**

Find the Tokens `<StatCard>` (currently at roughly line 240). Add the `hint` prop:

```tsx
<StatCard
  label={t("vitals.tokens")}
  value={statValue(tokensStat.current, tokensStat.error)}
  loading={tokensStat.loading}
  href={canAnalytics ? "/analytics?dimension=agents&measure=tokens" : undefined}
  hint={unattributedHint(
    tokensStat.current,
    vitals.unfilteredTotals?.total_tokens ?? null,
    formatNumber.format,
  )}
  {...trendOf(tokensStat)}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "app/(application)/(home)/components/home-dashboard.tsx"
git commit -m "feat(home): show unattributed hint on spend and tokens vitals cards"
```

---

### Task 4: KPIStrip — render hints on spend, tokens, and requests cards

**Files:**
- Modify: `app/(application)/analytics/components/kpi-strip.tsx`

**Interfaces:**
- Consumes: `useTagActivity`, `resolveWindow`, `type TagActivityQuery` from `../hooks` (new additions to existing import), `StatCard.hint` (Task 1)
- Note: `spend.current`, `tokens.current`, `requests.current` from `useActivityTotals` are the projected tagged totals — used directly as the `tagged` argument to `unattributedHint`.

- [ ] **Step 1: Extend the import from `../hooks`**

The current import in `app/(application)/analytics/components/kpi-strip.tsx`:

```ts
import {
  lensToSearchParams,
  useActivityTotals,
  type Lens,
  type RangeTotalsStat,
} from "../hooks";
```

Change it to:

```ts
import {
  lensToSearchParams,
  resolveWindow,
  useActivityTotals,
  useTagActivity,
  type Lens,
  type RangeTotalsStat,
  type TagActivityQuery,
} from "../hooks";
```

- [ ] **Step 2: Add the `unattributedHint` helper at module level**

Add this pure function outside the component (same logic as the dashboard helper):

```ts
function unattributedHint(
  tagged: number | null,
  unfiltered: number | null,
  format: (n: number) => string,
): string | undefined {
  if (tagged == null || unfiltered == null || unfiltered === 0) return undefined;
  const gap = unfiltered - tagged;
  if (gap <= 0) return undefined;
  if (gap / unfiltered <= 0.01) return undefined;
  return `+ ${format(gap)} unattributed`;
}
```

- [ ] **Step 3: Add the unfiltered query inside `KPIStrip`**

Inside the `KPIStrip` component, after the three `useActivityTotals` calls, add:

```ts
const unfilteredQuery = React.useMemo<TagActivityQuery>(
  () => {
    const { current } = resolveWindow(lens);
    return { start_date: current.from, end_date: current.to };
  },
  [lens],
);
const unfiltered = useTagActivity(unfilteredQuery);
```

- [ ] **Step 4: Pass `hint` to the Spend StatCard**

Find the Spend `<StatCard>` and add the `hint` prop:

```tsx
<StatCard
  label={t("kpi.spend")}
  value={statValue(spend.current, spend.error, formatSpend)}
  loading={spend.loading}
  href={hrefFor({ measure: "spend" })}
  hint={unattributedHint(
    spend.current,
    unfiltered.data?.totals.spend ?? null,
    formatSpend,
  )}
  {...trendOf(spend, formatSpend)}
/>
```

- [ ] **Step 5: Pass `hint` to the Tokens StatCard**

Tokens is `prompt_tokens + completion_tokens`. Project the unfiltered value inline:

```tsx
<StatCard
  label={t("kpi.tokens")}
  value={statValue(tokens.current, tokens.error, formatCount)}
  loading={tokens.loading}
  href={hrefFor({ measure: "tokens" })}
  hint={unattributedHint(
    tokens.current,
    unfiltered.data?.totals != null
      ? (unfiltered.data.totals.prompt_tokens ?? 0) +
        (unfiltered.data.totals.completion_tokens ?? 0)
      : null,
    formatCount,
  )}
  {...trendOf(tokens, formatCount)}
/>
```

- [ ] **Step 6: Pass `hint` to the Requests StatCard**

```tsx
<StatCard
  label={t("kpi.requests")}
  value={statValue(requests.current, requests.error, formatCount)}
  loading={requests.loading}
  href={hrefFor({ measure: "requests" })}
  hint={unattributedHint(
    requests.current,
    unfiltered.data?.totals.successful_requests ?? null,
    formatCount,
  )}
  {...trendOf(requests, formatCount)}
/>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add "app/(application)/analytics/components/kpi-strip.tsx"
git commit -m "feat(analytics): show unattributed hint on KPI strip spend/tokens/requests cards"
```
