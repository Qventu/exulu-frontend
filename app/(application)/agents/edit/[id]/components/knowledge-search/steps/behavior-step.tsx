"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { RerankerSelector } from "@/components/reranker-selector";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { WizardConfig } from "../config-schema";

function NumberField({
  label, hint, value, min, max, onChange,
}: {
  label: string; hint?: string; value: number; min: number; max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Input
        type="number" min={min} max={max} value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

export function BehaviorStep({
  draft, setDraft,
}: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
}) {
  const t = useTranslations("agents");
  const setTuning = (patch: Partial<WizardConfig["tuning"]>) =>
    setDraft((prev) => ({ ...prev, tuning: { ...prev.tuning, ...patch } }));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("editor.knowledge.wizard.behavior.rerankerTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.behavior.rerankerHint")}
        </p>
        <RerankerSelector
          disabled={false}
          value={draft.reranker === "none" ? "" : draft.reranker}
          onSelect={(v: string) => setDraft((prev) => ({ ...prev, reranker: v || "none" }))}
        />
      </div>

      <NumberField
        label={t("editor.knowledge.wizard.behavior.topKLabel")}
        hint={t("editor.knowledge.wizard.behavior.topKHint")}
        value={draft.tuning.topK} min={1} max={50}
        onChange={(n) => setTuning({ topK: Math.max(1, Math.round(n)) })}
      />

      <div className="space-y-1">
        <p className="text-xs font-medium">
          {t("editor.knowledge.wizard.behavior.fallbackLabel", {
            percent: Math.round(draft.tuning.fallbackThreshold * 100),
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("editor.knowledge.wizard.behavior.fallbackHint")}
        </p>
        <Slider
          value={[draft.tuning.fallbackThreshold]}
          min={0} max={1} step={0.01}
          onValueChange={([v]) => setTuning({ fallbackThreshold: v ?? 0.95 })}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.behavior.instructionsTitle")}
        </p>
        <Textarea
          rows={3}
          placeholder={t("editor.knowledge.wizard.behavior.instructionsPlaceholder")}
          value={draft.instructions}
          onChange={(e) => setDraft((prev) => ({ ...prev, instructions: e.target.value }))}
        />
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="py-2 text-sm">
            {t("editor.knowledge.wizard.behavior.advancedTitle")}
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <NumberField
              label={t("editor.knowledge.wizard.behavior.pinBoostLabel")}
              value={draft.tuning.pinBoost} min={0} max={1}
              onChange={(n) => setTuning({ pinBoost: Math.min(1, Math.max(0, n)) })}
            />
            <NumberField
              label={t("editor.knowledge.wizard.behavior.identifierBoostLabel")}
              value={draft.tuning.identifierBoost} min={0} max={1}
              onChange={(n) => setTuning({ identifierBoost: Math.min(1, Math.max(0, n)) })}
            />
            <NumberField
              label={t("editor.knowledge.wizard.behavior.pageWindowLabel")}
              value={draft.tuning.pageWindow} min={0} max={10}
              onChange={(n) => setTuning({ pageWindow: Math.max(0, Math.round(n)) })}
            />
            <NumberField
              label={t("editor.knowledge.wizard.behavior.maxQueriesLabel")}
              value={draft.tuning.maxQueriesPerContext} min={1} max={10}
              onChange={(n) => setTuning({ maxQueriesPerContext: Math.max(1, Math.round(n)) })}
            />
            <div className="space-y-1">
              <p className="text-xs font-medium">
                {t("editor.knowledge.wizard.behavior.utilityModelLabel")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("editor.knowledge.wizard.behavior.utilityModelHint")}
              </p>
              <Input
                value={draft.utilityModel}
                onChange={(e) => setDraft((prev) => ({ ...prev, utilityModel: e.target.value }))}
              />
            </div>
            {(["managedContext", "requirePreselectedContexts", "logging"] as const).map((key) => (
              <div key={key} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">
                    {t(`editor.knowledge.wizard.behavior.flags.${key}.label`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`editor.knowledge.wizard.behavior.flags.${key}.hint`)}
                  </p>
                </div>
                <Switch
                  checked={draft[key]}
                  onCheckedChange={(v) => setDraft((prev) => ({ ...prev, [key]: v }))}
                />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
