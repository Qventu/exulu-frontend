// "/" routing rule (design/navigation.md §1.2 "Home" row; design/pages/dashboard.md
// "Routing rule"; IMPLEMENTATION_PLAN 1B): server component — P1-only accounts
// (no elevated right) keep today's behavior and go straight to /chat; elevated
// accounts land on Home. This also removes one hop of the old "/" → /chat →
// /chat/[agent] redirect chain for elevated users.
//
// The (home) route group keeps the URL at "/" while colocating the Today
// page's components/hooks/queries (codebase-structure §1 target tree).
// Work item 2.7: the interim HomePlaceholder is replaced by the real
// role-composed Today dashboard; the routing rule below is unchanged.

import { redirect } from "next/navigation";

import { isDemoMode } from "@/lib/demo/flag";
import { hrefFor, startPosition } from "@/lib/demo/tour";
import { isElevated } from "@/lib/rights";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";

import { HomeDashboard } from "./components/home-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  // The demo has no dashboard fixtures, so "/" is a doorway rather than a
  // destination: it hands the visitor to the tour's first step.
  //
  // This branch must come FIRST. The check below it calls serverSideAuthCheck,
  // which in demo mode asks an auth backend that is not there, returns null and
  // bounces the visitor to /login — which is exactly what the deployed demo did
  // at its own root URL. The (application) layout gets demo mode right
  // (`demoMode ? getDemoUser() : ...`); this page never learned about it, and
  // the comment below, written when that assumption held, is what made the bug
  // look reasonable in review.
  //
  // hrefFor + startPosition are pure and import nothing client-only, so a
  // server component may call them. The target is derived from the chapter
  // list, so re-ordering the story moves the front door with it.
  if (isDemoMode()) redirect(hrefFor(startPosition()));

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

  return <HomeDashboard />;
}
