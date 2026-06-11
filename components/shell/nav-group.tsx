"use client";

/**
 * NavGroup — one persona-altitude group: header + item list.
 *
 * Spec: design/navigation.md §2 "Group headers" + §1.3 rendering rules:
 * - ONE renderer for every group — no admin special-casing (kills the
 *   duplicated NavigationItems/AdminNavigationSection markup, §7).
 * - Headers are never sticky and never interactive; no collapsible
 *   sections (rule #3 — the old auto-collapsing "Admin" accordion is
 *   retired; RBAC is the density control).
 * - `suppressHeader` implements the single-group rule (#2): when exactly
 *   one body group survives RBAC, P1's sidebar reads as a flat app.
 * - In rail mode the header collapses to a centered 16 px hairline
 *   (`w-4 border-t border-sidebar-border`) so the grouping rhythm
 *   survives at 3 rem. The swap is CSS-driven (`group-data-[collapsible=
 *   icon]`) so it tracks the width transition; the mobile drawer (no
 *   icon-collapse ancestor) always shows labels.
 *
 * Mount contract: the group insets its list `px-2` from the sidebar edge —
 * exactly what NavItem's `-left-2` Spine indicator expects. Keep them
 * paired.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import {
  GROUP_I18N_KEYS,
  type NavEntry,
  type NavGroup as NavGroupId,
} from "./nav-config";
import { NavItem } from "./nav-item";

export interface NavGroupProps {
  /** Group id — resolves the header label via `GROUP_I18N_KEYS`. */
  group: Exclude<NavGroupId, "top">;
  /**
   * The RBAC/config-filtered entries for this group (from `groupsFor`),
   * rendered in the order given. An empty list renders nothing
   * (rendering rule §1.3 #1 — header included).
   */
  entries: NavEntry[];
  /**
   * Single-group rule (§1.3 #2): when exactly one body group survives,
   * its header label is suppressed.
   */
  suppressHeader?: boolean;
  /** The first group gets `pt-2` instead of `pt-6` (§2 "Group headers"). */
  first?: boolean;
  /** Forwarded to every item (e.g. the mobile drawer closes on navigate). */
  onSelect?: (entry: NavEntry) => void;
  className?: string;
}

const NavGroup = React.forwardRef<HTMLDivElement, NavGroupProps>(
  (
    {
      group,
      entries,
      suppressHeader = false,
      first = false,
      onSelect,
      className,
    },
    ref,
  ) => {
    const t = useTranslations();
    const labelId = React.useId();

    if (entries.length === 0) return null;

    return (
      <SidebarGroup ref={ref} className={cn("px-2", className)}>
        {suppressHeader ? null : (
          <div
            data-sidebar="group-label"
            className={cn(
              // Never sticky, never interactive — plain text, no handlers.
              "flex min-h-4 shrink-0 select-none items-center px-2 pb-1",
              "text-[11px] font-medium uppercase leading-4 tracking-wider text-muted-foreground/70",
              first ? "pt-2" : "pt-6",
            )}
          >
            <span
              id={labelId}
              className="truncate group-data-[collapsible=icon]:hidden"
            >
              {t(GROUP_I18N_KEYS[group])}
            </span>
            <span
              aria-hidden="true"
              className="mx-auto hidden h-0 w-4 border-t border-sidebar-border group-data-[collapsible=icon]:block"
            />
          </div>
        )}
        <SidebarMenu aria-labelledby={suppressHeader ? undefined : labelId}>
          {entries.map((entry) => (
            <NavItem key={entry.id} entry={entry} onSelect={onSelect} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  },
);
NavGroup.displayName = "NavGroup";

export { NavGroup };
