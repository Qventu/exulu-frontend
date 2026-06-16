"use client";

/**
 * PipelineHealth — the "is this knowledge base healthy?" overview at the top
 * of the Pipeline tab (knowledge V2 Phase F3 / product ask #4). Answers in
 * one glance: how many items, how many are embedded, how many produced no
 * chunks ("stuck"), how stale, and what share is retrievable.
 *
 * Numbers come from usePipelineHealth (cheap count probes). Total chunks is
 * honest-degraded to "—" until backlog KB-4 ships a cheap chunk SUM.
 *
 * A stuck-items alert (items ingested but never embedded — invisible to
 * agent retrieval) surfaces the one actionable problem with an "Inspect"
 * jump to the Items tab.
 */

import { AlertTriangle, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { StatCard } from "@/components/primitives/stat-card";
import { StatusDot, type StatusDotStatus } from "@/components/primitives/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Context } from "@/types/models/context";

import { usePipelineHealth } from "./use-pipeline-health";

export interface PipelineHealthProps {
  context: Context;
  /** Jump to the Items tab (e.g. to inspect stuck items). */
  onInspectItems: () => void;
}

const DASH = "—";

function statValue(n: number | null): string | number {
  return n == null ? DASH : n;
}

export function PipelineHealth({ context, onInspectItems }: PipelineHealthProps) {
  const t = useTranslations("knowledge");
  const health = usePipelineHealth(context);

  const hasProcessor = Boolean(context.processor);
  const hasEmbedder = Boolean(context.embedder);
  const sourceCount = context.sources?.length ?? 0;
  const stuck = health.stuckItems ?? 0;
  const stuckStatus: StatusDotStatus = stuck > 0 ? "warning" : "success";

  // Flow chips — only the stages this context configures.
  const chips: { key: string; label: string; stat: string; status: StatusDotStatus }[] = [
    {
      key: "sources",
      label: t("workspace.health.flow.sources"),
      stat: t("workspace.health.flow.sourcesStat", {
        connected: sourceCount,
        items: health.totalItems ?? 0,
      }),
      status: sourceCount > 0 ? "success" : "muted",
    },
  ];
  if (hasProcessor) {
    chips.push({
      key: "processor",
      label: t("workspace.health.flow.processor"),
      stat: context.processor?.name ?? context.processor?.queue ?? "",
      status: "success",
    });
  }
  if (hasEmbedder) {
    chips.push({
      key: "embedder",
      label: t("workspace.health.flow.embedder"),
      stat: t("workspace.health.flow.embedderStat", {
        embedded: health.embeddedItems ?? 0,
        total: health.totalItems ?? 0,
      }),
      status: stuckStatus,
    });
    chips.push({
      key: "searchable",
      label: t("workspace.health.flow.searchable"),
      stat:
        health.retrievablePct == null
          ? DASH
          : t("workspace.health.flow.searchableStat", { pct: health.retrievablePct }),
      status: stuckStatus,
    });
  }

  return (
    <section className="space-y-4">
      {/* Stuck-items alert (the one actionable problem). */}
      {stuck > 0 && (
        <Alert>
          <AlertTriangle className="size-4 text-warning" />
          <AlertTitle>{t("workspace.health.stuck.title", { count: stuck })}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("workspace.health.stuck.description")}</span>
            <Button type="button" variant="outline" size="sm" onClick={onInspectItems}>
              {t("workspace.health.stuck.inspect")}
              <ArrowRight aria-hidden="true" className="ml-2 size-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Flow strip — Sources → [Processor] → Embedder → Searchable. */}
      <div className="flex flex-wrap items-stretch gap-2">
        {chips.map((chip, i) => (
          <React.Fragment key={chip.key}>
            {i > 0 && (
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 self-center text-muted-foreground/40"
              />
            )}
            <div className="flex min-w-[8rem] flex-1 flex-col gap-1 rounded-md border p-3">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {chip.label}
              </span>
              <span className="truncate text-sm" title={chip.stat}>
                {chip.stat || "—"}
              </span>
              <StatusDot status={chip.status} className="mt-0.5" />
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Stat cards — the core of the ask. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label={t("workspace.health.stats.totalItems")}
          value={statValue(health.totalItems)}
          loading={health.loading && health.totalItems == null}
        />
        <StatCard
          label={t("workspace.health.stats.embedded")}
          value={statValue(health.embeddedItems)}
          loading={health.loading && health.embeddedItems == null}
        />
        <StatCard
          label={t("workspace.health.stats.notEmbedded")}
          value={statValue(health.stuckItems)}
          caption={stuck > 0 ? t("workspace.health.stats.notEmbeddedHint") : undefined}
          loading={health.loading && health.stuckItems == null}
        />
        <StatCard
          label={t("workspace.health.stats.totalChunks")}
          value={statValue(health.totalChunks)}
          loading={health.loading && health.totalChunks == null}
        />
        <StatCard
          label={t("workspace.health.stats.stale")}
          value={statValue(health.staleItems)}
          caption={t("workspace.health.stats.staleHint")}
          loading={health.loading && health.staleItems == null}
        />
      </div>
    </section>
  );
}
