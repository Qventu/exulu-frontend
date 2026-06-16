/**
 * /data (Knowledge) — context library (L1) entry point (work item 2.11,
 * owner "library"; knowledge.md §3 "Default view (L1)" + ladder rows 1, 3,
 * 4, 5, 7, 8-13, 83-84).
 *
 * Pure server shell:
 *   - RBAC guard via `guardRoute("knowledge")` (interim `SA || role.agents:r+`
 *     per nav-config; flips to `knowledge:read` when backend ships the role).
 *   - Reads the session user to forward the `super_admin` flag to the
 *     client wrapper (mirrors how home/page.tsx + agents pattern shape
 *     SA-gated regions).
 *   - Composes the client surface. No `getTranslations` call here — the
 *     project's `next-intl/server` `getRequestConfig` pathway is not wired
 *     (i18n/config.ts has no default export), so server pages must keep all
 *     copy in their client wrappers (same trap that bit agents, prompts,
 *     and skills).
 *
 * The legacy `app/(application)/data/[[...query]]/page.tsx` is replaced by
 * the workspace owner's redirect shim — `/data` itself routes here.
 */

import { Suspense } from "react";

import { guardRoute } from "@/lib/route-guard";

import { ContextLibrary } from "./components/context-library";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const denied = await guardRoute("knowledge");
  if (denied) return denied;

  return (
    <Suspense fallback={<Loading />}>
      <ContextLibrary />
    </Suspense>
  );
}
