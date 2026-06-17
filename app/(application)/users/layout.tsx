// Server-side route guard for /users — gate from nav-config ("users"):
// SA || role.users:w (navigation.md §1.2/§1.3 rule 5: nav-hidden must imply
// route-guarded). /roles and /teams are aliases of this entry and carry the
// same guard in their own layouts. The page is a client component, so the
// guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function UsersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("users")) ?? children;
}
