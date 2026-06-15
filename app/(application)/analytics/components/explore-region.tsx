"use client";

/**
 * ExploreRegion — the "Trending how? / Driven by whom?" half of the page
 * (analytics.md §3 "Default view" Region B).
 *
 * One visible scope row, two ChartCards beneath:
 *   - left: event-type Select with SelectGroup headings (Agents / Knowledge
 *     / Workflows) — all 9 STATISTICS_TYPEs scannable, labels i18n'd.
 *   - right: measure Tabs [Count | Tokens] — replaces both the hand-rolled
 *     pill and the per-chart unit Select (UX#11 + UX#4 / bug 2.e killed).
 *
 * Both Tabs and Select write directly to the lens — the URL is the source
 * of truth (rule #10a, no local mirror).
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BreakdownChartCard } from "./breakdown-chart-card";
import { TrendChartCard } from "./trend-chart-card";
import type { Lens, Measure } from "../hooks";

export interface ExploreRegionProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
}

const TYPE_GROUPS: Array<{ headingKey: string; items: Array<{ value: string; labelKey: string }> }> = [
  {
    headingKey: "explore.typeGroupAgents",
    items: [
      { value: "AGENT_RUN", labelKey: "explore.typeAgentRun" },
      { value: "TOOL_CALL", labelKey: "explore.typeToolCall" },
    ],
  },
  {
    headingKey: "explore.typeGroupKnowledge",
    items: [
      { value: "CONTEXT_RETRIEVE", labelKey: "explore.typeContextRetrieve" },
      { value: "CONTEXT_UPSERT", labelKey: "explore.typeContextUpsert" },
      { value: "SOURCE_UPDATE", labelKey: "explore.typeSourceUpdate" },
      { value: "EMBEDDER_GENERATE", labelKey: "explore.typeEmbedderGenerate" },
      { value: "EMBEDDER_UPSERT", labelKey: "explore.typeEmbedderUpsert" },
      { value: "EMBEDDER_DELETE", labelKey: "explore.typeEmbedderDelete" },
    ],
  },
  {
    headingKey: "explore.typeGroupWorkflows",
    items: [{ value: "WORKFLOW_RUN", labelKey: "explore.typeWorkflowRun" }],
  },
];

export function ExploreRegion({ lens, onLensChange }: ExploreRegionProps) {
  const t = useTranslations("analytics");

  return (
    <section aria-label={t("explore.trendTitle")} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-[220px]">
          <Select
            value={lens.type}
            onValueChange={(value) => onLensChange({ type: value as Lens["type"] })}
          >
            <SelectTrigger aria-label={t("explore.type")} className="max-md:h-11">
              <SelectValue placeholder={t("explore.type")} />
            </SelectTrigger>
            <SelectContent>
              {TYPE_GROUPS.map((group) => (
                <SelectGroup key={group.headingKey}>
                  <SelectLabel>{t(group.headingKey)}</SelectLabel>
                  {group.items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </SelectItem>
                  ))}
                </SelectGroup>
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
            className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
            aria-label={t("explore.measure")}
          >
            <TabsTrigger value="count" className="px-3 text-sm">
              {t("explore.measureCount")}
            </TabsTrigger>
            <TabsTrigger value="tokens" className="px-3 text-sm">
              {t("explore.measureTokens")}
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
