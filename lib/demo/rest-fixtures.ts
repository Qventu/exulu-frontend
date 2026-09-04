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
