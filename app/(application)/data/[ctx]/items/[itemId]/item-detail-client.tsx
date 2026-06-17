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
import { Archive, Database, Info, PackageOpen, Save, Trash2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ConfigContext } from "@/components/shell/config-context";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { CopyButton } from "@/components/primitives/copy-button";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStates } from "@/components/loading-states";
import type { Context } from "@/types/models/context";

import { useItemDetail } from "../../../hooks";
import { ItemAccessSection } from "../../components/item-access-section";
import { ItemCalculatedSection } from "../../components/item-calculated-section";
import { ItemEmbeddingsSection } from "../../components/item-embeddings-section";
import { ItemDocumentHero } from "../../components/item-fields-view";
import { ItemFieldsSection } from "../../components/item-fields-section";
import { useItemEditor } from "../../components/use-item-editor";
import { ItemPipelineStatus } from "./item-pipeline-status";

export interface ItemDetailClientProps {
  context: Context;
  itemId: string;
}

function DetailRow({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-start gap-1">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">
          {value}
        </code>
        <CopyButton
          value={value}
          label={copyLabel}
          size="icon"
          className="size-6 shrink-0"
        />
      </div>
    </div>
  );
}

export function ItemDetailClient({ context, itemId }: ItemDetailClientProps) {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const config = React.useContext(ConfigContext);
  const workersConfigured = Boolean(
    config?.workers?.enabled && config?.workers?.redisHost,
  );

  const { item, loading, error, refetch } = useItemDetail({ context, itemId });

  const editor = useItemEditor({
    context,
    item,
    refetch,
    onDeleted: () => router.push(`/data/${context.id}?tab=items`),
  });

  // Click-to-edit: an empty field tile opens edit mode focused on that field.
  const [focusField, setFocusField] = React.useState<string | null>(null);
  const handleEditField = React.useCallback(
    (name: string) => {
      setFocusField(name);
      editor.setEditing(true);
    },
    [editor],
  );
  // Clear the focus target whenever edit mode closes, so the plain Edit button
  // doesn't re-focus a previously clicked field.
  React.useEffect(() => {
    if (!editor.editing) setFocusField(null);
  }, [editor.editing]);

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

  // ---- Overflow menu ------------------------------------------------
  // Process + Generate embeddings now live on the interactive pipeline
  // stepper (as per-step Run / Re-run); the menu keeps the rarer + the
  // destructive actions.

  const overflowItems: OverflowMenuItem[] = [];
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

  // Technical identifiers (UUID, external id / source path) are tucked behind
  // a quiet "Details" popover so the header stays clean for data-stewards;
  // power users expand to copy them.
  const idLine = (
    <span className="flex flex-wrap items-center gap-2">
      {item.archived ? (
        <Badge variant="outline">{t("workspace.panel.archived")}</Badge>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Info aria-hidden="true" className="size-3.5" />
            {t("workspace.itemDetail.details")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3">
          <DetailRow
            label={t("workspace.itemDetail.idLabel")}
            value={item.id ?? ""}
            copyLabel={t("workspace.itemDetail.copyId")}
          />
          {item.external_id ? (
            <DetailRow
              label={t("workspace.fields.externalId")}
              value={item.external_id}
              copyLabel={t("workspace.fields.copyValue", {
                label: t("workspace.fields.externalId"),
              })}
            />
          ) : null}
        </PopoverContent>
      </Popover>
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
        {/* Persistent interactive pipeline stepper — live state + per-step
            Run / Re-run; replaces the static status line and the hidden
            ⋯ process/embed actions. */}
        <ItemPipelineStatus
          context={context}
          item={item}
          refetch={refetch}
          onProcess={editor.triggerProcess}
          onGenerate={editor.triggerGenerate}
          processPending={editor.processPending}
          generatePending={editor.generatePending}
          saveActivity={editor.saveActivity}
          workersConfigured={workersConfigured}
        />

        <div className="border-t" />

        {/* Sections. The promoted document hero (first file field, if any)
            leads the content; renders nothing for file-less contexts. */}
        <div className="space-y-4">
          <ItemDocumentHero context={context} values={item} />
          <ItemFieldsSection
            context={context}
            item={item}
            draft={editor.draft}
            editing={editor.editing}
            onDraftChange={editor.setDraft}
            onProcess={context.processor ? editor.triggerProcess : undefined}
            processPending={editor.processPending}
            form={editor.form}
            onEditField={handleEditField}
            focusField={focusField}
          />
          <ItemEmbeddingsSection
            context={context}
            item={item}
            onGenerate={editor.triggerGenerate}
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
