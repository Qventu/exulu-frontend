"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigContext } from "@/components/shell/config-context";
import { OtpStep } from "@/app/(authentication)/login/components/otp-step";

type Step = "identify" | "verify";
type Tab = "signIn" | "register";

export function PublicAuth({
  agentName,
  destination,
}: {
  agentName: string;
  destination: string;
}) {
  const t = useTranslations("publicAgents.auth");
  const router = useRouter();
  const configContext = React.useContext(ConfigContext);

  const isOtp = configContext?.auth_mode === "otp";
  const otpAvailable = !!configContext?.public_auth?.otp_available;

  const [step, setStep] = React.useState<Step>("identify");
  const [tab, setTab] = React.useState<Tab>("signIn");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function ensureUser(emailArg: string, withPassword: boolean): Promise<boolean> {
    const res = await fetch("/api/public-auth/ensure-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withPassword ? { email: emailArg, password } : { email: emailArg },
      ),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.detail ?? t("genericError"));
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setError(null);
    setSubmitting(true);
    try {
      if (isOtp) {
        // OTP mode: registration and login are one flow (spec §4.2).
        if (!(await ensureUser(normalizedEmail, false))) return;
        const res = await signIn("email", { email: normalizedEmail, redirect: false });
        if (res?.error) {
          setError(t("genericError"));
          return;
        }
        setStep("verify");
        return;
      }
      if (tab === "register") {
        // Password mode registration: create, then verify by OTP code.
        if (!(await ensureUser(normalizedEmail, true))) return;
        const res = await signIn("email", { email: normalizedEmail, redirect: false });
        if (res?.error) {
          setError(t("genericError"));
          return;
        }
        setStep("verify");
        return;
      }
      // Password mode sign-in.
      const res = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push(destination);
    } catch (err) {
      console.error(err);
      setError(t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "verify") {
    return (
      <OtpStep
        email={email}
        destination={destination}
        onChangeEmail={() => setStep("identify")}
      />
    );
  }

  const showRegisterTab = !isOtp && otpAvailable;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {tab === "register" ? t("registerTitle") : t("title", { agent: agentName })}
        </h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Label htmlFor="public-auth-email">{t("email")}</Label>
        <Input
          id="public-auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {!isOtp && (
        <div className="space-y-2">
          <Label htmlFor="public-auth-password">{t("password")}</Label>
          <Input
            id="public-auth-password"
            type="password"
            autoComplete={tab === "register" ? "new-password" : "current-password"}
            required
            minLength={tab === "register" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tab === "register" && (
            <p className="text-xs text-muted-foreground">{t("passwordMin")}</p>
          )}
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {isOtp ? t("continue") : tab === "register" ? t("register") : t("signIn")}
      </Button>

      {showRegisterTab && (
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            setError(null);
            setTab(tab === "register" ? "signIn" : "register");
          }}
        >
          {tab === "register" ? t("switchToSignIn") : t("switchToRegister")}
        </button>
      )}
      {!isOtp && !otpAvailable && (
        <p className="text-xs text-muted-foreground">{t("registrationUnavailable")}</p>
      )}
    </form>
  );
}
