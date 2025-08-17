"use client";

import {
  PanelLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/models/user-role";

const buildNavigation = (user, role: UserRole) => {
  const navigationItems: { label: string; path: string }[] = [];

  if (user.super_admin) {
    navigationItems.push({
      label: "Dashboard",
      path: "dashboard",
    });
  }

  navigationItems.push({
    label: "Data",
    path: "data",
  });

  navigationItems.push({
    label: "Jobs",
    path: "jobs",
  });
  
  if (user.super_admin || role.agents === "write") {
    navigationItems.push({
      label: "Agents",
      path: "agents",
    });
  }

  navigationItems.push({
    label: "Chat",
    path: "chat",
  });

  if (user.super_admin || role.workflows === "write") {
    navigationItems.push({
      label: "Workflows",
      path: "workflows",
    });
  }

  if (user.super_admin || role.users === "write") {
    navigationItems.push({
      label: "Users",
      path: "users",
    });
  }

  if (user.super_admin || role.api === "write") {
    navigationItems.push({
      label: "Keys",
      path: "keys",
    });
  }

  if (user.super_admin || role.variables === "write") {
    navigationItems.push({
      label: "Variables",
      path: "variables",
    });
  }

  if (user.super_admin || role.api === "write") {
    navigationItems.push({
      label: "API",
      path: "explorer",
    });
  }

  return navigationItems;
}

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();

  const { user, setUser } = useContext(UserContext);

  const [sheetOpen, setSheetOpen] = useState(false);

  let navigationItems = buildNavigation(user, user.role);

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-4 bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <PanelLeft className="size-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <nav className="grid gap-6 text-lg font-medium">
              {navigationItems.map((navItem, index) => (
                <Link
                  key={index}
                  href={`/${navItem.path}`}
                  className={cn(
                    pathname.includes(navItem.path) && "text-secondary",
                    `flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground`,
                  )}
                >
                  {navItem.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </header>
      <nav
        className={cn(
          "hidden lg:flex items-center space-x-4 lg:space-x-6",
          className,
        )}
        {...props}
      >
        {navigationItems.map((navItem, index) => (
          <Link
            href={`/${navItem.path}`}
            key={index}
            className={cn(
              !pathname.includes(navItem.path) && "text-muted-foreground",
              `text-sm font-medium transition-colors hover:text-primary`,
            )}
          >
            {navItem.label}
          </Link>
        ))}
        {/*<Link
                href="/settings"
                className={cn(
                    pathname !== "settings" && "text-muted-foreground",
                    `text-sm font-medium transition-colors hover:text-primary`,
                )}
            >
                Settings
            </Link>*/}
      </nav>
    </>
  );
}
