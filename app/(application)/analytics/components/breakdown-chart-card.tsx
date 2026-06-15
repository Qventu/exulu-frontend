"use client";

/**
 * BreakdownChartCard — one ChartCard with two controls in the header:
 *   - Dimension Tabs [Agents | Users | Projects | Teams | Roles]
 *     (scrollable below md)
 *   - View ToggleGroup [List | Share]
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
 *   - teams    → DOCUMENTED FALLBACK: raw team id (GET_TEAMS_BY_IDS not
 *                shipped yet; analytics.md §4 follow-up)
 *   - roles    → DOCUMENTED FALLBACK: raw role id (GET_ROLES_BY_IDS not
 *                shipped yet; analytics.md §4 follow-up)
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

import { DonutView, type DonutEntry } from "./donut-view";
import { RankedList, type RankedListEntry } from "./ranked-list";
import {
  DIMENSIONS,
  useActivityByTag,
  type Dimension,
  type Lens,
} from "../hooks";
import {
  GET_AGENTS_BY_IDS,
  GET_PROJECTS_BY_IDS,
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

export function BreakdownChartCard({ lens, onLensChange }: BreakdownChartCardProps) {
  const t = useTranslations("analytics");

  const { rows, loading, error, refetch } = useActivityByTag(lens);

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

  const entries = React.useMemo(() => {
    const hydrationList: HydrationEntity[] = (() => {
      if (lens.dimension === "agents") {
        return (agentsHydration.data?.agentByIds ?? []) as HydrationEntity[];
      }
      if (lens.dimension === "users") {
        return (usersHydration.data?.userByIds ?? []) as HydrationEntity[];
      }
      if (lens.dimension === "projects") {
        return (projectsHydration.data?.projectByIds ?? []) as HydrationEntity[];
      }
      return [];
    })();

    return rows.map((row) => {
      const idStr = row.id ?? row.tag;
      const match = hydrationList.find((h) =>
        typeof h.id === "number" ? h.id === Number(idStr) : String(h.id) === idStr,
      );
      const name = match ? entityLabel(match, idStr) : idStr;
      return { id: idStr, name, value: row.value };
    });
  }, [rows, lens.dimension, agentsHydration.data, usersHydration.data, projectsHydration.data]);

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
      !projectsHydration.data);

  const unitLabel =
    lens.measure === "spend"
      ? t("breakdown.valueLabelSpend")
      : lens.measure === "tokens"
        ? t("breakdown.valueLabelTokens")
        : t("breakdown.valueLabelRequests");

  const description =
    lens.measure === "spend"
      ? t("breakdown.subtitleBySpend")
      : lens.measure === "tokens"
        ? t("breakdown.subtitleByTokens")
        : t("breakdown.subtitleByRequests");

  const cardError = error
    ? { message: error.message || t("errors.generic"), onRetry: () => refetch() }
    : null;

  const toolbar = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <Tabs
        value={lens.dimension}
        onValueChange={(value) => onLensChange({ dimension: value as Dimension })}
        className="w-full sm:w-auto"
      >
        <TabsList
          className="grid w-full grid-cols-5 sm:inline-flex sm:w-auto"
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
          description={t("breakdown.emptyHint")}
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
