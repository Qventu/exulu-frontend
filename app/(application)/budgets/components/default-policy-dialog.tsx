"use client";

/**
 * L3 dialog for the platform-wide default per-user budget + the
 * "Show budget in chat" visibility toggle (budgets.md items 7–13).
 *
 * Lifted OUT of the legacy tab-scoped nested card so it is reachable from
 * every page state — opened by `<DefaultPolicyChip>` in the PageHeader.
 * Two FormSections: "Default per-user budget" and "Visibility". Save
 * validates positive finite amount when the global default is enabled
 * (identical rule to the legacy page handler).
 */

import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { FormSection } from "@/components/primitives/form-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { BudgetSettings } from "@/lib/api/budgets";
import { BUDGETS_AUDIT_TRAIL_SUPPORTED } from "@/lib/budget-supported";
import { BUDGET_DURATIONS, type BudgetDuration } from "@/lib/budget";

export interface DefaultPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: BudgetSettings | null;
  loadError: Error | null;
  onRetryLoad: () => void;
  onSave: (next: BudgetSettings) => Promise<void>;
}

export function DefaultPolicyDialog({
  open,
  onOpenChange,
  settings,
  loadError,
  onRetryLoad,
  onSave,
}: DefaultPolicyDialogProps) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");

  const [enabled, setEnabled] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [duration, setDuration] = React.useState<BudgetDuration>("30d");
  const [showInChat, setShowInChat] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Hydrate from cached settings every time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setEnabled(settings?.global_user_budget.enabled ?? false);
    setAmount(
      settings?.global_user_budget.max_budget
        ? String(settings.global_user_budget.max_budget)
        : "",
    );
    setDuration(
      (settings?.global_user_budget.budget_duration as BudgetDuration) || "30d",
    );
    setShowInChat(settings?.show_user_budget_in_chat ?? false);
  }, [open, settings]);

  const handleSave = async () => {
    const numeric = Number(amount);
    if (enabled && (!Number.isFinite(numeric) || numeric <= 0)) {
      toast.error(t("policy.invalidAmountTitle"), {
        description: t("policy.invalidAmountDescription"),
      });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        global_user_budget: {
          enabled,
          max_budget: Number.isFinite(numeric) ? numeric : 0,
          budget_duration: duration,
        },
        show_user_budget_in_chat: showInChat,
      });
      toast.success(t("policy.savedTitle"));
      onOpenChange(false);
    } catch (err) {
      toast.error(t("policy.saveFailedTitle"), {
        description: err instanceof Error ? err.message : tCommon("unknownError"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("policy.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("policy.dialogDescription")}</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <span className="min-w-0 break-words">{t("settings.loadError")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryLoad}
              disabled={saving}
            >
              {t("settings.retry")}
            </Button>
          </div>
        ) : null}

        <div className="space-y-6">
          <FormSection
            title={t("policy.sectionDefault")}
            description={t("policy.sectionDefaultDescription")}
          >
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="policy-enabled" className="font-normal">
                {t("policy.enableLabel")}
              </Label>
              <Switch
                id="policy-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-amount">{t("policy.amountLabel")}</Label>
              <Input
                id="policy-amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder={t("policy.amountPlaceholder")}
                value={amount}
                disabled={saving || !enabled}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-duration">{t("policy.resetLabel")}</Label>
              <Select
                value={duration}
                onValueChange={(v) => setDuration(v as BudgetDuration)}
                disabled={saving || !enabled}
              >
                <SelectTrigger id="policy-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {t(`policy.duration.${d.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection
            title={t("policy.sectionVisibility")}
            description={t("policy.sectionVisibilityDescription")}
          >
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="policy-show-in-chat" className="font-normal">
                {t("policy.showInChatLabel")}
              </Label>
              <Switch
                id="policy-show-in-chat"
                checked={showInChat}
                onCheckedChange={setShowInChat}
                disabled={saving}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("policy.showInChatHelper")}
            </p>
          </FormSection>

          {/*
           * Audit-trail acknowledgement (audit criterion 6). Backend doesn't
           * yet expose `updated_at` / `updated_by` for budget changes — see
           * BUDGETS_AUDIT_TRAIL_SUPPORTED in lib/budget-supported.ts. We
           * surface the gap honestly rather than silently omit it; when the
           * flag flips true, replace this line with a quiet
           * "Last changed {date} by {actor}" affordance from the new fields.
           */}
          {BUDGETS_AUDIT_TRAIL_SUPPORTED ? null : (
            <p className="text-xs text-muted-foreground" role="note">
              {t("policy.auditUnavailable")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {t("policy.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
