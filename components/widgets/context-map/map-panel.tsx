"use client";

/**
 * The map's side panel. With nothing selected it describes the base's shape —
 * the regions and their counts. With a passage selected it shows the passage,
 * a link to the item it came from, and its closest neighbours by wording.
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

import { isPassageClipped } from "./map-data";
import type { MapEdge, MapPoint, MapTopic } from "./map-data";

export interface MapPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: MapPoint | null;
  /** True when ?selected= names a passage absent from the access-scoped answer. */
  missing: boolean;
  topics: MapTopic[];
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
  topics,
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

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={selected ? t("panel.passage") : t("panel.overview")}
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
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {clipped ? `${selected.label}…` : selected.label}
            </p>
            {clipped && (
              <p className="text-xs text-muted-foreground">
                {t("panel.clipped")}
              </p>
            )}
            <Button asChild variant="outline" size="sm">
              {/* A route on this app, so client navigation rather than a reload. */}
              <Link href={itemHref(selected.itemId)}>{t("panel.open")}</Link>
            </Button>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {t("panel.neighbours")}
              </h3>
              {edgesError ? (
                <p className="text-sm text-muted-foreground">
                  {t("panel.neighboursFailed")}
                </p>
              ) : edges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("panel.noNeighbours")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {edges.map((edge) => {
                    const neighbour = byId.get(edge.target);
                    // The edges query does not filter to passages that have a
                    // position, and the cloud is capped at 20,000 anyway, so a
                    // neighbour can simply not be on screen. It is still a real
                    // relation; it just cannot be pointed at.
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
                          {neighbour.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("panel.empty")}</p>
        ) : (
          <ul className="space-y-1">
            {topics.map((topic) => (
              <li
                key={topic.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-foreground">
                  {topic.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {topic.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}
