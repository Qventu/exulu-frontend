// Server-side route guard for /variables (incl. create/edit/usage) — gate
// from nav-config ("variables"): SA || role.variables:r+ (navigation.md §1.2/
// §1.3 rule 5: nav-hidden must imply route-guarded). The pages are client
// components, so the guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function VariablesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("variables")) ?? children;
}
