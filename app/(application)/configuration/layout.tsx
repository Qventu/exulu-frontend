// Server-side route guard for /configuration — gate from nav-config
// ("configuration"): SA only (navigation.md §1.2/§1.3 rule 5: nav-hidden must
// imply route-guarded; closes the /configuration open-by-URL gap). The page
// is a client component, so the guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function ConfigurationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("configuration")) ?? children;
}
