"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Switch } from "@/components/ui/switch";

import type { WizardConfig } from "../config-schema";

const FEATURES = ["enabled", "override", "filePrioritization", "queryAugmentation"] as const;

export function MemoryStep({
  draft, setDraft, memoryContextId,
}: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
  memoryContextId: string;
}) {
  const t = useTranslations("agents");

  if (!memoryContextId) {
    return (
      <div className="space-y-2 rounded-md border p-4">
        <p className="text-sm font-medium">
          {t("editor.knowledge.wizard.memory.noMemoryTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("editor.knowledge.wizard.memory.noMemoryHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("editor.knowledge.wizard.memory.intro")}
      </p>
      {FEATURES.map((key) => (
        <div key={key} className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {t(`editor.knowledge.wizard.memory.features.${key}.label`)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`editor.knowledge.wizard.memory.features.${key}.hint`)}
            </p>
          </div>
          <Switch
            checked={draft.memory[key]}
            disabled={key !== "enabled" && !draft.memory.enabled}
            onCheckedChange={(v) =>
              setDraft((prev) => ({ ...prev, memory: { ...prev.memory, [key]: v } }))
            }
          />
        </div>
      ))}
    </div>
  );
}
