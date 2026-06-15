import { AnalyticsView } from "./components/analytics-view";
import { lensFromSearchParams } from "./hooks";
import { guardRoute } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

interface AnalyticsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  // Route guard for /analytics — gate from nav-config ("analytics"): SA
  // only (navigation.md §1.2/§1.3 rule 5). A future role.analytics:r+ key
  // gated by ANALYTICS_OWN_AGENT_USAGE_SUPPORTED in lib/analytics-supported.ts
  // opens the P2 path; until then this is the only entry point.
  const denied = await guardRoute("analytics");
  if (denied) return denied;

  // Parse the five lens-shaping searchParams server-side so the first
  // paint already reflects the URL (analytics.md deep-link contract;
  // Home's /analytics?type=AGENT_RUN deep link must hydrate without a
  // client round-trip). NO server-side getTranslations here — UI copy is
  // owned by the client view (rule #4, the server-side i18n trap).
  const resolved = (await searchParams) ?? {};
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (Array.isArray(value)) {
      if (value[0] !== undefined) params.set(key, value[0]);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const initialLens = lensFromSearchParams(params);

  return <AnalyticsView initialLens={initialLens} />;
}
