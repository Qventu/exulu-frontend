"use client";

/**
 * ScheduleEditor — preset / custom cron editor with prefill round-trip.
 *
 * Workflows.md UX #13: "Editing" a schedule must not mean retyping it. On
 * mount, matchPreset() decides which tab opens with the saved value already
 * selected/entered. Tab switches preserve last value per mode (no clobber).
 *
 * Validation lives inline (no toast-only errors). Cheat sheet collapses
 * behind a quiet disclosure ("Format help").
 */

import cron from "cron-validator";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { CRON_PRESETS, matchPreset } from "../cron-presets";
import type { RoutineScheduleMode } from "../types";

export interface ScheduleEditorProps {
  /** Existing cron string (used for prefill). */
  value?: string;
  /** Called with the next cron string when valid, or null when cleared. */
  onChange: (next: string | null) => void;
  /** When true, inputs are read-only. */
  disabled?: boolean;
}

export function ScheduleEditor({
  value,
  onChange,
  disabled,
}: ScheduleEditorProps) {
  const t = useTranslations("routines");

  // Initial mode: preset match -> preset, otherwise custom.
  const initialPreset = React.useMemo(() => matchPreset(value), [value]);
  const [mode, setMode] = React.useState<RoutineScheduleMode>(
    initialPreset ? "preset" : value ? "custom" : "preset",
  );
  const [presetValue, setPresetValue] = React.useState(initialPreset?.value ?? "");
  const [customValue, setCustomValue] = React.useState(
    initialPreset ? "" : (value ?? ""),
  );
  const [customError, setCustomError] = React.useState("");

  // If the upstream value changes (e.g. fresh fetch), re-seed.
  React.useEffect(() => {
    const match = matchPreset(value);
    if (match) {
      setMode("preset");
      setPresetValue(match.value);
      setCustomValue("");
    } else if (value) {
      setMode("custom");
      setCustomValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const propagate = React.useCallback(
    (next: string) => {
      if (!next) {
        onChange(null);
        return;
      }
      if (cron.isValidCron(next, { seconds: false })) {
        onChange(next);
      } else {
        // Invalid -> keep last good upstream value (don't propagate garbage).
        onChange(null);
      }
    },
    [onChange],
  );

  const handlePresetChange = (next: string) => {
    setPresetValue(next);
    propagate(next);
  };

  const handleCustomChange = (next: string) => {
    setCustomValue(next);
    if (!next) {
      setCustomError("");
      onChange(null);
      return;
    }
    if (cron.isValidCron(next, { seconds: false })) {
      setCustomError("");
      onChange(next);
    } else {
      setCustomError(t("schedule.editor.invalid"));
      onChange(null);
    }
  };

  const handleModeChange = (next: string) => {
    const nextMode = (next as RoutineScheduleMode) ?? "preset";
    setMode(nextMode);
    // Preserve last value per mode (no clobber on switch).
    if (nextMode === "preset") propagate(presetValue);
    else propagate(customValue);
  };

  return (
    <Tabs value={mode} onValueChange={handleModeChange} className="space-y-3">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="preset">{t("schedule.editor.presets")}</TabsTrigger>
        <TabsTrigger value="custom">{t("schedule.editor.custom")}</TabsTrigger>
      </TabsList>

      <TabsContent value="preset" className="space-y-2">
        <Label>{t("schedule.editor.selectPreset")}</Label>
        <Select
          value={presetValue}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("schedule.editor.chooseAPreset")} />
          </SelectTrigger>
          <SelectContent>
            {CRON_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {presetValue ? (
          <div className="rounded-md bg-muted p-2">
            <div className="text-xs text-muted-foreground">
              {t("schedule.editor.expression")}
            </div>
            <code className="font-mono text-sm">{presetValue}</code>
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="custom" className="space-y-2">
        <Label htmlFor="routine-custom-cron">{t("schedule.editor.cronExpression")}</Label>
        <Input
          id="routine-custom-cron"
          value={customValue}
          onChange={(event) => handleCustomChange(event.target.value)}
          placeholder="0 12 * * *"
          disabled={disabled}
          aria-invalid={!!customError}
          aria-describedby={customError ? "routine-custom-cron-error" : undefined}
          className={cn(customError && "border-destructive")}
        />
        {customError ? (
          <p
            id="routine-custom-cron-error"
            className="text-xs text-destructive"
          >
            {customError}
          </p>
        ) : null}

        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown
              aria-hidden="true"
              className="size-3 transition-transform group-data-[state=open]:rotate-180"
            />
            {t("schedule.editor.formatHelp")}
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <div className="mt-2 rounded-md bg-muted p-3 text-xs">
              <div className="mb-1 font-mono">
                {t("schedule.editor.formatLine")}
              </div>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>{t("schedule.editor.minute")}</li>
                <li>{t("schedule.editor.hour")}</li>
                <li>{t("schedule.editor.day")}</li>
                <li>{t("schedule.editor.month")}</li>
                <li>{t("schedule.editor.weekday")}</li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </TabsContent>
    </Tabs>
  );
}
