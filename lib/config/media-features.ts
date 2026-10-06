/**
 * Whether the composer's microphone and read-aloud can work, derived from env.
 *
 * Shared because the authenticated layout and the public-agents layout each
 * built their own config object and drifted: the public one never carried
 * `transcription`, so `configContext?.transcription?.enabled` was undefined on
 * every public page and the microphone silently disappeared for guests. `tts`
 * was missing for the same reason.
 *
 * Deliberately only these two fields. The public config is smaller than the
 * authenticated one on purpose — no feedback backend, no Google client id —
 * so sharing the whole object would widen what a public page exposes. These
 * two are pure feature availability and safe to state publicly.
 */
export function mediaFeatureConfig() {
  const viaLiteLLM = process.env.EXULU_USE_LITELLM === "true";
  const isSet = (v: string | undefined): v is string =>
    typeof v === "string" && v !== "";
  return {
    transcription: { enabled: isSet(process.env.TRANSCRIPTION_MODEL) && viaLiteLLM },
    tts: { enabled: isSet(process.env.TTS_MODEL) && viaLiteLLM },
  };
}
