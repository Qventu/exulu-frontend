"use client";

/**
 * PipelineTab — body of the Pipeline tab. Vertical stage list (Sources →
 * Processor → Embedder) connected by a muted vertical rule, followed by
 * the merged Activity list (recent processings + recent embeddings).
 *
 * Polling discipline (page-doc): the ActivityList polls 10s ONLY when
 * the Pipeline tab is mounted/visible — gating happens by ActivityList
 * being conditionally rendered here.
 *
 * Owns the embedder settings data (`useEmbedderSettings`) and the bulk
 * generate/delete-embeddings dialogs for `StageEmbedder` (context-embedder-
 * settings plan, Task 7): `StageEmbedder` was promoted to `components/
 * widgets`, which must not import `app/`, so this feature-tier component
 * fetches the data + builds the retry mutation and passes them down as
 * props instead.
 *
 * Inventory items: 53 (Sources stage card), 60 (Embedder stage meta),
 * 61 (Processor config details), 63 + 69 (merged ActivityList).
 */

import { useMutation } from "@apollo/client";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { StageEmbedder } from "@/components/widgets/stage-embedder";
import type { Context } from "@/types/models/context";

import { useEmbedderSettings } from "../../hooks";
import { GENERATE_CHUNKS } from "../../queries";

import { ActivityList } from "./activity-list";
import { BulkFilterDialog } from "./bulk-filter-dialog";
import { PipelineHealth } from "./pipeline-health";
import { StageProcessor } from "./stage-processor";
import { StageSources } from "./stage-sources";

export interface PipelineTabProps {
  context: Context;
}

export function PipelineTab({ context }: PipelineTabProps) {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const { info, models, queues, setEmbedder } = useEmbedderSettings(context.id);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const [generateChunks] = useMutation(GENERATE_CHUNKS(context.id), {
    onCompleted: () => toast.success(t("workspace.bulk.generateScheduled")),
    onError: (e) =>
      toast.error(t("workspace.bulk.generateError"), { description: e.message }),
  });

  const goToItems = () => {
    const url = new URLSearchParams(params?.toString() ?? "");
    url.set("tab", "items");
    url.delete("item");
    router.push(`${pathname}?${url.toString()}`);
  };

  // Deep-link target: `?stage=processor|embedder|sources` opens + scrolls to
  // that stage's Jobs (the item page's "Open queue" link points here).
  const stageParam = params?.get("stage") ?? null;

  // Every context has an embedder stage now — it may just be unconfigured
  // (the transcriptions context today), which is exactly the state Task 7's
  // Not-configured card exists to surface. Sources/processor stay optional,
  // but the embedder alone means the pipeline is never empty anymore, so
  // the old "no pipeline configured" empty state is unreachable and removed.

  return (
    <div className="flex flex-col gap-8">
      <PipelineHealth context={context} onInspectItems={goToItems} />
      <div className="flex flex-col gap-6">
        <StageSources context={context} autoOpenJobs={stageParam === "sources"} />
        <StageProcessor context={context} autoOpenJobs={stageParam === "processor"} />
        <StageEmbedder
          context={context}
          autoOpenJobs={stageParam === "embedder"}
          info={info}
          models={models}
          queues={queues}
          onSetEmbedder={setEmbedder}
          onRun={() => setGenerateOpen(true)}
          onDeleteEmbeddings={() => setDeleteOpen(true)}
          onRetryChunk={(itemId) =>
            void generateChunks({ variables: { where: [{ id: { eq: itemId } }] } })
          }
        />
      </div>
      <ActivityList context={context} active={true} />

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
    </div>
  );
}
