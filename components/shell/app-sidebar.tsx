"use client";

/**
 * AppSidebar — "The Spine" (design/navigation.md §2): the composed sidebar.
 *
 * Brand header + collapse trigger, the ⌘K search affordance, RBAC-trimmed
 * nav groups from `groupsFor()` (single-group header suppression for P1),
 * and the Personal footer (Send feedback · user menu — Settings lives inside
 * the user menu only) behind a hairline. Built on the shadcn Sidebar
 * primitives: provider, rail CSS, mobile Sheet, tooltips and cookie
 * persistence are all reused as-is.
 *
 * Mount contract:
 * - Inside `SidebarProvider` (tooltips + sidebar state) — the AppShell
 *   composition in app/(application)/authenticated.tsx owns that.
 * - `collapsible="icon"` is REQUIRED: NavItem/NavGroup/Brand drive their
 *   rail-mode swaps off the `group-data-[collapsible=icon]` attribute.
 * - The user arrives as a prop (the shell tier must not import from app/);
 *   `onSendFeedback` is owned by the AppShell so the sidebar footer and the
 *   command palette share ONE FeedbackDialog instance (mounted outside the
 *   mobile Sheet, which unmounts its children on close).
 * - Every item activation also closes the mobile drawer (navigation.md §5.2:
 *   "tapping any item navigates and closes").
 */

import { PanelLeft, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Brand } from "@/components/shell/brand";
import { openCommandPalette } from "@/components/shell/command-palette";
import { ConfigContext } from "@/components/shell/config-context";
import {
  groupsFor,
  type NavEntry,
  type SidebarTree,
} from "@/components/shell/nav-config";
import { NavGroup } from "@/components/shell/nav-group";
import { NavItem } from "@/components/shell/nav-item";
import { UserMenu, type UserMenuUser } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RightsUser } from "@/lib/rights";
import { cn } from "@/lib/utils";

/** Keyboard glyphs are not translated copy — they are the shortcut itself. */
const PALETTE_SHORTCUT = "⌘K";

export type AppSidebarUser = (RightsUser & UserMenuUser) | null | undefined;

export interface AppSidebarProps {
  /** The signed-in account (RightsUser shape + email for the user row). */
  user: AppSidebarUser;
  /** Opens the shared FeedbackDialog (owned by the AppShell composition). */
  onSendFeedback?: () => void;
}

const EMPTY_TREE: SidebarTree = {
  top: [],
  groups: [],
  suppressGroupHeaders: false,
  personal: [],
};

export function AppSidebar({ user, onSendFeedback }: AppSidebarProps) {
  const t = useTranslations();
  const config = React.useContext(ConfigContext);
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();

  const tree = React.useMemo<SidebarTree>(
    () => (user ? groupsFor(user, config ?? {}) : EMPTY_TREE),
    [user, config],
  );

  // Rail = collapsed desktop sidebar; tooltips that exist only for the rail
  // mirror the vendored SidebarMenuButton visibility logic.
  const isRail = state === "collapsed" && !isMobile;

  const handleSelect = React.useCallback(
    (entry: NavEntry) => {
      // Drawer closes on every activation (navigation.md §5.2).
      setOpenMobile(false);
      if (entry.id === "send-feedback") onSendFeedback?.();
    },
    [setOpenMobile, onSendFeedback],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Brand row: logo + name, collapse trigger at the right edge. In
            rail mode the row stacks: centered mark above the trigger. */}
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <Brand className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label={t("navigation.collapseSidebar")}
                className="size-7 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <PanelLeft aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            {/* Surfaces the existing ⌘B shortcut (shell audit L3). */}
            <TooltipContent side="right" align="center">
              {t("navigation.collapseSidebar")}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Search affordance (§2): a ghost, input-shaped button — it opens
            the command palette, it is not itself an input. Rail mode
            collapses it to an icon button with the same tooltip + shortcut. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openCommandPalette()}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2 text-sm text-muted-foreground",
                "transition-colors duration-150 ease-in-out hover:bg-sidebar-accent/50 hover:text-sidebar-foreground motion-reduce:transition-none",
                "ring-offset-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2",
                "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-0",
              )}
            >
              <Search aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
                {t("navigation.search")}
              </span>
              <kbd className="pointer-events-none shrink-0 select-none font-mono text-xs group-data-[collapsible=icon]:hidden">
                {PALETTE_SHORTCUT}
              </kbd>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            hidden={!isRail}
            className="flex items-center gap-2"
          >
            <span>{t("navigation.search")}</span>
            <kbd className="pointer-events-none select-none font-mono text-xs text-muted-foreground">
              {PALETTE_SHORTCUT}
            </kbd>
          </TooltipContent>
        </Tooltip>
      </SidebarHeader>

      <SidebarContent className="scrollbar-subtle gap-0">
        {/* Top, ungrouped rows (Home) — px-2 per NavItem's mount contract. */}
        {tree.top.length > 0 ? (
          <div className="px-2 pt-2">
            <SidebarMenu>
              {tree.top.map((entry) => (
                <NavItem key={entry.id} entry={entry} onSelect={handleSelect} />
              ))}
            </SidebarMenu>
          </div>
        ) : null}

        {tree.groups.map((view, index) => (
          <NavGroup
            key={view.group}
            group={view.group}
            entries={view.entries}
            collapsible={view.collapsible}
            suppressHeader={tree.suppressGroupHeaders}
            first={index === 0}
            onSelect={handleSelect}
          />
        ))}
      </SidebarContent>

      {/* Footer (§2): anchored at the bottom, separated by a hairline. */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {tree.personal.map((entry) => (
            <NavItem key={entry.id} entry={entry} onSelect={handleSelect} />
          ))}
          <UserMenu user={user} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
