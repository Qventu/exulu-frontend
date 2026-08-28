import type { ConfigContextType } from "@/components/shell/config-context";
import type { BackendConfigType } from "@/lib/api/config";

/**
 * The deployment configuration the tour runs against.
 *
 * Both route groups read it, and that is the point. The (application) layout
 * previously passed `{}` in demo mode and the /demo layout mounted no provider
 * at all, so `useContext(ConfigContext)` returned an empty object on one half
 * of the tour and `null` on the other. Neither is what a configured deployment
 * looks like, and the difference showed:
 *
 *   - /evals renders a warning banner — "Background workers are not
 *     configured, runs can't execute" — whenever `workers.enabled` is falsy.
 *     That is chapter 5's screen, the one whose entire job is to argue the
 *     system is trustworthy.
 *   - composer.tsx gates the microphone on `transcription.enabled`, so with no
 *     config there is no dictation button to point at (chapter 7).
 *
 * This describes the deployment being DEMONSTRATED, not the machine serving
 * the demo. There is no Redis behind the tour and no transcription endpoint —
 * but the subject of the tour is a working Newlift deployment, and the banner
 * is an artifact of our own fixture harness rather than anything true about
 * the product. Every value here is a claim about that deployment, so each one
 * is justified below.
 */

const DEMO_BACKEND_CONFIG: BackendConfigType = {
  // TRUE, because Newlift's deployment runs workers: the eval runs and the
  // pipeline timestamps the tour shows are real output from real queues. A
  // false here puts "not configured" on chapter 5.
  //
  // Consequence to keep in mind: this also un-disables the Run buttons on the
  // eval screens, and the mutations behind them are not mapped. The tour never
  // asks a visitor to press one, but that is a guided-path argument, not a
  // guarantee — the same gap as Save on the agent editor.
  workers: { enabled: true, redisHost: "demo" },

  liteLLM: { enabled: false },

  // TRUE, and this is the flag chapter 7 turns on. ALGI genuinely records
  // their meetings with a Recall bot — the twenty-eight recordings in
  // fixtures/chapter-meetings.ts came from it — so a deployment that reports
  // recall as disabled would be describing a different customer.
  //
  // It is also load-bearing rather than cosmetic: nav-config gates the
  // Transcriptions entry on `transcription.enabled || recall.enabled`, and
  // /transcriptions guards its route on the same flag. With both false the
  // sidebar hid the entry AND the URL rendered "You don't have access to this
  // page", which is how chapter 7 first appeared in the browser.
  recall: { enabled: true },
};

export function demoConfig(): ConfigContextType {
  return {
    // Read from the environment rather than hardcoded: file and avatar URLs
    // are built from it, and an empty string yields requests to "/undefined".
    backend: process.env.BACKEND ?? "",
    google_client_id: "",
    // The tour has no sign-in. Route guards read the demo user directly.
    auth_mode: "",

    feedback: {
      enabled: false,
      backend: "",
      featureAgentSlug: "",
      featureAgentId: "",
      bugAgentSlug: "",
      bugAgentId: "",
    },

    // FALSE for now, deliberately. It gates the composer's microphone, and
    // pressing that posts to `${backend}/transcribe`, which nothing in the
    // demo answers — a dead button on the flagship surface is worse than no
    // button. Chapter 7 demonstrates voice input and will have to turn this on
    // together with a scripted transcription response; this is the switch.
    transcription: { enabled: false },
    tts: { enabled: false },

    public_auth: { otp_available: false },

    ...DEMO_BACKEND_CONFIG,
  };
}

export { DEMO_BACKEND_CONFIG };
