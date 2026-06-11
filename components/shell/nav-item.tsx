"use client";

/**
 * NavItem — a single sidebar destination plus the sliding "Spine" indicator.
 *
 * Spec: design/navigation.md §2 ("Items & icon language", "Collapse behavior")
 * and §6 motion rows 1 (indicator slide, 200 ms ease-in-out), 2 (label fade,
 * 150 ms — fade-in delayed 50 ms on expand so text never overflows
 * mid-animation) and 5 (hover background, 150 ms). Every animation collapses
 * to an instant state swap under prefers-reduced-motion — implemented
 * explicitly via `useReducedMotion`, plus `motion-reduce:` for the CSS hover
 * transition.
 *
 * The indicator is the sidebar's ONLY purple (philosophy anti-pattern #5):
 * a `w-[3px] h-4 rounded-full bg-primary` bar flush to the sidebar's left
 * edge, vertically centered on the active item, travelling between items on
 * navigation via the shared Framer Motion `layoutId="nav-spine"`. The icon
 * stays neutral — it inherits the text color, never the accent.
 *
 * Mount contract: NavItem renders a `SidebarMenuItem` (<li>) — place it
 * inside a `SidebarMenu` (<ul>) whose container insets it exactly `px-2`
 * (8 px) from the sidebar's left edge; the indicator compensates with
 * `-left-2`. NavGroup, `SidebarHeader` and `SidebarFooter` (both `p-2`)
 * all satisfy this.
 *
 * Rail mode: the label unmounts and a right-side tooltip carries the full
 * label (+ shortcut where one exists) — no mystery meat (anti-pattern #2).
 * Tooltip visibility mirrors the vendored SidebarMenuButton machinery
 * (hidden unless collapsed desktop rail).
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { activeEntryFor, type NavEntry } from "./nav-config";

export interface NavItemProps {
  /** The nav-config row to render — label, icon and route all derive from it. */
  entry: NavEntry;
  /**
   * Keyboard shortcut rendered beside the label in the rail tooltip
   * (navigation.md §2 "Collapse behavior"), e.g. "⌘K". Most destinations
   * have none.
   */
  shortcut?: string;
  /**
   * Fires on activation. Required for route-less entries (`route: null`,
   * e.g. send-feedback opens the FeedbackDialog); the mobile drawer also
   * uses it to close on navigate.
   */
  onSelect?: (entry: NavEntry) => void;
  className?: string;
}

const NavItem = React.forwardRef<HTMLLIElement, NavItemProps>(
  ({ entry, shortcut, onSelect, className }, ref) => {
    const t = useTranslations();
    const pathname = usePathname();
    const { state, isMobile } = useSidebar();
    const reducedMotion = useReducedMotion() ?? false;

    const label = t(entry.i18nKey);
    const Icon = entry.icon;

    // Active matching: first-segment equality + alias list, owned by
    // nav-config (rendering rule §1.3 #4 — never substring matching).
    const isActive =
      entry.route !== null && activeEntryFor(pathname ?? "/")?.id === entry.id;

    // Rail = collapsed desktop sidebar. The mobile drawer always shows labels.
    const isRail = state === "collapsed" && !isMobile;

    const handleSelect = () => onSelect?.(entry);

    const itemClassName = cn(
      // Anatomy (§2): h-8 rounded-md px-2 gap-2 text-sm — icon + label.
      "flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm",
      // Inactive → hover (§2 hover affordance; motion row 5: background
      // 150 ms; no scale, no shadow). Replaces the WCAG-risky opacity-60.
      "text-sidebar-foreground/70 transition-colors duration-150 ease-in-out",
      "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      "motion-reduce:transition-none",
      // Focus: standard ring-offset pattern — keyboard parity with hover.
      "ring-offset-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2",
      // Active (§2): quiet fill + weight; the indicator carries the purple.
      isActive && "bg-sidebar-accent font-medium text-foreground",
      className,
    );

    const itemContent = (
      <>
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <AnimatePresence initial={false}>
          {!isRail ? (
            <motion.span
              className="min-w-0 flex-1 truncate"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.15, ease: "easeInOut", delay: 0.05 },
              }}
              exit={{
                opacity: 0,
                transition: reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.15, ease: "easeInOut" },
              }}
            >
              {label}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </>
    );

    const sharedProps = {
      "aria-label": label,
      "data-sidebar": "menu-button",
      "data-active": isActive,
      className: itemClassName,
    } as const;

    const interactive =
      entry.route !== null ? (
        <Link
          href={entry.route}
          aria-current={isActive ? "page" : undefined}
          onClick={handleSelect}
          {...sharedProps}
        >
          {itemContent}
        </Link>
      ) : (
        <button type="button" onClick={handleSelect} {...sharedProps}>
          {itemContent}
        </button>
      );

    return (
      <SidebarMenuItem ref={ref} className="flex">
        {isActive ? (
          <motion.span
            layoutId="nav-spine"
            aria-hidden="true"
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.2, ease: "easeInOut" }
            }
            className="pointer-events-none absolute -left-2 top-1/2 -mt-2 h-4 w-[3px] rounded-full bg-primary"
          />
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>{interactive}</TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            hidden={!isRail}
            className="flex items-center gap-2"
          >
            <span>{label}</span>
            {shortcut ? (
              <kbd className="pointer-events-none select-none font-mono text-xs text-muted-foreground">
                {shortcut}
              </kbd>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  },
);
NavItem.displayName = "NavItem";

export { NavItem };
