"use client";

/**
 * Small shared pieces every settings-section field uses: a quiet note when a
 * field's value came from the environment or the code default (so an admin
 * can tell what they are overriding — task-7 brief), a "reset to default"
 * action (sends an explicit `null`, per hooks.ts's buildSettingsInput), and a
 * tiny per-field pending/error wrapper around `save()` so each section isn't
 * repeating the same try/catch/toast.
 */
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type { SettingSource, TranscriptsSettingsPatch } from "../hooks";

export function FieldSourceNote({ source }: { source: SettingSource }) {
  const t = useTranslations("transcriptions");
  if (source === "database") return null;
  return (
    <p className="text-xs text-muted-foreground">
      {source === "env" ? t("settings.sourceNote.env") : t("settings.sourceNote.code")}
    </p>
  );
}

export function ResetToDefaultButton({
  shown,
  pending,
  onReset,
}: {
  shown: boolean;
  pending?: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("transcriptions");
  if (!shown) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={onReset}
      className="h-7 px-2 text-xs text-muted-foreground max-md:h-11"
    >
      <RotateCcw aria-hidden="true" className="mr-1 size-3" />
      {t("settings.resetToDefault")}
    </Button>
  );
}

/**
 * Wraps `save(patch)` with a per-field pending flag and a failure toast —
 * success needs no toast for an immediate-apply control (switch/select),
 * since the control's own new state is the feedback; callers that need a
 * success toast (explicit Save buttons) show their own.
 */
export function useSettingsSave(onSave: (patch: TranscriptsSettingsPatch) => Promise<void>) {
  const t = useTranslations("transcriptions");
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const run = React.useCallback(
    async (key: string, patch: TranscriptsSettingsPatch) => {
      setPendingKey(key);
      try {
        await onSave(patch);
      } catch (err: unknown) {
        toast.error(t("settings.saveFailed"), {
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setPendingKey(null);
      }
    },
    [onSave, t],
  );

  return { pendingKey, run };
}
