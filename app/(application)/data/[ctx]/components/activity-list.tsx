"use client";

/**
 * ActivityList — merged "Recent processings" + "Recent embeddings" list.
 * Polls every 10s ONLY when `active === true` (the Pipeline tab is
 * mounted/visible) — fixes the page-doc "queue polling thrash" risk.
 *
 * Each row: item link → workspace ?item=, stage Badge, RelativeTime.
 *
 * Inventory items: 63 (Recent processings folded in), 69 (Recent
 * embeddings folded in).
 */

import { useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Context } from "@/types/models/context";

import { GET_ITEMS, PAGINATION_POSTFIX } from "../../queries";

export interface ActivityListProps {
  context: Context;
  /** Tab visibility — controls polling. */
  active: boolean;
}

interface ActivityRow {
  id: string;
  name?: string;
  external_id?: string;
  last_processed_at?: string;
  embeddings_updated_at?: string;
}

const ACTIVITY_WINDOW_DAYS = 21;
const ROW_LIMIT = 5;

export function ActivityList({ context, active }: ActivityListProps) {
  const t = useTranslations("knowledge");
  const since = React.useRef(
    new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  ).current;

  const processings = useQuery<{
    [k: string]: { items: ActivityRow[] };
  }>(GET_ITEMS(context.id, []), {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "network-only",
    pollInterval: active ? 10000 : 0,
    variables: {
      context: context.id,
      page: 1,
      limit: ROW_LIMIT,
      filters: [{ last_processed_at: { gte: since } }],
      sort: { field: "last_processed_at", direction: "DESC" },
    },
  });

  const embeddings = useQuery<{
    [k: string]: { items: ActivityRow[] };
  }>(GET_ITEMS(context.id, []), {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "network-only",
    pollInterval: active ? 10000 : 0,
    variables: {
      context: context.id,
      page: 1,
      limit: ROW_LIMIT,
      filters: [{ embeddings_updated_at: { gte: since } }],
      sort: { field: "embeddings_updated_at", direction: "DESC" },
    },
  });

  const loading = processings.loading || embeddings.loading;
  const processingsRows =
    processings.data?.[context.id + PAGINATION_POSTFIX]?.items ?? [];
  const embeddingsRows =
    embeddings.data?.[context.id + PAGINATION_POSTFIX]?.items ?? [];

  // Merge + sort newest-first across both streams; tag with stage.
  const merged = React.useMemo(() => {
    const out: { id: string; row: ActivityRow; stage: "processed" | "embedded"; ts: string }[] =
      [];
    processingsRows.forEach((r) => {
      if (r.last_processed_at) {
        out.push({
          id: `proc-${r.id}-${r.last_processed_at}`,
          row: r,
          stage: "processed",
          ts: r.last_processed_at,
        });
      }
    });
    embeddingsRows.forEach((r) => {
      if (r.embeddings_updated_at) {
        out.push({
          id: `emb-${r.id}-${r.embeddings_updated_at}`,
          row: r,
          stage: "embedded",
          ts: r.embeddings_updated_at,
        });
      }
    });
    return out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  }, [processingsRows, embeddingsRows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          {t("workspace.activity.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && merged.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : merged.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            {t("workspace.activity.empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {merged.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <Link
                  href={`/data/${context.id}?item=${entry.row.id}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {entry.row.name ??
                    entry.row.external_id ??
                    t("workspace.items.untitled")}
                </Link>
                <Badge
                  variant={
                    entry.stage === "processed" ? "secondary" : "outline"
                  }
                  className="text-xs"
                >
                  {entry.stage === "processed"
                    ? t("workspace.activity.stageProcessed")
                    : t("workspace.activity.stageEmbedded")}
                </Badge>
                <RelativeTime
                  date={entry.ts}
                  className="text-xs text-muted-foreground"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
