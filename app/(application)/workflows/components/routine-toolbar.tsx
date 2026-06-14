"use client";

/**
 * RoutineToolbar — search + count + (desktop-only) view menu for /workflows.
 *
 * Status filter is NOT rendered while ROUTINES_STATUS_FILTER_SUPPORTED=false
 * (workflows.md L1 — honest > fake, no client-side filter over a server page).
 * "View" overflow lives here only when status filter ships; for now the
 * toolbar collapses to a single search Input + the page-supplied count slot.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { Toolbar } from "@/components/primitives/toolbar";

import { ROUTINES_STATUS_FILTER_SUPPORTED } from "../schema-flags";

export interface RoutineToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  /** Right-aligned slot for the result count. */
  countSlot?: React.ReactNode;
}

export function RoutineToolbar({
  search,
  onSearchChange,
  countSlot,
}: RoutineToolbarProps) {
  const t = useTranslations("routines");

  // Status filter would live here when ROUTINES_STATUS_FILTER_SUPPORTED.
  // Today: documented absence (no client-side fallback over a server page).
  const filters = ROUTINES_STATUS_FILTER_SUPPORTED ? <span /> : undefined;

  return (
    <Toolbar
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: t("searchPlaceholder"),
        debounceMs: 0, // debounce lives in useRoutinesIndex
      }}
      filters={filters}
      view={countSlot}
    />
  );
}
