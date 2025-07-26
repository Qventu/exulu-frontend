import "../globals.css";
import {Inter as FontSans} from "next/font/google";
import * as React from "react";
import {cn} from "@/lib/utils";
import {getServerSession} from "next-auth";
import {getAuthOptions, pool} from "@/app/api/auth/[...nextauth]/options";
import {redirect} from "next/navigation";
import {headers} from "next/headers";
import {ThemeProvider} from "@/components/theme-provider";
import {TanstackQueryClientProvider} from "@/app/(application)/query-client";
import Authenticated from "@/app/(application)/authenticated";
import {Toaster} from "@/components/ui/toaster";

const fontSans = FontSans({
    subsets: ["latin"],
    variable: "--font-sans",
});

export default async function RootLayout({
                                             children,
                                         }: {
    children: React.ReactNode;
}) {

    const headersList = headers();
    const pathname = headersList.get('x-next-pathname') || '/';
    
    const authOptions = await getAuthOptions()
    const session: any = await getServerSession(authOptions);
    if (!session?.user) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);
    const res = await pool.query(`
      SELECT 
        users.*,
        json_build_object(
          'id', roles.id,
          'name', roles.name,
          'is_admin', roles.is_admin,
          'agents', roles.agents
        ) as role
      FROM users 
      LEFT JOIN roles ON users.role = roles.id 
      WHERE users.email = $1
    `, [session.user.email])
    const user: any = res.rows[0];
    console.log("res",res.rows)
    console.log("session.user.email",session.user.email)
    if (!user) return redirect(`/login${pathname ? `?destination=${pathname}` : ''}`);

    return (
        <html lang="en" suppressHydrationWarning>
        <body
            className={cn(
                `min-h-screen flex flex-col bg-background font-sans antialiased h-[100vh]`,
                fontSans.variable,
            )}
        >
        <script type="module" defer src="https://cdn.jsdelivr.net/npm/ldrs/dist/auto/grid.js"></script>
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
            <Toaster/>
            <footer className="flex items-center h-20 gap-1 px-8 font-medium border-t md:px-20">
                {/*<Image
                src="/exulu_logo.svg"
                alt="Exulu Logo"
                className="invert dark:invert-0"
                width={64}
              height={32}
              priority
            />*/}
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
        </html>
    );
}
