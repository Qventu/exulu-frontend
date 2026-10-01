"use client";

/**
 * Defaults section — the sharing mode new transcripts get and the summary
 * presets seeded into every composer (settings design doc §1, §4). Reuses
 * `PostProcessingPicker` (already in this feature, already the exact
 * {prompt, agent} row editor the composers use) rather than a second preset
 * editor — `SummaryPreset` and `PostProcessingPrompt` are the same shape on
 * purpose.
 *
 * `stalePresets` are already excluded from `settings.summaryPresets.value`
 * server-side (transcripts-settings.ts's `filterLivePresets`) — they are
 * shown here only so an admin knows one was dropped, never editable.
 */
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  PostProcessingPicker,
  postProcessingRowsComplete,
} from "../components/post-processing-picker";
import {
  usePostProcessingOptions,
  type SummaryPreset,
  type TranscriptsSettings,
  type TranscriptsSettingsPatch,
} from "../hooks";
import { FieldSourceNote, ResetToDefaultButton, useSettingsSave } from "./settings-field";

export interface DefaultsSectionProps {
  settings: TranscriptsSettings;
  stalePresets: SummaryPreset[];
  onSave: (patch: TranscriptsSettingsPatch) => Promise<void>;
}

const RIGHTS_MODES = ["private", "users", "roles", "public"] as const;

export function DefaultsSection({ settings, stalePresets, onSave }: DefaultsSectionProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const { prompts, agents } = usePostProcessingOptions();
  const { pendingKey, run } = useSettingsSave(onSave);

  const [presetRows, setPresetRows] = React.useState<SummaryPreset[]>(
    settings.summaryPresets.value,
  );
  // Re-seed only when the resolved value changes under us, not on every
  // render while the admin is mid-edit.
  React.useEffect(() => {
    setPresetRows(settings.summaryPresets.value);
  }, [settings.summaryPresets.value]);

  const presetsDirty =
    JSON.stringify(presetRows) !== JSON.stringify(settings.summaryPresets.value);
  const canSavePresets = presetsDirty && postProcessingRowsComplete(presetRows);

  const handleSavePresets = async () => {
    await run("summaryPresets", { summaryPresets: presetRows });
    toast.success(t("settings.saved"));
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="settings-default-rights">
          {t("settings.defaults.rightsModeLabel")}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={settings.defaultRightsMode.value ?? "private"}
            onValueChange={(value) =>
              void run("defaultRightsMode", { defaultRightsMode: value })
            }
          >
            <SelectTrigger id="settings-default-rights" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RIGHTS_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`mode.${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ResetToDefaultButton
            shown={settings.defaultRightsMode.source === "database"}
            pending={pendingKey === "defaultRightsMode"}
            onReset={() => void run("defaultRightsMode", { defaultRightsMode: null })}
          />
        </div>
        <FieldSourceNote source={settings.defaultRightsMode.source} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("settings.defaults.presetsLabel")}</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!canSavePresets || pendingKey === "summaryPresets"}
              aria-busy={pendingKey === "summaryPresets"}
              onClick={() => void handleSavePresets()}
            >
              {tCommon("save")}
            </Button>
            <ResetToDefaultButton
              shown={settings.summaryPresets.source === "database"}
              pending={pendingKey === "summaryPresets"}
              onReset={() => void run("summaryPresets", { summaryPresets: null })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.defaults.presetsHint")}</p>
        <PostProcessingPicker
          rows={presetRows}
          onChange={setPresetRows}
          prompts={prompts}
          agents={agents}
        />
        <FieldSourceNote source={settings.summaryPresets.source} />
        {stalePresets.length > 0 && (
          <p className="text-xs text-warning">
            {t("settings.defaults.stalePresetsNote", { count: stalePresets.length })}
          </p>
        )}
      </div>
    </>
  );
}
