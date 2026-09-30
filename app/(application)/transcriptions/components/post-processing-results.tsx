"use client";

/**
 * Cards for the per-meeting post-processing results. Each output carries its
 * own {prompt_id, agent_id}, so it can be re-run after editing speakers. The
 * mutation returns the updated job (same id), so Apollo's normalized cache
 * refreshes these cards automatically.
 *
 * Lifted verbatim out of `review-sheet.tsx` (task-12 brief, Step 9 — the
 * side sheet is retired; this capability survives as its own file and is
 * consumed by `review/[jobId]/page.tsx`, which owns the real `Job` object
 * `runTranscriptPostProcessing` needs).
 */
import { useMutation, useQuery } from "@apollo/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { GET_PROMPT_LIBRARY, RUN_TRANSCRIPT_POST_PROCESSING } from "../queries";
import {
  parsePostProcessingOutputs,
  parsePostProcessingPrompts,
  type Job,
} from "../types";

// Mirrors the backend's POST_PROCESSING_REDO_STALE_MS: a "[]" claim older
// than this belongs to a dead run and is re-claimable (sweep or manual Run).
const POST_PROCESSING_CLAIM_STALE_MS = 30 * 60 * 1000;

export function PostProcessingResults({
  job,
  onRefreshJob,
}: {
  job: Job;
  onRefreshJob: () => Promise<unknown>;
}) {
  const t = useTranslations("transcriptions");
  const prompts = React.useMemo(
    () => parsePostProcessingPrompts(job.post_processing_prompts),
    [job.post_processing_prompts],
  );
  const outputs = React.useMemo(
    () => parsePostProcessingOutputs(job.post_processing_outputs),
    [job.post_processing_outputs],
  );
  // The backend claims the batch run by writing "[]" before spending and
  // heartbeats updatedAt per prompt: empty-but-non-null outputs with a FRESH
  // updatedAt means a run is genuinely executing. A stale claim is a dead
  // run — fall through to the pending cards so it stays manually runnable.
  const claimFresh =
    !!job.updatedAt &&
    Date.now() - new Date(job.updatedAt).getTime() <
      POST_PROCESSING_CLAIM_STALE_MS;
  const inFlight =
    prompts.length > 0 &&
    outputs.length === 0 &&
    job.post_processing_outputs != null &&
    claimFresh;
  // Configured prompts with no result card — the auto-run was lost (or the
  // job predates the run claim). Offer to run them manually, deduped.
  const pending = React.useMemo(() => {
    if (inFlight) return [];
    const seen = new Set<string>();
    return prompts.filter((p) => {
      const key = `${p.prompt_id}:${p.agent_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return !outputs.some(
        (o) => o.prompt_id === p.prompt_id && o.agent_id === p.agent_id,
      );
    });
  }, [prompts, outputs, inFlight]);
  const { data: promptLibraryData } = useQuery<{
    prompt_libraryPagination: {
      items: { id: string; name: string }[];
    };
  }>(GET_PROMPT_LIBRARY, { skip: pending.length === 0 });
  const promptNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of promptLibraryData?.prompt_libraryPagination?.items ?? []) {
      map.set(p.id, p.name);
    }
    return map;
  }, [promptLibraryData]);
  const [rerun] = useMutation(RUN_TRANSCRIPT_POST_PROCESSING);
  const [runningKey, setRunningKey] = React.useState<string | null>(null);

  // The app has no normalized Apollo cache, so mutation payloads never reach
  // this sheet on their own: poll the job while a run is in flight so the
  // "Running…" state resolves into result cards.
  React.useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => {
      void onRefreshJob();
    }, 5000);
    return () => clearInterval(timer);
  }, [inFlight, onRefreshJob]);

  const onRerun = async (promptId: string, agentId: string) => {
    const key = `${promptId}:${agentId}`;
    setRunningKey(key);
    try {
      await rerun({
        variables: { id: job.id, prompt_id: promptId, agent_id: agentId },
      });
      // Same cache caveat: without an explicit refetch the card would keep
      // showing the pre-run state.
      await onRefreshJob();
      toast.success(t("toasts.postProcessingRan"));
    } catch (err: unknown) {
      toast.error(t("toasts.postProcessingFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRunningKey(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("review.postProcessing")}</p>
      {inFlight ? (
        <p className="text-sm text-muted-foreground">
          {t("review.resultRunning")}
        </p>
      ) : null}
      {pending.length > 0 ? (
        <div className="space-y-2">
          {pending.map((prompt) => {
            const key = `${prompt.prompt_id}:${prompt.agent_id}`;
            const running = runningKey === key;
            return (
              <div key={key} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {promptNames.get(prompt.prompt_id) ??
                      (promptLibraryData
                        ? t("review.deletedPrompt")
                        : prompt.prompt_id)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={runningKey !== null}
                    onClick={() => onRerun(prompt.prompt_id, prompt.agent_id)}
                    className="shrink-0 max-md:h-11"
                  >
                    {running ? (
                      <Loader2
                        aria-hidden="true"
                        className="mr-1 size-3.5 animate-spin"
                      />
                    ) : null}
                    {t("review.run")}
                  </Button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("review.resultPending")}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
      {outputs.length === 0 && pending.length === 0 && !inFlight ? (
        <p className="text-sm text-muted-foreground">
          {t("review.postProcessingEmpty")}
        </p>
      ) : null}
      {outputs.length > 0 ? (
        <div className="space-y-2" data-demo-id="meeting-guide">
          {/* The demo tour anchors here: the step about the generated work
              instruction used to point at nothing, so the sheet showed only the
              transcript above it and the narrated document was below the fold. */}
          {outputs.map((output, index) => {
            const key = `${output.prompt_id}:${output.agent_id}`;
            const running = runningKey === key;
            return (
              <div key={index} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {output.prompt_name ?? output.prompt_id}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={runningKey !== null}
                    onClick={() => onRerun(output.prompt_id, output.agent_id)}
                    className="shrink-0 max-md:h-11"
                  >
                    {running ? (
                      <Loader2
                        aria-hidden="true"
                        className="mr-1 size-3.5 animate-spin"
                      />
                    ) : null}
                    {t("review.rerun")}
                  </Button>
                </div>
                {output.status === "failed" ? (
                  <p className="mt-1 text-sm text-destructive">
                    {t("review.resultFailed")}
                    {output.error ? ` — ${output.error}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {output.output}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
