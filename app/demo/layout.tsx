import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import type { Viewport } from "next";
import * as React from "react";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import { LanguageProvider } from "@/components/shell/language-provider";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { TourProvider } from "@/components/demo/tour-provider";
import { isDemoMode } from "@/lib/demo/flag";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fail closed: a customer deployment that ships this route group must not
  // serve it.
  if (!isDemoMode()) notFound();

  // The tour renders the real chat components, and every one of them calls
  // useTranslations("chat") — without messages in context the whole surface
  // throws on mount. The demo is English-only: there is no locale cookie to
  // read, unlike the (application) layout.
  const messages = (await import("../../messages/en.json")).default;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
      </head>
      <body className={cn("bg-background font-sans antialiased", fontVariables)}>
        <LanguageProvider initialLocale="en" initialMessages={messages}>
          {/*
            The SAME provider and props as the (application) layout, and that
            matching matters more than the values. The tour crosses between the
            two route groups — chapters 1 and 4 render here, 2 and 3 over there
            — and next-themes only applies the `dark` class where it is
            mounted. Without it here the demo read the visitor's stored theme on
            the product routes and ignored it on the chat routes, so the whole
            application appeared to switch from dark to light halfway through
            the tour and back again.
          */}
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          {/*
            TourProvider derives its position from ?tour= via useSearchParams,
            which opts its subtree into client rendering. Without a boundary
            here that bails out the entire route and `next build` fails to
            prerender /demo/tour at all. tsc, eslint and the unit tests all
            pass regardless — the production build is the only gate that
            catches it, which is why it belongs in the pre-push routine.
          */}
            <React.Suspense fallback={null}>
              <TourProvider>{children}</TourProvider>
            </React.Suspense>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
