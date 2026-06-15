"use client";

/**
 * ExploreRegion — the "Trending how? / Driven by whom?" half of the page.
 *
 * One visible scope row, two ChartCards beneath:
 *   - left: LensType Select [All / Agents / Users / Projects / Teams / Roles].
 *     Six flat items; no SelectGroup needed. Each value maps to a tag-prefix
 *     family per DIMENSION_TAG_PREFIX in ../lens.
 *   - right: measure Tabs [Spend | Tokens | Requests] — three triggers,
 *     replaces both the hand-rolled pill and the legacy two-measure Tabs.
 *
 * Both Tabs and Select write directly to the lens — the URL is the source
 * of truth (rule #10a, no local mirror).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BreakdownChartCard } from "./breakdown-chart-card";
import { TrendChartCard } from "./trend-chart-card";
import { LENS_TYPES, type Lens, type LensType, type Measure } from "../hooks";

export interface ExploreRegionProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
}

const LENS_TYPE_LABEL_KEYS: Record<LensType, string> = {
  all: "explore.typeAll",
  agents: "explore.typeAgents",
  users: "explore.typeUsers",
  projects: "explore.typeProjects",
  teams: "explore.typeTeams",
  roles: "explore.typeRoles",
};

export function ExploreRegion({ lens, onLensChange }: ExploreRegionProps) {
  const t = useTranslations("analytics");

  return (
    <section aria-label={t("explore.trendTitle")} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-[220px]">
          <Select
            value={lens.type}
            onValueChange={(value) => onLensChange({ type: value as LensType })}
          >
            <SelectTrigger aria-label={t("explore.type")} className="max-md:h-11">
              <SelectValue placeholder={t("explore.type")} />
            </SelectTrigger>
            <SelectContent>
              {LENS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(LENS_TYPE_LABEL_KEYS[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Tabs
          value={lens.measure}
          onValueChange={(value) => onLensChange({ measure: value as Measure })}
          className="w-full sm:w-auto"
        >
          <TabsList
            className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
            aria-label={t("explore.measure")}
          >
            <TabsTrigger value="spend" className="px-3 text-sm">
              {t("explore.measureSpend")}
            </TabsTrigger>
            <TabsTrigger value="tokens" className="px-3 text-sm">
              {t("explore.measureTokens")}
            </TabsTrigger>
            <TabsTrigger value="requests" className="px-3 text-sm">
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
