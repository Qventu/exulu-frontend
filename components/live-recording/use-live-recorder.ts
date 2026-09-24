"use client";

/**
 * The microphone side of "Record on this device" (spec §4.4). Owns the
 * MediaStream, an AnalyserNode (level meter + silence detector), TWO
 * MediaRecorders — a segment recorder restarted at silence-aligned cut points
 * (each blob → chunk queue → backend) and a continuous master recorder whose
 * slices are joined into the full audio file at stop — plus the wake lock and
 * interruption handling. Instantiated once by LiveRecordingProvider so a
 * recording survives in-app navigation.
 *
 * It also owns the END of a recording: every way one can end (Stop, the 4 h
 * auto-stop, a queue abort) lands in a `pendingCloseout` that outlives the
 * composer, so the upload + liveRecordingStop cannot be orphaned by an
 * unmount. The composer performs that close-out and calls release().
 *
 * Nothing here is unit-tested (DOM media APIs); the decisions are in the pure
 * modules cut-policy.ts / chunk-queue.ts, which are.
 */
import * as React from "react";

import { ChunkQueue, QueueAbortError, type ChunkState } from "./chunk-queue";
import type { ChunkPayload, LiveRecorderTransport } from "./chunk-transport";
import {
  MAX_CHUNK_MS,
  MAX_RECORDING_MS,
  NoiseFloorTracker,
  rmsToDbfs,
  shouldCut,
  silenceThreshold,
} from "./cut-policy";
import { pickMimeType } from "./mime";

/** Task 8 spike fallback: record the master from stream.clone() if a browser refuses two recorders on one stream. */
export const USE_STREAM_CLONE = false;
const AUDIO_BITS_PER_SECOND = 64_000;
const MASTER_TIMESLICE_MS = 60_000;
const TICK_MS = 100;

export type LiveRecorderState = "idle" | "ready" | "recording" | "stopping" | "interrupted";

/** Dispatched on window at every segment cut (see tick()); the manual E2E's evidence. */
export const LIVE_RECORDING_CUT_EVENT = "live-recording:cut";
export type LiveRecordingCut = { seq: number; reason: "silence" | "max"; chunkMs: number };

export type LiveRecorderStopResult = { blob: Blob | null; mimeType: string; durationMs: number };

/** Why the recording ended. Drives the composer's toast and whether liveRecordingStop runs. */
export type CloseoutReason =
  | "user"
  | "auto_stop"
  | "interrupted"
  | "not_recording"
  | "not_found"
  | "queue_aborted";

/**
 * What the server is still owed once the microphone is off: upload the master
 * blob, then liveRecordingStop (except when the row was already closed
 * elsewhere). It lives HERE, not in the composer, because the page only keeps
 * the composer mounted while the recorder reports a job — a close-out owned by
 * the composer is orphaned the moment the job id disappears, taking the audio
 * and the status flip with it.
 */
export type PendingCloseout = {
  jobId: string;
  blob: Blob | null;
  mimeType: string;
  durationMs: number;
  reason: CloseoutReason;
  /** The queue's raw abort reason, for the failure toast (queue_aborted only). */
  abortReason?: string;
};

/** 409 not_recording / 404 not_found need no mutation; everything else does. */
const closeoutReasonFor = (abort: string): CloseoutReason =>
  abort === "not_recording" ? "not_recording" : abort === "not_found" ? "not_found" : "queue_aborted";

export type LiveRecorder = {
  state: LiveRecorderState;
  jobId: string | null;
  /** The job being closed out: set when the recording ends, cleared by release(). */
  closingJobId: string | null;
  /** jobId while recording, closingJobId through the close-out. What "busy" means. */
  activeJobId: string | null;
  startedAt: number | null;
  elapsedMs: number;
  /** 0..1 microphone level for the meter. */
  level: number;
  chunks: ChunkState[];
  /** Set when the queue aborted (409/404 from the server); informational for the UI. */
  abortReason: string | null;
  autoStopped: boolean;
  /** The close-out the composer has to perform, or null. Survives the composer unmounting. */
  pendingCloseout: PendingCloseout | null;
  /** Ask for the microphone. Throws the DOMException from getUserMedia on denial. */
  prepare(): Promise<void>;
  /** Begin recording into the given job. Requires prepare() first. */
  start(jobId: string): void;
  /**
   * Stop, drain the queue, return the full audio, AND publish a pendingCloseout
   * for the same recording. Rejects with QueueAbortError if the queue aborted
   * (the close-out is published for that case too, so the job still closes).
   */
  stop(): Promise<LiveRecorderStopResult>;
  /** Stop everything, upload nothing, forget the blobs and the close-out. */
  discard(): void;
  /** Close-out done: forget the job, the blob and the end-of-recording flags. */
  release(): void;
};

type Segment = { recorder: MediaRecorder; seq: number; startedAt: number; parts: Blob[] };

/** Module scope so the callbacks below stay dependency-free (and stable). */
const recorderOptions = (mimeType: string): MediaRecorderOptions =>
  mimeType
    ? { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND }
    : { audioBitsPerSecond: AUDIO_BITS_PER_SECOND };

/** stop() throws InvalidStateError on an already-inactive recorder (a track that ended stops it for us). */
const safeStop = (recorder: MediaRecorder | null | undefined): void => {
  if (!recorder || recorder.state === "inactive") return;
  try {
    recorder.stop();
  } catch {
    // Raced with the browser stopping it; nothing left to do.
  }
};

/** Resolves once the recorder's own onstop handler (the chunk enqueue) has run. */
const stopRecorder = (recorder: MediaRecorder | null | undefined): Promise<void> =>
  new Promise<void>((resolve) => {
    if (!recorder || recorder.state === "inactive") {
      resolve();
      return;
    }
    const previous = recorder.onstop;
    recorder.onstop = (event) => {
      if (typeof previous === "function") previous.call(recorder, event);
      resolve();
    };
    recorder.stop();
  });

export function useLiveRecorder(transport: LiveRecorderTransport): LiveRecorder {
  const [state, setState] = React.useState<LiveRecorderState>("idle");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [closingJobId, setClosingJobId] = React.useState<string | null>(null);
  const [pendingCloseout, setPendingCloseout] = React.useState<PendingCloseout | null>(null);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [chunks, setChunks] = React.useState<ChunkState[]>([]);
  const [abortReason, setAbortReason] = React.useState<string | null>(null);
  const [autoStopped, setAutoStopped] = React.useState(false);

  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const masterRef = React.useRef<MediaRecorder | null>(null);
  const masterPartsRef = React.useRef<Blob[]>([]);
  const segmentRef = React.useRef<Segment | null>(null);
  const seqRef = React.useRef(0);
  const originRef = React.useRef(0);
  const silentForRef = React.useRef(0);
  const tickRef = React.useRef<number | null>(null);
  const queueRef = React.useRef<ChunkQueue<ChunkPayload> | null>(null);
  const mimeRef = React.useRef("");
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const stateRef = React.useRef<LiveRecorderState>("idle");
  const jobIdRef = React.useRef<string | null>(null);
  /** Mirrors closingJobId for the beforeunload guard (a listener with [] deps). */
  const closingJobIdRef = React.useRef<string | null>(null);
  const noiseFloorRef = React.useRef<NoiseFloorTracker | null>(null);
  /**
   * startSegment() has to reach handleInterruption() (recorder.onerror) and
   * handleInterruption() has to reach startSegment() — a cycle. The ref is
   * filled by the effect below, so the two can be declared in plain order.
   */
  const handleInterruptionRef = React.useRef<(() => void) | null>(null);
  /**
   * A lost microphone can fire both track "ended" and MediaRecorder.onerror.
   * Without this latch both would re-acquire, and the two segment recorders
   * would hand the queue duplicate seqs (which the server rejects as
   * out_of_order, aborting the whole recording).
   */
  const interruptingRef = React.useRef(false);

  const setStateBoth = React.useCallback((next: LiveRecorderState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const setClosingBoth = React.useCallback((next: string | null) => {
    closingJobIdRef.current = next;
    setClosingJobId(next);
  }, []);

  /**
   * The close-out is over (done, retried away, or discarded): drop the job,
   * the master blob and the end-of-recording flags. Public as release().
   */
  const releaseCloseout = React.useCallback(() => {
    setClosingBoth(null);
    setPendingCloseout(null);
    setAbortReason(null);
    setAutoStopped(false);
  }, [setClosingBoth]);

  const requestWakeLock = React.useCallback(async () => {
    try {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Unsupported or refused (low battery): the UI notice covers it.
    }
  }, []);

  const releaseWakeLock = React.useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const onTrackEnded = React.useCallback(() => {
    handleInterruptionRef.current?.();
  }, []);

  /** Keep the stream and watch its track: "ended" == the OS took the microphone away. */
  const adoptStream = React.useCallback(
    (stream: MediaStream) => {
      streamRef.current = stream;
      stream.getAudioTracks()[0]?.addEventListener("ended", onTrackEnded);
    },
    [onTrackEnded],
  );

  const stopTracks = React.useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (!stream) return;
    stream.getAudioTracks()[0]?.removeEventListener("ended", onTrackEnded);
    stream.getTracks().forEach((track) => track.stop());
  }, [onTrackEnded]);

  const clearTick = React.useCallback(() => {
    if (tickRef.current != null) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const teardownAudioGraph = React.useCallback(() => {
    clearTick();
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (!ctx) return;
    // close() itself fires a statechange; without this the handler would read
    // the interruption path on a context we are deliberately shutting down.
    ctx.onstatechange = null;
    void ctx.close().catch(() => undefined);
  }, [clearTick]);

  /** Microphone hardware off: wake lock, audio graph, tracks. Idempotent. */
  const releaseMicrophone = React.useCallback(() => {
    releaseWakeLock();
    teardownAudioGraph();
    stopTracks();
  }, [releaseWakeLock, stopTracks, teardownAudioGraph]);

  /**
   * Everything that must be true once a recording is over, whatever the
   * outcome -- a clean stop, a queue abort, or a discard. closingJobId,
   * pendingCloseout and abortReason are deliberately left alone: the job is
   * not finished until the composer has closed it out and called release().
   */
  const endSession = React.useCallback(() => {
    releaseMicrophone();
    masterPartsRef.current = [];
    segmentRef.current = null;
    masterRef.current = null;
    queueRef.current = null;
    jobIdRef.current = null;
    setJobId(null);
    setStateBoth("idle");
  }, [releaseMicrophone, setStateBoth]);

  const buildAudioGraph = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    // The third interruption trigger (spec §4.4): iOS parks the context in
    // "interrupted" during a call or Siri. The tracks stay live and the
    // recorders stay "recording", so this is the only signal there is.
    // Not in the AudioContextState union — it is a WebKit extension.
    ctx.onstatechange = () => {
      if ((ctx.state as string) === "interrupted") handleInterruptionRef.current?.();
    };
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  const startMaster = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const source = USE_STREAM_CLONE ? stream.clone() : stream;
    const master = new MediaRecorder(source, recorderOptions(mimeRef.current));
    master.ondataavailable = (event) => {
      if (event.data.size > 0) masterPartsRef.current.push(event.data);
    };
    master.start(MASTER_TIMESLICE_MS);
    masterRef.current = master;
  }, []);

  /** Start the next segment recorder. Seq is assigned at START so cut order == seq order. */
  const startSegment = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const seq = seqRef.current++;
    const recorder = new MediaRecorder(stream, recorderOptions(mimeRef.current));
    const segment: Segment = { recorder, seq, startedAt: performance.now(), parts: [] };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) segment.parts.push(event.data);
    };
    recorder.onstop = () => {
      const stoppedAt = performance.now();
      // Enqueued even when nothing was captured (an interruption right after
      // the cut). The seq was spent at segment START, so dropping it here
      // would leave a hole and the backend would report every later chunk
      // out_of_order. An empty body is either stored as an empty transcript
      // or deterministically rejected, which the queue turns into a skip
      // marker for the same seq -- contiguous either way.
      const blob = new Blob(segment.parts, { type: mimeRef.current || "audio/webm" });
      queueRef.current?.enqueue({
        seq: segment.seq,
        blob,
        offsetMs: segment.startedAt - originRef.current,
        durationMs: stoppedAt - segment.startedAt,
        mimeType: mimeRef.current || "audio/webm",
      });
    };
    recorder.onerror = () => handleInterruptionRef.current?.();
    recorder.start();
    segmentRef.current = segment;
  }, []);

  /** Start the next recorder BEFORE stopping the current one so boundaries overlap by a few ms. */
  const cutSegment = React.useCallback(() => {
    const previous = segmentRef.current;
    startSegment();
    previous?.recorder.stop();
    silentForRef.current = 0;
  }, [startSegment]);

  /**
   * The one way a recording ends normally: stop both recorders, join the
   * master, drain the queue, and publish the close-out the composer owes the
   * server. `reason` says why, which is all the composer needs to pick its
   * toast and decide whether liveRecordingStop runs at all.
   */
  const stopInternal = React.useCallback(
    async (reason: CloseoutReason): Promise<LiveRecorderStopResult> => {
      if (stateRef.current !== "recording" && stateRef.current !== "interrupted") {
        return { blob: null, mimeType: mimeRef.current, durationMs: 0 };
      }
      // Claimed before endSession() nulls jobId, and held until release(): this
      // is what keeps the pill up, the composer mounted and the row's own
      // Finish/Discard hidden while the close-out runs.
      const closingId = jobIdRef.current;
      setClosingBoth(closingId);
      setStateBoth("stopping");
      clearTick();
      await stopRecorder(segmentRef.current?.recorder); // enqueues the final chunk
      await stopRecorder(masterRef.current);
      const durationMs = performance.now() - originRef.current;
      const mimeType = mimeRef.current || "audio/webm";
      const blob = masterPartsRef.current.length > 0 ? new Blob(masterPartsRef.current, { type: mimeType }) : null;
      // The microphone goes quiet now; the drain that follows can take a while on
      // a bad connection, and the recording itself is already over.
      releaseMicrophone();
      // discard() can run while the awaits above are pending (it is allowed
      // during the drain, spec §5). It releases the close-out itself, so a
      // closingJobId that no longer matches means this stop lost its job and
      // must not publish anything for it.
      const stillOwned = () => closingJobIdRef.current === closingId;
      try {
        await queueRef.current?.drain();
      } catch (err) {
        // A QueueAbortError rethrows to the caller, but the machine still has to
        // land in idle -- otherwise the pill stays up and stop() can never retry.
        endSession();
        const abort = err instanceof QueueAbortError ? err.reason : null;
        if (abort === "discard" || !stillOwned()) {
          // The user threw the recording away mid-drain. Nothing to close out.
          releaseCloseout();
        } else if (closingId) {
          // The audio survived (it was joined before the drain), so the
          // close-out still carries it: the transcript is partial, the
          // recording is not.
          setPendingCloseout({
            jobId: closingId,
            blob,
            mimeType,
            durationMs,
            reason: abort ? closeoutReasonFor(abort) : "queue_aborted",
            abortReason: abort ?? undefined,
          });
        }
        throw err;
      }
      endSession();
      if (closingId && stillOwned()) setPendingCloseout({ jobId: closingId, blob, mimeType, durationMs, reason });
      return { blob, mimeType, durationMs };
    },
    [clearTick, endSession, releaseCloseout, releaseMicrophone, setClosingBoth, setStateBoth],
  );

  /**
   * The queue aborted mid-recording -- the row was finished or discarded from
   * another device (409), or deleted outright (404). The queue is already dead,
   * so there is nothing to drain and no point joining a master nobody will
   * attach: end the recording here and let the composer close the job out
   * (or not, when the server already did).
   */
  const endFromAbort = React.useCallback(
    (abort: string) => {
      const closingId = jobIdRef.current;
      setClosingBoth(closingId);
      setStateBoth("stopping");
      clearTick();
      safeStop(segmentRef.current?.recorder);
      safeStop(masterRef.current);
      const mimeType = mimeRef.current || "audio/webm";
      endSession();
      if (!closingId) return;
      const reason = closeoutReasonFor(abort);
      setPendingCloseout({
        jobId: closingId,
        blob: null,
        // 0 -> the composer sends duration_seconds: null and the server keeps
        // what the acknowledged chunks already reported.
        durationMs: 0,
        mimeType,
        reason,
        abortReason: reason === "queue_aborted" ? abort : undefined,
      });
    },
    [clearTick, endSession, setClosingBoth, setStateBoth],
  );

  const tick = React.useCallback(() => {
    const analyser = analyserRef.current;
    const segment = segmentRef.current;
    if (!analyser || !segment || stateRef.current !== "recording") return;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const rms = Math.sqrt(sum / buffer.length);
    const dbfs = rmsToDbfs(rms);
    // Silence is relative to the room, not to a constant: a fan or a café
    // sits above -50 dBFS and would never cut (spec §4.4).
    const tracker = (noiseFloorRef.current ??= new NoiseFloorTracker());
    const threshold = silenceThreshold(tracker.update(dbfs));
    silentForRef.current = dbfs < threshold ? silentForRef.current + TICK_MS : 0;
    setLevel(Math.min(1, rms * 6));

    const now = performance.now();
    const elapsed = now - originRef.current;
    setElapsedMs(elapsed);

    if (elapsed >= MAX_RECORDING_MS) {
      setAutoStopped(true);
      // Ends the recording here rather than waiting for a composer that may
      // not be mounted; the close-out it publishes carries the master blob.
      // A drain-time queue abort rejects the promise; that case has already
      // been turned into a pendingCloseout, so there is nothing left to hear.
      void stopInternal("auto_stop").catch(() => undefined);
      return;
    }
    const chunkMs = now - segment.startedAt;
    if (shouldCut({ chunkElapsedMs: chunkMs, silentForMs: silentForRef.current })) {
      // The only externally visible evidence that silence cutting works. The
      // lint guardrail allows no console.debug, so the manual E2E reads it as
      // an event instead: in devtools,
      //   addEventListener("live-recording:cut", (e) => console.log(e.detail))
      window.dispatchEvent(
        new CustomEvent<LiveRecordingCut>(LIVE_RECORDING_CUT_EVENT, {
          detail: {
            seq: segment.seq,
            reason: chunkMs >= MAX_CHUNK_MS ? "max" : "silence",
            chunkMs: Math.round(chunkMs),
          },
        }),
      );
      cutSegment();
    }
  }, [cutSegment, stopInternal]);

  const handleInterruption = React.useCallback(async () => {
    if (stateRef.current !== "recording" || interruptingRef.current) return;
    interruptingRef.current = true;
    // One re-acquire attempt (iOS call/Siri interruption, device switch). The
    // master keeps its earlier slices, so the final file has a gap but stays valid.
    try {
      safeStop(segmentRef.current?.recorder);
      safeStop(masterRef.current);
      teardownAudioGraph();
      stopTracks();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // stop() or discard() can have run to completion while getUserMedia was
      // pending. Adopting the stream now would hand the user a live microphone,
      // two recorders and a 100ms interval that nothing ever ends.
      if (stateRef.current !== "recording") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      adoptStream(stream);
      buildAudioGraph();
      startMaster();
      startSegment();
      tickRef.current = window.setInterval(tick, TICK_MS);
      void requestWakeLock();
    } catch {
      // Only if this is still the live recording: stop() or discard() can have
      // finished while getUserMedia was pending (the same race the success
      // path guards above), and parking a torn-down recorder in "interrupted"
      // would put the pill back up over an idle microphone.
      if (stateRef.current === "recording") setStateBoth("interrupted");
    } finally {
      interruptingRef.current = false;
    }
  }, [
    adoptStream,
    buildAudioGraph,
    requestWakeLock,
    setStateBoth,
    startMaster,
    startSegment,
    stopTracks,
    teardownAudioGraph,
    tick,
  ]);

  React.useEffect(() => {
    handleInterruptionRef.current = () => void handleInterruption();
  }, [handleInterruption]);

  const prepare = React.useCallback(async () => {
    if (streamRef.current) return;
    adoptStream(await navigator.mediaDevices.getUserMedia({ audio: true }));
    setStateBoth("ready");
  }, [adoptStream, setStateBoth]);

  const start = React.useCallback(
    (nextJobId: string) => {
      if (!streamRef.current) throw new Error("prepare() must resolve before start()");
      if (stateRef.current === "recording") throw new Error("already recording");
      mimeRef.current = pickMimeType((type) => MediaRecorder.isTypeSupported(type));
      seqRef.current = 0;
      masterPartsRef.current = [];
      silentForRef.current = 0;
      // One floor per recording: the previous room's noise is not this one's.
      noiseFloorRef.current = new NoiseFloorTracker();
      originRef.current = performance.now();
      releaseCloseout();
      setChunks([]);
      jobIdRef.current = nextJobId;
      setJobId(nextJobId);
      setStartedAt(Date.now());

      const queue = new ChunkQueue<ChunkPayload>({
        send: (chunk, opts) => transport.sendChunk(nextJobId, chunk, opts),
      });
      // The subscriber is the ONLY mid-recording abort signal: abort() notifies,
      // and drain() here would resolve instantly against the still-empty queue.
      queue.subscribe(() => {
        setChunks(queue.snapshot());
        const abort = queue.abortedReason;
        setAbortReason(abort);
        // discard() aborts the queue too -- a deliberate choice, not a failure
        // to end a recording over. Every other reason ends it here, in the
        // hook, so the recording does not depend on a mounted composer.
        if (abort && abort !== "discard" && stateRef.current === "recording") endFromAbort(abort);
      });
      queueRef.current = queue;

      buildAudioGraph();
      startMaster();
      startSegment();
      tickRef.current = window.setInterval(tick, TICK_MS);
      setStateBoth("recording");
      void requestWakeLock();
    },
    [
      buildAudioGraph,
      endFromAbort,
      releaseCloseout,
      requestWakeLock,
      setStateBoth,
      startMaster,
      startSegment,
      tick,
      transport,
    ],
  );

  const stop = React.useCallback(() => stopInternal("user"), [stopInternal]);

  const discard = React.useCallback(() => {
    queueRef.current?.abort("discard");
    clearTick();
    safeStop(segmentRef.current?.recorder);
    safeStop(masterRef.current);
    endSession();
    setChunks([]);
    setElapsedMs(0);
    setLevel(0);
    // Throwing the recording away is a deliberate choice, not a failure to
    // report: the abort reason the line above raised, a close-out a stop() in
    // flight may still be assembling, and the auto-stop flag all go with it.
    releaseCloseout();
  }, [clearTick, endSession, releaseCloseout]);

  // Re-acquire the wake lock when the tab becomes visible again (browsers drop it on hide).
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || stateRef.current !== "recording") return;
      void requestWakeLock();
      // iOS suspends the AudioContext in the background. Without a resume the
      // analyser keeps returning the last buffer it saw, so the meter freezes
      // and -- worse -- the silence detector stops finding cut points.
      void audioCtxRef.current?.resume().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [requestWakeLock]);

  // Tab close / reload guard while recording OR while a close-out is pending
  // (the master blob only lives in this tab's memory until it is uploaded).
  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (stateRef.current !== "recording" && !closingJobIdRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // The provider lives as long as the authenticated shell; if it ever does
  // unmount, the 100ms meter interval must not outlive it.
  React.useEffect(() => () => clearTick(), [clearTick]);

  return {
    state,
    jobId,
    closingJobId,
    activeJobId: jobId ?? closingJobId,
    startedAt,
    elapsedMs,
    level,
    chunks,
    abortReason,
    autoStopped,
    pendingCloseout,
    prepare,
    start,
    stop,
    discard,
    release: releaseCloseout,
  };
}
