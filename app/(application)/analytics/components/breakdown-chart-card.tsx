"use client";

/**
 * BreakdownChartCard — replaces the legacy three side-by-side leaderboards
 * + the standalone donut with ONE ChartCard. Two controls in the header:
 *   - Dimension Tabs [Agents | Users | Projects | Roles] (scrollable below md)
 *   - View ToggleGroup [List | Share]
 *
 * Both views consume the SAME measure (from the explore toolbar's Tabs)
 * and the SAME range (lens) — the legacy hidden cross-section coupling
 * (analytics.md UX#4 / bug 2.e) becomes physically visible: one card, one
 * scope row.
 *
 * Per-dimension query map:
 *   - agents → GET_AGENT_STATISTICS (no hydration; labels are agent names)
 *   - users  → GET_USER_STATISTICS + GET_USERS_BY_IDS (hydration only when
 *              the tab is active)
 *   - projects → GET_PROJECT_STATISTICS + GET_PROJECTS_BY_IDS (likewise)
 *   - roles  → GET_DONUT_STATISTICS with groupBy="role" (no hydration query
 *              exists yet — gated by ANALYTICS_ROLE_HYDRATION_SUPPORTED;
 *              fallback shows raw group values, identical to today's donut)
 */

import { useQuery } from "@apollo/client";
import { LayoutList, PieChart as PieIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ChartCard } from "@/components/primitives/chart-card";
import { EmptyState } from "@/components/primitives/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ANALYTICS_ROLE_HYDRATION_SUPPORTED } from "@/lib/analytics-supported";

import { DonutView, type DonutEntry } from "./donut-view";
import { RankedList, type RankedListEntry } from "./ranked-list";
import {
  DIMENSIONS,
  resolveWindow,
  type Dimension,
  type Lens,
} from "../hooks";
import {
  GET_AGENT_STATISTICS,
  GET_DONUT_STATISTICS,
  GET_PROJECTS_BY_IDS,
  GET_PROJECT_STATISTICS,
  GET_USERS_BY_IDS,
  GET_USER_STATISTICS,
} from "../queries";

export interface BreakdownChartCardProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
}

const DIMENSION_LABEL_KEYS: Record<Dimension, string> = {
  agents: "breakdown.dimAgents",
  users: "breakdown.dimUsers",
  projects: "breakdown.dimProjects",
  roles: "breakdown.dimRoles",
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

function transformGroupValue(value: unknown): string {
  if (typeof value !== "string" || !value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
}

export function BreakdownChartCard({ lens, onLensChange }: BreakdownChartCardProps) {
  const t = useTranslations("analytics");
  const window = React.useMemo(() => resolveWindow(lens), [lens]);

  const names =
    lens.measure === "tokens" ? ["inputTokens", "outputTokens"] : ["count"];

  // ---- Per-dimension query selection (only the active one fires) ---------
  const agentsQuery = useQuery(GET_AGENT_STATISTICS, {
    variables: { from: window.current.from, to: window.current.to, names },
    skip: lens.dimension !== "agents",
  });
  const usersQuery = useQuery(GET_USER_STATISTICS, {
    variables: { from: window.current.from, to: window.current.to, names },
    skip: lens.dimension !== "users",
  });
  const projectsQuery = useQuery(GET_PROJECT_STATISTICS, {
    variables: { from: window.current.from, to: window.current.to, names },
    skip: lens.dimension !== "projects",
  });
  const rolesQuery = useQuery(GET_DONUT_STATISTICS, {
    variables: {
      type: lens.type,
      groupBy: "role",
      from: window.current.from,
      to: window.current.to,
      names,
    },
    skip: lens.dimension !== "roles",
  });

  // ---- ID lists for hydration (top N only) -------------------------------
  const userIds = React.useMemo(
    () =>
      (usersQuery.data?.trackingStatistics ?? [])
        .filter((row: { group?: string | null; count?: number | null }) => row?.group && row?.count)
        .map((row: { group: string }) => row.group)
        .slice(0, 10),
    [usersQuery.data],
  );
  const projectIds = React.useMemo(
    () =>
      (projectsQuery.data?.trackingStatistics ?? [])
        .filter((row: { group?: string | null; count?: number | null }) => row?.group && row?.count)
        .map((row: { group: string }) => row.group)
        .slice(0, 10),
    [projectsQuery.data],
  );

  const usersHydration = useQuery(GET_USERS_BY_IDS, {
    variables: { ids: userIds },
    skip: lens.dimension !== "users" || userIds.length === 0,
  });
  const projectsHydration = useQuery(GET_PROJECTS_BY_IDS, {
    variables: { ids: projectIds },
    skip: lens.dimension !== "projects" || projectIds.length === 0,
  });

  // ---- Build entries for the active dimension ----------------------------
  const { entries, loading, error } = React.useMemo(() => {
    type DimResult = {
      entries: Array<{ id: string; name: string; value: number }>;
      loading: boolean;
      error: { message: string; onRetry: () => void } | null;
    };

    const empty = (): DimResult => ({ entries: [], loading: false, error: null });

    const buildError = (
      e: { message: string } | undefined | null,
      onRetry: () => void,
    ): { message: string; onRetry: () => void } | null =>
      e ? { message: e.message || t("errors.generic"), onRetry } : null;

    if (lens.dimension === "agents") {
      const rows = (agentsQuery.data?.trackingStatistics ?? []) as Array<{ group?: string | null; count?: number | null }>;
      const items = rows
        .filter((r) => r?.group && r?.count)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .map((r) => ({ id: String(r.group), name: String(r.group), value: r.count ?? 0 }));
      return {
        entries: items,
        loading: agentsQuery.loading && !agentsQuery.data,
        error: buildError(agentsQuery.error ?? null, () => void agentsQuery.refetch()),
      };
    }

    if (lens.dimension === "users") {
      const rows = (usersQuery.data?.trackingStatistics ?? []) as Array<{ group?: string | null; count?: number | null }>;
      const hydrated = (usersHydration.data?.userByIds ?? []) as HydrationEntity[];
      const items = rows
        .filter((r) => r?.group && r?.count)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .map((r) => {
          const groupId = String(r.group);
          const match = hydrated.find((h) =>
            typeof h.id === "number" ? h.id === Number(groupId) : String(h.id) === groupId,
          );
          const name = match ? entityLabel(match, groupId) : groupId;
          return { id: groupId, name, value: r.count ?? 0 };
        });
      return {
        entries: items,
        loading:
          (usersQuery.loading && !usersQuery.data) ||
          (userIds.length > 0 && usersHydration.loading && !usersHydration.data),
        error: buildError(usersQuery.error ?? null, () => void usersQuery.refetch()),
      };
    }

    if (lens.dimension === "projects") {
      const rows = (projectsQuery.data?.trackingStatistics ?? []) as Array<{ group?: string | null; count?: number | null }>;
      const hydrated = (projectsHydration.data?.projectByIds ?? []) as HydrationEntity[];
      const items = rows
        .filter((r) => r?.group && r?.count)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .map((r) => {
          const groupId = String(r.group);
          const match = hydrated.find((h) =>
            typeof h.id === "number" ? h.id === Number(groupId) : String(h.id) === groupId,
          );
          const name = match ? entityLabel(match, groupId) : groupId;
          return { id: groupId, name, value: r.count ?? 0 };
        });
      return {
        entries: items,
        loading:
          (projectsQuery.loading && !projectsQuery.data) ||
          (projectIds.length > 0 && projectsHydration.loading && !projectsHydration.data),
        error: buildError(projectsQuery.error ?? null, () => void projectsQuery.refetch()),
      };
    }

    // Roles: GET_DONUT_STATISTICS with groupBy="role" — no by-ids hydration
    // (gate ANALYTICS_ROLE_HYDRATION_SUPPORTED = false, documented fallback).
    if (lens.dimension === "roles") {
      const rows = (rolesQuery.data?.trackingStatistics ?? []) as Array<{ group?: string | null; count?: number | null }>;
      const items = rows
        .filter((r) => r?.group && r?.count)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .map((r) => ({
          id: String(r.group),
          name: ANALYTICS_ROLE_HYDRATION_SUPPORTED
            ? String(r.group) // placeholder — real hydration ships behind the flag
            : transformGroupValue(r.group),
          value: r.count ?? 0,
        }));
      return {
        entries: items,
        loading: rolesQuery.loading && !rolesQuery.data,
        error: buildError(rolesQuery.error ?? null, () => void rolesQuery.refetch()),
      };
    }

    return empty();
  }, [lens.dimension, agentsQuery, usersQuery, usersHydration, projectsQuery, projectsHydration, rolesQuery, userIds.length, projectIds.length, t]);

  const unitLabel =
    lens.measure === "tokens"
      ? t("breakdown.valueLabelTokens")
      : t("breakdown.valueLabelCalls");

  const description =
    lens.measure === "tokens"
      ? t("breakdown.subtitleByTokens")
      : t("breakdown.subtitleByCalls");

  const toolbar = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <Tabs
        value={lens.dimension}
        onValueChange={(value) => onLensChange({ dimension: value as Dimension })}
        className="w-full sm:w-auto"
      >
        <TabsList
          className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto"
          aria-label={t("breakdown.title")}
        >
          {DIMENSIONS.map((dim) => (
            <TabsTrigger
              key={dim}
              value={dim}
              className="px-2 text-xs sm:px-3 sm:text-sm"
            >
              {t(DIMENSION_LABEL_KEYS[dim])}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
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

  return (
    <ChartCard
      title={t("breakdown.title")}
      description={description}
      toolbar={toolbar}
      loading={loading}
      error={error}
    >
      {entries.length === 0 ? (
        <EmptyState
          variant="quiet"
          title={t("breakdown.emptyTitle")}
          description={t("breakdown.emptyHint")}
        />
      ) : lens.view === "share" ? (
        <DonutView entries={entries as DonutEntry[]} unitLabel={unitLabel} />
      ) : (
        <RankedList entries={entries as RankedListEntry[]} unitLabel={unitLabel} max={10} />
      )}
    </ChartCard>
  );
}

