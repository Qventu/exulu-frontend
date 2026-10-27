"use client";

/**
 * FavouriteArtifactCards — the starred artifacts as preview cards above the
 * table (the /agents favourites precedent: a shortcut row in star order; the
 * table below still lists everything). Each card: the preview
 * (artifact-preview.tsx), then name, kind and access; the whole card links
 * to the in-shell viewer, the star is a sibling control.
 */

import { Globe, Lock, Star, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { FavoriteToggle } from "@/components/primitives/favorite-toggle";
import { cn } from "@/lib/utils";

import type { ArtifactListItem } from "../hooks";
import { KIND_ICON } from "../kind-icon";
import { ArtifactPreview } from "./artifact-preview";

interface CardProps {
  item: ArtifactListItem;
  canFavorite: boolean;
  onUnfavorite: (name: string) => void;
}

function FavouriteCard({ item, canFavorite, onUnfavorite }: CardProps) {
  const t = useTranslations("artifacts");
  const Icon = KIND_ICON[item.type.kind];
  const access =
    item.authMode === "public" ? (
      <Globe aria-hidden="true" className="size-3" />
    ) : item.authMode === "password" ? (
      <Lock aria-hidden="true" className="size-3" />
    ) : (
      <Users aria-hidden="true" className="size-3" />
    );
  const accessLabel =
    item.authMode === "public"
      ? t("accessPublic")
      : item.authMode === "password"
        ? t("accessPassword")
        : t("accessLogin");

  return (
    <li
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors duration-150",
        "hover:border-primary/40",
        item.expired && "text-muted-foreground",
      )}
    >
      <Link
        href={item.href}
        aria-label={`${t("open")}: ${item.name}`}
        className="flex min-w-0 flex-1 flex-col after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
      >
        <ArtifactPreview item={item} className="border-b" />
        <span className="flex min-w-0 items-start gap-2 p-3 pr-12">
          <Icon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-sm font-medium",
                !item.expired && "text-foreground",
              )}
            >
              {item.name}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{t(item.type.labelKey)}</span>
              <span aria-hidden="true">·</span>
              {access}
              <span className="truncate">
                {item.expired ? t("expired") : accessLabel}
              </span>
            </span>
          </span>
        </span>
      </Link>
      {canFavorite ? (
        <FavoriteToggle
          className="absolute bottom-2 right-2 z-10"
          pressed
          label={t("unfavorite")}
          onToggle={() => onUnfavorite(item.name)}
        />
      ) : null}
    </li>
  );
}

export interface FavouriteArtifactCardsProps {
  /** Starred artifacts in star order (favourites.ts orderFavouriteArtifacts). */
  items: ArtifactListItem[];
  canFavorite: boolean;
  onUnfavorite: (name: string) => void;
}

export function FavouriteArtifactCards({
  items,
  canFavorite,
  onUnfavorite,
}: FavouriteArtifactCardsProps) {
  const t = useTranslations("artifacts");
  const headingId = React.useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2
        id={headingId}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
      >
        <Star aria-hidden="true" className="size-4" />
        {t("filterFavorites")}
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <FavouriteCard
            key={item.id}
            item={item}
            canFavorite={canFavorite}
            onUnfavorite={onUnfavorite}
          />
        ))}
      </ul>
    </section>
  );
}
