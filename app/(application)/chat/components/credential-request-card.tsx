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

import { motion, useReducedMotion } from "framer-motion";
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
  markCredentialSubmitted,
  readCredentialSubmitted,
  type CredentialRequestPayload,
  type OauthRequestPayload,
  type SubmitOutcome,
} from "./credential-request-data";

/** Compact success row — the QuestionAsk collapsed-state pattern. The form
 *  collapses into this with a brief settle animation (reduced-motion aware). */
function ConnectedRow({ provider }: { provider: string }) {
  const t = useTranslations("chat");
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2"
    >
      <motion.span
        initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.2, ease: "easeOut" }}
        className="flex shrink-0"
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
      </motion.span>
      <span className="text-sm">{t("credentials.connected", { provider })}</span>
    </motion.div>
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
  /** Stable id of the requesting tool call — keys the durable submitted state. */
  toolCallId: string;
  payload: CredentialRequestPayload;
  /** Fires once after a confirmed 200 {ok:true} — the caller sends the resume message. */
  onSubmitted: (provider: string) => void;
}

export function CredentialRequestCard({
  toolCallId,
  payload,
  onSubmitted,
}: CredentialRequestCardProps) {
  const t = useTranslations("chat");
  const config = React.useContext(ConfigContext);

  // Seeded from localStorage: survives the card remounting mid-stream and
  // page refreshes (the historical part keeps its credentialRequest payload,
  // so without this a stale form would re-render over an expired nonce).
  const [submitted, setSubmitted] = React.useState(() =>
    readCredentialSubmitted(toolCallId),
  );
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
        markCredentialSubmitted(toolCallId);
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
  /** Stable id of the requesting tool call — keys the durable done state. */
  toolCallId: string;
  payload: OauthRequestPayload;
  /** Humanized tool/provider label for the title. */
  providerLabel: string;
  onSubmitted: (provider: string) => void;
}

export function OauthConnectCard({
  toolCallId,
  payload,
  providerLabel,
  onSubmitted,
}: OauthConnectCardProps) {
  const t = useTranslations("chat");
  const [done, setDone] = React.useState(() => readCredentialSubmitted(toolCallId));

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
              markCredentialSubmitted(toolCallId);
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
