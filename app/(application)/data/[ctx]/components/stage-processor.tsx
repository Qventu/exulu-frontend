"use client";

/**
 * StageProcessor — Processor variant of the pipeline StageCard. Meta:
 * queue, trigger, timeoutInSeconds, generateEmbeddings explanation (all
 * visible — NOT tooltip, fixing the legacy hover-only info pattern).
 *
 * "Run" opens BulkFilterDialog(mode="process"). The Jobs expander mounts
 * QueuePanel for the processor's queue; failed-job retry wires to
 * PROCESS_ITEM(ctx, job.data.item) when the job carries an item id.
 *
 * Inventory items: 61 (Processor config details visible), 62 (bulk
 * process via BulkFilterDialog), 64 (Processor queue + retry).
 */

import { useMutation } from "@apollo/client";
import { CheckCircle2, CircleSlash, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { QueuePanel } from "@/components/primitives/queue-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Context } from "@/types/models/context";

import { PROCESS_ITEM } from "../../queries";

import { BulkFilterDialog } from "./bulk-filter-dialog";
import { StageCard } from "./stage-card";

export interface StageProcessorProps {
  context: Context;
}

export function StageProcessor({ context }: StageProcessorProps) {
  const t = useTranslations("knowledge");
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const [processItem] = useMutation(PROCESS_ITEM(context.id), {
    onCompleted: (data) => {
      const r = data?.[`${context.id}_itemsProcessItem`];
      toast.success(r?.message ?? t("workspace.panel.toasts.processed"));
    },
    onError: (e) =>
      toast.error(t("workspace.panel.toasts.processError"), {
        description: e.message,
      }),
  });

  if (!context.processor) {
    return (
      <StageCard
        stage="processor"
        title={t("workspace.pipeline.processor.title")}
        description={t("workspace.pipeline.processor.description")}
      >
        <p className="text-sm text-muted-foreground">
          {t("workspace.pipeline.processor.empty")}
        </p>
      </StageCard>
    );
  }

  const p = context.processor;
  const generateEmbeddingsLabel = p.generateEmbeddings
    ? t("workspace.pipeline.processor.embeddingsOnLabel")
    : t("workspace.pipeline.processor.embeddingsOffLabel");

  return (
    <>
      <StageCard
        stage="processor"
        title={p.name ?? t("workspace.pipeline.processor.title")}
        description={p.description ?? undefined}
        queue={p.queue ?? undefined}
        primaryAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBulkOpen(true)}
          >
            <Play aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.pipeline.run")}
          </Button>
        }
        meta={
          <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            {p.trigger && (
              <div className="space-y-0.5">
                <dt className="font-medium text-muted-foreground">
                  {t("workspace.pipeline.processor.trigger")}
                </dt>
                <dd>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {p.trigger}
                  </Badge>
                </dd>
              </div>
            )}
            {typeof p.timeoutInSeconds === "number" && (
              <div className="space-y-0.5">
                <dt className="font-medium text-muted-foreground">
                  {t("workspace.pipeline.processor.timeout")}
                </dt>
                <dd>{p.timeoutInSeconds}s</dd>
              </div>
            )}
            <div className="space-y-0.5">
              <dt className="font-medium text-muted-foreground">
                {t("workspace.pipeline.processor.embeddings")}
              </dt>
              <dd className="inline-flex items-center gap-1">
                {p.generateEmbeddings ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                ) : (
                  <CircleSlash aria-hidden="true" className="size-4 text-muted-foreground" />
                )}
                <span>{generateEmbeddingsLabel}</span>
              </dd>
            </div>
          </dl>
        }
        configuration={
          <dl className="grid grid-cols-1 gap-2 text-xs md:grid-cols-[200px_1fr]">
            <dt className="font-medium text-muted-foreground">
              {t("workspace.pipeline.processor.name")}
            </dt>
            <dd>{p.name ?? "—"}</dd>
            <dt className="font-medium text-muted-foreground">
              {t("workspace.pipeline.processor.descriptionLabel")}
            </dt>
            <dd>{p.description ?? "—"}</dd>
          </dl>
        }
        jobs={
          p.queue ? (
            <QueuePanel
              queueName={p.queue}
              displayName={p.name ?? undefined}
              canWrite={true}
              enableDeleteOriginalAfterRetry={true}
              retryJob={(job) => {
                if (job.data && typeof job.data === "object") {
                  const data = job.data as { item?: string };
                  if (data.item) {
                    void processItem({ variables: { item: data.item } });
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
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        context={context}
        mode="process"
      />
    </>
  );
}
