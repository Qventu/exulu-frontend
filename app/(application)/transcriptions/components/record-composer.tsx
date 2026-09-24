"use client";

/**
 * "Record on this device" composer (spec §4.3): setup card (title, options,
 * post-processing) → big Start → recording surface (timer, level meter,
 * keep-screen-on notice, live transcript, queue status, Stop). Stop drains the
 * chunk queue, uploads the full audio via Uppy → S3, then calls
 * liveRecordingStop so the row lands in Needs review.
 *
 * The recorder itself lives in LiveRecordingProvider (shell-level) so leaving
 * the page keeps recording; this component only renders its state. The END of
 * a recording belongs to the recorder too: however one ends (Stop, the 4 h
 * auto-stop, a queue abort) it publishes a `pendingCloseout`, and THIS
 * component performs it — upload, liveRecordingStop, toast, release. One
 * close-out path, and one a remount can pick up where the last mount left off.
 */
import { useMutation } from "@apollo/client";
import { ChevronRight, Loader2, Mic, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { formatElapsed } from "@/components/live-recording/format";
import { useLiveRecording } from "@/components/live-recording/live-recording-provider";
import { extensionFor } from "@/components/live-recording/mime";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { StatusDot } from "@/components/primitives/status-dot";
import { RBACControl } from "@/components/rbac";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useUppy from "@/hooks/use-uppy";

import { usePostProcessingOptions, useProjectOptions } from "../hooks";
import {
  CANCEL_TRANSCRIPTION_JOB,
  LIVE_RECORDING_START,
  LIVE_RECORDING_STOP,
} from "../queries";
import {
  type Mode,
  type PostProcessingPrompt,
  type RbacRole,
  type RbacUser,
} from "../types";
import {
  PostProcessingPicker,
  postProcessingRowsComplete,
} from "./post-processing-picker";

/** Teams is offered by RBACControl but no transcription input carries it (see composer.tsx). */
const ALLOWED_MODES: Mode[] = ["private", "users", "roles", "public"];
const LANGUAGES = ["en", "de", "fr", "es", "it", "nl", "pt"] as const;
const METER_BARS = 12;
/**
 * One sonner slot for "couldn't finish": a retried liveRecordingStop that
 * fails again would otherwise stack identical error toasts, which read as
 * separate failures.
 */
const STOP_FAILED_TOAST = "live-recording-stop-failed";
/**
 * Silence budget for the master-audio upload — a dead-socket guard, NOT a cap
 * on how long the upload may take. uploadMaster() settles only from Uppy's
 * upload-success / upload-error, and neither is guaranteed: hooks/use-uppy.tsx
 * returns without calling its success callback when the response carries no
 * uploadURL, and an XHR stalled by a screen lock or a dropped connection can
 * emit nothing at all. The watchdog is re-armed by every upload-progress
 * event, so a slow but live upload of a multi-hour recording runs as long as
 * it needs; only a minute with no bytes at all gives up. Without it the
 * composer sits on "Uploading audio…" with Stop and Discard both disabled and
 * liveRecordingStop never called, which leaves the row 'recording'
 * server-side forever. Giving up costs the audio and keeps the transcript —
 * the same trade the existing upload-failure path already makes.
 */
const UPLOAD_STALL_TIMEOUT_MS = 60 * 1000;
/** onCancel() rewrites this page's URL; off it, that would be a navigation. */
const TRANSCRIPTIONS_PATH = "/transcriptions";

export interface RecordComposerProps {
  onCancel: () => void;
  onStarted: () => void;
}

type Phase = "setup" | "starting" | "recording" | "finishing";

export function RecordComposer({ onCancel, onStarted }: RecordComposerProps) {
  const t = useTranslations("transcriptions");
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const recorder = useLiveRecording();
  // Stable across renders (unlike `recorder` itself, which is a fresh object
  // every render) so the effects below can depend on them directly.
  const { discard: discardRecording, release: releaseRecorder } = recorder;

  const [title, setTitle] = React.useState("");
  const [language, setLanguage] = React.useState("auto");
  const [projectId, setProjectId] = React.useState("");
  const [rightsMode, setRightsMode] = React.useState<Mode>("private");
  const [rbacUsers, setRbacUsers] = React.useState<RbacUser[]>([]);
  const [rbacRoles, setRbacRoles] = React.useState<RbacRole[]>([]);
  const [ppRows, setPpRows] = React.useState<PostProcessingPrompt[]>([]);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  // Mounting mid-recording (navigated away and back) reopens the surface —
  // and mounting mid-close-out reopens it on the step it left off at.
  const [ownPhase, setOwnPhase] = React.useState<Phase>(
    recorder.pendingCloseout ? "finishing" : recorder.jobId ? "recording" : "setup",
  );
  /**
   * The recorder ends recordings on its own (the 4 h guard, a queue abort) and
   * owns the drain after Stop, so "finishing" is read off it rather than set
   * here: closingJobId is claimed the moment any end path begins and let go
   * only by release(), which is exactly the span the surface must stay up.
   */
  const phase: Phase = recorder.closingJobId ? "finishing" : ownPhase;
  /** The close-out steps this component runs itself; the drain is the recorder's. */
  const [closeoutStep, setCloseoutStep] = React.useState<
    "uploading" | "closing" | null
  >(null);
  const finishStep: "draining" | "uploading" | "closing" | null =
    recorder.state === "stopping" ? "draining" : closeoutStep;
  /**
   * liveRecordingStop failed: the row is still 'recording' server-side and the
   * recorder still holds the close-out. Distinct from "no step yet" (the frame
   * between the recorder publishing a close-out and the effect picking it up)
   * so the Retry button never flashes on a close-out that is about to run.
   */
  const [closeoutFailed, setCloseoutFailed] = React.useState(false);
  const [retryNonce, setRetryNonce] = React.useState(0);
  const [confirmStopOpen, setConfirmStopOpen] = React.useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);
  /**
   * Preview of the title the recording gets when the field is left empty.
   * Filled after hydration: toLocaleDateString() resolves against the server's
   * locale during SSR and the visitor's in the browser, which would otherwise
   * be a hydration mismatch on the placeholder attribute.
   */
  const [defaultTitle, setDefaultTitle] = React.useState("");
  React.useEffect(() => {
    setDefaultTitle(
      t("composer.recordDefaultTitle", {
        date: new Date().toLocaleDateString(),
      }),
    );
  }, [t]);

  const projects = useProjectOptions();
  const { prompts, agents } = usePostProcessingOptions();
  const [startLive] = useMutation(LIVE_RECORDING_START);
  const [stopLive] = useMutation(LIVE_RECORDING_STOP);
  const [cancelJob] = useMutation(CANCEL_TRANSCRIPTION_JOB);

  /**
   * One close-out at a time. An effect-driven close-out (the 4 h auto-stop, a
   * queue abort) sets neither the Stop dialog's pending state nor its open
   * state, so a confirm landing on top of one would run a second close-out
   * concurrently: both upload the same blob, both reach liveRecordingStop for
   * the same job, and the loser reports a failure over an already-successful
   * finish and parks the surface back on "recording".
   */
  const finishInFlightRef = React.useRef(false);
  /**
   * Survives a failed liveRecordingStop so the retry re-sends the mutation
   * without re-uploading a master blob S3 already has.
   */
  const uploadedKeyRef = React.useRef<{ jobId: string; key: string } | null>(
    null,
  );
  /**
   * A close-out can outlive the user's visit to this page. onCancel() rewrites
   * the URL, which off /transcriptions would yank them back here — and
   * usePathname() freezes at the last render, so the mount latch is what makes
   * that check honest for a component that already went away.
   */
  const pathnameRef = React.useRef(pathname);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Dedicated Uppy instance for the master recording (webm/mp4 are not in
  // AUDIO_FILE_TYPES — that constant documents the whisper pipeline's inputs).
  const uploadResolverRef = React.useRef<{
    resolve: (key: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const stallTimerRef = React.useRef<number | null>(null);
  const clearStallWatchdog = React.useCallback(() => {
    if (stallTimerRef.current != null) {
      window.clearTimeout(stallTimerRef.current);
    }
    stallTimerRef.current = null;
  }, []);
  /** The single settle point: disarms the watchdog, then resolves or rejects once. */
  const settleUpload = React.useCallback(
    (outcome: { key: string } | { error: Error }) => {
      clearStallWatchdog();
      const pending = uploadResolverRef.current;
      uploadResolverRef.current = null;
      if (!pending) return;
      if ("key" in outcome) pending.resolve(outcome.key);
      else pending.reject(outcome.error);
    },
    [clearStallWatchdog],
  );
  const uppy = useUppy(
    {
      backend: "",
      uppyOptions: {
        id: "transcriptions-record",
        allowedFileTypes: [".webm", ".mp4", ".m4a", ".ogg"],
      },
      maxNumberOfFiles: 1,
      callbacks: {
        uploadSuccess: (data) => settleUpload({ key: data.s3Key || data.key }),
      },
    },
    [],
  );
  const armStallWatchdog = React.useCallback(() => {
    if (!uppy) return;
    clearStallWatchdog();
    stallTimerRef.current = window.setTimeout(() => {
      // settleUpload() nulls the resolver before settling, so the upload-error
      // that cancelAll() raises — and any late upload-success — is a no-op
      // against a null ref and cannot settle this upload twice.
      settleUpload({ error: new Error("upload stalled") });
      uppy.cancelAll();
    }, UPLOAD_STALL_TIMEOUT_MS);
  }, [uppy, clearStallWatchdog, settleUpload]);

  React.useEffect(() => {
    if (!uppy) return;
    const onError = () => settleUpload({ error: new Error("upload failed") });
    // Bytes still moving means the socket is alive: push the deadline out.
    // Guarded on a pending upload so a stray event can never arm a timer that
    // would cancelAll() an upload this composer is not waiting on.
    const onProgress = () => {
      if (uploadResolverRef.current) armStallWatchdog();
    };
    uppy.on("upload-error", onError);
    uppy.on("upload-progress", onProgress);
    return () => {
      uppy.off("upload-error", onError);
      uppy.off("upload-progress", onProgress);
      clearStallWatchdog();
    };
  }, [uppy, settleUpload, armStallWatchdog, clearStallWatchdog]);

  const uploadMaster = React.useCallback(
    (blob: Blob, mimeType: string): Promise<string> =>
      new Promise<string>((resolve, reject) => {
        if (!uppy) {
          reject(new Error("uploader not ready"));
          return;
        }
        // Set before anything that can throw: the catch below settles through
        // this resolver, so the promise is guaranteed to end up settled.
        uploadResolverRef.current = { resolve, reject };
        armStallWatchdog();
        try {
          uppy.cancelAll();
          uppy.addFile({
            name: `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${extensionFor(mimeType)}`,
            type: mimeType,
            data: blob,
          });
        } catch (err) {
          settleUpload({
            error: err instanceof Error ? err : new Error("upload failed"),
          });
        }
      }),
    [uppy, settleUpload, armStallWatchdog],
  );

  const canStart =
    phase === "setup" &&
    recorder.state !== "recording" &&
    postProcessingRowsComplete(ppRows);

  const micErrorDescription = (err: unknown): string => {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError")
      return tChat("composer.micPermissionDenied");
    if (name === "NotFoundError") return tChat("composer.micNotFound");
    if (name === "NotReadableError") return tChat("composer.micInUse");
    return err instanceof Error ? err.message : tChat("composer.micBlocked");
  };

  /* --------------------------------- start --------------------------------- */

  // One-shot latches: the watcher effects below re-run on every parent render
  // (their callback props are inline arrows), and seq numbering restarts at 0
  // for every recording — so each of these is reset in onStart().
  const interruptionAnnouncedRef = React.useRef(false);
  const announcedSkipsRef = React.useRef(new Set<number>());

  const onStart = async () => {
    // activeJobId, not jobId: a close-out still running for the last recording
    // owns the uploader and the surface until it has released.
    if (recorder.state === "recording" || recorder.activeJobId) {
      toast.error(t("composer.alreadyRecording"));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error(tChat("composer.micUnavailableTitle"), {
        description: tChat("composer.micInsecureContext", {
          origin: window.location.origin,
        }),
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(tChat("composer.micUnavailableTitle"), {
        description: tChat("composer.micNoGetUserMedia"),
      });
      return;
    }
    setOwnPhase("starting");
    try {
      // Microphone first: a denied permission must never create a row.
      await recorder.prepare();
    } catch (err) {
      setOwnPhase("setup");
      toast.error(tChat("composer.micUnavailableTitle"), {
        description: micErrorDescription(err),
      });
      return;
    }
    try {
      const result = await startLive({
        variables: {
          input: {
            title:
              title.trim() ||
              t("composer.recordDefaultTitle", {
                date: new Date().toLocaleString(),
              }),
            language: language === "auto" ? null : language,
            project_id: projectId || null,
            target_rights_mode: rightsMode,
            target_rbac_users: rbacUsers,
            target_rbac_roles: rbacRoles,
            post_processing_prompts: ppRows.filter(
              (r) => r.prompt_id && r.agent_id,
            ),
          },
        },
      });
      const jobId = (
        result.data as { liveRecordingStart?: { id?: string } } | null
      )?.liveRecordingStart?.id;
      if (!jobId) throw new Error("no job id returned");
      interruptionAnnouncedRef.current = false;
      announcedSkipsRef.current.clear();
      recorder.start(jobId);
      setOwnPhase("recording");
      toast.success(t("toasts.recordingStarted"));
      onStarted(); // refetch the queue so the row shows under Processing (composer stays open)
    } catch (err: unknown) {
      discardRecording();
      setOwnPhase("setup");
      toast.error(t("toasts.recordingStartFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  /* -------------------------------- close-out ------------------------------- */

  /**
   * THE close-out, whoever ended the recording. The recorder publishes a
   * pendingCloseout once the microphone is off and the queue has drained
   * (Stop, the 4 h auto-stop) or was torn down (a queue abort); this uploads
   * the audio, tells the server, toasts, and releases the recorder. When
   * liveRecordingStop fails the close-out is kept — audio and job id live in
   * the recorder — so Retry, or a fresh mount, picks it up again.
   */
  const runCloseout = React.useCallback(async () => {
    const closeout = recorder.pendingCloseout;
    if (!closeout || finishInFlightRef.current) return;
    finishInFlightRef.current = true;
    setCloseoutFailed(false);
    try {
      // 409 not_recording / 404 not_found: the row is already closed (or
      // gone), so there is nothing to attach and nothing to tell the server.
      const serverOwed =
        closeout.reason !== "not_recording" && closeout.reason !== "not_found";
      if (serverOwed) {
        let audioKey =
          uploadedKeyRef.current?.jobId === closeout.jobId
            ? uploadedKeyRef.current.key
            : null;
        if (closeout.blob && !audioKey) {
          setCloseoutStep("uploading");
          try {
            audioKey = await uploadMaster(closeout.blob, closeout.mimeType);
            uploadedKeyRef.current = { jobId: closeout.jobId, key: audioKey };
          } catch {
            toast.warning(t("toasts.audioUploadFailedKeptTranscript"));
          }
        }
        setCloseoutStep("closing");
        try {
          await stopLive({
            variables: {
              id: closeout.jobId,
              input: {
                audio_s3key: audioKey,
                // 0 == the recorder never measured it (a mid-recording abort);
                // null lets the server keep what the chunks reported.
                duration_seconds:
                  closeout.durationMs > 0 ? closeout.durationMs / 1000 : null,
              },
            },
          });
        } catch (err: unknown) {
          // The row is still 'recording' server-side. No release(): the
          // recorder keeps the close-out and the surface offers Retry.
          setCloseoutStep(null);
          setCloseoutFailed(true);
          toast.error(t("toasts.recordingStopFailed"), {
            id: STOP_FAILED_TOAST,
            description: err instanceof Error ? err.message : undefined,
          });
          return;
        }
      }
      // What the user hears once the job is closed (or found already closed).
      switch (closeout.reason) {
        case "not_recording":
        case "not_found":
          // Finished, discarded or deleted from another device: the server
          // closed the row already, so there was nothing for this tab to send.
          toast.info(t("toasts.recordingEndedElsewhere"));
          break;
        case "queue_aborted":
          // out_of_order / skip_rejected: the row is closed with the transcript
          // so far (it lands in Needs review), but the recording did not end
          // the way it should have — say why.
          toast.error(t("toasts.recordingStopFailed"), {
            id: STOP_FAILED_TOAST,
            description: closeout.abortReason,
          });
          break;
        case "auto_stop":
          toast.info(t("toasts.recordingAutoStopped"));
          toast.success(t("toasts.recordingFinished"));
          break;
        default:
          toast.success(t("toasts.recordingFinished"));
      }
      uploadedKeyRef.current = null;
      setCloseoutStep(null);
      setOwnPhase("setup");
      releaseRecorder();
      onStarted();
      // onCancel() rewrites the URL to drop ?new=1; off this page, or from a
      // component that already unmounted, that would be a navigation back here.
      if (mountedRef.current && pathnameRef.current === TRANSCRIPTIONS_PATH) {
        onCancel();
      }
    } finally {
      finishInFlightRef.current = false;
    }
  }, [
    recorder.pendingCloseout,
    uploadMaster,
    stopLive,
    releaseRecorder,
    onStarted,
    onCancel,
    t,
  ]);

  // The close-out effect must not re-run when runCloseout changes identity (it
  // closes over inline parent callbacks), so it reaches it through a ref.
  const runCloseoutRef = React.useRef(runCloseout);
  React.useEffect(() => {
    runCloseoutRef.current = runCloseout;
  }, [runCloseout]);

  // ONE close-out path: keyed on the job the recorder wants closed, re-armed
  // by Retry. finishInFlightRef keeps a re-run (StrictMode, a parent render)
  // from starting a second upload for the same job. It waits for the
  // uploader: a mount that opens mid-close-out (back via the pill) runs this
  // on its first commit, before useUppy's async init has an instance.
  const closeoutJobId = recorder.pendingCloseout?.jobId ?? null;
  React.useEffect(() => {
    if (!closeoutJobId) {
      // Nothing left to close out (an earlier mount finished it): a surface
      // stuck on "finishing" would have nothing to show for it.
      setOwnPhase((current) => (current === "finishing" ? "setup" : current));
      return;
    }
    if (!uppy) return;
    void runCloseoutRef.current();
  }, [closeoutJobId, retryNonce, uppy]);

  /**
   * Stop: the recorder stops the microphone, drains the queue and publishes
   * the close-out; the effect above does the rest. stop() rejects when the
   * queue dies mid-drain, but the recorder has already turned that into a
   * pendingCloseout, so there is nothing left to hear here.
   */
  const onStop = async () => {
    setConfirmStopOpen(false);
    void recorder.stop().catch(() => undefined);
  };

  // A recorder-driven end (auto-stop, queue abort) leaves the confirm dialogs
  // open and confirmable — their pending state only tracks their own
  // onConfirm. Retiring them as soon as the recording stops is what keeps a
  // second Stop from landing on top of a running close-out.
  React.useEffect(() => {
    if (phase === "recording") return;
    setConfirmStopOpen(false);
    setConfirmDiscardOpen(false);
  }, [phase]);

  const onDiscard = async () => {
    // Read before discard(): it lets go of the job id with everything else.
    // Mid-drain this aborts the queue with "discard", which the recorder
    // never turns into a close-out; the server side is handled right here.
    const jobId = recorder.activeJobId;
    discardRecording();
    if (jobId) {
      try {
        await cancelJob({ variables: { id: jobId } });
      } catch (err: unknown) {
        toast.error(t("toasts.discardFailed"), {
          description: err instanceof Error ? err.message : undefined,
        });
        throw err; // keeps the ConfirmDialog open for a retry
      }
    }
    uploadedKeyRef.current = null;
    setCloseoutStep(null);
    setCloseoutFailed(false);
    toast.success(t("toasts.recordingDiscarded"));
    setOwnPhase("setup");
    onStarted();
    onCancel();
  };

  /* -------------------------------- watchers ------------------------------- */

  // A lost microphone is a warning, not an end: the user decides when to stop.
  React.useEffect(() => {
    if (recorder.state !== "interrupted") {
      interruptionAnnouncedRef.current = false;
      return;
    }
    if (interruptionAnnouncedRef.current) return;
    interruptionAnnouncedRef.current = true;
    toast.warning(t("toasts.recordingInterrupted"));
  }, [recorder.state, t]);

  // Skipped parts are surfaced once each.
  React.useEffect(() => {
    for (const chunk of recorder.chunks) {
      if (
        chunk.status === "skipped" &&
        !announcedSkipsRef.current.has(chunk.seq)
      ) {
        announcedSkipsRef.current.add(chunk.seq);
        toast.warning(t("toasts.partSkipped", { seq: chunk.seq + 1 }));
      }
    }
  }, [recorder.chunks, t]);

  /* --------------------------- recording surface --------------------------- */

  // Nothing in flight and the last liveRecordingStop failed: offer Retry.
  const retryable =
    phase === "finishing" && finishStep === null && closeoutFailed;
  // Discard stays available while the last parts are still being sent (spec
  // §5, offline at Stop) and once the close-out has failed; off while the
  // audio is uploading or the row is being closed.
  const discardAllowed =
    phase === "recording" || finishStep === "draining" || retryable;

  if (phase === "recording" || phase === "finishing") {
    const sent = recorder.chunks.filter(
      (c) => c.status === "sent" || c.status === "skipped",
    ).length;
    const pending = recorder.chunks.length - sent;
    const retrying = recorder.chunks.some((c) => c.status === "retrying");
    return (
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <StatusDot status="error" pulse={phase === "recording"} />
          <span className="font-medium">{t("composer.recording")}</span>
          <span className="font-mono text-lg tabular-nums">
            {formatElapsed(recorder.elapsedMs)}
          </span>
          <div className="flex-1" />
          {/* Stop while recording; a spinner while the close-out runs; Retry
              when liveRecordingStop failed (the recorder still holds the audio,
              so the retry costs nothing that is already uploaded). */}
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={phase === "finishing" && !retryable}
            onClick={() =>
              retryable
                ? setRetryNonce((n) => n + 1)
                : setConfirmStopOpen(true)
            }
            className="max-md:h-12"
          >
            {phase === "finishing" && !retryable ? (
              <Loader2
                aria-hidden="true"
                className="mr-2 size-4 animate-spin"
              />
            ) : (
              <Square aria-hidden="true" className="mr-2 size-4" />
            )}
            {retryable
              ? tCommon("retry")
              : phase === "finishing"
                ? t("composer.finishing")
                : t("composer.stopRecording")}
          </Button>
        </div>

        {/* Bar i lights up once the level reaches its share of the scale. */}
        <div className="flex h-8 items-end gap-1" aria-hidden="true">
          {Array.from({ length: METER_BARS }).map((_, i) => (
            <div
              key={i}
              className="w-2 rounded-sm bg-primary/70 transition-[height] duration-100 motion-reduce:transition-none"
              style={{
                height: recorder.level * METER_BARS >= i + 1 ? "100%" : "15%",
              }}
            />
          ))}
        </div>

        <Alert>
          <AlertDescription>
            {recorder.state === "interrupted"
              ? t("composer.recordingInterrupted")
              : t("composer.keepScreenOn")}
          </AlertDescription>
        </Alert>

        <div className="max-h-[50dvh] min-h-32 space-y-3 overflow-y-auto rounded-md border p-3 text-sm">
          {recorder.chunks.length === 0 ? (
            <p className="text-muted-foreground">
              {t("composer.liveTranscriptEmpty")}
            </p>
          ) : (
            recorder.chunks.map((chunk) => (
              <p
                key={chunk.seq}
                className={chunk.text ? undefined : "text-muted-foreground"}
              >
                {chunk.status === "sent" || chunk.status === "skipped"
                  ? chunk.text || "…"
                  : t("composer.transcribingPart")}
              </p>
            ))
          )}
        </div>

        <div
          className={
            retrying ? "text-xs text-warning" : "text-xs text-muted-foreground"
          }
        >
          {finishStep === "draining"
            ? t("composer.sendingLastParts", {
                sent,
                total: recorder.chunks.length,
              })
            : finishStep === "uploading"
              ? t("composer.uploadingAudio")
              : finishStep === "closing"
                ? t("composer.finishing")
                : `${t("composer.partsSent", { count: sent })}${pending ? ` · ${t("composer.partsPending", { count: pending })}` : ""}${retrying ? ` · ${t("composer.partsRetrying")}` : ""}`}
        </div>

        {/* Discard stays available while the last parts are still being sent
            (spec §5, offline at Stop) and once the close-out has failed; it is
            off only while the audio is uploading or the row is being closed. */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={!discardAllowed}
            className="max-md:h-11"
            onClick={() => setConfirmDiscardOpen(true)}
          >
            {t("review.discard")}
          </Button>
        </div>

        <ConfirmDialog
          open={confirmStopOpen}
          onOpenChange={setConfirmStopOpen}
          variant="default"
          title={t("confirmStop.title")}
          description={t("confirmStop.description")}
          confirmLabel={t("confirmStop.confirm")}
          onConfirm={onStop}
        />
        <ConfirmDialog
          open={confirmDiscardOpen}
          onOpenChange={setConfirmDiscardOpen}
          title={t("confirmDiscardRecording.title")}
          description={t("confirmDiscardRecording.description")}
          confirmLabel={t("confirmDiscardRecording.confirm")}
          onConfirm={onDiscard}
        />
      </Card>
    );
  }

  /* --------------------------------- setup --------------------------------- */

  const projectName = projects.find((p) => p.id === projectId)?.name;
  const summary = [
    language === "auto" ? t("composer.autoLanguage") : t(`lang.${language}`),
    projectName ?? t("composer.noProjectSummary"),
    t(`mode.${rightsMode === "teams" ? "private" : rightsMode}`),
    ppRows.length
      ? `${t("composer.postProcessing")} (${ppRows.length})`
      : t("composer.postProcessing"),
  ].join(" · ");

  return (
    <Card className="space-y-4 p-4 duration-200 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none sm:p-6">
      <p className="text-sm text-muted-foreground">
        {t("composer.recordIntro")}
      </p>

      <div className="space-y-2">
        <Label htmlFor="record-title">{t("composer.titleLabel")}</Label>
        <Input
          id="record-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={defaultTitle || t("composer.titlePlaceholder")}
          className="text-base md:text-sm"
        />
      </div>

      <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
        <CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 rounded-md text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
          />
          <span>{t("composer.options")}</span>
          <span className="min-w-0 flex-1 truncate text-right text-xs font-normal text-muted-foreground">
            {summary}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
          <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("composer.language")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    {t("composer.autoDetect")}
                  </SelectItem>
                  {LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`lang.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("composer.project")}</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(value) =>
                  setProjectId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("composer.noProject")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("composer.noProject")}
                  </SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("composer.sharing")}</Label>
              <RBACControl
                allowedModes={ALLOWED_MODES}
                subjectLabel={t("sharing.subject")}
                initialRightsMode={rightsMode}
                initialUsers={rbacUsers}
                initialRoles={rbacRoles}
                modalMode
                onChange={(mode, users, roles) => {
                  setRightsMode(mode);
                  setRbacUsers(users);
                  setRbacRoles(roles);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <PostProcessingPicker
                rows={ppRows}
                onChange={setPpRows}
                prompts={prompts}
                agents={agents}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={phase === "starting"}
          className="max-md:h-11"
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onStart}
          disabled={!canStart}
          className="max-md:h-14 max-md:text-base"
        >
          {phase === "starting" ? (
            <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
          ) : (
            <Mic aria-hidden="true" className="mr-2 size-5" />
          )}
          {t("composer.startRecording")}
        </Button>
      </div>
    </Card>
  );
}
