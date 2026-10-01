"use client";

/**
 * Recording limits section — the optional monthly cap on meeting-bot
 * recording time (settings design doc §1). `monthlyRecordingLimitMinutes`
 * carries the "none" sentinel rather than `null` for "no cap" — never
 * collapse the two, or a stored "no cap" choice would read as "not set" and
 * fall back to an env cap underneath the admin.
 */
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type {
  RecordingLimitMinutes,
  TranscriptsSettings,
  TranscriptsSettingsPatch,
} from "../hooks";
import { FieldSourceNote, ResetToDefaultButton, useSettingsSave } from "./settings-field";

export interface LimitsSectionProps {
  settings: TranscriptsSettings;
  onSave: (patch: TranscriptsSettingsPatch) => Promise<void>;
}

const LIMIT_PRESETS = [60, 300, 600, 1500];
const NONE = "none";

export function LimitsSection({ settings, onSave }: LimitsSectionProps) {
  const t = useTranslations("transcriptions");
  const { pendingKey, run } = useSettingsSave(onSave);

  const limit = settings.monthlyRecordingLimitMinutes.value;
  const limitOptions =
    limit !== NONE && !LIMIT_PRESETS.includes(limit)
      ? [...LIMIT_PRESETS, limit].sort((a, b) => a - b)
      : LIMIT_PRESETS;

  const handleChange = (value: string) => {
    const next: RecordingLimitMinutes = value === NONE ? NONE : Number(value);
    void run("monthlyRecordingLimitMinutes", { monthlyRecordingLimitMinutes: next });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="settings-recording-limit">{t("settings.limits.capLabel")}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(limit)} onValueChange={handleChange}>
          <SelectTrigger id="settings-recording-limit" className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("settings.limits.capNone")}</SelectItem>
            {limitOptions.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {t("settings.limits.capOption", { minutes })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ResetToDefaultButton
          shown={settings.monthlyRecordingLimitMinutes.source === "database"}
          pending={pendingKey === "monthlyRecordingLimitMinutes"}
          onReset={() =>
            void run("monthlyRecordingLimitMinutes", { monthlyRecordingLimitMinutes: null })
          }
        />
      </div>
      <FieldSourceNote source={settings.monthlyRecordingLimitMinutes.source} />
    </div>
  );
}
