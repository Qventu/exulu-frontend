import { AnalyticsView } from "./components/analytics-view";
// Import the pure lens helper from `./lens` (NOT `./hooks`). `hooks.ts` is
// a "use client" module, and any export from it is a client reference that
// a server component cannot invoke — calling lensFromSearchParams from
// here would throw "Attempted to call lensFromSearchParams() from the
// server". `./lens` has no client directive so it is server-safe.
import { lensFromSearchParams } from "./lens";
import { guardRoute } from "@/lib/route-guard";

export const dynamic = "force-dynamic";

interface AnalyticsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  // Route guard for /analytics — gate from nav-config ("analytics"): SA
  // only (navigation.md §1.2/§1.3 rule 5). The backend's matching authorize
  // check on /admin/litellm/tag-activity mirrors this predicate so the
  // route and the data plumbing fail-closed together. A future
  // `role.analytics:read` right is its own work item.
  const denied = await guardRoute("analytics");
  if (denied) return denied;

  // Parse the lens-shaping searchParams server-side so the first paint
  // already reflects the URL (analytics.md deep-link contract; Home's
  // /analytics?dimension=agents deep link must hydrate without a client
  // round-trip). NO server-side getTranslations here — UI copy is owned
  // by the client view (rule #4, the server-side i18n trap).
  //
  // The legacy ?type=AGENT_RUN family is still accepted on input —
  // lensFromSearchParams now translates it to a `dimension` seed
  // (AGENT_RUN→agents, USER_BUDGET→users, …) instead of an own `type`
  // field. lensToSearchParams never emits ?type, so the URL canonicalises
  // on the next router.replace.
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
