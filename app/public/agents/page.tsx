import { redirect } from "next/navigation";

import { fetchPublicAgents } from "@/lib/api/public-agents";
import { PublicAgentsGrid } from "./components/public-agents-grid";
import { PublicNote } from "./components/public-note";

// NO getTranslations here — server pages must not use next-intl/server
// (i18n/config.ts intentionally has no default export / server pathway;
// see the same rule on the app/(application) pages). Copy lives in the
// client components below.
export const dynamic = "force-dynamic";

export default async function PublicAgentsPage() {
  const agents = await fetchPublicAgents();

  if (agents === null) {
    return <PublicNote kind="misconfigured" />;
  }
  if (agents.length === 0) {
    return <PublicNote kind="empty" />;
  }
  if (agents.length === 1) {
    redirect(`/public/agents/${encodeURIComponent(agents[0].id)}`);
  }

  return <PublicAgentsGrid agents={agents} />;
}
