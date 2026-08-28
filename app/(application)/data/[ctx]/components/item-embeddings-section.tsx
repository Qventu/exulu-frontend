"use client";

/**
 * ItemEmbeddingsSection — collapsed DetailSection showing chunk count and
 * the last-updated relative time as a quiet meta badge. Expanded body:
 * paginated chunks table (10/page).
 *
 * KNOWLEDGE_ITEM_CHUNKS_PAGINATED_SUPPORTED:
 *   - true  → server-side pagination via GET_ITEM_BY_ID(chunks(page, limit))
 *             [not wired yet — flag stays off]
 *   - false → client-side slice of the inline `chunks` array on the item.
 *             A muted footer surfaces "Showing first N — backend
 *             pagination not yet supported".
 *
 * Inventory items: 47 (chunks DetailSection), 48 + 49 (header menu wires
 * generate/delete embeddings dialogs hosted in ItemPanel).
 */

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import { Database, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DetailSection } from "@/components/primitives/detail-section";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { chunkPreviewText } from "@/lib/chunk-preview";
import { cn } from "@/lib/utils";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import { KNOWLEDGE_ITEM_CHUNKS_PAGINATED_SUPPORTED } from "../../queries";

interface Chunk {
  chunk_id: string;
  chunk_index: number;
  chunk_content: string;
  chunk_created_at: string;
  chunk_updated_at: string;
  chunk_metadata?: unknown;
}

export interface ItemEmbeddingsSectionProps {
  context: Context;
  item: Item;
  onGenerate: () => void;
  onDelete: () => void;
}

const PAGE_SIZE = 10;

export function ItemEmbeddingsSection({
  context: _context,
  item,
  onGenerate,
  onDelete,
}: ItemEmbeddingsSectionProps) {
  const t = useTranslations("knowledge");
  const chunks: Chunk[] = ((item as unknown as { chunks?: Chunk[] }).chunks ?? []);
  const totalChunks =
    typeof item.chunks_count === "number" ? item.chunks_count : chunks.length;

  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(chunks.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const slice = chunks.slice(start, start + PAGE_SIZE);

  const meta = (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <Database aria-hidden="true" className="size-3" />
      {t("workspace.items.chunks", { count: totalChunks })}
      {item.embeddings_updated_at && (
        <>
          <span aria-hidden="true">·</span>
          <RelativeTime date={item.embeddings_updated_at} />
        </>
      )}
    </span>
  );

  const overflow: OverflowMenuItem[] = [
    {
      label: t("workspace.panel.menu.generateEmbeddings"),
      icon: Sparkles,
      onSelect: onGenerate,
    },
    {
      label: t("workspace.panel.menu.deleteEmbeddings"),
      icon: Trash2,
      destructive: true,
      onSelect: onDelete,
    },
  ];

  return (
    <DetailSection
      title={t("workspace.sections.embeddings")}
      defaultOpen={false}
      meta={meta}
      actions={
        <OverflowMenu
          items={overflow}
          label={t("workspace.panel.menu.label")}
        />
      }
    >
      {chunks.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          {t("workspace.embeddings.empty")}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    {t("workspace.embeddings.columns.index")}
                  </TableHead>
                  <TableHead>
                    {t("workspace.embeddings.columns.content")}
                  </TableHead>
                  <TableHead className="w-32">
                    {t("workspace.embeddings.columns.created")}
                  </TableHead>
                  <TableHead className="w-32">
                    {t("workspace.embeddings.columns.updated")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((chunk) => (
                  <TableRow key={chunk.chunk_id}>
                    <TableCell className="font-mono text-xs">
                      {chunk.chunk_index + 1}
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm">
                        {chunkPreviewText(chunk.chunk_content)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {chunk.chunk_created_at && (
                        <RelativeTime date={chunk.chunk_created_at} />
                      )}
                    </TableCell>
                    <TableCell>
                      {chunk.chunk_updated_at && (
                        <RelativeTime date={chunk.chunk_updated_at} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                !KNOWLEDGE_ITEM_CHUNKS_PAGINATED_SUPPORTED && "italic",
              )}
            >
              {KNOWLEDGE_ITEM_CHUNKS_PAGINATED_SUPPORTED
                ? t("workspace.embeddings.pageOf", {
                    current: page,
                    total: pageCount,
                  })
                : t("workspace.embeddings.fallbackNote", {
                    count: chunks.length,
                  })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-11 md:size-7"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("workspace.items.previousPage")}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-11 md:size-7"
                disabled={page === pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                aria-label={t("workspace.items.nextPage")}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </DetailSection>
  );
}
