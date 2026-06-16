"use client";

/**
 * ItemUpdateProgress — the "state view" shown after saving an item, when the
 * context's configuration schedules pipeline work on update (knowledge V2
 * Phase F2 / product ask #3). Renders the dynamic save → process → embed
 * timeline, with the downstream steps included only for the stages the
 * context actually configures.
 *
 * Live state comes from the item's OWN pipeline timestamps — not from
 * threading job ids through a processor→embedder chain (which the backend
 * makes awkward). We snapshot `{ last_processed_at, embeddings_updated_at,
 * chunks_count }` at save time (pre-mutation) and poll the item: a stage is
 * `done` once its timestamp/count ADVANCES past the snapshot. This is robust
 * for both modes:
 *  - queued (workers on): timestamps advance over seconds → steps animate.
 *  - synchronous (workers off): the mutation already did the work inline, so
 *    the polled item already shows advanced values → steps read done.
 *
 * No fake percentage meter — we don't have per-chunk progress, so the running
 * step shows a spinner only (honest). After a poll cap we stop and surface a
 * quiet "still working — check the queue" note rather than spinning forever.
 */

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { StatusDot } from "@/components/primitives/status-dot";
import {
  StepTimeline,
  type StepState,
  type TimelineStep,
} from "@/components/primitives/step-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Item } from "@EXULU_SHARED/models/item";
import type { Context } from "@/types/models/context";

export interface PipelineSnapshot {
  last_processed_at?: string | null;
  embeddings_updated_at?: string | null;
  chunks_count?: number | null;
}

export interface ItemUpdateProgressProps {
  context: Context;
  item: Item;
  snapshot: PipelineSnapshot;
  workersConfigured: boolean;
  refetch: () => void;
  onViewItem: () => void;
}

const POLL_MS = 2500;
const POLL_CAP_MS = 60_000;

function advanced(now: unknown, before: unknown): boolean {
  if (now === null || now === undefined || now === "") return false;
  return now !== before;
}

export function ItemUpdateProgress({
  context,
  item,
  snapshot,
  workersConfigured,
  refetch,
  onViewItem,
}: ItemUpdateProgressProps) {
  const t = useTranslations("knowledge");
  // Stamp the start time once on mount (not during render — Date.now() is
  // impure). The cap check below reads it inside the interval callback.
  const startedAt = React.useRef<number | null>(null);
  React.useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [cappedOut, setCappedOut] = React.useState(false);

  const hasProcessor = Boolean(context.processor);
  const hasEmbedder = Boolean(context.embedder);

  const processedDone =
    !hasProcessor || advanced(item.last_processed_at, snapshot.last_processed_at);
  const embeddedDone =
    !hasEmbedder ||
    advanced(item.embeddings_updated_at, snapshot.embeddings_updated_at) ||
    (typeof item.chunks_count === "number" &&
      item.chunks_count !== snapshot.chunks_count &&
      item.chunks_count > 0);

  const allDone =
    (!hasProcessor || processedDone) && (!hasEmbedder || embeddedDone);

  // Poll the item while work is outstanding, up to the cap.
  React.useEffect(() => {
    if (allDone) return;
    const id = window.setInterval(() => {
      const since = startedAt.current ?? Date.now();
      if (Date.now() - since > POLL_CAP_MS) {
        setCappedOut(true);
        return;
      }
      refetch();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [allDone, refetch]);

  // Build the ordered downstream step list, then assign running/pending.
  const downstream: { key: string; eyebrow?: string; label: string; done: boolean }[] = [];
  if (hasProcessor) {
    downstream.push({
      key: "processing",
      eyebrow: context.processor?.queue
        ? `${t("workspace.itemDetail.pipeline.processed")} · ${context.processor.queue}`
        : undefined,
      label: t("workspace.progress.processing"),
      done: processedDone,
    });
  }
  if (hasEmbedder) {
    downstream.push({
      key: "embedding",
      eyebrow: context.embedder?.queue
        ? `${t("workspace.itemDetail.pipeline.embedded")} · ${context.embedder.queue}`
        : undefined,
      label: t("workspace.progress.embedding"),
      done: embeddedDone,
    });
  }

  let runningAssigned = false;
  const steps: TimelineStep[] = [
    {
      key: "saved",
      eyebrow: t("workspace.progress.savedEyebrow"),
      label: t("workspace.progress.saved"),
      state: "done",
    },
    ...downstream.map((d): TimelineStep => {
      let state: StepState;
      if (d.done) {
        state = "done";
      } else if (!runningAssigned && !cappedOut) {
        state = "running";
        runningAssigned = true;
      } else if (!runningAssigned && cappedOut) {
        // First outstanding step after the cap: keep it "running" visually so
        // it doesn't read as un-started, but the footer note explains.
        state = "running";
        runningAssigned = true;
      } else {
        state = "pending";
      }
      return { key: d.key, eyebrow: d.eyebrow, label: d.label, detail: undefined, state };
    }),
  ];

  return (
    <div className="space-y-6">
      {/* Mini header for the progress state */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {allDone
              ? t("workspace.progress.titleDone")
              : t("workspace.progress.title")}
          </h2>
          <Badge variant={allDone ? "secondary" : "default"}>
            {allDone
              ? t("workspace.progress.pillDone")
              : t("workspace.progress.pillRunning")}
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onViewItem}>
          {allDone
            ? t("workspace.progress.viewItem")
            : t("workspace.progress.runInBackground")}
        </Button>
      </div>

      {/* Intro banner — queued vs synchronous */}
      <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        {allDone ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 text-success" />
        ) : (
          <Loader2
            aria-hidden="true"
            className="mt-0.5 size-4 text-info motion-safe:animate-spin"
          />
        )}
        <span>
          {allDone
            ? t("workspace.progress.bannerDone")
            : workersConfigured
              ? t("workspace.progress.bannerQueued")
              : t("workspace.progress.bannerSync")}
        </span>
      </div>

      <StepTimeline steps={steps} />

      {/* Footer — liveness + open queue */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          {!allDone && <StatusDot status={cappedOut ? "warning" : "info"} pulse />}
          {allDone
            ? t("workspace.progress.footerDone")
            : cappedOut
              ? t("workspace.progress.footerStalled")
              : workersConfigured
                ? t("workspace.progress.footerQueued")
                : t("workspace.progress.footerSync")}
        </span>
        {workersConfigured && (
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link href={`/data/${context.id}?tab=pipeline`}>
              {t("workspace.progress.openQueue")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
