"use client";

/**
 * UsagePanel — super-admin-only Knowledge usage region on /data
 * (work item 2.11, owner "library"; knowledge.md §3 ladder rows 8, 9,
 * 10, 84).
 *
 * Two parts:
 *   1) Slim StatCard row (Upserts 7d, Retrievals 7d, Items total) —
 *      visible at L1 so SA always has the budget/usage glance per
 *      philosophy §10 (translate as you ascend; L1 reads as counts, the
 *      charts live one step deeper).
 *   2) Collapsible "Usage" panel hosting the DateRangeSelector +
 *      TimeSeriesChart + DonutChart, revealed by a quiet "View usage"
 *      ghost button (Collapsible).
 *
 * The page-doc inventory items 9/10 explicitly keep today's
 * TimeSeriesChart + DonutChart components (they're already
 * token-driven). DateRangeSelector keeps its max-30-day limit.
 *
 * Until backend ships aggregate stats per knowledge-context, the
 * StatCard numbers are unknown and we render with the shared
 * StatCard's `loading={true}` skeleton state — better than wallpapering
 * a "—". This is the only place library StatCards consume the existing
 * STATISTICS pipeline; integrator's analytics work (2.13) will provide
 * proper readouts.
 */

import { subDays } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { ChartCard } from "@/components/primitives/chart-card";
import { StatCard } from "@/components/primitives/stat-card";
import { DateRangeSelector } from "@/components/dashboard/date-range-selector";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  STATISTICS_TYPE_ENUM,
  type STATISTICS_TYPE,
} from "@/lib/enums/statistics";

export interface UsagePanelProps {
  /** Optional override for the panel's initial open state (default false). */
  defaultOpen?: boolean;
}

export function UsagePanel({ defaultOpen = false }: UsagePanelProps) {
  const t = useTranslations("knowledge");

  const [open, setOpen] = React.useState(defaultOpen);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [selectedType, setSelectedType] =
    React.useState<STATISTICS_TYPE>("CONTEXT_UPSERT");
  const [groupBy, setGroupBy] = React.useState<string>("label");
  const [unit, setUnit] = React.useState<"tokens" | "count">("count");

  return (
    <section
      aria-label={t("library.usage.region")}
      className="space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {/* Until backend ships aggregate counts, these render as skeletons.
            Inventory items 8-10 still resolve to L2 (charts inside the
            collapsible) — the StatCards are the L1 surface. */}
        <StatCard
          label={t("library.stats.upserts7d")}
          value={0}
          loading={true}
          caption={t("library.stats.last7Days")}
        />
        <StatCard
          label={t("library.stats.retrievals7d")}
          value={0}
          loading={true}
          caption={t("library.stats.last7Days")}
        />
        <StatCard
          label={t("library.stats.itemsTotal")}
          value={0}
          loading={true}
        />
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
            >
              {open ? (
                <ChevronUp className="mr-2 size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="mr-2 size-4" aria-hidden="true" />
              )}
              {open
                ? t("library.usage.hide")
                : t("library.usage.view")}
            </Button>
          </CollapsibleTrigger>
          {open && (
            <DateRangeSelector
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              maxDays={30}
            />
          )}
        </div>
        <CollapsibleContent className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ChartCard
              title={t("library.usage.timeSeriesTitle")}
              description={t("library.usage.timeSeriesDescription")}
              className="md:col-span-2"
            >
              <TimeSeriesChart
                dateRange={dateRange}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                unitOptions={[
                  { value: "count", label: t("library.usage.count") },
                ]}
                onUnitChange={setUnit}
                unit={unit}
                dataTypes={[
                  STATISTICS_TYPE_ENUM.CONTEXT_RETRIEVE,
                  STATISTICS_TYPE_ENUM.CONTEXT_UPSERT,
                ]}
              />
            </ChartCard>
            <ChartCard
              title={t("library.usage.donutTitle")}
              description={t("library.usage.donutDescription")}
            >
              <DonutChart
                groupByOptions={[]}
                dateRange={dateRange}
                selectedType={selectedType}
                unit={unit}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
              />
            </ChartCard>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
