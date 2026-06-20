"use client";

/**
 * ContextItemFavourites — the Favourites + Recently Viewed sections at the top
 * of /data.
 *
 * Both lists are per-user, cross-context and cross-device (persisted on the
 * user object — see hooks.ts). Each is a responsive grid of small cards
 * (item name + context badge + favourite star) linking straight to the item
 * detail page. A section renders only when it has resolved items, so a new
 * user's /data is unchanged; the parent also hides the whole block while a
 * context search is active.
 *
 * Names are resolved live (useResolvedPinnedItems issues one items query per
 * distinct context); ids that no longer resolve (deleted items) are simply not
 * rendered — recents age out naturally past the cap, favourites stay until the
 * user un-stars them.
 */

import { Clock, FileText, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  useContextItemFavourites,
  useRecentlyViewedItems,
  useResolvedPinnedItems,
  type ResolvedPinItem,
} from "../hooks";

interface PinCardProps {
  item: ResolvedPinItem;
  contextName: string;
  isFavorite: boolean;
  favoriteLabel: string;
  onToggleFavorite: (globalId: string) => void;
}

function PinCard({
  item,
  contextName,
  isFavorite,
  favoriteLabel,
  onToggleFavorite,
}: PinCardProps) {
  return (
    <Link
      href={`/data/${item.contextId}/items/${item.itemId}`}
      className={cn(
        "group flex items-start gap-3 rounded-md border p-3 transition-colors",
        "hover:border-primary/40 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <FileText aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {item.name}
        </span>
        <Badge variant="secondary" className="max-w-full truncate text-xs">
          {contextName}
        </Badge>
      </span>
      <FavoriteToggle
        pressed={isFavorite}
        onToggle={() => onToggleFavorite(item.globalId)}
        label={favoriteLabel}
        className="-mr-1 -mt-1"
      />
    </Link>
  );
}

interface PinSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ResolvedPinItem[];
  contextNames: Record<string, string>;
  isFavorite: (globalId: string) => boolean;
  favoriteLabel: string;
  unfavoriteLabel: string;
  onToggleFavorite: (globalId: string) => void;
}

function PinSection({
  title,
  icon,
  items,
  contextNames,
  isFavorite,
  favoriteLabel,
  unfavoriteLabel,
  onToggleFavorite,
}: PinSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const favorited = isFavorite(item.globalId);
          return (
            <PinCard
              key={item.globalId}
              item={item}
              contextName={contextNames[item.contextId] ?? item.contextId}
              isFavorite={favorited}
              favoriteLabel={favorited ? unfavoriteLabel : favoriteLabel}
              onToggleFavorite={onToggleFavorite}
            />
          );
        })}
      </div>
    </section>
  );
}

export interface ContextItemFavouritesProps {
  /** contextId → display name, for the per-card context badge. */
  contextNames: Record<string, string>;
}

export function ContextItemFavourites({
  contextNames,
}: ContextItemFavouritesProps) {
  const t = useTranslations("knowledge");
  const { favouriteIds, isFavorite, toggleFavorite } = useContextItemFavourites();
  const { recentIds } = useRecentlyViewedItems();

  const { items: favouriteItems } = useResolvedPinnedItems(favouriteIds);
  const { items: recentItems } = useResolvedPinnedItems(recentIds);

  const handleToggle = React.useCallback(
    (globalId: string) => {
      void toggleFavorite(globalId).catch(() => {
        // Optimistic state already reverted in the hook; nothing to surface.
      });
    },
    [toggleFavorite],
  );

  if (favouriteItems.length === 0 && recentItems.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <PinSection
        title={t("pins.favourites.title")}
        icon={<Star aria-hidden="true" className="size-4" />}
        items={favouriteItems}
        contextNames={contextNames}
        isFavorite={isFavorite}
        favoriteLabel={t("pins.favourite")}
        unfavoriteLabel={t("pins.unfavourite")}
        onToggleFavorite={handleToggle}
      />
      <PinSection
        title={t("pins.recent.title")}
        icon={<Clock aria-hidden="true" className="size-4" />}
        items={recentItems}
        contextNames={contextNames}
        isFavorite={isFavorite}
        favoriteLabel={t("pins.favourite")}
        unfavoriteLabel={t("pins.unfavourite")}
        onToggleFavorite={handleToggle}
      />
    </div>
  );
}

export default ContextItemFavourites;
