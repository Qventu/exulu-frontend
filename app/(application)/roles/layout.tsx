// Server-side route guard for /roles — /roles is an alias/tab of the "users"
// nav entry (navigation.md §1.2 "Users & access"), so it carries the exact
// same gate: SA || role.users:w. The page is a client component, so the
// guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function RolesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("users")) ?? children;
}
