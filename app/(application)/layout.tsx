import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import * as React from "react";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers"
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { TanstackQueryClientProvider } from "@/app/(application)/query-client";
import Authenticated from "@/app/(application)/authenticated";
import { Toaster } from "@/components/ui/toaster";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { ConfigContextProvider } from "@/components/config-context";
import { config as api, BackendConfigType } from "@/util/api";
import { config as apiConfig } from "@/util/api";

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies()
    const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

    const headersList = headers();
    const pathname = headersList.get('x-next-pathname') || '/';

    const user = await serverSideAuthCheck();
    if (!user) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);

    const backend = await api.backend();
    console.log("[EXULU] backend", backend)
    const json: BackendConfigType = await backend.json();

    const config = {
        backend: process.env.BACKEND || "",
        google_client_id: process.env.GOOGLE_CLIENT_ID || "",
        auth_mode: process.env.AUTH_MODE || "",
        ...json
    }

    const themeConfig = await apiConfig.theme();

    return (
        <html lang="en" suppressHydrationWarning>
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
                <script type="module" defer src="https://cdn.jsdelivr.net/npm/ldrs/dist/auto/grid.js"></script>
                <ConfigContextProvider config={config}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange>
                        <main className="grow flex">
                            <div className="grow flex flex-col">
                                <TanstackQueryClientProvider>
                                    <Authenticated sidebarDefaultOpen={defaultOpen} user={user}>
                                        {children}
                                    </Authenticated>
                                </TanstackQueryClientProvider>
                            </div>
                        </main>
                        <Toaster />
                    </ThemeProvider>
                </ConfigContextProvider>
            </body>
        </html>
    );
}
