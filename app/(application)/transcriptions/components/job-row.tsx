"use client";

/**
 * One queue row (inventory items 33–40): identity, per-state status line
 * (incl. the live elapsed/remaining estimate), and exactly one right-aligned
 * action. Destructive actions (cancel a running job, dismiss a failed one)
 * confirm via the shared ConfirmDialog — no more unconfirmed mutations.
 */
import { useMutation } from "@apollo/client";
import { ExternalLink, FileAudio, Trash2, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";

import { useTicker } from "../hooks";
import {
  CANCEL_TRANSCRIPTION_JOB,
  REMOVE_SAVED_TRANSCRIPT_ITEM,
  REMOVE_TRANSCRIPTION_JOB,
} from "../queries";
import {
  displayTitle,
  formatDuration,
  humanizeBotStatus,
  isMeetingJob,
  PROCESSING_FACTOR,
  type Job,
} from "../types";

const RECENT_MS = 60 * 60 * 1000; // live-tick RelativeTime only for fresh rows

export interface JobRowProps {
  job: Job;
  onReview: (jobId: string) => void;
  onChanged: () => void;
}

export function JobRow({ job, onReview, onChanged }: JobRowProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");

  const [cancelJob] = useMutation(CANCEL_TRANSCRIPTION_JOB);
  const [removeJob] = useMutation(REMOVE_TRANSCRIPTION_JOB);
  const [removeSavedItem] = useMutation(REMOVE_SAVED_TRANSCRIPT_ITEM);
  const [confirmCancelOpen, setConfirmCancelOpen] = React.useState(false);
  const [confirmDismissOpen, setConfirmDismissOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const title = displayTitle(job);
  const meeting = isMeetingJob(job);
  const isRunning = job.status === "queued" || job.status === "transcribing";

  // Row-scoped 1s ticker — only transcribing rows re-render every second
  // (replaces the old whole-page tick, inventory 5 / page-doc risk 1).
  const now = useTicker(job.status === "transcribing");

  const audioLengthLabel = job.duration_seconds
    ? formatDuration(job.duration_seconds)
    : null;

  const statusLine = (() => {
    // Recall meeting jobs are webhook-driven: surface the live bot lifecycle
    // instead of the whisper-style elapsed/remaining estimate.
    if (meeting && (job.status === "queued" || job.status === "transcribing")) {
      if (job.status === "transcribing") return t("row.transcribing");
      return humanizeBotStatus(job.bot_status) ?? t("row.queued");
    }
    switch (job.status) {
      case "queued":
        return t("row.queued");
      case "transcribing": {
        const elapsedSeconds =
          (now - new Date(job.createdAt).getTime()) / 1000;
        const parts = [
          audioLengthLabel
            ? t("row.transcribingWithLength", { length: audioLengthLabel })
            : t("row.transcribing"),
          t("row.elapsed", { elapsed: formatDuration(elapsedSeconds) }),
        ];
        if (job.duration_seconds) {
          const remaining =
            job.duration_seconds * PROCESSING_FACTOR - elapsedSeconds;
          parts.push(
            remaining <= 0
              ? t("row.wrappingUp")
              : t("row.remaining", { remaining: formatDuration(remaining) }),
          );
        }
        return parts.join(" · ");
      }
      case "awaiting_review":
        return audioLengthLabel
          ? t("row.awaitingReviewWithLength", { length: audioLengthLabel })
          : t("row.awaitingReview");
      case "failed":
        return t("row.failed");
      case "cancelled":
        return t("row.cancelled");
      case "saved":
        return null; // composed below with RelativeTime
    }
  })();

  // "Saved … / Updated …" — re-saves bump updatedAt; ignore the sub-2s jitter
  // between the initial insert and finalize (unchanged heuristic).
  const wasEdited =
    new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime() >
    2000;

  const onConfirmCancel = async () => {
    try {
      await cancelJob({ variables: { id: job.id } });
      // Cancelled jobs leave both lists on refetch — the toast is the visible
      // feedback the old flow lacked (page-doc "cancelled jobs vanish").
      toast.success(t("toasts.cancelled"));
      onChanged();
    } catch (err: unknown) {
      toast.error(t("toasts.cancelFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // keep the ConfirmDialog open
    }
  };

  const onConfirmDismiss = async () => {
    try {
      await removeJob({ variables: { id: job.id } });
      onChanged();
    } catch (err: unknown) {
      toast.error(t("toasts.dismissFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err;
    }
  };

  // Cascade order: knowledge item first, then the job row — if the item
  // delete fails the entry survives, so nothing dangles and the user can
  // retry (or uncheck the box and delete just the entry).
  const onConfirmDelete = async (optionIds?: string[]) => {
    try {
      if (optionIds?.includes("knowledge-item") && job.saved_item_id) {
        await removeSavedItem({ variables: { id: job.saved_item_id } });
      }
      await removeJob({ variables: { id: job.id } });
      toast.success(t("toasts.deleted"));
      onChanged();
    } catch (err: unknown) {
      toast.error(t("toasts.deleteFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
      throw err; // keep the ConfirmDialog open
    }
  };

  return (
    <li className="relative overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        {meeting ? (
          <Video
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : (
          <FileAudio
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{title}</span>
            {isRunning && (
              <StatusDot
                status="muted"
                pulse={job.status === "transcribing"}
                className="shrink-0"
              />
            )}
            {job.status === "failed" && (
              <StatusDot status="error" className="shrink-0" />
            )}
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {job.status === "saved" ? (
              <>
                {wasEdited ? t("row.updated") : t("row.saved")}{" "}
                <RelativeTime
                  date={job.updatedAt}
                  live={now - new Date(job.updatedAt).getTime() < RECENT_MS}
                />
                {audioLengthLabel ? <> · {audioLengthLabel}</> : null}
              </>
            ) : (
              statusLine
            )}
            {job.error && (
              <span className="ml-2 text-destructive">— {job.error}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isRunning && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-md:h-11"
              onClick={() => setConfirmCancelOpen(true)}
            >
              {tCommon("cancel")}
            </Button>
          )}
          {job.status === "awaiting_review" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-md:h-11"
              onClick={() => onReview(job.id)}
            >
              {t("row.review")}
            </Button>
          )}
          {job.status === "saved" && (
            <>
              {/* L1 on the saved row at every width (inventory 48): icon-only
                  with a 44px target below sm, text label from sm up. */}
              {job.saved_item_id && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="max-md:h-11 max-sm:w-11 max-sm:px-0"
                >
                  <Link
                    href={`/data/transcriptions/${job.saved_item_id}`}
                    aria-label={t("row.openInLibrary")}
                  >
                    <span className="hidden sm:inline">
                      {t("row.openInLibrary")}
                    </span>
                    <ExternalLink
                      aria-hidden="true"
                      className="size-4 sm:ml-1 sm:size-3.5"
                    />
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-md:h-11"
                onClick={() => onReview(job.id)}
              >
                {tCommon("edit")}
              </Button>
              {/* Icon-only delete; ≥44px target below md like the row's other actions. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("row.delete")}
                className="text-muted-foreground hover:text-destructive max-md:h-11 max-md:w-11 max-md:px-0 md:w-8 md:px-0"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </>
          )}
          {job.status === "failed" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-md:h-11"
              onClick={() => setConfirmDismissOpen(true)}
            >
              {t("row.dismiss")}
            </Button>
          )}
        </div>
      </div>

      {job.status === "transcribing" && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/10 via-primary/60 to-primary/10 motion-safe:animate-pulse"
        />
      )}

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title={t("confirmCancel.title")}
        description={t("confirmCancel.description")}
        confirmLabel={t("confirmCancel.confirm")}
        onConfirm={onConfirmCancel}
      />
      <ConfirmDialog
        open={confirmDismissOpen}
        onOpenChange={setConfirmDismissOpen}
        title={t("confirmDismiss.title")}
        description={t("confirmDismiss.description")}
        confirmLabel={t("confirmDismiss.confirm")}
        onConfirm={onConfirmDismiss}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description")}
        confirmLabel={t("confirmDelete.confirm")}
        options={
          job.saved_item_id
            ? [{ id: "knowledge-item", label: t("confirmDelete.alsoDeleteItem") }]
            : undefined
        }
        onConfirm={onConfirmDelete}
      />
    </li>
  );
}
