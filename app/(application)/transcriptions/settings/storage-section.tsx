"use client";

/**
 * Meeting video section — how long meeting video is kept, whether a local
 * copy is also stored, hours stored, and the estimated storage cost
 * (settings design doc §5). `videoRetentionHours` carries the "forever"
 * sentinel rather than a plain number — never collapse it to a large number
 * or `null`, both of which would misreport an admin's explicit "keep forever"
 * choice.
 *
 * Final fix wave, Fix 4b/4c: "hours stored" and the cost estimate were the
 * two other pieces of spec §5 never built for this section. `usage` is the
 * same `meetingRecordingUsage` data the page's right column card already
 * fetches (Fix 4a) — reused here, not a second query or a new backend field.
 * `used_seconds` is this calendar month's recorded duration; there is no
 * retention-aware "currently stored" figure on the backend, so this is the
 * best available proxy and is labelled accordingly ("this month").
 * `videoStorageCostPerHour: 0` is this field's own "not set" sentinel
 * (storage-section's cost input below) — a real $0.00 estimate would be
 * indistinguishable from "no rate configured", so 0 shows a hint instead of
 * a figure.
 */
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { formatUsd } from "@/lib/budget";

import type {
  RecordingUsage,
  RetentionHours,
  TranscriptsSettings,
  TranscriptsSettingsPatch,
} from "../hooks";
import { FieldSourceNote, ResetToDefaultButton, useSettingsSave } from "./settings-field";

export interface StorageSectionProps {
  settings: TranscriptsSettings;
  onSave: (patch: TranscriptsSettingsPatch) => Promise<void>;
  /** This month's recorded-video duration (Fix 4b/4c) — `null` while loading
   *  or when the meeting bot source isn't enabled, in which case neither
   *  "hours stored" nor the cost estimate renders (no data, no figure). */
  usage: RecordingUsage | null;
}

const RETENTION_PRESETS = [24, 168, 720, 2160];
const FOREVER = "forever";

export function StorageSection({ settings, onSave, usage }: StorageSectionProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const { pendingKey, run } = useSettingsSave(onSave);

  // Fix 4b/4c: hours stored this month and the cost estimate that follows
  // from it. `usage` is `null` while loading or when the meeting bot source
  // isn't enabled — neither row renders without real duration data.
  const hoursStored = usage ? usage.used_seconds / 3600 : null;
  const costPerHourValue = settings.videoStorageCostPerHour.value ?? 0;
  // 0 is this field's own "not set" sentinel (see the file header) — a real
  // $0.00 estimate would be indistinguishable from no rate configured, so a
  // hint renders instead of a figure in that case.
  const costEstimate =
    hoursStored != null && costPerHourValue > 0 ? hoursStored * costPerHourValue : null;

  const retention = settings.videoRetentionHours.value;
  // The stored value is always offered as an option even when it isn't one
  // of the presets (mirrors workflows/[id]/sections/queue.tsx).
  const retentionOptions =
    retention !== FOREVER && !RETENTION_PRESETS.includes(retention)
      ? [...RETENTION_PRESETS, retention].sort((a, b) => a - b)
      : RETENTION_PRESETS;

  const handleRetentionChange = (value: string) => {
    const next: RetentionHours = value === FOREVER ? FOREVER : Number(value);
    void run("videoRetentionHours", { videoRetentionHours: next });
  };

  const [costPerHour, setCostPerHour] = React.useState(
    settings.videoStorageCostPerHour.value != null
      ? String(settings.videoStorageCostPerHour.value)
      : "",
  );
  React.useEffect(() => {
    setCostPerHour(
      settings.videoStorageCostPerHour.value != null
        ? String(settings.videoStorageCostPerHour.value)
        : "",
    );
  }, [settings.videoStorageCostPerHour.value]);
  const costDirty =
    costPerHour !==
    (settings.videoStorageCostPerHour.value != null
      ? String(settings.videoStorageCostPerHour.value)
      : "");

  const handleSaveCost = async () => {
    const trimmed = costPerHour.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && Number.isNaN(parsed)) return;
    await run("videoStorageCostPerHour", { videoStorageCostPerHour: parsed });
    toast.success(t("settings.saved"));
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="settings-retention">{t("settings.storage.retentionLabel")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(retention)} onValueChange={handleRetentionChange}>
            <SelectTrigger id="settings-retention" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {retentionOptions.map((hours) => (
                <SelectItem key={hours} value={String(hours)}>
                  {t("settings.storage.retentionOption", { hours })}
                </SelectItem>
              ))}
              <SelectItem value={FOREVER}>{t("settings.storage.retentionForever")}</SelectItem>
            </SelectContent>
          </Select>
          <ResetToDefaultButton
            shown={settings.videoRetentionHours.source === "database"}
            pending={pendingKey === "videoRetentionHours"}
            onReset={() => void run("videoRetentionHours", { videoRetentionHours: null })}
          />
        </div>
        <FieldSourceNote source={settings.videoRetentionHours.source} />
      </div>

      {/* Hours stored this month (Fix 4b) — usage is null while loading or
          when the meeting bot source isn't enabled, in which case this row
          simply doesn't render rather than showing a misleading "0 hours". */}
      {hoursStored != null && (
        <p className="text-sm text-muted-foreground">
          {t("settings.storage.hoursStoredLabel", { hours: hoursStored.toFixed(1) })}
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="settings-store-locally">{t("settings.storage.storeLocallyLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("settings.storage.storeLocallyHint")}</p>
          <FieldSourceNote source={settings.storeVideoLocally.source} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="settings-store-locally"
            checked={settings.storeVideoLocally.value ?? false}
            disabled={pendingKey === "storeVideoLocally"}
            onCheckedChange={(checked) =>
              void run("storeVideoLocally", { storeVideoLocally: checked })
            }
          />
          <ResetToDefaultButton
            shown={settings.storeVideoLocally.source === "database"}
            pending={pendingKey === "storeVideoLocally"}
            onReset={() => void run("storeVideoLocally", { storeVideoLocally: null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-cost-per-hour">{t("settings.storage.costLabel")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="settings-cost-per-hour"
            type="number"
            min={0}
            step="0.01"
            value={costPerHour}
            onChange={(event) => setCostPerHour(event.target.value)}
            placeholder={t("settings.storage.costPlaceholder")}
            className="max-w-32"
          />
          <Button
            type="button"
            size="sm"
            disabled={!costDirty || pendingKey === "videoStorageCostPerHour"}
            aria-busy={pendingKey === "videoStorageCostPerHour"}
            onClick={() => void handleSaveCost()}
          >
            {tCommon("save")}
          </Button>
          <ResetToDefaultButton
            shown={settings.videoStorageCostPerHour.source === "database"}
            pending={pendingKey === "videoStorageCostPerHour"}
            onReset={() =>
              void run("videoStorageCostPerHour", { videoStorageCostPerHour: null })
            }
          />
        </div>
        <FieldSourceNote source={settings.videoStorageCostPerHour.source} />
        {/* Cost estimate (Fix 4c) — videoStorageCostPerHour: 0 is this
            field's own "not set" sentinel (file header), so a $0.00 estimate
            would lie about a rate that was never configured; a hint renders
            instead. Both need hoursStored, so neither renders without usage
            data either. */}
        {hoursStored != null &&
          (costEstimate != null ? (
            <p className="text-sm">
              {t("settings.storage.costEstimate", { amount: formatUsd(costEstimate) })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("settings.storage.costEstimateHint")}
            </p>
          ))}
      </div>
    </>
  );
}
