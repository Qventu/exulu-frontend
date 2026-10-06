"use client";

/**
 * The map card: it fetches, it owns the selection and the controls, and it
 * mounts the renderer and the panel. It is deliberately ignorant of which
 * surface it sits on — the memory base page and the knowledge workspace both
 * render it, and feature-isolation lint forbids either from importing the
 * other's code, so everything surface-specific arrives as a prop.
 */

import { useQuery } from "@apollo/client";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { ChartCard } from "@/components/primitives/chart-card";
import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GET_CONTEXT_MAP_EDGES,
  GET_CONTEXT_MAP_ITEM,
  GET_CONTEXT_MAP_POINTS,
  GET_CONTEXT_MAP_TOPICS,
  GET_CONTEXT_PROJECTION_STATUS,
} from "@/lib/graphql/operations/context-map";

import type { MapCanvasHandle } from "./map-canvas";
import {
  coverageCaption,
  regionColor,
  resolvePalette,
  itemsInRegion,
  resolveRingColor,
  rgbCss,
  DAY_MS,
  timeBounds,
  topicOf,
  type MapEdge,
  type MapItem,
  type MapPoint,
  type MapTopic,
  type Palette,
  type RegionItem,
  type Rgb,
  type TimeWindow,
  withinWindow,
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
 * 20,000: the cap measured at about 5.8 MB uncompressed when the passage
 * opening was still requested, and it no longer is — but twenty thousand dots
 * is still more cloud than a reader can take in, and the caption below says
 * how many of how many are drawn when the limit bites.
 */
const POINTS_LIMIT = 5000;

// Stable empties. A fresh [] or Set() per render would re-upload every buffer
// in the renderer each time this card re-renders — and it re-renders on every
// pointer move over the panel's neighbour list.
const NO_IDS: Set<string> = new Set();
/** One identity for the empty case, so the panel's props do not churn. */
const NO_REGION_ITEMS: RegionItem[] = [];
const NO_POINTS: MapPoint[] = [];
const NO_TOPICS: MapTopic[] = [];
const NO_EDGES: MapEdge[] = [];

/**
 * The palette and the ring colour as the renderer resolves them, so the chip
 * swatches below cannot disagree with the dots they explain. Reading the raw
 * token into a style would diverge exactly where nobody would look: an
 * unparseable token greys a dot, while `hsl(var(--chart-4))` on a swatch
 * paints nothing at all.
 *
 * Re-read on a theme change for the same reason the renderer re-reads it —
 * CSS variables are resolved once, not bound.
 */
function useThemeColors(host: React.RefObject<HTMLElement | null>) {
  const [colors, setColors] = React.useState<{
    palette: Palette;
    ring: Rgb;
  } | null>(null);
  React.useEffect(() => {
    const element = host.current;
    if (element === null) return;
    const read = () =>
      setColors({
        palette: resolvePalette(element),
        ring: resolveRingColor(element),
      });
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, [host]);
  return colors;
}

type PointsAnswer = {
  contextMapPoints: {
    points: MapPoint[];
    total: number;
    sampled: boolean;
  } | null;
};

export interface ContextMapCardProps {
  contextId: string;
  groupField: string | null;
  /**
   * Items in a conflict group. ITEM ids, not passage ids: a surface's
   * conflicts data names memories, and the translation to passages needs the
   * points answer, which only this card holds.
   */
  ringedItemIds?: Set<string>;
  itemHref: (itemId: string) => string;
  titleKey: "memory" | "knowledge";
  /**
   * Offer the time filter. The memory pages set it, because a memory base
   * accumulates and "what did I know in August" is a real question there; a
   * knowledge base ingests in one batch and the control would be inert.
   *
   * Its own prop rather than a read of `titleKey`, which should keep meaning
   * what its name says. Even with it set, the filter appears only if the data
   * actually spans more than one day — see `timeBounds`.
   */
  timeline?: boolean;
}

export function ContextMapCard({
  contextId,
  groupField,
  ringedItemIds,
  itemHref,
  titleKey,
  timeline = false,
}: ContextMapCardProps) {
  const t = useTranslations("map");
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const params = useSearchParams();
  const canvasRef = React.useRef<MapCanvasHandle>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const colors = useThemeColors(rootRef);

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
  /**
   * The chip the pointer (or the keyboard) is on. Not a selection: it never
   * reaches `requestedTopic`, so it never reaches the URL either.
   */
  const [hoverTopic, setHoverTopic] = React.useState<string | null>(null);
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

  /**
   * The region the cloud is actually dimmed against: the hovered chip if there
   * is one, otherwise the chosen one.
   *
   * Hovering a chip shows what choosing it would show — the same dimming rule,
   * the same member set, no second mechanism — and the moment the pointer
   * leaves, the chosen region is dim again. The chips' own `aria-pressed` and
   * variant stay on `highlightTopic`: a hover must not look like a choice,
   * because it is not one.
   */
  const activeTopic = hoverTopic ?? highlightTopic;

  /**
   * Which palette entry each region owns: its position in the regions array,
   * by id.
   *
   * Both halves of the colour wiring read THIS, rather than each deriving a
   * position of its own — the resolver below for the dots, and the chip row
   * two hundred lines further down for its swatches. Shared, because a chip
   * row is a natural thing to reorder or to filter (hiding a region that
   * holds nothing, say), and a row that renumbered its own swatches would
   * recolour every chip after the one it dropped while the cloud kept the
   * colours this map names.
   */
  const regionOrder = React.useMemo(
    () => new Map(topics.map((topic, index) => [topic.id, index])),
    [topics],
  );

  /**
   * What colours a dot: the index of its region, or -1 for a passage in none.
   *
   * `topicOf` is the same nearest-centre rule the dimming below uses, so a
   * dot's colour and the chip that names its region can never disagree. It is
   * also the only thing there is to colour by on a knowledge base, which
   * declares no grouping field at all.
   *
   * Memoised on the regions: the renderer rebuilds and re-uploads its whole
   * colour buffer whenever this identity changes, and a fresh arrow per render
   * would do that on every pointer move.
   */
  const regionIndex = React.useMemo(() => {
    return (point: MapPoint) => {
      const id = topicOf(point, topics);
      return id === null ? -1 : (regionOrder.get(id) ?? -1);
    };
  }, [topics, regionOrder]);

  /**
   * Which passages the highlighted region holds. A MapPoint records its
   * grouping value, never its region, so membership is "nearest centre" —
   * which is exactly what the clustering computed.
   */
  const topicMemberIds = React.useMemo(() => {
    if (activeTopic === null) return NO_IDS;
    const members = new Set<string>();
    for (const point of points) {
      if (topicOf(point, topics) === activeTopic) members.add(point.id);
    }
    return members;
  }, [activeTopic, points, topics]);

  const byId = React.useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  );
  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null);
  // A shared link can name a passage this viewer may not read: the points
  // answer is access-scoped, so it simply is not here.
  const missing =
    selectedId !== null && selected === null && !pointsQuery.loading;

  /**
   * The selected point's item, asked for per selection the way the relations
   * are — never on mount.
   *
   * Keyed on the ITEM rather than on the passage, so selecting another chunk
   * of the same document while this one is open asks for nothing — the
   * variables are unchanged and Apollo dedups the in-flight query. NOT a
   * cache hit: this app sets fetchPolicy "no-cache" as the default for every
   * query, so re-selecting an item viewed earlier does fetch again.
   */
  const itemQuery = useQuery<{ contextMapItem: MapItem | null }>(
    GET_CONTEXT_MAP_ITEM,
    {
      variables: { contextId, itemId: selected?.itemId ?? null },
      skip: selected === null,
    },
  );

  /**
   * The span the time filter may cover, or null when the base cannot support
   * one. Null for every knowledge base measured so far, which is why the
   * control is gated on the data and not only on the page.
   */
  const bounds = React.useMemo(
    () => (timeline ? timeBounds(points) : null),
    [timeline, points],
  );
  /** The chosen window, or null for "the whole span" — the slider's rest state. */
  const [timeWindow, setTimeWindow] = React.useState<TimeWindow | null>(null);
  // A refit or a different base moves the span under the slider; a window from
  // the old one would filter against dates this base has not got.
  const boundsKey = bounds === null ? "" : `${bounds.from}:${bounds.to}`;
  React.useEffect(() => {
    setTimeWindow(null);
  }, [boundsKey]);

  /**
   * The window's ends as the viewer reads them. Used both for the line above
   * the slider and for each thumb's aria-valuetext, so what is announced and
   * what is shown cannot drift apart.
   */
  const fromLabel = new Date(
    timeWindow?.from ?? bounds?.from ?? 0,
  ).toLocaleDateString(locale, { dateStyle: "medium" });
  const toLabel = new Date(
    timeWindow?.to ?? bounds?.to ?? 0,
  ).toLocaleDateString(locale, { dateStyle: "medium" });

  /**
   * The items a chosen region holds, for the panel the chip opens.
   *
   * From the points already drawn — the same nearest-centre membership the
   * colouring uses — so choosing a chip fetches nothing. Skipped while a
   * passage is selected, because the panel shows that instead.
   */
  const regionItems = React.useMemo(
    () =>
      selectedId !== null
        ? NO_REGION_ITEMS
        : itemsInRegion(
            // Only the points the time filter is showing. Listing items whose
            // every passage is dimmed out would make the panel disagree with
            // the cloud it describes.
            timeWindow === null
              ? points
              : points.filter((point) => withinWindow(point.createdAtMs, timeWindow)),
            topics,
            highlightTopic,
          ),
    [selectedId, points, topics, highlightTopic, timeWindow],
  );
  /**
   * Keyed on `selectedId`, not on the resolved `selected`.
   *
   * The card writes both keys into the URL, so a shared link can carry a
   * selection AND a chip. The topics query is small and unparameterised and
   * almost always returns first, so keying on the resolved point meant that
   * while the points query was still in flight the panel opened on the region
   * — over an empty points array — and announced "No items in this region"
   * for a region that has items, before switching to the item.
   */
  const regionLabel =
    selectedId === null
      ? (topics.find((topic) => topic.id === highlightTopic)?.label ?? null)
      : null;


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
  /**
   * Whether the links control is on screen — and therefore whether the web it
   * governs may be drawn. One value read in both places, not two expressions
   * that happen to agree: the control and its effect have to appear and
   * disappear together, or a user who chose "All links" is left with a web
   * and nothing to turn it off with.
   */
  const linksControl = drawn && selectedId !== null;

  /**
   * Which passages carry a ring. The caller names the conflicted ITEMS — the
   * only id its conflicts data has — and a MapPoint records both, so the
   * translation belongs here and nowhere else. A conflicted item the viewer
   * may not read, or one with no position yet, is simply not among the points
   * and contributes nothing, which is also why the ring's legend entry beside
   * the chips is gated on the result rather than on the input: it must not
   * announce a ring the cloud does not carry.
   */
  const ringed = React.useMemo(() => {
    if (ringedItemIds === undefined || ringedItemIds.size === 0) return NO_IDS;
    const passages = new Set<string>();
    for (const point of points) {
      if (ringedItemIds.has(point.itemId)) passages.add(point.id);
    }
    return passages.size === 0 ? NO_IDS : passages;
  }, [points, ringedItemIds]);

  const select = React.useCallback(
    (id: string | null) => setSelectedId(id),
    [],
  );
  const reportUnsupported = React.useCallback(() => setUnsupported(true), []);

  /**
   * The colour of a chip's swatch, by region index. Resolved through the same
   * function and the same cycling rule the renderer colours dots with — the
   * chips are the legend now, so a swatch that could drift from its dots would
   * be a legend that lies. `undefined` only before the first paint resolves the
   * theme.
   *
   * Not from the same parsed palette, though, which an earlier version of this
   * comment claimed: this card resolves from its own root element and the
   * renderer from the canvas host, so there are two `Palette` objects. What
   * makes them agree is the CASCADE — the palette tokens are declared once at
   * the document root and both elements inherit the same computed values — and
   * not a shared value. Overriding a palette token on anything between the two
   * elements is the one thing that would pull them apart.
   */
  const swatchColor = (region: number) =>
    colors === null ? undefined : rgbCss(regionColor(colors.palette, region));

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-4 lg:flex-row"
      data-testid="context-map-card"
    >
      <ChartCard
        className="min-w-0 flex-1"
        title={t(`title.${titleKey}`)}
        error={
          pointsFailed
            ? {
                message: t("error.points"),
                onRetry: () => void pointsQuery.refetch(),
              }
            : null
        }
        toolbar={
          /**
           * Only while a passage is selected: with nothing selected the
           * choice is between the whole-cloud web and nothing, which is not
           * the choice its labels describe — and the web is gated on this
           * same value below, so neither outlives the other.
           */
          linksControl ? (
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
          <div className="relative h-[28rem]">
            <MapCanvas
              ref={canvasRef}
              points={points}
              topics={topics}
              regionOf={regionIndex}
              edges={edges}
              selectedId={selectedId}
              // The hovered region if there is one; see `activeTopic`.
              highlightTopic={activeTopic}
              topicMemberIds={topicMemberIds}
              timeWindow={timeWindow}
              ringedIds={ringed}
              paused={paused}
              // The web is the links control's doing, so it is gated on the
              // control being there — the same value, not a second copy of
              // its condition. The choice itself is kept, for the next
              // selection.
              allLinks={allLinks && linksControl}
              hoverNeighbourId={hoverNeighbour}
              onSelect={select}
              onUnsupported={reportUnsupported}
            />
            {/* In the canvas's own corner, not the card header: unlike the
                links control both do something the moment the cloud is
                drawn, and the header has a title to carry. */}
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 bg-background/80"
                aria-label={paused ? t("controls.resume") : t("controls.pause")}
                onClick={() => setPaused((previous) => !previous)}
              >
                {paused ? (
                  <Play aria-hidden="true" className="size-4" />
                ) : (
                  <Pause aria-hidden="true" className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 bg-background/80"
                aria-label={t("controls.reset")}
                onClick={() => canvasRef.current?.reset()}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/*
          One row, and it is the legend: a chip carries its region's name, its
          count and the swatch its dots take. The swatch comes from
          `regionOrder` — the same value the resolver above colours dots by —
          and never from this row's own render position, so reordering or
          filtering the row cannot recolour a single region.
        */}
        {drawn && (topics.length > 0 || ringed.size > 0) && (
          <div className="flex flex-wrap items-center gap-3 pt-4">
            {topics.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label={t("legend.region")}
              >
                {topics.map((topic) => {
                  const region = regionOrder.get(topic.id) ?? -1;
                  return (
                    <Button
                      key={topic.id}
                      type="button"
                      size="sm"
                      variant={
                        highlightTopic === topic.id ? "default" : "outline"
                      }
                      aria-pressed={highlightTopic === topic.id}
                      onClick={() => {
                        const deselecting = highlightTopic === topic.id;
                        setRequestedTopic(deselecting ? null : topic.id);
                        // A click focuses the button, which set (or kept)
                        // `hoverTopic` to this chip — from the keyboard, focus
                        // never moves away on its own. Left alone, the chip
                        // would say "not chosen" while `activeTopic` stayed
                        // this one and the cloud kept it dim, indefinitely
                        // from the keyboard. Re-entering the chip restores
                        // the preview, so nothing is lost.
                        if (deselecting) setHoverTopic(null);
                      }}
                      // A look, not a choice: the cloud dims as it would if
                      // this chip were chosen, and nothing is written.
                      // Focus and blur too, so the keyboard sees the same map
                      // the pointer does.
                      onMouseEnter={() => setHoverTopic(topic.id)}
                      onMouseLeave={() => setHoverTopic(null)}
                      onFocus={() => setHoverTopic(topic.id)}
                      onBlur={() => setHoverTopic(null)}
                    >
                      <span
                        aria-hidden="true"
                        data-region-swatch={region}
                        className="mr-2 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: swatchColor(region) }}
                      />
                      {topic.label}
                      <span className="ml-2 text-xs tabular-nums opacity-70">
                        {topic.count}
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
            {/* The one legend entry that is not a chip, because no chip says
                it: a ring is about the passage, not about its region. */}
            {ringed.size > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full border-2 bg-transparent"
                  // The renderer's own ring colour, resolved from the theme
                  // the same way, so the swatch cannot drift from the dots.
                  style={{
                    borderColor:
                      colors === null ? undefined : rgbCss(colors.ring),
                  }}
                />
                {t("legend.ringed")}
              </span>
            )}
          </div>
        )}

        {/*
          The time filter, on the memory pages and only where the base spans
          more than a day. Dots outside the window dim rather than disappear,
          so the cloud keeps its shape and a reader watches memory accumulate
          into it rather than watching it jump about.
        */}
        {drawn && bounds !== null && (
          <div className="pt-4">
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <span className="text-xs font-medium text-foreground">
                {t("time.label")}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t("time.range", { from: fromLabel, to: toLabel })}
              </span>
            </div>
            <Slider
              // On the thumbs, not on Root: Root is role-less, so a name there
              // never reaches either thumb, and Radix would fall back to its
              // hardcoded English "Minimum"/"Maximum" and read out the raw
              // epoch number.
              thumbProps={[
                { "aria-label": t("time.from"), "aria-valuetext": fromLabel },
                { "aria-label": t("time.to"), "aria-valuetext": toLabel },
              ]}
              min={bounds.from}
              max={bounds.to}
              step={DAY_MS}
              value={[timeWindow?.from ?? bounds.from, timeWindow?.to ?? bounds.to]}
              onValueChange={([from, to]) => {
                if (from === undefined || to === undefined) return;
                // Back at full span is "no filter", not a window that happens
                // to cover everything: an undated point must come back when
                // the filter is released.
                setTimeWindow(
                  from === bounds.from && to === bounds.to ? null : { from, to },
                );
              }}
            />
          </div>
        )}

        {/* One line, saying what a dot is, what a count counts and that the
            counts include items the cloud never draws. */}
        {drawn && (
          <p className="pt-3 text-xs text-muted-foreground">
            {t("caption.explained")}
          </p>
        )}
        {drawn && caption !== null && (
          <p className="pt-1 text-xs text-muted-foreground">
            {t(caption.key, caption.values)}
          </p>
        )}
      </ChartCard>

      {/*
        Open only on a selection, and closed it renders nothing at all — the
        primitive returns null when docked and Radix mounts no sheet below lg.
        It used to be open from first paint on a large screen, showing the
        region list, which was the chip row again one column over.
        Closing it clears the selection, which is the only thing that keeps
        it open.

        Left mounted while closed on purpose: the primitive restores focus to
        whatever had it before the panel opened, and that effect cannot run
        in a component that was unmounted instead of closed.
      */}
      <MapPanel
        // A chosen region opens it too, on its items. Not a hovered one:
        // hovering previews the cloud, it does not select anything.
        open={selectedId !== null || regionLabel !== null}
        onOpenChange={(next) => {
          if (next) return;
          setSelectedId(null);
          setRequestedTopic(null);
        }}
        selected={selected}
        missing={missing}
        item={itemQuery.data?.contextMapItem ?? null}
        itemLoading={itemQuery.loading}
        itemError={itemQuery.error !== undefined}
        regionLabel={regionLabel}
        regionItems={regionItems}
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
