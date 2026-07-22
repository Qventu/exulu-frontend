"use client";

/**
 * In-chat credential form + OAuth connect button (spec — backend repo —
 * docs/superpowers/specs/2026-07-22-tool-credentials-chat-ui-design.md §2).
 * Renders in the makeUntypedToolPart slot (message-column.tsx), sibling of
 * ToolCallApproval. Secrets flow browser → backend only: the submitUrl is
 * origin-validated against config.backend before anything is POSTed
 * (§2.3), values are never toasted/logged, and the collapsed success row
 * follows the QuestionAsk submitted-state pattern (§2.4).
 */

import { CheckCircle2, ExternalLink, KeyRound, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";

import { ConfigContext } from "@/components/shell/config-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken } from "@/lib/api/client";
import { cn } from "@/lib/utils";

import {
  isAllowedSubmitUrl,
  mapSubmitResponse,
  type CredentialRequestPayload,
  type OauthRequestPayload,
  type SubmitOutcome,
} from "./credential-request-data";

/** Compact success row — the QuestionAsk collapsed-state pattern. */
function ConnectedRow({ provider }: { provider: string }) {
  const t = useTranslations("chat");
  return (
    <div
      role="status"
      className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-sm">{t("credentials.connected", { provider })}</span>
    </div>
  );
}

/** Blocked-origin / terminal error row. */
function BlockedRow({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
    >
      <ShieldAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      <span className="text-sm text-destructive">{message}</span>
    </div>
  );
}

/** Public-surface notice (spec §4): never render the form for guests. */
export function CredentialGuestNotice() {
  const t = useTranslations("chat");
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{t("credentials.guestNotice")}</span>
    </div>
  );
}

export interface CredentialRequestCardProps {
  payload: CredentialRequestPayload;
  /** Fires once after a confirmed 200 {ok:true} — the caller sends the resume message. */
  onSubmitted: (provider: string) => void;
}

export function CredentialRequestCard({ payload, onSubmitted }: CredentialRequestCardProps) {
  const t = useTranslations("chat");
  const config = React.useContext(ConfigContext);

  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [outcome, setOutcome] = React.useState<SubmitOutcome | null>(null);

  const defaultValues = React.useMemo(
    () => Object.fromEntries(payload.fields.map((field) => [field.name, ""])),
    [payload.fields],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({ defaultValues });

  if (submitted) return <ConnectedRow provider={payload.provider} />;

  // §2.3: tool results are untrusted input — never POST the JWT or secrets
  // anywhere but the configured backend origin.
  if (!isAllowedSubmitUrl(payload.submitUrl, config?.backend)) {
    return <BlockedRow message={t("credentials.badOrigin")} />;
  }

  if (outcome?.kind === "expired") {
    return <BlockedRow message={t("credentials.expired")} />;
  }

  const doSubmit = async (values: Record<string, string>) => {
    setSubmitting(true);
    setOutcome(null);
    try {
      const token = await getToken();
      if (!token) {
        setOutcome({ kind: "error", message: t("credentials.noSession") });
        return;
      }
      const res = await fetch(payload.submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nonce: payload.nonce, values }),
      });
      const body = await res.json().catch(() => null);
      const mapped = mapSubmitResponse(res.status, body);
      if (mapped.kind === "success") {
        setSubmitted(true);
        onSubmitted(payload.provider);
      } else {
        setOutcome(mapped);
      }
    } catch (err) {
      setOutcome({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-3 border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" aria-hidden="true" />
          {t("credentials.connectTitle", { provider: payload.provider })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("credentials.connectDescription", { provider: payload.provider })}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={handleSubmit(doSubmit)}
          autoComplete="off"
        >
          {payload.fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`cred-${payload.provider}-${field.name}`}>
                {field.label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`cred-${payload.provider}-${field.name}`}
                type={field.type === "password" ? "password" : "text"}
                placeholder={field.placeholder}
                autoComplete="off"
                aria-invalid={Boolean(errors[field.name])}
                {...register(field.name, { required: t("credentials.required") })}
              />
              {field.help ? (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              ) : null}
              {errors[field.name] ? (
                <p className="text-xs text-destructive">{errors[field.name]?.message}</p>
              ) : null}
            </div>
          ))}
          {outcome?.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {outcome.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={submitting} className={cn("h-11 sm:h-9")}>
              {submitting ? t("credentials.submitting") : t("credentials.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export interface OauthConnectCardProps {
  payload: OauthRequestPayload;
  /** Humanized tool/provider label for the title. */
  providerLabel: string;
  onSubmitted: (provider: string) => void;
}

export function OauthConnectCard({ payload, providerLabel, onSubmitted }: OauthConnectCardProps) {
  const t = useTranslations("chat");
  const [done, setDone] = React.useState(false);

  if (done) return <ConnectedRow provider={providerLabel} />;

  return (
    <Card className="mt-3 border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" aria-hidden="true" />
          {t("credentials.connectTitle", { provider: providerLabel })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("credentials.oauthDescription")}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-11 sm:h-9"
            onClick={() => window.open(payload.authorizationUrl, "_blank", "noopener")}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {t("credentials.oauthConnect")}
          </Button>
          <Button
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => {
              setDone(true);
              onSubmitted(providerLabel);
            }}
          >
            {t("credentials.oauthDone")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
