"use client";

/**
 * LiteLLM tag-activity fetch primitive — shared by `/analytics` and Home's
 * Today Vitals (codebase-structure §1.2 forbids cross-feature folder
 * imports, so the one primitive that both surfaces depend on lives here in
 * `lib/`).
 *
 * Single canonical fetch hook: `useTagActivity(query, skip)` calls the
 * backend's `/admin/litellm/tag-activity` proxy (which attaches the
 * LITELLM_MASTER_KEY server-side). Callers project the typed
 * `TagActivityResponse` into their own measure-/dimension-shaped views;
 * see `app/(application)/analytics/queries.ts` for the canonical projection
 * helpers (`measureFromTotals` / `measureFromDaily` / `measureFromByTag`).
 *
 * The hook deliberately mirrors Apollo's `loading` semantics:
 *   - `data` is `null` until the first response (or while `skip` is true).
 *   - `loading` is `true` only while a fetch is in flight (skip flips it
 *     back to `false`).
 *   - `error` is an `Error` instance — callers can surface `.message`.
 *   - `refetch()` re-fires the latest path without changing the query.
 *
 * The fetch is keyed on a memoised `buildTagActivityPath(query)` so callers
 * MUST pass a referentially stable `query` (use `React.useMemo` keyed on
 * the lens). The two consumers (analytics totals / daily / by-tag and
 * Home's `useTodayVitals`) both do this.
 */

import * as React from "react";

import { request } from "@/lib/api/client";

// ─────────────────────────── Request shape ───────────────────────────

export interface TagActivityQuery {
  /** YYYY-MM-DD (backend also accepts ISO and normalises). */
  start_date: string;
  /** YYYY-MM-DD (backend also accepts ISO and normalises). */
  end_date: string;
  /** Optional CSV — explicit tag-name list. */
  tags?: string;
  /**
   * Optional Exulu-only sugar (not in LiteLLM API). When set, backend
   * fetches /tag/list once and forwards the filtered CSV.
   */
  tag_prefix?: string;
  model?: string;
  page?: number;
  page_size?: number;
  exclude_team_tags?: boolean;
}

// ─────────────────────────── Response shape ───────────────────────────

export interface TagActivityTotals {
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface TagActivityDailyRow {
  date: string; // YYYY-MM-DD
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
}

export interface TagActivityByTagRow {
  tag: string;
  prefix: string | null;
  id: string | null;
  name: string | null;
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
}

export interface TagActivityByTagByDayRow {
  tag: string;
  prefix: string | null;
  id: string | null;
  name: string | null;
  date: string; // YYYY-MM-DD
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
}

export interface TagActivityByModelRow {
  model: string;
  spend: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
}

export interface TagActivityPagination {
  page: number;
  total_pages: number;
  total_count: number;
  has_more: boolean;
}

export interface TagActivityResponse {
  window: { start_date: string; end_date: string };
  totals: TagActivityTotals;
  daily: TagActivityDailyRow[];
  byTag: TagActivityByTagRow[];
  byTagByDay: TagActivityByTagByDayRow[];
  byModel: TagActivityByModelRow[];
  pagination: TagActivityPagination;
  tagPrefix: string | null;
}

// ─────────────────────────── URL builder ───────────────────────────

/**
 * Build the path + query string for `/admin/litellm/tag-activity`. Returns
 * a relative path (callers prepend the backend base URL). Keys with
 * undefined / empty values are omitted so the upstream LiteLLM URL doesn't
 * collect noise that breaks its strict parser.
 */
export function buildTagActivityPath(query: TagActivityQuery): string {
  const params = new URLSearchParams();
  params.set("start_date", isoToYmd(query.start_date));
  params.set("end_date", isoToYmd(query.end_date));
  if (query.tags) params.set("tags", query.tags);
  if (query.tag_prefix) params.set("tag_prefix", query.tag_prefix);
  if (query.model) params.set("model", query.model);
  if (query.page != null) params.set("page", String(query.page));
  if (query.page_size != null) params.set("page_size", String(query.page_size));
  if (query.exclude_team_tags != null) {
    params.set("exclude_team_tags", String(query.exclude_team_tags));
  }
  return `/admin/litellm/tag-activity?${params.toString()}`;
}

/** Slice off ISO time to satisfy LiteLLM's YYYY-MM-DD contract. */
function isoToYmd(value: string): string {
  return value.slice(0, 10);
}

// ─────────────────────────── Hook ───────────────────────────

export interface UseTagActivityResult {
  data: TagActivityResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch /admin/litellm/tag-activity for the given query window. The query
 * object MUST be referentially stable (callers pass a useMemo result keyed
 * on lens) so this hook doesn't refire on every render.
 *
 * `skip` mirrors Apollo's option — when true, the hook is a no-op (data
 * stays null, loading stays false) until skip flips back.
 */
export function useTagActivity(
  query: TagActivityQuery | null,
  skip = false,
): UseTagActivityResult {
  const [data, setData] = React.useState<TagActivityResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  const path = React.useMemo(
    () => (query ? buildTagActivityPath(query) : null),
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
        const json = (await request(path, "GET")) as TagActivityResponse;
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
