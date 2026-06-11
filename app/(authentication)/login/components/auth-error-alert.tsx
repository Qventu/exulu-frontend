"use client";

/**
 * AuthErrorAlert — the inline sign-in failure surface (design/pages/auth.md
 * ladder #15; replaces the old `login/error.tsx` misuse of a reserved
 * filename, U8).
 *
 * - Destructive variant + role="alert" (built into the ui Alert) so screen
 *   readers hear failures (fixes U9/U13-adjacent).
 * - Message map extended to the full NextAuth error-code set the page can
 *   receive — most importantly `CredentialsSignin` ("Incorrect email or
 *   password", fixes U1) and `EmailSignin`; unknown codes fall back to
 *   Default. All copy i18n'd (`auth.errors.*`, fixes U6 + the "sigin" typo).
 * - Presentational: callers pass the error code (from `?error=` or from
 *   in-place state) — no URL round-trips required to render a failure.
 */

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** NextAuth error codes with a dedicated, human message (auth.md #15). */
const KNOWN_ERROR_CODES = [
  "CredentialsSignin",
  "EmailSignin",
  "Verification",
  "Configuration",
  "AccessDenied",
  "OAuthSignin",
  "OAuthCallback",
  "OAuthAccountNotLinked",
  "SessionRequired",
] as const;

type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

function toMessageKey(error: string): KnownErrorCode | "Default" {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(error)
    ? (error as KnownErrorCode)
    : "Default";
}

export interface AuthErrorAlertProps {
  /** A NextAuth error code (e.g. "CredentialsSignin"); renders null when unset. */
  error?: string | null;
}

export function AuthErrorAlert({ error }: AuthErrorAlertProps) {
  const t = useTranslations("auth");

  if (!error) return null;

  return (
    <Alert
      variant="destructive"
      className="duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
    >
      <AlertCircle aria-hidden="true" className="size-4" />
      <AlertTitle>{t("errors.title")}</AlertTitle>
      <AlertDescription>{t(`errors.${toMessageKey(error)}`)}</AlertDescription>
    </Alert>
  );
}
