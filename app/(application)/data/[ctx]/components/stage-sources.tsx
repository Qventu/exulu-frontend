"use client";

/**
 * StageSources — Sources variant of the pipeline StageCard. One card per
 * source row with name, schedule (cron font-mono), queue, Run button,
 * and Configuration expander (retries / backoff / cron — visible, not
 * tooltip — fixes page-doc #53).
 *
 * Manual trigger dialog: pre-filled with the source's `params` defaults;
 * EXECUTE_SOURCE on confirm. Retry of a queue job re-opens this dialog
 * bound to the source's params (page-doc #54 + #57).
 *
 * Inventory items: 53 (Sources stage card + Configuration expander),
 * 54 (manual trigger dialog), 55 (Jobs expander hosting QueuePanel),
 * 57 (retry source job re-opens trigger dialog).
 */

import { useMutation } from "@apollo/client";
import { Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/primitives/empty-state";
import { QueuePanel } from "@/components/primitives/queue-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes } from "lucide-react";
import type { Context } from "@/types/models/context";

import { EXECUTE_SOURCE } from "../../queries";

import { StageCard } from "./stage-card";

type SourceParam = { name: string; description: string; default: string };
type Source = Context["sources"][number];

export interface StageSourcesProps {
  context: Context;
  /** Open + scroll this stage's Jobs when deep-linked (?stage=). */
  autoOpenJobs?: boolean;
}

export function StageSources({ context, autoOpenJobs }: StageSourcesProps) {
  const t = useTranslations("knowledge");
  const [selected, setSelected] = React.useState<Source | null>(null);
  const [paramValues, setParamValues] = React.useState<Record<string, string>>(
    {},
  );

  const [executeSource, { loading: executing }] = useMutation(
    EXECUTE_SOURCE(context.id),
    {
      onCompleted: (data) => {
        const r = data[`${context.id}_itemsExecuteSource`];
        toast.success(r?.message ?? t("workspace.pipeline.sources.queued"), {
          description: r?.jobs?.length
            ? t("workspace.bulk.jobsScheduled", { count: r.jobs.length })
            : undefined,
        });
        setSelected(null);
        setParamValues({});
      },
      onError: (e) =>
        toast.error(t("workspace.pipeline.sources.error"), {
          description: e.message,
        }),
    },
  );

  const openTrigger = (source: Source) => {
    setSelected(source);
    const initial: Record<string, string> = {};
    (source.config.params ?? []).forEach((p) => {
      initial[p.name] = p.default ?? "";
    });
    setParamValues(initial);
  };

  const queues = React.useMemo(() => {
    return Array.from(
      new Set(
        (context.sources ?? [])
          .map((s) => s.config.queue)
          .filter((q): q is string => Boolean(q)),
      ),
    );
  }, [context.sources]);

  if (!context.sources || context.sources.length === 0) {
    return (
      <StageCard
        stage="sources"
        icon={Boxes}
        title={t("workspace.pipeline.sources.title")}
        description={t("workspace.pipeline.sources.description")}
      >
        <EmptyState
          icon={Boxes}
          variant="quiet"
          title={t("workspace.pipeline.sources.empty")}
        />
      </StageCard>
    );
  }

  return (
    <>
      {context.sources.map((source) => (
        <StageCard
          key={source.id}
          stage="sources"
          icon={Boxes}
          title={source.name}
          description={source.description ?? undefined}
          queue={source.config.queue ?? undefined}
          primaryAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openTrigger(source)}
            >
              <Play aria-hidden="true" className="mr-2 size-4" />
              {t("workspace.pipeline.run")}
            </Button>
          }
          meta={
            <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              {source.config.schedule && (
                <div className="space-y-0.5">
                  <dt className="font-medium text-muted-foreground">
                    {t("workspace.pipeline.sources.schedule")}
                  </dt>
                  <dd className="font-mono">{source.config.schedule}</dd>
                </div>
              )}
              {source.config.retries !== undefined && (
                <div className="space-y-0.5">
                  <dt className="font-medium text-muted-foreground">
                    {t("workspace.pipeline.sources.retries")}
                  </dt>
                  <dd>{source.config.retries ?? 3}</dd>
                </div>
              )}
              {source.config.backoff?.type && (
                <div className="space-y-0.5">
                  <dt className="font-medium text-muted-foreground">
                    {t("workspace.pipeline.sources.backoff")}
                  </dt>
                  <dd>
                    {source.config.backoff.type}
                    {source.config.backoff.delay
                      ? ` (${source.config.backoff.delay}ms)`
                      : ""}
                  </dd>
                </div>
              )}
            </dl>
          }
          configuration={
            (source.config.params ?? []).length > 0 ? (
              <dl className="space-y-3">
                {(source.config.params ?? []).map((p) => (
                  <div key={p.name} className="space-y-0.5">
                    <dt className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {p.name}
                      </code>
                      {p.default ? (
                        <span className="text-xs text-muted-foreground">
                          {t("workspace.pipeline.sources.paramDefault", {
                            value: p.default,
                          })}
                        </span>
                      ) : null}
                    </dt>
                    {p.description ? (
                      <dd className="text-xs text-muted-foreground">
                        {p.description}
                      </dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("workspace.pipeline.sources.noParams")}
              </p>
            )
          }
          autoOpenJobs={autoOpenJobs}
        jobs={
            source.config.queue ? (
              <QueuePanel
                queueName={source.config.queue}
                displayName={source.name}
                embedded
                canWrite={true}
                enableDeleteOriginalAfterRetry={true}
                retryJob={(job) => {
                  // Re-open the trigger dialog bound to the failed job's source params.
                  if (job.data && typeof job.data === "object") {
                    const data = job.data as { source?: string };
                    const match = context.sources.find(
                      (s) => s.id === data.source,
                    );
                    if (match) {
                      openTrigger(match);
                      return false; // short-circuit default retry
                    }
                  }
                  return true;
                }}
              />
            ) : null
          }
        />
      ))}

      {/* Trigger dialog */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setParamValues({});
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("workspace.pipeline.sources.triggerTitle", {
                name: selected?.name ?? "",
              })}
            </DialogTitle>
            <DialogDescription>
              {selected?.config.queue
                ? t("workspace.pipeline.sources.triggerQueued", {
                    queue: selected.config.queue,
                  })
                : t("workspace.pipeline.sources.triggerImmediate")}
            </DialogDescription>
          </DialogHeader>

          {selected?.config.params && selected.config.params.length > 0 && (
            <div className="space-y-4 py-2">
              <div className="text-sm font-medium">
                {t("workspace.pipeline.sources.parameters")}
              </div>
              {selected.config.params.map((param: SourceParam) => (
                <div key={param.name} className="space-y-1">
                  <Label htmlFor={`p-${param.name}`}>{param.name}</Label>
                  {param.description && (
                    <p className="text-xs text-muted-foreground">
                      {param.description}
                    </p>
                  )}
                  <Input
                    id={`p-${param.name}`}
                    value={paramValues[param.name] ?? ""}
                    onChange={(e) =>
                      setParamValues((p) => ({
                        ...p,
                        [param.name]: e.target.value,
                      }))
                    }
                    placeholder={param.default ?? ""}
                    disabled={executing}
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={executing}
            >
              {t("workspace.bulk.cancel")}
            </Button>
            <Button
              type="button"
              disabled={executing || !selected}
              onClick={() => {
                if (!selected) return;
                void executeSource({
                  variables: {
                    source: selected.id,
                    inputs: paramValues,
                  },
                });
              }}
            >
              {executing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="mr-2 size-4" />
              )}
              {t("workspace.pipeline.sources.triggerCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {queues.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {t("workspace.pipeline.sources.noQueues")}
        </p>
      )}
    </>
  );
}
