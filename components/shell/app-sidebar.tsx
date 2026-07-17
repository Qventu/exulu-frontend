"use client";

/**
 * AppSidebar — "The Spine" (design/navigation.md §2): the composed sidebar.
 *
 * Since the 2026-06-11 chrome decision (navigation.md §3) the sidebar is
 * pure navigation: brand, collapse trigger, search affordance and the user
 * menu live in the TopBar (desktop) / MobileTopbar (mobile). Desktop nav
 * content pads itself below the fixed h-12 TopBar — same `--sidebar`
 * background, so the bar and the nav column read as one chrome surface.
 *
 * Mobile drawer (the Sheet) keeps its own header with the ⌘K search
 * affordance, and a footer with the Send feedback entry — both invisible on
 * desktop, where those affordances live in the chrome bar.
 *
 * Mount contract:
 * - Inside `SidebarProvider` (tooltips + sidebar state) — the AppShell
 *   composition in app/(application)/authenticated.tsx owns that.
 * - `collapsible="icon"` is REQUIRED: NavItem/NavGroup drive their
 *   rail-mode swaps off the `group-data-[collapsible=icon]` attribute.
 * - The user arrives as a prop (the shell tier must not import from app/);
 *   `onSendFeedback` is owned by the AppShell so the drawer footer, the
 *   TopBar button and the command palette share ONE FeedbackDialog instance
 *   (mounted outside the mobile Sheet, which unmounts its children on
 *   close).
 * - Every item activation also closes the mobile drawer (navigation.md §5.2:
 *   "tapping any item navigates and closes").
 */

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { openCommandPalette } from "@/components/shell/command-palette";
import { ConfigContext } from "@/components/shell/config-context";
import {
  groupsFor,
  type NavEntry,
  type SidebarTree,
} from "@/components/shell/nav-config";
import { NavGroup } from "@/components/shell/nav-group";
import { NavItem } from "@/components/shell/nav-item";
import { useRunsAttentionCount } from "@/components/shell/use-runs-attention";
import { type UserMenuUser } from "@/components/shell/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import type { RightsUser } from "@/lib/rights";
import { cn } from "@/lib/utils";

/** Keyboard glyphs are not translated copy — they are the shortcut itself. */
const PALETTE_SHORTCUT = "⌘K";

export type AppSidebarUser = (RightsUser & UserMenuUser) | null | undefined;

export interface AppSidebarProps {
  /** The signed-in account (RightsUser shape + email for the user menu). */
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
  const { isMobile, setOpenMobile } = useSidebar();

  const tree = React.useMemo<SidebarTree>(
    () => (user ? groupsFor(user, config ?? {}) : EMPTY_TREE),
    [user, config],
  );

  // Needs-attention badge on the flag-gated /runs entry (design §7.3).
  const runsAttentionCount = useRunsAttentionCount(user);
  const badges = React.useMemo<Partial<Record<string, number>>>(
    () => ({ runs: runsAttentionCount }),
    [runsAttentionCount],
  );

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
      {/* Drawer-only header: the ⌘K affordance (desktop's lives in TopBar). */}
      {isMobile ? (
        <SidebarHeader>
          <button
            type="button"
            onClick={() => {
              setOpenMobile(false);
              openCommandPalette();
            }}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2 text-sm text-muted-foreground",
              "transition-colors duration-150 ease-in-out hover:bg-sidebar-accent/50 hover:text-sidebar-foreground motion-reduce:transition-none",
              "ring-offset-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2",
            )}
          >
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">
              {t("navigation.search")}
            </span>
            <kbd className="pointer-events-none shrink-0 select-none font-mono text-xs">
              {PALETTE_SHORTCUT}
            </kbd>
          </button>
        </SidebarHeader>
      ) : null}

      {/* Desktop: pad the nav column below the fixed h-12 TopBar (+ air),
          so the menu starts under the chrome bar (navigation.md §3). The
          `md:` guard keeps the mobile Sheet unaffected. */}
      <SidebarContent className="scrollbar-subtle gap-0 md:pt-14">
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
            badges={badges}
          />
        ))}
      </SidebarContent>

      {/* Drawer-only footer (Send feedback): on desktop the TopBar carries
          the Feedback button, and the avatar menu lives top-right. */}
      {isMobile && tree.personal.length > 0 ? (
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            {tree.personal.map((entry) => (
              <NavItem key={entry.id} entry={entry} onSelect={handleSelect} />
            ))}
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
