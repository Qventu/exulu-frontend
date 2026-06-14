import { guardRoute } from "@/lib/route-guard";

import { N8nClient } from "./n8n-client";

/**
 * /n8n (Automation) — server entry.
 *
 * - Route guard (nav-config "automation"): (SA || role.workflows:r+)
 *   AND config.n8n.enabled. When N8N_URL is unset the config flag is off
 *   and the guard returns the shared AccessDenied (replaces the legacy
 *   hardcoded "N8n is not configured" string — see workflows.md inventory
 *   item 47).
 * - No t() / getTranslations here (5th-time server-side i18n trap). All
 *   visible copy lives in <N8nClient />.
 * - The iframe lives on the client so we can manage its loading state and
 *   swap to an EmptyState below md (the n8n editor needs a larger screen).
 */
export default async function N8nPage() {
  const denied = await guardRoute("automation");
  if (denied) return denied;

  const url = process.env.N8N_URL ?? "";

  return <N8nClient url={url} />;
}
