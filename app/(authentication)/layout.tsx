import Script from "next/script";
import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { TanstackQueryClientProvider } from "@/app/(application)/query-client";
import { ConfigContextProvider } from "@/components/config-context";
import { config as apiConfig } from "@/util/api";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = {
    backend: process.env.BACKEND || "",
    google_client_id: process.env.GOOGLE_CLIENT_ID || "",
    auth_mode: process.env.AUTH_MODE || "",
  };

  const themeConfig = await apiConfig.theme();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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

      <ConfigContextProvider config={config}>
        <TanstackQueryClientProvider>
          <body
            className={cn(
              "min-h-screen flex flex-col bg-background font-sans antialiased max-h-screen overflow-y-hidden",
              fontVariables
            )}
          >
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <main className="grow flex">
                <div className="grow flex flex-col">{children}</div>
              </main>
              <Toaster />
              <footer className="flex items-center h-20 gap-1 px-8 font-medium border-t md:px-20">
                <img
                  src={config.backend + "/logo.png"}
                  alt="Logo"
                  className="dark:invert-0"
                  width={64}
                  height={32}
                />
                <span className="text-sm ml-2">© 2025</span>
                <nav className="flex justify-end grow sm:gap-2">
                  <a
                    className="flex gap-2 px-3 py-2 text-sm font-semibold text-gray-600 transition duration-100 rounded-md hover:text-gray-800"
                    href="https://www.exulu.com/toc"
                  >
                    <span>Terms and conditions</span>
                  </a>
                </nav>
              </footer>
            </ThemeProvider>
          </body>
        </TanstackQueryClientProvider>
      </ConfigContextProvider>
    </html>
  );
}
