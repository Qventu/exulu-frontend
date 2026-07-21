"use client";

/**
 * EmailIntakeView — the /configuration/email surface (email-routines design
 * §7.5): provider (Mailgun EU, fixed for v1), inbound domain, WRITE-ONLY
 * signing key, global enable switch, webhook URL with copy button, the §4.1
 * setup checklist (incl. the explicit "message retention = 0" step) and the
 * last-webhook-received timestamp as the setup-verification signal.
 *
 * The signing key is never returned by the API (has_signing_key only) — the
 * input stays empty; a non-empty value on save REPLACES the stored key
 * (rotation = overwrite, design §3.5).
 */

import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { CopyField } from "@/components/primitives/copy-field";
import { FormSection } from "@/components/primitives/form-section";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  EMAIL_INBOUND_CONFIG,
  UPDATE_EMAIL_INBOUND_CONFIG,
  type EmailInboundConfig,
} from "@/lib/email-inbound/queries";

const CHECKLIST_STEPS = [
  "step1",
  "step2",
  "step3",
  "step4",
  "step5",
  "step6",
] as const;

export function EmailIntakeView() {
  const t = useTranslations("configuration.emailIntake");
  const tNav = useTranslations("navigation");

  const { data, loading, refetch } = useQuery<{
    emailInboundConfig?: EmailInboundConfig | null;
  }>(EMAIL_INBOUND_CONFIG, {
    fetchPolicy: "cache-and-network",
  });

  const config = data?.emailInboundConfig ?? null;

  return (
    <PageShell variant="narrow">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumb={{ label: tNav("configuration"), href: "/configuration" }}
      />
      {loading && data === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <EmailIntakeForm config={config} onSaved={refetch} />
      )}
    </PageShell>
  );
}

function EmailIntakeForm({
  config,
  onSaved,
}: {
  config: EmailInboundConfig | null;
  onSaved: () => Promise<unknown>;
}) {
  const t = useTranslations("configuration.emailIntake");

  const [enabled, setEnabled] = React.useState(config?.enabled === true);
  const [domain, setDomain] = React.useState(config?.inbound_domain ?? "");
  const [signingKey, setSigningKey] = React.useState("");
  const [mutate, mutation] = useMutation(UPDATE_EMAIL_INBOUND_CONFIG);

  const dirty =
    enabled !== (config?.enabled === true) ||
    domain.trim() !== (config?.inbound_domain ?? "") ||
    signingKey.trim() !== "";

  const handleSave = async () => {
    try {
      await mutate({
        variables: {
          provider: "mailgun-eu",
          inbound_domain: domain.trim(),
          enabled,
          ...(signingKey.trim() !== ""
            ? { signing_key: signingKey.trim() }
            : {}),
        },
      });
      toast.success(t("toast.saved"));
      setSigningKey("");
      await onSaved();
    } catch (err) {
      toast.error(t("toast.saveFailed"), {
        description: (err as Error).message,
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t("provider")} description={t("providerMailgunEu")}>
        <div className="flex items-center gap-3">
          <Switch
            id="email-intake-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={mutation.loading}
          />
          <Label htmlFor="email-intake-enabled">{t("enabled")}</Label>
        </div>
        <div className="flex max-w-md flex-col gap-1">
          <Label htmlFor="email-intake-domain">{t("domainLabel")}</Label>
          <Input
            id="email-intake-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t("domainPlaceholder")}
            className="font-mono"
            disabled={mutation.loading}
          />
        </div>
        <div className="flex max-w-md flex-col gap-1">
          <Label htmlFor="email-intake-signing-key">
            {t("signingKeyLabel")}
          </Label>
          <Input
            id="email-intake-signing-key"
            type="password"
            autoComplete="off"
            value={signingKey}
            onChange={(e) => setSigningKey(e.target.value)}
            placeholder={
              config?.has_signing_key
                ? t("signingKeyStored")
                : t("signingKeyPlaceholder")
            }
            disabled={mutation.loading}
          />
        </div>
        <div>
          <Button onClick={handleSave} disabled={!dirty || mutation.loading}>
            {mutation.loading ? t("saving") : t("save")}
          </Button>
        </div>
      </FormSection>

      <Separator />

      <FormSection
        title={t("webhookUrlLabel")}
        description={t("webhookUrlHint")}
      >
        {config?.webhook_url ? (
          <CopyField value={config.webhook_url} label={t("webhookUrlLabel")} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("webhookUrlPending")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {t("lastWebhookLabel")}{" "}
          {config?.last_webhook_at ? (
            <RelativeTime date={config.last_webhook_at} />
          ) : (
            t("lastWebhookNever")
          )}
        </p>
      </FormSection>

      <Separator />

      <FormSection title={t("checklistTitle")}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {CHECKLIST_STEPS.map((step) => (
            <li key={step}>{t(`checklist.${step}`)}</li>
          ))}
        </ol>
      </FormSection>
    </div>
  );
}
