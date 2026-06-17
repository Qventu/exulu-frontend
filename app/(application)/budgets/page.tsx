/**
 * /budgets — server route shell (work item 3.2, budgets.md §3).
 *
 * Thin server component: the RBAC guard lives in layout.tsx
 * (`guardRoute("budgets")` — SA || role.budget_management:r+), so this
 * file only composes the client surface inside PageShell. The Suspense
 * boundary is required because BudgetsView reads useSearchParams
 * (deep-link target for the L1 AttentionList rows).
 *
 * Server-side i18n trap (project recurring pattern): MUST NOT call
 * getTranslations or t() from next-intl/server. All user-visible copy
 * lives in the client components under ./components/.
 */
import { Suspense } from "react";

import { PageShell } from "@/components/primitives/page-shell";

import { BudgetsView } from "./components/budgets-view";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default function BudgetsPage() {
  return (
    <PageShell>
      <Suspense fallback={<Loading />}>
        <BudgetsView />
      </Suspense>
    </PageShell>
  );
}
