// Server-side route guards (navigation.md §1.3 rule 5, IMPLEMENTATION_PLAN 1A).
//
// "Nav-hidden must imply route-guarded": every route the sidebar would hide is
// guarded here with the SAME `requires` predicate the sidebar consumes — the
// declarative table in components/shell/nav-config.ts, evaluated via
// lib/rights.ts#can. Gating can never diverge between the nav and the routes.
//
// Usage (App Router):
//   - server `page.tsx`:   const denied = await guardRoute("explorer");
//                          if (denied) return denied;
//   - client `page.tsx`:   add a server `layout.tsx` next to it:
//                          export default async function Layout({ children }) {
//                            return (await guardRoute("agents")) ?? children;
//                          }
//
// Denied accounts get the shared AccessDenied primitive (philosophy: trust
// through transparency — the missing right is named, nobody is silently
// bounced). Unauthenticated requests are redirected to /login exactly like
// app/(application)/layout.tsx does. Config-flag gates (e.g. n8n) also render
// AccessDenied when the feature is off (navigation.md §1.2).
//
// Server-only module: imports next/headers — never import from client code.

import { type ReactElement } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccessDenied } from "@/components/primitives/access-denied";
import {
  flagEnabled,
  NAV_ENTRIES,
  type NavConfig,
  type NavEntry,
} from "@/components/shell/nav-config";
import { configApi, type BackendConfigType } from "@/lib/api/config";
import { can, type Requirement, type RightsUser } from "@/lib/rights";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { demoConfig } from "@/lib/demo/config";
import { isDemoMode } from "@/lib/demo/flag";
import { getDemoUser } from "@/lib/demo/user";

// serverSideAuthCheck is wrapped in React.cache at its source, so the root
// layout's call and every guard in the same render pass share one DB
// round-trip per request.
const getSessionUser = async () =>
  isDemoMode() ? getDemoUser() : serverSideAuthCheck();

/**
 * The server-derived slice of NavConfig the guards need. The transcription /
 * n8n / feedback switches are frontend-env-only (mirroring the wiring in
 * app/(application)/layout.tsx). Recall meeting bots, however, are gated by
 * BACKEND env vars (RECALL_*), so that flag is read from the backend /config
 * payload — the same source the client ConfigContext receives via `...json`.
 */
async function serverNavConfig(): Promise<NavConfig> {
  let recallEnabled = false;
  if (isDemoMode()) {
    // The demo describes a deployment, and lib/demo/config.ts is where that
    // description lives — the client ConfigContext already reads it. Without
    // this branch the two disagreed: the client was told recall was on while
    // the server asked a backend that is not there, caught the failure and
    // reported it off. The Transcriptions nav entry vanished and the route
    // answered "You don't have access to this page", which is how chapter 7
    // first rendered in the browser.
    //
    // It also skips an HTTP call that could only ever fail, on every guarded
    // route in the tour.
    recallEnabled = demoConfig().recall?.enabled === true;
  } else {
    try {
      const res = await configApi.backend();
      const json: BackendConfigType = await res.json();
      recallEnabled = json.recall?.enabled === true;
    } catch {
      recallEnabled = false;
    }
  }
  return {
    transcription: {
      enabled:
        typeof process.env.TRANSCRIPTION_MODEL === "string" &&
        process.env.TRANSCRIPTION_MODEL !== "" &&
        process.env.EXULU_USE_LITELLM === "true",
    },
    recall: { enabled: recallEnabled },
    n8n: {
      enabled:
        typeof process.env.N8N_URL === "string" && process.env.N8N_URL !== "",
    },
    feedback: { enabled: process.env.FEEDBACK_ENABLED === "true" },
  };
}

/** Human-readable right for AccessDenied's `requiredRight` code chip. */
function describeRequirement(requirement: Requirement): string | undefined {
  if (requirement === "all") return undefined;
  if (requirement === "super_admin" || requirement === "elevated") {
    return requirement;
  }
  return `${requirement.area}:${requirement.level}`;
}

/**
 * Either the `id` of a NavEntry in components/shell/nav-config.ts (preferred —
 * the gate then lives in exactly one place, config flags included), or an
 * inline Requirement for surfaces that have no nav entry.
 */
export type RouteGuardInput = NavEntry["id"] | Requirement;

/**
 * Server-side route guard. Resolves the requirement (and config flag) from
 * nav-config, runs serverSideAuthCheck, and returns:
 *   - a redirect to /login (never returns) when unauthenticated,
 *   - the shared <AccessDenied/> element when the predicate or config flag
 *     denies the route — render it INSTEAD of the page/children,
 *   - null when the account may proceed.
 */
export async function guardRoute(
  input: RouteGuardInput,
): Promise<ReactElement | null> {
  let entry: NavEntry | undefined;
  let requirement: Requirement;

  if (typeof input === "string") {
    entry = NAV_ENTRIES.find((candidate) => candidate.id === input);
    if (entry) {
      requirement = entry.requires;
    } else if (
      input === "all" ||
      input === "super_admin" ||
      input === "elevated"
    ) {
      // Inline string-form Requirement (no nav entry carries these as ids).
      requirement = input;
    } else {
      // Programmer error — fail loudly so a typo can't ship an open route.
      throw new Error(
        `guardRoute: unknown nav entry id "${input}" (see components/shell/nav-config.ts)`,
      );
    }
  } else {
    requirement = input;
  }

  const user = await getSessionUser();
  if (!user) {
    // Same contract as app/(application)/layout.tsx for unauthenticated hits.
    const headerList = await headers();
    const pathname = headerList.get("x-next-pathname") ?? "";
    redirect(`/login${pathname ? `?destination=${pathname}` : ""}`);
  }

  const rightsUser: RightsUser = {
    super_admin: user.super_admin === true,
    role: user.role,
  };

  if (!can(rightsUser, requirement)) {
    return (
      <AccessDenied
        requiredRight={describeRequirement(requirement)}
        backHref="/chat"
      />
    );
  }

  if (entry?.configFlag && !flagEnabled(await serverNavConfig(), entry.configFlag)) {
    // Feature is switched off for the whole workspace — no right to name.
    return <AccessDenied backHref="/chat" />;
  }

  return null;
}
