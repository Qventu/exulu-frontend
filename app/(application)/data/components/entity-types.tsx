"use client";

/**
 * ContextEntityTypes — admin surface for a context's entity types (graph
 * retrieval entity layer). Rendered as the "Entities" tab of /data/[ctx].
 *
 * Lists the entity types extracted from documents (merged with any declared in
 * code), with create/edit/activate/delete and a backfill prompt when items
 * predate the current type set. Restyled to the knowledge redesign language:
 * a bordered row list with StatusDot + OverflowMenu, EmptyState, and the same
 * alert pattern as the pipeline health view. All copy is i18n.
 */

import { useMutation, useQuery } from "@apollo/client";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Pencil, Plus, Power, Sparkles, Trash2, Waypoints } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/primitives/empty-state";
import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { StatusDot } from "@/components/primitives/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  BACKFILL_ENTITIES,
  CREATE_ENTITY_TYPE,
  DELETE_ENTITY_TYPE,
  GET_ENTITY_TYPES,
  GET_STALE_ENTITY_COUNT,
  UPDATE_ENTITY_TYPE,
} from "@/queries/queries";

export interface ContextEntityTypesProps {
  context: string;
}

type EntityTypeRow = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function ContextEntityTypes({ context }: ContextEntityTypesProps) {
  const t = useTranslations("knowledge");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EntityTypeRow | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formActive, setFormActive] = React.useState(true);

  // Per-context operations (the query/mutation docs depend on the context id).
  const backfillMutationDoc = React.useMemo(
    () => BACKFILL_ENTITIES(context),
    [context],
  );
  const staleCountQueryDoc = React.useMemo(
    () => GET_STALE_ENTITY_COUNT(context),
    [context],
  );

  const { data, loading, error, refetch } = useQuery<{
    entity_type_settingsPagination: { items: EntityTypeRow[] };
  }>(GET_ENTITY_TYPES, { variables: { context } });

  const types = data?.entity_type_settingsPagination?.items ?? [];

  const { data: staleData, refetch: refetchStale } = useQuery<{
    [key: string]: number;
  }>(staleCountQueryDoc);
  const staleCount = staleData?.[`${context}_itemsStaleEntityCount`] ?? 0;

  const [createEntityType] = useMutation(CREATE_ENTITY_TYPE, {
    onCompleted: () => {
      refetch();
      refetchStale();
      toast.success(t("workspace.entities.toasts.created"));
    },
    onError: (e) =>
      toast.error(t("workspace.entities.toasts.createError"), {
        description: e.message,
      }),
  });

  const [updateEntityType] = useMutation(UPDATE_ENTITY_TYPE, {
    onCompleted: () => {
      refetch();
      refetchStale();
      toast.success(t("workspace.entities.toasts.updated"));
    },
    onError: (e) =>
      toast.error(t("workspace.entities.toasts.updateError"), {
        description: e.message,
      }),
  });

  const [deleteEntityType] = useMutation(DELETE_ENTITY_TYPE, {
    onCompleted: () => {
      refetch();
      refetchStale();
      toast.success(t("workspace.entities.toasts.deleted"));
    },
    onError: (e) =>
      toast.error(t("workspace.entities.toasts.deleteError"), {
        description: e.message,
      }),
  });

  const [backfillEntities, backfillResult] = useMutation<{
    [key: string]: { processed: number; skipped: number };
  }>(backfillMutationDoc, {
    onCompleted: (output) => {
      const result = output[`${context}_itemsBackfillEntities`];
      refetchStale();
      const processed = t("workspace.entities.toasts.backfillProcessed", {
        count: (result?.processed ?? 0).toLocaleString(),
      });
      const skipped = result?.skipped
        ? " " +
          t("workspace.entities.toasts.backfillSkipped", {
            count: result.skipped.toLocaleString(),
          })
        : "";
      toast.success(t("workspace.entities.toasts.backfillDone"), {
        description: processed + skipped,
      });
    },
    onError: (e) =>
      toast.error(t("workspace.entities.toasts.backfillError"), {
        description: e.message,
      }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (row: EntityTypeRow) => {
    setEditing(row);
    setFormName(row.name);
    setFormDescription(row.description || "");
    setFormActive(row.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error(t("workspace.entities.toasts.nameRequired"));
      return;
    }
    if (editing) {
      await updateEntityType({
        variables: {
          id: editing.id,
          name: formName.trim(),
          description: formDescription,
          active: formActive,
        },
      });
    } else {
      await createEntityType({
        variables: {
          name: formName.trim(),
          description: formDescription,
          context,
          active: formActive,
        },
      });
    }
    setDialogOpen(false);
  };

  const toggleActive = (row: EntityTypeRow) =>
    updateEntityType({
      variables: {
        id: row.id,
        name: row.name,
        description: row.description,
        active: !row.active,
      },
    });

  const menuItems = (row: EntityTypeRow): OverflowMenuItem[] => [
    {
      label: t("workspace.entities.menu.edit"),
      icon: Pencil,
      onSelect: () => openEdit(row),
    },
    {
      label: row.active
        ? t("workspace.entities.menu.deactivate")
        : t("workspace.entities.menu.activate"),
      icon: Power,
      onSelect: () => void toggleActive(row),
    },
    {
      label: t("workspace.entities.menu.delete"),
      icon: Trash2,
      destructive: true,
      onSelect: () => void deleteEntityType({ variables: { id: row.id } }),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Intro + primary action. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("workspace.entities.description")}
        </p>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus aria-hidden="true" className="mr-2 size-4" />
          {t("workspace.entities.addType")}
        </Button>
      </div>

      {/* Backfill prompt — items predate the current type set. */}
      {staleCount > 0 && (
        <Alert>
          <Sparkles className="size-4 text-primary" />
          <AlertTitle>{t("workspace.entities.backfill.title")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t("workspace.entities.backfill.description", {
                count: staleCount.toLocaleString(),
              })}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={backfillResult.loading}
              onClick={() => backfillEntities({ variables: { onlyStale: true } })}
            >
              {backfillResult.loading
                ? t("workspace.entities.backfill.running")
                : t("workspace.entities.backfill.cta")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Body: loading / error / empty / list. */}
      {loading ? (
        <div className="rounded-md border">
          <ul className="divide-y divide-border" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-3 py-3.5 md:px-4"
              >
                <Skeleton className="size-2 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="hidden h-3 w-64 max-w-full md:block" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="size-4" />
          <AlertTitle>{t("workspace.entities.loadErrorTitle")}</AlertTitle>
          <AlertDescription>
            {error.message || t("workspace.entities.loadError")}
          </AlertDescription>
        </Alert>
      ) : types.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          variant="quiet"
          title={t("workspace.entities.empty")}
          description={t("workspace.entities.emptyDescription")}
        />
      ) : (
        <div className="rounded-md border">
          <ul className="divide-y divide-border">
            {types.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 px-3 py-3 md:gap-4 md:px-4"
              >
                <StatusDot
                  status={row.active ? "success" : "muted"}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium md:text-base">
                    {row.name}
                  </p>
                  {row.description ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                </div>
                {!row.active ? (
                  <Badge variant="outline" className="shrink-0">
                    {t("workspace.entities.inactive")}
                  </Badge>
                ) : null}
                <OverflowMenu
                  items={menuItems(row)}
                  label={t("workspace.entities.menu.label")}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create / edit dialog. */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("workspace.entities.dialog.editTitle")
                : t("workspace.entities.dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("workspace.entities.dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-type-name">
                {t("workspace.entities.dialog.nameLabel")}
              </Label>
              <Input
                id="entity-type-name"
                placeholder={t("workspace.entities.dialog.namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity-type-description">
                {t("workspace.entities.dialog.descriptionLabel")}
              </Label>
              <Textarea
                id="entity-type-description"
                placeholder={t(
                  "workspace.entities.dialog.descriptionPlaceholder",
                )}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="entity-type-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label htmlFor="entity-type-active">
                {t("workspace.entities.dialog.activeLabel")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("workspace.entities.dialog.cancel")}
            </Button>
            <Button onClick={handleSave}>
              {t("workspace.entities.dialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
