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
import { useSearchParams } from "next/navigation";
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

/**
 * How many passages to draw. This is the API's own default, not its cap of
 * 20,000: the cap measures at about 5.8 MB uncompressed, 2.4 MB of which is
 * label text that only the tooltip and the panel ever read. The caption below
 * the cloud already says how many of how many are drawn when the limit bites.
 */
const POINTS_LIMIT = 5000;

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
  /**
   * Items in a conflict group. ITEM ids, not passage ids: a surface's
   * conflicts data names memories, and the translation to passages needs the
   * points answer, which only this card holds.
   */
  ringedItemIds?: Set<string>;
  itemHref: (itemId: string) => string;
  titleKey: "memory" | "knowledge";
}

export function ContextMapCard({
  contextId,
  groups,
  groupField,
  ringedItemIds,
  itemHref,
  titleKey,
}: ContextMapCardProps) {
  const t = useTranslations("map");
  const tCommon = useTranslations("common");
  const params = useSearchParams();
  const canvasRef = React.useRef<MapCanvasHandle>(null);

  /**
   * The selection and the requested region are component state, not route
   * state.
   *
   * This page is dynamic, so writing them through the router costs a server
   * round-trip before the dot even lights up, and if the route's loading state
   * swaps in the canvas unmounts: camera reset, WebGL context recreated, the
   * whole cloud refetched. `app/(application)/chat/hooks.ts` documents the same
   * hazard and answers it the same way, and the memory table beside this card
   * keeps its own state and never writes the URL at all.
   *
   * Read once from the search parameters, so a shared link still opens on the
   * passage and the region it names, and mirrored back below so the link stays
   * shareable. Nothing is lost: a `replace` had no back-button behaviour to
   * preserve.
   */
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => params?.get("selected") ?? null,
  );
  const [requestedTopic, setRequestedTopic] = React.useState<string | null>(
    () => params?.get("topic") ?? null,
  );
  const [paused, setPaused] = React.useState(false);
  const [allLinks, setAllLinks] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState(false);
  const [hoverNeighbour, setHoverNeighbour] = React.useState<string | null>(
    null,
  );

  /**
   * Mirrors the two values into the URL without a navigation, so a link still
   * restores them. Read from `window.location`, not from `useSearchParams()`:
   * replaceState leaves the route tree untouched, so the hook would keep
   * answering with the parameters this card arrived with and the mirror would
   * undo its own last write. The requested region is mirrored rather than the
   * resolved one, or a shared `?topic=` would be wiped in the moment before
   * the regions have loaded.
   *
   * Only the two keys this card owns are touched: the surfaces around it drive
   * their tabs from the same query string.
   */
  React.useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (selectedId === null) url.delete("selected");
    else url.set("selected", selectedId);
    if (requestedTopic === null) url.delete("topic");
    else url.set("topic", requestedTopic);
    const query = url.toString();
    const next = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    if (next === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(null, "", next);
  }, [selectedId, requestedTopic]);

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

  /**
   * The region the chips are filtering by, which is only ever one this base
   * actually has. The regions arrive from their own query, so for a moment
   * every parameter names nothing; and a refit renumbers them, so a shared
   * link can name one that is gone for good. Passing the raw parameter down
   * would dim the whole cloud with no chip to explain why.
   */
  const highlightTopic =
    requestedTopic !== null &&
    topics.some((topic) => topic.id === requestedTopic)
      ? requestedTopic
      : null;

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
  /**
   * A failed status query is not an answer. Without one there is no telling
   * whether an empty cloud means the base was never mapped or means the
   * viewer may read none of it, and claiming either would be a guess.
   */
  const statusUnknown =
    statusQuery.error !== undefined && status === null && points.length === 0;
  // Both answers gate the first paint: without the status a base that was
  // never fitted would flash "no passages" before saying so.
  const loadingCloud =
    (pointsQuery.loading || statusQuery.loading) && points.length === 0;
  const blocked = unsupported || notMapped || pointsFailed || statusUnknown;
  /** True once there is a cloud on screen, which is what the rows below read. */
  const drawn = !blocked && !loadingCloud && points.length > 0;

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
  /**
   * Which passages carry a ring. The caller names the conflicted ITEMS — the
   * only id its conflicts data has — and a MapPoint records both, so the
   * translation belongs here and nowhere else. A conflicted item the viewer
   * may not read, or one with no position yet, is simply not among the points
   * and contributes nothing, which is also why the legend below is gated on
   * the result rather than on the input: it must not announce a ring the
   * cloud does not carry.
   */
  const ringed = React.useMemo(() => {
    if (ringedItemIds === undefined || ringedItemIds.size === 0) return NO_IDS;
    const passages = new Set<string>();
    for (const point of points) {
      if (ringedItemIds.has(point.itemId)) passages.add(point.id);
    }
    return passages.size === 0 ? NO_IDS : passages;
  }, [points, ringedItemIds]);
  const showLegend = stableGroups.length > 0 || ringed.size > 0;

  const select = React.useCallback(
    (id: string | null) => setSelectedId(id),
    [],
  );
  const reportUnsupported = React.useCallback(() => setUnsupported(true), []);

  /**
   * `undefined` until hydration, and deliberately counted as docked: the
   * primitive renders its docked markup pre-hydration behind a `lg:` class, so
   * a phone hides it anyway, while a large screen paints the panel in its
   * final place instead of inserting it a frame later. What must not happen is
   * the sheet being open on a phone, and `false` is the only value that means
   * phone. At lg the panel is part of the layout, so closing it means closing
   * the passage — the title falls back to the overview.
   */
  const isDocked = useMediaQuery(LG_QUERY);
  const panelOpen = selectedId !== null || isDocked !== false;

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
          drawn ? (
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
        ) : statusUnknown ? (
          <EmptyState
            variant="quiet"
            title={t("empty.statusUnknown")}
            action={{
              label: tCommon("retry"),
              onClick: () => void statusQuery.refetch(),
            }}
          />
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
              onUnsupported={reportUnsupported}
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
                  setRequestedTopic(
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
          if (!next) setSelectedId(null);
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
