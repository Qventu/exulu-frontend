"use client";

/**
 * VerificationStep — wizard surface for Claim Check (spec 2026-10-13). Edits
 * six of the eight keys the backend parses (`ee/agentic-retrieval/pipeline/
 * config.ts`, `claimCheckSchema`): enabled, model, fidelity, reRetrieve,
 * thresholds, showToExternalUsers. `completions` and `caps` have no control
 * here — they stay in WizardConfig/config-schema purely so an operator who
 * tuned them through the API does not lose them the moment this step saves.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { WizardConfig } from "../config-schema";

function ThresholdField({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <Input
        type="number" min={0} max={1} step={0.01} value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

export function VerificationStep({
  draft, setDraft,
}: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
}) {
  const t = useTranslations("agents");
  const setClaimCheck = (patch: Partial<WizardConfig["claimCheck"]>) =>
    setDraft((prev) => ({ ...prev, claimCheck: { ...prev.claimCheck, ...patch } }));
  const setThresholds = (patch: Partial<WizardConfig["claimCheck"]["thresholds"]>) =>
    setDraft((prev) => ({
      ...prev,
      claimCheck: { ...prev.claimCheck, thresholds: { ...prev.claimCheck.thresholds, ...patch } },
    }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("editor.knowledge.wizard.verification.claimCheckStepHelp")}
      </p>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium">
            {t("editor.knowledge.wizard.verification.claimCheckEnabled")}
          </p>
        </div>
        <Switch
          checked={draft.claimCheck.enabled}
          onCheckedChange={(v) => setClaimCheck({ enabled: v })}
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium">
          {t("editor.knowledge.wizard.verification.claimCheckModel")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.verification.claimCheckModelHelp")}
        </p>
        <Input
          value={draft.claimCheck.model}
          onChange={(e) => setClaimCheck({ model: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium">
          {t("editor.knowledge.wizard.verification.claimCheckFidelity")}
        </p>
        <Select
          value={draft.claimCheck.fidelity}
          onValueChange={(v) => setClaimCheck({ fidelity: v as "fast" | "paper" })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fast">
              {t("editor.knowledge.wizard.verification.claimCheckFidelityFast")}
            </SelectItem>
            <SelectItem value="paper">
              {t("editor.knowledge.wizard.verification.claimCheckFidelityPaper")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">
          {t("editor.knowledge.wizard.verification.claimCheckThresholds")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ThresholdField
            label={t("editor.knowledge.wizard.verification.claimCheckThresholdWarnLabel")}
            value={draft.claimCheck.thresholds.warn}
            onChange={(n) => setThresholds({ warn: n })}
          />
          <ThresholdField
            label={t("editor.knowledge.wizard.verification.claimCheckThresholdAlertLabel")}
            value={draft.claimCheck.thresholds.alert}
            onChange={(n) => setThresholds({ alert: n })}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium">
            {t("editor.knowledge.wizard.verification.claimCheckReRetrieve")}
          </p>
        </div>
        <Switch
          checked={draft.claimCheck.reRetrieve}
          onCheckedChange={(v) => setClaimCheck({ reRetrieve: v })}
        />
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium">
            {t("editor.knowledge.wizard.verification.claimCheckShowExternal")}
          </p>
        </div>
        <Switch
          checked={draft.claimCheck.showToExternalUsers}
          onCheckedChange={(v) => setClaimCheck({ showToExternalUsers: v })}
        />
      </div>
    </div>
  );
}
