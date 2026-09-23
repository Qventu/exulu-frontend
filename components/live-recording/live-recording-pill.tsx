"use client";

/** "● Recording 12:34" in the shell chrome while a recording is active; links back to /transcriptions. */
import { useTranslations } from "next-intl";
import Link from "next/link";

import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";

import { formatElapsed } from "./format";
import { useLiveRecordingOptional } from "./live-recording-provider";

export function LiveRecordingPill({ className }: { className?: string }) {
  const recorder = useLiveRecordingOptional();
  const t = useTranslations("transcriptions");
  if (
    !recorder ||
    (recorder.state !== "recording" && recorder.state !== "stopping" && recorder.state !== "interrupted")
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
      <StatusDot status="error" pulse />
      {t("pill.recording", { time: formatElapsed(recorder.elapsedMs) })}
    </Link>
  );
}
