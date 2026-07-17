"use client";

/**
 * NavGroup — one persona-altitude group: header + item list.
 *
 * Spec: design/navigation.md §2 "Group headers" + §1.3 rendering rules:
 * - ONE renderer for every group — no duplicated admin markup (§7). The
 *   `collapsible` flag comes from nav-config (`COLLAPSIBLE_GROUPS`), not
 *   from special-casing here.
 * - Headers are non-interactive EXCEPT collapsible groups (product
 *   decision 2026-06-11, Administration only — §1.3 #3 amendment).
 *   Deliberately NOT the retired auto-collapsing accordion (audit M10):
 *   collapse is manual, the choice persists (localStorage), the group
 *   auto-expands when it contains the active route, and a collapsed group
 *   containing the active route shows a primary dot so "where am I" never
 *   disappears.
 * - `suppressHeader` implements the single-group rule (#2): when exactly
 *   one body group survives RBAC, P1's sidebar reads as a flat app.
 * - In rail mode the header collapses to a centered 16 px hairline and
 *   collapsibility is disabled — at 3 rem every item stays reachable.
 *   The hairline swap is CSS-driven (`group-data-[collapsible=icon]`) so
 *   it tracks the width transition; the mobile drawer (no icon-collapse
 *   ancestor) always shows labels.
 *
 * Mount contract: the group insets its list `px-2` from the sidebar edge —
 * exactly what NavItem's `-left-2` Spine indicator expects. Keep them
 * paired.
 */

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SidebarGroup, SidebarMenu, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import {
  activeEntryFor,
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
   * Toggleable header (§1.3 #3 amendment — Administration). Ignored in
   * rail mode and when the header is suppressed.
   */
  collapsible?: boolean;
  /**
   * Single-group rule (§1.3 #2): when exactly one body group survives,
   * its header label is suppressed.
   */
  suppressHeader?: boolean;
  /** The first group gets `pt-2` instead of `pt-6` (§2 "Group headers"). */
  first?: boolean;
  /** Forwarded to every item (e.g. the mobile drawer closes on navigate). */
  onSelect?: (entry: NavEntry) => void;
  /** Per-entry-id attention counts, forwarded to NavItem's `badge`. */
  badges?: Readonly<Partial<Record<string, number>>>;
  className?: string;
}

const headerClasses = (first: boolean) =>
  cn(
    "flex min-h-4 shrink-0 select-none items-center px-2 pb-1",
    "text-[11px] font-medium uppercase leading-4 tracking-wider text-muted-foreground/70",
    first ? "pt-2" : "pt-6",
  );

/** The rail-mode hairline that stands in for the header label (§2). */
function RailHairline() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto hidden h-0 w-4 border-t border-sidebar-border group-data-[collapsible=icon]:block"
    />
  );
}

const NavGroup = React.forwardRef<HTMLDivElement, NavGroupProps>(
  (
    {
      group,
      entries,
      collapsible = false,
      suppressHeader = false,
      first = false,
      onSelect,
      badges,
      className,
    },
    ref,
  ) => {
    const t = useTranslations();
    const labelId = React.useId();
    const pathname = usePathname();
    const { state, isMobile } = useSidebar();

    // Rail = collapsed desktop sidebar: headers are hairlines, every item
    // stays reachable — group collapsibility only applies when expanded.
    const isRail = state === "collapsed" && !isMobile;
    const canCollapse = collapsible && !suppressHeader && !isRail;

    const containsActive = React.useMemo(() => {
      const active = activeEntryFor(pathname ?? "/");
      return active != null && entries.some((entry) => entry.id === active.id);
    }, [pathname, entries]);

    // SSR-safe default: expanded iff the active route lives here. The
    // stored manual preference is applied after mount (storage is
    // client-only) and never overrides an active-route expansion.
    const storageKey = `nav-group:${group}`;
    const [open, setOpen] = React.useState(containsActive);
    React.useEffect(() => {
      if (containsActive) return;
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored !== null) setOpen(stored === "true");
      } catch {
        // Storage unavailable (private mode) — session-only state is fine.
      }
      // Apply the stored preference once, on mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Navigating into the group always reveals the active item (anti
    // mystery-meat: collapse may never hide "where I just went").
    React.useEffect(() => {
      if (containsActive) setOpen(true);
    }, [containsActive]);

    const handleOpenChange = React.useCallback(
      (next: boolean) => {
        setOpen(next);
        try {
          window.localStorage.setItem(storageKey, String(next));
        } catch {
          // Non-fatal.
        }
      },
      [storageKey],
    );

    if (entries.length === 0) return null;

    const menu = (
      <SidebarMenu aria-labelledby={suppressHeader ? undefined : labelId}>
        {entries.map((entry) => (
          <NavItem
            key={entry.id}
            entry={entry}
            onSelect={onSelect}
            badge={badges?.[entry.id]}
          />
        ))}
      </SidebarMenu>
    );

    if (!canCollapse) {
      return (
        <SidebarGroup ref={ref} className={cn("px-2", className)}>
          {suppressHeader ? null : (
            <div data-sidebar="group-label" className={headerClasses(first)}>
              <span
                id={labelId}
                className="truncate group-data-[collapsible=icon]:hidden"
              >
                {t(GROUP_I18N_KEYS[group])}
              </span>
              <RailHairline />
            </div>
          )}
          {menu}
        </SidebarGroup>
      );
    }

    return (
      <SidebarGroup ref={ref} className={cn("px-2", className)}>
        <Collapsible open={open} onOpenChange={handleOpenChange}>
          <CollapsibleTrigger
            data-sidebar="group-label"
            className={cn(
              headerClasses(first),
              "group/trigger w-full rounded-md text-left",
              "transition-colors duration-150 ease-in-out hover:text-muted-foreground motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            )}
          >
            <span id={labelId} className="truncate">
              {t(GROUP_I18N_KEYS[group])}
            </span>
            {/* Collapsed group owning the active route: keep "where am I"
                visible with the Spine's dot (the indicator itself is hidden
                with the items, so only one purple marker ever shows). */}
            {!open && containsActive ? (
              <span
                aria-hidden="true"
                className="ml-2 size-1.5 shrink-0 rounded-full bg-primary"
              />
            ) : null}
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "ml-auto size-3.5 shrink-0",
                "transition-transform duration-200 ease-in-out motion-reduce:transition-none",
                open ? "rotate-90" : "rotate-0",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn(
              "overflow-hidden",
              "data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up",
              "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
            )}
          >
            {menu}
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  },
);
NavGroup.displayName = "NavGroup";

export { NavGroup };
