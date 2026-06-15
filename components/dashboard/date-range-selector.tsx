"use client";

/**
 * @deprecated Use `app/(application)/analytics/components/range-picker.tsx`
 * (preset Tabs + bounded custom calendar, i18n'd, responsive) for new pages.
 * This component is retained ONLY as the legacy fallback consumed by
 * `app/(application)/data/components/usage-panel.tsx`. Migration to the new
 * RangePicker is tracked as work item 3.3.1; do not add new consumers.
 *
 * The new RangePicker covers a SUPERSET of this component's feature set
 * (presets + custom popover) but exposes a different `lens` shape (see
 * `app/(application)/analytics/hooks.ts`), so adoption requires the
 * consumer to migrate to the lens model.
 */

import * as React from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format, subDays, differenceInDays, addDays } from "date-fns";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangeSelectorProps {
  dateRange: DateRange | undefined;
  maxDays?: number;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
  className?: string;
}

export function DateRangeSelector({ dateRange, onDateRangeChange, className, maxDays = 30 }: DateRangeSelectorProps) {

  const handleDateRangeChange = (newRange: DateRange | undefined) => {
    if (newRange?.from && newRange?.to) {
      const daysDifference = differenceInDays(newRange.to, newRange.from);
      if (daysDifference > maxDays) {
        // Show toast notification
        toast.error("Date range too large", { description: `Please select a date range of ${maxDays} days or less.` });
        return;
      }
    }
    onDateRangeChange(newRange);
  };

  // Disable dates that would create a range > maxDays
  const disabledDays = React.useMemo(() => {
    if (!dateRange?.from) return [];
    
    const fromDate = dateRange.from;
    const minDate = addDays(fromDate, -maxDays);
    const maxDate = addDays(fromDate, maxDays);
    
    return [
      { before: minDate },
      { after: maxDate }
    ];
  }, [dateRange?.from, maxDays]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleDateRangeChange}
            disabled={disabledDays}
            numberOfMonths={2}
          />
          <div className="p-3 pt-3 text-xs text-muted-foreground border-t">
            Maximum range: {maxDays} days
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}