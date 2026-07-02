import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import type { Viewport } from "next";
import * as React from "react";
import { cn } from "@/lib/utils";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function ArtifactsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("bg-background font-sans antialiased", fontVariables)}>
        {children}
      </body>
    </html>
  );
}
