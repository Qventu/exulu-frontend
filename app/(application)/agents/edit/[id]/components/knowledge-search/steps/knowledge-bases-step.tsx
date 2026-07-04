"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  selectedKbIds, setKbSelection, KIND_PRESETS,
  type KbKind, type WizardConfig,
} from "../config-schema";

const KINDS: KbKind[] = ["documents", "conversations", "records"];

export function KnowledgeBasesStep({
  draft, setDraft, contexts,
}: {
  draft: WizardConfig;
  setDraft: (updater: (prev: WizardConfig) => WizardConfig) => void;
  contexts: { id: string; name: string; description?: string }[];
}) {
  const t = useTranslations("agents");
  const allIds = contexts.map((c) => c.id);
  const selected = new Set(selectedKbIds(draft, allIds));

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : [...selected].filter((s) => s !== id);
    setDraft((prev) => setKbSelection(prev, allIds, next));
  };

  const updateProfile = (id: string, patch: Partial<WizardConfig["knowledgeBases"][string]>) =>
    setDraft((prev) => ({
      ...prev,
      knowledgeBases: {
        ...prev.knowledgeBases,
        [id]: {
          ...(prev.knowledgeBases[id] ?? {
            enabled: true, kind: "documents" as KbKind, instructions: "", overrides: {},
          }),
          ...patch,
        },
      },
    }));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("editor.knowledge.wizard.sources.intro")}
      </p>
      {contexts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("editor.knowledge.noContexts")}
        </p>
      )}
      {contexts.map((ctx) => {
        const isOn = selected.has(ctx.id);
        const profile = draft.knowledgeBases[ctx.id];
        return (
          <div key={ctx.id} className="space-y-3 rounded-md border p-3">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={isOn}
                onCheckedChange={(v) => toggle(ctx.id, v === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{ctx.name}</span>
                {ctx.description && (
                  <span className="block text-xs text-muted-foreground">{ctx.description}</span>
                )}
              </span>
            </label>
            {isOn && (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium">
                    {t("editor.knowledge.wizard.sources.kindLabel")}
                  </p>
                  <Select
                    value={profile?.kind ?? "documents"}
                    onValueChange={(v) => updateProfile(ctx.id, { kind: v as KbKind })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {t(`editor.knowledge.wizard.sources.kinds.${kind}.label`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      `editor.knowledge.wizard.sources.kinds.${profile?.kind ?? "documents"}.hint`,
                      KIND_PRESETS[profile?.kind ?? "documents"],
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium">
                    {t("editor.knowledge.wizard.sources.instructionsLabel")}
                  </p>
                  <Textarea
                    rows={2}
                    placeholder={t("editor.knowledge.wizard.sources.instructionsPlaceholder")}
                    value={profile?.instructions ?? ""}
                    onChange={(e) => updateProfile(ctx.id, { instructions: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
