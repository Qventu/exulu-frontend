"use client";

/**
 * The map card: it fetches, it owns the selection and the controls, and it
 * mounts the renderer and the panel. It is deliberately ignorant of which
 * surface it sits on — the memory base page and the knowledge workspace both
 * render it, and feature-isolation lint forbids either from importing the
 * other's code, so everything surface-specific arrives as a prop.
 */

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { ChartCard } from "@/components/primitives/chart-card";
import { EmptyState } from "@/components/primitives/empty-state";
import { LG_QUERY, useMediaQuery } from "@/components/primitives/side-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GET_CONTEXT_MAP_EDGES,
  GET_CONTEXT_MAP_POINTS,
  GET_CONTEXT_MAP_TOPICS,
  GET_CONTEXT_PROJECTION_STATUS,
} from "@/lib/graphql/operations/context-map";

import type { MapCanvasHandle } from "./map-canvas";
import {
  coverageCaption,
  legendEntries,
  NO_VALUE_TOKEN,
  PALETTE_TOKENS,
  RING_TOKEN,
  topicOf,
  type MapEdge,
  type MapPoint,
  type MapTopic,
} from "./map-data";
import { MapPanel } from "./map-panel";

/**
 * three.js is ~600 KB and the file that imports it also opens a WebGL context,
 * so the renderer is loaded on demand with server rendering off — the pattern
 * `components/primitives/markdown-editor.tsx` already uses. Keep this a
 * module-level constant: calling dynamic() during a render would make a new
 * component type on every pass and remount the scene.
 */
const MapCanvas = dynamic(
  () => import("./map-canvas").then((m) => m.MapCanvas),
  { ssr: false, loading: () => <Skeleton className="h-[28rem] w-full" /> },
);

/** The cap the points query is asked for; the caption admits when it bites. */
const POINTS_LIMIT = 20000;

// Stable empties. A fresh [] or Set() per render would re-upload every buffer
// in the renderer each time this card re-renders — and it re-renders on every
// pointer move over the panel's neighbour list.
const NO_IDS: Set<string> = new Set();
const NO_POINTS: MapPoint[] = [];
const NO_TOPICS: MapTopic[] = [];
const NO_EDGES: MapEdge[] = [];

type PointsAnswer = {
  contextMapPoints: {
    points: MapPoint[];
    total: number;
    sampled: boolean;
  } | null;
};

export interface ContextMapCardProps {
  contextId: string;
  /** The base's declared enum values, in declared order. Empty means one colour. */
  groups: string[];
  groupField: string | null;
  ringedIds?: Set<string>;
  itemHref: (itemId: string) => string;
  titleKey: "memory" | "knowledge";
}

export function ContextMapCard({
  contextId,
  groups,
  groupField,
  ringedIds,
  itemHref,
  titleKey,
}: ContextMapCardProps) {
  const t = useTranslations("map");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canvasRef = React.useRef<MapCanvasHandle>(null);

  const selectedId = params?.get("selected") ?? null;
  const highlightTopic = params?.get("topic") ?? null;
  const [paused, setPaused] = React.useState(false);
  const [allLinks, setAllLinks] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState(false);
  const [hoverNeighbour, setHoverNeighbour] = React.useState<string | null>(
    null,
  );

  const setParam = (key: string, value: string | null) => {
    const url = new URLSearchParams(params?.toString() ?? "");
    if (value === null) url.delete(key);
    else url.set(key, value);
    const query = url.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const pointsQuery = useQuery<PointsAnswer>(GET_CONTEXT_MAP_POINTS, {
    variables: {
      contextId,
      mode: "PASSAGES",
      groupField,
      limit: POINTS_LIMIT,
    },
    fetchPolicy: "cache-and-network",
  });
  const topicsQuery = useQuery<{ contextMapTopics: MapTopic[] }>(
    GET_CONTEXT_MAP_TOPICS,
    { variables: { contextId } },
  );
  const statusQuery = useQuery<{
    contextProjectionStatus: {
      fitted: boolean;
      mappedChunks: number;
      totalChunks: number;
    } | null;
  }>(GET_CONTEXT_PROJECTION_STATUS, {
    variables: { contextId },
    fetchPolicy: "cache-and-network",
  });
  // Relations are asked for per selection, never on mount.
  const edgesQuery = useQuery<{ contextMapEdges: MapEdge[] }>(
    GET_CONTEXT_MAP_EDGES,
    {
      variables: { contextId, nodeId: selectedId, mode: "PASSAGES" },
      skip: selectedId === null,
    },
  );

  // `contextMapPoints` is nullable in the schema: a resolver that answers null
  // is not an error and must not throw on the way to the empty state.
  const answer = pointsQuery.data?.contextMapPoints ?? null;
  const points = React.useMemo(() => answer?.points ?? NO_POINTS, [answer]);
  const topics = React.useMemo(
    () => topicsQuery.data?.contextMapTopics ?? NO_TOPICS,
    [topicsQuery.data],
  );
  const edges = React.useMemo(
    () => edgesQuery.data?.contextMapEdges ?? NO_EDGES,
    [edgesQuery.data],
  );
  const status = statusQuery.data?.contextProjectionStatus ?? null;

  // `groups` is a prop, and the surfaces above build it from a context's
  // declared fields — quite possibly inline, i.e. a new array identity on
  // every one of their renders. The renderer rebuilds its colour buffer when
  // this changes, so it is pinned to the values rather than to the array.
  const groupsKey = groups.join("\u0000");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableGroups = React.useMemo(() => groups, [groupsKey]);

  /**
   * Which passages the highlighted region holds. A MapPoint records its
   * grouping value, never its region, so membership is "nearest centre" —
   * which is exactly what the clustering computed.
   */
  const topicMemberIds = React.useMemo(() => {
    if (highlightTopic === null) return NO_IDS;
    const members = new Set<string>();
    for (const point of points) {
      if (topicOf(point, topics) === highlightTopic) members.add(point.id);
    }
    return members;
  }, [highlightTopic, points, topics]);

  const byId = React.useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  );
  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null);
  // A shared link can name a passage this viewer may not read: the points
  // answer is access-scoped, so it simply is not here.
  const missing =
    selectedId !== null && selected === null && !pointsQuery.loading;

  const caption = coverageCaption({
    drawn: points.length,
    total: answer?.total ?? points.length,
    sampled: answer?.sampled ?? false,
    mapped: status?.mappedChunks ?? 0,
    totalChunks: status?.totalChunks ?? 0,
  });

  const notMapped = status !== null && !status.fitted;
  const pointsFailed = pointsQuery.error !== undefined;
  // Both answers gate the first paint: without the status a base that was
  // never fitted would flash "no passages" before saying so.
  const loadingCloud =
    (pointsQuery.loading || statusQuery.loading) && points.length === 0;
  /** True only when there is a cloud for the controls to act on. */
  const drawing = !unsupported && !notMapped && !pointsFailed;
  /** True once there is a cloud on screen, which is what the rows below read. */
  const drawn = drawing && !loadingCloud && points.length > 0;

  // Grey is the palette's reserved "no value", and the legend only has to name
  // it when something on screen actually carries it.
  const hasUnvalued = React.useMemo(
    () =>
      stableGroups.length > 0 &&
      points.some(
        (point) => point.group === null || !stableGroups.includes(point.group),
      ),
    [points, stableGroups],
  );
  const ringed = ringedIds ?? NO_IDS;
  const showLegend = stableGroups.length > 0 || ringed.size > 0;

  const select = (id: string | null) => setParam("selected", id);

  // `undefined` until hydration, which is not "large": below lg the panel is a
  // sheet, and a sheet open from first paint would cover the map on a phone.
  // At lg it is docked and part of the layout, so closing it means closing the
  // passage — the title falls back to the overview.
  const isDocked = useMediaQuery(LG_QUERY);
  const panelOpen = selectedId !== null || isDocked === true;

  return (
    <div
      className="flex flex-col gap-4 lg:flex-row"
      data-testid="context-map-card"
    >
      <ChartCard
        className="min-w-0 flex-1"
        title={t(`title.${titleKey}`)}
        description={t("caption.intro")}
        error={
          pointsFailed
            ? {
                message: t("error.points"),
                onRetry: () => void pointsQuery.refetch(),
              }
            : null
        }
        toolbar={
          drawing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Tabs
                value={allLinks ? "all" : "selection"}
                onValueChange={(value) => setAllLinks(value === "all")}
              >
                <TabsList>
                  <TabsTrigger value="all">{t("links.all")}</TabsTrigger>
                  <TabsTrigger value="selection">
                    {t("links.selection")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaused((previous) => !previous)}
              >
                {paused ? t("controls.resume") : t("controls.pause")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => canvasRef.current?.reset()}
              >
                {t("controls.reset")}
              </Button>
            </div>
          ) : undefined
        }
      >
        {unsupported ? (
          <EmptyState variant="quiet" title={t("empty.noWebgl")} />
        ) : notMapped ? (
          <EmptyState
            variant="quiet"
            title={t("empty.notMapped")}
            description={t("empty.notMappedHow")}
          />
        ) : loadingCloud ? (
          <Skeleton className="h-[28rem] w-full" />
        ) : points.length === 0 ? (
          <EmptyState variant="quiet" title={t("empty.noPassages")} />
        ) : (
          <div className="h-[28rem]">
            <MapCanvas
              ref={canvasRef}
              points={points}
              topics={topics}
              groups={stableGroups}
              edges={edges}
              selectedId={selectedId}
              highlightTopic={highlightTopic}
              topicMemberIds={topicMemberIds}
              ringedIds={ringed}
              paused={paused}
              allLinks={allLinks}
              hoverNeighbourId={hoverNeighbour}
              onSelect={select}
              onUnsupported={() => setUnsupported(true)}
            />
          </div>
        )}

        {drawn && topics.length > 0 && (
          <div
            className="flex flex-wrap gap-2 pt-4"
            role="group"
            aria-label={t("topics.heading")}
          >
            {topics.map((topic) => (
              <Button
                key={topic.id}
                type="button"
                size="sm"
                variant={highlightTopic === topic.id ? "default" : "outline"}
                aria-pressed={highlightTopic === topic.id}
                onClick={() =>
                  setParam(
                    "topic",
                    highlightTopic === topic.id ? null : topic.id,
                  )
                }
              >
                {topic.label}
                <span className="ml-2 text-xs tabular-nums opacity-70">
                  {topic.count}
                </span>
              </Button>
            ))}
          </div>
        )}

        {drawn && showLegend && (
          <div className="flex flex-wrap items-center gap-3 pt-3">
            {legendEntries(stableGroups).map((entry) => (
              <span
                key={entry.value}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: `hsl(var(${
                      PALETTE_TOKENS[entry.index % PALETTE_TOKENS.length]
                    }))`,
                  }}
                />
                {entry.value}
              </span>
            ))}
            {hasUnvalued && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: `hsl(var(${NO_VALUE_TOKEN}))` }}
                />
                {t("legend.noValue")}
              </span>
            )}
            {ringed.size > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full border-2 bg-transparent"
                  // The ring colour is the renderer's, read from the same token
                  // it resolves, so the swatch cannot drift from the dots.
                  style={{ borderColor: `hsl(var(${RING_TOKEN}))` }}
                />
                {t("legend.ringed")}
              </span>
            )}
          </div>
        )}

        {drawn && caption !== null && (
          <p className="pt-2 text-xs text-muted-foreground">
            {t(caption.key, caption.values)}
          </p>
        )}
        {drawn && (
          <p className="pt-1 text-xs text-muted-foreground">
            {t("caption.private")}
          </p>
        )}
      </ChartCard>

      <MapPanel
        open={panelOpen}
        onOpenChange={(next) => {
          if (!next && selectedId !== null) setParam("selected", null);
        }}
        selected={selected}
        missing={missing}
        topics={topics}
        edges={edges}
        edgesError={edgesQuery.error !== undefined}
        byId={byId}
        itemHref={itemHref}
        onSelect={select}
        onHoverNeighbour={setHoverNeighbour}
      />
    </div>
  );
}
