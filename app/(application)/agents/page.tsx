/**
 * /agents — the P2 flagship build surface (work item 2.8, owner "index";
 * agents.md: primary persona P2, secondary P4).
 *
 * Thin server component: the server-side RBAC guard (SA || role.agents:r+)
 * lives in this route's layout.tsx via guardRoute("agents"); the page just
 * composes the client surface. The <Suspense> boundary is required because
 * AgentsView mounts ListDetail, which reads useSearchParams (list-detail.tsx
 * JSDoc rule for statically prerendered consumers).
 *
 * The legacy 170-line client page (card grid, client-only name filter over a
 * hard limit:100, eager CREATE_AGENT_SESSION on card click) is replaced by
 * components/agents-view.tsx — chat entry is now the lazy /chat/{id}/new
 * route (agents.md reviews #3/#6/#15).
 */
import { Suspense } from "react";

import { AgentsView } from "./components/agents-view";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AgentsView />
    </Suspense>
  );
}
