/**
 * Pure one-line summaries for the five Transcripts settings sections
 * (task-7 brief, settings design doc). Each section renders collapsed with
 * its summary line as the thing an admin reads before deciding whether to
 * open it; `needsAttention` decides which section starts open and whether
 * the line renders in the warning color.
 *
 * Deliberately plain English, not `t(...)`: these take a single plain-object
 * argument (no translator), so the five functions stay trivially pure and
 * testable without mocking next-intl. The settings page renders the result
 * verbatim as the section's summary line.
 */
import type { RecordingLimitMinutes, RetentionHours } from "../hooks";

export interface SectionSummary {
  text: string;
  needsAttention: boolean;
}

const SOURCE_LABELS = {
  upload: "Upload",
  meeting: "Meeting bot",
  record: "Record on this device",
} as const;

export function summariseSources(input: {
  upload: boolean;
  meeting: boolean;
  record: boolean;
  embedderConfigured: boolean;
}): SectionSummary {
  const sources: Array<["upload" | "meeting" | "record", boolean]> = [
    ["upload", input.upload],
    ["meeting", input.meeting],
    ["record", input.record],
  ];
  const configuredCount = sources.filter(([, ok]) => ok).length;
  const missing = sources.filter(([, ok]) => !ok).map(([key]) => SOURCE_LABELS[key]);

  const parts = [`${configuredCount} of ${sources.length} sources connected`];
  if (missing.length > 0) {
    parts.push(`not set up: ${missing.join(", ")}`);
  }
  if (!input.embedderConfigured) {
    parts.push("no embedding model set — transcripts won't be searchable");
  }

  return {
    text: parts.join(" — "),
    needsAttention: configuredCount < sources.length || !input.embedderConfigured,
  };
}

export function summariseMeetingBot(input: {
  botName: string;
  notifyChat: boolean;
  mayOverride: boolean;
}): SectionSummary {
  const announce = input.notifyChat
    ? "announces the recording in chat"
    : "does not announce the recording in chat";
  const override = input.mayOverride
    ? "recorders may change its name"
    : "recorders can't change its name";

  return {
    text: `"${input.botName}" joins meetings, ${announce}; ${override}.`,
    needsAttention: false,
  };
}

export function summariseDefaults(input: {
  defaultRightsMode: string;
  presetCount: number;
  stalePresetCount: number;
}): SectionSummary {
  const presetPart =
    input.presetCount === 0
      ? "no summary presets"
      : `${input.presetCount} summary preset${input.presetCount === 1 ? "" : "s"}`;
  const stalePart =
    input.stalePresetCount > 0
      ? `, ${input.stalePresetCount} no longer available`
      : "";

  return {
    text: `New transcripts default to ${input.defaultRightsMode}; ${presetPart}${stalePart}.`,
    needsAttention: input.stalePresetCount > 0,
  };
}

export function summariseStorage(input: {
  retentionHours: RetentionHours;
  storeVideoLocally: boolean;
  costPerHour: number;
}): SectionSummary {
  const retention =
    input.retentionHours === "forever"
      ? "kept forever"
      : `kept for ${input.retentionHours} hours`;
  const local = input.storeVideoLocally
    ? "a local copy is also kept"
    : "no local copy is kept";

  return {
    text: `Meeting video is ${retention}; ${local}.`,
    needsAttention: false,
  };
}

export function summariseLimits(input: {
  limitMinutes: RecordingLimitMinutes;
}): SectionSummary {
  const text =
    input.limitMinutes === "none"
      ? "No monthly recording cap is set."
      : `Monthly recording cap: ${input.limitMinutes} minutes.`;

  return { text, needsAttention: false };
}
