// Server-side route guard for /keys — gate from nav-config ("keys"):
// SA || role.api:w (navigation.md §1.2/§1.3 rule 5: nav-hidden must imply
// route-guarded; closes the /keys open-by-URL gap). Note: until the backend
// populates `api` in serverSideAuthCheck's role object, this gate collapses
// to super_admin in practice (explorer.md U2 / keys-token.md U3). The page is
// a client component, so the guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function KeysLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("keys")) ?? children;
}
