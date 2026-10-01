import { describe, expect, it } from "vitest";

import {
  buildSettingsInput,
  parseNumericOrSentinel,
  resolveNotifyChatSeed,
  serializeNumericOrSentinel,
  type TranscriptsSettingsPatch,
} from "./hooks";

/**
 * The sentinel-string round trip (settings design doc §1): videoRetentionHours
 * and monthlyRecordingLimitMinutes cross the wire as String because each is
 * really `number | sentinel`. parseNumericOrSentinel undoes the backend's
 * String(value); serializeNumericOrSentinel redoes it for save(). The two
 * must stay mirror images of each other, or the page shows NaN or the wrong
 * control state for these two fields.
 */
describe("parseNumericOrSentinel", () => {
  it("parses a numeric string into a number", () => {
    expect(parseNumericOrSentinel("720", "forever")).toBe(720);
  });

  it("leaves the retention sentinel as a string", () => {
    expect(parseNumericOrSentinel("forever", "forever")).toBe("forever");
  });

  it("leaves the recording-limit sentinel as a string", () => {
    expect(parseNumericOrSentinel("none", "none")).toBe("none");
  });
});

describe("serializeNumericOrSentinel", () => {
  it("serializes a number to its decimal string", () => {
    expect(serializeNumericOrSentinel(720)).toBe("720");
  });

  it("passes a sentinel string through verbatim", () => {
    expect(serializeNumericOrSentinel("forever")).toBe("forever");
    expect(serializeNumericOrSentinel("none")).toBe("none");
  });

  it("passes null through untouched (an explicit clear)", () => {
    expect(serializeNumericOrSentinel(null)).toBeNull();
  });

  it("passes undefined through untouched (an omitted field)", () => {
    expect(serializeNumericOrSentinel(undefined)).toBeUndefined();
  });
});

describe("sentinel round trip", () => {
  it("number -> string -> number survives for videoRetentionHours", () => {
    const wire = serializeNumericOrSentinel(720) as string;
    expect(wire).toBe("720");
    expect(parseNumericOrSentinel(wire, "forever")).toBe(720);
  });

  it("'forever' -> 'forever' -> 'forever' survives for videoRetentionHours", () => {
    const parsed = parseNumericOrSentinel("forever", "forever");
    expect(serializeNumericOrSentinel(parsed)).toBe("forever");
  });

  it("number -> string -> number survives for monthlyRecordingLimitMinutes", () => {
    const wire = serializeNumericOrSentinel(60) as string;
    expect(wire).toBe("60");
    expect(parseNumericOrSentinel(wire, "none")).toBe(60);
  });

  it("'none' -> 'none' -> 'none' survives for monthlyRecordingLimitMinutes", () => {
    const parsed = parseNumericOrSentinel("none", "none");
    expect(serializeNumericOrSentinel(parsed)).toBe("none");
  });
});

/**
 * The omitted-vs-null merge-patch rule (settings design doc §1, §6): a field
 * absent from the patch must stay absent from the mutation input ("leave
 * alone"); an explicit `null` must survive as `null` ("clear to env/code").
 * Mirrors the backend's parseSettingsInput (transcripts-settings-input.ts)
 * in reverse.
 */
describe("buildSettingsInput", () => {
  it("produces an empty object for an empty patch, not nine undefined keys", () => {
    const input = buildSettingsInput({});
    expect(input).toEqual({});
    expect(Object.keys(input)).toHaveLength(0);
  });

  it("includes exactly the one field a patch touches", () => {
    const input = buildSettingsInput({ botName: "IMP Notetaker" });
    expect(input).toEqual({ botName: "IMP Notetaker" });
    expect(Object.keys(input)).toEqual(["botName"]);
  });

  it("keeps an explicit null rather than dropping it", () => {
    const input = buildSettingsInput({ botName: null });
    expect("botName" in input).toBe(true);
    expect(input.botName).toBeNull();
  });

  it("keeps an explicit undefined value distinguishable from an absent key", () => {
    const patch = { botName: undefined } as TranscriptsSettingsPatch;
    const withKey = buildSettingsInput(patch);
    expect("botName" in withKey).toBe(true);
    expect(withKey.botName).toBeUndefined();

    const withoutKey = buildSettingsInput({});
    expect("botName" in withoutKey).toBe(false);
  });

  it("stringifies videoRetentionHours through serializeNumericOrSentinel", () => {
    expect(buildSettingsInput({ videoRetentionHours: 720 })).toEqual({
      videoRetentionHours: "720",
    });
    expect(buildSettingsInput({ videoRetentionHours: "forever" })).toEqual({
      videoRetentionHours: "forever",
    });
    expect(buildSettingsInput({ videoRetentionHours: null })).toEqual({
      videoRetentionHours: null,
    });
  });

  it("stringifies monthlyRecordingLimitMinutes through serializeNumericOrSentinel", () => {
    expect(buildSettingsInput({ monthlyRecordingLimitMinutes: 60 })).toEqual({
      monthlyRecordingLimitMinutes: "60",
    });
    expect(buildSettingsInput({ monthlyRecordingLimitMinutes: "none" })).toEqual({
      monthlyRecordingLimitMinutes: "none",
    });
    expect(buildSettingsInput({ monthlyRecordingLimitMinutes: null })).toEqual({
      monthlyRecordingLimitMinutes: null,
    });
  });

  it("never lets one section's patch touch another section's fields", () => {
    const input = buildSettingsInput({ notifyChat: true });
    expect(Object.keys(input)).toEqual(["notifyChat"]);
    expect("botName" in input).toBe(false);
    expect("videoRetentionHours" in input).toBe(false);
  });
});

/**
 * Final fix wave, Fix 3: the meeting composer's notifyChat seed must preserve
 * the 2026-09-22 default-ON decision for a deployment that has configured
 * nothing, rather than adopting resolveTranscriptsSettings's unrelated
 * backward-compatibility fallback (`false`, for API callers that bypass this
 * composer). Only an explicit admin save (`source: "database"`) may turn it
 * off.
 */
describe("resolveNotifyChatSeed", () => {
  it("is undefined while the settings round trip hasn't resolved yet", () => {
    expect(resolveNotifyChatSeed(undefined)).toBeUndefined();
  });

  it("defaults ON when nothing is configured (source: code)", () => {
    expect(resolveNotifyChatSeed({ value: false, source: "code" })).toBe(true);
  });

  it("defaults ON when resolved from env", () => {
    expect(resolveNotifyChatSeed({ value: false, source: "env" })).toBe(true);
  });

  it("honors an admin's explicit true", () => {
    expect(resolveNotifyChatSeed({ value: true, source: "database" })).toBe(true);
  });

  it("honors an admin's explicit false", () => {
    expect(resolveNotifyChatSeed({ value: false, source: "database" })).toBe(false);
  });

  it("falls back to true for a stored null (defensive, should not occur)", () => {
    expect(resolveNotifyChatSeed({ value: null, source: "database" })).toBe(true);
  });
});
