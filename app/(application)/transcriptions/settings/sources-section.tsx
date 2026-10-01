"use client";

/**
 * Sources section — a liveness Test per transcription source, plus the
 * `transcriptions` context's embedding model (so transcripts are actually
 * searchable). Renders the promoted `StageEmbedder` widget (components/
 * widgets, context-embedder-settings plan Task 7) rather than a second
 * embedder picker — see settings/embedder.ts for why its data is fetched
 * locally instead of importing the `data` feature's hook.
 *
 * Context/embedder data is fetched by the page (not here) so the collapsed
 * section's summary line — `embedderConfigured` in particular — is correct
 * even while this section is closed.
 */
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import { StageEmbedder } from "@/components/widgets/stage-embedder";
import type {
  EmbedderChangeDialogInfo,
  EmbedderModelOption,
  EmbedderQueueOption,
} from "@/components/widgets/stage-embedder";
import { Button } from "@/components/ui/button";
import type { Context } from "@/types/models/context";

import type { SourceTestResult, TranscriptionSource } from "../hooks";

export interface SourcesSectionProps {
  testSource: (source: TranscriptionSource) => Promise<SourceTestResult>;
  context: Context | null;
  contextLoading: boolean;
  contextError?: Error;
  embedderInfo?: EmbedderChangeDialogInfo;
  embedderModels: EmbedderModelOption[];
  embedderQueues: EmbedderQueueOption[];
  onSetEmbedder: (
    model: string | null,
    queue: string | null,
  ) => Promise<{ rebuild: string; itemsQueued: number }>;
}

const SOURCE_ROWS: { source: TranscriptionSource; labelKey: string }[] = [
  { source: "upload", labelKey: "settings.sources.uploadLabel" },
  { source: "meeting", labelKey: "settings.sources.meetingLabel" },
  { source: "record", labelKey: "settings.sources.recordLabel" },
];

type RowState = "idle" | "testing" | SourceTestResult;

function SourceRow({
  source,
  labelKey,
  testSource,
}: {
  source: TranscriptionSource;
  labelKey: string;
  testSource: SourcesSectionProps["testSource"];
}) {
  const t = useTranslations("transcriptions");
  const [state, setState] = React.useState<RowState>("idle");

  const handleTest = async () => {
    setState("testing");
    try {
      setState(await testSource(source));
    } catch (err: unknown) {
      setState({
        ok: false,
        reason: "unreachable",
        message: err instanceof Error ? err.message : t("settings.sources.testFailed"),
      });
    }
  };

  const resultNode =
    state !== "idle" && state !== "testing" ? (
      <span
        className={`flex items-center gap-1 text-xs ${state.ok ? "text-success" : "text-destructive"}`}
      >
        {state.ok ? (
          <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <XCircle aria-hidden="true" className="size-3.5 shrink-0" />
        )}
        <span className="truncate">
          {state.ok
            ? t("settings.sources.resultOk")
            : state.reason === "not_configured"
              ? t("settings.sources.resultNotConfigured")
              : t("settings.sources.resultUnreachable", { message: state.message })}
        </span>
      </span>
    ) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <span className="text-sm font-medium">{t(labelKey)}</span>
      <div className="flex min-w-0 items-center gap-2">
        {resultNode}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={state === "testing"}
          onClick={() => void handleTest()}
        >
          {state === "testing" && (
            <Loader2 aria-hidden="true" className="mr-1 size-3.5 animate-spin" />
          )}
          {t("settings.sources.testButton")}
        </Button>
      </div>
    </div>
  );
}

export function SourcesSection({
  testSource,
  context,
  contextLoading,
  contextError,
  embedderInfo,
  embedderModels,
  embedderQueues,
  onSetEmbedder,
}: SourcesSectionProps) {
  const t = useTranslations("transcriptions");
  const router = useRouter();

  // Bulk re-generate/delete-embeddings and per-chunk retry live in the full
  // Pipeline tab (components/widgets' StageEmbedder takes them as callback
  // props owned by the caller) — this settings page only needs the
  // choose/change-model flow, so these three send the admin to the existing
  // deep-linkable surface rather than re-implementing BulkFilterDialog here.
  const goToPipeline = () => router.push("/data/transcriptions?tab=pipeline&stage=embedder");

  return (
    <>
      <div className="space-y-2">
        {SOURCE_ROWS.map(({ source, labelKey }) => (
          <SourceRow key={source} source={source} labelKey={labelKey} testSource={testSource} />
        ))}
      </div>

      <div className="space-y-2 border-t pt-4">
        <div>
          <p className="text-sm font-medium">{t("settings.sources.embedderHeading")}</p>
          <p className="text-xs text-muted-foreground">
            {t("settings.sources.embedderDescription")}
          </p>
        </div>
        {contextError ? (
          <p className="text-sm text-destructive">{t("settings.sources.contextLoadFailed")}</p>
        ) : contextLoading || !context ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("settings.sources.loadingEmbedder")}
          </p>
        ) : (
          <StageEmbedder
            context={context}
            info={embedderInfo}
            models={embedderModels}
            queues={embedderQueues}
            onSetEmbedder={onSetEmbedder}
            onRun={goToPipeline}
            onDeleteEmbeddings={goToPipeline}
            onRetryChunk={goToPipeline}
          />
        )}
      </div>
    </>
  );
}
