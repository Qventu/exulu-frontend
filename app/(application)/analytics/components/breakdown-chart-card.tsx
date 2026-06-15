"use client";

/**
 * BreakdownChartCard — one ChartCard with the view toggle in the header:
 *   - View ToggleGroup [List | Share]
 *
 * The dimension picker now lives in the page header (DimensionPicker in
 * analytics-view.tsx) so the breakdown scope is reachable at-a-glance
 * regardless of which card the user has focus on. This card still
 * consumes lens.dimension as before — only the control moved.
 *
 * Source is /admin/litellm/tag-activity (via useActivityByTag). The
 * backend filters byTag[] by tag_prefix matching the active dimension
 * (DIMENSION_TAG_PREFIX in ../lens). Each row carries the stripped id;
 * the frontend hydrates ids → human names via GraphQL (Postgres is the
 * source of truth for names — LiteLLM tags only carry stable ids).
 *
 * Hydration coverage (architect plan §tagTaxonomy):
 *   - agents   → GET_AGENTS_BY_IDS (hydrated)
 *   - users    → GET_USERS_BY_IDS (hydrated)
 *   - projects → GET_PROJECTS_BY_IDS (hydrated)
 *   - routines → GET_ROUTINES_BY_IDS (hydrated, Phase 3.3.2)
 *   - teams    → DOCUMENTED FALLBACK: raw team id (GET_TEAMS_BY_IDS not
 *                shipped yet; analytics.md §4 follow-up)
 *   - roles    → DOCUMENTED FALLBACK: raw role id (GET_ROLES_BY_IDS not
 *                shipped yet; analytics.md §4 follow-up)
 */

import { useQuery } from "@apollo/client";
import { eachDayOfInterval, format } from "date-fns";
import { Download, LayoutList, Loader2, PieChart as PieIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ChartCard } from "@/components/primitives/chart-card";
import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { DonutView, type DonutEntry } from "./donut-view";
import { RankedList, type RankedListEntry } from "./ranked-list";
import {
  DIMENSION_TAG_PREFIX,
  useActivityByTag,
  useTagActivity,
  resolveWindow,
  type Dimension,
  type Lens,
  type TagActivityQuery,
} from "../hooks";
import {
  GET_AGENTS_BY_IDS,
  GET_PROJECTS_BY_IDS,
  GET_ROUTINES_BY_IDS,
  GET_USERS_BY_IDS,
} from "../queries";

export interface BreakdownChartCardProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
}

const DIMENSION_LABEL_KEYS: Record<Dimension, string> = {
  agents: "breakdown.dimAgents",
  users: "breakdown.dimUsers",
  projects: "breakdown.dimProjects",
  teams: "breakdown.dimTeams",
  roles: "breakdown.dimRoles",
  routines: "breakdown.dimRoutines",
};

interface HydrationEntity {
  id: string | number;
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
}

function entityLabel(entity: HydrationEntity, fallback: string): string {
  return (
    entity.name ||
    [entity.firstname, entity.lastname].filter(Boolean).join(" ").trim() ||
    entity.email ||
    fallback
  );
}

/**
 * CSV field escape — quotes the value + doubles internal quotes when the
 * input contains a special character (comma / quote / CR / LF). Otherwise
 * the value is returned as-is to keep the output readable.
 */
function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function BreakdownChartCard({ lens, onLensChange }: BreakdownChartCardProps) {
  const t = useTranslations("analytics");

  const { rows, loading, error, refetch } = useActivityByTag(lens);

  // CSV export needs the raw byTagByDay matrix — useActivityByTag projects
  // to scalar rows. We re-fire the SAME query (path is memoised by lens) so
  // the network cache reuses the response; the cost is one extra hook here.
  const rawRange = React.useMemo(() => resolveWindow(lens), [lens]);
  const rawQuery = React.useMemo<TagActivityQuery>(
    () => ({
      start_date: rawRange.current.from,
      end_date: rawRange.current.to,
      tag_prefix: DIMENSION_TAG_PREFIX[lens.dimension],
    }),
    [rawRange.current.from, rawRange.current.to, lens.dimension],
  );
  const rawActivity = useTagActivity(rawQuery);

  // Top-10 ids for hydration. The byTag[] is already sorted desc by value
  // in useActivityByTag, so .slice(0, 10) gives the top contributors.
  const topIds = React.useMemo(
    () =>
      rows
        .filter((r) => r.id != null)
        .slice(0, 10)
        .map((r) => r.id as string),
    [rows],
  );

  const agentsHydration = useQuery(GET_AGENTS_BY_IDS, {
    variables: { ids: topIds },
    skip: lens.dimension !== "agents" || topIds.length === 0,
  });
  const usersHydration = useQuery(GET_USERS_BY_IDS, {
    variables: { ids: topIds },
    skip: lens.dimension !== "users" || topIds.length === 0,
  });
  const projectsHydration = useQuery(GET_PROJECTS_BY_IDS, {
    variables: { ids: topIds },
    skip: lens.dimension !== "projects" || topIds.length === 0,
  });
  const routinesHydration = useQuery(GET_ROUTINES_BY_IDS, {
    variables: { ids: topIds },
    skip: lens.dimension !== "routines" || topIds.length === 0,
  });

  const hydrationList: HydrationEntity[] = React.useMemo(() => {
    if (lens.dimension === "agents") {
      return (agentsHydration.data?.agentByIds ?? []) as HydrationEntity[];
    }
    if (lens.dimension === "users") {
      return (usersHydration.data?.userByIds ?? []) as HydrationEntity[];
    }
    if (lens.dimension === "projects") {
      return (projectsHydration.data?.projectByIds ?? []) as HydrationEntity[];
    }
    if (lens.dimension === "routines") {
      return (routinesHydration.data?.workflow_templatesPagination?.items ?? []) as HydrationEntity[];
    }
    return [];
  }, [lens.dimension, agentsHydration.data, usersHydration.data, projectsHydration.data, routinesHydration.data]);

  // Index hydrated entities by id (stringified) for O(1) lookups in both the
  // ranked entries below AND the CSV-export pivot in handleExport.
  const hydrationMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hydrationList) {
      map.set(String(h.id), entityLabel(h, String(h.id)));
    }
    return map;
  }, [hydrationList]);

  const entries = React.useMemo(() => {
    return rows.map((row) => {
      const idStr = row.id ?? row.tag;
      const name = hydrationMap.get(idStr) ?? idStr;
      return { id: idStr, name, value: row.value };
    });
  }, [rows, hydrationMap]);

  const hydrationLoading =
    (lens.dimension === "agents" &&
      topIds.length > 0 &&
      agentsHydration.loading &&
      !agentsHydration.data) ||
    (lens.dimension === "users" &&
      topIds.length > 0 &&
      usersHydration.loading &&
      !usersHydration.data) ||
    (lens.dimension === "projects" &&
      topIds.length > 0 &&
      projectsHydration.loading &&
      !projectsHydration.data) ||
    (lens.dimension === "routines" &&
      topIds.length > 0 &&
      routinesHydration.loading &&
      !routinesHydration.data);

  const unitLabel =
    lens.measure === "spend"
      ? t("breakdown.valueLabelSpend")
      : lens.measure === "tokens"
        ? t("breakdown.valueLabelTokens")
        : t("breakdown.valueLabelRequests");

  const measureLabel =
    lens.measure === "spend"
      ? t("breakdown.subtitleBySpend")
      : lens.measure === "tokens"
        ? t("breakdown.subtitleByTokens")
        : t("breakdown.subtitleByRequests");

  const dimensionLabel = t(DIMENSION_LABEL_KEYS[lens.dimension]);
  const description = `${dimensionLabel} · ${measureLabel}`;

  const cardError = error
    ? { message: error.message || t("errors.generic"), onRetry: () => refetch() }
    : null;

  const handleExport = React.useCallback(() => {
    const data = rawActivity.data;
    if (!data) return;
    const { window: w, byTagByDay, byTag } = data;
    const prefix = DIMENSION_TAG_PREFIX[lens.dimension];
    // Sorted-by-value Top-N order for the active dimension.
    const dimensionTags = byTag
      .filter((r) => r.tag.startsWith(prefix))
      .slice(0, 10);
    // Build a zero-fill date axis from the requested window.
    const startDate = new Date(`${w.start_date.slice(0, 10)}T00:00:00Z`);
    const endDate = new Date(`${w.end_date.slice(0, 10)}T00:00:00Z`);
    const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(
      (d) => format(d, "yyyy-MM-dd"),
    );
    // Index cells by `${tag}|${date}` for O(1) lookup.
    const cellIndex = new Map(
      (byTagByDay ?? []).map((r) => [`${r.tag}|${r.date}`, r] as const),
    );
    const measureKey: "spend" | "total_tokens" | "successful_requests" =
      lens.measure === "spend"
        ? "spend"
        : lens.measure === "tokens"
          ? "total_tokens"
          : "successful_requests";
    const header = ["Entity", ...dates, "Total"];
    const lines: string[] = [header.map(csvEscape).join(",")];
    for (const tagRow of dimensionTags) {
      const idStr = tagRow.id ?? tagRow.tag;
      const hydratedName = hydrationMap.get(String(idStr)) ?? idStr;
      let total = 0;
      const cells = dates.map((d) => {
        const cell = cellIndex.get(`${tagRow.tag}|${d}`);
        const v = cell ? (cell[measureKey] ?? 0) : 0;
        total += v;
        return measureKey === "spend" ? v.toFixed(6) : String(v);
      });
      lines.push(
        [
          csvEscape(hydratedName),
          ...cells,
          measureKey === "spend" ? total.toFixed(6) : String(total),
        ].join(","),
      );
    }
    // BOM prefix so Excel opens UTF-8 cleanly.
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${lens.dimension}-${lens.measure}-${w.start_date.slice(0, 10)}-${w.end_date.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rawActivity.data, lens.dimension, lens.measure, hydrationMap]);

  const exportDisabled =
    loading ||
    hydrationLoading ||
    rawActivity.loading ||
    !rawActivity.data ||
    rows.length === 0;

  const toolbar = (
    <div className="flex w-full items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 max-md:h-11"
        onClick={handleExport}
        disabled={exportDisabled}
        aria-label={t("header.exportCsvAria")}
      >
        {rawActivity.loading ? (
          <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
        ) : (
          <Download aria-hidden="true" className="mr-2 size-4" />
        )}
        <span className="truncate text-xs sm:text-sm">{t("header.exportCsv")}</span>
      </Button>
      <TooltipProvider delayDuration={200}>
        <ToggleGroup
          type="single"
          value={lens.view}
          onValueChange={(value) => {
            if (value === "list" || value === "share") onLensChange({ view: value });
          }}
          aria-label={t("breakdown.title")}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value="list"
                aria-label={t("breakdown.viewListAria")}
                className="max-md:h-11 max-md:w-11"
              >
                <LayoutList aria-hidden="true" className="size-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{t("breakdown.viewList")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value="share"
                aria-label={t("breakdown.viewShareAria")}
                className="max-md:h-11 max-md:w-11"
              >
                <PieIcon aria-hidden="true" className="size-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{t("breakdown.viewShare")}</TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </TooltipProvider>
    </div>
  );

  const isLoading = loading || hydrationLoading;

  return (
    <ChartCard
      title={t("breakdown.title")}
      description={description}
      toolbar={toolbar}
      loading={isLoading}
      error={cardError}
    >
      {entries.length === 0 ? (
        <EmptyState
          variant="quiet"
          title={t("breakdown.emptyTitle")}
          description={
            // teams/roles: GET_TEAMS_BY_IDS / GET_ROLES_BY_IDS not shipped
            // yet (file header :19-22, analytics.md §4 follow-up). Name the
            // gap in the empty state so the dimension switch isn't silent
            // about its hydration state.
            lens.dimension === "teams" || lens.dimension === "roles"
              ? t("breakdown.emptyHintRawIds")
              : t("breakdown.emptyHint")
          }
        />
      ) : lens.view === "share" ? (
        <DonutView
          entries={entries as DonutEntry[]}
          unitLabel={unitLabel}
          measure={lens.measure}
        />
      ) : (
        <RankedList
          entries={entries as RankedListEntry[]}
          unitLabel={unitLabel}
          measure={lens.measure}
          max={10}
        />
      )}
    </ChartCard>
  );
}
