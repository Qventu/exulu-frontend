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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import type { WizardConfig } from "../config-schema";

type Thresholds = WizardConfig["claimCheck"]["thresholds"];

/**
 * The next threshold pair for one edited handle, with the `warn <= alert`
 * invariant held.
 *
 * `score.ts` tests `share >= alert` BEFORE `share >= warn`, so an inverted
 * pair makes "warn" unreachable and every flagged answer jumps straight to
 * the red alert shield at a lower share than the admin set — a harsher
 * verdict than they asked for, which is the direction of error this feature
 * must never take. Rather than silently rewriting the handle the admin did
 * not touch, the dragged handle stops at the other one: the thumb visibly
 * refuses to cross, and nothing moves behind the admin's back.
 *
 * Exported for its own test — the invariant is the point of the control, and
 * driving a Radix slider's pointer events under jsdom proves nothing about it.
 */
export function nextThresholds(prev: Thresholds, patch: Partial<Thresholds>): Thresholds {
  if (patch.warn !== undefined) {
    return { ...prev, warn: Math.min(patch.warn, prev.alert) };
  }
  if (patch.alert !== undefined) {
    return { ...prev, alert: Math.max(patch.alert, prev.warn) };
  }
  return prev;
}

/**
 * A threshold, as the share it is. The wizard's sibling control for the same
 * kind of value (`behavior-step.tsx`'s `fallbackThreshold`) is a 0..1 slider
 * labelled in percent, and this follows it rather than inventing a third
 * pattern.
 *
 * A number `Input` was wrong three times over: it accepted any finite value,
 * so an admin who read "Warnschwelle" with no unit and typed `20` for 20%
 * saved a blob the backend's `jsonVal` threw away wholesale — `enabled:
 * false` included, no check ever running, the wizard still showing 20 and
 * "active". Clearing the field produced `Number("") === 0`, in range, so one
 * backspace set `warn: 0` and a 4-of-4-supported answer then rendered the
 * orange warn shield: a false verdict at a glance on a perfect answer. And a
 * number input whose text is `0.` reports `value === ""`, so typing a decimal
 * by hand landed "0.3" as `3`. A slider has none of those states.
 */
function ThresholdSlider({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <Slider
        value={[value]}
        min={0} max={1} step={0.01}
        onValueChange={([v]) => onChange(v ?? 0)}
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
  const setThresholds = (patch: Partial<Thresholds>) =>
    setDraft((prev) => ({
      ...prev,
      claimCheck: { ...prev.claimCheck, thresholds: nextThresholds(prev.claimCheck.thresholds, patch) },
    }));

  return (
    <div className="space-y-4">
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
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.verification.claimCheckThresholdsHint")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ThresholdSlider
            label={t("editor.knowledge.wizard.verification.claimCheckThresholdWarnLabel", {
              percent: Math.round(draft.claimCheck.thresholds.warn * 100),
            })}
            value={draft.claimCheck.thresholds.warn}
            onChange={(n) => setThresholds({ warn: n })}
          />
          <ThresholdSlider
            label={t("editor.knowledge.wizard.verification.claimCheckThresholdAlertLabel", {
              percent: Math.round(draft.claimCheck.thresholds.alert * 100),
            })}
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
