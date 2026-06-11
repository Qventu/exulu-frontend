"use client";

/**
 * Audio playback + speaker-colored segment ribbon (inventory items 50–54),
 * extracted from the old page file.
 *
 * Changes vs. the legacy inline version:
 * - exposes an imperative `seek()` handle so transcript blocks (the primary,
 *   touch/keyboard-accessible segment affordance — page-doc item 52) can drive
 *   the audio;
 * - `onSeek` fires on ribbon taps so the sheet can scroll the transcript to
 *   the matching block;
 * - re-fetches the presigned URL once on audio error (the 1-minute URL cache
 *   vs. multi-minute review sessions — page-doc risk 2);
 * - hover popups remain a desktop-only enhancement (hover-capable pointers);
 *   the same data is permanently visible in the transcript blocks, so nothing
 *   is hover-gated anymore (item 53 → L4);
 * - ribbon is taller on touch viewports (h-12 < md), speaker colors come from
 *   the chart token scale.
 */
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { getPresignedUrl } from "@/components/uppy-dashboard";

import {
  formatClock,
  speakerColor,
  type Segment,
} from "../types";

export interface AudioTimelineHandle {
  /** Seek the audio to `time` (seconds) and play. */
  seek: (time: number) => void;
}

export interface AudioTimelineProps {
  audioS3Key: string;
  segments: Segment[];
  speakers: Record<string, string>;
  /** Whole-second playback position updates (drives the active-block highlight). */
  onTime?: (second: number) => void;
  /** Fired when the user seeks via the ribbon (sheet scrolls the transcript). */
  onSeek?: (time: number) => void;
}

export const AudioTimeline = React.forwardRef<
  AudioTimelineHandle,
  AudioTimelineProps
>(({ audioS3Key, segments, speakers, onTime, onSeek }, ref) => {
  const t = useTranslations("transcriptions");
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [hover, setHover] = React.useState<{
    segment: Segment;
    leftPct: number;
  } | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const retriedRef = React.useRef(false);
  const lastSecondRef = React.useRef(-1);

  React.useEffect(() => {
    let cancelled = false;
    getPresignedUrl(audioS3Key)
      .then((url) => {
        if (!cancelled) setAudioUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [audioS3Key]);

  React.useImperativeHandle(
    ref,
    () => ({
      seek: (time: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = time;
        void audio.play();
      },
    }),
    [],
  );

  // The signed URL expires after ~1 minute; a seek into an unbuffered range
  // mid-review can 404. Re-fetch once (the module cache drops expired URLs).
  const handleAudioError = () => {
    if (retriedRef.current) {
      setFailed(true);
      return;
    }
    retriedRef.current = true;
    getPresignedUrl(audioS3Key)
      .then((url) => setAudioUrl(url))
      .catch(() => setFailed(true));
  };

  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    const time = event.currentTarget.currentTime;
    setCurrentTime(time);
    const second = Math.floor(time);
    if (second !== lastSecondRef.current) {
      lastSecondRef.current = second;
      onTime?.(second);
    }
  };

  // Fall back to the last segment's end before the <audio> reports metadata.
  const totalDuration =
    duration || (segments.length ? segments[segments.length - 1].end : 0);

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    void audio.play();
  };

  if (failed) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        {t("review.audioUnavailable")}
      </p>
    );
  }

  if (!audioUrl) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        {t("review.audioLoading")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        preload="metadata"
        className="w-full"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={handleTimeUpdate}
        onError={handleAudioError}
      />
      <div className="relative">
        {/* Navigational overview only — redundant with the transcript blocks,
            which are the accessible seek path (T7); hence aria-hidden. */}
        <div
          aria-hidden="true"
          className="relative h-12 overflow-hidden rounded-md border bg-muted/40 md:h-10"
          onMouseLeave={() => setHover(null)}
        >
          {totalDuration > 0 &&
            segments.map((segment, index) => {
              const left = (segment.start / totalDuration) * 100;
              const width = Math.max(
                0.15,
                ((segment.end - segment.start) / totalDuration) * 100,
              );
              return (
                <div
                  key={index}
                  className="absolute bottom-0 top-0 cursor-pointer opacity-70 transition-opacity duration-150 hover:opacity-100"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: speakerColor(segment.speaker),
                  }}
                  onClick={() => {
                    seekTo(segment.start);
                    onSeek?.(segment.start);
                  }}
                  onMouseEnter={() => {
                    // Desktop-only enhancement (item 53 at L4): popups need a
                    // hover-capable pointer; touch reads the blocks instead.
                    if (
                      typeof window !== "undefined" &&
                      window.matchMedia("(hover: hover) and (pointer: fine)")
                        .matches
                    ) {
                      setHover({ segment, leftPct: left + width / 2 });
                    }
                  }}
                />
              );
            })}
          {totalDuration > 0 && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-foreground"
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
            />
          )}
        </div>
        {hover && (
          <div
            className="pointer-events-none absolute -top-2 z-10 max-w-xs -translate-x-1/2 -translate-y-full"
            style={{ left: `${hover.leftPct}%` }}
          >
            <div className="rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md">
              <div className="flex items-center gap-2 font-medium">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: speakerColor(hover.segment.speaker) }}
                />
                {speakers[hover.segment.speaker] || hover.segment.speaker}
                <span className="font-normal text-muted-foreground">
                  {formatClock(hover.segment.start)} –{" "}
                  {formatClock(hover.segment.end)}
                </span>
              </div>
              <div className="mt-1">{hover.segment.text}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
AudioTimeline.displayName = "AudioTimeline";
