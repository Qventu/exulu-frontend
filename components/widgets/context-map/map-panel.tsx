"use client";

/**
 * The map's side panel: the item the selected passage came from, its type
 * where the base declares one, the passage itself as the matched text, a link
 * to the item, and its closest neighbours by wording.
 *
 * Everything that names a point names it by its ITEM. A point's `label` is the
 * first 120 characters of the chunk, and this product's ingestion injects a
 * document header into every chunk — so a heading or a row taken from the
 * opening reads `--- Document (Exulu ID: 6adc924b-…) ---`. See `pointTitle`.
 *
 * It only ever shows a passage. It used to list the regions and their counts
 * when nothing was selected, which was the chip row again one column over, so
 * the card mounts it on a selection and not before.
 *
 * It owns no data and no URL state: the card fetches, the card decides what is
 * selected, and this file renders it.
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { SidePanel } from "@/components/primitives/side-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { isPassageClipped, pointTitle, strongestPerItem } from "./map-data";
import type { MapEdge, MapPoint } from "./map-data";

export interface MapPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: MapPoint | null;
  /** True when ?selected= names a passage absent from the access-scoped answer. */
  missing: boolean;
  edges: MapEdge[];
  edgesError: boolean;
  byId: Map<string, MapPoint>;
  itemHref: (itemId: string) => string;
  onSelect: (id: string) => void;
  onHoverNeighbour: (id: string | null) => void;
}

export function MapPanel({
  open,
  onOpenChange,
  selected,
  missing,
  edges,
  edgesError,
  byId,
  itemHref,
  onSelect,
  onHoverNeighbour,
}: MapPanelProps) {
  const t = useTranslations("map");
  // The points answer carries only the passage's opening (see
  // PASSAGE_LABEL_LIMIT), and a reader cannot tell an opening from a whole
  // passage by looking at it.
  const clipped = selected !== null && isPassageClipped(selected.label);

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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("panel.item")}
      storageKey="context-map"
      mobileSize="full"
      className="lg:h-auto"
    >
      <div className="p-4">
        {missing ? (
          <p className="text-sm text-muted-foreground">
            {t("panel.unavailable")}
          </p>
        ) : selected ? (
          <div className="space-y-4">
            {selected.group !== null && (
              <Badge variant="secondary">{selected.group}</Badge>
            )}
            {/* The panel's own title is an h2, so its subject is an h3 and the
                two sections about that subject are h4s. `break-words` because
                a document name can be one long unbroken token. */}
            <h3 className="break-words text-sm font-semibold text-foreground">
              {pointTitle(selected) || t("panel.untitled")}
            </h3>
            <div className="space-y-1">
              {/* Labelled, because a passage of a long document is a quotation
                  from it and reads as a summary of it if nothing says so. */}
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("panel.matched")}
              </h4>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {clipped ? `${selected.label}…` : selected.label}
              </p>
              {clipped && (
                <p className="text-xs text-muted-foreground">
                  {t("panel.clipped")}
                </p>
              )}
            </div>
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
          </div>
        ) : (
          // A selection with no passage yet: a shared ?selected= opens the
          // panel while the points answer is still in flight.
          <Skeleton className="h-24 w-full" />
        )}
      </div>
    </SidePanel>
  );
}
