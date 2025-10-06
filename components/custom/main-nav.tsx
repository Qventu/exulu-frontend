"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import * as React from "react";
import { useContext, useEffect } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/models/user-role";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { ChevronUp, Moon, Sun, Code, MessageCircle, Users, Key, LayoutDashboard, Database, ListTodo, Bot, Route, Variable, FileCheck, Sparkles, Settings, LogOut, FileText, FolderOpen, Brain } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "../ui/avatar";
import Image from "next/image"
import { ConfigContext } from "../config-context";

interface User {
  email: string;
  super_admin: boolean;
  role: UserRole;
}

const buildNavigation = (user: User, role: UserRole) => {
  const navigationItems: { label: string; path: string; icon: React.ReactNode }[] = [];

  if (user.super_admin) {
    navigationItems.push({
      label: "Dashboard",
      path: "dashboard",
      icon: <LayoutDashboard />,
    });
  }

  navigationItems.push({
    label: "Contexts",
    path: "data",
    icon: <Database />,
  });

  navigationItems.push({
    label: "Jobs",
    path: "jobs",
    icon: <ListTodo />,
  });

  if (user.super_admin || role.agents === "write") {
    navigationItems.push({
      label: "Agents",
      path: "agents",
      icon: <Bot />,
    });
  }

  navigationItems.push({
    label: "Projects",
    path: "projects",
    icon: <FolderOpen />,
  });

  navigationItems.push({
    label: "Chat",
    path: "chat",
    icon: <MessageCircle />,
  });

  if (user.super_admin || role.evals === "read" || role.evals === "write") {
    navigationItems.push({
      label: "Evals",
      path: "evals",
      icon: <Brain />,
    });
  }

  if (user.super_admin || role.workflows === "write") {
    navigationItems.push({
      label: "Workflows",
      path: "workflows",
      icon: <Route />,
    });
  }

  if (user.super_admin || role.users === "write") {
    navigationItems.push({
      label: "Users",
      path: "users",
      icon: <Users />,
    });
  }

  if (user.super_admin || role.api === "write") {
    navigationItems.push({
      label: "Keys",
      path: "keys",
      icon: <Key />,
    });
  }

  if (user.super_admin || role.variables === "write") {
    navigationItems.push({
      label: "Variables",
      path: "variables",
      icon: <Variable />,
    });
  }

  if (user.super_admin || role.api === "write") {
    navigationItems.push({
      label: "API",
      path: "explorer",
      icon: <Code />,
    });
  }

  return navigationItems;
}

function NavigationItems({ items }: { items: { label: string; path: string; icon: React.ReactNode }[] }) {
  const pathname = usePathname();

  return (
    <SidebarMenu className="space-y-1">
      {items.map((navItem, index) => {
        const isActive = pathname.includes(navItem.path);
        return (
          <SidebarMenuItem key={index}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={navItem.label}
              className={cn(
                "h-10 transition-all duration-200",
                isActive && "bg-gradient-to-r from-purple-500/10 to-purple-500/10"
              )}
            >
              <Link href={`/${navItem.path}`} className="flex items-center gap-3">
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center transition-colors",
                  isActive && "text-purple-500"
                )}>
                  {navItem.icon}
                </div>
                <span className={cn(
                  "font-medium transition-colors",
                  isActive && "text-purple-500"
                )}>
                  {navItem.label}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function MainNavSidebar({ sidebarDefaultOpen }: { sidebarDefaultOpen: boolean }) {
  const { user } = useContext(UserContext);
  const navigationItems = buildNavigation(user, user.role);
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const params = useParams()
  const sidebar = useSidebar()

  const configContext = useContext(ConfigContext)

  useEffect(() => {
    if (params.agent && sidebarDefaultOpen === undefined) {
      sidebar.setOpen(false)
    }
  }, [params.agent])

  return (
    <Sidebar collapsible="icon" className="border-r">
      <div className="flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm p-[12px] sticky top-0 z-10">
        <SidebarTrigger />
        <div className="flex items-center gap-2">
          <Image src={configContext?.backend + "/logo.png"} height={40} width={100} alt="Logo" />
        </div>
      </div>
      <SidebarContent className="px-2">
        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <NavigationItems items={navigationItems} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t bg-muted/20 p-[5px]">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-12 hover:bg-accent/50">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-gradient-to-br from-purple-200 to-purple-600 text-white text-sm">
                      {user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                    <span className="text-sm font-medium capitalize">{user.email.split('@')[0]}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{user.email.split('@')[1]}</span>
                    </div>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width] mb-2"
                align="start"
              >
                <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  <div className="flex items-center gap-2 w-full">
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span>Theme</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/api/auth/signout")}>
                  <div className="flex items-center gap-2 w-full">
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open("https://www.exulu.com/toc", "_blank")}>
                  <div className="flex items-center gap-2 w-full">
                    <FileText className="h-4 w-4" />
                    <span>Terms</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function MainNavProvider({ children, sidebarDefaultOpen }: { children: React.ReactNode, sidebarDefaultOpen: boolean }) {
  console.log("sidebarDefaultOpen", sidebarDefaultOpen)
  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <div className="flex h-screen w-full bg-background">
        <MainNavSidebar sidebarDefaultOpen={sidebarDefaultOpen} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
