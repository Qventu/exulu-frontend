"use client";

/**
 * "Record on this device" composer (spec §4.3): setup card (title, options,
 * post-processing) → big Start → recording surface (timer, level meter,
 * keep-screen-on notice, live transcript, queue status, Stop). Stop drains the
 * chunk queue, uploads the full audio via Uppy → S3, then calls
 * liveRecordingStop so the row lands in Needs review.
 *
 * The recorder itself lives in LiveRecordingProvider (shell-level) so leaving
 * the page keeps recording; this component only renders its state.
 */
import { useMutation } from "@apollo/client";
import { ChevronRight, Loader2, Mic, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { QueueAbortError } from "@/components/live-recording/chunk-queue";
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
 * One sonner slot for "couldn't finish": a queue abort surfaces first from the
 * watcher effect and again from finish()'s own catch, and two identical error
 * toasts stacked on top of each other read as two separate failures.
 */
const STOP_FAILED_TOAST = "live-recording-stop-failed";
/**
 * Ceiling on the master-audio upload. uploadMaster() settles only from Uppy's
 * upload-success / upload-error, and neither is guaranteed: hooks/use-uppy.tsx
 * returns without calling its success callback when the response carries no
 * uploadURL, and an XHR stalled by a screen lock or a dropped connection can
 * emit nothing at all. Without a ceiling the composer sits on "Uploading
 * audio…" with Stop and Discard both disabled and liveRecordingStop never
 * called, which leaves the row 'recording' server-side forever. Giving up here
 * costs the audio and keeps the transcript — the same trade the existing
 * upload-failure path already makes.
 */
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;

export interface RecordComposerProps {
  onCancel: () => void;
  onStarted: () => void;
}

type Phase = "setup" | "starting" | "recording" | "finishing";

/** What liveRecordingStop still has to be told once the microphone is off. */
type Closeout = {
  jobId: string;
  audioKey: string | null;
  durationSeconds: number | null;
};

export function RecordComposer({ onCancel, onStarted }: RecordComposerProps) {
  const t = useTranslations("transcriptions");
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const recorder = useLiveRecording();
  // Stable across renders (unlike `recorder` itself, which is a fresh object
  // every render) so the watcher effect below can depend on it directly.
  const { discard: discardRecording } = recorder;

  const [title, setTitle] = React.useState("");
  const [language, setLanguage] = React.useState("auto");
  const [projectId, setProjectId] = React.useState("");
  const [rightsMode, setRightsMode] = React.useState<Mode>("private");
  const [rbacUsers, setRbacUsers] = React.useState<RbacUser[]>([]);
  const [rbacRoles, setRbacRoles] = React.useState<RbacRole[]>([]);
  const [ppRows, setPpRows] = React.useState<PostProcessingPrompt[]>([]);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  // Mounting mid-recording (navigated away and back) reopens the surface.
  const [phase, setPhase] = React.useState<Phase>(
    recorder.jobId ? "recording" : "setup",
  );
  const [finishStep, setFinishStep] = React.useState<
    "draining" | "uploading" | "closing" | null
  >(null);
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
   * stop() clears recorder.jobId before liveRecordingStop runs, and a failed
   * mutation must stay retryable without re-uploading the audio — so the three
   * facts the close-out needs live here, outside the recorder.
   */
  const closeoutRef = React.useRef<Closeout | null>(null);
  React.useEffect(() => {
    if (recorder.jobId) {
      closeoutRef.current = {
        jobId: recorder.jobId,
        audioKey: null,
        durationSeconds: null,
      };
    }
  }, [recorder.jobId]);

  /**
   * One finish at a time. A watcher-driven finish (the 4h auto-stop, a queue
   * abort) sets neither the Stop dialog's pending state nor its open state, so
   * a confirm landing on top of one would run a second finish concurrently:
   * both read the same closeout, both reach liveRecordingStop for the same
   * job, and the loser reports a failure over an already-successful finish and
   * parks the surface back on "recording" with a torn-down recorder.
   */
  const finishInFlightRef = React.useRef(false);

  // Dedicated Uppy instance for the master recording (webm/mp4 are not in
  // AUDIO_FILE_TYPES — that constant documents the whisper pipeline's inputs).
  const uploadResolverRef = React.useRef<{
    resolve: (key: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const settleUpload = React.useCallback(
    (outcome: { key: string } | { error: Error }) => {
      const pending = uploadResolverRef.current;
      uploadResolverRef.current = null;
      if (!pending) return;
      if ("key" in outcome) pending.resolve(outcome.key);
      else pending.reject(outcome.error);
    },
    [],
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
  React.useEffect(() => {
    if (!uppy) return;
    const onError = () => settleUpload({ error: new Error("upload failed") });
    uppy.on("upload-error", onError);
    return () => {
      uppy.off("upload-error", onError);
    };
  }, [uppy, settleUpload]);

  const uploadMaster = React.useCallback(
    (blob: Blob, mimeType: string): Promise<string> =>
      new Promise<string>((resolve, reject) => {
        if (!uppy) {
          reject(new Error("uploader not ready"));
          return;
        }
        // settleUpload() clears the resolver before settling, so whichever of
        // the upload and the timer gets there first wins and the other — a
        // late upload-success, or the upload-error that cancelAll() raises —
        // is a no-op against a null ref.
        const timer = window.setTimeout(() => {
          settleUpload({ error: new Error("upload timed out") });
          uppy.cancelAll();
        }, UPLOAD_TIMEOUT_MS);
        // Set before anything that can throw: the catch below settles through
        // this resolver, so the promise is guaranteed to end up settled.
        uploadResolverRef.current = {
          resolve: (key) => {
            window.clearTimeout(timer);
            resolve(key);
          },
          reject: (err) => {
            window.clearTimeout(timer);
            reject(err);
          },
        };
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
    [uppy, settleUpload],
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
  const handledAbortRef = React.useRef<string | null>(null);
  const autoStopHandledRef = React.useRef(false);
  const interruptionAnnouncedRef = React.useRef(false);
  const announcedSkipsRef = React.useRef(new Set<number>());

  const onStart = async () => {
    if (recorder.state === "recording" || recorder.jobId) {
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
    setPhase("starting");
    try {
      // Microphone first: a denied permission must never create a row.
      await recorder.prepare();
    } catch (err) {
      setPhase("setup");
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
      handledAbortRef.current = null;
      autoStopHandledRef.current = false;
      interruptionAnnouncedRef.current = false;
      announcedSkipsRef.current.clear();
      recorder.start(jobId);
      setPhase("recording");
      toast.success(t("toasts.recordingStarted"));
      onStarted(); // refetch the queue so the row shows under Processing (composer stays open)
    } catch (err: unknown) {
      discardRecording();
      setPhase("setup");
      toast.error(t("toasts.recordingStartFailed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  /* --------------------------------- finish -------------------------------- */

  const finish = React.useCallback(async () => {
    if (finishInFlightRef.current) return;
    const closeout: Closeout | null = recorder.jobId
      ? {
          jobId: recorder.jobId,
          audioKey: closeoutRef.current?.audioKey ?? null,
          durationSeconds: closeoutRef.current?.durationSeconds ?? null,
        }
      : closeoutRef.current;
    if (!closeout) return;
    closeoutRef.current = closeout;
    finishInFlightRef.current = true;
    try {
      setPhase("finishing");
      setFinishStep("draining");
      try {
        const { blob, mimeType, durationMs } = await recorder.stop();
        if (durationMs > 0) closeout.durationSeconds = durationMs / 1000;
        if (blob) {
          setFinishStep("uploading");
          try {
            closeout.audioKey = await uploadMaster(blob, mimeType);
          } catch {
            toast.warning(t("toasts.audioUploadFailedKeptTranscript"));
          }
        }
      } catch (err) {
        const reason = err instanceof QueueAbortError ? err.reason : null;
        if (reason === "not_recording") {
          // Finished or discarded from another device: the server closed the row
          // already, so there is nothing left for this tab to send.
          toast.info(t("toasts.recordingEndedElsewhere"));
          discardRecording();
          closeoutRef.current = null;
          setPhase("setup");
          setFinishStep(null);
          onStarted();
          onCancel();
          return;
        }
        // out_of_order / skip_rejected / an unexpected throw: the audio is lost
        // (stop() tore the recorder down), but the chunks already transcribed are
        // worth keeping — close the job anyway so it lands in Needs review.
        toast.error(t("toasts.recordingStopFailed"), {
          id: STOP_FAILED_TOAST,
          description:
            reason ?? (err instanceof Error ? err.message : undefined),
        });
        discardRecording();
        closeout.audioKey = null;
        closeout.durationSeconds = null;
      }
      setFinishStep("closing");
      try {
        await stopLive({
          variables: {
            id: closeout.jobId,
            input: {
              audio_s3key: closeout.audioKey,
              duration_seconds: closeout.durationSeconds,
            },
          },
        });
        toast.success(t("toasts.recordingFinished"));
        closeoutRef.current = null;
        setPhase("setup");
        setFinishStep(null);
        onStarted();
        onCancel();
      } catch (err: unknown) {
        // The row is still 'recording' server-side. Keep the surface (and its
        // Stop button) up so the close-out can be retried with the same audio.
        setFinishStep(null);
        setPhase("recording");
        toast.error(t("toasts.recordingStopFailed"), {
          id: STOP_FAILED_TOAST,
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      finishInFlightRef.current = false;
    }
  }, [
    recorder,
    discardRecording,
    stopLive,
    uploadMaster,
    onStarted,
    onCancel,
    t,
  ]);

  // The watcher effects below must not re-run when `finish` changes identity
  // (it closes over inline parent callbacks), so they reach it through a ref.
  const finishRef = React.useRef(finish);
  React.useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  // A watcher-driven finish leaves the confirm dialogs open and confirmable —
  // their pending state only tracks their own onConfirm. Retiring them as soon
  // as the recording stops is what keeps the latch above unreachable in
  // practice instead of merely survivable.
  React.useEffect(() => {
    if (phase === "recording") return;
    setConfirmStopOpen(false);
    setConfirmDiscardOpen(false);
  }, [phase]);

  const onDiscard = async () => {
    const jobId = recorder.jobId ?? closeoutRef.current?.jobId ?? null;
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
    closeoutRef.current = null;
    toast.success(t("toasts.recordingDiscarded"));
    setPhase("setup");
    onStarted();
    onCancel();
  };

  /* -------------------------------- watchers ------------------------------- */

  // Server-side end (409 from a chunk) or the 4h auto-stop ends the recording.
  React.useEffect(() => {
    if (phase !== "recording") return;
    const reason = recorder.abortReason;
    if (reason && handledAbortRef.current !== reason) {
      handledAbortRef.current = reason;
      if (reason === "not_recording") {
        toast.info(t("toasts.recordingEndedElsewhere"));
        discardRecording();
        closeoutRef.current = null;
        setPhase("setup");
        onStarted();
        onCancel();
      } else {
        // finish() still closes the job so the transcript so far is reviewable.
        toast.error(t("toasts.recordingStopFailed"), {
          id: STOP_FAILED_TOAST,
          description: reason,
        });
        void finishRef.current();
      }
      return;
    }
    if (recorder.autoStopped && !autoStopHandledRef.current) {
      autoStopHandledRef.current = true;
      toast.info(t("toasts.recordingAutoStopped"));
      void finishRef.current();
    }
  }, [
    phase,
    recorder.abortReason,
    recorder.autoStopped,
    discardRecording,
    onStarted,
    onCancel,
    t,
  ]);

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
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={phase === "finishing"}
            onClick={() => setConfirmStopOpen(true)}
            className="max-md:h-12"
          >
            {phase === "finishing" ? (
              <Loader2
                aria-hidden="true"
                className="mr-2 size-4 animate-spin"
              />
            ) : (
              <Square aria-hidden="true" className="mr-2 size-4" />
            )}
            {phase === "finishing"
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

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={phase === "finishing"}
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
          onConfirm={finish}
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
