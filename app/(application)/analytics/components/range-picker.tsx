"use client";

/**
 * RangePicker — segmented preset Tabs [24h | 7d | 14d | 30d | Custom] +
 * Custom popover with a max-30-day Calendar (range mode), localized footnote
 * and toast (analytics.md §3 "Default view", ladder #4–9; bugs 2.g/h).
 *
 * The active preset earns the purple primary tint — that's one of the only
 * two purple appearances on this page (the other is the measure Tabs in
 * Explore). All copy lives under `analytics.range.*` for en/de parity
 * (kills the hardcoded English of the legacy DateRangeSelector,
 * analytics.md UX#10).
 *
 * Responsive: presets render as a 5-segment Tabs row that fits at 390px;
 * Custom popover renders `numberOfMonths={1}` below `sm`, `2` above (fixes
 * the legacy ~560px overflow).
 */

import { format, addDays, differenceInDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  DEFAULT_PRESET,
  MAX_RANGE_DAYS,
  RANGE_PRESETS,
  resolveWindow,
  type Lens,
  type RangePreset,
} from "../hooks";

export interface RangePickerProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
  /** When true, presets stack full-width below sm (MobileTopbarAction wrapping). */
  fullWidthBelowSm?: boolean;
}

const PRESET_KEYS: Record<RangePreset, string> = {
  "24h": "range.preset24h",
  "7d": "range.preset7d",
  "14d": "range.preset14d",
  "30d": "range.preset30d",
  custom: "range.presetCustom",
};

// The Tabs no longer renders a "Custom" trigger — entering custom range is
// driven by selecting dates in the date-pill Popover's Calendar (see
// handleCalendarSelect which flips lens.preset to "custom"). The PRESET_KEYS
// entry for "custom" still labels the date-pill when preset === "custom".
const TAB_PRESETS = RANGE_PRESETS.filter((p) => p !== "custom") as Exclude<RangePreset, "custom">[];

export function RangePicker({ lens, onLensChange, fullWidthBelowSm = false }: RangePickerProps) {
  const t = useTranslations("analytics");
  const [open, setOpen] = React.useState(false);

  const handlePresetChange = (value: string) => {
    if (!(RANGE_PRESETS as readonly string[]).includes(value)) return;
    // Defensive — Tabs no longer emits "custom" (no matching trigger), but
    // Radix could theoretically forward an unmatched value. The custom path
    // is now reached only via handleCalendarSelect below.
    if (value === "custom") return;
    onLensChange({ preset: value as RangePreset, customFrom: null, customTo: null });
  };

  const window = resolveWindow(lens);
  const fromDate = new Date(window.current.from);
  const toDate = new Date(window.current.to);
  const selected: DateRange = { from: fromDate, to: toDate };

  const handleCalendarSelect = (newRange: DateRange | undefined) => {
    if (!newRange?.from) return;
    if (newRange.from && newRange.to) {
      const days = differenceInDays(newRange.to, newRange.from);
      if (days > MAX_RANGE_DAYS) {
        toast.error(t("range.tooLargeTitle"), {
          description: t("range.tooLargeDescription", { days: MAX_RANGE_DAYS }),
        });
        return;
      }
      onLensChange({
        preset: "custom",
        customFrom: newRange.from.toISOString(),
        customTo: newRange.to.toISOString(),
      });
    }
  };

  // Disable days that would push the range over MAX_RANGE_DAYS once a start
  // is chosen (mirrors the legacy behavior; analytics.md ladder #8).
  const disabledDays = selected.from
    ? [
        { before: addDays(selected.from, -MAX_RANGE_DAYS) },
        { after: addDays(selected.from, MAX_RANGE_DAYS) },
      ]
    : [];

  const customLabel = `${format(fromDate, "LLL dd")} – ${format(toDate, "LLL dd, y")}`;

  return (
    <div className={cn("flex items-center gap-2", fullWidthBelowSm && "w-full sm:w-auto")}>
      <Tabs
        value={lens.preset === "custom" ? "" : lens.preset}
        onValueChange={handlePresetChange}
        className={cn(fullWidthBelowSm && "w-full sm:w-auto")}
      >
        <TabsList
          className={cn(
            "grid w-full grid-cols-4 max-md:h-11 sm:inline-flex sm:w-auto",
            fullWidthBelowSm && "w-full",
          )}
          aria-label={t("range.label")}
        >
          {TAB_PRESETS.map((preset) => (
            <TabsTrigger
              key={preset}
              value={preset}
              className="px-2 text-xs max-md:h-full sm:px-3 sm:text-sm"
            >
              {t(PRESET_KEYS[preset])}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("range.placeholder")}
            className={cn("shrink-0 max-md:h-11")}
          >
            <CalendarIcon aria-hidden="true" className="mr-2 size-4" />
            <span className="truncate text-xs sm:text-sm">
              {lens.preset === "custom" ? customLabel : t(PRESET_KEYS[lens.preset])}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto p-0 sm:w-auto"
        >
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={fromDate}
            selected={selected}
            onSelect={handleCalendarSelect}
            disabled={disabledDays}
            numberOfMonths={1}
          />
          <div className="border-t p-3 text-xs text-muted-foreground">
            {t("range.footnote", { days: MAX_RANGE_DAYS })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Re-export the default preset constant for the loading skeleton + view. */
export { DEFAULT_PRESET };
