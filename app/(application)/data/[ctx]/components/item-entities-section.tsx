"use client";

/**
 * ItemEntitiesSection — collapsible "Entities" section on the item detail page,
 * showing the entities the extractor linked to THIS item (graph-retrieval
 * entity layer), grouped by type. Only rendered for embedder contexts (entities
 * attach to chunks).
 *
 * The section header carries an overflow (⋯) menu — mirroring the Embeddings
 * section — with "Extract / Re-extract" and a destructive "Detach all". While
 * extraction is in flight the menu is replaced by an inline "Extracting…"
 * spinner so it's obvious work is happening, and the entity list refetches on
 * completion so changes appear without a manual reload.
 */

import { useMutation, useQuery } from "@apollo/client";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { DetailSection } from "@/components/primitives/detail-section";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DETACH_ENTITIES_FOR_ITEM,
  EXTRACT_ENTITIES_FOR_ITEM,
  GET_ENTITIES_FOR_ITEM,
} from "@/queries/queries";
import type { Context } from "@/types/models/context";
import type { Item } from "@/types/models/item";

type ItemEntity = { id: string; type: string; name: string; mentions: number };

export interface ItemEntitiesSectionProps {
  context: Context;
  item: Item;
}

export function ItemEntitiesSection({ context, item }: ItemEntitiesSectionProps) {
  const t = useTranslations("knowledge");
  const [confirmDetach, setConfirmDetach] = React.useState(false);

  const queryDoc = React.useMemo(
    () => GET_ENTITIES_FOR_ITEM(context.id),
    [context.id],
  );
  const { data, loading, error, refetch } = useQuery<{
    [key: string]: ItemEntity[];
  }>(queryDoc, {
    variables: { item: item.id },
    fetchPolicy: "cache-and-network",
    // Degrade quietly if the entity layer GraphQL fields aren't live yet.
    errorPolicy: "all",
  });

  const entities = data?.[`${context.id}_itemsEntitiesForItem`] ?? [];

  // Per-item extraction / detach live here so running them and seeing the
  // result are in the same place. Both refetch the list on completion.
  const extractDoc = React.useMemo(
    () => EXTRACT_ENTITIES_FOR_ITEM(context.id),
    [context.id],
  );
  const [extractEntities, { loading: extracting }] = useMutation(extractDoc, {
    onCompleted: async (result) => {
      const count = result?.[`${context.id}_itemsExtractEntities`]?.extracted ?? 0;
      await refetch();
      toast.success(t("workspace.itemDetail.extractEntitiesDone", { count }));
    },
    onError: (e) =>
      toast.error(t("workspace.itemDetail.extractEntitiesError"), {
        description: e.message,
      }),
  });

  const detachDoc = React.useMemo(
    () => DETACH_ENTITIES_FOR_ITEM(context.id),
    [context.id],
  );
  const [detachEntities, { loading: detaching }] = useMutation(detachDoc, {
    onCompleted: async (result) => {
      const count = result?.[`${context.id}_itemsDetachEntities`]?.detached ?? 0;
      await refetch();
      toast.success(t("workspace.entities.itemSection.detached", { count }));
    },
    onError: (e) =>
      toast.error(t("workspace.entities.itemSection.detachError"), {
        description: e.message,
      }),
  });

  const busy = extracting || detaching;

  // Group by type, preserving the backend's type→name ordering.
  const groups = React.useMemo(() => {
    const byType = new Map<string, ItemEntity[]>();
    for (const e of entities) {
      const list = byType.get(e.type) ?? [];
      list.push(e);
      byType.set(e.type, list);
    }
    return [...byType.entries()];
  }, [entities]);

  const menuItems: OverflowMenuItem[] = [
    {
      label:
        entities.length > 0
          ? t("workspace.entities.itemSection.reExtract")
          : t("workspace.entities.itemSection.extract"),
      icon: Sparkles,
      onSelect: () => void extractEntities({ variables: { item: item.id } }),
    },
    {
      label: t("workspace.entities.itemSection.detachAll"),
      icon: Trash2,
      destructive: true,
      disabled: entities.length === 0,
      onSelect: () => setConfirmDetach(true),
    },
  ];

  const actions = busy ? (
    <span className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
      {extracting ? t("workspace.entities.itemSection.extracting") : null}
    </span>
  ) : (
    <OverflowMenu items={menuItems} label={t("workspace.panel.menu.label")} />
  );

  return (
    <>
      <DetailSection
        title={t("workspace.entities.itemSection.title")}
        meta={
          entities.length > 0
            ? t("workspace.entities.itemSection.count", { count: entities.length })
            : undefined
        }
        actions={actions}
      >
        {extracting && entities.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("workspace.entities.itemSection.extracting")}
          </div>
        ) : loading && entities.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        ) : error && entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("workspace.entities.itemSection.unavailable")}
          </p>
        ) : entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("workspace.entities.itemSection.emptyAction")}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map(([type, list]) => (
              <div key={type} className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {type}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((e) => (
                    <Badge key={e.id} variant="secondary" className="gap-1">
                      {e.name}
                      {e.mentions > 1 ? (
                        <span className="text-muted-foreground">×{e.mentions}</span>
                      ) : null}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      <ConfirmDialog
        open={confirmDetach}
        onOpenChange={setConfirmDetach}
        onConfirm={async () => {
          await detachEntities({ variables: { item: item.id } });
          setConfirmDetach(false);
        }}
        title={t("workspace.entities.itemSection.detachConfirmTitle")}
        description={t("workspace.entities.itemSection.detachConfirmBody")}
        variant="destructive"
        confirmLabel={t("workspace.entities.itemSection.detachConfirmAction")}
      />
    </>
  );
}
