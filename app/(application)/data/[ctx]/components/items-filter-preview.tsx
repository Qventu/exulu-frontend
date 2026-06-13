"use client";

/**
 * ItemsFilterPreview — preview render slot for FilterPanel when used in
 * the bulk-op host dialog. Renders the top-3 matched items with visible,
 * keyboard-accessible copy buttons (the legacy hover-only div-click is
 * gone). Per-card meta: created / updated / embeddings-updated /
 * last-processed / chunks_count.
 *
 * Inventory item #36 (live preview + visible copy buttons).
 */

import { useQuery } from "@apollo/client";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { CopyButton } from "@/components/primitives/copy-button";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { GET_ITEMS, PAGINATION_POSTFIX } from "../../queries";

export interface ItemsFilterPreviewProps {
  context: string;
  filters: Record<string, unknown>[];
  /** Optional limit hint surfaced as "Affecting X of Y total". */
  limit?: number;
}

interface PreviewItem {
  id: string;
  name?: string;
  external_id?: string;
  chunks_count?: number;
  createdAt?: string;
  updatedAt?: string;
  embeddings_updated_at?: string;
  last_processed_at?: string;
}

export function ItemsFilterPreview({
  context,
  filters,
  limit,
}: ItemsFilterPreviewProps) {
  const t = useTranslations("knowledge");
  const locale = useLocale();

  const { data, loading } = useQuery<{
    [key: string]: {
      pageInfo: { itemCount: number };
      items: PreviewItem[];
    };
  }>(
    GET_ITEMS(context, [
      "id",
      "name",
      "external_id",
      "chunks_count",
      "createdAt",
      "updatedAt",
      "embeddings_updated_at",
      "last_processed_at",
    ]),
    {
      variables: {
        page: 1,
        limit: 3,
        filters,
        sort: { field: "updatedAt", direction: "DESC" },
      },
      fetchPolicy: "cache-and-network",
    },
  );

  const node = data?.[context + PAGINATION_POSTFIX];
  const items: PreviewItem[] = node?.items ?? [];
  const totalCount = node?.pageInfo?.itemCount ?? 0;
  const affected = limit !== undefined ? Math.min(limit, totalCount) : totalCount;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {t("workspace.filterPreview.title")}
        </h3>
        <Badge variant="secondary">
          {loading
            ? t("workspace.filterPreview.loading")
            : t("workspace.filterPreview.matchCount", { count: totalCount })}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {limit !== undefined
          ? t("workspace.filterPreview.subtitleAffecting", { count: affected })
          : t("workspace.filterPreview.subtitle")}
      </p>

      <div className="flex flex-col gap-3">
        {loading && items.length === 0 ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : items.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            {t("workspace.filterPreview.empty")}
          </p>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="p-3">
              <div className="flex items-start gap-2">
                <Link
                  href={`/data/${context}?item=${item.id}`}
                  target="_blank"
                  className="flex-1 truncate text-sm font-medium hover:underline"
                >
                  {item.name && item.name.length > 90
                    ? item.name.slice(0, 90) + "…"
                    : (item.name ?? "—")}
                </Link>
                <Badge variant="secondary" className="text-xs">
                  {t("workspace.items.chunks", { count: item.chunks_count ?? 0 })}
                </Badge>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <KV label={t("workspace.filterPreview.mainId")} value={item.id}>
                  <CopyButton
                    value={item.id}
                    label={t("workspace.filterPreview.copyMainId")}
                    size="icon"
                    className="size-6"
                  />
                </KV>
                <KV
                  label={t("workspace.filterPreview.externalId")}
                  value={item.external_id ?? ""}
                >
                  {item.external_id ? (
                    <CopyButton
                      value={item.external_id}
                      label={t("workspace.filterPreview.copyExternalId")}
                      size="icon"
                      className="size-6"
                    />
                  ) : null}
                </KV>
                <KVTime
                  label={t("workspace.filterPreview.created")}
                  date={item.createdAt}
                  locale={locale}
                />
                <KVTime
                  label={t("workspace.filterPreview.updated")}
                  date={item.updatedAt}
                  locale={locale}
                />
                <KVTime
                  label={t("workspace.filterPreview.embeddingsUpdated")}
                  date={item.embeddings_updated_at}
                  locale={locale}
                />
                <KVTime
                  label={t("workspace.filterPreview.lastProcessed")}
                  date={item.last_processed_at}
                  locale={locale}
                />
              </dl>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="flex items-center gap-1">
        <span className="truncate text-xs">{value || "—"}</span>
        {children}
      </dd>
    </div>
  );
}

function KVTime({
  label,
  date,
  locale: _locale,
}: {
  label: string;
  date?: string;
  locale: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xs">
        {date ? <RelativeTime date={date} /> : "—"}
      </dd>
    </div>
  );
}
