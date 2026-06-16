"use client";

/**
 * useItemEditor — the item edit/mutation state machine, extracted from the
 * legacy ItemPanel so the dedicated item detail page
 * (`/data/[ctx]/items/[itemId]`, knowledge V2 Phase F1) can reuse the exact
 * same save / process / embed / archive / delete behaviour without
 * duplicating ~250 lines of mutation wiring.
 *
 * Owns: local `draft` + `rbac` + `editing` state (re-seeded per item), zod
 * validation on save, the five mutations (UPDATE / DELETE / PROCESS /
 * GENERATE_CHUNKS / DELETE_CHUNKS), the confirm-dialog discriminator, and
 * the loading-overlay variant. The consumer renders the layout.
 */

import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import type { ConfirmDialogProps } from "@/components/primitives/confirm-dialog";
import type { LoadingStatesVariant } from "@/components/loading-states";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import {
  DELETE_CHUNKS,
  DELETE_ITEM,
  GENERATE_CHUNKS,
  PROCESS_ITEM,
  UPDATE_ITEM,
} from "../../queries";

export type ItemConfirmKind =
  | "delete-item"
  | "generate-embeddings"
  | "delete-embeddings";

export interface PipelineSnapshot {
  last_processed_at?: string | null;
  embeddings_updated_at?: string | null;
  chunks_count?: number | null;
}

/** Does saving this context's item schedule processor/embedder work? */
function schedulesOnUpdate(context: Context): boolean {
  const calc = context.configuration?.calculateVectors;
  const embedderOnUpdate =
    Boolean(context.embedder) && (calc === "onUpdate" || calc === "always");
  const procTrigger = context.processor?.trigger;
  const processorOnUpdate =
    Boolean(context.processor) &&
    (procTrigger === "onUpdate" || procTrigger === "always");
  return embedderOnUpdate || processorOnUpdate;
}

interface RbacState {
  rights_mode?: "private" | "users" | "roles" | "teams" | "public";
  users?: { id: number; rights: "read" | "write" }[];
  roles?: { id: string; rights: "read" | "write" }[];
  teams?: { id: string; rights: "read" | "write" }[];
}

export interface UseItemEditorArgs {
  context: Context;
  item?: Item;
  refetch: () => void;
  /** Called after a successful delete so the page can navigate away. */
  onDeleted?: () => void;
  /** Called after any successful mutation (toast already fired). */
  onMutated?: () => void;
}

export function useItemEditor({
  context,
  item,
  refetch,
  onDeleted,
  onMutated,
}: UseItemEditorArgs) {
  const t = useTranslations("knowledge");

  const [draft, setDraft] = React.useState<Partial<Item>>({});
  const [rbac, setRbac] = React.useState<RbacState>({});
  const [editing, setEditing] = React.useState(false);
  const [confirm, setConfirm] = React.useState<ItemConfirmKind | null>(null);

  // Post-save pipeline progress (V2 Phase F2). `preSaveSnap` is set ONLY by
  // the explicit Save path, so archive toggles / bulk updates that reuse the
  // same mutation never trigger the progress view. It's consumed (cleared)
  // in the update onCompleted.
  const preSaveSnap = React.useRef<PipelineSnapshot | null>(null);
  const [progress, setProgress] = React.useState<{
    snapshot: PipelineSnapshot;
  } | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const itemFormSchema = React.useMemo(
    () =>
      z.object({
        name: z.string().nullable().optional(),
        tags: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        external_id: z.string().nullable().optional(),
        description: z
          .string()
          .min(2, { message: t("workspace.fields.descriptionTooShort") })
          .max(10000, { message: t("workspace.fields.descriptionTooLong") }),
        ...(context.fields ?? []).reduce(
          (acc, f) => ({ ...acc, [f.name]: z.any().nullable().optional() }),
          {} as Record<string, z.ZodTypeAny>,
        ),
      }),
    [context.fields, t],
  );

  const form = useForm({ resolver: zodResolver(itemFormSchema) });

  // ---- Mutations -----------------------------------------------------

  const [updateItem, updateItemResult] = useMutation(UPDATE_ITEM(context.id), {
    onCompleted: (data) => {
      toast.success(t("workspace.panel.toasts.updated"));
      onMutated?.();
      // Surface the pipeline progress view only for an explicit Save (which
      // set preSaveSnap) AND only when work was actually scheduled — either
      // the mutation returned a `job`, or the context config schedules work
      // on update.
      if (preSaveSnap.current) {
        const job = data?.[`${context.id}_itemsUpdateOneById`]?.job;
        if (job || schedulesOnUpdate(context)) {
          setProgress({ snapshot: preSaveSnap.current });
        }
        preSaveSnap.current = null;
      }
      refetch();
    },
    onError: (e) => {
      preSaveSnap.current = null;
      toast.error(t("workspace.panel.toasts.updateError"), {
        description: e.message,
      });
    },
  });

  const [deleteItem, deleteItemResult] = useMutation(DELETE_ITEM(context.id, []), {
    onCompleted: () => {
      toast.success(t("workspace.panel.toasts.deleted"));
      onMutated?.();
      onDeleted?.();
    },
    onError: (e) =>
      toast.error(t("workspace.panel.toasts.deleteError"), {
        description: e.message,
      }),
  });

  const [processItem, processItemResult] = useMutation(PROCESS_ITEM(context.id), {
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
  });

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

  const [deleteChunks, deleteChunksResult] = useMutation(DELETE_CHUNKS(context.id), {
    onCompleted: () => {
      toast.success(t("workspace.panel.toasts.embeddingsDeleted"));
      refetch();
    },
    onError: (e) =>
      toast.error(t("workspace.panel.toasts.deleteError"), {
        description: e.message,
      }),
  });

  // ---- Confirm dialog config ----------------------------------------

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
              description: t("workspace.panel.confirm.deleteEmbeddings.description"),
              variant: "destructive",
              confirmLabel: t("workspace.panel.confirm.deleteEmbeddings.confirm"),
            }
          : null;

  const runConfirm = async () => {
    if (!item?.id) return;
    if (confirm === "delete-item") {
      await deleteItem({ variables: { id: item.id } });
    } else if (confirm === "generate-embeddings") {
      await generateChunks({ variables: { where: [{ id: { eq: item.id } }] } });
    } else if (confirm === "delete-embeddings") {
      await deleteChunks({ variables: { where: [{ id: { eq: item.id } }] } });
    }
  };

  // ---- Handlers ------------------------------------------------------

  const handleSave = async () => {
    if (!item?.id || !draft) return;
    const validation = itemFormSchema.safeParse({
      name: draft.name,
      tags: draft.tags,
      external_id: draft.external_id,
      description: draft.description ?? "",
      ...(context.fields ?? []).reduce(
        (acc, f) => ({ ...acc, [f.name]: (draft as Record<string, unknown>)[f.name] }),
        {} as Record<string, unknown>,
      ),
    });
    if (!validation.success) {
      toast.error(t("workspace.panel.toasts.validation"), {
        description: validation.error.issues[0]?.message,
      });
      return;
    }
    // Snapshot pre-save pipeline state so the progress view can detect when
    // each downstream stage advances. Set here (not in archive/bulk paths)
    // so only an explicit Save can open the progress view.
    preSaveSnap.current = {
      last_processed_at: item.last_processed_at,
      embeddings_updated_at: item.embeddings_updated_at,
      chunks_count: typeof item.chunks_count === "number" ? item.chunks_count : null,
    };
    await updateItem({
      variables: {
        id: item.id,
        input: {
          textlength:
            typeof draft.description === "string" ? draft.description.length : undefined,
          description: draft.description,
          name: draft.name,
          external_id: draft.external_id,
          tags: Array.isArray(draft.tags)
            ? draft.tags.join(",")
            : (draft.tags as string | undefined),
          archived: draft.archived,
          rights_mode: rbac.rights_mode,
          RBAC: { users: rbac.users ?? [], roles: rbac.roles ?? [] },
          ...(context.fields ?? []).reduce(
            (acc, f) => ({ ...acc, [f.name]: (draft as Record<string, unknown>)[f.name] }),
            {} as Record<string, unknown>,
          ),
        },
      },
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    if (item) {
      setDraft({ ...item, tags: Array.isArray(item.tags) ? item.tags : [] });
    }
    setEditing(false);
  };

  const handleArchiveToggle = async (next: boolean) => {
    if (!item?.id) return;
    await updateItem({ variables: { id: item.id, input: { archived: next } } });
  };

  const triggerProcess = () => {
    if (item?.id) void processItem({ variables: { item: item.id } });
  };

  const overlayVariant: LoadingStatesVariant | null = updateItemResult.loading
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

  return {
    // state
    draft,
    setDraft,
    rbac,
    setRbac,
    editing,
    setEditing,
    form,
    confirm,
    setConfirm,
    confirmCfg,
    overlayVariant,
    saving: updateItemResult.loading,
    processPending: processItemResult.loading,
    // post-save progress (V2 Phase F2)
    progress,
    dismissProgress: () => setProgress(null),
    // handlers
    handleSave,
    cancelEdit,
    handleArchiveToggle,
    triggerProcess,
    runConfirm,
  };
}
