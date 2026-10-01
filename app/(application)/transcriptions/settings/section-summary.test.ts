import { describe, expect, it } from "vitest";

import {
  summariseSources,
  summariseMeetingBot,
  summariseDefaults,
  summariseStorage,
  summariseLimits,
} from "./section-summary";

describe("summariseSources", () => {
  it("counts configured sources and names what is missing", () => {
    const s = summariseSources({ upload: true, meeting: true, record: false, embedderConfigured: true });
    expect(s.text).toContain("2 of 3");
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
    expect(s.text).toContain("IMP Notetaker");
    expect(s.text.toLowerCase()).toContain("announce");
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
    expect(s.text).toContain("720");
    expect(s.needsAttention).toBe(false);
  });

  it("describes 'forever' retention without alarm", () => {
    const s = summariseStorage({ retentionHours: "forever", storeVideoLocally: true, costPerHour: 0.1 });
    expect(s.text.toLowerCase()).toContain("forever");
    expect(s.needsAttention).toBe(false);
  });
});

describe("summariseLimits", () => {
  it("reports no cap plainly rather than as an error", () => {
    const s = summariseLimits({ limitMinutes: "none" });
    expect(s.text.toLowerCase()).toContain("no");
    expect(s.needsAttention).toBe(false);
  });

  it("reports a configured cap", () => {
    const s = summariseLimits({ limitMinutes: 600 });
    expect(s.text).toContain("600");
    expect(s.needsAttention).toBe(false);
  });
});
