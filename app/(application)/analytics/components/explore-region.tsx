"use client";

/**
 * ExploreRegion — the "Trending how? / Driven by whom?" half of the page.
 *
 * One visible measure row, two ChartCards beneath:
 *   - measure Tabs [Spend | Tokens | Requests] — three triggers, the only
 *     in-region scope control after the legacy LensType Select retired.
 *
 * Tabs writes directly to the lens — the URL is the source of truth
 * (rule #10a, no local mirror). The dimension picker now lives in the
 * page header (see analytics-view.tsx) so it sits at page-level instead
 * of inside Explore.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BreakdownChartCard } from "./breakdown-chart-card";
import { TrendChartCard } from "./trend-chart-card";
import { type Lens, type Measure } from "../hooks";

export interface ExploreRegionProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
}

export function ExploreRegion({ lens, onLensChange }: ExploreRegionProps) {
  const t = useTranslations("analytics");

  return (
    <section aria-label={t("explore.trendTitle")} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Tabs
          value={lens.measure}
          onValueChange={(value) => onLensChange({ measure: value as Measure })}
          className="w-full sm:w-auto"
        >
          <TabsList
            className="grid w-full grid-cols-3 max-md:h-11 sm:inline-flex sm:w-auto"
            aria-label={t("explore.measure")}
          >
            <TabsTrigger value="spend" className="px-3 text-sm max-md:h-full">
              {t("explore.measureSpend")}
            </TabsTrigger>
            <TabsTrigger value="tokens" className="px-3 text-sm max-md:h-full">
              {t("explore.measureTokens")}
            </TabsTrigger>
            <TabsTrigger value="requests" className="px-3 text-sm max-md:h-full">
              {t("explore.measureRequests")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChartCard lens={lens} />
        </div>
        <BreakdownChartCard lens={lens} onLensChange={onLensChange} />
      </div>
    </section>
  );
}
