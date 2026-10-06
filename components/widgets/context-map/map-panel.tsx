"use client";

/**
 * The map's side panel. It shows whatever is selected: an ITEM when a passage
 * is selected, or a REGION's items when a chip is.
 *
 * Everything that names a point names it by its ITEM. See `pointTitle`.
 *
 * It used to show the passage's own opening as "matched text". This product's
 * ingestion injects a document header into every chunk, so on a real base that
 * opening read `--- Document (Exulu ID: 6adc924b-…) ---` nearly every time: an
 * identifier where a reader expected the passage. The item's own metadata is
 * in its place, and the opening is no longer requested at all.
 *
 * It owns no data and no URL state: the card fetches, the card decides what is
 * selected, and this file renders it.
 */

import { useFormatter, useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { SidePanel } from "@/components/primitives/side-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { pointTitle, strongestPerItem } from "./map-data";
import type { MapEdge, MapItem, MapPoint, RegionItem } from "./map-data";

export interface MapPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: MapPoint | null;
  /** True when ?selected= names a passage absent from the access-scoped answer. */
  missing: boolean;
  /** The selected point's item, or null while it loads or if it is unreadable. */
  item: MapItem | null;
  itemLoading: boolean;
  /** True when the metadata query failed, which is not the same as no metadata. */
  itemError: boolean;
  edges: MapEdge[];
  edgesError: boolean;
  byId: Map<string, MapPoint>;
  /** Set when a region chip is chosen and no passage is selected. */
  regionLabel: string | null;
  regionItems: RegionItem[];
  itemHref: (itemId: string) => string;
  onSelect: (id: string) => void;
  onHoverNeighbour: (id: string | null) => void;
}

/** One label/value row of the metadata list. Values are already formatted. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  );
}

export function MapPanel({
  open,
  onOpenChange,
  selected,
  missing,
  item,
  itemLoading,
  itemError,
  edges,
  edgesError,
  byId,
  regionLabel,
  regionItems,
  itemHref,
  onSelect,
  onHoverNeighbour,
}: MapPanelProps) {
  const t = useTranslations("map");
  const format = useFormatter();
  const locale = useLocale();

  /**
   * One row per item, not per passage. The edges answer is per passage, so a
   * document chunked into four pieces came back as four neighbours and the
   * list showed its name four times.
   *
   * Memoised, because the card re-renders this panel on every pointer move
   * over the list — that is what `onHoverNeighbour` does.
   *
   * Here rather than in the card on purpose: the cloud still draws a line to
   * every related passage, which is what the relations are. Only the reading
   * of them is collapsed.
   */
  const rows = React.useMemo(
    () => strongestPerItem(edges, byId),
    [edges, byId],
  );

  /**
   * A date the base recorded, or nothing — never a placeholder date.
   *
   * toLocaleDateString rather than next-intl's formatter, which this app has
   * no global timeZone configured for and which therefore warns on every
   * render. The rest of the app formats dates the same way.
   */
  const asDate = (value: string | null): string | null => {
    if (value === null) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString(locale, { dateStyle: "medium" })
      : null;
  };

  /**
   * A count the base actually recorded.
   *
   * Zero is "never measured", not "empty": `textlength` is populated on some
   * bases and left at 0 on others — measured on a restored production copy,
   * 1,263 of 1,299 items on one base carry a real length while all 67 on
   * another sit at 0. Rendering "0 characters" there would put a number in
   * the panel that means nothing, which is the complaint this panel exists to
   * answer.
   */
  const recorded = (value: number | null): boolean => value !== null && value > 0;

  const showRegion = selected === null && regionLabel !== null;

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={showRegion ? t("panel.region") : t("panel.item")}
      storageKey="context-map"
      mobileSize="full"
      className="lg:h-auto"
    >
      <div className="space-y-5 p-4">
        {missing ? (
          <p className="text-sm text-muted-foreground">
            {t("panel.unavailable")}
          </p>
        ) : showRegion ? (
          <div className="space-y-3">
            <h3 className="break-words text-sm font-semibold text-foreground">
              {regionLabel}
            </h3>
            {regionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("panel.regionEmpty")}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("panel.regionCount", { count: regionItems.length })}
                </p>
                <ul className="space-y-1">
                  {regionItems.map((row) => (
                    <li key={row.itemId}>
                      <Link
                        href={itemHref(row.itemId)}
                        className="flex items-baseline justify-between gap-3 rounded px-2 py-1 text-sm hover:bg-muted"
                      >
                        <span className="truncate">
                          {row.name || t("panel.untitled")}
                        </span>
                        <span
                          className="shrink-0 text-xs tabular-nums text-muted-foreground"
                          // A bare number in a row says nothing on its own,
                          // and this one is passages, not chunks of the item.
                          aria-label={t("panel.passagesHere", {
                            count: row.passages,
                          })}
                        >
                          {format.number(row.passages)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : selected ? (
          <>
            <div className="space-y-2">
              {selected.group !== null && (
                <Badge variant="secondary">{selected.group}</Badge>
              )}
              {/* The panel's own title is an h2, so its subject is an h3 and
                  the sections about that subject are h4s. `break-words`
                  because a document name can be one long unbroken token. */}
              <h3 className="break-words text-sm font-semibold text-foreground">
                {pointTitle(selected) || t("panel.untitled")}
              </h3>
            </div>

            {/* The name and the neighbours are already known; only this block
                waits on a second query, so only this block shows a skeleton.
                Holding the whole panel for it would make selecting a dot feel
                slower than it is. */}
            {itemLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : itemError ? (
              // Said rather than swallowed: a failed query rendered exactly
              // like an item that recorded nothing, which is a different
              // claim. The neighbours list says so when it fails; this does
              // now too.
              <p className="text-sm text-muted-foreground">
                {t("panel.detailsFailed")}
              </p>
            ) : item === null ? null : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {recorded(item.chunks) && (
                  <Detail
                    label={t("panel.chunks")}
                    value={format.number(item.chunks as number)}
                  />
                )}
                {recorded(item.textLength) && (
                  <Detail
                    label={t("panel.size")}
                    value={t("panel.characters", { count: item.textLength as number })}
                  />
                )}
                {asDate(item.createdAt) !== null && (
                  <Detail
                    label={t("panel.added")}
                    value={asDate(item.createdAt) as string}
                  />
                )}
                {asDate(item.updatedAt) !== null && (
                  <Detail
                    label={t("panel.updated")}
                    value={asDate(item.updatedAt) as string}
                  />
                )}
                {item.source !== null && (
                  <Detail label={t("panel.source")} value={item.source} />
                )}
              </dl>
            )}

            <Button asChild variant="outline" size="sm">
              {/* A route on this app, so client navigation rather than a reload. */}
              <Link href={itemHref(selected.itemId)}>{t("panel.open")}</Link>
            </Button>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                {t("panel.neighbours")}
              </h4>
              {edgesError ? (
                <p className="text-sm text-muted-foreground">
                  {t("panel.neighboursFailed")}
                </p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("panel.noNeighbours")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {rows.map((edge) => {
                    const neighbour = byId.get(edge.target);
                    // The edges query does not filter to passages that have a
                    // position, and the cloud draws only as many as the card
                    // asks for anyway, so a neighbour can simply not be on
                    // screen. It is still a real relation; it just cannot be
                    // pointed at — and its item is unknown, which is why
                    // `strongestPerItem` could not fold it into one.
                    if (neighbour === undefined) {
                      return (
                        <li
                          key={edge.target}
                          className="px-2 py-1 text-sm text-muted-foreground"
                        >
                          {t("panel.neighbourMissing")}
                        </li>
                      );
                    }
                    return (
                      <li key={edge.target}>
                        <button
                          type="button"
                          className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted"
                          onMouseEnter={() => onHoverNeighbour(edge.target)}
                          onMouseLeave={() => onHoverNeighbour(null)}
                          onFocus={() => onHoverNeighbour(edge.target)}
                          onBlur={() => onHoverNeighbour(null)}
                          onClick={() => onSelect(edge.target)}
                        >
                          {pointTitle(neighbour) || t("panel.untitled")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          // A selection with no passage yet: a shared ?selected= opens the
          // panel while the points answer is still in flight.
          <Skeleton className="h-24 w-full" />
        )}
      </div>
    </SidePanel>
  );
}
