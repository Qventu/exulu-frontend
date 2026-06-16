"use client";

/**
 * ItemPipelineStatus — the persistent, interactive pipeline stepper at the
 * top of the item detail page. Replaces the old static status line + the
 * post-save takeover, and surfaces the Process / Generate-embeddings actions
 * here (as per-step "Re-run") instead of hiding them in the ⋯ menu.
 *
 * For each stage the context configures (Ingested · Processed · Embedded ·
 * Retrievable) it shows live state:
 *  - done    — the item's timestamp/chunks are present
 *  - running — a re-run was triggered (or a save scheduled work); polls the
 *              item until the relevant timestamp advances
 *  - pending — configured but not done (with a Run/Re-run affordance)
 *
 * "Running" is honest: we only enter it from an action taken on this page (a
 * Re-run click, or a Save that scheduled work — via `saveActivity`). On a
 * fresh visit a not-yet-complete stage reads "pending" with a Run button — we
 * don't fake background activity we can't observe per-item.
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

import type { PipelineSnapshot } from "../../components/use-item-editor";

export interface ItemPipelineStatusProps {
  context: Context;
  item: Item;
  refetch: () => void;
  onProcess: () => void;
  onGenerate: () => void;
  processPending: boolean;
  generatePending: boolean;
  /** Emitted by the editor after a Save that scheduled downstream work. */
  saveActivity: { token: number; snapshot: PipelineSnapshot } | null;
  workersConfigured: boolean;
}

type StepKey = "ingested" | "processed" | "embedded" | "retrievable";
type StepState = "done" | "running" | "pending";

const POLL_MS = 2500;
const POLL_CAP_MS = 60_000;

function advanced(now: unknown, before: unknown): boolean {
  if (now === null || now === undefined || now === "") return false;
  return now !== before;
}

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

  const [watch, setWatch] = React.useState<{
    steps: StepKey[];
    snap: PipelineSnapshot;
  } | null>(null);
  const startedAt = React.useRef<number | null>(null);

  // Start watching when a Save scheduled work.
  const lastToken = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!saveActivity || saveActivity.token === lastToken.current) return;
    lastToken.current = saveActivity.token;
    const steps: StepKey[] = [];
    if (hasProcessor) steps.push("processed");
    if (hasEmbedder) steps.push("embedded");
    if (steps.length) {
      startedAt.current = Date.now();
      setWatch({ steps, snap: saveActivity.snapshot });
    }
  }, [saveActivity, hasProcessor, hasEmbedder]);

  // Whether a given watched step has advanced past the snapshot.
  const stepAdvanced = React.useCallback(
    (key: StepKey): boolean => {
      if (!watch) return true;
      if (key === "processed") {
        return advanced(item.last_processed_at, watch.snap.last_processed_at);
      }
      if (key === "embedded") {
        return (
          advanced(item.embeddings_updated_at, watch.snap.embeddings_updated_at) ||
          (typeof item.chunks_count === "number" &&
            item.chunks_count !== watch.snap.chunks_count &&
            item.chunks_count > 0)
        );
      }
      return true;
    },
    [watch, item.last_processed_at, item.embeddings_updated_at, item.chunks_count],
  );

  const pendingWatched = watch
    ? watch.steps.filter((s) => !stepAdvanced(s))
    : [];
  const watching = pendingWatched.length > 0;

  // Poll while watching; clear when all advance or the cap is hit.
  React.useEffect(() => {
    if (!watch) return;
    if (pendingWatched.length === 0) {
      setWatch(null);
      return;
    }
    const id = window.setInterval(() => {
      const since = startedAt.current ?? Date.now();
      if (Date.now() - since > POLL_CAP_MS) {
        setWatch(null);
        return;
      }
      refetch();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [watch, pendingWatched.length, refetch]);

  const beginWatch = (key: StepKey) => {
    startedAt.current = Date.now();
    setWatch((prev) => {
      const snap: PipelineSnapshot = {
        last_processed_at: item.last_processed_at,
        embeddings_updated_at: item.embeddings_updated_at,
        chunks_count: typeof item.chunks_count === "number" ? item.chunks_count : null,
      };
      const steps = Array.from(new Set([...(prev?.steps ?? []), key]));
      return { steps, snap: prev?.snap ?? snap };
    });
  };

  const rerunProcessed = () => {
    beginWatch("processed");
    onProcess();
  };
  const rerunEmbedded = () => {
    beginWatch("embedded");
    onGenerate();
  };

  // ── Per-step done/running/pending ────────────────────────────────────────
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
    if (watch?.steps.includes(key) && !stepAdvanced(key)) return "running";
    return isDone(key) ? "done" : "pending";
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

  // Which stage is actively running → deep-link the queue to it.
  const runningStage = pendingWatched.includes("processed")
    ? "processor"
    : pendingWatched.includes("embedded")
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

      {watching && (
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
