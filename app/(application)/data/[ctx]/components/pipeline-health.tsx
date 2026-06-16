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

import { StatusDot, type StatusDotStatus } from "@/components/primitives/status-dot";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Context } from "@/types/models/context";

import { usePipelineHealth } from "./use-pipeline-health";

export interface PipelineHealthProps {
  context: Context;
  /** Jump to the Items tab (e.g. to inspect stuck items). */
  onInspectItems: () => void;
}

const DASH = "—";

function fmt(n: number | null): string {
  return n == null ? DASH : n.toLocaleString();
}

export function PipelineHealth({ context, onInspectItems }: PipelineHealthProps) {
  const t = useTranslations("knowledge");
  const health = usePipelineHealth(context);

  const hasProcessor = Boolean(context.processor);
  const hasEmbedder = Boolean(context.embedder);
  const sourceCount = context.sources?.length ?? 0;
  const stuck = health.stuckItems ?? 0;
  const stuckStatus: StatusDotStatus = stuck > 0 ? "warning" : "success";

  // Single headline percentage (= embedded / total). The bar visualises it;
  // the caption carries the counts — so no number is shown twice.
  const pct = health.retrievablePct;
  const barPct = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const barColor =
    health.totalItems == null
      ? "bg-muted-foreground/30"
      : stuck > 0
        ? "bg-amber-500"
        : "bg-emerald-500";
  const loadingHeadline = health.loading && pct == null;

  // Compact secondary summary — the figures the stat-card grid used to carry.
  const secondary: string[] = [];
  if (health.totalChunks != null) {
    secondary.push(t("workspace.health.summary.chunks", { count: fmt(health.totalChunks) }));
  }
  if (health.staleItems != null) {
    secondary.push(t("workspace.health.summary.stale", { count: fmt(health.staleItems) }));
  }
  secondary.push(t("workspace.health.summary.sources", { count: sourceCount }));

  // Slim status-only flow strip — the at-a-glance pipeline overview that sits
  // right above the detailed stage cards. Status dots only, no numbers.
  const stages: { key: string; label: string; status: StatusDotStatus }[] = [
    {
      key: "sources",
      label: t("workspace.health.flow.sources"),
      status: sourceCount > 0 ? "success" : "muted",
    },
  ];
  if (hasProcessor) {
    stages.push({
      key: "processor",
      label: t("workspace.health.flow.processor"),
      status: "success",
    });
  }
  if (hasEmbedder) {
    stages.push({
      key: "embedder",
      label: t("workspace.health.flow.embedder"),
      status: stuckStatus,
    });
    stages.push({
      key: "searchable",
      label: t("workspace.health.flow.searchable"),
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

      {/* Health header — the "is this KB searchable?" answer at a glance. */}
      {hasEmbedder ? (
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline gap-2">
            {loadingHeadline ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-3xl font-semibold tabular-nums">
                {pct == null ? DASH : `${pct}%`}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {t("workspace.health.retrievable")}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                barColor,
              )}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("workspace.health.embeddedOf", {
              embedded: fmt(health.embeddedItems),
              total: fmt(health.totalItems),
            })}
            {stuck > 0
              ? ` · ${t("workspace.health.notYet", { count: fmt(health.stuckItems) })}`
              : ""}
          </p>
          {secondary.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">{secondary.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}

      {/* Slim status-only flow strip. */}
      <div className="flex flex-wrap items-center gap-2">
        {stages.map((stage, i) => (
          <React.Fragment key={stage.key}>
            {i > 0 && (
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground/40"
              />
            )}
            <div className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5">
              <StatusDot status={stage.status} />
              <span className="text-xs font-medium">{stage.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
