"use client";

/**
 * KPIStrip — three StatCards bound to the lens's CURRENT range.
 *
 * Spend / Tokens / Requests — the LiteLLM measure trinity. Each card
 * carries a delta against the equal-length previous window (analytics.md
 * ladder #17 "trend %"); the delta earns semantic color only past ±25% per
 * StatCard's emphasis API (mirrors Home Vitals).
 *
 * Bug fixes by construction:
 *   - 2.a: useActivityTotals gates `loading` on BOTH current and previous.
 *   - 2.d: every card's window IS the lens's range (no hardcoded 24h+7d).
 *
 * Each StatCard accepts a click target that pre-seeds the measure axis on
 * /analytics (e.g. clicking Spend sets measure=spend).
 */

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { StatCard, type StatCardDelta } from "@/components/primitives/stat-card";

import {
  lensToSearchParams,
  useActivityTotals,
  type Lens,
  type RangeTotalsStat,
} from "../hooks";

const EMPHASIS_THRESHOLD_PERCENT = 25;
const SPEND_CURRENCY = "USD"; // LiteLLM reports spend in USD; see analytics.md §4 Risks.

export interface KPIStripProps {
  lens: Lens;
}

export function KPIStrip({ lens }: KPIStripProps) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const formatNumber = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const formatCurrency = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: SPEND_CURRENCY,
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  // Three independent measure projections off the same lens window. Each
  // useActivityTotals call still issues 2 network requests (current +
  // previous), but they hit the SAME backend path so they coalesce in the
  // browser HTTP cache. That's a future optimisation if it shows up in
  // metrics; for now correctness > clever sharing.
  const spend = useActivityTotals(lens, "spend");
  const tokens = useActivityTotals(lens, "tokens");
  const requests = useActivityTotals(lens, "requests");

  const trendOf = React.useCallback(
    (
      stat: RangeTotalsStat,
      format: (value: number) => string,
    ): { delta?: StatCardDelta; caption?: string } => {
      if (stat.current == null || stat.previous == null) return {};
      const caption = t("kpi.vsPrevious", { value: format(stat.previous) });
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
    [t],
  );

  const statValue = (
    value: number | null,
    error: boolean,
    format: (v: number) => string,
  ): string =>
    error || value == null ? "—" : format(value);

  const formatSpend = React.useCallback(
    (v: number) => formatCurrency.format(v),
    [formatCurrency],
  );
  const formatCount = React.useCallback(
    (v: number) => formatNumber.format(v),
    [formatNumber],
  );

  // Pre-seed lens deep-links: keep the current range / type / dimension,
  // switch only the measure axis. We serialize via lensToSearchParams so
  // the destination URL is canonical.
  const hrefFor = React.useCallback(
    (overrides: Partial<Lens>): string => {
      const next: Lens = { ...lens, ...overrides };
      const qs = lensToSearchParams(next);
      return qs ? `/analytics?${qs}` : "/analytics";
    },
    [lens],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label={t("kpi.spend")}
        value={statValue(spend.current, spend.error, formatSpend)}
        loading={spend.loading}
        href={hrefFor({ measure: "spend" })}
        {...trendOf(spend, formatSpend)}
      />
      <StatCard
        label={t("kpi.tokens")}
        value={statValue(tokens.current, tokens.error, formatCount)}
        loading={tokens.loading}
        href={hrefFor({ measure: "tokens" })}
        {...trendOf(tokens, formatCount)}
      />
      <StatCard
        label={t("kpi.requests")}
        value={statValue(requests.current, requests.error, formatCount)}
        loading={requests.loading}
        href={hrefFor({ measure: "requests" })}
        {...trendOf(requests, formatCount)}
      />
    </div>
  );
}
