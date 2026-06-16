"use client";

/**
 * ItemDetailClient — dedicated item detail PAGE (knowledge V2 Phase F1).
 * Supersedes the wide Sheet (`item-panel.tsx`, retired) per the V2 spec
 * "Item detail" artboard + product ask #2 ("a dedicated detail view page
 * with a clearer layout").
 *
 * Layout:
 *  - PageHeader: breadcrumb (← context) · item name · Edit / Save+Cancel +
 *    OverflowMenu. The id (mono, click-to-copy) + external id + archived
 *    badge sit on the meta line.
 *  - Pipeline status line: ✓ Ingested · ✓ Processed · ✓ Embedded ·
 *    ✓ Retrievable (steps rendered only for the stages the context
 *    configures) + right-aligned "{n} chunks · {time}". The "did it work?"
 *    answer at a glance.
 *  - Sections: Fields (open) · Embeddings · Access · Calculated (the same
 *    primitives the panel used — reused verbatim).
 *
 * Edit/save/process/embed/archive/delete behaviour comes from the shared
 * useItemEditor hook (extracted from the old panel).
 */

import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  Archive,
  Check,
  Database,
  PackageOpen,
  Save,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyButton } from "@/components/primitives/copy-button";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStates } from "@/components/loading-states";
import { cn } from "@/lib/utils";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import { useItemDetail } from "../../../hooks";
import { ItemAccessSection } from "../../components/item-access-section";
import { ItemCalculatedSection } from "../../components/item-calculated-section";
import { ItemEmbeddingsSection } from "../../components/item-embeddings-section";
import { ItemFieldsSection } from "../../components/item-fields-section";
import { useItemEditor } from "../../components/use-item-editor";

export interface ItemDetailClientProps {
  context: Context;
  itemId: string;
}

/** Derive the four pipeline-stage checks from the item + context config. */
function pipelineSteps(
  item: Item,
  context: Context,
  t: (k: string) => string,
): { key: string; label: string; done: boolean }[] {
  const hasProcessor = Boolean(context.processor);
  const hasEmbedder = Boolean(context.embedder);
  const embedded =
    (typeof item.chunks_count === "number" && item.chunks_count > 0) ||
    Boolean(item.embeddings_updated_at);

  const steps: { key: string; label: string; done: boolean }[] = [
    { key: "ingested", label: t("workspace.itemDetail.pipeline.ingested"), done: true },
  ];
  if (hasProcessor) {
    steps.push({
      key: "processed",
      label: t("workspace.itemDetail.pipeline.processed"),
      done: Boolean(item.last_processed_at),
    });
  }
  if (hasEmbedder) {
    steps.push({
      key: "embedded",
      label: t("workspace.itemDetail.pipeline.embedded"),
      done: embedded,
    });
    steps.push({
      key: "retrievable",
      label: t("workspace.itemDetail.pipeline.retrievable"),
      done: embedded && !item.archived,
    });
  }
  return steps;
}

export function ItemDetailClient({ context, itemId }: ItemDetailClientProps) {
  const t = useTranslations("knowledge");
  const router = useRouter();

  const { item, loading, error, refetch } = useItemDetail({ context, itemId });

  const editor = useItemEditor({
    context,
    item,
    refetch,
    onDeleted: () => router.push(`/data/${context.id}?tab=items`),
  });

  const backHref = `/data/${context.id}?tab=items`;

  // ---- Loading / error / not-found ----------------------------------

  if (loading && !item) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error && !item) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>{t("workspace.panel.errorTitle")}</AlertTitle>
        <AlertDescription>
          {error.message ?? t("workspace.panel.errorDescription")}
        </AlertDescription>
      </Alert>
    );
  }
  if (!item) {
    return (
      <Alert>
        <ExclamationTriangleIcon className="size-4" />
        <AlertTitle>{t("workspace.panel.notFound")}</AlertTitle>
        <AlertDescription>
          <Button
            variant="link"
            className="h-auto px-0"
            onClick={() => router.push(backHref)}
          >
            {t("workspace.backToItems")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // ---- Derived header bits ------------------------------------------

  const title = item.name ?? item.external_id ?? t("workspace.items.untitled");
  const chunkCount = typeof item.chunks_count === "number" ? item.chunks_count : 0;
  const steps = pipelineSteps(item, context, t);

  // ---- Overflow menu ------------------------------------------------

  const overflowItems: OverflowMenuItem[] = [];
  if (context.processor) {
    overflowItems.push({
      label: t("workspace.panel.menu.process"),
      icon: Zap,
      onSelect: editor.triggerProcess,
      description: context.processor.queue,
    });
  }
  overflowItems.push({
    label: t("workspace.panel.menu.generateEmbeddings"),
    icon: Sparkles,
    onSelect: () => editor.setConfirm("generate-embeddings"),
  });
  overflowItems.push({
    label: t("workspace.panel.menu.deleteEmbeddings"),
    icon: Database,
    destructive: true,
    onSelect: () => editor.setConfirm("delete-embeddings"),
  });
  overflowItems.push({
    label: item.archived
      ? t("workspace.panel.menu.unarchive")
      : t("workspace.panel.menu.archive"),
    icon: item.archived ? PackageOpen : Archive,
    onSelect: () => void editor.handleArchiveToggle(!item.archived),
  });
  overflowItems.push({
    label: t("workspace.panel.menu.delete"),
    icon: Trash2,
    destructive: true,
    onSelect: () => editor.setConfirm("delete-item"),
  });

  const headerAction = (
    <div className="flex shrink-0 items-center gap-1">
      {editor.editing ? (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={editor.cancelEdit}>
            <XCircle aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.panel.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={editor.saving}
            onClick={editor.handleSave}
          >
            <Save aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.panel.save")}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.setEditing(true)}
        >
          {t("workspace.panel.edit")}
        </Button>
      )}
      <OverflowMenu items={overflowItems} label={t("workspace.panel.menu.label")} />
    </div>
  );

  const idLine = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1">
        <code className="font-mono text-xs">{item.id}</code>
        <CopyButton
          value={item.id ?? ""}
          label={t("workspace.itemDetail.copyId")}
          size="icon"
          className="size-6"
        />
      </span>
      {item.external_id ? (
        <span className="text-xs">
          {t("workspace.itemDetail.externalIdLabel")}{" "}
          <code className="font-mono">{item.external_id}</code>
        </span>
      ) : null}
      {item.archived ? (
        <Badge variant="outline">{t("workspace.panel.archived")}</Badge>
      ) : null}
    </span>
  );

  return (
    <div className="relative">
      <PageHeader
        breadcrumb={{ label: context.name, href: backHref }}
        title={title}
        action={headerAction}
        meta={idLine}
      />

      <div className="mt-6 space-y-6">
        {/* Pipeline status line — the "did it work?" answer. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {steps.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  ·
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-sm">
                {step.done ? (
                  <Check aria-hidden="true" className="size-4 text-success" />
                ) : (
                  <StatusDot status="muted" />
                )}
                <span
                  className={cn(
                    step.done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </span>
            </React.Fragment>
          ))}
          <span className="ml-auto inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {t("workspace.items.chunks", { count: chunkCount })}
            {item.embeddings_updated_at ? (
              <>
                <span aria-hidden="true">·</span>
                <RelativeTime date={item.embeddings_updated_at} />
              </>
            ) : null}
          </span>
        </div>

        <div className="border-t" />

        {/* Sections — reused verbatim from the panel. */}
        <div className="space-y-4">
          <ItemFieldsSection
            context={context}
            item={item}
            draft={editor.draft}
            editing={editor.editing}
            onDraftChange={editor.setDraft}
            onProcess={context.processor ? editor.triggerProcess : undefined}
            processPending={editor.processPending}
            form={editor.form}
          />
          <ItemEmbeddingsSection
            context={context}
            item={item}
            onGenerate={() => editor.setConfirm("generate-embeddings")}
            onDelete={() => editor.setConfirm("delete-embeddings")}
          />
          <ItemAccessSection
            context={context}
            item={item}
            editing={editor.editing}
            onChange={(rights_mode, users, roles, teams) =>
              editor.setRbac({ rights_mode, users, roles, teams })
            }
          />
          <ItemCalculatedSection context={context} item={item} />
        </div>
      </div>

      {editor.confirm && editor.confirmCfg && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && editor.setConfirm(null)}
          onConfirm={async () => {
            await editor.runConfirm();
            editor.setConfirm(null);
          }}
          title={editor.confirmCfg.title!}
          description={editor.confirmCfg.description}
          variant={editor.confirmCfg.variant}
          confirmLabel={editor.confirmCfg.confirmLabel}
        />
      )}

      {editor.overlayVariant && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <LoadingStates variant={editor.overlayVariant} />
        </div>
      )}
    </div>
  );
}
