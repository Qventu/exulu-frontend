"use client";

/**
 * StageEmbedder — Embedder variant of the pipeline StageCard. Meta:
 * embedder name/id, trigger (configuration.calculateVectors), queue.
 *
 * "Run" opens BulkFilterDialog(mode="generate-embeddings"). The overflow
 * menu hosts "Delete embeddings" via BulkFilterDialog(mode="delete-
 * embeddings", destructive). Configuration expander hosts the embedder
 * variable bindings (VariableSelectionElement) wired to
 * embedder_settings* operations. Jobs expander mounts QueuePanel on the
 * embedder queue; retry wires to GENERATE_CHUNKS.
 *
 * Inventory items: 60 (embedder identity), 65 (variable bindings),
 * 66 (embedder identity/trigger/queue meta), 67 (bulk generate), 68
 * (bulk delete), 70 (embedder queue + retry).
 */

import { useMutation, useQuery } from "@apollo/client";
import { Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { QueuePanel } from "@/components/primitives/queue-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VariableSelectionElement } from "@/app/(application)/agents/edit/[id]/form";
import type { Variable } from "@/types/models/variable";
import type { Context } from "@/types/models/context";
import { GET_VARIABLES_LITE } from "@/queries/queries";

import {
  CREATE_EMBEDDER_CONFIG,
  GENERATE_CHUNKS,
  GET_EMBEDDER_CONFIGS,
  UPDATE_EMBEDDER_CONFIG,
} from "../../queries";

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

  // GET_VARIABLES_LITE returns the slim shape `{ id, name, encrypted }` —
  // the embedder's combobox only reads those three fields, so we cast to the
  // shared Variable type at the consumer boundary.
  const { data: variablesData } = useQuery<{
    variablesPagination: {
      items: Pick<Variable, "id" | "name" | "encrypted">[];
    };
  }>(GET_VARIABLES_LITE, {
    skip: !embedder,
    variables: { page: 1, limit: 100 },
  });
  const variables = variablesData?.variablesPagination?.items ?? [];

  const { data: configsData, refetch: refetchConfigs } = useQuery<{
    embedder_settingsPagination: {
      items: { id: string; name: string; value: string }[];
    };
  }>(GET_EMBEDDER_CONFIGS, {
    skip: !embedder?.id,
    variables: {
      context: context.id,
      embedder: embedder?.id,
    },
  });
  const configs = configsData?.embedder_settingsPagination?.items ?? [];

  const [updateEmbedderConfig] = useMutation(UPDATE_EMBEDDER_CONFIG, {
    onCompleted: () => {
      void refetchConfigs();
      toast.success(t("workspace.pipeline.embedder.bindingUpdated"));
    },
    onError: (e) =>
      toast.error(t("workspace.pipeline.embedder.bindingError"), {
        description: e.message,
      }),
  });
  const [createEmbedderConfig] = useMutation(CREATE_EMBEDDER_CONFIG, {
    onCompleted: () => {
      void refetchConfigs();
      toast.success(t("workspace.pipeline.embedder.bindingCreated"));
    },
    onError: (e) =>
      toast.error(t("workspace.pipeline.embedder.bindingError"), {
        description: e.message,
      }),
  });

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
        title={embedder.name ?? t("workspace.pipeline.embedder.title")}
        description={t("workspace.pipeline.embedder.identity", {
          id: embedder.id,
        })}
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
                <Badge variant="outline">
                  {embedder.name} · {embedder.id}
                </Badge>
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
        configuration={
          embedder.config && embedder.config.length > 0 ? (
            <div className="space-y-3">
              {embedder.config.map((config) => {
                const current = configs.find((c) => c.name === config.name);
                return (
                  <VariableSelectionElement
                    key={config.name}
                    configItem={config}
                    disabled={false}
                    currentValue={current?.value ?? ""}
                    variables={variables}
                    onVariableSelect={(variableName) => {
                      if (current) {
                        void updateEmbedderConfig({
                          variables: {
                            id: current.id,
                            name: config.name,
                            value: variableName,
                          },
                        });
                      } else {
                        void createEmbedderConfig({
                          variables: {
                            name: config.name,
                            value: variableName,
                            context: context.id,
                            embedder: embedder.id,
                          },
                        });
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("workspace.pipeline.embedder.noBindings")}
            </p>
          )
        }
        autoOpenJobs={autoOpenJobs}
        jobs={
          embedder.queue ? (
            <QueuePanel
              queueName={embedder.queue}
              displayName={embedder.name ?? undefined}
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
