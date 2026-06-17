/**
 * /prompts — P2 prompt-library surface (work item 2.9; prompts.md primary
 * persona P2, secondary P1 use).
 *
 * Thin server component: the RBAC guard lives in layout.tsx
 * (guardRoute("prompts")), so the page only composes the client surface.
 * The Suspense boundary is required because PromptsView mounts ListDetail,
 * which reads useSearchParams (list-detail.tsx JSDoc rule).
 */
import { Suspense } from "react";

import { PromptsView } from "./components/prompts-view";
import Loading from "./loading";

export const dynamic = "force-dynamic";

export default function PromptsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PromptsView />
    </Suspense>
  );
}
