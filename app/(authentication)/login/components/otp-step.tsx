"use client";

/**
 * OtpStep — the first-class code-entry step (design/pages/auth.md §3 "OTP
 * code step", ladder #22-#25).
 *
 * - Heading says a code was actually sent, to whom, and that it expires in
 *   3 minutes (fixes U5; the provider's 3-minute maxAge finally surfaces).
 * - Six-slot InputOTP: auto-focused, `autocomplete="one-time-code"` (mobile
 *   code suggestions, U7), labeled via aria-label + aria-describedby (U14);
 *   auto-submit at 6 digits kept, manual submit kept for SR/keyboard users.
 * - Verification reuses the exact email-callback GET (ladder #25 — backend
 *   contract untouched). Failure detection no longer depends on
 *   `includes('/')` (U3): the fetch's final URL is a failure iff it is a
 *   NextAuth error surface (`/api/auth/error` or any `?error=` param) —
 *   robust whether or not `pages.error` is configured. Success pushes the
 *   preserved `?destination` deep link (#4).
 * - A failed code shows the inline destructive alert IN this step, clears
 *   the slots, re-enables the button and refocuses — never a URL round-trip,
 *   never a stuck spinner (`submitting` resets on every path; fixes U2).
 * - Recovery paths added (U2): "Resend code" (re-invokes signIn("email"),
 *   30 s client-enforced cooldown with countdown) and "Use a different
 *   email" (back to step 1, email preserved).
 */

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { AuthErrorAlert } from "./auth-error-alert";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export interface OtpStepProps {
  /** The normalized (trimmed + lowercased) email the code was sent to. */
  email: string;
  /** The decoded `?destination` deep link to land on after success (#4). */
  destination: string;
  /** Back to the identify step — email preserved by the parent. */
  onChangeEmail: () => void;
}

export function OtpStep({ email, destination, onChangeEmail }: OtpStepProps) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // A code was just issued when this step mounts — cooldown starts hot.
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SECONDS);

  const formRef = React.useRef<HTMLFormElement>(null);
  const otpRef = React.useRef<React.ElementRef<typeof InputOTP>>(null);
  const subtitleId = React.useId();

  // Plain 1 s tick for the resend countdown (no animation budget spent).
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(
      () => setCooldown((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-submit when all six digits are present (ladder #23).
  React.useEffect(() => {
    if (code.length === CODE_LENGTH && !submitting) {
      formRef.current?.requestSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || code.length !== CODE_LENGTH) return;
    setSubmitting(true);
    setError(null);

    try {
      // Same endpoint, same semantics as before (ladder #25): NextAuth's
      // email-callback GET sets the session cookie and redirects.
      const url =
        `/api/auth/callback/email` +
        `?email=${encodeURIComponent(email)}` +
        `&token=${encodeURIComponent(code)}` +
        `&callbackUrl=${encodeURIComponent(destination)}`;
      const response = await fetch(url);

      // Failure = the redirect chain ended on a NextAuth error surface
      // (stock `/api/auth/error` today, `/login?error=` once pages.error is
      // configured). Anything else means the session was established.
      const finalUrl = new URL(response.url, window.location.origin);
      const failed =
        !response.ok ||
        finalUrl.pathname.startsWith("/api/auth/error") ||
        finalUrl.searchParams.has("error");

      if (failed) {
        setError("Verification");
        setCode("");
        setSubmitting(false);
        otpRef.current?.focus();
        return;
      }

      // Success: land on the preserved deep link (#4) — the server decides
      // any onward routing ("/" → chat or Home).
      router.push(destination);
    } catch {
      setError("Verification");
      setCode("");
      setSubmitting(false);
      otpRef.current?.focus();
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await signIn("email", { email, redirect: false });
      if (res?.error) {
        setError(res.error);
      } else {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success(t("otp.resent"));
      }
    } catch {
      setError("EmailSignin");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("otp.title")}
        </h1>
        <p id={subtitleId} className="text-sm text-muted-foreground">
          {t.rich("otp.subtitle", {
            email,
            strong: (chunks) => (
              <strong className="font-medium text-foreground">{chunks}</strong>
            ),
          })}
        </p>
      </div>

      <AuthErrorAlert error={error} />

      <form ref={formRef} onSubmit={handleVerify} className="grid gap-4">
        <InputOTP
          ref={otpRef}
          maxLength={CODE_LENGTH}
          value={code}
          onChange={setCode}
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          disabled={submitting}
          aria-label={t("otp.codeLabel")}
          aria-describedby={subtitleId}
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="size-11 text-base md:size-10 md:text-sm"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {/* Manual submit stays for SR/keyboard users (ladder #23). Label
            remains visible while pending (U13). */}
        <Button
          type="submit"
          disabled={submitting || code.length !== CODE_LENGTH}
          aria-busy={submitting}
          className="h-11 w-full md:h-10"
        >
          {submitting ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          ) : null}
          {t("otp.submit")}
        </Button>
      </form>

      {/* The recovery paths U2 was missing. */}
      <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={cooldown > 0 || resending || submitting}
          aria-busy={resending}
          className="h-11 text-muted-foreground md:h-9"
        >
          {resending ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          ) : null}
          {cooldown > 0 ? (
            <span className="tabular-nums">
              {t("otp.resendCooldown", { seconds: cooldown })}
            </span>
          ) : (
            t("otp.resend")
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onChangeEmail}
          disabled={submitting}
          className="h-11 text-muted-foreground md:h-9"
        >
          {t("otp.changeEmail")}
        </Button>
      </div>
    </div>
  );
}
