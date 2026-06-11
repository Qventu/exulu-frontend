"use client";

/**
 * UserMenu — the sidebar footer's user row (navigation.md §2 "Footer").
 *
 * Avatar (initial, `bg-muted text-foreground` — no gradient/`text-white`
 * contrast trap, shell audit L8), name, chevron. Opens a DropdownMenu
 * upward with exactly:
 *
 *  - Theme — light / dark / system three-state (restores the lost `system`
 *    option, audit M8); the current choice carries a check.
 *  - Language — submenu listing every locale from i18n/config.ts (scales
 *    past en/de, audit M9). Switching goes through LanguageProvider's
 *    setLocale — the existing cookie-write + reload mechanism.
 *  - Settings — link to /settings.
 *  - Log out — the existing signout mechanism (router → /api/auth/signout).
 *
 * Nothing else: the Token link moved to the Develop nav group
 * (navigation.md §1.2). Touch targets are ≥44px below `md` (trigger h-12,
 * items min-h-11).
 *
 * Tier note: components/shell must not import from app/ (codebase-structure
 * §1.2), so the user arrives as a prop — the mounting shell composition
 * passes it down from UserContext/serverSideAuthCheck.
 */

import {
  Check,
  ChevronUp,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  SunMoon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useLanguage } from "@/components/shell/language-provider";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export interface UserMenuUser {
  email?: string | null;
}

export interface UserMenuProps {
  /** The signed-in account; only the email is consumed. */
  user: UserMenuUser | null | undefined;
  className?: string;
}

const THEME_OPTIONS: ReadonlyArray<{
  value: "light" | "dark" | "system";
  icon: LucideIcon;
  i18nKey: string;
}> = [
  { value: "light", icon: Sun, i18nKey: "navigation.userMenu.themeLight" },
  { value: "dark", icon: Moon, i18nKey: "navigation.userMenu.themeDark" },
  { value: "system", icon: Monitor, i18nKey: "navigation.userMenu.themeSystem" },
];

/**
 * Locale endonym ("English", "Deutsch") via Intl.DisplayNames — each language
 * names itself so users lost in a foreign locale can find their own. Scales
 * to any future entry in i18n/config.ts without new message keys.
 */
function localeEndonym(code: Locale): string {
  try {
    const label = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (!label) return code;
    return label.charAt(0).toLocaleUpperCase(code) + label.slice(1);
  } catch {
    return code;
  }
}

/**
 * Touch-target floor (navigation.md §5 #6): ≥44px below `md`, the menu's
 * natural density on desktop.
 */
const ITEM_CLASS = "min-h-11 gap-2 md:min-h-0";

const UserMenu = React.forwardRef<HTMLLIElement, UserMenuProps>(
  ({ user, className }, ref) => {
    const t = useTranslations();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const { locale, setLocale } = useLanguage();

    const email = user?.email ?? "";
    const name = email.split("@")[0] || t("navigation.userMenu.fallbackName");
    const initial = name.charAt(0).toUpperCase();

    const handleLocaleSelect = React.useCallback(
      (next: Locale) => {
        if (next === locale) return;
        try {
          // LanguageProvider#setLocale = cookie write + message load + reload —
          // the one existing switch mechanism (language-provider.tsx).
          void setLocale(next);
        } catch (error) {
          console.error("Failed to switch language:", error);
        }
      },
      [locale, setLocale],
    );

    // Existing signout mechanism (old main-nav.tsx), incl. its hard fallback.
    const handleSignOut = React.useCallback(() => {
      try {
        router.push("/api/auth/signout");
      } catch (error) {
        console.error("Failed to sign out:", error);
        window.location.href = "/api/auth/signout";
      }
    }, [router]);

    return (
      <SidebarMenuItem ref={ref} className={className}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t("navigation.userMenu.label")}
              className="data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
            >
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize group-data-[collapsible=icon]:hidden">
                {name}
              </span>
              <ChevronUp
                aria-hidden="true"
                className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-[--radix-popper-anchor-width] min-w-56"
          >
            {/* Theme — three-state, current choice checked (audit M8). */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={ITEM_CLASS}>
                <SunMoon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{t("navigation.userMenu.theme")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {THEME_OPTIONS.map(({ value, icon: Icon, i18nKey }) => (
                    <DropdownMenuItem
                      key={value}
                      className={ITEM_CLASS}
                      onClick={() => setTheme(value)}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{t(i18nKey)}</span>
                      <Check
                        aria-hidden="true"
                        className={cn(
                          "ml-2 size-4 shrink-0",
                          theme === value ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* Language — every locale from i18n/config.ts (audit M9). */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={ITEM_CLASS}>
                <Languages aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">
                  {t("navigation.userMenu.language")}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {locales.map((code) => (
                    <DropdownMenuItem
                      key={code}
                      className={ITEM_CLASS}
                      onClick={() => handleLocaleSelect(code)}
                    >
                      <span className="flex-1 truncate">
                        {localeEndonym(code)}
                      </span>
                      <Check
                        aria-hidden="true"
                        className={cn(
                          "ml-2 size-4 shrink-0",
                          locale === code ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className={ITEM_CLASS}>
              <Link href="/settings">
                <Settings aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{t("navigation.settings")}</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem className={ITEM_CLASS} onClick={handleSignOut}>
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{t("navigation.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  },
);
UserMenu.displayName = "UserMenu";

export { UserMenu };
