import "../globals.css";
import { Inter as FontSans } from "next/font/google";
import * as React from "react";
import { cn } from "@/lib/utils";
import {Toaster} from "@/components/ui/toaster";
import Image from "next/image";
import {ThemeProvider} from "@/components/theme-provider";
import {TanstackQueryClientProvider} from "@/app/(application)/query-client";
const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
    <TanstackQueryClientProvider>
        <body
          className={cn(
            `flex flex-col bg-background font-sans antialiased`,
            fontSans.variable,
          )}
        >
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange>
          <main className="grow flex">
            <div className="grow flex flex-col">
              {children}
            </div>
          </main>
          <Toaster/>
          <footer className="flex items-center h-20 gap-1 px-8 font-medium border-t md:px-20">
            <Image
                src="/exulu_logo.svg"
                alt="Exulu Logo"
                className="invert dark:invert-0"
                width={64}
                height={32}
                priority
            />
            <span className="text-sm ml-2">© 2025</span>
            <nav className="flex justify-end grow sm:gap-2">
              <a
                  className="flex gap-2 px-3 py-2 text-sm font-semibold text-gray-600 transition duration-100 rounded-md hover:text-gray-800"
                  href="https://www.exulu.com/toc"
              >
                <span> Terms and conditions</span>
              </a>
            </nav>
          </footer>
        </ThemeProvider>
        </body>
      </TanstackQueryClientProvider>
    </html>
  );
}
