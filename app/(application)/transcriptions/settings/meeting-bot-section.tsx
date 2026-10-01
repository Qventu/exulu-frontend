"use client";

/**
 * Meeting bot section — the identity a Recall bot joins meetings with
 * (settings design doc §1). `recordersMayOverrideBot` off makes the
 * workspace values win over whatever a recorder supplies per-meeting
 * (resolveBotIdentity on the backend); off here is therefore not advisory —
 * a recorder's own bot name is ignored server-side when this is false.
 */
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { TranscriptsSettings, TranscriptsSettingsPatch } from "../hooks";
import { FieldSourceNote, ResetToDefaultButton, useSettingsSave } from "./settings-field";

export interface MeetingBotSectionProps {
  settings: TranscriptsSettings;
  onSave: (patch: TranscriptsSettingsPatch) => Promise<void>;
}

export function MeetingBotSection({ settings, onSave }: MeetingBotSectionProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const { pendingKey, run } = useSettingsSave(onSave);

  const [botName, setBotName] = React.useState(settings.botName.value ?? "");
  // Re-seed the draft only when the resolved value changes under us (a save
  // elsewhere, a refetch) — never while the admin is mid-edit.
  React.useEffect(() => {
    setBotName(settings.botName.value ?? "");
  }, [settings.botName.value]);
  const botNameDirty = botName.trim() !== (settings.botName.value ?? "");

  const handleSaveBotName = async () => {
    await run("botName", { botName: botName.trim() || null });
    if (botName.trim()) toast.success(t("settings.saved"));
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="settings-bot-name">{t("composer.botName")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="settings-bot-name"
            value={botName}
            onChange={(event) => setBotName(event.target.value)}
            placeholder={t("composer.botNamePlaceholder")}
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={!botNameDirty || pendingKey === "botName"}
            aria-busy={pendingKey === "botName"}
            onClick={() => void handleSaveBotName()}
          >
            {tCommon("save")}
          </Button>
          <ResetToDefaultButton
            shown={settings.botName.source === "database"}
            pending={pendingKey === "botName"}
            onReset={() => void run("botName", { botName: null })}
          />
        </div>
        <FieldSourceNote source={settings.botName.source} />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="settings-notify-chat">{t("composer.notifyChat")}</Label>
          <FieldSourceNote source={settings.notifyChat.source} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="settings-notify-chat"
            checked={settings.notifyChat.value ?? true}
            disabled={pendingKey === "notifyChat"}
            onCheckedChange={(checked) => void run("notifyChat", { notifyChat: checked })}
          />
          <ResetToDefaultButton
            shown={settings.notifyChat.source === "database"}
            pending={pendingKey === "notifyChat"}
            onReset={() => void run("notifyChat", { notifyChat: null })}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="settings-may-override">{t("settings.meetingBot.mayOverrideLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("settings.meetingBot.mayOverrideHint")}</p>
          <FieldSourceNote source={settings.recordersMayOverrideBot.source} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="settings-may-override"
            checked={settings.recordersMayOverrideBot.value ?? true}
            disabled={pendingKey === "recordersMayOverrideBot"}
            onCheckedChange={(checked) =>
              void run("recordersMayOverrideBot", { recordersMayOverrideBot: checked })
            }
          />
          <ResetToDefaultButton
            shown={settings.recordersMayOverrideBot.source === "database"}
            pending={pendingKey === "recordersMayOverrideBot"}
            onReset={() => void run("recordersMayOverrideBot", { recordersMayOverrideBot: null })}
          />
        </div>
      </div>
    </>
  );
}
