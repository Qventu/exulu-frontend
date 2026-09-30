"use client";

/**
 * StageEmbedder — Embedder variant of the pipeline stage card, promoted to
 * `components/widgets` (context-embedder-settings plan, Task 7) so a second
 * surface (Transcript settings) can render the identical component rather
 * than a copy. Promoted the same way as `QueuePanel` and `FilePicker`
 * (design/codebase-structure.md).
 *
 * The widgets tier must not import app/ (codebase-structure §1.2), so this
 * file does not reuse the feature-local `StageCard` shell or
 * `BulkFilterDialog` — it renders its own card shell from the same
 * primitives `StageCard` is built from (Card/Collapsible/OverflowMenu), and
 * the bulk "Run" / "Delete embeddings" flows are opened via the `onRun` /
 * `onDeleteEmbeddings` callback props, with the dialogs themselves owned by
 * the feature-tier caller (`PipelineTab`). Embedder settings data
 * (`useEmbedderSettings`) is likewise fetched by the caller and passed down
 * as props instead of being read from `app/(application)/data/hooks`
 * directly — the same "pass in what it needs" inversion `BulkAccessDialog`
 * used when it was promoted.
 *
 * "Run" and the overflow's "Delete embeddings" continue to drive
 * BulkFilterDialog(mode="generate-embeddings" | "delete-embeddings") one
 * level up. The overflow also hosts "Change model", opening
 * `EmbedderChangeDialog` (owned locally — it is a widget too). Jobs
 * expander mounts QueuePanel on the embedder queue; retry calls
 * `onRetryChunk`.
 */

import { ChevronDown, Loader2, Pencil, Play, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { QueuePanel } from "@/components/primitives/queue-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Context } from "@/types/models/context";

import {
  EmbedderChangeDialog,
  type EmbedderChangeDialogInfo,
  type EmbedderModelOption,
  type EmbedderQueueOption,
} from "./embedder-change-dialog";

export type { EmbedderChangeDialogInfo, EmbedderModelOption, EmbedderQueueOption };

export interface StageEmbedderProps {
  context: Context;
  /** Open + scroll this stage's Jobs when deep-linked (?stage=). */
  autoOpenJobs?: boolean;
  /** From `useEmbedderSettings`; undefined while the info query is loading. */
  info?: EmbedderChangeDialogInfo;
  models: EmbedderModelOption[];
  queues: EmbedderQueueOption[];
  /** Performs the model/queue change (`useEmbedderSettings().setEmbedder`). */
  onSetEmbedder: (
    model: string | null,
    queue: string | null,
  ) => Promise<{ rebuild: string; itemsQueued: number }>;
  /** Opens the bulk "generate embeddings" flow (BulkFilterDialog, owned by the caller). */
  onRun: () => void;
  /** Opens the bulk "delete embeddings" flow (BulkFilterDialog, owned by the caller). */
  onDeleteEmbeddings: () => void;
  /** Retries a single failed embedding job for an item (QueuePanel retry). */
  onRetryChunk: (itemId: string) => void;
}

export function StageEmbedder({
  context,
  autoOpenJobs = false,
  info,
  models,
  queues,
  onSetEmbedder,
  onRun,
  onDeleteEmbeddings,
  onRetryChunk,
}: StageEmbedderProps) {
  const t = useTranslations("knowledge");

  const [changeOpen, setChangeOpen] = React.useState(false);
  const [jobsOpen, setJobsOpen] = React.useState(autoOpenJobs);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (autoOpenJobs) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [autoOpenJobs]);

  if (!info) {
    return (
      <Card ref={cardRef} className="border-border bg-card">
        <CardHeader className="flex flex-row items-start gap-3 border-b pb-4">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <h3 className="text-base font-medium">
            {t("workspace.pipeline.embedder.title")}
          </h3>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("common.loading")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const overflow: OverflowMenuItem[] = info.effectiveModel
    ? [
        {
          label: t("workspace.pipeline.embedder.change"),
          icon: Pencil,
          onSelect: () => setChangeOpen(true),
        },
        {
          label: t("workspace.pipeline.embedder.deleteEmbeddings"),
          icon: Trash2,
          destructive: true,
          onSelect: onDeleteEmbeddings,
        },
      ]
    : [];

  const calculateVectors = context.configuration?.calculateVectors;

  return (
    <>
      <Card ref={cardRef} className="border-border bg-card">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-medium">
                  {info.effectiveModel ?? t("workspace.pipeline.embedder.title")}
                </h3>
                {info.databaseQueue && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {info.databaseQueue}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {info.effectiveModel
                  ? t("workspace.pipeline.embedder.description")
                  : t("workspace.pipeline.embedder.notConfigured")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {info.effectiveModel ? (
              <Button type="button" variant="outline" size="sm" onClick={onRun}>
                <Play aria-hidden="true" className="mr-2 size-4" />
                {t("workspace.pipeline.run")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="max-md:h-11"
                onClick={() => setChangeOpen(true)}
              >
                {t("workspace.pipeline.embedder.choose")}
              </Button>
            )}
            {overflow.length > 0 && (
              <OverflowMenu
                items={overflow}
                label={t("workspace.pipeline.stageMenuLabel", {
                  stage: t("workspace.pipeline.embedder.title"),
                })}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {info.effectiveModel ? (
            <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-sm">
              <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
                <div className="space-y-0.5">
                  <dt className="font-medium text-muted-foreground">
                    {t("workspace.pipeline.embedder.identityLabel")}
                  </dt>
                  <dd>
                    <Badge variant="outline">{info.effectiveModel}</Badge>
                  </dd>
                </div>
                {calculateVectors && (
                  <div className="space-y-0.5">
                    <dt className="font-medium text-muted-foreground">
                      {t("workspace.pipeline.embedder.trigger")}
                    </dt>
                    <dd>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {calculateVectors}
                      </Badge>
                    </dd>
                  </div>
                )}
                {typeof info.dimensionality === "number" && (
                  <div className="space-y-0.5">
                    <dt className="font-medium text-muted-foreground">
                      {t("workspace.pipeline.embedder.dimensionalityLabel")}
                    </dt>
                    <dd>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {info.dimensionality}
                      </Badge>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : null}

          {info.effectiveModel && info.databaseQueue && (
            <div className="space-y-1 border-t pt-2">
              <Collapsible open={jobsOpen} onOpenChange={setJobsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                  >
                    {t("workspace.pipeline.jobs")}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4 transition-transform",
                        jobsOpen ? "" : "-rotate-90",
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <QueuePanel
                    queueName={info.databaseQueue}
                    displayName={info.effectiveModel ?? undefined}
                    embedded
                    canWrite={true}
                    enableDeleteOriginalAfterRetry={true}
                    retryJob={(job) => {
                      if (job.data && typeof job.data === "object") {
                        const data = job.data as { item?: string };
                        if (data.item) {
                          onRetryChunk(data.item);
                          return false;
                        }
                      }
                      return true;
                    }}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </CardContent>
      </Card>

      <EmbedderChangeDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        contextId={context.id}
        info={info}
        models={models}
        queues={queues}
        onSetEmbedder={onSetEmbedder}
        onConfirmed={() => setChangeOpen(false)}
      />
    </>
  );
}
