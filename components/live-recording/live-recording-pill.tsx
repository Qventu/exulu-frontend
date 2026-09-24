"use client";

/**
 * "● Recording 12:34" in the shell chrome while a recording is active; links
 * back to /transcriptions. It stays up through the close-out ("Finishing…"),
 * which is the only route back to the tab that still holds the audio.
 */
import { useTranslations } from "next-intl";
import Link from "next/link";

import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";

import { formatElapsed } from "./format";
import { useLiveRecordingOptional } from "./live-recording-provider";

export function LiveRecordingPill({ className }: { className?: string }) {
  const recorder = useLiveRecordingOptional();
  const t = useTranslations("transcriptions");
  const finishing = !!recorder?.closingJobId;
  if (
    !recorder ||
    (!finishing &&
      recorder.state !== "recording" &&
      recorder.state !== "stopping" &&
      recorder.state !== "interrupted")
  ) {
    return null;
  }
  return (
    <Link
      href="/transcriptions"
      aria-label={t("pill.back")}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 font-mono text-xs font-medium text-destructive",
        className,
      )}
    >
      <StatusDot status="error" pulse={!finishing} />
      {/* A frozen timer would read as a still-running recording; the close-out
          has no clock of its own, so it gets a label instead. */}
      {finishing ? t("pill.finishing") : t("pill.recording", { time: formatElapsed(recorder.elapsedMs) })}
    </Link>
  );
}
