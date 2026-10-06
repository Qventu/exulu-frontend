import { describe, expect, it } from "vitest";

import { mediaFeatureConfig } from "./media-features";

// Restores key by key. Replacing `process.env` wholesale breaks the runner:
// it is a special object, not a plain one.
const KEYS = ["EXULU_USE_LITELLM", "TRANSCRIPTION_MODEL", "TTS_MODEL"] as const;
const withEnv = (env: Record<string, string | undefined>, run: () => void) => {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) {
    if (k in env) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
  }
  try {
    run();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
  }
};

describe("mediaFeatureConfig", () => {
  it("enables both when the model is set and LiteLLM is on", () => {
    withEnv({ EXULU_USE_LITELLM: "true", TRANSCRIPTION_MODEL: "whisper-1", TTS_MODEL: "tts-1" }, () => {
      expect(mediaFeatureConfig()).toEqual({
        transcription: { enabled: true },
        tts: { enabled: true },
      });
    });
  });

  it("needs BOTH the model and LiteLLM", () => {
    withEnv({ EXULU_USE_LITELLM: "false", TRANSCRIPTION_MODEL: "whisper-1", TTS_MODEL: "tts-1" }, () => {
      expect(mediaFeatureConfig().transcription.enabled).toBe(false);
      expect(mediaFeatureConfig().tts.enabled).toBe(false);
    });
    withEnv({ EXULU_USE_LITELLM: "true", TRANSCRIPTION_MODEL: undefined, TTS_MODEL: undefined }, () => {
      expect(mediaFeatureConfig().transcription.enabled).toBe(false);
      expect(mediaFeatureConfig().tts.enabled).toBe(false);
    });
  });

  // An empty string is how an unset variable usually reaches a container.
  it("treats an empty model name as unset", () => {
    withEnv({ EXULU_USE_LITELLM: "true", TRANSCRIPTION_MODEL: "", TTS_MODEL: "" }, () => {
      expect(mediaFeatureConfig().transcription.enabled).toBe(false);
      expect(mediaFeatureConfig().tts.enabled).toBe(false);
    });
  });

  it("decides the two independently", () => {
    withEnv({ EXULU_USE_LITELLM: "true", TRANSCRIPTION_MODEL: "whisper-1", TTS_MODEL: undefined }, () => {
      expect(mediaFeatureConfig()).toEqual({
        transcription: { enabled: true },
        tts: { enabled: false },
      });
    });
  });
});
