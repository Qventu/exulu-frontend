import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import * as React from "react";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers"
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import Authenticated from "@/app/(application)/authenticated";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { ConfigContextProvider } from "@/components/config-context";
import { configApi, BackendConfigType } from "@/lib/api/config";
import { LanguageProvider } from "@/components/language-provider";
import { LOCALE_COOKIE, Locale, defaultLocale } from "@/i18n/config";

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies()
    const sidebarCookie = cookieStore.get("sidebar_state")?.value
    const defaultOpen = sidebarCookie === undefined ? true : sidebarCookie === "true"
    const locale = (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;

    const headersList = await headers()
    const pathname = headersList.get('x-next-pathname') || '/';

    const user = await serverSideAuthCheck();
    if (!user) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);

    const backend = await configApi.backend();
    const json: BackendConfigType = await backend.json();

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
        ...json
    }

    const themeConfig = await configApi.theme();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <link rel="icon" href={process.env.BACKEND + "/icon_16x16.png"} type="image/png" sizes="16x16" />
                <link rel="icon" href={process.env.BACKEND + "/icon_32x32.png"} type="image/png" sizes="32x32" />
                <link rel="icon" href={process.env.BACKEND + "/icon_48x48.png"} type="image/png" sizes="48x48" />
                <link rel="icon" href={process.env.BACKEND + "/icon_512x512.png"} type="image/png" sizes="512x512" />
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
                            defaultTheme="system"
                            enableSystem
                            disableTransitionOnChange>
                            <main className="grow flex min-w-0 w-full">
                                <div className="grow flex flex-col min-w-0 w-full">
                                    <Authenticated sidebarDefaultOpen={defaultOpen} user={user} config={config}>
                                        {children}
                                    </Authenticated>
                                </div>
                            </main>
                            <Toaster />
                            <SonnerToaster />
                        </ThemeProvider>
                    </LanguageProvider>
                </ConfigContextProvider>
            </body>
        </html>
    );
}
