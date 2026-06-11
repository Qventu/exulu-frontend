"use client";

/**
 * AppNavTrigger — the exported hamburger that opens the mobile nav drawer
 * (design/navigation.md §5.1/§5.3).
 *
 * Mountable ANYWHERE: the shell's MobileTopbar renders it on every non-chat
 * route, and ChatHeader mounts it as its leftmost control on chat sessions
 * (left = app nav, in-page = history — the chat.md collision resolution).
 *
 * - Opens the sidebar's mobile Sheet via useSidebar().setOpenMobile(true),
 *   so it must live under SidebarProvider (it already wraps the app shell).
 * - Hidden at `md` and up by default (the desktop sidebar is persistent
 *   chrome; navigation.md §3) — override via className if a host ever needs
 *   different breakpoint behavior.
 * - 44px touch target (size-11, navigation.md §5.6) around a size-4 icon.
 */

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type AppNavTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const AppNavTrigger = React.forwardRef<HTMLButtonElement, AppNavTriggerProps>(
  ({ className, onClick, ...props }, ref) => {
    const t = useTranslations("navigation");
    const { setOpenMobile } = useSidebar();

    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("openNavigation")}
        aria-haspopup="dialog"
        className={cn("size-11 shrink-0 md:hidden", className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpenMobile(true);
        }}
        {...props}
      >
        <Menu className="size-4" />
      </Button>
    );
  },
);
AppNavTrigger.displayName = "AppNavTrigger";

export { AppNavTrigger };
