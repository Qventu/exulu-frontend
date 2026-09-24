"use client";

/**
 * Hosts ONE useLiveRecorder for the whole authenticated shell so leaving
 * /transcriptions never ends a recording (spec §4.3). userId/backend come in
 * as props to avoid importing UserContext from authenticated.tsx (which
 * imports this file).
 */
import * as React from "react";

import { createFetchTransport } from "./chunk-transport";
import { useLiveRecorder, type LiveRecorder } from "./use-live-recorder";

const LiveRecordingContext = React.createContext<LiveRecorder | null>(null);

export function LiveRecordingProvider({
  backend,
  userId,
  children,
}: {
  backend: string;
  userId: string | number;
  children: React.ReactNode;
}) {
  const transport = React.useMemo(() => createFetchTransport(backend, userId), [backend, userId]);
  const recorder = useLiveRecorder(transport);
  return <LiveRecordingContext.Provider value={recorder}>{children}</LiveRecordingContext.Provider>;
}

/** Null outside the authenticated shell (public chat, demo) — callers render nothing. */
export function useLiveRecordingOptional(): LiveRecorder | null {
  return React.useContext(LiveRecordingContext);
}

export function useLiveRecording(): LiveRecorder {
  const recorder = React.useContext(LiveRecordingContext);
  if (!recorder) throw new Error("useLiveRecording must be used inside LiveRecordingProvider");
  return recorder;
}
