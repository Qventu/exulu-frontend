"use client";

/**
 * /login — the calm, brand-true front door (design/pages/auth.md §3).
 * Primary persona P1 (the flow is identical for all personas — designed for
 * the least technical visitor). #1 job: get past this screen and into work
 * in under ten seconds, without thinking.
 *
 * Rewritten as an `identify → verify` state machine (ladder #19):
 * - Mode-adaptive form (#7): AUTH_MODE "otp" → email + "Email me a code";
 *   anything else → email + password + "Sign in". Google appears below an
 *   "or" separator only when configured (#10/#20, "Continue with Google" —
 *   the "Sign up" mislabel dies, U10).
 * - Errors render in place via AuthErrorAlert — `?error=` redirects from
 *   NextAuth seed the same state, no URL round-trips on retry (U1/U9).
 * - `submitting` resets on every failure path (U2); Google has its own
 *   pending state (U10) with a visible spinner on the outline background.
 * - Email normalized (trim + lowercase) ONCE on submit and reused everywhere
 *   (U18); autocomplete + autoFocus make most sign-ins zero-typing (U7).
 * - The `?destination` deep link survives all three methods and the OTP
 *   detour (#4); the dead "/dashboard" fallbacks are gone (U19).
 * - Philosophy §9 (security you can feel): the EU-residency / no-training
 *   reassurance sits quietly at the exact moment of disclosure — beside the
 *   credentials form, not as wallpaper.
 * - The single purple element per state is the primary submit button.
 *
 * Future provider slot (#13): "Sign in with Microsoft Teams" remains a
 * dormant capability — when it lands it renders as another outline
 * "Continue with…" button in the provider cluster below the separator,
 * exactly like Google. (The inert commented button that used to live here
 * is documented by this note instead of dead JSX.)
 */

import { Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { ConfigContext } from "@/components/shell/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import google from "../../../public/assets/google.svg";
import { AuthErrorAlert } from "./components/auth-error-alert";
import { OtpStep } from "./components/otp-step";

type Step = "identify" | "verify";

export default function Login() {
  const t = useTranslations("auth");
  const configContext = React.useContext(ConfigContext);
  const router = useRouter();
  const searchParams = useSearchParams();

  const authMode: "otp" | "password" =
    configContext?.auth_mode === "otp" ? "otp" : "password";
  const isOtp = authMode === "otp";

  // Deep-link preservation (#4): default "/" — the server routes onward
  // (P1-only → /chat, elevated → Home). decodeURIComponent kept for parity
  // with the historical contract; raw values pass through unharmed.
  const rawDestination = searchParams.get("destination");
  const destination = React.useMemo(() => {
    if (!rawDestination) return "/";
    try {
      return decodeURIComponent(rawDestination);
    } catch {
      return rawDestination;
    }
  }, [rawDestination]);

  const [step, setStep] = React.useState<Step>("identify");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [googleSubmitting, setGoogleSubmitting] = React.useState(false);
  // Seeded from ?error= (NextAuth full-redirect failures land here because
  // pages.signIn = /login); afterwards state-driven — no replace() loops.
  const [error, setError] = React.useState<string | null>(
    searchParams.get("error"),
  );

  const urlError = searchParams.get("error");
  React.useEffect(() => {
    if (urlError) setError(urlError);
  }, [urlError]);

  const pending = submitting || googleSubmitting;

  async function handleIdentify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    // Normalize once, reuse everywhere (U18).
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setError(null);
    setSubmitting(true);

    try {
      // Exact NextAuth call signatures preserved (auth.md §4 risk note).
      const res = await signIn(isOtp ? "email" : "credentials", {
        email: normalizedEmail,
        password: !isOtp ? password : null,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }

      if (isOtp) {
        // Advance to the code step in place (L2) — the flow, not a navigation.
        setStep("verify");
        setSubmitting(false);
        return;
      }

      router.push(destination);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Default");
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (pending) return;
    setError(null);
    setGoogleSubmitting(true);
    try {
      // Full redirect; pending state holds until the browser navigates (U10).
      await signIn("google", { callbackUrl: destination });
    } catch (err: unknown) {
      console.error(err);
      setError("OAuthSignin");
      setGoogleSubmitting(false);
    }
  }

  if (step === "verify") {
    return (
      // Step transition: 300 ms fade + 8 px rise — explains the flow advanced,
      // not navigated (auth.md §3 Motion; reduced motion gets an instant swap).
      <div
        key="verify"
        className="duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      >
        <OtpStep
          email={email}
          destination={destination}
          onChangeEmail={() => {
            // Back to step 1, email preserved (U2 recovery path).
            setError(null);
            setStep("identify");
          }}
        />
      </div>
    );
  }

  return (
    <div
      key="identify"
      className="flex flex-col gap-6 duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      {/* Heading: on-scale type (text-2xl, fixes the off-scale text-3xl);
          subline adapts to the configured auth mode (#7/#14). */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("signIn.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isOtp ? t("signIn.subtitleOtp") : t("signIn.subtitlePassword")}
        </p>
      </div>

      <AuthErrorAlert error={error} />

      <form onSubmit={handleIdentify} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("signIn.emailLabel")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            inputMode="email"
            placeholder={t("signIn.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
            className="h-11 text-base md:h-10 md:text-sm"
          />
        </div>

        {!isOtp ? (
          <div className="grid gap-2">
            <Label htmlFor="password">{t("signIn.passwordLabel")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={pending}
              className="h-11 text-base md:h-10 md:text-sm"
            />
          </div>
        ) : null}

        {/* THE primary action — the only purple on the screen. Label stays
            visible while pending (U13). */}
        <Button
          type="submit"
          disabled={pending}
          aria-busy={submitting}
          className="h-11 w-full md:h-10"
        >
          {submitting ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          ) : null}
          {isOtp ? t("signIn.submitOtp") : t("signIn.submitPassword")}
        </Button>
      </form>

      {configContext?.google_client_id ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("signIn.or")}
            </span>
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={pending}
            aria-busy={googleSubmitting}
            onClick={handleGoogleSignIn}
            className="h-11 w-full md:h-10"
          >
            {googleSubmitting ? (
              // Token-colored spinner — visible on the outline background (U10).
              <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
            ) : (
              <Image
                src={google}
                alt=""
                aria-hidden="true"
                className="mr-2 size-4"
              />
            )}
            {t("signIn.continueWithGoogle")}
          </Button>
        </div>
      ) : null}

      {/* Philosophy §9: quiet reassurance at the moment of disclosure —
          a single muted line, not a banner. */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{t("signIn.trustNote")}</p>
      </div>

      {/* Single-sentence footer line (fixes U16's dead-end line break). */}
      <p className="text-center text-sm text-muted-foreground">
        {t("signIn.noAccount")}
      </p>
    </div>
  );
}
