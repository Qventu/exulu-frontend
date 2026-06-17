"use client";

/**
 * TopBar — the desktop chrome bar (navigation.md §3, product decision
 * 2026-06-11: the "no desktop top bar" rule is superseded by the unified
 * chrome look — top bar + sidebar share the `--sidebar` background and the
 * page content sits in an inset card with a rounded top-left corner).
 *
 * Layout (≥ md only; below `md` the MobileTopbar owns the chrome):
 *   [collapse trigger · Brand] ............ [Feedback · search ⌘K · avatar]
 *
 * - Fixed, h-12, z-20: it overlays the top 3rem of the fixed sidebar — same
 *   background, so the seam is invisible and the nav column reads as
 *   starting below the bar (the sidebar pads its content down to match).
 * - No border-b: separation comes from the content card's top edge, so the
 *   chrome "flows" into the page surface.
 * - The search affordance is the input-shaped ⌘K button (moved here from
 *   the sidebar header); it opens the command palette, it is not an input.
 * - Feedback is a quiet ghost button (config-gated), sharing the single
 *   FeedbackDialog instance owned by the AppShell.
 * - The avatar (UserMenu) anchors the top-right, opening downward.
 */

import { PanelLeft, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Brand } from "@/components/shell/brand";
import { openCommandPalette } from "@/components/shell/command-palette";
import { ConfigContext } from "@/components/shell/config-context";
import { TopBarBudget } from "@/components/shell/top-bar-budget";
import { UserMenu, type UserMenuUser } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type BudgetInfo } from "@/lib/budget";
import { cn } from "@/lib/utils";

/** Keyboard glyphs are not translated copy — they are the shortcut itself. */
const PALETTE_SHORTCUT = "⌘K";

export interface TopBarProps {
  /** The signed-in account (email feeds the avatar + identity header). */
  user: UserMenuUser | null | undefined;
  /**
   * The caller's live budget snapshot, or null when they have none / the
   * "Show budget status in chat" admin setting is off. Renders the compact
   * spend indicator next to the search affordance.
   */
  budget?: BudgetInfo | null;
  /** Opens the shared FeedbackDialog (owned by the AppShell composition). */
  onSendFeedback?: () => void;
  className?: string;
}

export function TopBar({ user, budget, onSendFeedback, className }: TopBarProps) {
  const t = useTranslations();
  const config = React.useContext(ConfigContext);
  const { toggleSidebar } = useSidebar();

  return (
    <header
      data-shell="top-bar"
      className={cn(
        "fixed inset-x-0 top-0 z-20 hidden h-12 items-center gap-2 bg-sidebar px-3 md:flex",
        className,
      )}
    >
      {/* Left cluster: collapse trigger + generic wordmark. */}
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
        <TooltipContent side="bottom" align="start">
          {t("navigation.collapseSidebar")}
        </TooltipContent>
      </Tooltip>
      <Brand className="shrink-0" />

      <div className="flex-1" />

      {/* Right cluster: Feedback · search ⌘K · avatar. */}
      {config?.feedback?.enabled === true && onSendFeedback ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSendFeedback}
          className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {t("navigation.sendFeedback")}
        </Button>
      ) : null}

      <TopBarBudget budget={budget ?? null} />

      <button
        type="button"
        onClick={() => openCommandPalette()}
        className={cn(
          "flex h-8 w-56 items-center gap-2 rounded-md border border-input bg-transparent px-2 text-sm text-muted-foreground lg:w-64",
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

      <UserMenu user={user} />
    </header>
  );
}
