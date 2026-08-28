import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import type { Viewport } from "next";
import * as React from "react";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import { LanguageProvider } from "@/components/shell/language-provider";
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
          <TourProvider>{children}</TourProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
