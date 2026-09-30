/**
 * /memory — Memory area overview (agent memory redesign, sub-project 2).
 * Server component: guard, then hand off to the client overview which owns
 * i18n and all state (server pages must not call getTranslations here).
 */
import { guardRoute } from "@/lib/route-guard";

import { MemoryOverview } from "./components/memory-overview";

export default async function MemoryPage() {
  const denied = await guardRoute("memory");
  if (denied) return denied;
  return <MemoryOverview />;
}
