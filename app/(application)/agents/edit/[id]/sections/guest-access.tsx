"use client";

/**
 * Guest access section — item 12 (public-agents).
 *
 * Allows editors to expose an agent publicly at /public/agents/{id}.
 * Three auth modes: public (no sign-in), password (shared secret), regular
 * (email sign-in / OTP). Budget warning surfaces when no max_budget is set.
 */

import { gql, useLazyQuery } from "@apollo/client";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { BudgetBar } from "@/components/budget-bar";
import { BudgetEditor } from "@/components/budget-editor";
import UppyDashboard, { FileDataCard } from "@/components/primitives/file-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ConfigContext } from "@/components/shell/config-context";
import { UserContext } from "@/app/(application)/authenticated";

import type { EditorSectionProps } from "./types";

const GET_AGENT_BUDGET = gql`
  query AgentBudget($id: ID!) {
    agentById(id: $id) {
      id
      budget
    }
  }
`;

export function GuestAccessSection({ agent, editor }: EditorSectionProps) {
  const t = useTranslations("agents");
  const config = React.useContext(ConfigContext);
  const { user } = React.useContext(UserContext);
  const [copied, setCopied] = React.useState(false);
  const [budget, setBudget] = React.useState<any>((agent as any).budget ?? null);
  const [budgetEditing, setBudgetEditing] = React.useState(false);

  const [refetchBudget] = useLazyQuery(GET_AGENT_BUDGET, {
    onCompleted: (d) => setBudget(d?.agentById?.budget ?? null),
  });

  const guest = editor.guest;
  const canEditBudget =
    !!user && (user.super_admin || user.role?.budget_management === "write");
  const smtpMissing = !config?.public_auth?.otp_available;
  const publicLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/public/agents/${agent.id}`
      : `/public/agents/${agent.id}`;

  return (
    <section id="guest-access" className="scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("editor.sections.guestAccess")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("editor.guestAccess.description")}
        </p>
      </div>

      <div className="space-y-6 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="guest-access-toggle">
              {t("editor.guestAccess.enableLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("editor.guestAccess.publicListingWarning")}
            </p>
          </div>
          <Switch
            id="guest-access-toggle"
            checked={guest.enabled}
            onCheckedChange={(enabled) => editor.setGuest({ ...guest, enabled })}
          />
        </div>

        {guest.enabled && (
          <>
            <div className="space-y-2">
              <Label>{t("editor.guestAccess.modeLabel")}</Label>
              <RadioGroup
                value={guest.authMode}
                onValueChange={(authMode) =>
                  editor.setGuest({
                    ...guest,
                    authMode: authMode as typeof guest.authMode,
                  })
                }
                className="gap-3"
              >
                {(
                  [
                    ["public", "modePublic", "modePublicHint"],
                    ["password", "modePassword", "modePasswordHint"],
                    ["regular", "modeLogin", "modeLoginHint"],
                  ] as const
                ).map(([value, labelKey, hintKey]) => (
                  <div key={value} className="flex items-start gap-2">
                    <RadioGroupItem value={value} id={`guest-mode-${value}`} />
                    <div>
                      <Label htmlFor={`guest-mode-${value}`}>
                        {t(`editor.guestAccess.${labelKey}`)}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t(`editor.guestAccess.${hintKey}`)}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {guest.authMode === "password" && (
              <div className="space-y-2">
                <Label htmlFor="guest-password">
                  {t("editor.guestAccess.passwordLabel")}
                </Label>
                <Input
                  id="guest-password"
                  type="password"
                  value={guest.password}
                  placeholder={t("editor.guestAccess.passwordPlaceholder")}
                  onChange={(e) =>
                    editor.setGuest({ ...guest, password: e.target.value })
                  }
                />
                {guest.hasPassword && !guest.password && (
                  <p className="text-xs text-muted-foreground">
                    {t("editor.guestAccess.passwordSetHint")}
                  </p>
                )}
              </div>
            )}

            {guest.authMode === "regular" && smtpMissing && (
              <Alert>
                <AlertDescription>
                  {t("editor.guestAccess.smtpHint")}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>{t("editor.guestAccess.linkLabel")}</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicLink} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(publicLink);
                    setCopied(true);
                    toast.success(t("editor.guestAccess.copied"));
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {t("editor.guestAccess.copy")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("editor.guestAccess.coverLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("editor.guestAccess.coverDescription")}
              </p>
              <FileDataCard s3key={guest.coverImage}>
                <UppyDashboard
                  id="agent-guest-cover"
                  global
                  allowedFileTypes={[".jpg", ".jpeg", ".png", ".webp"]}
                  selectionLimit={1}
                  buttonText=""
                  dependencies={[agent.id]}
                  onConfirm={(keys: string[]) => {
                    if (keys.length > 0)
                      editor.setGuest({ ...guest, coverImage: keys[0] });
                  }}
                />
                {guest.coverImage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => editor.setGuest({ ...guest, coverImage: "" })}
                  >
                    {t("editor.guestAccess.coverRemove")}
                  </Button>
                )}
              </FileDataCard>
            </div>

            <div className="space-y-2">
              <Label>{t("editor.guestAccess.budgetTitle")}</Label>
              {!budget?.max_budget && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t("editor.guestAccess.budgetWarning")}
                  </AlertDescription>
                </Alert>
              )}
              <BudgetBar budget={budget} />
              {canEditBudget ? (
                budgetEditing ? (
                  <BudgetEditor
                    entityType="agent"
                    label={agent.name ?? ""}
                    mode="single"
                    entityId={agent.id}
                    initial={budget}
                    hideCurrentStatus
                    onDone={() => {
                      setBudgetEditing(false);
                      refetchBudget({ variables: { id: agent.id } });
                    }}
                    onCancel={() => setBudgetEditing(false)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBudgetEditing(true)}
                  >
                    {t("editor.guestAccess.budgetEdit")}
                  </Button>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("editor.guestAccess.budgetNoRights")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
