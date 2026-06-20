"use client";

/**
 * ProjectItemCard — one pinned knowledge item / full-context entry in the
 * Files tab (inventory 24-26, 28; basis: the legacy ProjectItem,
 * project-details.tsx:695-801).
 *
 * Design-doc fixes baked in:
 * - Remove button is ALWAYS visible with tooltip + aria-label (fixes UX 10 —
 *   hover-only affordances are banned, responsive.md T7).
 * - Orphaned gids render a muted "Item no longer exists" card WITH a remove
 *   button instead of `null` (fixes UX 4 — orphans were invisible and
 *   unremovable).
 * - Full-context entries get a distinct Database-icon card with an "Entire
 *   context" badge (ladder row 25).
 * - Entrance: 200 ms fade/scale-in so grid changes are attributable to the
 *   just-closed modal (projects.md motion 5); motion-safe only.
 *
 * Data contract unchanged: per-gid GET_ITEM_BY_ID(context, []) fetch
 * (inventory 24).
 */

import { useQuery } from "@apollo/client";
import { Database, FileX2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Item } from "@/types/models/item";
import { cn } from "@/lib/utils";

import { GET_ITEM_BY_ID } from "../queries";

const CARD_ENTRANCE =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200";

function RemoveButton({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onRemove}
            // ≥44px touch target below md (responsive.md DoD).
            className="size-11 shrink-0 text-muted-foreground hover:text-foreground md:size-8"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function prettyContext(context: string): string {
  return context.replace(/_/g, " ");
}

export function ProjectItemCard({
  gid,
  onRemove,
}: {
  gid: string;
  onRemove: (gid: string) => void;
}) {
  const t = useTranslations("projects");

  const slashIdx = gid.indexOf("/");
  const context = slashIdx !== -1 ? gid.slice(0, slashIdx) : gid;
  const id = slashIdx !== -1 ? gid.slice(slashIdx + 1) : undefined;

  const { data, loading } = useQuery<{ [key: string]: Item }>(
    GET_ITEM_BY_ID(context || "unknown", []),
    { variables: { id: id ?? "" }, skip: !id || !context },
  );

  if (!context) return null;

  // Full-context entry (ladder row 25) — no item to fetch.
  if (!id) {
    return (
      <Card className={cn("relative", CARD_ENTRANCE)}>
        <CardContent className="flex items-start gap-3 p-4">
          <Database
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="truncate text-sm font-medium capitalize">
              {prettyContext(context)}
            </p>
            <Badge variant="outline" className="text-xs">
              {t("files.entireContext")}
            </Badge>
          </div>
          <RemoveButton
            label={t("files.removeItem")}
            onRemove={() => onRemove(gid)}
          />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card aria-hidden="true">
        <CardContent className="space-y-2 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const item = data?.[context + "_itemsById"];

  // Orphaned gid: the item was deleted elsewhere (fixes UX 4).
  if (!item) {
    return (
      <Card className={cn("relative border-dashed", CARD_ENTRANCE)}>
        <CardContent className="flex items-start gap-3 p-4">
          <FileX2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {t("files.orphanTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("files.orphanDescription")}
            </p>
          </div>
          <RemoveButton
            label={t("files.removeItem")}
            onRemove={() => onRemove(gid)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative", CARD_ENTRANCE)}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/data/${context}/items/${id}`}
            className="line-clamp-2 text-sm font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:text-primary focus-visible:underline"
          >
            {item.name}
          </Link>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            <span className="truncate capitalize">
              {prettyContext(context)}
            </span>
            {item.updatedAt && (
              <>
                <span aria-hidden="true">·</span>
                <RelativeTime date={item.updatedAt} />
              </>
            )}
            {typeof item.chunks_count === "number" &&
              item.chunks_count > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t("files.chunks", { count: item.chunks_count })}</span>
                </>
              )}
          </div>
        </div>
        <RemoveButton
          label={t("files.removeItem")}
          onRemove={() => onRemove(gid)}
        />
      </CardContent>
    </Card>
  );
}
