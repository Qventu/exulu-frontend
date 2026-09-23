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
 * Nothing here is unit-tested (DOM media APIs); the decisions are in the pure
 * modules cut-policy.ts / chunk-queue.ts, which are.
 */
import * as React from "react";

import { ChunkQueue, QueueAbortError, type ChunkState } from "./chunk-queue";
import type { ChunkPayload, LiveRecorderTransport } from "./chunk-transport";
import { MAX_RECORDING_MS, rmsToDbfs, shouldCut, SILENCE_DBFS } from "./cut-policy";
import { pickMimeType } from "./mime";

/** Task 8 spike fallback: record the master from stream.clone() if a browser refuses two recorders on one stream. */
export const USE_STREAM_CLONE = false;
const AUDIO_BITS_PER_SECOND = 64_000;
const MASTER_TIMESLICE_MS = 60_000;
const TICK_MS = 100;

export type LiveRecorderState = "idle" | "ready" | "recording" | "stopping" | "interrupted";

export type LiveRecorderStopResult = { blob: Blob | null; mimeType: string; durationMs: number };

export type LiveRecorder = {
  state: LiveRecorderState;
  jobId: string | null;
  startedAt: number | null;
  elapsedMs: number;
  /** 0..1 microphone level for the meter. */
  level: number;
  chunks: ChunkState[];
  /** Set when the queue aborted (409 from the server) — the composer ends the recording. */
  abortReason: string | null;
  autoStopped: boolean;
  /** Ask for the microphone. Throws the DOMException from getUserMedia on denial. */
  prepare(): Promise<void>;
  /** Begin recording into the given job. Requires prepare() first. */
  start(jobId: string): void;
  /** Stop, drain the queue, return the full audio. Rejects with QueueAbortError if the queue aborted. */
  stop(): Promise<LiveRecorderStopResult>;
  /** Stop everything, upload nothing, forget the blobs. */
  discard(): void;
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
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, [clearTick]);

  const buildAudioGraph = React.useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
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
      const blob = new Blob(segment.parts, { type: mimeRef.current || "audio/webm" });
      if (blob.size === 0) return; // nothing captured (e.g. immediate interruption)
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
    silentForRef.current = dbfs < SILENCE_DBFS ? silentForRef.current + TICK_MS : 0;
    setLevel(Math.min(1, rms * 6));

    const now = performance.now();
    const elapsed = now - originRef.current;
    setElapsedMs(elapsed);

    if (elapsed >= MAX_RECORDING_MS) {
      setAutoStopped(true);
      return; // the composer watches autoStopped and calls stop()
    }
    if (shouldCut({ chunkElapsedMs: now - segment.startedAt, silentForMs: silentForRef.current })) {
      cutSegment();
    }
  }, [cutSegment]);

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
      adoptStream(await navigator.mediaDevices.getUserMedia({ audio: true }));
      buildAudioGraph();
      startMaster();
      startSegment();
      tickRef.current = window.setInterval(tick, TICK_MS);
      void requestWakeLock();
    } catch {
      setStateBoth("interrupted"); // the composer ends the recording with what was captured
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
      originRef.current = performance.now();
      setAbortReason(null);
      setAutoStopped(false);
      setChunks([]);
      jobIdRef.current = nextJobId;
      setJobId(nextJobId);
      setStartedAt(Date.now());

      const queue = new ChunkQueue<ChunkPayload>({
        send: (chunk, opts) => transport.sendChunk(nextJobId, chunk, opts),
      });
      queue.subscribe(() => setChunks(queue.snapshot()));
      queueRef.current = queue;

      buildAudioGraph();
      startMaster();
      startSegment();
      tickRef.current = window.setInterval(tick, TICK_MS);
      setStateBoth("recording");
      void requestWakeLock();
      // Surface queue aborts (409 from the server) to the composer.
      queue.drain().catch((err: unknown) => {
        if (err instanceof QueueAbortError) setAbortReason(err.reason);
      });
    },
    [buildAudioGraph, requestWakeLock, setStateBoth, startMaster, startSegment, tick, transport],
  );

  const stop = React.useCallback(async (): Promise<LiveRecorderStopResult> => {
    if (stateRef.current !== "recording" && stateRef.current !== "interrupted") {
      return { blob: null, mimeType: mimeRef.current, durationMs: 0 };
    }
    setStateBoth("stopping");
    clearTick();
    await stopRecorder(segmentRef.current?.recorder); // enqueues the final chunk
    await stopRecorder(masterRef.current);
    const durationMs = performance.now() - originRef.current;
    releaseWakeLock();
    teardownAudioGraph();
    stopTracks();
    try {
      await queueRef.current?.drain();
    } finally {
      // Whether or not the queue aborted, the microphone is done.
    }
    const mimeType = mimeRef.current || "audio/webm";
    const blob = masterPartsRef.current.length > 0 ? new Blob(masterPartsRef.current, { type: mimeType }) : null;
    masterPartsRef.current = [];
    segmentRef.current = null;
    masterRef.current = null;
    queueRef.current = null;
    jobIdRef.current = null;
    setJobId(null);
    setStateBoth("idle");
    return { blob, mimeType, durationMs };
  }, [clearTick, releaseWakeLock, setStateBoth, stopTracks, teardownAudioGraph]);

  const discard = React.useCallback(() => {
    queueRef.current?.abort("discard");
    clearTick();
    safeStop(segmentRef.current?.recorder);
    safeStop(masterRef.current);
    releaseWakeLock();
    teardownAudioGraph();
    stopTracks();
    masterPartsRef.current = [];
    segmentRef.current = null;
    masterRef.current = null;
    queueRef.current = null;
    jobIdRef.current = null;
    setJobId(null);
    setChunks([]);
    setElapsedMs(0);
    setLevel(0);
    setStateBoth("idle");
  }, [clearTick, releaseWakeLock, setStateBoth, stopTracks, teardownAudioGraph]);

  // Re-acquire the wake lock when the tab becomes visible again (browsers drop it on hide).
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && stateRef.current === "recording") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [requestWakeLock]);

  // Tab close / reload guard while recording.
  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (stateRef.current !== "recording") return;
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
    startedAt,
    elapsedMs,
    level,
    chunks,
    abortReason,
    autoStopped,
    prepare,
    start,
    stop,
    discard,
  };
}
