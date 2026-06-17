// Server-side route guard for /agents — gate from nav-config ("agents"):
// SA || role.agents:r+ (navigation.md §1.2/§1.3 rule 5: nav-hidden must imply
// route-guarded). The page is a client component, so the guard lives in this
// server layout and renders AccessDenied instead of children when denied.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function AgentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("agents")) ?? children;
}
