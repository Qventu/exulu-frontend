import "../globals.css";
import { DEMO_BRAND } from "@/lib/demo/brand";
import { DEMO_THEME } from "@/lib/demo/theme";
import { fontVariables } from "@/lib/fonts";
import type { Viewport } from "next";
import * as React from "react";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers"
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/shell/theme-provider";
import Authenticated from "@/app/(application)/authenticated";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { ConfigContextProvider } from "@/components/shell/config-context";
import { configApi, BackendConfigType } from "@/lib/api/config";
import { LanguageProvider } from "@/components/shell/language-provider";
import { LOCALE_COOKIE, Locale, defaultLocale } from "@/i18n/config";
import { DEMO_BACKEND_CONFIG } from "@/lib/demo/config";
import { isDemoMode } from "@/lib/demo/flag";
import { getDemoUser } from "@/lib/demo/user";
import { TourOverlay } from "@/components/demo/tour-overlay";

// viewport-fit=cover so env(safe-area-inset-*) resolves on notched devices —
// the shell's mobile top bar and drawer pad themselves with it
// (navigation.md §5.6).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies()
    const sidebarCookie = cookieStore.get("sidebar_state")?.value
    const defaultOpen = sidebarCookie === undefined ? true : sidebarCookie === "true"
    // The demo is German end to end: the tour copy is German, the fixture
    // content is German, and the product ships a full de.json — leaving the
    // shell on the visitor's cookie meant German popovers over English labels.
    const cookieLocale = (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
    const locale = isDemoMode() ? ("de" as Locale) : cookieLocale;

    const headersList = await headers()
    const pathname = headersList.get('x-next-pathname') || '/';

    const demoMode = isDemoMode();

    const user = demoMode
      ? getDemoUser()
      : await (async () => {
          const u = await serverSideAuthCheck();
          if (!u) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);
          return u;
        })();

    // External (self-registered) users never enter the internal shell —
    // public-agents spec §4.4. Everything they may use lives under /public.
    if (!demoMode && user.type === "external") return redirect("/public/agents");

    // `{}` here is what put "Background workers are not configured" on the
    // tour's evals screen — the banner renders whenever workers.enabled is
    // falsy, and an empty config is falsy. lib/demo/config.ts justifies each
    // value it claims.
    const json: BackendConfigType = demoMode
      ? DEMO_BACKEND_CONFIG
      : await (async () => {
          const backend = await configApi.backend();
          return backend.json() as Promise<BackendConfigType>;
        })();

    // Load messages for the current locale
    const messages = (await import(`../../messages/${locale}.json`)).default;

    const config = {
        feedback: {
            // FEEDBACK_TOKEN is a server-only secret: it stays out of this
            // client-serialized config and is injected by /api/feedback/[kind].
            enabled: process.env.FEEDBACK_ENABLED === "true",
            backend: process.env.FEEDBACK_BACKEND || "",

            featureAgentSlug: process.env.FEATURE_AGENT_SLUG || "",
            featureAgentId: process.env.FEATURE_AGENT_ID || "",

            bugAgentSlug: process.env.BUG_AGENT_SLUG || "",
            bugAgentId: process.env.BUG_AGENT_ID || "",
        },
        backend: process.env.BACKEND || "",
        google_client_id: process.env.GOOGLE_CLIENT_ID || "",
        auth_mode: process.env.AUTH_MODE || "",
        n8n: {
            enabled: typeof process.env.N8N_URL === "string" && process.env.N8N_URL !== "",
            url: typeof process.env.N8N_URL === "string" ? process.env.N8N_URL : undefined,
        },
        transcription: {
            enabled:
                typeof process.env.TRANSCRIPTION_MODEL === "string" &&
                process.env.TRANSCRIPTION_MODEL !== "" &&
                process.env.EXULU_USE_LITELLM === "true",
        },
        tts: {
            enabled:
                typeof process.env.TTS_MODEL === "string" &&
                process.env.TTS_MODEL !== "" &&
                process.env.EXULU_USE_LITELLM === "true",
        },
        public_auth: {
            otp_available: !!process.env.EMAIL_SERVER_HOST,
        },
        ...json
    }

    // Themes arrive from the backend as token overrides and are injected below.
    // The demo has no backend to ask, so it substitutes the OPEN token set at
    // this one call site. Deliberately NOT a globals.css edit or a .theme-open
    // class: this is the same path a themed customer deployment already uses
    // via configuration/theme-studio, so the demo shows the product's own
    // tenant theming rather than a coat of paint, and cannot reach anyone else.
    //
    // lib/demo/theme.ts records what is unfinished: Poppins and Playfair are
    // not loaded and fall back, and the light palette's --primary is 2.19:1 as
    // a foreground while being used as one in about 135 places. The demo forces
    // dark below, which is what makes that survivable rather than fixed.
    const themeConfig = demoMode ? DEMO_THEME : await configApi.theme();

    // Same reason as the logo: BACKEND names a host nothing is serving in demo
    // mode, so the tab icon 404s for a lead arriving from a branded PDF.
    const favicon = demoMode
        ? DEMO_BRAND.favicon
        : process.env.BACKEND + "/favicon.png";

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <link rel="icon" href={favicon} type="image/png" />
                <link rel="apple-touch-icon" href={favicon} />
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
                    `flex flex-col bg-background font-sans antialiased`,
                    fontVariables,
                )}
            >
                <ConfigContextProvider config={config}>
                    <LanguageProvider initialLocale={locale} initialMessages={messages}>
                        <ThemeProvider
                            attribute="class"
                            /* Dark by default in the demo, and NOT following
                               the visitor's OS. A lead arrives from a dark
                               OPEN-branded PDF, and the palette was designed
                               dark-first: light mode's --primary is 2.19:1 as
                               a foreground, so a visitor on a light-mode
                               machine would have met the one combination that
                               is close to illegible. Everywhere else keeps
                               system, which is the product's own behaviour. */
                            defaultTheme={demoMode ? "dark" : "system"}
                            enableSystem={!demoMode}
                            forcedTheme={demoMode ? "dark" : undefined}
                            disableTransitionOnChange>
                            {/* The ONE <main> landmark (a11y fix M11) — every
                                inner content wrapper below this is a div. */}
                            <main className="grow flex min-w-0 w-full">
                                <div className="grow flex flex-col min-w-0 w-full">
                                    <Authenticated sidebarDefaultOpen={defaultOpen} user={user}>
                                        {children}
                                    </Authenticated>
                                </div>
                            </main>
                            {/* Chapters 3 and 4 end on product routes, which
                                live in this group rather than under /demo.
                                Without the overlay here the tour sends the
                                visitor here and strands them with no way on. */}
                            {demoMode && <TourOverlay />}
                            <SonnerToaster />
                        </ThemeProvider>
                    </LanguageProvider>
                </ConfigContextProvider>
            </body>
        </html>
    );
}
