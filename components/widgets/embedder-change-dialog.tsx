"use client";

/**
 * EmbedderChangeDialog — confirms a context's embedding-model change
 * (context-embedder-settings plan, Task 7). Changing the model is
 * destructive: the chunks table bakes the vector dimension into its
 * column, so a different dimensionality rebuilds the table, and any model
 * change regenerates every embedding. This dialog's job is to make that
 * consequence impossible to miss before the admin confirms — it reuses the
 * shared `ConfirmDialog` (the only destructive-confirmation surface in the
 * app) rather than a bespoke Dialog + AlertDialog stack.
 *
 * Data + the mutation are passed in as props rather than fetched here with
 * `useEmbedderSettings` — this file lives in `components/widgets`, which
 * must not import `app/` (codebase-structure §1.2). Same inversion
 * `BulkAccessDialog` used when it was promoted (take the mutation as a
 * prop instead of building it from a feature-local `context`).
 */

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { summariseEmbedderChange } from "./embedder-change-summary";

export interface EmbedderChangeDialogInfo {
  effectiveModel: string | null;
  source: "database" | "code" | null;
  databaseModel: string | null;
  codeModel: string | null;
  databaseQueue: string | null;
  dimensionality: number | null;
  chunkCount: number;
}

export interface EmbedderModelOption {
  model: string;
  dimensionality: number;
}

export interface EmbedderQueueOption {
  name: string;
}

export interface EmbedderChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextId: string;
  /** Current state, so the dialog can state what will be destroyed. */
  info: EmbedderChangeDialogInfo;
  models: EmbedderModelOption[];
  queues: EmbedderQueueOption[];
  /** Performs the change (`useEmbedderSettings().setEmbedder`, owned by the caller). */
  onSetEmbedder: (
    model: string | null,
    queue: string | null,
  ) => Promise<{ rebuild: string; itemsQueued: number }>;
  onConfirmed: () => void;
}

const NONE = "none";

export function EmbedderChangeDialog({
  open,
  onOpenChange,
  contextId,
  info,
  models,
  queues,
  onSetEmbedder,
  onConfirmed,
}: EmbedderChangeDialogProps) {
  const t = useTranslations("knowledge");

  const [model, setModel] = React.useState<string | null>(info.effectiveModel);
  const [queue, setQueue] = React.useState<string | null>(info.databaseQueue);

  React.useEffect(() => {
    if (open) {
      setModel(info.effectiveModel);
      setQueue(info.databaseQueue);
    }
    // Fresh selection every time the dialog opens; `info` changes on every
    // refetch (including this dialog's own confirm), which would otherwise
    // reset the in-progress selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canClear = info.databaseModel !== null;

  const modelDimensionality = model
    ? (models.find((option) => option.model === model)?.dimensionality ?? null)
    : null;

  const summary = summariseEmbedderChange({
    nextModel: model,
    nextDimensionality: modelDimensionality,
    currentDimensionality: info.dimensionality,
    chunkCount: info.chunkCount,
    queue,
  });

  const tableLine =
    summary.action === "create"
      ? t("workspace.pipeline.embedder.dialog.tableCreate")
      : summary.action === "recreate"
        ? t("workspace.pipeline.embedder.dialog.tableRebuild")
        : t("workspace.pipeline.embedder.dialog.tableEmpty");

  const warningLines = [
    summary.action === "cleared"
      ? t("workspace.pipeline.embedder.dialog.clearLine")
      : t("workspace.pipeline.embedder.dialog.modelLine", {
          model: model ?? "",
          dimensionality: modelDimensionality ?? 0,
        }),
    tableLine,
    t("workspace.pipeline.embedder.dialog.chunks", { count: summary.chunksDeleted }),
    t("workspace.pipeline.embedder.dialog.searchDown"),
  ];
  if (summary.willRunInline) {
    warningLines.push(t("workspace.pipeline.embedder.dialog.inline"));
  }
  const warning = warningLines.join(" ");

  const handleConfirm = async () => {
    try {
      await onSetEmbedder(model, queue);
      onConfirmed();
    } catch (error) {
      toast.error(t("workspace.pipeline.embedder.dialog.error"), {
        description: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("workspace.pipeline.embedder.dialog.title")}
      description={t("workspace.pipeline.embedder.dialog.description")}
      variant="destructive"
      confirmLabel={
        model
          ? t("workspace.pipeline.embedder.dialog.confirm")
          : t("workspace.pipeline.embedder.dialog.confirmClear")
      }
      warning={warning}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`embedder-model-${contextId}`}>
            {t("workspace.pipeline.embedder.dialog.modelLabel")}
          </Label>
          <Select
            value={model ?? NONE}
            onValueChange={(value) => setModel(value === NONE ? null : value)}
          >
            <SelectTrigger id={`embedder-model-${contextId}`} className="max-md:h-11">
              <SelectValue
                placeholder={t("workspace.pipeline.embedder.dialog.modelPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {canClear && (
                <SelectItem value={NONE}>
                  {t("workspace.pipeline.embedder.dialog.useDefault")}
                </SelectItem>
              )}
              {models.map((option) => (
                <SelectItem key={option.model} value={option.model}>
                  {t("workspace.pipeline.embedder.dialog.modelOption", {
                    model: option.model,
                    dimensionality: option.dimensionality,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`embedder-queue-${contextId}`}>
            {t("workspace.pipeline.embedder.dialog.queueLabel")}
          </Label>
          <Select
            value={queue ?? NONE}
            onValueChange={(value) => setQueue(value === NONE ? null : value)}
          >
            <SelectTrigger id={`embedder-queue-${contextId}`} className="max-md:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                {t("workspace.pipeline.embedder.dialog.runInline")}
              </SelectItem>
              {queues.map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </ConfirmDialog>
  );
}
