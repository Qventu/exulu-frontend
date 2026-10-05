"use client";

/**
 * Video playback for a Recall meeting job's recording. Prefers the permanent
 * local copy (video_s3key, present only when this deployment has
 * RECALL_STORE_VIDEO_LOCALLY on); otherwise offers an on-demand fetch of a
 * fresh Recall URL via recordingVideoUrl (expires ~6h — fetched lazily, on
 * click, never pre-loaded or cached). Renders nothing useful (a short note)
 * when the job has no video at all.
 */
import { useLazyQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";

import { getPresignedUrl } from "@/components/primitives/file-picker";

import { GET_RECORDING_VIDEO_URL } from "../queries";
import type { Job } from "../types";

export function MeetingVideoPlayer({ job }: { job: Job }) {
  const t = useTranslations("transcriptions");
  const [localUrl, setLocalUrl] = React.useState<string | null>(null);
  const [localFailed, setLocalFailed] = React.useState(false);

  React.useEffect(() => {
    if (!job.video_s3key) return;
    let cancelled = false;
    getPresignedUrl(job.video_s3key)
      .then((url) => {
        if (!cancelled) setLocalUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLocalFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [job.video_s3key]);

  const [fetchOnDemandUrl, { data, loading, called }] = useLazyQuery<{
    recordingVideoUrl: string | null;
  }>(GET_RECORDING_VIDEO_URL, { fetchPolicy: "network-only" });

  // Fetched on mount rather than behind a "Load video" button. Two reasons:
  // the player is the page's main media surface and a button is a dead end
  // for a reader who just wants to watch, and "Hear" in the speakers panel
  // seeks whatever <video>/<audio> is mounted — with the gate in place that
  // element did not exist, so the button silently did nothing.
  const needsOnDemand = !job.video_s3key && !!job.recall_recording_id;
  React.useEffect(() => {
    if (!needsOnDemand) return;
    void fetchOnDemandUrl({ variables: { job_id: job.id } });
  }, [needsOnDemand, job.id, fetchOnDemandUrl]);

  if (job.video_s3key) {
    if (localFailed) {
      return (
        <p className="px-1 text-xs text-muted-foreground">{t("review.videoUnavailable")}</p>
      );
    }
    if (!localUrl) return null;
    return <video controls preload="metadata" className="w-full rounded-lg border bg-muted/40" src={localUrl} />;
  }

  if (!job.recall_recording_id) {
    return <p className="px-1 text-xs text-muted-foreground">{t("review.meetingNoAudio")}</p>;
  }

  if (called) {
    if (loading) {
      return (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-muted/40 text-xs text-muted-foreground">
          {t("review.loadingVideo")}
        </div>
      );
    }
    if (data?.recordingVideoUrl) {
      return (
        <video
          controls
          preload="metadata"
          className="w-full rounded-lg border bg-muted/40"
          src={data.recordingVideoUrl}
        />
      );
    }
    return (
      <p className="px-1 text-xs text-muted-foreground">{t("review.videoUnavailable")}</p>
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-muted/40 text-xs text-muted-foreground">
      {t("review.loadingVideo")}
    </div>
  );
}
