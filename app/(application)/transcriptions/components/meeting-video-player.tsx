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
import { Button } from "@/components/ui/button";

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
  }>(GET_RECORDING_VIDEO_URL, {
    variables: { job_id: job.id },
    fetchPolicy: "network-only",
  });

  if (job.video_s3key) {
    if (localFailed) {
      return (
        <p className="px-1 text-xs text-muted-foreground">{t("review.videoUnavailable")}</p>
      );
    }
    if (!localUrl) return null;
    return <video controls preload="metadata" className="w-full rounded-lg" src={localUrl} />;
  }

  if (!job.recall_recording_id) {
    return <p className="px-1 text-xs text-muted-foreground">{t("review.meetingNoAudio")}</p>;
  }

  if (called) {
    if (loading) {
      return <p className="px-1 text-xs text-muted-foreground">{t("review.loadingVideo")}</p>;
    }
    if (data?.recordingVideoUrl) {
      return (
        <video
          controls
          preload="metadata"
          className="w-full rounded-lg"
          src={data.recordingVideoUrl}
        />
      );
    }
    return (
      <p className="px-1 text-xs text-muted-foreground">{t("review.videoUnavailable")}</p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="max-md:h-11"
      onClick={() => void fetchOnDemandUrl()}
    >
      {t("review.loadVideo")}
    </Button>
  );
}
