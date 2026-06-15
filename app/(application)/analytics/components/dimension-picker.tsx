"use client";

/**
 * DimensionPicker — page-level "View by:" control that drives lens.dimension.
 *
 * Lives in the AnalyticsView header alongside RangePicker so the breakdown
 * scope is reachable at-a-glance and stays sticky-adjacent on mobile (the
 * MobileTopbarAction surfaces the same control). The control is a compact
 * Select — six options fit cleanly without forcing a 6-segment Tabs row
 * to share the header with the 5-segment range Tabs.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { DIMENSIONS, type Dimension, type Lens } from "../hooks";

export interface DimensionPickerProps {
  lens: Lens;
  onLensChange: (next: Partial<Lens>) => void;
  /** When true, the trigger stretches full-width below sm (mobile topbar). */
  fullWidthBelowSm?: boolean;
}

const DIMENSION_LABEL_KEYS: Record<Dimension, string> = {
  agents: "header.dimensionAgents",
  users: "header.dimensionUsers",
  projects: "header.dimensionProjects",
  teams: "header.dimensionTeams",
  roles: "header.dimensionRoles",
  routines: "header.dimensionRoutines",
};

export function DimensionPicker({
  lens,
  onLensChange,
  fullWidthBelowSm = false,
}: DimensionPickerProps) {
  const t = useTranslations("analytics");
  return (
    <Select
      value={lens.dimension}
      onValueChange={(value) =>
        onLensChange({ dimension: value as Dimension })
      }
    >
      <SelectTrigger
        aria-label={t("header.dimension")}
        className={cn(
          "shrink-0 max-md:h-11 sm:w-[160px]",
          fullWidthBelowSm && "w-full sm:w-[160px]",
        )}
      >
        <SelectValue placeholder={t("header.dimension")} />
      </SelectTrigger>
      <SelectContent>
        {DIMENSIONS.map((dim) => (
          <SelectItem key={dim} value={dim}>
            {t(DIMENSION_LABEL_KEYS[dim])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
