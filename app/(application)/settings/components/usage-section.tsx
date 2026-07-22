"use client";

/**
 * /settings § Usage — the signed-in user's own model usage (spec
 * docs/superpowers/specs/2026-07-16-personal-usage-details-design.md):
 * 7/30/90-day range toggle, daily area chart, per-model table over
 * GET /me/usage. Self-contained: brings its own leading Separator and
 * renders NOTHING when the backend returns usage: null (admin "show budget
 * status in chat" off), so settings-view stays a flat section list.
 *
 * Page rules respected: FormSection + Separator, zero Cards, no new purple
 * elements. Percent display mode hides every USD figure (UI-only — same
 * product decision as the top-bar chip, top-bar-budget.tsx).
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { FormSection } from "@/components/primitives/form-section";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatUsd } from "@/lib/budget";
import {
  chartMetricFor,
  fillDailySeries,
  useMyUsage,
  type MyUsage,
  type MyUsageQuery,
} from "@/lib/my-usage";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { value: "7", days: 7, i18nKey: "usage.range7" },
  { value: "30", days: 30, i18nKey: "usage.range30" },
  { value: "90", days: 90, i18nKey: "usage.range90" },
] as const;

type RangeValue = (typeof RANGES)[number]["value"];

const formatCount = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function UsageSection() {
  const t = useTranslations("settings");
  const [range, setRange] = React.useState<RangeValue>("30");

  const query = React.useMemo<MyUsageQuery>(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? 30;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * DAY_MS);
    return { start_date: start.toISOString(), end_date: end.toISOString() };
  }, [range]);

  const { data, loading, error, refetch } = useMyUsage(query);
  const usage = data?.usage ?? null;

  // usage: null — the admin keeps spend data hidden from users; the whole
  // section (separator included) disappears.
  if (data && !usage) return null;

  const percentMode = usage?.display === "percent";
  const empty =
    usage != null &&
    usage.totals.api_requests === 0 &&
    usage.totals.total_tokens === 0;

  return (
    <>
      <Separator />
      <FormSection
        id="usage"
        className="scroll-mt-24"
        title={t("usage.title")}
        description={t("usage.description")}
      >
        <ToggleGroup
          type="single"
          value={range}
          // Radix emits "" when the active item is clicked again — never deselect.
          onValueChange={(next) => {
            if (next) setRange(next as RangeValue);
          }}
          aria-label={t("usage.rangeLabel")}
          className="grid w-full grid-cols-3 gap-2 rounded-lg bg-muted p-1 sm:inline-grid sm:w-auto sm:grid-cols-[repeat(3,minmax(6rem,1fr))] md:gap-1"
        >
          {RANGES.map(({ value, i18nKey }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className={cn(
                "h-11 min-w-0 rounded-md px-3 text-sm md:h-8",
                "text-muted-foreground hover:bg-transparent hover:text-foreground",
                "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              )}
            >
              {t(i18nKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {error ? (
          <UsageError onRetry={refetch} />
        ) : loading || !usage ? (
          <UsageSkeleton />
        ) : (
          <>
            <TotalsRow usage={usage} percentMode={percentMode} />
            {empty ? (
              <p className="text-sm text-muted-foreground">
                {t("usage.empty")}
              </p>
            ) : (
              <>
                <UsageChart usage={usage} percentMode={percentMode} />
                <ModelTable usage={usage} percentMode={percentMode} />
              </>
            )}
          </>
        )}
      </FormSection>
    </>
  );
}

function UsageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function UsageError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{t("usage.error")}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t("usage.retry")}
      </Button>
    </div>
  );
}

function TotalsRow({
  usage,
  percentMode,
}: {
  usage: MyUsage;
  percentMode: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {!percentMode ? (
        <div>
          <dt className="text-muted-foreground">{t("usage.totalSpend")}</dt>
          <dd className="font-mono tabular-nums">
            {formatUsd(usage.totals.spend)}
          </dd>
        </div>
      ) : null}
      <div>
        <dt className="text-muted-foreground">{t("usage.totalTokens")}</dt>
        <dd className="font-mono tabular-nums">
          {formatCount(usage.totals.total_tokens)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("usage.totalRequests")}</dt>
        <dd className="font-mono tabular-nums">
          {formatCount(usage.totals.api_requests)}
        </dd>
      </div>
    </dl>
  );
}

const chartConfig: ChartConfig = {
  value: { label: "Value", color: "hsl(var(--chart-1))" },
};

function UsageChart({
  usage,
  percentMode,
}: {
  usage: MyUsage;
  percentMode: boolean;
}) {
  const t = useTranslations("settings");
  const metric = chartMetricFor(usage.display);
  const rows = React.useMemo(
    () =>
      fillDailySeries(usage.daily, usage.window).map((row) => ({
        date: row.date,
        value: row[metric],
      })),
    [usage, metric],
  );
  const formatValue = (v: number) =>
    percentMode ? formatCount(v) : formatUsd(v);

  return (
    <ChartContainer config={chartConfig} className="h-40 w-full">
      <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="settingsUsageFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="hsl(var(--chart-1))"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--chart-1))"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          tickMargin={6}
          fontSize={12}
          tickFormatter={(d: string) =>
            new Date(d).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={56}
          tickFormatter={(v: number) => formatValue(v)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              nameKey="value"
              formatter={(value) => [
                typeof value === "number" ? formatValue(value) : String(value),
                ` ${percentMode ? t("usage.colTokens") : t("usage.colSpend")}`,
              ]}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#settingsUsageFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function ModelTable({
  usage,
  percentMode,
}: {
  usage: MyUsage;
  percentMode: boolean;
}) {
  const t = useTranslations("settings");
  const showFailed = usage.byModel.some((m) => m.failed_requests > 0);
  // Backend sorts by spend; percent mode re-ranks by the visible metric.
  const rows = percentMode
    ? [...usage.byModel].sort((a, b) => b.total_tokens - a.total_tokens)
    : usage.byModel;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("usage.colModel")}</TableHead>
          <TableHead className="text-right">{t("usage.colRequests")}</TableHead>
          {showFailed ? (
            <TableHead className="text-right">{t("usage.colFailed")}</TableHead>
          ) : null}
          <TableHead className="text-right">{t("usage.colTokens")}</TableHead>
          {!percentMode ? (
            <TableHead className="text-right">{t("usage.colSpend")}</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.model}>
            <TableCell className="max-w-64 truncate font-mono text-xs">
              {m.model}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatCount(m.successful_requests + m.failed_requests)}
            </TableCell>
            {showFailed ? (
              <TableCell className="text-right font-mono tabular-nums">
                {formatCount(m.failed_requests)}
              </TableCell>
            ) : null}
            <TableCell className="text-right font-mono tabular-nums">
              {formatCount(m.total_tokens)}
            </TableCell>
            {!percentMode ? (
              <TableCell className="text-right font-mono tabular-nums">
                {formatUsd(m.spend)}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
