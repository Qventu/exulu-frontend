// Server-side route guard for /feedback (the P3 review console, not the
// footer's "Send feedback" dialog) — gate from nav-config ("feedback"): SA
// (future role.feedback — navigation.md §1.2). The page is a client
// component, so the guard lives in this server layout.
import type { ReactNode } from "react";

import { guardRoute } from "@/lib/route-guard";

export default async function FeedbackLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (await guardRoute("feedback")) ?? children;
}
