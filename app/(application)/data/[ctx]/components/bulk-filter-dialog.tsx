"use client";

/**
 * BulkFilterDialog — single Dialog host for all bulk filter-driven
 * operations (and the workspace's main "Filters" entry). Hosts the shared
 * FilterPanel on the left and the items preview on the right.
 *
 * Modes:
 * - "filter-list"          — just sets the active filter list for the items
 *                             table. No mutation runs. No batch-limit row.
 * - "process"              — PROCESS_ITEMS(ctx). Limit row visible.
 * - "generate-embeddings"  — GENERATE_CHUNKS(ctx). Limit row visible.
 * - "delete-embeddings"    — DELETE_CHUNKS(ctx). Limit row visible.
 *                             Destructive CTA styling.
 *
 * Inventory items handled here: 23 (filter entry), 34 (batch limit), 36
 * (preview), 37 (Apply · min(limit, count) CTA), 62 (bulk process), 67
 * (bulk generate embeddings), 68 (bulk delete embeddings).
 */

import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { FilterPanel } from "@/components/primitives/filter-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Context } from "@/types/models/context";

import {
  DELETE_CHUNKS,
  GENERATE_CHUNKS,
  PROCESS_ITEMS,
} from "../../queries";

import {
  KNOWLEDGE_ITEMS_FILTER_FIELDS,
  type KnowledgeFilterValue,
  buildKnowledgeFilters,
} from "./items-filter-fields";
import { ItemsFilterPreview } from "./items-filter-preview";

export type BulkFilterMode =
  | "filter-list"
  | "process"
  | "generate-embeddings"
  | "delete-embeddings";

export interface BulkFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: Context;
  mode: BulkFilterMode;
  /** Only used in "filter-list" mode — pre-populate from the existing toolbar filter set. */
  initialFilters?: unknown[];
  /** Only used in "filter-list" mode — return graphql filter array to ItemsTab. */
  onApply?: (next: unknown[]) => void;
}

export function BulkFilterDialog({
  open,
  onOpenChange,
  context,
  mode,
  initialFilters: _initialFilters,
  onApply,
}: BulkFilterDialogProps) {
  const t = useTranslations("knowledge");

  const [value, setValue] = React.useState<KnowledgeFilterValue>({});
  const [limit, setLimit] = React.useState(10);

  React.useEffect(() => {
    if (open) {
      // Reset every time the dialog opens; "filter-list" cannot rehydrate
      // the legacy filter array generically — keep this conservative.
      setValue({});
      setLimit(10);
    }
  }, [open]);

  const graphqlFilters = React.useMemo(
    () => buildKnowledgeFilters(value),
    [value],
  );

  // Mutations (all gated on mode — only the active one runs)
  const [processItems, processItemsResult] = useMutation(
    PROCESS_ITEMS(context.id),
    {
      onCompleted: (data) => {
        const r = data[`${context.id}_itemsProcessItems`];
        toast.success(r?.message ?? t("workspace.bulk.processScheduled"), {
          description: r?.jobs?.length
            ? t("workspace.bulk.jobsScheduled", { count: r.jobs.length })
            : undefined,
        });
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(t("workspace.bulk.processError"), {
          description: e.message,
        }),
    },
  );

  const [generateChunks, generateChunksResult] = useMutation(
    GENERATE_CHUNKS(context.id),
    {
      onCompleted: (data) => {
        const r = data[`${context.id}_itemsGenerateChunks`];
        toast.success(t("workspace.bulk.generateScheduled"), {
          description: r?.jobs?.length
            ? t("workspace.bulk.jobsScheduled", { count: r.jobs.length })
            : undefined,
        });
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(t("workspace.bulk.generateError"), {
          description: e.message,
        }),
    },
  );

  const [deleteChunks, deleteChunksResult] = useMutation(
    DELETE_CHUNKS(context.id),
    {
      onCompleted: (data) => {
        const r = data[`${context.id}_itemsDeleteChunks`];
        toast.success(t("workspace.bulk.deleteScheduled"), {
          description: r?.jobs?.length
            ? t("workspace.bulk.jobsScheduled", { count: r.jobs.length })
            : undefined,
        });
        onOpenChange(false);
      },
      onError: (e) =>
        toast.error(t("workspace.bulk.deleteError"), {
          description: e.message,
        }),
    },
  );

  const pending =
    processItemsResult.loading ||
    generateChunksResult.loading ||
    deleteChunksResult.loading;

  const handleConfirm = async () => {
    if (mode === "filter-list") {
      onApply?.(graphqlFilters);
      onOpenChange(false);
      return;
    }
    if (mode === "process") {
      await processItems({
        variables: {
          limit,
          filters: graphqlFilters.length > 0 ? graphqlFilters : undefined,
          sort: { field: "updatedAt", direction: "DESC" },
        },
      });
      return;
    }
    if (mode === "generate-embeddings") {
      await generateChunks({
        variables: {
          limit,
          where: graphqlFilters.length > 0 ? graphqlFilters : undefined,
        },
      });
      return;
    }
    if (mode === "delete-embeddings") {
      await deleteChunks({
        variables: {
          limit,
          where: graphqlFilters.length > 0 ? graphqlFilters : undefined,
        },
      });
    }
  };

  const titleKey = `workspace.bulk.${mode}.title`;
  const descriptionKey = `workspace.bulk.${mode}.description`;
  const ctaKey = `workspace.bulk.${mode}.cta`;
  const showLimit = mode !== "filter-list";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto md:grid-cols-2">
          <FilterPanel<KnowledgeFilterValue>
            fields={KNOWLEDGE_ITEMS_FILTER_FIELDS}
            value={value}
            onChange={setValue}
            batchLimit={
              showLimit
                ? {
                    value: limit,
                    onChange: setLimit,
                    min: 1,
                    max: 500,
                  }
                : undefined
            }
            ctaLabel={t(ctaKey)}
            cancelLabel={t("workspace.bulk.cancel")}
            onCancel={() => onOpenChange(false)}
            onClear={() => setValue({})}
            onConfirm={handleConfirm}
            loading={pending}
          />
          {mode !== "filter-list" && (
            <ItemsFilterPreview
              context={context.id}
              filters={graphqlFilters}
              limit={limit}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
