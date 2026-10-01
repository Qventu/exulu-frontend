/**
 * Pure one-line summaries for the six Transcripts settings sections
 * (task-7 brief, settings design doc §5). Each section renders collapsed
 * with its summary line as the thing an admin reads before deciding whether
 * to open it; `needsAttention` decides which section starts open and whether
 * the line renders in the warning color.
 *
 * Fix round 1, minor #3: these return a translation **key** plus the raw
 * interpolation values, never rendered text — `t(...)` is deliberately not
 * called here so the five/six functions stay trivially pure and testable
 * without mocking next-intl, but the summary line is still the first thing
 * an admin reads, so it must be localized like everything else. The caller
 * (settings/page.tsx) calls `t(summary.key, summary.values)`. Every key
 * below lives at `transcriptions.settings.summaries.*` in both locale files.
 */
import type { RecordingLimitMinutes, RetentionHours } from "../hooks";

export interface SectionSummary {
  key: string;
  /** Raw values for `t(key, values)` — any enum/label value (e.g. a rights
   *  mode) must already be translated by the caller before landing here;
   *  these functions never call `t` themselves. */
  values?: Record<string, string | number | boolean>;
  needsAttention: boolean;
}

const SUMMARY_NS = "settings.summaries";

export function summariseSources(input: {
  upload: boolean;
  meeting: boolean;
  record: boolean;
  embedderConfigured: boolean;
}): SectionSummary {
  const configured = [input.upload, input.meeting, input.record].filter(Boolean).length;
  const total = 3;

  return {
    key: `${SUMMARY_NS}.sources`,
    values: { configured, total, embedderConfigured: input.embedderConfigured },
    needsAttention: configured < total || !input.embedderConfigured,
  };
}

export function summariseMeetingBot(input: {
  botName: string;
  notifyChat: boolean;
  mayOverride: boolean;
}): SectionSummary {
  return {
    key: `${SUMMARY_NS}.meetingBot`,
    values: {
      botName: input.botName,
      notifyChat: input.notifyChat,
      mayOverride: input.mayOverride,
    },
    needsAttention: false,
  };
}

export function summariseDefaults(input: {
  /** Already translated by the caller (e.g. `t("mode.private")`) — this
   *  function never calls `t` itself. */
  defaultRightsMode: string;
  presetCount: number;
  stalePresetCount: number;
}): SectionSummary {
  return {
    key: `${SUMMARY_NS}.defaults`,
    values: {
      defaultRightsMode: input.defaultRightsMode,
      presetCount: input.presetCount,
      stalePresetCount: input.stalePresetCount,
    },
    needsAttention: input.stalePresetCount > 0,
  };
}

export function summariseStorage(input: {
  retentionHours: RetentionHours;
  storeVideoLocally: boolean;
  costPerHour: number;
}): SectionSummary {
  const forever = input.retentionHours === "forever";

  return {
    key: `${SUMMARY_NS}.storage`,
    values: {
      forever,
      hours: forever ? 0 : input.retentionHours,
      storeVideoLocally: input.storeVideoLocally,
    },
    needsAttention: false,
  };
}

export function summariseLimits(input: { limitMinutes: RecordingLimitMinutes }): SectionSummary {
  const none = input.limitMinutes === "none";

  return {
    key: `${SUMMARY_NS}.limits`,
    values: { none, minutes: none ? 0 : input.limitMinutes },
    needsAttention: false,
  };
}

/**
 * Knowledge base and agents (settings design doc §5, fix round 1 critical —
 * the spec's sixth section, dropped from the original five). `readCount` is
 * every agent whose `agentic_context_search` tool has `transcriptions` as a
 * non-disabled knowledge base (see `./knowledge.ts` for how that's derived
 * from `agent.tools`); `writeCount` is the subset that can also write to it
 * via `knowledge_base_editor`. Zero agents able to read is flagged — it means
 * transcripts are invisible to every agent, not a neutral "nothing configured
 * yet" the way an unset bot name is.
 */
export function summariseKnowledge(input: {
  readCount: number;
  writeCount: number;
}): SectionSummary {
  return {
    key: `${SUMMARY_NS}.knowledge`,
    values: { readCount: input.readCount, writeCount: input.writeCount },
    needsAttention: input.readCount === 0,
  };
}
