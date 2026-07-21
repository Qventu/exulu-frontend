/**
 * (authentication) root layout — the standalone pre-auth shell
 * (design/pages/auth.md ladder #26-#28).
 *
 * - White-label theming kept: backend `GET /theme` CSS variables injected for
 *   `:root` + `.dark`, single backend favicon.png + manifest (ladder #27).
 * - i18n is now real pre-auth (fixes U6): locale from the `NEXT_LOCALE`
 *   cookie drives `<html lang>` and a LanguageProvider mirroring
 *   `app/(application)/layout.tsx` — the product's first screen speaks the
 *   user's language. The `auth.*` namespace lives in `messages/{en,de}.json`
 *   like every other feature namespace.
 * - The body scrolls naturally (`min-h-dvh`, responsive.md V1/V4): the old
 *   `max-h-screen overflow-y-hidden` keyboard trap is removed — the on-screen
 *   keyboard can no longer hide the submit button.
 * - Chrome (wordmark, cover pane, slim footer with dynamic © year, terms
 *   link, locale toggle) lives in the route-local AuthShell frame.
 */
import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import type { Viewport } from "next";
import { cookies } from "next/headers";
import * as React from "react";

import { ConfigContextProvider } from "@/components/shell/config-context";
import { LanguageProvider } from "@/components/shell/language-provider";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LOCALE_COOKIE, Locale, defaultLocale } from "@/i18n/config";
import { configApi } from "@/lib/api/config";
import { cn } from "@/lib/utils";

import { AuthShell } from "./components/auth-shell";

// viewport-fit=cover so env(safe-area-inset-*) resolves on notched devices —
// the AuthShell footer pads itself with it (responsive.md V3).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  const config = {
    backend: process.env.BACKEND || "",
    google_client_id: process.env.GOOGLE_CLIENT_ID || "",
    auth_mode: process.env.AUTH_MODE || "",
    public_auth: {
      otp_available: !!process.env.EMAIL_SERVER_HOST,
    },
  };

  const themeConfig = await configApi.theme();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
        <link rel="apple-touch-icon" href={process.env.BACKEND + "/favicon.png"} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
        :root {
          ${Object.entries(themeConfig.light || {})
                .map(([k, v]) => `${k}: ${v};`)
                .join("\n")}
        }
        .dark {
          ${Object.entries(themeConfig.dark || {})
                .map(([k, v]) => `${k}: ${v};`)
                .join("\n")}
        }
      `,
          }}
        />
      </head>

      <body
        className={cn(
          "flex min-h-dvh flex-col bg-background font-sans antialiased",
          fontVariables,
        )}
      >
        <ConfigContextProvider config={config}>
          <LanguageProvider initialLocale={locale} initialMessages={messages}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <AuthShell
                coverUrl={process.env.BACKEND ? `${process.env.BACKEND}/cover.jpg` : undefined}
                termsHref={process.env.TERMS_URL || undefined}
              >
                {children}
              </AuthShell>
              <Toaster />
            </ThemeProvider>
          </LanguageProvider>
        </ConfigContextProvider>
      </body>
    </html>
  );
}
