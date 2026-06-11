// "/" routing rule (design/navigation.md §1.2 "Home" row; design/pages/dashboard.md
// "Routing rule"; IMPLEMENTATION_PLAN 1B): server component — P1-only accounts
// (no elevated right) keep today's behavior and go straight to /chat; elevated
// accounts land on Home. This also removes one hop of the old /  → /chat →
// /chat/[agent] redirect chain for elevated users.
//
// TODO(design/pages/dashboard.md): the rendered Home is an interim placeholder.
// Work item 2.7 replaces <HomePlaceholder /> with the real role-composed
// dashboard; the routing rule below ships here and stays.

import { redirect } from "next/navigation";

import { isElevated } from "@/lib/rights";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";

import { HomePlaceholder } from "./home-placeholder";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await serverSideAuthCheck();
  // The (application) layout already gates unauthenticated requests; this is
  // the page-level belt-and-braces with the same destination preservation.
  if (!user) redirect("/login?destination=/");

  const elevated = isElevated({
    super_admin: user.super_admin === true,
    role: user.role,
  });

  // P1-only: their Exulu is a chat app — "/" keeps routing straight into Chat
  // (preserves the single-agent / default-agent landing logic on /chat).
  if (!elevated) redirect("/chat");

  return <HomePlaceholder />;
}
