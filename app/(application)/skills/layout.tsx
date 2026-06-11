// Server-side route guard for /skills — gate from nav-config ("skills"):
// SA || role.agents:w (navigation.md §1.2/§1.3 rule 5: nav-hidden must imply
// route-guarded). The pages are client components, so the guard lives in this
// server layout and renders AccessDenied instead of children when denied.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function SkillsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("skills")) ?? children;
}
