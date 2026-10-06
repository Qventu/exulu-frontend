"use client";

/**
 * /transcriptions/review/[jobId] — first-time review of a transcription job
 * (task-12 brief, Step 7). Review graduated from a side sheet
 * (`review-sheet.tsx`, deleted by this task) to a page that is
 * `TranscriptDocument` in edit mode. A job reached from here is always
 * creator-only (spec: the jobs list/query is creator-only, never shared), so
 * `canWrite` is left at its default (true) — the read-only path (task-12
 * brief, Step 8) only applies to saved items at `/transcriptions/[itemId]`.
 *
 * A job only stays reviewable while `awaiting_review` — the redesigned home
 * list no longer links a *saved* job here (spec 2026-09-29 §1.2: "a saved
 * job contributes nothing — its content IS the item"), so re-editing an
 * already-saved transcript happens at `/transcriptions/[itemId]?edit=1`
 * instead, through the item's own update mutation. Landing here for a job
 * that's already saved (a stale bookmark/link) redirects to that item's
 * page; any other non-`awaiting_review` status isn't reviewable (yet, or any
 * more).
 */
import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { PageShell } from "@/components/primitives/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

import { PostProcessingResults } from "../../components/post-processing-results";
import {
  TranscriptDocument,
  type TranscriptDraft,
} from "../../components/transcript-document";
import {
  CANCEL_TRANSCRIPTION_JOB,
  FINALIZE_TRANSCRIPTION_JOB,
  GET_TRANSCRIPTION_JOB,
  MARK_TRANSCRIPTION_JOB_REVIEWED,
} from "../../queries";
import { hasPostProcessing, transcriptPublishState } from "../../types";
import { jobToDraftItem, type JobWithSegments } from "./job-to-draft-item";

export default function ReviewJobPage() {
  const params = useParams();
  const jobId = params?.jobId as string | undefined;
  if (!jobId) return null;
  return <ReviewJobPageInner jobId={jobId} />;
}

function ReviewJobPageInner({ jobId }: { jobId: string }) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const { data, loading, error, refetch } = useQuery<{
    transcription_jobById: JobWithSegments | null;
  }>(GET_TRANSCRIPTION_JOB, {
    variables: { id: jobId },
    fetchPolicy: "cache-and-network",
  });
  const job = data?.transcription_jobById ?? null;

  const [finalize] = useMutation(FINALIZE_TRANSCRIPTION_JOB);
  const [markReviewed] = useMutation(MARK_TRANSCRIPTION_JOB_REVIEWED);
  const [cancelJob] = useMutation(CANCEL_TRANSCRIPTION_JOB);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  // A saved job is no longer reviewed here — send a stale link to the
  // current home for it instead of an adapter built from a job that's
  // already been superseded by its item.
  React.useEffect(() => {
    if (job?.status === "saved" && job.saved_item_id) {
      router.replace(`/transcriptions/${job.saved_item_id}`);
    }
  }, [job, router]);

  if (loading && !job) {
    return (
      <PageShell variant="content" className="max-w-6xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)_300px]">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!loading && (error || !job)) {
    return (
      <PageShell variant="content">
        <EmptyState
          variant="error"
          title={t("review.loadFailed")}
          description={error?.message}
          action={{ label: tCommon("retry"), onClick: () => void refetch() }}
        />
      </PageShell>
    );
  }

  // The redirect effect above is handling this case.
  if (!job || job.status === "saved") return null;

  // A reviewed job has no item of its own — this route is the only place
  // left to reopen it, and it's exactly where someone comes back to publish
  // it later (the design doc's reviewed -> publish -> saved transition).
  // Below this point publishState already resolves to "reviewed" and the
  // card offers Publish; finalize accepts "reviewed" as a starting status.
  if (job.status !== "awaiting_review" && job.status !== "reviewed") {
    return (
      <PageShell variant="content">
        <EmptyState variant="quiet" title={t("review.notReady")} />
      </PageShell>
    );
  }

  const handleSave = async (draft: TranscriptDraft) => {
    try {
      const input: Record<string, unknown> = {
        title: draft.title,
        speakers: draft.speakers,
        project_id: draft.projectId,
        target_rights_mode: draft.rightsMode,
        target_rbac_users: draft.rbacUsers,
        target_rbac_roles: draft.rbacRoles,
      };
      // null = untouched (TranscriptDraft's contract) — omit the key
      // entirely rather than send an explicit null, which finalize's
      // `!== undefined` check would treat as "clear the correction".
      if (draft.correctedSegments !== null) {
        input.corrected_segments = draft.correctedSegments;
      }
      const result = await finalize({ variables: { id: job.id, input } });
      const itemId = (
        result.data as { transcriptionJobFinalize?: { item_id?: string } } | undefined
      )?.transcriptionJobFinalize?.item_id;
      toast.success(t("toasts.saved"));
      if (itemId) router.replace(`/transcriptions/${itemId}`);
    } catch (err: unknown) {
      toast.error(t("toasts.saveFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // TranscriptDocument keeps edit mode open
    }
  };

  // Signs the transcript off without publishing it — same payload as
  // finalize, but there is no item to navigate to, so this sends the user
  // back to the list instead of a saved item's page.
  const handleMarkReviewed = async (draft: TranscriptDraft) => {
    try {
      const input: Record<string, unknown> = {
        title: draft.title,
        speakers: draft.speakers,
        project_id: draft.projectId,
        target_rights_mode: draft.rightsMode,
        target_rbac_users: draft.rbacUsers,
        target_rbac_roles: draft.rbacRoles,
      };
      // null = untouched (TranscriptDraft's contract) — omit the key
      // entirely rather than send an explicit null, which would be treated
      // as "clear the correction".
      if (draft.correctedSegments !== null) {
        input.corrected_segments = draft.correctedSegments;
      }
      await markReviewed({ variables: { id: job.id, input } });
      toast.success(t("review.markedReviewed"));
      router.push("/transcriptions");
    } catch (err: unknown) {
      toast.error(t("toasts.saveFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // TranscriptDocument keeps edit mode open
    }
  };

  const handleConfirmDiscard = async () => {
    try {
      await cancelJob({ variables: { id: job.id } });
      toast.success(t("toasts.cancelled"));
      router.push("/transcriptions");
    } catch (err: unknown) {
      toast.error(t("toasts.discardFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // ConfirmDialog stays open
    }
  };

  return (
    <PageShell variant="full-bleed">
      <div className="min-h-0 flex-1">
        <TranscriptDocument
          item={jobToDraftItem(job)}
          mode="edit"
          publishState={transcriptPublishState(job)}
          onSave={handleSave}
          onMarkReviewed={handleMarkReviewed}
          onDiscard={() => setDiscardOpen(true)}
          // Above the document rather than in a full-width bar over the whole
          // grid, so it lines up with the transcript it belongs to.
          banner={
            hasPostProcessing(job) ? (
              <PostProcessingResults job={job} onRefreshJob={refetch} />
            ) : null
          }
        />
      </div>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t("confirmDiscard.title")}
        description={t("confirmDiscard.description")}
        confirmLabel={t("confirmDiscard.confirm")}
        onConfirm={handleConfirmDiscard}
      />
    </PageShell>
  );
}
