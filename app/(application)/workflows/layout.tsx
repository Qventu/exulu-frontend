// Server-side route guard for /workflows (Routines) — gate from nav-config
// ("routines"): SA || role.workflows:r+ (navigation.md §1.2/§1.3 rule 5:
// nav-hidden must imply route-guarded; closes the /workflows open-by-URL gap).
// The page is a client component, so the guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function WorkflowsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("routines")) ?? children;
}
