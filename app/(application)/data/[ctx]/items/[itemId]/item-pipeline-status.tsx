"use client";

/**
 * ItemPipelineStatus — the persistent, interactive pipeline stepper at the
 * top of the item detail page. Replaces the old static status line + the
 * post-save takeover, and surfaces Process / Generate-embeddings here (as
 * per-step "Run" / "Re-run") instead of hiding them in the ⋯ menu.
 *
 * "Running" is detected from the QUEUE, not just from on-page actions: a
 * stage reads running whenever this item has a waiting/active/delayed job in
 * that stage's queue (useItemActiveJobs). So the running state survives a
 * page refresh — if the scheduled jobs haven't finished, the stepper still
 * shows them running. A short optimistic flag bridges the gap between an
 * action and the next queue poll. While anything runs we also poll the item
 * so its done-state flips the moment a job completes.
 */

import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

import { useItemActiveJobs } from "./use-item-active-jobs";

export interface ItemPipelineStatusProps {
  context: Context;
  item: Item;
  refetch: () => void;
  onProcess: () => void;
  onGenerate: () => void;
  processPending: boolean;
  generatePending: boolean;
  /** Emitted by the editor after a Save that scheduled downstream work. */
  saveActivity: { token: number; snapshot: unknown } | null;
  workersConfigured: boolean;
}

type StepKey = "ingested" | "processed" | "embedded" | "retrievable";
type StepState = "done" | "running" | "pending";

const ITEM_POLL_MS = 3000;
const OPTIMISTIC_MS = 8000;

export function ItemPipelineStatus({
  context,
  item,
  refetch,
  onProcess,
  onGenerate,
  processPending,
  generatePending,
  saveActivity,
  workersConfigured,
}: ItemPipelineStatusProps) {
  const t = useTranslations("knowledge");

  const hasProcessor = Boolean(context.processor);
  const hasEmbedder = Boolean(context.embedder);

  const activeJobs = useItemActiveJobs(context, item.id ?? "");

  // Optimistic "running" right after an action, until the queue poll catches
  // the new job (avoids a flash of "pending").
  const [optimistic, setOptimistic] = React.useState<Set<StepKey>>(new Set());
  const timers = React.useRef<Record<string, number>>({});
  const markOptimistic = React.useCallback((key: StepKey) => {
    setOptimistic((prev) => new Set(prev).add(key));
    window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => {
      setOptimistic((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, OPTIMISTIC_MS);
  }, []);
  React.useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach((id) => window.clearTimeout(id));
  }, []);

  // Bridge a save that scheduled work into optimistic-running.
  const lastToken = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!saveActivity || saveActivity.token === lastToken.current) return;
    lastToken.current = saveActivity.token;
    if (hasProcessor) markOptimistic("processed");
    if (hasEmbedder) markOptimistic("embedded");
    activeJobs.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveActivity, hasProcessor, hasEmbedder]);

  const isRunning = (key: StepKey): boolean => {
    if (key === "processed") return activeJobs.processorRunning || optimistic.has("processed");
    if (key === "embedded") return activeJobs.embedderRunning || optimistic.has("embedded");
    return false;
  };
  const anyRunning = isRunning("processed") || isRunning("embedded");

  // Poll the item while anything runs, so done-state updates when jobs finish.
  React.useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(refetch, ITEM_POLL_MS);
    return () => window.clearInterval(id);
  }, [anyRunning, refetch]);

  const embeddedDone =
    (typeof item.chunks_count === "number" && item.chunks_count > 0) ||
    Boolean(item.embeddings_updated_at);
  const isDone = (key: StepKey): boolean => {
    if (key === "ingested") return true;
    if (key === "processed") return Boolean(item.last_processed_at);
    if (key === "embedded") return embeddedDone;
    return embeddedDone && !item.archived; // retrievable
  };
  const stepState = (key: StepKey): StepState => {
    if (isRunning(key)) return "running";
    return isDone(key) ? "done" : "pending";
  };

  const rerunProcessed = () => {
    markOptimistic("processed");
    onProcess();
    activeJobs.refetch();
  };
  const rerunEmbedded = () => {
    markOptimistic("embedded");
    onGenerate();
    activeJobs.refetch();
  };

  const steps: { key: StepKey; label: string; action?: "process" | "generate" }[] = [
    { key: "ingested", label: t("workspace.itemDetail.pipeline.ingested") },
  ];
  if (hasProcessor) {
    steps.push({
      key: "processed",
      label: t("workspace.itemDetail.pipeline.processed"),
      action: "process",
    });
  }
  if (hasEmbedder) {
    steps.push({
      key: "embedded",
      label: t("workspace.itemDetail.pipeline.embedded"),
      action: "generate",
    });
    steps.push({
      key: "retrievable",
      label: t("workspace.itemDetail.pipeline.retrievable"),
    });
  }

  const chunkCount = typeof item.chunks_count === "number" ? item.chunks_count : 0;
  const runningStage = isRunning("processed")
    ? "processor"
    : isRunning("embedded")
      ? "embedder"
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {steps.map((step, i) => {
          const state = stepState(step.key);
          const busy =
            (step.action === "process" && processPending) ||
            (step.action === "generate" && generatePending);
          return (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/40">
                  ·
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-sm">
                {state === "done" ? (
                  <Check aria-hidden="true" className="size-4 text-success" />
                ) : state === "running" ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 text-info motion-safe:animate-spin"
                  />
                ) : (
                  <StatusDot status="muted" />
                )}
                <span className={cn(state === "pending" && "text-muted-foreground")}>
                  {step.label}
                </span>
                {step.action && state !== "running" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    disabled={busy}
                    onClick={step.action === "process" ? rerunProcessed : rerunEmbedded}
                    aria-label={
                      state === "done"
                        ? t(
                            step.action === "process"
                              ? "workspace.itemDetail.rerunProcess"
                              : "workspace.itemDetail.rerunEmbed",
                          )
                        : t(
                            step.action === "process"
                              ? "workspace.itemDetail.runProcess"
                              : "workspace.itemDetail.runEmbed",
                          )
                    }
                  >
                    {step.action === "process" ? (
                      <RefreshCw aria-hidden="true" className="mr-1 size-3" />
                    ) : (
                      <Sparkles aria-hidden="true" className="mr-1 size-3" />
                    )}
                    {state === "done"
                      ? t("workspace.itemDetail.rerun")
                      : t("workspace.itemDetail.run")}
                  </Button>
                )}
              </span>
            </React.Fragment>
          );
        })}

        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {t("workspace.items.chunks", { count: chunkCount })}
        </span>
      </div>

      {anyRunning && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusDot status="info" pulse />
          <span>
            {workersConfigured
              ? t("workspace.progress.footerQueued")
              : t("workspace.progress.footerSync")}
          </span>
          {workersConfigured && runningStage && (
            <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
              <Link href={`/data/${context.id}?tab=pipeline&stage=${runningStage}`}>
                {t("workspace.progress.openQueue")}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
