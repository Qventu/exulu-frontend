"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import * as React from "react";
import { useContext, useEffect, useMemo, useState, useCallback } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/models/user-role";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { ChevronUp, ChevronDown, Moon, Sun, Code, MessageCircle, Users, Key, LayoutDashboard, Database, ListTodo, Bot, Route, Variable, FileCheck, Sparkles, Settings, LogOut, FileText, FolderOpen, Brain, Album, BookCheck, TextSelect, ClipboardType, BarChart2, BarChart, BarChart4, Workflow, Form, FileAudio, Languages, MessageSquare, ThumbsUp, Palette, Gamepad2, Cpu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "next-intl";
import { FeedbackButton } from "@/components/feedback/feedback-button";

interface User {
  email: string;
  super_admin: boolean;
  role: UserRole;
}

interface Config {
  n8n?: {
    enabled?: boolean;
    url?: string;
  };
}

// Error boundary for navigation
class NavigationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Navigation error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen p-8 bg-background">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Navigation Error</h2>
            <p className="text-sm text-muted-foreground">
              Something went wrong loading the navigation. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const buildNavigation = (user: User, role: UserRole, config: Config, t: any) => {
  const mainNavigationItems: { label: string; path: string; icon: React.ReactNode }[] = [];
  const bottomNavigationItems: { label: string; path: string; icon: React.ReactNode }[] = [];


  mainNavigationItems.push({
    label: t('navigation.chat'),
    path: "chat",
    icon: <MessageCircle className="h-4 w-4" strokeWidth={1.5} />,
  });

  mainNavigationItems.push({
    label: t('navigation.agents'),
    path: "agents",
    icon: <Bot className="h-4 w-4" strokeWidth={1.5} />,
  });  

  mainNavigationItems.push({
    label: t('navigation.knowledge'),
    path: "data",
    icon: <Brain className="h-4 w-4" strokeWidth={1.5} />,
  });

  mainNavigationItems.push({
    label: t('navigation.prompts'),
    path: "prompts",
    icon: <ClipboardType className="h-4 w-4" strokeWidth={1.5} />,
  });

  mainNavigationItems.push({
    label: t('navigation.skills'),
    path: "skills",
    icon: <Sparkles className="h-4 w-4" strokeWidth={1.5} />,
  });

  mainNavigationItems.push({
    label: t('navigation.projects'),
    path: "projects",
    icon: <FolderOpen className="h-4 w-4" strokeWidth={1.5} />,
  });

  if (user.super_admin || role.workflows === "write") {
    mainNavigationItems.push({
      label: t('navigation.routines'),
      path: "workflows",
      icon: <Form className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin || role.evals === "read" || role.evals === "write") {
    mainNavigationItems.push({
      label: t('navigation.evals'),
      path: "evals",
      icon: <BookCheck className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin) {
    mainNavigationItems.push({
      label: t('navigation.feedback'),
      path: "feedback",
      icon: <ThumbsUp className="h-4 w-4" strokeWidth={1.5} />,
    });
  }


  mainNavigationItems.push({
    label: t('navigation.transcriptions'),
    path: "transcriptions",
    icon: <FileAudio className="h-4 w-4" strokeWidth={1.5} />,
  });

  if (
    (user.super_admin || role.workflows === "write")
    && config.n8n?.enabled
  ) {
    mainNavigationItems.push({
      label: t('navigation.automation'),
      path: "n8n",
      icon: <Workflow className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin || role.users === "write") {
    bottomNavigationItems.push({
      label: t('navigation.users'),
      path: "users",
      icon: <Users className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin) {
    bottomNavigationItems.push({
      label: t('navigation.analytics'),
      path: "analytics",
      icon: <BarChart4 className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  // Bottom navigation items
  if (user.super_admin || role.api === "write") {
    bottomNavigationItems.push({
      label: t('navigation.apiPlayground'),
      path: "explorer",
      icon: <Code className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin) {
    bottomNavigationItems.push({
      label: t('navigation.themeSettings'),
      path: "configuration",
      icon: <Palette className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin || role.api === "write") {
    bottomNavigationItems.push({
      label: t('navigation.apiKeys'),
      path: "keys",
      icon: <Key className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin || role.variables === "write") {
    bottomNavigationItems.push({
      label: t('navigation.systemVariables'),
      path: "variables",
      icon: <Variable className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  if (user.super_admin || role.agents === "write") {
    bottomNavigationItems.push({
      label: "Models",
      path: "models",
      icon: <Cpu className="h-4 w-4" strokeWidth={1.5} />,
    });
  }

  return { mainNavigationItems, bottomNavigationItems };
}

function NavigationItems({ items }: { items: { label: string; path: string; icon: React.ReactNode }[] }) {
  const pathname = usePathname();

  // Handle empty items gracefully
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <SidebarMenu className="space-y-0">
      {items.map((navItem) => {
        const isActive = pathname.includes(navItem.path);
        return (
          <SidebarMenuItem key={navItem.path}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={navItem.label}
              className={cn(
                "h-9 transition-all duration-200",
                !isActive && "opacity-60 hover:opacity-100"
              )}
            >
              <Link
                href={`/${navItem.path}`}
                className="flex items-center gap-3 min-w-0"
              >
                <span className="flex-shrink-0">
                  {navItem.icon}
                </span>
                <span className={cn(
                  "font-medium transition-colors truncate",
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

function AdminNavigationSection({
  items,
  label
}: {
  items: { label: string; path: string; icon: React.ReactNode }[];
  label: string;
}) {
  const pathname = usePathname();
  const { state } = useSidebar();

  // Check if any admin item is currently active
  const isAnyAdminPageActive = items.some(item => pathname.includes(item.path));

  // Auto-expand if on admin page, otherwise collapse
  const [isOpen, setIsOpen] = useState(isAnyAdminPageActive);

  // Update open state when pathname changes
  useEffect(() => {
    setIsOpen(isAnyAdminPageActive);
  }, [isAnyAdminPageActive]);

  // Handle empty items gracefully
  if (!items || items.length === 0) {
    return null;
  }

  // When sidebar is collapsed (icon only), show as regular nav item with tooltip
  if (state === "collapsed") {
    return (
      <SidebarMenu className="space-y-0">
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={label}
            isActive={isAnyAdminPageActive}
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "h-9 transition-all duration-200",
              !isAnyAdminPageActive && "opacity-60 hover:opacity-100"
            )}
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
      <CollapsibleContent className="transition-all duration-200 ease-in-out overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <SidebarMenu className="space-y-0 mb-0">
          {items.map((navItem) => {
            const isActive = pathname.includes(navItem.path);
            return (
              <SidebarMenuItem key={navItem.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={navItem.label}
                  className={cn(
                    "h-9 transition-all duration-200",
                    !isActive && "opacity-60 hover:opacity-100"
                  )}
                >
                  <Link
                    href={`/${navItem.path}`}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <span className="flex-shrink-0">
                      {navItem.icon}
                    </span>
                    <span className="font-medium transition-colors truncate">
                      {navItem.label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </CollapsibleContent>

      <SidebarMenu className="space-y-0">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={label}
              className={cn(
                "h-9 transition-all duration-200 w-full",
                !isAnyAdminPageActive && "opacity-60 hover:opacity-100"
              )}
              isActive={isAnyAdminPageActive}
            >
              <Settings className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
              <span className="font-medium truncate">{label}</span>
              <ChevronUp
                className={cn(
                  "ml-auto h-4 w-4 flex-shrink-0 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
                strokeWidth={1.5}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>
      </SidebarMenu>
    </Collapsible>
  );
}

export function MainNavSidebar({ sidebarDefaultOpen, config }: { sidebarDefaultOpen: boolean, config: Config }) {

  const { user } = useContext(UserContext);
  const t = useTranslations();
  const { locale, setLocale } = useLanguage();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const params = useParams()
  const sidebar = useSidebar()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fallback for missing user data
  const userEmail = user?.email || "user@example.com";
  const userName = userEmail.split('@')[0];
  const userDomain = userEmail.split('@')[1] || "";
  const userInitial = userName.charAt(0).toUpperCase() || "U";

  // Memoize navigation items to prevent unnecessary rebuilds
  const { mainNavigationItems, bottomNavigationItems } = useMemo(
    () => {
      if (!user || !user.role) return { mainNavigationItems: [], bottomNavigationItems: [] };
      return buildNavigation(user, user.role, config, t);
    },
    [user, user?.role, config, t]
  );

  // Close sidebar for agent detail pages
  useEffect(() => {
    if (params.agent && sidebarDefaultOpen === undefined) {
      sidebar.setOpen(false)
    }
  }, [params.agent, sidebar, sidebarDefaultOpen])

  // Keyboard navigation: ESC to close dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  // Handle theme toggle with error recovery
  const handleThemeToggle = useCallback(() => {
    try {
      setTheme(theme === "dark" ? "light" : "dark");
    } catch (error) {
      console.error("Failed to toggle theme:", error);
    }
  }, [theme, setTheme]);

  // Handle locale toggle with error recovery
  const handleLocaleToggle = useCallback(() => {
    try {
      setLocale(locale === 'en' ? 'de' : 'en');
    } catch (error) {
      console.error("Failed to toggle locale:", error);
    }
  }, [locale, setLocale]);

  // Handle signout with error recovery
  const handleSignout = useCallback(() => {
    try {
      router.push("/api/auth/signout");
    } catch (error) {
      console.error("Failed to sign out:", error);
      // Fallback: force page reload to sign out
      window.location.href = "/api/auth/signout";
    }
  }, [router]);

  // Loading state
  if (!user) {
    return (
      <Sidebar collapsible="icon" className="border-r">
        <div className="flex items-center gap-3 border-b bg-sidebar p-3 sticky top-0 z-10">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-6 w-20 rounded bg-muted animate-pulse" />
        </div>
        <SidebarContent className="px-2">
          <SidebarGroup className="mt-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r">
      <div className="flex items-center gap-3 border-b bg-sidebar p-3 sticky top-0 z-10">
        <SidebarTrigger aria-label="Toggle sidebar navigation" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">AI Studio</span>
        </div>
      </div>
      <SidebarContent className="px-2">
        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <NavigationItems items={mainNavigationItems} />
          </SidebarGroupContent>
        </SidebarGroup>
        {bottomNavigationItems.length > 0 && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <AdminNavigationSection items={bottomNavigationItems} label={t('navigation.admin')} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-1.5 mt-2">
        <SidebarMenu>
          <FeedbackButton />
          <SidebarMenuItem>
            <DropdownMenu
              modal={false}
              open={isDropdownOpen}
              onOpenChange={setIsDropdownOpen}
            >
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className="h-12 hover:bg-accent/50"
                  aria-label="Open user menu"
                  aria-expanded={isDropdownOpen}
                >
                  <Avatar className="h-5 w-5 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/60 text-white text-sm">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                    <span className="text-sm font-medium capitalize truncate max-w-full">
                      {userName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-full">
                      {userDomain}
                    </span>
                  </div>
                  <ChevronUp
                    className={cn(
                      "ml-auto h-4 w-4 flex-shrink-0 group-data-[collapsible=icon]:hidden transition-transform",
                      isDropdownOpen && "rotate-180"
                    )}
                    strokeWidth={1.5}
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width] mb-2"
                align="start"
              >
                <DropdownMenuItem onClick={handleThemeToggle}>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    ) : (
                      <Moon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    )}
                    <span className="truncate">{t('navigation.theme')}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLocaleToggle}>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <Languages className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">
                      {locale === 'en' ? 'Deutsch' : 'English'}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 w-full min-w-0">
                    <Settings className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{t('navigation.settings')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignout}>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <LogOut className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{t('navigation.logout')}</span>
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

export function MainNavProvider({ children, sidebarDefaultOpen, config }: { children: React.ReactNode, sidebarDefaultOpen: boolean, config: Config }) {
  return (
    <NavigationErrorBoundary>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <div className="flex w-full bg-background overflow-clip">
          <MainNavSidebar sidebarDefaultOpen={sidebarDefaultOpen} config={config} />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </NavigationErrorBoundary>
  );
}
