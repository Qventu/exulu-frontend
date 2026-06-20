"use client";

/**
 * StageEmbedder — Embedder variant of the pipeline StageCard. Meta:
 * embedder model, trigger (configuration.calculateVectors), queue.
 *
 * "Run" opens BulkFilterDialog(mode="generate-embeddings"). The overflow
 * menu hosts "Delete embeddings" via BulkFilterDialog(mode="delete-
 * embeddings", destructive). Jobs expander mounts QueuePanel on the
 * embedder queue; retry wires to GENERATE_CHUNKS.
 *
 * The embedder is now a plain `{ model, queue }` resolved via LiteLLM —
 * there are no per-embedder variable bindings (embedder_settings) anymore.
 */

import { useMutation } from "@apollo/client";
import { Play, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { QueuePanel } from "@/components/primitives/queue-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Context } from "@/types/models/context";

import { GENERATE_CHUNKS } from "../../queries";

import { BulkFilterDialog } from "./bulk-filter-dialog";
import { StageCard } from "./stage-card";

export interface StageEmbedderProps {
  context: Context;
  /** Open + scroll this stage's Jobs when deep-linked (?stage=). */
  autoOpenJobs?: boolean;
}

export function StageEmbedder({ context, autoOpenJobs }: StageEmbedderProps) {
  const t = useTranslations("knowledge");

  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const embedder = context.embedder;

  const [generateChunks] = useMutation(GENERATE_CHUNKS(context.id), {
    onCompleted: () =>
      toast.success(t("workspace.bulk.generateScheduled")),
    onError: (e) =>
      toast.error(t("workspace.bulk.generateError"), {
        description: e.message,
      }),
  });

  if (!embedder) {
    return (
      <StageCard
        stage="embedder"
        icon={Sparkles}
        title={t("workspace.pipeline.embedder.title")}
        description={t("workspace.pipeline.embedder.description")}
      >
        <p className="text-sm text-muted-foreground">
          {t("workspace.pipeline.embedder.empty")}
        </p>
      </StageCard>
    );
  }

  const calculateVectors = context.configuration?.calculateVectors;

  return (
    <>
      <StageCard
        stage="embedder"
        icon={Sparkles}
        title={embedder.model ?? t("workspace.pipeline.embedder.title")}
        description={t("workspace.pipeline.embedder.description")}
        queue={embedder.queue ?? undefined}
        primaryAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGenerateOpen(true)}
          >
            <Play aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.pipeline.run")}
          </Button>
        }
        overflow={[
          {
            label: t("workspace.pipeline.embedder.deleteEmbeddings"),
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          },
        ]}
        meta={
          <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
            <div className="space-y-0.5">
              <dt className="font-medium text-muted-foreground">
                {t("workspace.pipeline.embedder.identityLabel")}
              </dt>
              <dd>
                <Badge variant="outline">{embedder.model}</Badge>
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
          </dl>
        }
        autoOpenJobs={autoOpenJobs}
        jobs={
          embedder.queue ? (
            <QueuePanel
              queueName={embedder.queue}
              displayName={embedder.model ?? undefined}
              embedded
              canWrite={true}
              enableDeleteOriginalAfterRetry={true}
              retryJob={(job) => {
                if (job.data && typeof job.data === "object") {
                  const data = job.data as { item?: string };
                  if (data.item) {
                    void generateChunks({
                      variables: {
                        where: [{ id: { eq: data.item } }],
                      },
                    });
                    return false;
                  }
                }
                return true;
              }}
            />
          ) : null
        }
      />

      <BulkFilterDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        context={context}
        mode="generate-embeddings"
      />
      <BulkFilterDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        context={context}
        mode="delete-embeddings"
      />
    </>
  );
}
