import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import * as React from "react";
import { cn } from "@/lib/utils";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { TanstackQueryClientProvider } from "@/app/(application)/query-client";
import Authenticated from "@/app/(application)/authenticated";
import { Toaster } from "@/components/ui/toaster";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { ConfigContextProvider } from "@/components/config-context";

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    const headersList = headers();
    const pathname = headersList.get('x-next-pathname') || '/';

    const user = await serverSideAuthCheck();
    if (!user) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);

    const config = {
        backend: process.env.BACKEND || "",
        google_client_id: process.env.GOOGLE_CLIENT_ID || "",
        auth_mode: process.env.AUTH_MODE || "",
        langfuse: process.env.LANGFUSE_URI || ""
    }

    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={cn(
                    `min-h-screen flex flex-col bg-background font-sans antialiased h-[100vh]`,
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
                                    <Authenticated user={user}>
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
