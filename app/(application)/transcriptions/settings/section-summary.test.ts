import { describe, expect, it } from "vitest";

import {
  summariseSources,
  summariseMeetingBot,
  summariseDefaults,
  summariseStorage,
  summariseLimits,
  summariseKnowledge,
} from "./section-summary";

// Fix round 1, minor #3: these functions return a translation key + values,
// never rendered text (section-summary.ts's docstring) — the original three
// suites below were updated from asserting on `.text` substrings to
// asserting on `.key`/`.values`, per review.

describe("summariseSources", () => {
  it("counts configured sources and names what is missing", () => {
    const s = summariseSources({ upload: true, meeting: true, record: false, embedderConfigured: true });
    expect(s.key).toBe("settings.summaries.sources");
    expect(s.values).toEqual({ configured: 2, total: 3, embedderConfigured: true });
    expect(s.needsAttention).toBe(true);
  });

  it("flags a missing embedder even when all three sources are up", () => {
    // Without an embedder nothing is searchable, so this must not read as fine.
    const s = summariseSources({ upload: true, meeting: true, record: true, embedderConfigured: false });
    expect(s.needsAttention).toBe(true);
  });

  it("is calm when everything is configured", () => {
    const s = summariseSources({ upload: true, meeting: true, record: true, embedderConfigured: true });
    expect(s.needsAttention).toBe(false);
  });
});

describe("summariseMeetingBot", () => {
  it("names the bot and whether recorders may override", () => {
    const s = summariseMeetingBot({ botName: "IMP Notetaker", notifyChat: true, mayOverride: false });
    expect(s.key).toBe("settings.summaries.meetingBot");
    expect(s.values).toEqual({ botName: "IMP Notetaker", notifyChat: true, mayOverride: false });
  });
});

describe("summariseDefaults", () => {
  it("reports no presets plainly rather than as an error", () => {
    const s = summariseDefaults({ defaultRightsMode: "private", presetCount: 0, stalePresetCount: 0 });
    expect(s.needsAttention).toBe(false);
  });

  it("flags stale presets for attention", () => {
    const s = summariseDefaults({ defaultRightsMode: "private", presetCount: 1, stalePresetCount: 1 });
    expect(s.needsAttention).toBe(true);
  });
});

describe("summariseStorage", () => {
  it("describes a finite retention plainly", () => {
    const s = summariseStorage({ retentionHours: 720, storeVideoLocally: false, costPerHour: 0 });
    expect(s.values).toMatchObject({ forever: false, hours: 720 });
    expect(s.needsAttention).toBe(false);
  });

  it("describes 'forever' retention without alarm", () => {
    const s = summariseStorage({ retentionHours: "forever", storeVideoLocally: true, costPerHour: 0.1 });
    expect(s.values).toMatchObject({ forever: true });
    expect(s.needsAttention).toBe(false);
  });
});

describe("summariseLimits", () => {
  it("reports no cap plainly rather than as an error", () => {
    const s = summariseLimits({ limitMinutes: "none" });
    expect(s.values).toMatchObject({ none: true });
    expect(s.needsAttention).toBe(false);
  });

  it("reports a configured cap", () => {
    const s = summariseLimits({ limitMinutes: 600 });
    expect(s.values).toMatchObject({ none: false, minutes: 600 });
    expect(s.needsAttention).toBe(false);
  });
});

describe("summariseKnowledge", () => {
  it("flags attention when no agent can read this knowledge base yet", () => {
    // A workspace with zero agents retrieving from transcripts means every
    // transcript is invisible to every agent — worth a flag, not silence.
    const s = summariseKnowledge({ readCount: 0, writeCount: 0 });
    expect(s.key).toBe("settings.summaries.knowledge");
    expect(s.needsAttention).toBe(true);
  });

  it("is calm once at least one agent can read it", () => {
    const s = summariseKnowledge({ readCount: 2, writeCount: 0 });
    expect(s.needsAttention).toBe(false);
  });

  it("reports the write count alongside the read count", () => {
    const s = summariseKnowledge({ readCount: 3, writeCount: 1 });
    expect(s.values).toEqual({ readCount: 3, writeCount: 1 });
  });
});
