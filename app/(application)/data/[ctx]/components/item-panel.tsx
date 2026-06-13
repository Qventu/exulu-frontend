"use client";

/**
 * ItemPanel — side panel rendering the selected item's detail. Replaces
 * the legacy `data-display.tsx` mega-component (1551 lines) with a stack
 * of DetailSection primitives (Fields / Embeddings / Access / Calculated).
 *
 * Header: name + Archived badge + Edit/Save/Cancel + OverflowMenu(Process,
 * Generate embeddings, Delete embeddings, Archive/Unarchive, Delete).
 *
 * Inventory items handled here: 38 (Edit/Save/Cancel), 39 (Archive /
 * Unarchive / Delete via OverflowMenu + ConfirmDialog), 45 (Process item
 * — only when context.processor exists), 48 (Generate embeddings —
 * ConfirmDialog), 49 (Delete embeddings — destructive ConfirmDialog), 50
 * (mutation overlays), 51 (detail loading/error/not-found inline states).
 */

import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  Archive,
  Database,
  PackageOpen,
  Save,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "@/components/primitives/confirm-dialog";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingStates,
  type LoadingStatesVariant,
} from "@/components/loading-states";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import { useItemDetail } from "../../hooks";
import {
  DELETE_CHUNKS,
  DELETE_ITEM,
  GENERATE_CHUNKS,
  PROCESS_ITEM,
  UPDATE_ITEM,
} from "../../queries";

import { ItemAccessSection } from "./item-access-section";
import { ItemCalculatedSection } from "./item-calculated-section";
import { ItemEmbeddingsSection } from "./item-embeddings-section";
import { ItemFieldsSection } from "./item-fields-section";

export interface ItemPanelProps {
  context: Context;
  itemId: string;
  onClose: () => void;
  onMutated?: () => void;
}

export function ItemPanel({
  context,
  itemId,
  onClose,
  onMutated,
}: ItemPanelProps) {
  const t = useTranslations("knowledge");
  const { item, loading, error, refetch } = useItemDetail({
    context,
    itemId,
  });

  const [draft, setDraft] = React.useState<Partial<Item>>({});
  const [rbac, setRbac] = React.useState<{
    rights_mode?: "private" | "users" | "roles" | "teams" | "public";
    users?: { id: number; rights: "read" | "write" }[];
    roles?: { id: string; rights: "read" | "write" }[];
    teams?: { id: string; rights: "read" | "write" }[];
  }>({});
  const [editing, setEditing] = React.useState(false);

  // Re-seed local draft / rbac whenever a new item loads.
  React.useEffect(() => {
    if (!item) return;
    setDraft({
      ...item,
      tags: Array.isArray(item.tags)
        ? item.tags
        : typeof item.tags === "string" && (item.tags as string).length > 0
          ? (item.tags as string).split(",")
          : [],
    });
    setRbac({
      rights_mode: item.rights_mode,
      users: item.RBAC?.users,
      roles: item.RBAC?.roles,
    });
    setEditing(false);
  }, [item?.id]);

  // ---- Schema (zod). Enforced on Save (Med-sev legacy bug fixed). ----
  const itemFormSchema = React.useMemo(
    () =>
      z.object({
        name: z.string().nullable().optional(),
        tags: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        external_id: z.string().nullable().optional(),
        description: z
          .string()
          .min(2, {
            message: t("workspace.fields.descriptionTooShort"),
          })
          .max(10000, {
            message: t("workspace.fields.descriptionTooLong"),
          }),
        ...(context.fields ?? []).reduce(
          (acc, f) => ({
            ...acc,
            [f.name]: z.any().nullable().optional(),
          }),
          {} as Record<string, z.ZodTypeAny>,
        ),
      }),
    [context.fields, t],
  );

  const form = useForm({ resolver: zodResolver(itemFormSchema) });

  // ---- Mutations -----------------------------------------------------

  const [updateItem, updateItemResult] = useMutation(UPDATE_ITEM(context.id), {
    onCompleted: () => {
      toast.success(t("workspace.panel.toasts.updated"));
      onMutated?.();
      refetch();
    },
    onError: (e) =>
      toast.error(t("workspace.panel.toasts.updateError"), {
        description: e.message,
      }),
  });

  const [deleteItem, deleteItemResult] = useMutation(
    DELETE_ITEM(context.id, []),
    {
      onCompleted: () => {
        toast.success(t("workspace.panel.toasts.deleted"));
        onMutated?.();
        onClose();
      },
      onError: (e) =>
        toast.error(t("workspace.panel.toasts.deleteError"), {
          description: e.message,
        }),
    },
  );

  const [processItem, processItemResult] = useMutation(
    PROCESS_ITEM(context.id),
    {
      onCompleted: (data) => {
        const r = data?.[`${context.id}_itemsProcessItem`];
        toast.success(r?.message ?? t("workspace.panel.toasts.processed"), {
          description: r?.jobs?.length
            ? t("workspace.bulk.jobsScheduled", { count: r.jobs.length })
            : undefined,
        });
      },
      onError: (e) =>
        toast.error(t("workspace.panel.toasts.processError"), {
          description: e.message,
        }),
    },
  );

  const [generateChunks, generateChunksResult] = useMutation(
    GENERATE_CHUNKS(context.id),
    {
      onCompleted: (data) => {
        const r = data?.[`${context.id}_itemsGenerateChunks`];
        toast.success(t("workspace.panel.toasts.generateStarted"), {
          description: r?.jobs?.length
            ? t("workspace.bulk.jobsScheduled", { count: r.jobs.length })
            : undefined,
        });
        refetch();
      },
      onError: (e) =>
        toast.error(t("workspace.panel.toasts.generateError"), {
          description: e.message,
        }),
    },
  );

  const [deleteChunks, deleteChunksResult] = useMutation(
    DELETE_CHUNKS(context.id),
    {
      onCompleted: () => {
        toast.success(t("workspace.panel.toasts.embeddingsDeleted"));
        refetch();
      },
      onError: (e) =>
        toast.error(t("workspace.panel.toasts.deleteError"), {
          description: e.message,
        }),
    },
  );

  // ---- Confirm dialog state -----------------------------------------

  const [confirm, setConfirm] = React.useState<
    | null
    | "delete-item"
    | "generate-embeddings"
    | "delete-embeddings"
  >(null);

  const confirmCfg: Partial<ConfirmDialogProps> | null =
    confirm === "delete-item"
      ? {
          title: t("workspace.panel.confirm.deleteItem.title"),
          description: t("workspace.panel.confirm.deleteItem.description"),
          variant: "destructive",
          confirmLabel: t("workspace.panel.confirm.deleteItem.confirm"),
        }
      : confirm === "generate-embeddings"
        ? {
            title: t("workspace.panel.confirm.generate.title"),
            description: t("workspace.panel.confirm.generate.description"),
            variant: "default",
            confirmLabel: t("workspace.panel.confirm.generate.confirm"),
          }
        : confirm === "delete-embeddings"
          ? {
              title: t("workspace.panel.confirm.deleteEmbeddings.title"),
              description: t(
                "workspace.panel.confirm.deleteEmbeddings.description",
              ),
              variant: "destructive",
              confirmLabel: t(
                "workspace.panel.confirm.deleteEmbeddings.confirm",
              ),
            }
          : null;

  const runConfirm = async () => {
    if (!item?.id) return;
    if (confirm === "delete-item") {
      await deleteItem({ variables: { id: item.id } });
    } else if (confirm === "generate-embeddings") {
      await generateChunks({
        variables: { where: [{ id: { eq: item.id } }] },
      });
    } else if (confirm === "delete-embeddings") {
      await deleteChunks({
        variables: { where: [{ id: { eq: item.id } }] },
      });
    }
  };

  // ---- Handlers -----------------------------------------------------

  const handleSave = async () => {
    if (!item?.id || !draft) return;
    const validation = itemFormSchema.safeParse({
      name: draft.name,
      tags: draft.tags,
      external_id: draft.external_id,
      description: draft.description ?? "",
      ...(context.fields ?? []).reduce(
        (acc, f) => ({
          ...acc,
          [f.name]: (draft as Record<string, unknown>)[f.name],
        }),
        {} as Record<string, unknown>,
      ),
    });
    if (!validation.success) {
      toast.error(t("workspace.panel.toasts.validation"), {
        description: validation.error.issues[0]?.message,
      });
      return;
    }
    await updateItem({
      variables: {
        id: item.id,
        input: {
          textlength:
            typeof draft.description === "string"
              ? draft.description.length
              : undefined,
          description: draft.description,
          name: draft.name,
          external_id: draft.external_id,
          tags: Array.isArray(draft.tags)
            ? draft.tags.join(",")
            : (draft.tags as string | undefined),
          archived: draft.archived,
          rights_mode: rbac.rights_mode,
          RBAC: {
            users: rbac.users ?? [],
            roles: rbac.roles ?? [],
          },
          ...(context.fields ?? []).reduce(
            (acc, f) => ({
              ...acc,
              [f.name]: (draft as Record<string, unknown>)[f.name],
            }),
            {} as Record<string, unknown>,
          ),
        },
      },
    });
    setEditing(false);
  };

  const handleArchiveToggle = async (next: boolean) => {
    if (!item?.id) return;
    await updateItem({
      variables: { id: item.id, input: { archived: next } },
    });
  };

  // ---- Render branches ----------------------------------------------

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
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
      <p className="p-8 text-center text-sm text-muted-foreground">
        {t("workspace.panel.notFound")}
      </p>
    );
  }

  // ---- Overflow menu items ------------------------------------------

  const overflowItems: OverflowMenuItem[] = [];
  if (context.processor) {
    overflowItems.push({
      label: t("workspace.panel.menu.process"),
      icon: Zap,
      onSelect: () => {
        void processItem({ variables: { item: item.id } });
      },
      description: context.processor.queue,
    });
  }
  overflowItems.push({
    label: t("workspace.panel.menu.generateEmbeddings"),
    icon: Sparkles,
    onSelect: () => setConfirm("generate-embeddings"),
  });
  overflowItems.push({
    label: t("workspace.panel.menu.deleteEmbeddings"),
    icon: Database,
    destructive: true,
    onSelect: () => setConfirm("delete-embeddings"),
  });
  overflowItems.push({
    label: item.archived
      ? t("workspace.panel.menu.unarchive")
      : t("workspace.panel.menu.archive"),
    icon: item.archived ? PackageOpen : Archive,
    onSelect: () => {
      void handleArchiveToggle(!item.archived);
    },
  });
  overflowItems.push({
    label: t("workspace.panel.menu.delete"),
    icon: Trash2,
    destructive: true,
    onSelect: () => setConfirm("delete-item"),
  });

  const overlayVariant: LoadingStatesVariant | null =
    updateItemResult.loading
      ? "save"
      : processItemResult.loading
        ? "process"
        : deleteItemResult.loading
          ? "delete"
          : generateChunksResult.loading
            ? "generate-chunks"
            : deleteChunksResult.loading
              ? "delete-chunks"
              : null;

  return (
    <div className="relative flex h-full flex-col">
      {/* Header: name + archived badge + edit/save/cancel + overflow */}
      <div className="flex items-start justify-between gap-2 border-b border-border p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate text-lg font-semibold">
            {item.name ?? item.external_id ?? t("workspace.items.untitled")}
          </h2>
          {item.archived && (
            <Badge variant="outline">{t("workspace.panel.archived")}</Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft({
                    ...item,
                    tags: Array.isArray(item.tags) ? item.tags : [],
                  });
                  setEditing(false);
                }}
              >
                <XCircle aria-hidden="true" className="mr-2 size-4" />
                {t("workspace.panel.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={updateItemResult.loading}
                onClick={handleSave}
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
              onClick={() => setEditing(true)}
            >
              {t("workspace.panel.edit")}
            </Button>
          )}
          <OverflowMenu
            items={overflowItems}
            label={t("workspace.panel.menu.label")}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ItemFieldsSection
          context={context}
          item={item}
          draft={draft}
          editing={editing}
          onDraftChange={setDraft}
          onProcess={
            context.processor
              ? () => void processItem({ variables: { item: item.id } })
              : undefined
          }
          processPending={processItemResult.loading}
          form={form}
        />
        <ItemEmbeddingsSection
          context={context}
          item={item}
          onGenerate={() => setConfirm("generate-embeddings")}
          onDelete={() => setConfirm("delete-embeddings")}
        />
        <ItemAccessSection
          context={context}
          item={item}
          editing={editing}
          onChange={(rights_mode, users, roles) =>
            setRbac({ rights_mode, users, roles })
          }
        />
        <ItemCalculatedSection context={context} item={item} />
      </div>

      {confirm && confirmCfg && (
        <ConfirmDialog
          open={true}
          onOpenChange={(o) => !o && setConfirm(null)}
          onConfirm={async () => {
            await runConfirm();
            setConfirm(null);
          }}
          title={confirmCfg.title!}
          description={confirmCfg.description}
          variant={confirmCfg.variant}
          confirmLabel={confirmCfg.confirmLabel}
        />
      )}

      {overlayVariant && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <LoadingStates variant={overlayVariant} />
        </div>
      )}
    </div>
  );
}
