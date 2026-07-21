/**
 * Public agents route-group layout — wraps all /public/agents/* routes.
 *
 * - Same head/theme/providers as (authentication) layout: white-label theming
 *   via backend `GET /theme` CSS variables, backend favicons, locale from the
 *   NEXT_LOCALE cookie, ConfigContextProvider + LanguageProvider + ThemeProvider
 *   + Toaster.
 * - NO AuthShell wrapper: individual pages decide their own frame.
 * - Exposes `public_auth.otp_available` in the config context so pages can
 *   gate OTP flows on EMAIL_SERVER_HOST being set.
 */
import "../../globals.css";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  const config = {
    backend: process.env.BACKEND || "",
    google_client_id: "",
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
              {children}
              <Toaster />
            </ThemeProvider>
          </LanguageProvider>
        </ConfigContextProvider>
      </body>
    </html>
  );
}
