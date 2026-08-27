import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import type { Viewport } from "next";
import * as React from "react";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import { TourProvider } from "@/components/demo/tour-provider";
import { isDemoMode } from "@/lib/demo/flag";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // Fail closed: a customer deployment that ships this route group must not
  // serve it.
  if (!isDemoMode()) notFound();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={process.env.BACKEND + "/favicon.png"} type="image/png" />
      </head>
      <body className={cn("bg-background font-sans antialiased", fontVariables)}>
        <TourProvider>{children}</TourProvider>
      </body>
    </html>
  );
}
