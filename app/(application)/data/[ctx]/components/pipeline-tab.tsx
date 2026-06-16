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
 * Inventory items: 53 (Sources stage card), 60 (Embedder stage meta),
 * 61 (Processor config details), 63 + 69 (merged ActivityList).
 */

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { Boxes } from "lucide-react";
import type { Context } from "@/types/models/context";

import { ActivityList } from "./activity-list";
import { PipelineHealth } from "./pipeline-health";
import { StageEmbedder } from "./stage-embedder";
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

  const goToItems = () => {
    const url = new URLSearchParams(params?.toString() ?? "");
    url.set("tab", "items");
    url.delete("item");
    router.push(`${pathname}?${url.toString()}`);
  };

  // Deep-link target: `?stage=processor|embedder|sources` opens + scrolls to
  // that stage's Jobs (the item page's "Open queue" link points here).
  const stageParam = params?.get("stage") ?? null;

  const hasAnyStage =
    (context.sources?.length ?? 0) > 0 ||
    !!context.processor ||
    !!context.embedder;

  if (!hasAnyStage) {
    return (
      <EmptyState
        icon={Boxes}
        title={t("workspace.pipeline.emptyTitle")}
        description={t("workspace.pipeline.emptyDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PipelineHealth context={context} onInspectItems={goToItems} />
      <div className="relative flex flex-col gap-6">
        {/* Muted connecting line behind the stages */}
        <div
          aria-hidden="true"
          className="absolute left-6 top-6 bottom-6 hidden w-px bg-muted md:block"
        />
        <StageSources context={context} autoOpenJobs={stageParam === "sources"} />
        <StageProcessor context={context} autoOpenJobs={stageParam === "processor"} />
        <StageEmbedder context={context} autoOpenJobs={stageParam === "embedder"} />
      </div>
      <ActivityList context={context} active={true} />
    </div>
  );
}
