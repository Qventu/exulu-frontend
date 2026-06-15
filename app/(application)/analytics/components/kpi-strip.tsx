"use client";

/**
 * KPIStrip — five StatCards bound to the lens's CURRENT range (24h preset →
 * 24h window, 14d preset → 14d window, etc.).
 *
 * Each card carries a delta against the equal-length previous window
 * (matches analytics.md ladder #17 "trend %"); the delta earns semantic
 * color only past ±25% per StatCard's emphasis API (mirrors Home Vitals,
 * (home)/components/home-dashboard.tsx).
 *
 * Bug fixes by construction:
 *   - 2.a: hooks.ts useRangeStat gates `loading` on BOTH queries.
 *   - 2.d: every card's window IS the lens's range (no hardcoded 24h+7d).
 *
 * Each StatCard accepts a click target that pre-seeds the explore lens
 * (analytics.md ladder #12–15): clicking Agent calls sets type=AGENT_RUN,
 * clicking Tokens sets measure=tokens, clicking Workflow runs sets
 * type=WORKFLOW_RUN, clicking Tool calls sets type=TOOL_CALL. Sessions is
 * non-lens (no tracking type) and links nowhere.
 */

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { StatCard, type StatCardDelta } from "@/components/primitives/stat-card";

import {
  lensToSearchParams,
  useAgentCallsStat,
  useSessionsStat,
  useTokensStat,
  useToolCallsStat,
  useWorkflowRunsStat,
  type Lens,
  type RangeStat,
} from "../hooks";

const EMPHASIS_THRESHOLD_PERCENT = 25;

export interface KPIStripProps {
  lens: Lens;
}

export function KPIStrip({ lens }: KPIStripProps) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const formatNumber = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const sessions = useSessionsStat(lens);
  const calls = useAgentCallsStat(lens);
  const tokens = useTokensStat(lens);
  const workflows = useWorkflowRunsStat(lens);
  const tools = useToolCallsStat(lens);

  const trendOf = React.useCallback(
    (stat: RangeStat): { delta?: StatCardDelta; caption?: string } => {
      if (stat.current == null || stat.previous == null) return {};
      const caption = t("kpi.vsPrevious", {
        value: formatNumber.format(stat.previous),
      });
      const percent =
        stat.previous > 0 ? ((stat.current - stat.previous) / stat.previous) * 100 : 0;
      if (percent === 0) {
        return { delta: { value: "0%", direction: "flat" }, caption };
      }
      return {
        delta: {
          value: `${percent > 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}%`,
          direction: percent > 0 ? "up" : "down",
          emphasis: Math.abs(percent) > EMPHASIS_THRESHOLD_PERCENT,
        },
        caption,
      };
    },
    [t, formatNumber],
  );

  const statValue = (value: number | null, error: boolean): string | number =>
    error || value == null ? "—" : value;

  // Pre-seed lens deep-links: keep the current range, switch the relevant
  // axis. We serialize via lensToSearchParams so the destination URL is
  // canonical (the receiving page reads it via lensFromSearchParams).
  const hrefFor = React.useCallback(
    (overrides: Partial<Lens>): string => {
      const next: Lens = { ...lens, ...overrides };
      const qs = lensToSearchParams(next);
      return qs ? `/analytics?${qs}` : "/analytics";
    },
    [lens],
  );

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label={t("kpi.sessions")}
        value={statValue(sessions.current, sessions.error)}
        loading={sessions.loading}
        {...trendOf(sessions)}
      />
      <StatCard
        label={t("kpi.agentCalls")}
        value={statValue(calls.current, calls.error)}
        loading={calls.loading}
        href={hrefFor({ type: "AGENT_RUN", measure: "count" })}
        {...trendOf(calls)}
      />
      <StatCard
        label={t("kpi.tokens")}
        value={statValue(tokens.current, tokens.error)}
        loading={tokens.loading}
        href={hrefFor({ type: "AGENT_RUN", measure: "tokens" })}
        {...trendOf(tokens)}
      />
      <StatCard
        label={t("kpi.workflowRuns")}
        value={statValue(workflows.current, workflows.error)}
        loading={workflows.loading}
        href={hrefFor({ type: "WORKFLOW_RUN", measure: "count" })}
        {...trendOf(workflows)}
      />
      <StatCard
        label={t("kpi.toolCalls")}
        value={statValue(tools.current, tools.error)}
        loading={tools.loading}
        href={hrefFor({ type: "TOOL_CALL", measure: "count" })}
        {...trendOf(tools)}
      />
    </div>
  );
}
