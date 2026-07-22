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
